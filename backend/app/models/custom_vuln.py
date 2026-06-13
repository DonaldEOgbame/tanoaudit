"""Module 9 model: user-defined custom vulnerabilities with research data.

Active custom vulns are appended to scan prompts as extra detection targets.
The `active` flag is the global default; per-scan activation can override via
the scan's config (handled in the orchestrator wiring).
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CustomVulnerability(Base):
    __tablename__ = "custom_vulnerabilities"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(16), default="medium")
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Structured research output (set after the research pipeline runs).
    what_it_is: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detection_patterns: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    what_to_look_for: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    how_to_fix: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_urls: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    researched: Mapped[bool] = mapped_column(Boolean, default=False)

    def as_prompt_target(self) -> str:
        """Render this custom vuln as a detection target line for scan prompts."""
        parts = [self.name]
        if self.description:
            parts.append(f"— {self.description}")
        if self.detection_patterns:
            parts.append(f"(detect: {self.detection_patterns[:200]})")
        return " ".join(parts)
