"""Weekly digest composition + send (for users who opted in)."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select

from app.core.database import SessionLocal, utcnow
from app.models.notification import N_WEEKLY_DIGEST
from app.models.scan import ENGINE_SECURITY, Finding, Scan
from app.models.user import User
from app.services.notifications import notify


async def _user_digest_text(db, user_id: str) -> str | None:
    week_ago = utcnow() - timedelta(days=7)
    scans = (
        await db.execute(
            select(Scan).where(Scan.user_id == user_id, Scan.created_at >= week_ago)
        )
    ).scalars().all()
    if not scans:
        return None
    scan_ids = [s.id for s in scans]
    crit = (
        await db.execute(
            select(func.count()).select_from(Finding).where(
                Finding.scan_id.in_(scan_ids),
                Finding.engine == ENGINE_SECURITY,
                Finding.severity == "critical",
            )
        )
    ).scalar_one()
    repos = sorted({s.repo for s in scans if s.repo})
    return (
        f"This week: {len(scans)} scan(s) across {len(repos)} repo(s), "
        f"{crit} new Critical finding(s). Repos: {', '.join(repos) or '—'}."
    )


async def send_weekly_digests() -> int:
    """Compose + send a weekly digest to each opted-in user. Returns count sent."""
    sent = 0
    async with SessionLocal() as db:
        users = (
            await db.execute(select(User))
        ).scalars().all()
        targets = [u.id for u in users if (u.notifications or {}).get("weekly_digest")]
        texts = {uid: await _user_digest_text(db, uid) for uid in targets}

    for uid, text in texts.items():
        if text:
            await notify(uid, N_WEEKLY_DIGEST, "Your Akira AI weekly digest", text)
            sent += 1
    return sent
