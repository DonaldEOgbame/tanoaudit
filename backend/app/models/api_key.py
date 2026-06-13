"""Module 2 model: encrypted provider API keys.

One row per (user, provider). The raw key is Fernet-encrypted at rest and never
returned in full — reads expose only a masked form (last 4 chars). Validity is
cached from the last "test key" ping.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Recognised providers. GitHub uses the same store for its OAuth/personal token.
PROVIDERS = ("gemini", "groq", "openrouter", "github")

# Validity statuses surfaced to the UI.
STATUS_UNVERIFIED = "unverified"
STATUS_VALID = "valid"
STATUS_INVALID = "invalid"


class ApiKey(Base):
    __tablename__ = "api_keys"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_user_provider"),)

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(32))
    # Fernet ciphertext; the plaintext key is never stored.
    encrypted_key: Mapped[str] = mapped_column(String(1000))
    # Last 4 chars, kept in clear for cheap masked display without decrypting.
    last_four: Mapped[str] = mapped_column(String(4))
    status: Mapped[str] = mapped_column(String(16), default=STATUS_UNVERIFIED)
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
