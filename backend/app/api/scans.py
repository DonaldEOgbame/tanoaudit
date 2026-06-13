"""Module 3 router: create scans (JSON config or ZIP upload), list, get, findings.

Scans run in a FastAPI BackgroundTask for Module 3. A durable worker (arq/celery)
is introduced when scan orchestration needs to survive restarts (later module).
"""
from __future__ import annotations

import json

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    Query,
    UploadFile,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.errors import bad_request, envelope, not_found
from app.core.ratelimit import rate_limit
from app.models.scan import Finding, Scan
from app.models.user import User
from app.schemas.scan import FindingOut, ScanCreate, ScanOut
from app.services import ingestion, scan_events as ev
from app.services.dispatch import enqueue
from app.services.orchestrator import run_scan
from app.services.repositories import link_scan_to_repo

router = APIRouter(prefix="/scans", tags=["scans"])


def _new_scan(user_id: str, cfg: ScanCreate) -> Scan:
    return Scan(
        user_id=user_id,
        source_type=cfg.source_type,
        repo=cfg.repo,
        source_url=cfg.source_url,
        branch=cfg.branch,
        depth=cfg.depth,
        model_mode=cfg.model_mode,
        models=cfg.models,
        include_custom=cfg.include_custom,
        include_optimization=cfg.include_optimization,
    )


