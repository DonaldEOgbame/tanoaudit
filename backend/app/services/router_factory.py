"""Build a ModelRouter from the SERVER's provider keys + the scan's Akira tiers.

Users never provide keys: the app holds one key per provider (config.Settings).
A scan/chat selects Akira-branded tiers (e.g. "akira_deep"); each tier maps to a
hidden provider + concrete model id via `model_catalog`. The router runs in terms
of providers (fallback/cooldown), using the concrete model id chosen per provider
for this request, and labels attribution with the Akira tier name (never a vendor).
"""
from __future__ import annotations

from app.core.config import settings
from app.services import model_catalog
from app.services.model_catalog import DEFAULT_TIER, get_tier
from app.services.router_model import ModelRouter

# Provider -> server key. Only providers with a configured key are usable.
def _server_keys() -> dict[str, str]:
    keys: dict[str, str] = {}
    if settings.gemini_api_key:
        keys["gemini"] = settings.gemini_api_key
    if settings.openrouter_api_key:
        keys["openrouter"] = settings.openrouter_api_key
    return keys


def _plan_from_tiers(tier_ids: list[str]) -> tuple[list[str], dict[str, str], dict[str, str]]:
    """Resolve selected tier ids into router inputs.

    Returns (provider_order, models_by_provider, tier_label_by_provider). When two
    tiers share a provider, the first selected one wins for that provider's model
    + label (the router has one model per provider per request).
    """
    order: list[str] = []
    models: dict[str, str] = {}
    labels: dict[str, str] = {}
    for tid in tier_ids:
        tier = get_tier(tid)
        if tier.provider not in models:
            models[tier.provider] = tier.model
            labels[tier.provider] = tier.label
        if tier.provider not in order:
            order.append(tier.provider)
    return order, models, labels


def _resolve_tiers(model_mode: str, models: list | None) -> list[str]:
    """Pick the tier id list for a scan. Manual honours the user's selection;
    auto uses the default tier plus the others as fallbacks."""
    selected = [m for m in (models or []) if model_catalog.is_valid_tier(m)]
    if model_mode == "manual" and selected:
        tier_ids = selected
    else:
        tier_ids = [DEFAULT_TIER]
    # Always keep every tier as a tail fallback so a cooled-down provider can
    # reroute to another (server keys make all tiers available).
    for t in model_catalog.all_tiers():
        if t.id not in tier_ids:
            tier_ids.append(t.id)
    return tier_ids


async def build_router_for_scan(scan) -> ModelRouter:
    """Build a router for a scan from server keys + the scan's selected tiers."""
    tier_ids = _resolve_tiers(scan.model_mode, scan.models)
    order, models, labels = _plan_from_tiers(tier_ids)
    return ModelRouter(
        keys=_server_keys(), order=order, models=models, tier_labels=labels,
        mode=scan.model_mode, user_id=scan.user_id, scan_id=scan.id, purpose="scan",
    )


async def build_router_for_user(user_id: str, purpose: str | None = None) -> ModelRouter:
    """Build an Auto-mode router for non-scan LLM calls (chat, research, etc.)."""
    tier_ids = _resolve_tiers("auto", None)
    order, models, labels = _plan_from_tiers(tier_ids)
    return ModelRouter(
        keys=_server_keys(), order=order, models=models, tier_labels=labels,
        mode="auto", user_id=user_id, purpose=purpose,
    )


async def build_router_for_chat(user_id: str, tier_id: str | None, purpose: str | None = None) -> ModelRouter:
    """Build a router for chat with a user-selected tier as the preferred engine."""
    tier_ids = _resolve_tiers("manual", [tier_id] if tier_id else None)
    order, models, labels = _plan_from_tiers(tier_ids)
    return ModelRouter(
        keys=_server_keys(), order=order, models=models, tier_labels=labels,
        mode="auto", user_id=user_id, purpose=purpose,
    )
