"""Minimal "test key" pings for each provider.

Each function makes the cheapest authenticated call that proves the key is valid,
and returns (ok: bool, detail: str). Network/credential errors map to ok=False
rather than raising — the caller persists the resulting status.
"""
from __future__ import annotations

import httpx

_TIMEOUT = httpx.Timeout(10.0)


async def test_gemini(key: str) -> tuple[bool, str]:
    # Listing models is a free, auth-gated endpoint.
    url = "https://generativelanguage.googleapis.com/v1beta/models"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(url, params={"key": key})
        if r.status_code == 200:
            return True, "ok"
        if r.status_code in (400, 401, 403):
            return False, "invalid key"
        return False, f"unexpected status {r.status_code}"
    except httpx.HTTPError as e:
        return False, f"network error: {type(e).__name__}"


async def test_groq(key: str) -> tuple[bool, str]:
    url = "https://api.groq.com/openai/v1/models"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(url, headers={"Authorization": f"Bearer {key}"})
        if r.status_code == 200:
            return True, "ok"
        if r.status_code in (401, 403):
            return False, "invalid key"
        return False, f"unexpected status {r.status_code}"
    except httpx.HTTPError as e:
        return False, f"network error: {type(e).__name__}"


async def test_openrouter(key: str) -> tuple[bool, str]:
    # OpenRouter exposes the key's own metadata at /auth/key.
    url = "https://openrouter.ai/api/v1/auth/key"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(url, headers={"Authorization": f"Bearer {key}"})
        if r.status_code == 200:
            return True, "ok"
        if r.status_code in (401, 403):
            return False, "invalid key"
        return False, f"unexpected status {r.status_code}"
    except httpx.HTTPError as e:
        return False, f"network error: {type(e).__name__}"


async def test_github(key: str) -> tuple[bool, str]:
    url = "https://api.github.com/user"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(
                url,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Accept": "application/vnd.github+json",
                },
            )
        if r.status_code == 200:
            login = r.json().get("login", "user")
            return True, f"authenticated as {login}"
        if r.status_code == 401:
            return False, "invalid token"
        return False, f"unexpected status {r.status_code}"
    except httpx.HTTPError as e:
        return False, f"network error: {type(e).__name__}"


_TESTERS = {
    "gemini": test_gemini,
    "groq": test_groq,
    "openrouter": test_openrouter,
    "github": test_github,
}


async def test_provider_key(provider: str, key: str) -> tuple[bool, str]:
    tester = _TESTERS.get(provider)
    if tester is None:
        return False, "unknown provider"
    return await tester(key)
