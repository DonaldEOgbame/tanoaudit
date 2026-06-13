"""Auth endpoints: register, login, refresh, logout, logout-all."""
from __future__ import annotations

import pyotp
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import client_info, get_current_user
from app.core.config import settings
from app.core.database import get_db, utcnow
from app.core.errors import conflict, envelope, unauthorized
from app.core.ratelimit import rate_limit
from app.core.security import (
    REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import LoginHistory, Session, User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_LOGIN_HISTORY_KEEP = 20


def _token_pair(user_id: str, session_id: str) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id, session_id),
        expires_in=settings.access_token_expire_minutes * 60,
    )


def _verify_totp(user: User, code: str | None) -> bool:
    if not code:
        return False
    if user.totp_secret and pyotp.TOTP(user.totp_secret).verify(code, valid_window=1):
        return True
    # Fall back to single-use backup codes.
    for i, hashed in enumerate(list(user.backup_codes or [])):
        if verify_password(code, hashed):
            remaining = list(user.backup_codes)
            remaining.pop(i)
            user.backup_codes = remaining
            return True
    return False


async def _verify_second_factor(db, user: User, method: str, code: str | None) -> bool:
    """Verify the login second factor for the user's active method."""
    if not code:
        return False
    if method == "email":
        from app.services.email_otp import verify_code
        from app.models.email_otp import PURPOSE_LOGIN
        # Backup codes also work as a fallback for email-method users.
        if await verify_code(db, user.id, code, PURPOSE_LOGIN):
            return True
        return _verify_totp(user, code) if user.totp_enabled else False
    # Default: TOTP (+ backup codes).
    return _verify_totp(user, code)


async def _trim_login_history(db: AsyncSession, user_id: str) -> None:
    rows = (
        await db.execute(
            select(LoginHistory)
            .where(LoginHistory.user_id == user_id)
            .order_by(LoginHistory.created_at.desc())
        )
    ).scalars().all()
    for stale in rows[_LOGIN_HISTORY_KEEP:]:
        await db.delete(stale)


@router.post("/register", status_code=201, dependencies=[rate_limit(5, 3600, scope="register")])
async def register(
    body: RegisterRequest, db: AsyncSession = Depends(get_db)
):
    existing = (
        await db.execute(select(User).where(User.email == body.email.lower()))
    ).scalar_one_or_none()
    if existing:
        raise conflict("An account with this email already exists")

    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        settings={"theme": "system", "default_scan_mode": "Deep"},
        privacy={"improve_ai": True, "store_scan_history": True},
        notifications={
            "scan_complete": True,
            "critical_found": True,
            "watchlist_changed": True,
            "weekly_digest": False,
        },
    )
    db.add(user)
    await db.flush()
    return envelope(UserOut.model_validate(user).model_dump())


@router.post("/login", dependencies=[rate_limit(10, 60, scope="login")])
async def login(
    body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    info = client_info(request)
    user = (
        await db.execute(select(User).where(User.email == body.email.lower()))
    ).scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        if user is not None:
            db.add(LoginHistory(user_id=user.id, success=False, **info))
        raise unauthorized("Invalid email or password")

    # --- Second factor ---
    method = user.two_factor_method
    if method:  # 2FA is on
        ok = await _verify_second_factor(db, user, method, body.totp_code)
        if not ok:
            # Auto-send an email code when none was supplied for the email method.
            if method == "email" and not body.totp_code:
                from app.services.email_otp import issue_code
                from app.models.email_otp import PURPOSE_LOGIN
                await issue_code(db, user, PURPOSE_LOGIN)
            return envelope(
                LoginResponse(totp_required=True, method=method).model_dump()
            )

    session = Session(user_id=user.id, last_active_at=utcnow(), **info)
    db.add(session)
    db.add(LoginHistory(user_id=user.id, success=True, **info))
    await db.flush()
    await _trim_login_history(db, user.id)

    tokens = _token_pair(user.id, session.id)
    return envelope(
        LoginResponse(totp_required=False, method=None, tokens=tokens).model_dump()
    )


@router.post("/refresh")
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token, expected_type=REFRESH)
    session = await db.get(Session, payload.get("sid"))
    if session is None or session.revoked or session.user_id != payload.get("sub"):
        raise unauthorized("Session is no longer valid")

    # Enforce server-side session timeout preference.
    user = await db.get(User, session.user_id)
    timeout = (user.session_timeout_minutes or 0) if user else 0
    if timeout:
        idle = (utcnow() - session.last_active_at).total_seconds() / 60
        if idle > timeout:
            session.revoked = True
            raise unauthorized("Session timed out")

    session.last_active_at = utcnow()
    return envelope(_token_pair(session.user_id, session.id).model_dump())


@router.post("/logout", status_code=204)
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token, expected_type=REFRESH)
    session = await db.get(Session, payload.get("sid"))
    if session is not None:
        session.revoked = True
    return  # 204


@router.post("/logout-all", status_code=204)
async def logout_all(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(select(Session).where(Session.user_id == user.id))
    ).scalars().all()
    for s in rows:
        s.revoked = True
    return  # 204
