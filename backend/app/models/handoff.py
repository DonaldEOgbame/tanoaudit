"""Module 13 models: handoff tokens + handoff activity events.

A handoff token is a single-use, 24h, bcrypt-hashed link that lets Claude Code
(via the MCP server) fetch a structured audit for a scan. The raw token is
returned once and never stored.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Scopes for what findings a handoff includes.
SCOPE_ALL = "all"
SCOPE_CRITICAL_HIGH = "critical_high"
SCOPE_SECURITY = "security"
SCOPE_OPTIMIZATIONS = "optimizations"
SCOPE_STUBS = "stubs"
SCOPE_CUSTOM = "custom"
SCOPES = (
    SCOPE_ALL, SCOPE_CRITICAL_HIGH, SCOPE_SECURITY,
    SCOPE_OPTIMIZATIONS, SCOPE_STUBS, SCOPE_CUSTOM,
)

# Handoff event kinds (for the History tab).
EVT_GENERATED = "handoff_generated"
EVT_CONSUMED = "handoff_consumed"
EVT_FIXED_VIA_CLAUDE = "finding_fixed_via_claude_code"


class HandoffToken(Base):
    __tablename__ = "handoff_tokens"

    # audit_id == scan id this handoff is for.
    audit_id: Mapped[str] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    scope: Mapped[str] = mapped_column(String(20), default=SCOPE_ALL)
    finding_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # bcrypt hash of the raw token; raw value is never stored.
    token_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class HandoffEvent(Base):
    __tablename__ = "handoff_events"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    audit_id: Mapped[str] = mapped_column(String(36), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    detail: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
