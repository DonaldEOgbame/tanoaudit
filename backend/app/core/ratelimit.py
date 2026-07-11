"""Lightweight in-memory fixed-window rate limiter.

A single-process counter used as a FastAPI dependency on expensive/abusable
endpoints (auth, scan start, handoff generation, full fix, chat).
"""
from __future__ import annotations

import time

from fastapi import Depends, Request

from app.core.config import settings
from app.core.errors import APIError

# In-memory store: key -> (window_start_epoch, count)
_local: dict[str, tuple[int, int]] = {}


async def _hit(key: str, limit: int, window: int) -> bool:
    """Return True if the call is allowed; False if over the limit."""
    now = int(time.time())
    bucket = now // window
    full_key = f"tanoaudit:rl:{key}:{bucket}"
    # In-memory fixed window.
    start, count = _local.get(full_key, (now, 0))
    count += 1
    _local[full_key] = (start, count)
    # Opportunistic cleanup of old buckets.
    if len(_local) > 4096:
        for k in [k for k in _local if k != full_key]:
            _local.pop(k, None)
    return count <= limit


def rate_limit(limit: int, window: int = 60, scope: str = "rl"):
    """Dependency factory: max `limit` calls per `window` seconds per client.

    Keyed by authenticated user when present, else client IP.
    """
    async def _dep(request: Request) -> None:
        if not settings.rate_limit_enabled:
            return
        # Prefer the bearer subject; fall back to client IP.
        ident = None
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            try:
                from app.core.security import decode_token
                ident = decode_token(auth[7:].strip()).get("sub")
            except Exception:
                ident = None
        if ident is None:
            ident = request.client.host if request.client else "anon"
        key = f"{scope}:{ident}"
        if not await _hit(key, limit, window):
            raise APIError("rate_limited", "Too many requests. Please slow down.", 429)

    return Depends(_dep)
