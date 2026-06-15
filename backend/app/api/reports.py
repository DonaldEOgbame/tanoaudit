"""Module 6 router: exports, share links, public report, scan diff."""
from __future__ import annotations

import os
import secrets

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import SessionLocal, get_db, utcnow
from app.core.errors import bad_request, envelope, not_found
from app.models.report import (
    EXPORT_FAILED,
    EXPORT_PENDING,
    EXPORT_READY,
    Report,
    ShareToken,
)
from app.models.scan import Finding, Scan
from app.models.user import User
from app.schemas.report import (
    DiffOut,
    ExportCreate,
    ReportOut,
    ShareLinkOut,
)
from app.services.exporters import EXPORTERS
from app.services.scan_diff import diff_findings

router = APIRouter(tags=["reports"])


async def _owned_scan(db: AsyncSession, scan_id: str, user_id: str) -> Scan:
    scan = await db.get(Scan, scan_id)
    if scan is None or scan.user_id != user_id:
        raise not_found("Scan not found")
    return scan


async def _scan_findings(db: AsyncSession, scan_id: str) -> list[Finding]:
    return (
        await db.execute(select(Finding).where(Finding.scan_id == scan_id))
    ).scalars().all()


def _share_url(slug: str) -> str:
    return f"{settings.public_base_url}/r/{slug}"


# ---- Exports ----------------------------------------------------------------
async def _render_export(db: AsyncSession, report: Report) -> None:
    """Render the export to disk and update the report row (caller commits).

    Exports have no external I/O, so they're rendered inline at request time —
    fast and race-free. (A heavy/network-bound format would move to the worker
    pool, reusing this same function.)
    """
    scan = await db.get(Scan, report.scan_id)
    findings = await _scan_findings(db, report.scan_id)
    try:
        data, ext = EXPORTERS[report.format](scan, findings)
        os.makedirs(settings.export_dir, exist_ok=True)
        path = os.path.join(settings.export_dir, f"{report.id}.{ext}")
        with open(path, "wb") as fh:
            fh.write(data)
        report.file_path = path
        report.status = EXPORT_READY
    except Exception as exc:  # noqa: BLE001
        report.status = EXPORT_FAILED
        report.error = str(exc)[:500]


