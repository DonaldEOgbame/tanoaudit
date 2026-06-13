"""Shared FastAPI dependencies: current-user resolution from the access token."""
from __future__ import annotations

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import unauthorized
from app.core.security import ACCESS, decode_token
from app.models.user import User

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if creds is None or not creds.credentials:
        raise unauthorized()
    payload = decode_token(creds.credentials, expected_type=ACCESS)
    user = await db.get(User, payload.get("sub"))
    if user is None:
        raise unauthorized("User no longer exists")
    return user


def client_info(request: Request) -> dict:
    """Best-effort device/ip extraction for session + login-history records."""
    ip = request.client.host if request.client else None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    return {
        "ip": ip,
        "device": request.headers.get("user-agent", "")[:300] or None,
        # location enrichment (GeoIP) is a later-module concern.
        "location": None,
    }
