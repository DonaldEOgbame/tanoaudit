"""Module 4 tests: router fallback/cooldown/reroute, backoff, verification."""
import pytest

import app.services.router_model as rm
from app.services.llm_clients import Completion, ProviderError, ProviderTimeout, RateLimited
from app.services.router_model import ModelRouter
from app.services.verification import verify_criticals
from app.models.scan import Finding, ENGINE_SECURITY


def _completers(monkeypatch, mapping):
    """Patch COMPLETERS with provider -> async fn(key, prompt, model=None)."""
    monkeypatch.setattr(rm, "COMPLETERS", mapping)


async def test_auto_fallback_on_rate_limit(monkeypatch):
    async def gemini(key, prompt, model=None):
        raise RateLimited("nope")

    async def openrouter(key, prompt, model=None):
        return Completion(text="OK-from-openrouter", provider="openrouter", model="x")

    _completers(monkeypatch, {"gemini": gemini, "openrouter": openrouter})
    r = ModelRouter(keys={"gemini": "k", "openrouter": "k"}, order=["gemini", "openrouter"], mode="auto")

    out = await r.complete("prompt")
    assert out == "OK-from-openrouter"
    # Gemini is now cooling down, and a reroute event was emitted.
    kinds = [e.kind for e in r.events]
    assert "rate_limited" in kinds
    assert any(e.kind == "rerouted" and e.rerouted_to == "openrouter" for e in r.events)


async def test_all_exhausted_returns_empty(monkeypatch):
    async def boom(key, prompt, model=None):
        raise ProviderError("down")

    _completers(monkeypatch, {"gemini": boom, "openrouter": boom})
    r = ModelRouter(keys={"gemini": "k", "openrouter": "k"}, order=["gemini", "openrouter"])
    out = await r.complete("p")
    assert out == ""  # segment will be recorded unanalyzed
    assert any(e.kind == "exhausted" for e in r.events)


async def test_timeout_skips_provider(monkeypatch):
    async def slow(key, prompt, model=None):
        raise ProviderTimeout("timeout")

    async def fast(key, prompt, model=None):
        return Completion(text="recovered", provider="openrouter", model="x")

    _completers(monkeypatch, {"gemini": slow, "openrouter": fast})
    r = ModelRouter(keys={"gemini": "k", "openrouter": "k"}, order=["gemini", "openrouter"])
    assert await r.complete("p") == "recovered"


async def test_backoff_retries_then_succeeds(monkeypatch):
    calls = {"n": 0}

    async def flaky(key, prompt, model=None):
        calls["n"] += 1
        if calls["n"] < 2:
            raise ProviderError("transient")
        return Completion(text="ok", provider="gemini", model="x")

    # Make sleep instant.
    async def no_sleep(_):
        return None

    monkeypatch.setattr(rm.asyncio, "sleep", no_sleep)
    _completers(monkeypatch, {"gemini": flaky})
    r = ModelRouter(keys={"gemini": "k"}, order=["gemini"])
    assert await r.complete("p") == "ok"
    assert calls["n"] == 2


async def test_manual_round_robin(monkeypatch):
    seen = []

    def make(name):
        async def fn(key, prompt, model=None):
            seen.append(name)
            return Completion(text=name, provider=name, model="x")
        return fn

    _completers(monkeypatch, {"gemini": make("gemini"), "openrouter": make("openrouter")})
    r = ModelRouter(
        keys={"gemini": "k", "openrouter": "k"}, order=["gemini", "openrouter"], mode="manual"
    )
    await r.complete("p")
    await r.complete("p")
    # Round-robin should have used both providers across two calls.
    assert set(seen) == {"gemini", "openrouter"}


async def test_stream_yields_deltas_and_reroutes(monkeypatch):
    async def gemini_stream(key, prompt, model=None):
        raise RateLimited("down")
        yield  # make it an async generator

    async def openrouter_stream(key, prompt, model=None):
        for piece in ["Hello", " ", "world"]:
            yield piece

    monkeypatch.setattr(rm, "STREAMERS", {"gemini": gemini_stream, "openrouter": openrouter_stream})
    r = ModelRouter(keys={"gemini": "k", "openrouter": "k"}, order=["gemini", "openrouter"])
    out = [chunk async for chunk in r.stream("p")]
    assert "".join(out) == "Hello world"  # rerouted to openrouter after gemini 429


async def test_verification_downgrades_on_disagreement(monkeypatch):
    # Router whose verifier model says "not confirmed".
    async def verifier(key, prompt, model=None):
        return Completion(text='{"confirmed": false, "reason": "benign"}', provider="openrouter", model="x")

    _completers(monkeypatch, {"openrouter": verifier, "gemini": verifier})
    r = ModelRouter(keys={"gemini": "k", "openrouter": "k"}, order=["gemini", "openrouter"])

    f = Finding(
        scan_id="s", public_id="VLN-0001", engine=ENGINE_SECURITY,
        category="Injection", severity="critical", confidence="High",
        file="a.js", line_start=1, line_end=3, code_snippet="db.raw(x)",
        explanation="raw sql", model_attribution="Gemini 2.0 Flash",
    )
    await verify_criticals([f], r, None)
    assert f.severity == "high"
    assert "Downgraded from Critical" in (f.explanation or "")
    assert f.verified_by == "OpenRouter / Claude Haiku"


async def test_verification_confirms(monkeypatch):
    async def verifier(key, prompt, model=None):
        return Completion(text='{"confirmed": true}', provider="openrouter", model="x")

    _completers(monkeypatch, {"openrouter": verifier, "gemini": verifier})
    r = ModelRouter(keys={"gemini": "k", "openrouter": "k"}, order=["gemini", "openrouter"])
    f = Finding(
        scan_id="s", public_id="VLN-0001", engine=ENGINE_SECURITY,
        category="Injection", severity="critical", confidence="High",
        file="a.js", line_start=1, line_end=3, code_snippet="x",
        explanation="e", model_attribution="Gemini 2.0 Flash",
    )
    await verify_criticals([f], r, None)
    assert f.severity == "critical"
    assert f.verified_by == "OpenRouter / Claude Haiku"
