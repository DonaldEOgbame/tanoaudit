"""Module 8 model: scoped report chat logs (one row per user turn + reply).

Stored for rate limiting (30 messages/hour/scan), the 50-message cap, and
optional history. Jailbreak attempts are flagged for silent monitoring.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ChatLog(Base):
    __tablename__ = "chat_logs"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    scan_id: Mapped[str] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), index=True
    )
    user_message: Mapped[str] = mapped_column(Text)
    assistant_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # True when the user message matched a jailbreak/off-topic pattern.
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    refused: Mapped[bool] = mapped_column(Boolean, default=False)
