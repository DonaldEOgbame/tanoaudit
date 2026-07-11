"""In-process maintenance loop.

Live scan events are guaranteed by running *every* scan in the API process: the
orchestrator publishes to the in-memory event bus that the same process's
WebSocket reads. There is deliberately no separate worker process — a scan run
elsewhere could not stream live events.

This module is the periodic loop that the API launches on startup (see
`app.main.lifespan`). It:
  - triggers due watchlist re-scans (creates QUEUED scan rows),
  - claims QUEUED scans (fresh watchlist re-scans + crash-orphaned scans) and
    runs them in-process via the same orchestrator,
  - recovers scans orphaned by an API restart,
  - sends weekly digests and sweeps the file cache.

Scans are *claimed* atomically (status queued -> claimed, stamped with this
process's id) so the loop never double-runs a scan that an API BackgroundTask is
already running. User-initiated scans are run immediately as BackgroundTasks
(see `api/scans.py`); this loop is the safety net for headless scans (scheduled
re-scans, orphan recovery) that have no attached client.
"""
from __future__ import annotations

import asyncio
import logging
import os
import socket
import uuid
from datetime import timedelta

from sqlalchemy import select, update

from app.core.database import SessionLocal, engine, utcnow
from app.models.repository import FREQ_DAILY, FREQ_WEEKLY, Repository
from app.models.scan import (
    SCAN_CLAIMED,
    SCAN_FAILED,
    SCAN_QUEUED,
    SCAN_RUNNING,
    Scan,
)
from app.services.orchestrator import run_scan
from app.services.repositories import _next_run

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tanoaudit.worker")

POLL_SECONDS = 5
CLAIM_BATCH = 10

# Identifies this process in the scans.worker_id column.
WORKER_ID = f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"


async def _claim_queued_scans() -> list[str]:
    """Atomically claim up to CLAIM_BATCH queued scans for this worker.

    Postgres uses SELECT ... FOR UPDATE SKIP LOCKED so concurrent workers grab
    disjoint rows. SQLite (local/dev, single worker) has no SKIP LOCKED, so we
    fall back to a guarded conditional UPDATE that's still atomic per row — a
    second worker's UPDATE simply matches zero rows for an already-claimed scan.
    """
    if engine.dialect.name == "postgresql":
        return await _claim_postgres()
    return await _claim_sqlite()


async def _claim_postgres() -> list[str]:
    async with SessionLocal() as db:
        # Lock a batch of queued rows, skipping any another worker holds.
        ids = (
            await db.execute(
                select(Scan.id)
                .where(Scan.status == SCAN_QUEUED)
                .order_by(Scan.created_at)
                .limit(CLAIM_BATCH)
                .with_for_update(skip_locked=True)
            )
        ).scalars().all()
        if ids:
            await db.execute(
                update(Scan)
                .where(Scan.id.in_(ids))
                .values(status=SCAN_CLAIMED, worker_id=WORKER_ID)
            )
        await db.commit()
        return list(ids)


async def _claim_sqlite() -> list[str]:
    claimed: list[str] = []
    async with SessionLocal() as db:
        ids = (
            await db.execute(
                select(Scan.id)
                .where(Scan.status == SCAN_QUEUED)
                .order_by(Scan.created_at)
                .limit(CLAIM_BATCH)
            )
        ).scalars().all()
        for scan_id in ids:
            # Guarded UPDATE: only succeeds if the scan is still queued. rowcount
            # == 0 means someone else claimed it between the read and now.
            res = await db.execute(
                update(Scan)
                .where(Scan.id == scan_id, Scan.status == SCAN_QUEUED)
                .values(status=SCAN_CLAIMED, worker_id=WORKER_ID)
            )
            if res.rowcount:
                claimed.append(scan_id)
        await db.commit()
    return claimed


async def _due_watchlist_rescans() -> list[str]:
    """Create queued scans for due watched repos and reschedule them.

    The created scans are left QUEUED; the next claim tick runs them through the
    same atomic-claim path (no inline run here), so watchlist re-scans get the
    same no-double-run guarantee. The due repos are locked (SKIP LOCKED on
    Postgres) so two workers don't both create a re-scan for the same repo.
    """
    now = utcnow()
    triggered: list[str] = []
    async with SessionLocal() as db:
        stmt = select(Repository).where(
            Repository.watched == True,  # noqa: E712
            Repository.next_run_at.is_not(None),
            Repository.next_run_at <= now,
        )
        if engine.dialect.name == "postgresql":
            stmt = stmt.with_for_update(skip_locked=True)
        repos = (await db.execute(stmt)).scalars().all()
        for repo in repos:
            last = await db.get(Scan, repo.last_scan_id) if repo.last_scan_id else None
            scan = Scan(
                user_id=repo.user_id,
                source_type=last.source_type if last else repo.source_type,
                repo=repo.identifier,
                source_url=last.source_url if last else None,
                branch=last.branch if last else None,
                depth=last.depth if last else "deep",
                model_mode=last.model_mode if last else "auto",
                models=last.models if last else ["gemini", "openrouter"],
                include_custom=last.include_custom if last else True,
                include_optimization=last.include_optimization if last else True,
                repository_id=repo.id,
            )
            db.add(scan)
            await db.flush()
            # Reschedule so we don't re-trigger next tick.
            if repo.frequency in (FREQ_DAILY, FREQ_WEEKLY):
                repo.next_run_at = _next_run(repo.frequency)
            triggered.append(scan.id)
        await db.commit()
    return triggered


