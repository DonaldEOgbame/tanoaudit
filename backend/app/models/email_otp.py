"""Email OTP codes: short-lived, hashed one-time codes for email 2FA."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Purpose discriminator: "enroll" (confirming email 2FA) | "login" (challenge).
PURPOSE_ENROLL = "enroll"
PURPOSE_LOGIN = "login"


class EmailOtp(Base):
    __tablename__ = "email_otps"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    purpose: Mapped[str] = mapped_column(String(10), default=PURPOSE_LOGIN)
    # bcrypt hash of the 6-digit code; raw is emailed, never stored.
    code_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
