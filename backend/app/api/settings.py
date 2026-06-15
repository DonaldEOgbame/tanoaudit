"""Module 2 router: model preferences + privacy.

Users no longer provide API keys — the server holds one key per provider and
users pick Akira-branded model tiers (see services/model_catalog.py). Model and
privacy preferences live in the user's JSON blobs (`settings`, `privacy`) so they
travel with the profile.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.errors import bad_request, envelope
from app.models.user import User
from app.schemas.settings import ModelSettings, PrivacySettings
from app.services import model_catalog

router = APIRouter(prefix="/settings", tags=["settings"])

_MODEL_KEY = "model_settings"  # nested under user.settings


# ---- Model preferences ------------------------------------------------------
@router.get("/models")
async def get_model_settings(user: User = Depends(get_current_user)):
    """The user's default Akira tier preference (no provider keys involved)."""
    stored = (user.settings or {}).get(_MODEL_KEY, {})
    return envelope(ModelSettings(**stored).model_dump())


@router.put("/models")
async def update_model_settings(
    body: ModelSettings,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.default_tier and not model_catalog.is_valid_tier(body.default_tier):
        raise bad_request(f"Unknown model tier: {body.default_tier}")
    merged = dict(user.settings or {})
    merged[_MODEL_KEY] = body.model_dump()
    user.settings = merged
    db.add(user)
    await db.flush()
    return envelope(body.model_dump())


# ---- Privacy & data ---------------------------------------------------------
@router.get("/privacy")
async def get_privacy(user: User = Depends(get_current_user)):
    return envelope(PrivacySettings(**(user.privacy or {})).model_dump())


@router.put("/privacy")
async def update_privacy(
    body: PrivacySettings,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    merged = dict(user.privacy or {})
    merged.update(body.model_dump())
    user.privacy = merged
    db.add(user)
    await db.flush()
    return envelope(PrivacySettings(**merged).model_dump())
