"""Request/response schemas for auth, profile, and security settings."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---- Auth -------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = Field(default=None, max_length=8)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access-token lifetime, seconds


class LoginResponse(BaseModel):
    # When 2FA is required and no/invalid code was supplied.
    totp_required: bool = False
    # Which factor to prompt: "totp" | "email" (None when no 2FA needed).
    method: Optional[str] = None
    tokens: Optional[TokenPair] = None


class TwoFactorStatus(BaseModel):
    totp_enabled: bool = False
    email_otp_enabled: bool = False
    method: Optional[str] = None  # active method


class EmailOtpVerify(BaseModel):
    code: str = Field(min_length=4, max_length=8)


# ---- Profile ----------------------------------------------------------------
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    email_verified: bool
    full_name: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    phone_country_code: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    organization: Optional[str] = None
    job_title: Optional[str] = None
    website: Optional[str] = None
    bio: Optional[str] = None
    work_type: Optional[str] = None
    totp_enabled: bool
    session_timeout_minutes: Optional[int] = None
    settings: dict = {}
    privacy: dict = {}
    notifications: dict = {}
    created_at: datetime


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=200)
    display_name: Optional[str] = Field(default=None, max_length=120)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    phone_country_code: Optional[str] = Field(default=None, max_length=8)
    phone: Optional[str] = Field(default=None, max_length=40)
    country: Optional[str] = Field(default=None, max_length=100)
    organization: Optional[str] = Field(default=None, max_length=200)
    job_title: Optional[str] = Field(default=None, max_length=200)
    website: Optional[str] = Field(default=None, max_length=500)
    bio: Optional[str] = Field(default=None, max_length=4000)
    work_type: Optional[str] = Field(default=None, max_length=80)
    settings: Optional[dict] = None
    privacy: Optional[dict] = None
    notifications: Optional[dict] = None
    session_timeout_minutes: Optional[int] = Field(default=None, ge=0)


# ---- Security ---------------------------------------------------------------
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class TotpEnrollResponse(BaseModel):
    secret: str
    otpauth_uri: str  # for QR rendering on the client


class TotpVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class BackupCodesResponse(BaseModel):
    codes: list[str]  # shown once, in plaintext


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    device: Optional[str] = None
    ip: Optional[str] = None
    location: Optional[str] = None
    last_active_at: datetime
    created_at: datetime
    current: bool = False


class LoginHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ip: Optional[str] = None
    device: Optional[str] = None
    location: Optional[str] = None
    success: bool
    created_at: datetime