async def _maybe_send_digests(state: dict) -> None:
    """Send weekly digests at most once every ~24h of worker uptime."""
    from app.services.digest import send_weekly_digests

    now = utcnow()
    last = state.get("last_digest")
    if last is None or (now - last) >= timedelta(days=1):
        sent = await send_weekly_digests()
        if sent:
            logger.info("sent %d weekly digest(s)", sent)
        state["last_digest"] = now


async def _maybe_sweep_file_cache(state: dict) -> None:
    """Sweep expired scan file caches at most ~once a day of worker uptime."""
    from app.services import file_cache

    now = utcnow()
    last = state.get("last_cache_sweep")
    if last is None or (now - last) >= timedelta(days=1):
        removed = file_cache.sweep_expired()
        if removed:
            logger.info("file-cache sweep removed %d expired dir(s)", removed)
        state["last_cache_sweep"] = now


ORPHAN_AFTER = timedelta(minutes=15)
MAX_RETRIES = 3


async def recover_orphan_scans() -> int:
    """Reclaim scans stuck in claimed/running past ORPHAN_AFTER (worker crashed).

    Keyed off started_at (the scans table has no updated_at). Under the retry
    cap, the scan is reset to QUEUED so the poller picks it up next tick; over the
    cap it's marked failed so it doesn't loop forever. Returns the number of scans
    acted on.
    """
    cutoff = utcnow() - ORPHAN_AFTER
    acted = 0
    async with SessionLocal() as db:
        stmt = select(Scan).where(
            Scan.status.in_([SCAN_CLAIMED, SCAN_RUNNING]),
            Scan.started_at.is_not(None),
            Scan.started_at < cutoff,
        )
        if engine.dialect.name == "postgresql":
            stmt = stmt.with_for_update(skip_locked=True)
        orphaned = (await db.execute(stmt)).scalars().all()
        for scan in orphaned:
            if scan.retry_count < MAX_RETRIES:
                scan.status = SCAN_QUEUED
                scan.retry_count += 1
                scan.worker_id = None
                scan.started_at = None
                logger.warning(
                    "recovered orphaned scan %s (retry %d/%d)",
                    scan.id, scan.retry_count, MAX_RETRIES,
                )
            else:
                scan.status = SCAN_FAILED
                scan.error = "Scan failed after repeated worker crashes (orphan recovery)"
                scan.completed_at = utcnow()
                logger.error("orphaned scan %s exceeded retry cap, marking failed", scan.id)
            acted += 1
        await db.commit()
    # Reset scans stay QUEUED; the poller claims them next tick.
    return acted


async def run_maintenance_loop(stop: asyncio.Event | None = None) -> None:
    """In-process loop: triggers/claims/runs headless scans + periodic crons.

    Launched by the API on startup (`app.main.lifespan`) so any scan it runs
    publishes to the same in-memory event bus the WebSocket reads — live events
    are never lost to a process boundary. `stop` lets the lifespan cancel it
    cleanly on shutdown.
    """
    logger.info("TanoAudit maintenance loop started (poll every %ss)", POLL_SECONDS)
    state: dict = {}
    while stop is None or not stop.is_set():
        try:
            # Queue due watchlist re-scans first; the claim pass below runs
            # both fresh and watchlist scans through the same atomic claim,
            # in-process, so their progress streams to any attached client.
            created = await _due_watchlist_rescans()
            if created:
                logger.info("queued %d due watchlist re-scan(s)", len(created))
            for scan_id in await _claim_queued_scans():
                logger.info("running claimed scan %s (%s)", scan_id, WORKER_ID)
                await run_scan(scan_id)
            recovered = await recover_orphan_scans()
            if recovered:
                logger.info("orphan recovery acted on %d scan(s)", recovered)
            await _maybe_sweep_file_cache(state)
            await _maybe_send_digests(state)
        except Exception:  # noqa: BLE001 — loop must stay alive
            logger.exception("maintenance loop error")
        await asyncio.sleep(POLL_SECONDS)
