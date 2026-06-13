"""Schemas for Module 3: scan creation, scan/finding output."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ScanCreate(BaseModel):
    source_type: Literal["github", "url", "zip"]
    repo: Optional[str] = None          # for github
    source_url: Optional[str] = None    # for url
    branch: Optional[str] = None
    depth: Literal["fast", "deep", "thorough"] = "deep"
    model_mode: Literal["auto", "manual"] = "auto"
    models: list[str] = Field(default_factory=lambda: ["gemini", "openrouter"])
    include_custom: bool = True
    include_optimization: bool = True


class ScanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_type: str
    repo: Optional[str] = None
    source_url: Optional[str] = None
    repository_id: Optional[str] = None
    branch: Optional[str] = None
    commit: Optional[str] = None
    depth: str
    model_mode: str
    models: list = []
    include_custom: bool
    include_optimization: bool
    status: str
    files: int
    segment_total: int
    segments_analyzed: int
    segments_unparsed: int = 0
    security_score: Optional[int] = None
    optimization_score: Optional[int] = None
    completeness_score: Optional[int] = None
    worst_severity: Optional[str] = None
    executive_summary: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class FindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    public_id: str
    scan_id: str
    engine: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    severity: str
    confidence: str
    file: str
    line_start: int
    line_end: int
    code_snippet: Optional[str] = None
    explanation: Optional[str] = None
    fix_summary: Optional[str] = None
    fix_snippet: Optional[str] = None
    cwe_id: Optional[str] = None
    owasp_ref: Optional[str] = None
    impact: Optional[str] = None
    stub_category: Optional[str] = None
    completion_suggestion: Optional[str] = None
    risk_if_shipped: Optional[str] = None
    model_attribution: Optional[str] = None
    verified_by: Optional[str] = None
    plan_id: Optional[str] = None
    status: str
    false_positive_reason: Optional[str] = None
    handoff_status: Optional[str] = None
    fixed_via: Optional[str] = None
    fixed_at: Optional[datetime] = None
    github_issue_url: Optional[str] = None
