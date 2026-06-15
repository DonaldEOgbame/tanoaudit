"""Schemas for Module 2: model preferences + privacy & data settings.

Users no longer supply API keys (the server holds provider keys), so the key
schemas are gone. Model preference is just the user's default Akira tier.
"""
from __future__ import annotations

from pydantic import BaseModel

from app.services.model_catalog import DEFAULT_TIER


# ---- Model preferences ------------------------------------------------------
class ModelSettings(BaseModel):
    # Default Akira tier id (see services/model_catalog.py). Empty/unknown falls
    # back to the catalog default at resolve time.
    default_tier: str = DEFAULT_TIER


# ---- Privacy & data ---------------------------------------------------------
class PrivacySettings(BaseModel):
    improve_ai: bool = True
    store_scan_history: bool = True
