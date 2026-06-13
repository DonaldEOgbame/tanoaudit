"""Task dispatch: enqueue to the arq worker, or fall back to in-process.

This is the single seam between "request handler" and "background work". When
`arq_enabled` is set and Redis is reachable, jobs are enqueued to the arq worker
(retries, backpressure, survives restarts). Otherwise `enqueue` returns False and
the caller runs the work in-process (FastAPI BackgroundTasks / the polling
worker) — so a dev box with no worker still scans.

The orchestrator (`run_scan`) and the other service functions are unchanged; the
arq task handlers in `app.worker` are thin wrappers around them.
"""
from __future__ import annotations

import logging

from app.core.config import settings

logger = logging.getLogger("akira.dispatch")

# Cached arq pool + a one-shot "is it reachable" flag, mirroring the event bus's
# lazy-connect-with-fallback pattern.
_pool = None
_pool_ready = False


async def _get_pool():
    """Lazily create the arq redis pool. Returns the pool or None (fallback)."""
    global _pool, _pool_ready
    if _pool_ready:
        return _pool
    _pool_ready = True
    if not settings.arq_enabled or not settings.redis_url:
        return None
    try:
        from arq import create_pool
        from arq.connections import RedisSettings

        pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        await pool.ping()
        _pool = pool
    except Exception as exc:  # noqa: BLE001 — any failure -> in-process fallback
        logger.warning("arq pool unavailable, falling back to in-process: %s", exc)
        _pool = None
    return _pool


async def enqueue(task: str, **kwargs) -> bool:
    """Enqueue `task` on the arq worker. Returns True if enqueued, False if the
    caller should run the work in-process."""
    pool = await _get_pool()
    if pool is None:
        return False
    try:
        await pool.enqueue_job(task, **kwargs)
        logger.info("enqueued %s %s", task, kwargs)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("enqueue %s failed, falling back in-process: %s", task, exc)
        return False


async def reset_pool() -> None:
    """Test/maintenance hook: drop the cached pool so the next call reconnects."""
    global _pool, _pool_ready
    if _pool is not None:
        try:
            await _pool.aclose()
        except Exception:  # noqa: BLE001
            pass
    _pool = None
    _pool_ready = False
