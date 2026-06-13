"""Schemas for Module 2: API keys, model preferences, privacy & data settings."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.api_key import PROVIDERS

Provider = Literal["gemini", "openrouter", "github"]


# ---- API keys ---------------------------------------------------------------
class ApiKeyUpsert(BaseModel):
    provider: Provider
    key: str = Field(min_length=8, max_length=500)


class ApiKeyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: str
    masked: str  # e.g. "••••••••aTf2"
    status: str
    last_verified_at: Optional[datetime] = None


class TestKeyResult(BaseModel):
    provider: str
    status: str  # "valid" | "invalid"
    detail: str
    last_verified_at: Optional[datetime] = None


# ---- Model preferences ------------------------------------------------------
class ModelSettings(BaseModel):
    # "Auto" or a specific model label matching the frontend's options.
    default_model: str = "Auto"
    # Ordered provider fallback chain honoured by the scan router.
    fallback_order: list[Provider] = Field(
        default_factory=lambda: ["gemini", "openrouter"]
    )
    # Per-model token budget per scan, in thousands of tokens.
    token_budgets: dict[str, int] = Field(default_factory=dict)


# ---- Privacy & data ---------------------------------------------------------
class PrivacySettings(BaseModel):
    improve_ai: bool = True
    store_scan_history: bool = True


def valid_providers() -> tuple[str, ...]:
    return PROVIDERS
