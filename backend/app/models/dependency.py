"""Dependency-scan model: one row per declared dependency found in a scan's
manifests (package.json, requirements.txt, etc.), enriched with the latest
known version and any matching security advisories (OSV.dev).

Status is derived at parse time:
- "vulnerable": at least one advisory affects the installed version.
- "outdated": a newer version exists but no known advisory.
- "clean": installed version is current (or no newer version is known).
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

STATUS_VULNERABLE = "vulnerable"
STATUS_OUTDATED = "outdated"
STATUS_CLEAN = "clean"


class ScanDependency(Base):
    __tablename__ = "scan_dependencies"

    scan_id: Mapped[str] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), index=True
    )
    # Where it was declared, e.g. "package.json" or "requirements.txt".
    manifest: Mapped[str] = mapped_column(String(120))
    ecosystem: Mapped[str] = mapped_column(String(32))  # npm | PyPI | …
    name: Mapped[str] = mapped_column(String(200), index=True)
    # The version as declared/resolved (best-effort from the manifest).
    version: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    dev: Mapped[bool] = mapped_column(default=False)  # dev/test-only dependency

    latest_version: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default=STATUS_CLEAN, index=True)
    # Primary advisory id (e.g. "CVE-2021-23337" or an OSV/GHSA id) + summary.
    advisory_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    advisory_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    advisory_severity: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    # Full list of matching advisory ids (OSV may return several).
    advisories: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # Suggested upgrade target (fixed version, else latest).
    suggested: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    # A short human note for the UI ("Up to date", "Patches available", …).
    note: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "manifest": self.manifest,
            "ecosystem": self.ecosystem,
            "name": self.name,
            "version": self.version,
            "dev": self.dev,
            "latest_version": self.latest_version,
            "status": self.status,
            "advisory_id": self.advisory_id,
            "advisory_summary": self.advisory_summary,
            "advisory_severity": self.advisory_severity,
            "advisories": self.advisories or [],
            "suggested": self.suggested,
            "note": self.note,
        }
