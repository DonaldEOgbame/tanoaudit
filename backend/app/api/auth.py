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


# ---- Sign in with GitHub -----------------------------------------------------
# Distinct from the account-linking OAuth in app/api/github.py: this flow
# authenticates a user *from* their GitHub identity (find-or-create by verified
# email), then issues the same session + token pair as a password login.
import secrets as _secrets


@router.get("/github/start")
async def github_login_start():
    """Return the GitHub authorize URL for 'Sign in with GitHub'."""
    from app.services import github_client as gh

    if not (settings.github_client_id and settings.github_client_secret):
        from app.core.errors import APIError

        raise APIError(
            "github_not_configured",
            "GitHub sign-in is not configured on this server.",
            503,
        )
    # Sign a short-lived, identity-free state token for CSRF protection.
    state = create_access_token(
        "github_login", purpose="github_login", nonce=_secrets.token_urlsafe(8)
    )
    return envelope({"authorize_url": gh.login_authorize_url(state), "state": state})


async def _find_or_create_github_user(
    db: AsyncSession, email: str, profile: dict
) -> User:
    """Resolve a User by verified GitHub email, creating one if none exists.

    GitHub-created accounts get an unusable random password hash; they sign in
    via GitHub. They can set a password later through the normal reset flow.
    """
    email = email.lower()
    user = (
        await db.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is not None:
        # Backfill profile bits we didn't have before (best-effort).
        if not user.avatar_url and profile.get("avatar_url"):
            user.avatar_url = profile["avatar_url"]
        if not user.full_name and profile.get("name"):
            user.full_name = profile["name"]
        return user

    user = User(
        email=email,
        email_verified=True,  # GitHub vouches for the verified email.
        password_hash=hash_password(_secrets.token_urlsafe(32)),
        full_name=profile.get("name"),
        avatar_url=profile.get("avatar_url"),
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
    return user


@router.get("/github/callback")
async def github_login_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
    code: str | None = None,
    state: str | None = None,
):
    """Browser callback for 'Sign in with GitHub'. Exchanges the code, resolves
    the user, issues a session, and redirects into the SPA with tokens in the
    URL fragment (kept out of server logs / Referer headers)."""
    from urllib.parse import urlencode

    from fastapi.responses import RedirectResponse

    from app.services import github_client as gh

    base = settings.frontend_url.rstrip("/")

    def _fail(message: str) -> RedirectResponse:
        qs = urlencode({"auth": "error", "message": message[:300]})
        return RedirectResponse(url=f"{base}/?{qs}", status_code=303)

    if not code or not state:
        return _fail("GitHub sign-in was cancelled.")
    try:
        payload = decode_token(state)
        if payload.get("purpose") != "github_login":
            raise ValueError("bad purpose")
    except Exception:
        return _fail("Invalid sign-in state. Please try again.")

    try:
        result = await gh.exchange_code(
            code, redirect_uri=settings.github_login_redirect_uri
        )
        token = result.get("token")
        if not token:
            return _fail("GitHub did not return an access token.")
        profile = await gh.get_user(token)
        email = profile.get("email") or await gh.get_primary_email(token)
    except Exception:  # noqa: BLE001 — any GitHub-side failure bounces back cleanly
        return _fail("Could not complete GitHub sign-in.")

    if not email:
        return _fail("Your GitHub account has no verified email to sign in with.")

    user = await _find_or_create_github_user(db, email, profile)

    info = client_info(request)
    session = Session(user_id=user.id, last_active_at=utcnow(), **info)
    db.add(session)
    db.add(LoginHistory(user_id=user.id, success=True, **info))
    await db.flush()
    await _trim_login_history(db, user.id)

    tokens = _token_pair(user.id, session.id)
    frag = urlencode(
        {"access_token": tokens.access_token, "refresh_token": tokens.refresh_token}
    )
    return RedirectResponse(url=f"{base}/#{frag}", status_code=303)


@router.get("/google/start")
async def google_login_start():
    """Return the Google authorize URL for 'Sign in with Google'."""
    from app.services import google_client as gc

    if not gc.is_configured():
        from app.core.errors import APIError

        raise APIError(
            "google_not_configured",
            "Google sign-in is not configured on this server.",
            503,
        )
    state = create_access_token(
        "google_login", purpose="google_login", nonce=_secrets.token_urlsafe(8)
    )
    return envelope({"authorize_url": gc.login_authorize_url(state), "state": state})


async def _find_or_create_oauth_user(db: AsyncSession, email: str, profile: dict) -> User:
    """Resolve a User by verified email, creating one if none exists. Shared by
    OAuth providers (profile keys: name, avatar_url)."""
    email = email.lower()
    user = (
        await db.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is not None:
        if not user.avatar_url and profile.get("avatar_url"):
            user.avatar_url = profile["avatar_url"]
        if not user.full_name and profile.get("name"):
            user.full_name = profile["name"]
        return user
    user = User(
        email=email,
        email_verified=True,
        password_hash=hash_password(_secrets.token_urlsafe(32)),
        full_name=profile.get("name"),
        avatar_url=profile.get("avatar_url"),
        settings={"theme": "system", "default_scan_mode": "Deep"},
        privacy={"improve_ai": True, "store_scan_history": True},
        notifications={
            "scan_complete": True, "critical_found": True,
            "watchlist_changed": True, "weekly_digest": False,
        },
    )
    db.add(user)
    await db.flush()
    return user


@router.get("/google/callback")
async def google_login_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
    code: str | None = None,
    state: str | None = None,
):
    """Browser callback for 'Sign in with Google'. Exchanges the code, resolves
    the user, issues a session, and redirects into the SPA with tokens in the
    URL fragment (consumed by the frontend's consumeAuthRedirect)."""
    from urllib.parse import urlencode

    from fastapi.responses import RedirectResponse

    from app.services import google_client as gc

    base = settings.frontend_url.rstrip("/")

    def _fail(message: str) -> RedirectResponse:
        qs = urlencode({"auth": "error", "message": message[:300]})
        return RedirectResponse(url=f"{base}/?{qs}", status_code=303)

    if not code or not state:
        return _fail("Google sign-in was cancelled.")
    try:
        payload = decode_token(state)
        if payload.get("purpose") != "google_login":
            raise ValueError("bad purpose")
    except Exception:
        return _fail("Invalid sign-in state. Please try again.")

    try:
        token = await gc.exchange_code(code)
        if not token:
            return _fail("Google did not return an access token.")
        info = await gc.get_userinfo(token)
    except Exception:  # noqa: BLE001
        return _fail("Could not complete Google sign-in.")

    email = info.get("email")
    if not email or not info.get("email_verified", False):
        return _fail("Your Google account has no verified email to sign in with.")

    profile = {"name": info.get("name"), "avatar_url": info.get("picture")}
    user = await _find_or_create_oauth_user(db, email, profile)

    ci = client_info(request)
    session = Session(user_id=user.id, last_active_at=utcnow(), **ci)
    db.add(session)
    db.add(LoginHistory(user_id=user.id, success=True, **ci))
    await db.flush()
    await _trim_login_history(db, user.id)

    tokens = _token_pair(user.id, session.id)
    frag = urlencode(
        {"access_token": tokens.access_token, "refresh_token": tokens.refresh_token}
    )
    return RedirectResponse(url=f"{base}/#{frag}", status_code=303)


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
