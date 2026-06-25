"""Google OAuth client for 'Sign in with Google'.

Mirrors the GitHub login flow: build an authorize URL, exchange the code for a
token, and read the user's profile (email, name, picture). Only the identity
scopes are requested — we never touch the user's Google data beyond who they are.
"""
from __future__ import annotations

from urllib.parse import urlencode

import httpx

from app.core.config import settings

_TIMEOUT = 15.0
_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def is_configured() -> bool:
    return bool(settings.google_client_id and settings.google_client_secret)


def login_authorize_url(state: str) -> str:
    """Authorize URL for 'Sign in with Google'."""
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_login_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> str | None:
    """Exchange an OAuth code for an access token, or None on failure."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        r = await c.post(
            _TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.google_login_redirect_uri,
            },
        )
    if r.status_code != 200:
        return None
    return r.json().get("access_token")


async def get_userinfo(token: str) -> dict:
    """Return the OpenID userinfo payload: {email, email_verified, name, picture}."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        r = await c.get(_USERINFO_URL, headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return r.json()
