"""Module 6 models: export records and public share tokens."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

EXPORT_PENDING = "pending"
EXPORT_READY = "ready"
EXPORT_FAILED = "failed"

FORMAT_PDF = "pdf"
FORMAT_JSON = "json"
FORMAT_CSV = "csv"


class Report(Base):
    """A generated export artifact (pdf/json/csv) for a scan."""

    __tablename__ = "reports"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    scan_id: Mapped[str] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), index=True
    )
    format: Mapped[str] = mapped_column(String(8))
    status: Mapped[str] = mapped_column(String(12), default=EXPORT_PENDING)
    file_path: Mapped[Optional[str]] = mapped_column(String(700), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class ShareToken(Base):
    """A revocable, unguessable public read-only link to a scan report."""

    __tablename__ = "share_tokens"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    scan_id: Mapped[str] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), index=True
    )
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    last_viewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
