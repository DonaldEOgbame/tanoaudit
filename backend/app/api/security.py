"""Security settings: change password, TOTP 2FA, backup codes, sessions, login history."""
from __future__ import annotations

import secrets

import pyotp
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import bad_request, conflict, envelope, not_found
from app.core.security import hash_password, verify_password
from app.models.user import LoginHistory, Session, User
from app.schemas.auth import (
    BackupCodesResponse,
    ChangePasswordRequest,
    EmailOtpVerify,
    LoginHistoryOut,
    SessionOut,
    TotpEnrollResponse,
    TotpVerifyRequest,
    TwoFactorStatus,
)
from app.services.email_otp import issue_code, verify_code
from app.models.email_otp import PURPOSE_ENROLL

router = APIRouter(prefix="/security", tags=["security"])

_N_BACKUP_CODES = 10


# ---- Password ---------------------------------------------------------------
@router.post("/change-password", status_code=204)
async def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, user.password_hash):
        raise bad_request("Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    db.add(user)
    return  # 204


# ---- TOTP 2FA ---------------------------------------------------------------
@router.post("/2fa/enroll")
async def totp_enroll(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if user.totp_enabled:
        raise conflict("2FA is already enabled")
    secret = pyotp.random_base32()
    user.totp_secret = secret  # staged; confirmed on /2fa/verify
    db.add(user)
    uri = pyotp.TOTP(secret).provisioning_uri(
        name=user.email, issuer_name=settings.totp_issuer
    )
    return envelope(TotpEnrollResponse(secret=secret, otpauth_uri=uri).model_dump())


@router.post("/2fa/verify")
async def totp_verify(
    body: TotpVerifyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.totp_secret:
        raise bad_request("Start enrollment first")
    if not pyotp.TOTP(user.totp_secret).verify(body.code, valid_window=1):
        raise bad_request("Invalid code")

    user.totp_enabled = True
    # TOTP becomes the active method (preferred over email when both are on).
    user.two_factor_method = "totp"
    raw_codes = [secrets.token_hex(4) for _ in range(_N_BACKUP_CODES)]
    user.backup_codes = [hash_password(c) for c in raw_codes]
    db.add(user)
    return envelope(BackupCodesResponse(codes=raw_codes).model_dump())


@router.post("/2fa/disable", status_code=204)
async def totp_disable(
    body: TotpVerifyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.totp_enabled:
        raise bad_request("2FA is not enabled")
    if not pyotp.TOTP(user.totp_secret).verify(body.code, valid_window=1):
        raise bad_request("Invalid code")
    user.totp_enabled = False
    user.totp_secret = None
    user.backup_codes = None
    # Fall back to email OTP if it's still enabled, else no 2FA.
    user.two_factor_method = "email" if user.email_otp_enabled else None
    db.add(user)
    return  # 204


# ---- Email OTP 2FA ----------------------------------------------------------
@router.get("/2fa/status")
async def two_factor_status(user: User = Depends(get_current_user)):
    return envelope(TwoFactorStatus(
        totp_enabled=user.totp_enabled,
        email_otp_enabled=user.email_otp_enabled,
        method=user.two_factor_method,
    ).model_dump())


@router.post("/2fa/email/enroll")
async def email_otp_enroll(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Send an enrollment code to the user's email to confirm email 2FA."""
    sent, error = await issue_code(db, user, PURPOSE_ENROLL)
    if not sent:
        raise bad_request(error or "Could not send code")
    return envelope({"sent": True, "email": user.email})


@router.post("/2fa/email/verify")
async def email_otp_verify(
    body: EmailOtpVerify,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm the enrollment code and enable email 2FA."""
    if not await verify_code(db, user.id, body.code, PURPOSE_ENROLL):
        raise bad_request("Invalid or expired code")
    user.email_otp_enabled = True
    # Prefer TOTP as the active method if it's also on; else email.
    if not user.totp_enabled:
        user.two_factor_method = "email"
    db.add(user)
    return envelope(TwoFactorStatus(
        totp_enabled=user.totp_enabled, email_otp_enabled=True,
        method=user.two_factor_method,
    ).model_dump())


@router.post("/2fa/email/disable", status_code=204)
async def email_otp_disable(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if not user.email_otp_enabled:
        raise bad_request("Email 2FA is not enabled")
    user.email_otp_enabled = False
    user.two_factor_method = "totp" if user.totp_enabled else None
    db.add(user)
    return  # 204


@router.put("/2fa/method")
async def set_two_factor_method(
    method: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Choose the active factor when more than one is enabled."""
    if method not in ("totp", "email"):
        raise bad_request("method must be 'totp' or 'email'")
    if method == "totp" and not user.totp_enabled:
        raise bad_request("Authenticator 2FA is not enabled")
    if method == "email" and not user.email_otp_enabled:
        raise bad_request("Email 2FA is not enabled")
    user.two_factor_method = method
    db.add(user)
    return envelope(TwoFactorStatus(
        totp_enabled=user.totp_enabled, email_otp_enabled=user.email_otp_enabled,
        method=method,
    ).model_dump())


@router.post("/2fa/backup-codes")
async def regenerate_backup_codes(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if not user.totp_enabled:
        raise bad_request("2FA is not enabled")
    raw_codes = [secrets.token_hex(4) for _ in range(_N_BACKUP_CODES)]
    user.backup_codes = [hash_password(c) for c in raw_codes]
    db.add(user)
    return envelope(BackupCodesResponse(codes=raw_codes).model_dump())


# ---- Sessions / login history ----------------------------------------------
@router.get("/sessions")
async def list_sessions(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(
            select(Session)
            .where(Session.user_id == user.id, Session.revoked == False)  # noqa: E712
            .order_by(Session.last_active_at.desc())
        )
    ).scalars().all()
    return envelope([SessionOut.model_validate(s).model_dump() for s in rows])


@router.delete("/sessions/{session_id}", status_code=204)
async def revoke_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if session is None or session.user_id != user.id:
        raise not_found("Session not found")
    session.revoked = True
    db.add(session)
    return  # 204


@router.get("/login-history")
async def login_history(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(
            select(LoginHistory)
            .where(LoginHistory.user_id == user.id)
            .order_by(LoginHistory.created_at.desc())
            .limit(20)
        )
    ).scalars().all()
    return envelope([LoginHistoryOut.model_validate(r).model_dump() for r in rows])
