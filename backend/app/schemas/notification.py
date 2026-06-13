"""Schemas for Module 15: notifications."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    title: str
    body: Optional[str] = None
    link: Optional[dict] = None
    read: bool
    created_at: datetime


class NotificationPrefs(BaseModel):
    scan_complete: bool = True
    critical_found: bool = True
    watchlist_changed: bool = True
    weekly_digest: bool = False
    in_app: bool = True
