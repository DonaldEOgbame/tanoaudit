"""Repository: the per-user backbone tying scans, plans, and the watchlist
together across time.

Introduced in Modules 10/12 because both optimization plans and the watchlist
need a stable "this repo over many scans" entity rather than matching on a bare
repo string. A Repository is resolved-or-created when a scan is created.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Re-scan frequency for the watchlist.
FREQ_MANUAL = "manual"
FREQ_DAILY = "daily"
FREQ_WEEKLY = "weekly"


class Repository(Base):
    __tablename__ = "repositories"
    __table_args__ = (
        UniqueConstraint("user_id", "identifier", name="uq_user_repo_identifier"),
    )

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Stable identity: repo slug ("user/ecommerce-api") or source URL.
    identifier: Mapped[str] = mapped_column(String(400), index=True)
    source_type: Mapped[str] = mapped_column(String(16), default="github")

    # --- Watchlist state ---
    watched: Mapped[bool] = mapped_column(Boolean, default=False)
    frequency: Mapped[str] = mapped_column(String(12), default=FREQ_MANUAL)
    next_run_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # --- Latest-scan pointer (denormalized for fast watchlist reads) ---
    last_scan_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    last_scanned_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
