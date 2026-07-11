"""Email OTP issuance + verification (short-lived, hashed, rate-limited)."""
from __future__ import annotations

import secrets
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import as_aware, utcnow
from app.core.security import hash_password, verify_password
from app.models.email_otp import EmailOtp
from app.models.user import User
from app.services.email import send_email

CODE_TTL_MINUTES = 10
MAX_SENDS_PER_HOUR = 5


def _new_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


async def _recent_send_count(db: AsyncSession, user_id: str) -> int:
    since = utcnow() - timedelta(hours=1)
    rows = (
        await db.execute(select(EmailOtp).where(EmailOtp.user_id == user_id))
    ).scalars().all()
    return sum(1 for r in rows if as_aware(r.created_at) >= since)


async def issue_code(
    db: AsyncSession, user: User, purpose: str
) -> tuple[bool, str | None]:
    """Generate + email a code. Returns (sent, error). Enforces a send cap."""
    if await _recent_send_count(db, user.id) >= MAX_SENDS_PER_HOUR:
        return False, "Too many codes requested. Try again later."

    code = _new_code()
    db.add(EmailOtp(
        user_id=user.id, purpose=purpose,
        code_hash=hash_password(code),
        expires_at=utcnow() + timedelta(minutes=CODE_TTL_MINUTES),
    ))
    await db.flush()
    await send_email(
        user.email,
        "Your TanoAudit verification code",
        f"Your verification code is {code}. It expires in {CODE_TTL_MINUTES} minutes.\n\n"
        "If you didn't request this, you can ignore this email.",
    )
    return True, None


async def verify_code(db: AsyncSession, user_id: str, code: str, purpose: str) -> bool:
    """Verify + consume a code. Single-use; respects expiry."""
    now = utcnow()
    candidates = (
        await db.execute(
            select(EmailOtp).where(
                EmailOtp.user_id == user_id,
                EmailOtp.purpose == purpose,
                EmailOtp.consumed == False,  # noqa: E712
            ).order_by(EmailOtp.created_at.desc())
        )
    ).scalars().all()
    for otp in candidates:
        if as_aware(otp.expires_at) <= now:
            continue
        if verify_password(code, otp.code_hash):
            otp.consumed = True
            return True
    return False
