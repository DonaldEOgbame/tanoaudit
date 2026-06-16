"""Module 9 router: custom-vulnerability CRUD + streamed research pipeline."""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import SessionLocal, get_db
from app.core.errors import envelope, not_found
from app.models.custom_vuln import CustomVulnerability
from app.models.user import User
from app.schemas.custom_vuln import (
    CustomVulnCreate,
    CustomVulnOut,
    CustomVulnUpdate,
    ResearchRequest,
)
from app.services.research import (
    RESEARCH_COMPLETED,
    RESEARCH_FAILED,
    SearchConfig,
    run_research,
)
from app.services.router_factory import build_router_for_user

router = APIRouter(prefix="/custom-vulnerabilities", tags=["custom-vulns"])


async def _owned(db: AsyncSession, vuln_id: str, user_id: str) -> CustomVulnerability:
    v = await db.get(CustomVulnerability, vuln_id)
    if v is None or v.user_id != user_id:
        raise not_found("Custom vulnerability not found")
    return v


@router.get("")
async def list_vulns(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(
            select(CustomVulnerability)
            .where(CustomVulnerability.user_id == user.id)
            .order_by(CustomVulnerability.created_at.desc())
        )
    ).scalars().all()
    return envelope([CustomVulnOut.model_validate(v).model_dump() for v in rows])


@router.post("", status_code=201)
async def create_vuln(
    body: CustomVulnCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    v = CustomVulnerability(
        user_id=user.id, name=body.name, description=body.description,
        severity=body.severity, active=body.active,
    )
    db.add(v)
    await db.flush()
    return envelope(CustomVulnOut.model_validate(v).model_dump())


@router.patch("/{vuln_id}")
async def update_vuln(
    vuln_id: str,
    body: CustomVulnUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    v = await _owned(db, vuln_id, user.id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(v, field, value)
    db.add(v)
    await db.flush()
    return envelope(CustomVulnOut.model_validate(v).model_dump())


@router.delete("/{vuln_id}", status_code=204)
async def delete_vuln(
    vuln_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    v = await _owned(db, vuln_id, user.id)
    await db.delete(v)
    return  # 204


@router.post("/research")
async def research(
    body: ResearchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream the research pipeline's progress, then persist the definition.

    Emits SSE events: research_started, search_query_sent,
    search_results_received, synthesizing, research_completed.
    """
    if body.custom_vuln_id:
        await _owned(db, body.custom_vuln_id, user.id)  # ownership check

    router_obj = await build_router_for_user(user.id)
    user_id = user.id
    name, description = body.name, body.description
    target_id = body.custom_vuln_id

    async def event_stream():
        search_cfg = SearchConfig(
            tavily_key=settings.tavily_key, serpapi_key=settings.serpapi_key
        )
        definition = None

        # Pump the research generator through a queue so we can interleave SSE
        # heartbeat comments (": ping") while the long synthesis step (~20s LLM
        # call) produces no events. Browsers drop an idle streaming connection
        # during that gap, which truncated the stream before research_completed.
        queue: asyncio.Queue = asyncio.Queue()

        async def produce():
            try:
                async for item in run_research(name, description, router_obj, search_cfg):
                    await queue.put(("event", item))
            except Exception as exc:  # noqa: BLE001
                await queue.put(("error", str(exc)))
            finally:
                await queue.put(("done", None))

        task = asyncio.create_task(produce())
        try:
            while True:
                try:
                    kind, item = await asyncio.wait_for(queue.get(), timeout=5.0)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"  # heartbeat keeps the connection alive
                    continue
                if kind == "done":
                    break
                if kind == "error":
                    err = {"event": RESEARCH_FAILED, "status": "error", "error": item}
                    yield f"event: {RESEARCH_FAILED}\ndata: {json.dumps(err)}\n\n"
                    break
                event_type, payload = item
                if event_type == RESEARCH_COMPLETED:
                    definition = payload.get("definition")
                # Embed the event name in the data payload too: the frontend SSE
                # helper only reads `data:` lines (not the `event:` line).
                data = {"event": event_type, **payload}
                yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        finally:
            task.cancel()

        # Persist the structured definition.
        if definition is not None:
            async with SessionLocal() as s:
                if target_id:
                    v = await s.get(CustomVulnerability, target_id)
                else:
                    v = CustomVulnerability(
                        user_id=user_id, name=name, description=description,
                        active=True,
                    )
                    s.add(v)
                if v is not None:
                    v.what_it_is = definition["what_it_is"]
                    v.detection_patterns = definition["detection_patterns"]
                    v.what_to_look_for = definition["what_to_look_for"]
                    v.how_to_fix = definition["how_to_fix"]
                    v.source_urls = definition["source_urls"]
                    v.researched = True
                    await s.commit()
                    yield f"event: saved\ndata: {json.dumps({'event': 'saved', 'id': v.id})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
