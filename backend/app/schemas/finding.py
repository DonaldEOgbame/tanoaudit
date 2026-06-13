"""Schemas for Module 7: false-positive marking, fix generation, suppressions."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FalsePositiveRequest(BaseModel):
    reason: Optional[str] = None


class IntentionalRequest(BaseModel):
    reason: Optional[str] = None


class IntentionalStubOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    repo: str
    file_path: str
    stub_category: Optional[str] = None
    content_hash: str
    reason: Optional[str] = None
    origin_finding_id: Optional[str] = None
    created_at: datetime


class SuppressionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    repo: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    file_pattern: Optional[str] = None
    reason: Optional[str] = None
    origin_finding_id: Optional[str] = None
    created_at: datetime
