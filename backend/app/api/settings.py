"""Module 2 router: encrypted API keys (+ test), model preferences, privacy.

Model and privacy preferences live in the user's JSON blobs (`settings`,
`privacy`) so they travel with the profile; API keys get their own encrypted
table.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db, utcnow
from app.core.errors import envelope, not_found
from app.core.security import encrypt_secret, mask_secret
from app.models.api_key import (
    STATUS_INVALID,
    STATUS_VALID,
    ApiKey,
)
from app.models.user import User
from app.schemas.settings import (
    ApiKeyOut,
    ApiKeyUpsert,
    ModelSettings,
    PrivacySettings,
    TestKeyResult,
)
from app.services.providers import test_provider_key

router = APIRouter(prefix="/settings", tags=["settings"])

_MODEL_KEY = "model_settings"  # nested under user.settings


def _to_out(k: ApiKey) -> dict:
    return ApiKeyOut(
        id=k.id,
        provider=k.provider,
        masked="•" * 8 + k.last_four,
        status=k.status,
        last_verified_at=k.last_verified_at,
    ).model_dump()


async def _get_key(db: AsyncSession, user_id: str, provider: str) -> ApiKey | None:
    return (
        await db.execute(
            select(ApiKey).where(
                ApiKey.user_id == user_id, ApiKey.provider == provider
            )
        )
    ).scalar_one_or_none()


# ---- API keys ---------------------------------------------------------------
@router.get("/api-keys")
async def list_api_keys(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(select(ApiKey).where(ApiKey.user_id == user.id))
    ).scalars().all()
    return envelope([_to_out(k) for k in rows])


@router.put("/api-keys")
async def upsert_api_key(
    body: ApiKeyUpsert,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or replace the key for a provider. Resets validity to unverified."""
    existing = await _get_key(db, user.id, body.provider)
    if existing is None:
        existing = ApiKey(user_id=user.id, provider=body.provider)
        db.add(existing)
    existing.encrypted_key = encrypt_secret(body.key)
    existing.last_four = body.key[-4:]
    existing.status = "unverified"
    existing.last_verified_at = None
    await db.flush()
    return envelope(_to_out(existing))


@router.post("/api-keys/{provider}/test")
async def test_api_key(
    provider: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    key = await _get_key(db, user.id, provider)
    if key is None:
        raise not_found(f"No {provider} key configured")

    from app.core.security import decrypt_secret

    ok, detail = await test_provider_key(provider, decrypt_secret(key.encrypted_key))
    key.status = STATUS_VALID if ok else STATUS_INVALID
    key.last_verified_at = utcnow() if ok else key.last_verified_at
    await db.flush()
    return envelope(
        TestKeyResult(
            provider=provider,
            status=key.status,
            detail=detail,
            last_verified_at=key.last_verified_at,
        ).model_dump()
    )


@router.delete("/api-keys/{provider}", status_code=204)
async def delete_api_key(
    provider: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    key = await _get_key(db, user.id, provider)
    if key is None:
        raise not_found(f"No {provider} key configured")
    await db.delete(key)
    return  # 204


# ---- Model preferences ------------------------------------------------------
@router.get("/models")
async def get_model_settings(user: User = Depends(get_current_user)):
    stored = (user.settings or {}).get(_MODEL_KEY, {})
    return envelope(ModelSettings(**stored).model_dump())


@router.put("/models")
async def update_model_settings(
    body: ModelSettings,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
