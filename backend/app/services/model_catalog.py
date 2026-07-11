"""TanoAudit model catalog: the single mapping from user-facing tiers to the
hidden provider + concrete model id.

Users select an TanoAudit-branded tier (e.g. "tanoaudit_deep"); the vendor (Gemini /
OpenRouter) and the concrete model id never leave the server. The API exposes
only `{id, label, description}` per tier. Scans/chat store the tier id in
`Scan.models` / `model_hint`; the router resolves it to (provider, model) here.

Concrete model ids are env-overridable (config.Settings) so you can swap a tier's
backend without touching the UI or the stored tier ids.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.core.config import settings


@dataclass(frozen=True)
class ModelTier:
    id: str            # stable tier id stored on scans (e.g. "tanoaudit_fast")
    label: str         # user-facing name (vendor never mentioned)
    description: str   # short blurb for the selector
    provider: str      # hidden: "gemini" | "openrouter"
    model: str         # hidden: concrete provider model id


def _catalog() -> dict[str, ModelTier]:
    """Build the tier catalog from current settings (so env overrides apply)."""
    return {
        "tanoaudit_fast": ModelTier(
            id="tanoaudit_fast",
            label="Fast",
            description="Lightest coverage — a quick first pass.",
            provider="openrouter",
            model=settings.tier_fast_model,
        ),
        "tanoaudit_balanced": ModelTier(
            id="tanoaudit_balanced",
            label="Balanced",
            description="Broader coverage for everyday scans. Recommended.",
            provider="openrouter",
            model=settings.tier_balanced_model,
        ),
        "tanoaudit_deep": ModelTier(
            id="tanoaudit_deep",
            label="Deep",
            description="Widest coverage for large repos. Takes longest.",
            provider="openrouter",
            model=settings.tier_deep_model,
        ),
    }


DEFAULT_TIER = "tanoaudit_balanced"


def all_tiers() -> list[ModelTier]:
    """Catalog in display order."""
    return list(_catalog().values())


def public_tiers() -> list[dict]:
    """Safe-to-expose tier list — id/label/description only, no provider/model."""
    return [
        {"id": t.id, "label": t.label, "description": t.description}
        for t in all_tiers()
    ]


def get_tier(tier_id: str | None) -> ModelTier:
    """Resolve a tier id to its tier, falling back to the default tier for an
    unknown/None id (so a stale stored id never breaks a scan)."""
    cat = _catalog()
    return cat.get(tier_id or "", cat[DEFAULT_TIER])


def is_valid_tier(tier_id: str) -> bool:
    return tier_id in _catalog()


def resolve(tier_id: str | None) -> tuple[str, str]:
    """Resolve a tier id to (provider, model). Default tier for unknown ids."""
    t = get_tier(tier_id)
    return t.provider, t.model


def label_for_tier(tier_id: str | None) -> str:
    return get_tier(tier_id).label