@router.post("", status_code=201, dependencies=[rate_limit(20, 3600, scope="scan")])
async def create_scan(
    body: ScanCreate,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a github/url scan. ZIP uploads use POST /scans/upload."""
    if body.source_type == "zip":
        raise bad_request("Use POST /scans/upload for ZIP sources")
    if body.source_type == "url" and not body.source_url:
        raise bad_request("source_url is required for url scans")
    if body.source_type == "github" and not body.repo:
        raise bad_request("repo is required for github scans")

    scan = _new_scan(user.id, body)
    db.add(scan)
    await db.flush()
    await link_scan_to_repo(db, scan)
    scan_id = scan.id
    # github/url scans are self-contained (the worker re-clones), so they can run
    # in the arq worker. Commit first so the separate worker process sees the row;
    # fall back to an in-process BackgroundTask when arq isn't available.
    await db.commit()
    if not await enqueue("run_scan_task", scan_id=scan_id):
        background.add_task(run_scan, scan_id)
    return envelope(ScanOut.model_validate(scan).model_dump())


@router.post("/upload", status_code=201)
async def upload_scan(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    config: str = Form("{}"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a scan from an uploaded ZIP. `config` is JSON matching ScanCreate
    (minus source fields)."""
    raw = await file.read()
    try:
        cfg_data = json.loads(config or "{}")
    except json.JSONDecodeError:
        raise bad_request("config must be valid JSON")
    cfg_data["source_type"] = "zip"
    cfg = ScanCreate.model_validate(cfg_data)

    scan = _new_scan(user.id, cfg)
    scan.repo = scan.repo or (file.filename or "upload.zip").rsplit(".", 1)[0]
    db.add(scan)
    await db.flush()
    await link_scan_to_repo(db, scan)
    scan_id = scan.id

    # Extract synchronously (bytes are in-request) into the shared, scan-id-keyed
    # upload dir, which a separate arq worker can read. The scan then flows
    # through the same run_scan_task(scan_id) enqueue as github/url (materialize
    # finds the upload dir by id); in-process BackgroundTask fallback otherwise.
    workdir = ingestion.scan_upload_dir(scan_id)
    ingestion.extract_zip(raw, workdir)
    await db.commit()
    if not await enqueue("run_scan_task", scan_id=scan_id):
        background.add_task(run_scan, scan_id)
    return envelope(ScanOut.model_validate(scan).model_dump())


@router.get("")
async def list_scans(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    total = (
        await db.execute(
            select(func.count()).select_from(Scan).where(Scan.user_id == user.id)
        )
    ).scalar_one()
    rows = (
        await db.execute(
            select(Scan)
            .where(Scan.user_id == user.id)
            .order_by(Scan.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    return envelope({
        "items": [ScanOut.model_validate(s).model_dump() for s in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    })


async def _owned_scan(db: AsyncSession, scan_id: str, user_id: str) -> Scan:
    scan = await db.get(Scan, scan_id)
    if scan is None or scan.user_id != user_id:
        raise not_found("Scan not found")
    return scan


@router.get("/{scan_id}")
async def get_scan(
    scan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scan = await _owned_scan(db, scan_id, user.id)
    return envelope(ScanOut.model_validate(scan).model_dump())


@router.delete("/{scan_id}", status_code=204)
async def delete_scan(
    scan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a scan and all of its data.

    Child rows are deleted explicitly (DB-agnostic): SQLite doesn't enforce
    `ondelete="CASCADE"` without the foreign-keys pragma, so we don't rely on it.
    On-disk artifacts — cached source files, any extracted ZIP upload dir, and
    rendered export files — are removed too, so nothing is left behind (this is
    the cleanup-on-delete that the file-cache TTL sweep otherwise handles).
    """
    import shutil

    from sqlalchemy import delete as sa_delete

    from app.models.chat import ChatLog
    from app.models.handoff import HandoffEvent, HandoffToken
    from app.models.report import Report, ShareToken
    from app.models.scan import SCAN_CLAIMED, SCAN_RUNNING, Finding, Segment
    from app.services import file_cache

    scan = await _owned_scan(db, scan_id, user.id)

    # If it's mid-flight, signal cancel so a worker stops touching the row.
    if scan.status in (SCAN_RUNNING, SCAN_CLAIMED):
        await ev.bus.set_control(scan_id, ev.Control.CANCEL)

    # Remove rendered export files before dropping their rows.
    reports = (
        await db.execute(select(Report).where(Report.scan_id == scan_id))
    ).scalars().all()
    for rep in reports:
        if rep.file_path:
            try:
                import os
                os.remove(rep.file_path)
            except OSError:
                pass

    # On-disk source artifacts.
    file_cache.clear_cache(scan)
    shutil.rmtree(ingestion.scan_upload_dir(scan_id), ignore_errors=True)

    # Child rows keyed by scan_id, then the scan.
    for model in (Finding, Segment, Report, ShareToken, ChatLog):
        await db.execute(sa_delete(model).where(model.scan_id == scan_id))
    # Handoff tables key the scan by audit_id (handoff terminology), not scan_id.
    await db.execute(sa_delete(HandoffToken).where(HandoffToken.audit_id == scan_id))
    await db.execute(sa_delete(HandoffEvent).where(HandoffEvent.audit_id == scan_id))
    await db.delete(scan)
    await db.commit()
    return  # 204


@router.post("/{scan_id}/control", status_code=200)
async def control_scan(
    scan_id: str,
    command: str = Query(..., pattern="^(pause|resume|cancel)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """REST fallback for the WebSocket control commands."""
    await _owned_scan(db, scan_id, user.id)
    mapping = {
        "pause": ev.Control.PAUSE,
        "resume": ev.Control.RUNNING,
        "cancel": ev.Control.CANCEL,
    }
    await ev.bus.set_control(scan_id, mapping[command])
    return envelope({"scan_id": scan_id, "control": command})


@router.get("/{scan_id}/findings")
async def list_findings(
    scan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    engine: str | None = Query(None, pattern="^(security|optimization|stub)$"),
    severity: str | None = Query(None),
    status: str | None = Query(None),
):
    await _owned_scan(db, scan_id, user.id)
    stmt = select(Finding).where(Finding.scan_id == scan_id)
    if engine:
        stmt = stmt.where(Finding.engine == engine)
    if severity:
        stmt = stmt.where(Finding.severity == severity.lower())
    if status:
        stmt = stmt.where(Finding.status == status)
    rows = (await db.execute(stmt)).scalars().all()
    return envelope([FindingOut.model_validate(f).model_dump() for f in rows])
