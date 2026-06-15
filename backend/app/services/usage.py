"""Usage logging + aggregate computation + daily scan-limit enforcement."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import SessionLocal, as_aware, utcnow
from app.models.scan import SCAN_COMPLETED, Scan
from app.models.usage import UsageLog
from app.services.llm_clients import PROVIDER_LABELS


async def daily_scan_status(db: AsyncSession, user_id: str) -> dict:
    """Return the user's rolling-24h scan usage vs the configured cap.

    {used, limit, remaining, resets_in_seconds} — `resets_in_seconds` is the time
    until the oldest scan in the window ages out (0 when under the cap).
    """
    limit = settings.daily_scan_limit
    window_start = utcnow() - timedelta(hours=24)
    rows = (
        await db.execute(
            select(Scan.created_at)
            .where(Scan.user_id == user_id, Scan.created_at >= window_start)
            .order_by(Scan.created_at)
        )
    ).scalars().all()
    used = len(rows)
    resets_in = 0
    if used >= limit and rows:
        oldest = as_aware(rows[0])
        resets_in = max(0, int((oldest + timedelta(hours=24) - utcnow()).total_seconds()))
    return {
        "used": used,
        "limit": limit,
        "remaining": max(0, limit - used),
        "resets_in_seconds": resets_in,
    }


async def enforce_daily_scan_limit(db: AsyncSession, user_id: str) -> None:
    """Raise a 429 APIError if the user is at/over their rolling-24h scan cap."""
    from app.core.errors import APIError

    status = await daily_scan_status(db, user_id)
    if status["remaining"] <= 0:
        hours = max(1, round(status["resets_in_seconds"] / 3600))
        raise APIError(
            "daily_limit_reached",
            f"Daily scan limit reached ({status['limit']}/day). "
            f"Resets in about {hours}h.",
            429,
            details={"resets_in_seconds": status["resets_in_seconds"], **status},
        )


async def record_usage(
    user_id: str, provider: str, model: str | None,
    tokens_in: int, tokens_out: int,
    scan_id: str | None = None, purpose: str | None = None,
) -> None:
    """Persist one LLM call. Best-effort — never raises into the caller."""
    try:
        async with SessionLocal() as db:
            db.add(UsageLog(
                user_id=user_id, provider=provider, model=model,
                tokens_in=tokens_in, tokens_out=tokens_out,
                scan_id=scan_id, purpose=purpose,
            ))
            await db.commit()
    except Exception:  # noqa: BLE001
        pass


def _tier_label_for_log(provider: str, model_id: str | None) -> str:
    from app.services import model_catalog
    if model_id:
        model_id_clean = model_id.lower()
        for t in model_catalog.all_tiers():
            t_model_clean = t.model.lower()
            if model_id_clean == t_model_clean or model_id_clean in t_model_clean or t_model_clean in model_id_clean:
                return t.label
    
    # Fallback default mapping based on provider
    if provider == "gemini":
        return "Akira Fast"
    elif provider == "openrouter":
        if model_id and "sonnet" in model_id.lower():
            return "Akira Deep"
        return "Akira Balanced"
    return "Akira Fast"


async def aggregate(db: AsyncSession, user_id: str) -> dict:
    now = utcnow()
    today = now - timedelta(hours=24)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    logs = (
        await db.execute(select(UsageLog).where(UsageLog.user_id == user_id))
    ).scalars().all()

    # Pre-initialize dictionary for all known tiers in catalog order to ensure consistency
    from app.services import model_catalog
    tiers = model_catalog.all_tiers()
    
    daily_tokens = {t.label: 0 for t in tiers}
    calls_by_model = {t.label: 0 for t in tiers}
    session_tokens = 0

    for u in logs:
        lbl = _tier_label_for_log(u.provider, u.model)
        calls_by_model[lbl] = calls_by_model.get(lbl, 0) + 1
        
        created = u.created_at
        if created is not None:
            from app.core.database import as_aware
            if as_aware(created) >= today:
                daily_tokens[lbl] = (
                    daily_tokens.get(lbl, 0) + u.tokens_in + u.tokens_out
                )
                session_tokens += u.tokens_in + u.tokens_out

    # Scans this month.
    scans_month = (
        await db.execute(
            select(func.count()).select_from(Scan).where(
                Scan.user_id == user_id, Scan.created_at >= month_start
            )
        )
    ).scalar_one()

    # Lifetime segments analyzed (sum of segments_analyzed on completed scans).
    lifetime_segments = (
        await db.execute(
            select(func.coalesce(func.sum(Scan.segments_analyzed), 0)).where(
                Scan.user_id == user_id, Scan.status == SCAN_COMPLETED
            )
        )
    ).scalar_one()

    tier_limits = {
        "Akira Fast": settings.daily_tokens_fast,
        "Akira Balanced": settings.daily_tokens_balanced,
        "Akira Deep": settings.daily_tokens_deep,
    }

    daily_tokens_list = [
        {"label": t.label, "tokens": daily_tokens[t.label], "limit": tier_limits.get(t.label, 1_000_000)}
        for t in tiers
    ]

    api_calls_list = [
        {"label": t.label, "calls": calls_by_model[t.label]}
        for t in tiers
    ]

    scan_status = await daily_scan_status(db, user_id)

    return {
        "daily_scans": scan_status,
        "daily_tokens_by_model": daily_tokens_list,
        "scans_this_month": scans_month,
        "lifetime_segments": int(lifetime_segments or 0),
        "api_calls_by_provider": api_calls_list,
        "last_updated": now.isoformat(),
    }


def _within(created, since) -> bool:
    from app.core.database import as_aware
    return as_aware(created) >= since
