"""Build a ModelRouter for a scan from the user's stored, decrypted API keys."""
from __future__ import annotations

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import decrypt_secret
from app.models.api_key import ApiKey
from app.models.scan import Scan
from app.services.router_model import ModelRouter

_LLM_PROVIDERS = ("gemini", "openrouter")
_DEFAULT_ORDER = ["gemini", "openrouter"]


async def build_router_for_scan(scan: Scan) -> ModelRouter:
    """Load decrypted keys + resolve the provider order from scan config."""
    async with SessionLocal() as db:
        rows = (
            await db.execute(
                select(ApiKey).where(
                    ApiKey.user_id == scan.user_id,
                    ApiKey.provider.in_(_LLM_PROVIDERS),
                )
            )
        ).scalars().all()

    keys: dict[str, str] = {}
    for row in rows:
        try:
            keys[row.provider] = decrypt_secret(row.encrypted_key)
        except ValueError:
            continue

    if scan.model_mode == "manual" and scan.models:
        order = [p for p in scan.models if p in _LLM_PROVIDERS]
    else:
        order = list(_DEFAULT_ORDER)
    # Keep any keyed provider not explicitly listed as a tail fallback.
    for p in _DEFAULT_ORDER:
        if p not in order:
            order.append(p)

    return ModelRouter(
        keys=keys, order=order, mode=scan.model_mode,
        user_id=scan.user_id, scan_id=scan.id, purpose="scan",
    )


async def build_router_for_user(user_id: str, purpose: str | None = None) -> ModelRouter:
    """Build an Auto-mode router from a user's keys (for non-scan LLM calls)."""
    async with SessionLocal() as db:
        rows = (
            await db.execute(
                select(ApiKey).where(
                    ApiKey.user_id == user_id,
                    ApiKey.provider.in_(_LLM_PROVIDERS),
                )
            )
        ).scalars().all()
    keys: dict[str, str] = {}
    for row in rows:
        try:
            keys[row.provider] = decrypt_secret(row.encrypted_key)
        except ValueError:
            continue
    return ModelRouter(
        keys=keys, order=list(_DEFAULT_ORDER), mode="auto",
        user_id=user_id, purpose=purpose,
    )
