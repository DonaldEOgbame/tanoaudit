"""Module 3 router: create scans (JSON config or ZIP upload), list, get, findings.

Scans are queued in the DB and run in a FastAPI BackgroundTask (same process as
the WebSocket, so progress streams live). The in-process maintenance loop
(`app.worker.run_maintenance_loop`, started by the API) is the safety net: it
atomically claims any QUEUED scan an API restart left behind and runs it through
the same orchestrator.
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
from app.services import ingestion, model_catalog, scan_events as ev
from app.services.orchestrator import run_scan
from app.services.usage import daily_scan_status, enforce_daily_scan_limit
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

    # Hard daily cap (before creating the row, so the new scan isn't self-counted).
    await enforce_daily_scan_limit(db, user.id)

    scan = _new_scan(user.id, body)
    db.add(scan)
    await db.flush()
    await link_scan_to_repo(db, scan)
    scan_id = scan.id
    # Commit first so the row (QUEUED) is durable: a separate polling worker can
    # claim it, and the in-process BackgroundTask below runs it immediately when
    # this process stays up.
    await db.commit()
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

    # Hard daily cap (before creating the row, so the new scan isn't self-counted).
    await enforce_daily_scan_limit(db, user.id)

    scan = _new_scan(user.id, cfg)
    scan.repo = scan.repo or (file.filename or "upload.zip").rsplit(".", 1)[0]
    db.add(scan)
    await db.flush()
    await link_scan_to_repo(db, scan)
    scan_id = scan.id

    # Extract synchronously (bytes are in-request) into the shared, scan-id-keyed
    # upload dir, which a separate polling worker can also read. The scan then
    # flows through run_scan(scan_id) (materialize finds the upload dir by id).
    workdir = ingestion.scan_upload_dir(scan_id)
    ingestion.extract_zip(raw, workdir)
    await db.commit()
    background.add_task(run_scan, scan_id)
    return envelope(ScanOut.model_validate(scan).model_dump())


@router.get("/models")
async def list_model_tiers(user: User = Depends(get_current_user)):
    """The Akira model tiers a user can pick for a scan/chat. Exposes only
    id/label/description — never the underlying provider or concrete model."""
    return envelope({"tiers": model_catalog.public_tiers(),
                     "default": model_catalog.DEFAULT_TIER})


@router.get("/limit")
async def get_scan_limit(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The user's rolling-24h scan usage vs the daily cap (for the UI)."""
    return envelope(await daily_scan_status(db, user.id))


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


@router.get("/{scan_id}/dependencies")
async def list_dependencies(
    scan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dependency inventory for a scan: declared packages enriched with latest
    versions and OSV advisories. Returns a summary + the per-package list."""
    from app.models.dependency import (
        STATUS_CLEAN,
        STATUS_OUTDATED,
        STATUS_VULNERABLE,
        ScanDependency,
    )

    await _owned_scan(db, scan_id, user.id)
    rows = (
        await db.execute(
            select(ScanDependency).where(ScanDependency.scan_id == scan_id)
        )
    ).scalars().all()
    items = [r.as_dict() for r in rows]
    summary = {
        "total": len(items),
        "vulnerable": sum(1 for r in rows if r.status == STATUS_VULNERABLE),
        "outdated": sum(1 for r in rows if r.status == STATUS_OUTDATED),
        "clean": sum(1 for r in rows if r.status == STATUS_CLEAN),
    }
    return envelope({"items": items, "summary": summary})


@router.get("/{scan_id}/ai-generation")
async def ai_generation(
    scan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI-generation *signals* for a scan.

    Intentionally does NOT report a "% AI-generated" composition: reliable
    AI-vs-human code detection isn't currently possible (even research-grade
    detectors are ~84% in a lab and fail on clean, polished AI code), so any
    percentage would be false precision. We return only the concrete, defensible
    signals — counts of patterns commonly left by code-generation tools — plus the
    risk `delta` (a real finding-density ratio). The UI sums the pattern counts.

    `percent` is still included for backward compatibility but is deprecated and
    should not be presented as a composition figure."""
    from app.services.ai_generation import analyze

    scan = await _owned_scan(db, scan_id, user.id)
    findings = (
        await db.execute(select(Finding).where(Finding.scan_id == scan_id))
    ).scalars().all()
    payload = analyze(list(findings), scan.files or 0)
    # Total concrete signals = sum of pattern counts (what the UI surfaces).
    payload["signal_count"] = sum(p.get("count", 0) for p in payload.get("patterns", []))
    payload["basis"] = (
        "Counts of patterns commonly associated with machine-generated code, from "
        "this scan's findings. Not a composition estimate — reliable AI-vs-human "
        "code detection is not currently possible."
    )
    return envelope(payload)
