"""Schemas for Module 6: exports, share links, scan diff."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class ExportCreate(BaseModel):
    format: Literal["pdf", "json", "csv"]


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    scan_id: str
    format: str
    status: str
    error: Optional[str] = None
    created_at: datetime


class ShareLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    scan_id: str
    slug: str
    url: str = ""  # filled in by the router from the slug
    revoked: bool
    last_viewed_at: Optional[datetime] = None
    created_at: datetime


class DiffFindingBrief(BaseModel):
    public_id: str
    engine: str
    category: Optional[str] = None
    severity: str
    file: str
    line_start: int


class DiffOut(BaseModel):
    new: list[DiffFindingBrief]
    fixed: list[DiffFindingBrief]
    still_open: list[DiffFindingBrief]
