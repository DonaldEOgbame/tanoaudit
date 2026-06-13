"""Module 1 models: user, sessions/devices, login history.

Single-user product: no roles, teams, or org membership. The User row owns
profile fields, general settings (JSON), and security/2FA state.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, utcnow


class User(Base):
    __tablename__ = "users"

    # --- Auth ---
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    password_hash: Mapped[str] = mapped_column(String(255))

    # --- Profile (all optional except email) ---
    full_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    phone_country_code: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    organization: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    work_type: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)

    # --- 2FA ---
    totp_secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    # JSON array of bcrypt-hashed backup codes
    backup_codes: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # Email OTP as an alternative second factor.
    email_otp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    # Active 2FA method used at login: "totp" | "email". Null when 2FA is off.
    two_factor_method: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # --- Settings ---
    # session timeout in minutes; null/0 means "never"
    session_timeout_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # general settings blob: theme, language, default_scan_mode, timezone, date_format, etc.
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    # privacy + notification preference flags
    privacy: Mapped[dict] = mapped_column(JSON, default=dict)
    notifications: Mapped[dict] = mapped_column(JSON, default=dict)

    sessions: Mapped[list["Session"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    login_history: Mapped[list["LoginHistory"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    trusted_devices: Mapped[list["TrustedDevice"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Session(Base):
    """A refresh-token-backed session for one device. Access tokens are stateless."""

    __tablename__ = "sessions"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    device: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="sessions")


class LoginHistory(Base):
    __tablename__ = "login_history"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    device: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="login_history")


class TrustedDevice(Base):
    __tablename__ = "trusted_devices"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    device: Mapped[str] = mapped_column(String(300))
    ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="trusted_devices")