@router.post("/scans/{scan_id}/exports", status_code=201)
async def create_export(
    scan_id: str,
    body: ExportCreate,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _owned_scan(db, scan_id, user.id)
    report = Report(
        user_id=user.id, scan_id=scan_id, format=body.format, status=EXPORT_PENDING
    )
    db.add(report)
    await db.flush()
    report_id = report.id
    # The export renders in a BackgroundTask (off the request's critical path):
    # it stays EXPORT_PENDING and the client polls list_exports / download_export
    # until it's EXPORT_READY. Commit first so the row is durable.
    await db.commit()
    background.add_task(_render_export_bg, report_id)
    await db.refresh(report)
    return envelope(ReportOut.model_validate(report).model_dump())


async def _render_export_bg(report_id: str) -> None:
    """In-process fallback renderer (own session, since the request's is closed)."""
    async with SessionLocal() as db:
        report = await db.get(Report, report_id)
        if report is None:
            return
        await _render_export(db, report)
        await db.commit()


@router.get("/scans/{scan_id}/exports")
async def list_exports(
    scan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _owned_scan(db, scan_id, user.id)
    rows = (
        await db.execute(
            select(Report)
            .where(Report.scan_id == scan_id)
            .order_by(Report.created_at.desc())
        )
    ).scalars().all()
    return envelope([ReportOut.model_validate(r).model_dump() for r in rows])


@router.get("/exports/{report_id}/download")
async def download_export(
    report_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if report is None or report.user_id != user.id:
        raise not_found("Export not found")
    if report.status != EXPORT_READY or not report.file_path:
        raise bad_request("Export is not ready")
    return FileResponse(report.file_path, filename=os.path.basename(report.file_path))


# ---- Share links ------------------------------------------------------------
@router.post("/scans/{scan_id}/share", status_code=201)
async def create_share(
    scan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _owned_scan(db, scan_id, user.id)
    token = ShareToken(
        user_id=user.id, scan_id=scan_id, slug=secrets.token_urlsafe(12)
    )
    db.add(token)
    await db.flush()
    out = ShareLinkOut.model_validate(token).model_dump()
    out["url"] = _share_url(token.slug)
    return envelope(out)


@router.get("/scans/{scan_id}/share")
async def list_shares(
    scan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _owned_scan(db, scan_id, user.id)
    rows = (
        await db.execute(
            select(ShareToken).where(ShareToken.scan_id == scan_id)
        )
    ).scalars().all()
    items = []
    for t in rows:
        d = ShareLinkOut.model_validate(t).model_dump()
        d["url"] = _share_url(t.slug)
        items.append(d)
    return envelope(items)


@router.delete("/share/{token_id}", status_code=204)
async def revoke_share(
    token_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token = await db.get(ShareToken, token_id)
    if token is None or token.user_id != user.id:
        raise not_found("Share link not found")
    token.revoked = True
    return  # 204


@router.get("/public/reports/{slug}")
async def public_report(slug: str, db: AsyncSession = Depends(get_db)):
    """Unauthenticated, sanitized report served via a share slug.

    No user PII, no API keys — only the scan's findings and scores.
    """
    token = (
        await db.execute(select(ShareToken).where(ShareToken.slug == slug))
    ).scalar_one_or_none()
    if token is None or token.revoked:
        raise not_found("Report not found")
    scan = await db.get(Scan, token.scan_id)
    if scan is None:
        raise not_found("Report not found")
    token.last_viewed_at = utcnow()
    findings = await _scan_findings(db, scan.id)
    return envelope({
        "repo": scan.repo,
        "branch": scan.branch,
        "commit": scan.commit,
        "security_score": scan.security_score,
        "optimization_score": scan.optimization_score,
        "completeness_score": scan.completeness_score,
        "worst_severity": scan.worst_severity,
        "executive_summary": scan.executive_summary,
        "files": scan.files,
        "segment_total": scan.segment_total,
        "findings": [
            {
                "public_id": f.public_id, "engine": f.engine,
                "category": f.category, "subcategory": f.subcategory,
                "severity": f.severity, "confidence": f.confidence,
                "file": f.file, "line_start": f.line_start, "line_end": f.line_end,
                "code_snippet": f.code_snippet, "explanation": f.explanation,
                "fix_summary": f.fix_summary, "fix_snippet": f.fix_snippet,
                "cwe_id": f.cwe_id, "owasp_ref": f.owasp_ref, "impact": f.impact,
                "stub_category": f.stub_category,
                "completion_suggestion": f.completion_suggestion,
                "risk_if_shipped": f.risk_if_shipped,
                "status": f.status,
            }
            for f in findings
        ],
    })


# ---- Scan diff --------------------------------------------------------------
@router.get("/scans/{scan_id}/diff/{other_scan_id}")
async def scan_diff(
    scan_id: str,
    other_scan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Diff `other_scan_id` (older baseline) -> `scan_id` (newer)."""
    newer = await _owned_scan(db, scan_id, user.id)
    older = await _owned_scan(db, other_scan_id, user.id)
    new_findings = await _scan_findings(db, newer.id)
    old_findings = await _scan_findings(db, older.id)
    result = diff_findings(old_findings, new_findings)

    def brief(f: Finding) -> dict:
        return {
            "public_id": f.public_id, "engine": f.engine, "category": f.category,
            "severity": f.severity, "file": f.file, "line_start": f.line_start,
        }

    return envelope(DiffOut(
        new=[brief(f) for f in result.new],
        fixed=[brief(f) for f in result.fixed],
        still_open=[brief(f) for f in result.still_open],
    ).model_dump())
