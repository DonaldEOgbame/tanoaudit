"""Schemas for Module 10: optimization plans + goals."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class GoalCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    status: Literal["Pending", "In progress", "Done"] = "Pending"


class PlanCreate(BaseModel):
    repository_id: str
    name: str = Field(min_length=1, max_length=200)
    priority: Literal["High", "Medium", "Low"] = "Medium"
    goals: list[GoalCreate] = Field(default_factory=list)


class PlanUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    priority: Optional[Literal["High", "Medium", "Low"]] = None


class GoalUpdate(BaseModel):
    text: Optional[str] = Field(default=None, max_length=2000)
    status: Optional[Literal["Pending", "In progress", "Done"]] = None


class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    plan_id: str
    text: str
    status: str
    position: int


class PlanOut(BaseModel):
    id: str
    repository_id: str
    name: str
    priority: str
    goals: list[GoalOut]
    health: int       # done / total %
    progress: int     # weighted %
    linked: int       # findings tagged to this plan
    created_at: datetime


class ValidateRequest(BaseModel):
    # Validate ad-hoc goals (e.g. before saving) or an existing plan's goals.
    goals: list[str] = Field(default_factory=list)
    repository_id: Optional[str] = None
