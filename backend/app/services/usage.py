"""Usage logging + aggregate computation."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SessionLocal, utcnow
from app.models.scan import SCAN_COMPLETED, Scan
from app.models.usage import UsageLog
from app.services.llm_clients import PROVIDER_LABELS


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


async def aggregate(db: AsyncSession, user_id: str) -> dict:
    now = utcnow()
    today = now - timedelta(hours=24)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    logs = (
        await db.execute(select(UsageLog).where(UsageLog.user_id == user_id))
    ).scalars().all()

    # API calls by provider + daily tokens per provider.
    by_provider: dict[str, int] = {}
    daily_tokens: dict[str, int] = {}
    session_tokens = 0
    for u in logs:
        by_provider[u.provider] = by_provider.get(u.provider, 0) + 1
        created = u.created_at
        if created is not None:
            from app.core.database import as_aware
            if as_aware(created) >= today:
                daily_tokens[u.provider] = (
                    daily_tokens.get(u.provider, 0) + u.tokens_in + u.tokens_out
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

    def label(p: str) -> str:
        return PROVIDER_LABELS.get(p, p)

    return {
        "session": {
            "tokens": session_tokens,
            "calls": sum(1 for u in logs if u.created_at and _within(u.created_at, today)),
        },
        "daily_tokens_by_model": [
            {"provider": p, "label": label(p), "tokens": t}
            for p, t in sorted(daily_tokens.items())
        ],
        "scans_this_month": scans_month,
        "lifetime_segments": int(lifetime_segments or 0),
        "api_calls_by_provider": [
            {"provider": p, "label": label(p), "calls": c}
            for p, c in sorted(by_provider.items())
        ],
        "last_updated": now.isoformat(),
    }


def _within(created, since) -> bool:
    from app.core.database import as_aware
    return as_aware(created) >= since
