"""Multi-model router: Auto fallback chain, rate-limit cooldown + rerouting,
bounded retries, and a `complete()` matching the orchestrator's CompleteFn.

The router is constructed per-scan with the user's available provider keys and
the scan's mode/order. It hides provider failures: Auto tries providers in order,
cooling down any that rate-limit and rerouting to healthy ones. Manual mode
distributes calls round-robin across the selected providers.
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field

from typing import AsyncIterator

from app.services.llm_clients import (
    COMPLETERS,
    PROVIDER_LABELS,
    STREAMERS,
    Completion,
    ProviderError,
    ProviderTimeout,
    RateLimited,
)

COOLDOWN_SECONDS = 60.0
MAX_BACKOFF_RETRIES = 2


@dataclass
class RouterEvent:
    """A reroute/cooldown event for the WebSocket layer (Module 5) to surface."""
    kind: str            # "rate_limited" | "rerouted" | "exhausted"
    provider: str
    rerouted_to: str | None = None


@dataclass
class ModelRouter:
    keys: dict[str, str]                    # provider -> api key
    order: list[str]                        # fallback / distribution order
    mode: str = "auto"                      # auto | manual
    # Usage attribution (Module 16) — set so each call is logged.
    user_id: str | None = None
    scan_id: str | None = None
    purpose: str | None = None
    _cooldown_until: dict[str, float] = field(default_factory=dict)
    _rr_index: int = 0
    events: list[RouterEvent] = field(default_factory=list)

    # --- health ---
    def _available(self) -> list[str]:
        now = time.monotonic()
        return [
            p for p in self.order
            if p in self.keys and self._cooldown_until.get(p, 0) <= now
        ]

    def _cool_down(self, provider: str) -> None:
        self._cooldown_until[provider] = time.monotonic() + COOLDOWN_SECONDS
        self.events.append(RouterEvent("rate_limited", provider))

    def has_any_key(self) -> bool:
        return any(p in self.keys for p in self.order)

    async def _call(self, provider: str, prompt: str) -> Completion:
        return await COMPLETERS[provider](self.keys[provider], prompt)

    async def _record(self, comp: Completion) -> None:
        """Log token usage for this call (Module 16). No-op without a user_id."""
        if not self.user_id:
            return
        from app.services.usage import record_usage
        await record_usage(
            self.user_id, comp.provider, comp.model,
            comp.tokens_in, comp.tokens_out,
            scan_id=self.scan_id, purpose=self.purpose,
        )

    async def complete(self, prompt: str, model_hint: str | None = None) -> str:
        """Return raw model text. Reroutes around rate limits; never raises on a
        provider failure unless every candidate is exhausted — then returns "" so
        the segment is recorded as unanalyzed (the scan still completes)."""
        candidates = self._ordered_candidates(model_hint)
        for provider in candidates:
            try:
                comp = await self._call_with_backoff(provider, prompt)
                await self._record(comp)
                return comp.text
            except RateLimited:
                self._cool_down(provider)
                nxt = next((p for p in candidates if p != provider and p in self._available()), None)
                if nxt:
                    self.events.append(RouterEvent("rerouted", provider, rerouted_to=nxt))
                continue
            except ProviderTimeout:
                # Timeout: skip this provider for the segment, try next.
                continue
            except ProviderError:
                continue
        self.events.append(RouterEvent("exhausted", candidates[0] if candidates else "none"))
        return ""

    async def stream(self, prompt: str, model_hint: str | None = None) -> AsyncIterator[str]:
        """Stream text deltas from the first provider that yields output. On a
        provider failure before any output, reroute to the next candidate."""
        candidates = self._ordered_candidates(model_hint)
        for provider in candidates:
            produced = False
            try:
                async for delta in STREAMERS[provider](self.keys[provider], prompt):
                    produced = True
                    yield delta
                return  # finished cleanly
            except RateLimited:
                self._cool_down(provider)
                if produced:
                    return  # can't restart mid-stream
                continue
            except (ProviderTimeout, ProviderError):
                if produced:
                    return
                continue
        # Nothing streamed — signal exhaustion via empty generator.
        return

    def _ordered_candidates(self, model_hint: str | None) -> list[str]:
        avail = self._available()
        if not avail:
            # All cooling down — fall back to anything with a key (best effort).
            avail = [p for p in self.order if p in self.keys]
        if model_hint and model_hint in avail:
            # Honour the hint first, then the rest as fallback.
            return [model_hint] + [p for p in avail if p != model_hint]
        if self.mode == "manual":
            # Round-robin starting point for even distribution.
            if avail:
                start = self._rr_index % len(avail)
                self._rr_index += 1
                return avail[start:] + avail[:start]
        return avail

    async def _call_with_backoff(self, provider: str, prompt: str) -> Completion:
        delay = 1.0
        last_exc: Exception | None = None
        for attempt in range(MAX_BACKOFF_RETRIES + 1):
            try:
                return await self._call(provider, prompt)
            except RateLimited:
                raise  # handled by caller (cooldown + reroute)
            except (ProviderTimeout, ProviderError) as e:
                last_exc = e
                if attempt < MAX_BACKOFF_RETRIES:
                    await asyncio.sleep(delay)
                    delay *= 2
                else:
                    raise
        assert last_exc is not None
        raise last_exc

    def label_for(self, provider: str | None) -> str | None:
        if not provider:
            return None
        return PROVIDER_LABELS.get(provider, provider)
