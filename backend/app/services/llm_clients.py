"""Chat-completion clients for Gemini and OpenRouter.

Each `complete_*` makes one text-in/text-out call and raises a typed error on
failure so the router can react (cool down on rate limits, mark unanalyzed on
timeout). Usage logging (Module 16) hooks the returned token counts later.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

import httpx

from app.core.config import settings

SEGMENT_TIMEOUT_S = settings.segment_timeout_s
# Cap on analysis JSON output. Set generously: a batch covers many segments, and
# if the model truncates its JSON the trailing segments come back unparseable
# (recovered by re-analysis, but cheaper to avoid). Models clamp to their own
# max if this exceeds it.
MAX_ANALYSIS_TOKENS = 16384


class ProviderError(Exception):
    """Base provider failure."""


class RateLimited(ProviderError):
    """429 / quota exhausted — provider should be cooled down."""


class ProviderTimeout(ProviderError):
    """Call exceeded the per-segment timeout."""


@dataclass
class Completion:
    text: str
    provider: str
    model: str
    tokens_in: int = 0
    tokens_out: int = 0


# Default model id per provider (env-overridable via GEMINI_MODEL etc.).
DEFAULT_MODELS = {
    "gemini": settings.gemini_model,
    "openrouter": settings.openrouter_model,
}

# Neutral, vendor-free labels for any place a provider id would otherwise be
# shown to a user (e.g. usage stats). Finding attribution uses the per-scan Akira
# tier label via ModelRouter.label_for; this is the fallback for aggregate views
# that only know the provider. The vendor name is deliberately never surfaced.
PROVIDER_LABELS = {
    "gemini": "Akira Fast",
    "openrouter": "Akira (Balanced/Deep)",
}


def _timeout() -> httpx.Timeout:
    return httpx.Timeout(SEGMENT_TIMEOUT_S)


async def complete_gemini(
    key: str, prompt: str, model: str | None = None, response_json: bool = True
) -> Completion:
    model = model or DEFAULT_MODELS["gemini"]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    # Force JSON output and a generous token cap when requested: analysis must
    # return parseable JSON.
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": MAX_ANALYSIS_TOKENS,
            "temperature": 0,
        },
    }
    if response_json:
        payload["generationConfig"]["responseMimeType"] = "application/json"  # REST v1beta camelCase
    try:
        async with httpx.AsyncClient(timeout=_timeout()) as c:
            r = await c.post(url, params={"key": key}, json=payload)
    except httpx.TimeoutException as e:
        raise ProviderTimeout("gemini timeout") from e
    except httpx.HTTPError as e:
        raise ProviderError(f"gemini network error: {type(e).__name__}") from e

    if r.status_code == 429:
        raise RateLimited("gemini rate limited")
    if r.status_code >= 400:
        raise ProviderError(f"gemini status {r.status_code}")
    data = r.json()
    text = ""
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        text = ""
    text = text or ""  # a null content field deserializes to None
    usage = data.get("usageMetadata", {})
    return Completion(
        text=text, provider="gemini", model=model,
        tokens_in=usage.get("promptTokenCount", 0),
        tokens_out=usage.get("candidatesTokenCount", 0),
    )


async def _openai_style(
    provider: str, base_url: str, key: str, prompt: str, model: str,
    extra_headers: dict | None = None,
    response_json: bool = True,
) -> Completion:
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    # These completers serve analysis, which must return parseable JSON. Force
    # JSON object mode + a token cap when response_json is True.
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": MAX_ANALYSIS_TOKENS,
    }
    if response_json:
        payload["response_format"] = {"type": "json_object"}
    try:
        async with httpx.AsyncClient(timeout=_timeout()) as c:
            r = await c.post(f"{base_url}/chat/completions", headers=headers, json=payload)
    except httpx.TimeoutException as e:
        raise ProviderTimeout(f"{provider} timeout") from e
    except httpx.HTTPError as e:
        raise ProviderError(f"{provider} network error: {type(e).__name__}") from e

    if r.status_code == 429:
        raise RateLimited(f"{provider} rate limited")
    if r.status_code >= 400:
        raise ProviderError(f"{provider} status {r.status_code}")
    data = r.json()
    text = ""
    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        text = ""
    text = text or ""  # a null content field deserializes to None
    usage = data.get("usage", {})
    return Completion(
        text=text, provider=provider, model=model,
        tokens_in=usage.get("prompt_tokens", 0),
        tokens_out=usage.get("completion_tokens", 0),
    )


async def complete_openrouter(
    key: str, prompt: str, model: str | None = None, response_json: bool = True
) -> Completion:
    return await _openai_style(
        "openrouter", "https://openrouter.ai/api/v1", key, prompt,
        model or DEFAULT_MODELS["openrouter"],
        extra_headers={"HTTP-Referer": "https://akira.ai", "X-Title": "Akira AI"},
        response_json=response_json,
    )


COMPLETERS = {
    "gemini": complete_gemini,
    "openrouter": complete_openrouter,
}


# ---- Streaming --------------------------------------------------------------
async def stream_gemini(key: str, prompt: str, model: str | None = None,
                        messages: list[dict] | None = None):
    """Yield text deltas from Gemini's SSE streaming endpoint.

    When `messages` is provided (role-separated dicts with 'role'/'content'),
    the system turn is lifted into a separate systemInstruction so the model
    genuinely respects it. Falls back to the flat-prompt path when absent.
    """
    model = model or DEFAULT_MODELS["gemini"]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent"
    if messages:
        # Split the system message out; everything else becomes contents.
        sys_msgs = [m for m in messages if m.get("role") == "system"]
        chat_msgs = [m for m in messages if m.get("role") != "system"]
        payload: dict = {
            "contents": [
                {
                    "role": "model" if m["role"] == "assistant" else "user",
                    "parts": [{"text": m["content"]}],
                }
                for m in chat_msgs
            ],
            "generationConfig": {"temperature": 0.3},
        }
        if sys_msgs:
            payload["systemInstruction"] = {"parts": [{"text": sys_msgs[0]["content"]}]}
    else:
        payload = {"contents": [{"parts": [{"text": prompt}]}],
                   "generationConfig": {"temperature": 0.3}}
    try:
        async with httpx.AsyncClient(timeout=_timeout()) as c:
            async with c.stream("POST", url, params={"key": key, "alt": "sse"}, json=payload) as r:
                if r.status_code == 429:
                    raise RateLimited("gemini rate limited")
                if r.status_code >= 400:
                    raise ProviderError(f"gemini status {r.status_code}")
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        obj = json.loads(data)
                        text = obj["candidates"][0]["content"]["parts"][0]["text"]
                        if text:
                            yield text
                    except (KeyError, IndexError, ValueError):
                        continue
    except httpx.TimeoutException as e:
        raise ProviderTimeout("gemini timeout") from e
    except httpx.HTTPError as e:
        raise ProviderError(f"gemini network error: {type(e).__name__}") from e


async def _stream_openai_style(provider, base_url, key, prompt, model,
                               extra_headers=None, messages: list[dict] | None = None):
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    # Use structured messages when provided; fall back to single-user prompt.
    msg_list = messages if messages else [{"role": "user", "content": prompt}]
    payload = {
        "model": model, "messages": msg_list,
        "temperature": 0.3, "stream": True,
    }
    try:
        async with httpx.AsyncClient(timeout=_timeout()) as c:
            async with c.stream("POST", f"{base_url}/chat/completions", headers=headers, json=payload) as r:
                if r.status_code == 429:
                    raise RateLimited(f"{provider} rate limited")
                if r.status_code >= 400:
                    raise ProviderError(f"{provider} status {r.status_code}")
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        obj = json.loads(data)
                        delta = obj["choices"][0]["delta"].get("content")
                        if delta:
                            yield delta
                    except (KeyError, IndexError, ValueError):
                        continue
    except httpx.TimeoutException as e:
        raise ProviderTimeout(f"{provider} timeout") from e
    except httpx.HTTPError as e:
        raise ProviderError(f"{provider} network error: {type(e).__name__}") from e


async def stream_openrouter(key: str, prompt: str, model: str | None = None,
                            messages: list[dict] | None = None):
    async for d in _stream_openai_style(
        "openrouter", "https://openrouter.ai/api/v1", key, prompt,
        model or DEFAULT_MODELS["openrouter"],
        extra_headers={"HTTP-Referer": "https://akira.ai", "X-Title": "Akira AI"},
        messages=messages,
    ):
        yield d


STREAMERS = {
    "gemini": stream_gemini,
    "openrouter": stream_openrouter,
}
