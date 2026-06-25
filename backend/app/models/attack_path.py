"""Attack-path model: a detected *combination* of findings that forms a real
exploitation chain (e.g. SSRF -> cloud metadata -> credential theft).

Produced by the post-scan correlation pass (`app.services.attack_chains`), which
runs after all findings exist. Unlike a Finding (one local weakness), an
AttackPath references several findings by their public id and explains how they
compose into a single attack. Detection is "hybrid": chains may match a curated
catalog (`taxonomy_data.ATTACK_CHAINS`) or be proposed by the model; `catalog_key`
is set for the former and null for novel chains.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Source of a detected path, for transparency in the UI.
SOURCE_CATALOG = "catalog"  # matched a curated known-hack chain
SOURCE_NOVEL = "novel"      # model-proposed combination not in the catalog


class AttackPath(Base):
    __tablename__ = "attack_paths"

    scan_id: Mapped[str] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), index=True
    )
    # Public, human-facing id (CHN-XXXX), unique within a scan.
    public_id: Mapped[str] = mapped_column(String(16), index=True)

    name: Mapped[str] = mapped_column(String(200))
    # critical|high|medium|low — worst-case impact of the full chain.
    severity: Mapped[str] = mapped_column(String(16), index=True, default="high")
    source: Mapped[str] = mapped_column(String(16), default=SOURCE_NOVEL)
    # confirmed (full step-match / model-asserted) | potential (partial path).
    tier: Mapped[str] = mapped_column(String(16), default="confirmed")
    # Curated catalog key when source == catalog (matches ATTACK_CHAINS), else null.
    catalog_key: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # The constituent findings' public ids, in exploitation order.
    finding_public_ids: Mapped[list] = mapped_column(JSON, default=list)
    # Ordered narrative steps (parallel to finding_public_ids where possible).
    steps: Mapped[list] = mapped_column(JSON, default=list)

    # What an attacker ultimately achieves by chaining the steps.
    impact: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # A real-world grounding reference (breach / canonical technique).
    real_world: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # How to break the chain (only one link needs removing).
    remediation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cwe_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    # Slug of the matching Learning Hub class, when one exists.
    learn_slug: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "public_id": self.public_id,
            "name": self.name,
            "severity": self.severity,
            "source": self.source,
            "tier": self.tier,
            "catalog_key": self.catalog_key,
            "finding_public_ids": self.finding_public_ids or [],
            "steps": self.steps or [],
            "impact": self.impact,
            "real_world": self.real_world,
            "remediation": self.remediation,
            "cwe_id": self.cwe_id,
            "learn_slug": self.learn_slug,
        }
