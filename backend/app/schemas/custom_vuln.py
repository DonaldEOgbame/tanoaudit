"""Schemas for Module 9: custom vulnerabilities + research."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class CustomVulnCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    severity: Literal["critical", "high", "medium", "low", "info"] = "medium"
    active: bool = True


class CustomVulnUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    severity: Optional[Literal["critical", "high", "medium", "low", "info"]] = None
    active: Optional[bool] = None


class CustomVulnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    severity: str
    active: bool
    what_it_is: Optional[str] = None
    detection_patterns: Optional[str] = None
    what_to_look_for: Optional[str] = None
    how_to_fix: Optional[str] = None
    source_urls: Optional[list] = None
    researched: bool
    created_at: datetime


class ResearchRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    # If set, persist the result onto this existing custom vuln.
    custom_vuln_id: Optional[str] = None
