"""Password hashing, JWT issuance/verification, Fernet encryption for secrets."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt

from app.core.config import settings
from app.core.errors import unauthorized

# Token types
ACCESS = "access"
REFRESH = "refresh"


# ---- Passwords --------------------------------------------------------------
def _to_72_bytes(plain: str) -> bytes:
    # bcrypt hard-caps input at 72 bytes; truncate on the byte string so
    # multibyte passwords don't overflow.
    return plain.encode("utf-8")[:72]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_to_72_bytes(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_to_72_bytes(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---- JWT --------------------------------------------------------------------
def _create_token(subject: str, token_type: str, expires: timedelta, **claims: Any) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires,
        "jti": secrets.token_urlsafe(16),
        **claims,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str, **claims: Any) -> str:
    return _create_token(
        user_id, ACCESS,
        timedelta(minutes=settings.access_token_expire_minutes), **claims,
    )


def create_refresh_token(user_id: str, session_id: str) -> str:
    return _create_token(
        user_id, REFRESH,
        timedelta(days=settings.refresh_token_expire_days), sid=session_id,
    )


def decode_token(token: str, expected_type: str | None = None) -> dict:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except JWTError:
        raise unauthorized("Invalid or expired token")
    if expected_type and payload.get("type") != expected_type:
        raise unauthorized("Wrong token type")
    return payload


# ---- Fernet encryption for secrets at rest ----------------------------------
def _fernet() -> Fernet:
    return Fernet(settings.fernet_key.encode())


def encrypt_secret(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_secret(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        raise ValueError("Could not decrypt secret (wrong FERNET_KEY?)")


def mask_secret(plain: str, visible: int = 4) -> str:
    """Return a masked form showing only the last `visible` chars."""
    if not plain:
        return ""
    if len(plain) <= visible:
        return "•" * len(plain)
    return "•" * (len(plain) - visible) + plain[-visible:]
