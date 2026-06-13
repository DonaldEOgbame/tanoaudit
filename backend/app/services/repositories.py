"""Repository resolution + watchlist change detection helpers."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import utcnow
from app.models.repository import (
    FREQ_DAILY,
    FREQ_WEEKLY,
    Repository,
)
from app.models.scan import ENGINE_SECURITY, Finding, Scan


def scan_identifier(scan: Scan) -> str:
    return scan.repo or scan.source_url or scan.id


async def resolve_or_create_repo(
    db: AsyncSession, user_id: str, identifier: str, source_type: str
) -> Repository:
    repo = (
        await db.execute(
            select(Repository).where(
                Repository.user_id == user_id, Repository.identifier == identifier
            )
        )
    ).scalar_one_or_none()
    if repo is None:
        repo = Repository(
            user_id=user_id, identifier=identifier, source_type=source_type
        )
        db.add(repo)
        await db.flush()
    return repo


async def link_scan_to_repo(db: AsyncSession, scan: Scan) -> Repository:
    """Resolve/create the repo for a scan and set scan.repository_id."""
    repo = await resolve_or_create_repo(
        db, scan.user_id, scan_identifier(scan), scan.source_type
    )
    scan.repository_id = repo.id
    return repo


def _next_run(frequency: str) -> object:
    now = utcnow()
    if frequency == FREQ_DAILY:
        return now + timedelta(days=1)
    if frequency == FREQ_WEEKLY:
        return now + timedelta(weeks=1)
    return None


async def mark_repo_scanned(db: AsyncSession, repo: Repository, scan: Scan) -> None:
    """Update the repo's latest-scan pointer + schedule the next watched run."""
    repo.last_scan_id = scan.id
    repo.last_scanned_at = utcnow()
    if repo.watched and repo.frequency in (FREQ_DAILY, FREQ_WEEKLY):
        repo.next_run_at = _next_run(repo.frequency)


async def _latest_two_scans(db: AsyncSession, repo_id: str) -> list[Scan]:
    from app.models.scan import SCAN_COMPLETED

    return (
        await db.execute(
            select(Scan)
            .where(Scan.repository_id == repo_id, Scan.status == SCAN_COMPLETED)
            .order_by(Scan.completed_at.desc())
            .limit(2)
        )
    ).scalars().all()


async def compute_change(db: AsyncSession, repo: Repository) -> dict:
    """Diff the repo's two latest completed scans → new-issue + new-critical counts."""
    scans = await _latest_two_scans(db, repo.id)
    if len(scans) < 2:
        return {"new_issues": 0, "new_criticals": 0, "direction": "flat",
                "change_label": "no change"}

    newer, older = scans[0], scans[1]
    new_f = (await db.execute(select(Finding).where(Finding.scan_id == newer.id))).scalars().all()
    old_f = (await db.execute(select(Finding).where(Finding.scan_id == older.id))).scalars().all()

    from app.services.scan_diff import diff_findings
    diff = diff_findings(old_f, new_f)
    new_count = len(diff.new)
    fixed_count = len(diff.fixed)
    new_crit = sum(
        1 for f in diff.new
        if f.engine == ENGINE_SECURITY and (f.severity or "").lower() == "critical"
    )

    if new_count > 0:
        direction, label = "up", f"+{new_count} new"
    elif fixed_count > 0:
        direction, label = "down", f"-{fixed_count} fixed"
    else:
        direction, label = "flat", "no change"

    return {
        "new_issues": new_count,
        "new_criticals": new_crit,
        "direction": direction,
        "change_label": label,
    }
