"""Schemas for Module 13: handoff tokens."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class HandoffGenerateRequest(BaseModel):
    scope: Literal[
        "all", "critical_high", "security", "optimizations", "stubs", "custom"
    ] = "all"
    finding_ids: list[str] = []


class HandoffGenerateResponse(BaseModel):
    url: str
    expires_at: datetime
    finding_count: int


class HandoffLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    audit_id: str
    scope: str
    status: str = "active"  # computed by the router: active|used|expired|revoked
    expires_at: datetime
    used_at: Optional[datetime] = None
    created_at: datetime
