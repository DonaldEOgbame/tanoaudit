"""Module 15 model: in-app notification records.

Notification *preferences* live in the user's `notifications` JSON blob (Module
1); this table holds the individual in-app notification records.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Notification types (align with preference flags).
N_SCAN_COMPLETE = "scan_complete"
N_CRITICAL_FOUND = "critical_found"
N_WATCHLIST_CHANGED = "watchlist_changed"
N_WEEKLY_DIGEST = "weekly_digest"
N_HANDOFF_CONSUMED = "handoff_consumed"
N_FIXED_VIA_CLAUDE = "finding_fixed_via_claude_code"


class Notification(Base):
    __tablename__ = "notifications"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String(48), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Optional deep-link target, e.g. {"scan_id": "..."} or {"repo": "..."}.
    link: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
