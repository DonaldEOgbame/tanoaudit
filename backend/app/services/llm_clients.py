"""Chat-completion clients for Gemini, Groq, and OpenRouter.

Each `complete_*` makes one text-in/text-out call and raises a typed error on
failure so the router can react (cool down on rate limits, mark unanalyzed on
timeout). Usage logging (Module 16) hooks the returned token counts later.
"""
from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.core.config import settings

SEGMENT_TIMEOUT_S = 30.0
# Cap on analysis JSON output. Without an explicit cap, large segments could be
# truncated mid-JSON (the whole segment then fails to parse and its findings are
# lost). Generous enough for many findings per segment.
MAX_ANALYSIS_TOKENS = 8192


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
    "groq": settings.groq_model,
    "openrouter": settings.openrouter_model,
}

# Friendly label used for finding attribution / UI.
PROVIDER_LABELS = {
    "gemini": "Gemini 2.0 Flash",
    "groq": "Groq Llama 3.3",
    "openrouter": "OpenRouter / Claude Haiku",
}


def _timeout() -> httpx.Timeout:
    return httpx.Timeout(SEGMENT_TIMEOUT_S)


async def complete_gemini(key: str, prompt: str, model: str | None = None) -> Completion:
    model = model or DEFAULT_MODELS["gemini"]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    # Force JSON output and a generous token cap: analysis must return parseable
    # JSON, and without these some models wrap the JSON in prose/fences or get
    # truncated on larger segments, which loses the whole segment's findings.
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",  # REST v1beta camelCase
            "maxOutputTokens": MAX_ANALYSIS_TOKENS,
            "temperature": 0,
        },
    }
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
    usage = data.get("usageMetadata", {})
    return Completion(
        text=text, provider="gemini", model=model,
        tokens_in=usage.get("promptTokenCount", 0),
        tokens_out=usage.get("candidatesTokenCount", 0),
    )


async def _openai_style(
    provider: str, base_url: str, key: str, prompt: str, model: str,
    extra_headers: dict | None = None,
) -> Completion:
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
    }
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
    usage = data.get("usage", {})
    return Completion(
        text=text, provider=provider, model=model,
        tokens_in=usage.get("prompt_tokens", 0),
        tokens_out=usage.get("completion_tokens", 0),
    )


async def complete_groq(key: str, prompt: str, model: str | None = None) -> Completion:
    return await _openai_style(
        "groq", "https://api.groq.com/openai/v1", key, prompt,
        model or DEFAULT_MODELS["groq"],
    )


async def complete_openrouter(key: str, prompt: str, model: str | None = None) -> Completion:
    return await _openai_style(
        "openrouter", "https://openrouter.ai/api/v1", key, prompt,
        model or DEFAULT_MODELS["openrouter"],
        extra_headers={"HTTP-Referer": "https://akira.ai", "X-Title": "Akira AI"},
    )


COMPLETERS = {
    "gemini": complete_gemini,
    "groq": complete_groq,
    "openrouter": complete_openrouter,
}


# ---- Streaming --------------------------------------------------------------
async def stream_gemini(key: str, prompt: str, model: str | None = None):
    """Yield text deltas from Gemini's SSE streaming endpoint."""
    model = model or DEFAULT_MODELS["gemini"]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
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


async def _stream_openai_style(provider, base_url, key, prompt, model, extra_headers=None):
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    payload = {
        "model": model, "messages": [{"role": "user", "content": prompt}],
        "temperature": 0, "stream": True,
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


async def stream_groq(key: str, prompt: str, model: str | None = None):
    async for d in _stream_openai_style(
        "groq", "https://api.groq.com/openai/v1", key, prompt, model or DEFAULT_MODELS["groq"]
    ):
        yield d


async def stream_openrouter(key: str, prompt: str, model: str | None = None):
    async for d in _stream_openai_style(
        "openrouter", "https://openrouter.ai/api/v1", key, prompt,
        model or DEFAULT_MODELS["openrouter"],
        extra_headers={"HTTP-Referer": "https://akira.ai", "X-Title": "Akira AI"},
    ):
        yield d


STREAMERS = {
    "gemini": stream_gemini,
    "groq": stream_groq,
    "openrouter": stream_openrouter,
}
