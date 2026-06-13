"""Module 3 models: Scan, Segment, Finding.

Finding is the unified core table — both engines (security + optimization) share
one shape, discriminated by `engine`. Fields mirror the API contract and carry
nullable slots used by later modules (verification, plans, false-positive,
Claude Code handoff/fix tracking).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Scan status lifecycle.
SCAN_QUEUED = "queued"
# A worker has atomically claimed this queued scan (so a second worker won't
# also pick it up); `run_scan` transitions it to RUNNING immediately after.
SCAN_CLAIMED = "claimed"
SCAN_RUNNING = "running"
SCAN_COMPLETED = "completed"
SCAN_FAILED = "failed"
SCAN_CANCELLED = "cancelled"
SCAN_PAUSED = "paused"

# Finding engines + statuses.
ENGINE_SECURITY = "security"
ENGINE_OPTIMIZATION = "optimization"
ENGINE_STUB = "stub"

STATUS_OPEN = "open"
STATUS_FALSE_POSITIVE = "false_positive"
STATUS_FIXED = "fixed"
# Stub-only "false positive" equivalent: a deliberate TODO / planned work item.
STATUS_INTENTIONAL = "intentional"

# Stub engine categories.
STUB_CATEGORIES = ("Stub", "Placeholder", "Incomplete", "AI-Generated")

SEVERITY_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}


class Scan(Base):
    __tablename__ = "scans"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Stable repo backbone (Modules 10/12). Nullable for legacy/standalone scans.
    repository_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("repositories.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # --- Source ---
    source_type: Mapped[str] = mapped_column(String(16))  # github | url | zip
    repo: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(String(600), nullable=True)
    branch: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    commit: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # --- Config ---
    depth: Mapped[str] = mapped_column(String(16), default="deep")  # fast|deep|thorough
    model_mode: Mapped[str] = mapped_column(String(16), default="auto")  # auto|manual
    models: Mapped[list] = mapped_column(JSON, default=list)
    include_custom: Mapped[bool] = mapped_column(default=True)
    include_optimization: Mapped[bool] = mapped_column(default=True)
    # When set (e.g. a PR scan), restrict analysis to these file paths.
    path_filters: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # Where the scan's source files are cached on disk (set at ingestion) so
    # fix/implementation generation has full-file context for ZIP/URL scans, not
    # just GitHub. Cleared when the scan is deleted.
    file_cache_path: Mapped[Optional[str]] = mapped_column(String(600), nullable=True)

    # --- State ---
    status: Mapped[str] = mapped_column(String(16), default=SCAN_QUEUED, index=True)
    # The worker that claimed this scan (null until claimed). For debugging and
    # reclaiming scans orphaned by a crashed worker.
    worker_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    # Times this scan has been (re)dispatched. Orphan recovery re-enqueues a
    # stuck scan until this hits the cap, then marks it failed.
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    correlation_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # --- Results ---
    files: Mapped[int] = mapped_column(Integer, default=0)
    segment_total: Mapped[int] = mapped_column(Integer, default=0)
    segments_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    # Segments whose model output never parsed (even after the repair retry), so
    # their findings were lost. A recall-miss counter surfaced for transparency.
    segments_unparsed: Mapped[int] = mapped_column(Integer, default=0)
    security_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    optimization_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # 0-100, computed during aggregation. 100 = no stubs found.
    completeness_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    worst_severity: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    executive_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    segments: Mapped[list["Segment"]] = relationship(
        back_populates="scan", cascade="all, delete-orphan"
    )
    findings: Mapped[list["Finding"]] = relationship(
        back_populates="scan", cascade="all, delete-orphan"
    )


class Segment(Base):
    __tablename__ = "segments"

    scan_id: Mapped[str] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), index=True
    )
    file_path: Mapped[str] = mapped_column(String(600))
    language: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    line_start: Mapped[int] = mapped_column(Integer)
    line_end: Mapped[int] = mapped_column(Integer)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    # Whether the segment was successfully analyzed (timeouts -> False).
    analyzed: Mapped[bool] = mapped_column(default=False)

    scan: Mapped["Scan"] = relationship(back_populates="segments")


class Finding(Base):
    __tablename__ = "findings"

    scan_id: Mapped[str] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), index=True
    )
    # Public, human-facing id (VLN-XXXX / OPT-XXXX), unique within a scan.
    public_id: Mapped[str] = mapped_column(String(16), index=True)
    engine: Mapped[str] = mapped_column(String(16), index=True)  # security|optimization|stub

    category: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    # Canonical (normalized) subcategory used for grouping/dedup across scans.
    subcategory: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    # The model's original free-text label, preserved as a display alias.
    subcategory_raw: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    severity: Mapped[str] = mapped_column(String(16), index=True)
    confidence: Mapped[str] = mapped_column(String(16), default="Medium")

    file: Mapped[str] = mapped_column(String(600))
    line_start: Mapped[int] = mapped_column(Integer, default=0)
    line_end: Mapped[int] = mapped_column(Integer, default=0)

    code_snippet: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fix_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fix_snippet: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Security-only
    cwe_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    owasp_ref: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    # Optimization-only
    impact: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Stub-only
    stub_category: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    completion_suggestion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_if_shipped: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Attribution / verification
    model_attribution: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    verified_by: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)

    # Cross-module nullable slots
    plan_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    goal_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=STATUS_OPEN, index=True)
    false_positive_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    handoff_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    fixed_via: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    fixed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    github_issue_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    scan: Mapped["Scan"] = relationship(back_populates="findings")
