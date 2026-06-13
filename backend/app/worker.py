"""Background worker entrypoint.

Module 3 runs scans inside FastAPI BackgroundTasks (fine for single-process dev).
For production, scans should run in a separate worker so they survive request
lifecycles and restarts. This module is that worker's home.

Current state: a lightweight poller that picks up queued scans and runs them via
the same orchestrator. It also drives due watchlist re-scans. Scans are *claimed*
atomically (status queued -> claimed, stamped with this worker's id) so two
workers can run side by side without both grabbing the same scan. Swapping in arq
or Celery later means replacing the loop body with task handlers — the
orchestrator (`run_scan`) and event bus stay unchanged.

Run:  python -m app.worker
"""
from __future__ import annotations

import asyncio
import logging
import os
import socket
import uuid
from datetime import timedelta

from sqlalchemy import select, update

from app.core.config import settings
from app.core.database import SessionLocal, engine, init_db, utcnow
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
logger = logging.getLogger("akira.worker")

POLL_SECONDS = 5
CLAIM_BATCH = 10

# Identifies this worker process in the scans.worker_id column.
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
    cap, the scan is reset to QUEUED and re-dispatched (arq if available, else
    the poller picks it up); over the cap it's marked failed so it doesn't loop
    forever. Returns the number of scans acted on.
    """
    from app.services.dispatch import enqueue

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
        to_enqueue: list[str] = []
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
                to_enqueue.append(scan.id)
            else:
                scan.status = SCAN_FAILED
                scan.error = "Scan failed after repeated worker crashes (orphan recovery)"
                scan.completed_at = utcnow()
                logger.error("orphaned scan %s exceeded retry cap, marking failed", scan.id)
            acted += 1
        await db.commit()
    # Re-dispatch outside the transaction. If arq isn't available the scan stays
    # QUEUED and the poller claims it next tick — no work lost either way.
    for scan_id in to_enqueue:
        await enqueue("run_scan_task", scan_id=scan_id)
    return acted


async def main() -> None:
    """Polling worker — the fallback dispatch when arq isn't running.

    For production HA, run the arq worker instead (`arq app.worker.WorkerSettings`),
    which gives retries/backpressure. This poller stays so a dev box or a
    Redis-less deploy still runs scans, watchlist re-scans, digests, and orphan
    recovery on a simple loop.
    """
    await init_db()
    logger.info("Akira polling worker started (poll every %ss)", POLL_SECONDS)
    state: dict = {}
    while True:
        try:
            # Enqueue due watchlist re-scans first; the claim pass below runs
            # both fresh and watchlist scans through the same atomic claim.
            created = await _due_watchlist_rescans()
            if created:
                logger.info("queued %d due watchlist re-scan(s)", len(created))
            for scan_id in await _claim_queued_scans():
                logger.info("running claimed scan %s (worker %s)", scan_id, WORKER_ID)
                await run_scan(scan_id)
            recovered = await recover_orphan_scans()
            if recovered:
                logger.info("orphan recovery acted on %d scan(s)", recovered)
            await _maybe_sweep_file_cache(state)
            await _maybe_send_digests(state)
        except Exception:  # noqa: BLE001 — worker must stay alive
            logger.exception("worker loop error")
        await asyncio.sleep(POLL_SECONDS)


# ---------------------------------------------------------------------------
# arq task queue (production dispatch). Handlers are thin wrappers around the
# existing service functions — the orchestrator/exporters are unchanged.
# ---------------------------------------------------------------------------
async def run_scan_task(ctx, scan_id: str) -> None:
    """arq job: run a scan to completion via the existing orchestrator."""
    logger.info("[arq] run_scan_task %s", scan_id)
    await run_scan(scan_id)


async def export_report_task(ctx, report_id: str) -> None:
    """arq job: render a queued export report to disk (was inline)."""
    from app.models.report import Report
    from app.services.exporters import EXPORTERS  # noqa: F401 (ensures import ok)
    from app.api.reports import _render_export  # reuse the exact same renderer

    logger.info("[arq] export_report_task %s", report_id)
    async with SessionLocal() as db:
        report = await db.get(Report, report_id)
        if report is None:
            logger.warning("[arq] export_report_task: report %s gone", report_id)
            return
        await _render_export(db, report)
        await db.commit()


async def watchlist_cron(ctx) -> None:
    """arq cron: enqueue due watchlist re-scans (run via run_scan_task)."""
    from app.services.dispatch import enqueue

    for scan_id in await _due_watchlist_rescans():
        await enqueue("run_scan_task", scan_id=scan_id)


async def orphan_recovery_cron(ctx) -> None:
    """arq cron: recover scans orphaned by a crashed worker."""
    await recover_orphan_scans()


async def digest_cron(ctx) -> None:
    """arq cron: send weekly digests."""
    from app.services.digest import send_weekly_digests

    sent = await send_weekly_digests()
    if sent:
        logger.info("[arq] sent %d weekly digest(s)", sent)


async def file_cache_cron(ctx) -> None:
    """arq cron: sweep expired scan file caches."""
    from app.services import file_cache

    removed = file_cache.sweep_expired()
    if removed:
        logger.info("[arq] file-cache sweep removed %d expired dir(s)", removed)


async def _startup(ctx) -> None:
    await init_db()


def _build_worker_settings():
    """Build the arq WorkerSettings class. Returns None if arq isn't installed,
    so importing this module never hard-requires arq (the polling worker and the
    test helpers don't need it)."""
    try:
        from arq import cron
        from arq.connections import RedisSettings
    except ImportError:
        return None

    # No usable Redis URL (e.g. tests) -> don't build settings; the polling
    # worker / in-process fallback handles dispatch instead.
    if not settings.redis_url:
        return None

    class WorkerSettings:
        """arq worker config. Run: `arq app.worker.WorkerSettings`."""

        functions = [run_scan_task, export_report_task]
        cron_jobs = [
            cron(watchlist_cron, hour={0, 6, 12, 18}, minute=0),
            cron(orphan_recovery_cron, minute={0, 15, 30, 45}),
            cron(digest_cron, weekday=0, hour=9, minute=0),
            cron(file_cache_cron, hour=3, minute=0),
        ]
        on_startup = _startup
        redis_settings = RedisSettings.from_dsn(settings.redis_url)
        max_jobs = 5          # concurrency limit (backpressure)
        job_timeout = 1800    # 30 min per scan
        max_tries = 3         # retries on failure
        keep_result = 3600

    return WorkerSettings


# arq discovers this class by name: `arq app.worker.WorkerSettings`.
WorkerSettings = _build_worker_settings()


if __name__ == "__main__":
    asyncio.run(main())
