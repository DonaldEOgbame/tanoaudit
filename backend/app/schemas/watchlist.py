"""Schemas for Module 12: watchlist (repositories)."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class RepositoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    identifier: str
    source_type: str
    watched: bool
    frequency: str
    next_run_at: Optional[datetime] = None
    last_scan_id: Optional[str] = None
    last_scanned_at: Optional[datetime] = None


class WatchlistItem(BaseModel):
    """A watchlist card: repo + latest score + change delta (frontend shape)."""
    id: str
    repo: str
    score: Optional[int] = None
    change: str
    change_dir: Literal["up", "down", "flat"]
    new_criticals: int
    freq: str
    last: Optional[datetime] = None


class WatchRequest(BaseModel):
    frequency: Literal["manual", "daily", "weekly"] = "manual"


class FrequencyUpdate(BaseModel):
    frequency: Literal["manual", "daily", "weekly"]
