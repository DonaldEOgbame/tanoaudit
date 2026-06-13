"""Module 16 model: per-LLM-call usage log."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UsageLog(Base):
    __tablename__ = "usage_logs"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(32), index=True)
    model: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    scan_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    # Free-form purpose tag: "scan" | "chat" | "fix" | "research" | "validation" | "verify"
    purpose: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
