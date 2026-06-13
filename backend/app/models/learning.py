"""Module 14 model: Learning Hub vulnerability class educational content.

Content is FAQ-style: a list of question/answer entries (each with an optional
deeper "advanced" note) plus a list of curated external resource links.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LearningHubClass(Base):
    __tablename__ = "learning_hub_classes"

    # Stable slug derived from category + name (used for finding -> class links).
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    category: Mapped[str] = mapped_column(String(120), index=True)
    severity: Mapped[str] = mapped_column(String(16), default="medium")
    cwe: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    owasp: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # One-line summary shown in lists and at the top of the detail page.
    summary: Mapped[str] = mapped_column(Text)

    # FAQ-style content: [{"question", "answer", "advanced"?}]
    faq: Mapped[list] = mapped_column(JSON, default=list)
    # External resources: [{"title", "url", "source"}]
    resources: Mapped[list] = mapped_column(JSON, default=list)
