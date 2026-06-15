"""FastAPI application factory for Akira AI."""
from __future__ import annotations

import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.router import api_router
from app.core.config import settings
from app.core.database import init_db, get_db
from app.core.errors import envelope, register_exception_handlers
from app.core.logging import configure_logging, set_correlation_id


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Refuse to boot in production with the sample secrets.
    settings.assert_production_safe()
    # For local/dev convenience, ensure tables exist. Production uses Alembic.
    if not settings.is_production:
        await init_db()
    # Seed the Learning Hub taxonomy + fun facts (idempotent).
    from app.services.fun_facts_seed import seed_fun_facts
    from app.services.learning_service import seed_learning_hub
    await seed_learning_hub()
    await seed_fun_facts()

    # In-process maintenance loop: runs headless scans (scheduled watchlist
    # re-scans, crash-orphan recovery) and periodic crons. Scans run in *this*
    # process so their progress streams over the WebSocket — live events are
    # never lost to a separate worker process. Disabled in tests.
    stop = asyncio.Event()
    loop_task: asyncio.Task | None = None
    if not settings.testing:
        from app.worker import run_maintenance_loop
        loop_task = asyncio.create_task(run_maintenance_loop(stop))
    try:
        yield
    finally:
        stop.set()
        if loop_task is not None:
            loop_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await loop_task


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

    configure_logging()

    @app.middleware("http")
    async def _correlation(request, call_next):
        cid = set_correlation_id(request.headers.get("X-Request-ID"))
        response = await call_next(request)
        response.headers["X-Request-ID"] = cid
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    # MCP server is mounted at /mcp (outside the versioned API prefix).
    from app.api.mcp import router as mcp_router
    app.include_router(mcp_router)

    @app.get("/handoff/{audit_id}", response_class=PlainTextResponse, tags=["handoff"])
    async def get_handoff_direct(
        audit_id: str,
        token: str = Query(...),
        db: AsyncSession = Depends(get_db),
    ):
        from app.api.handoff import consume_handoff
        return await consume_handoff(audit_id, token, db)

    @app.get("/health", tags=["meta"])
    async def health():
        return envelope({"status": "ok", "service": settings.app_name})

    return app


app = create_app()
