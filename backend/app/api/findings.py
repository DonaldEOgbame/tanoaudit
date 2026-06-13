"""Module 7 router: false-positive marking, full-fix streaming, suppressions."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db, utcnow
from app.core.errors import bad_request, envelope, not_found
from app.models.scan import (
    ENGINE_STUB,
    STATUS_FALSE_POSITIVE,
    STATUS_FIXED,
    STATUS_INTENTIONAL,
    STATUS_OPEN,
    Finding,
    Scan,
)
from app.models.suppression import (
    FalsePositiveSuppression,
    IntentionalStubSuppression,
    stub_content_hash,
)
from app.models.user import User
from app.schemas.finding import (
    FalsePositiveRequest,
    IntentionalRequest,
    IntentionalStubOut,
    SuppressionOut,
)
from app.schemas.scan import FindingOut
from app.services.fix_generator import stream_full_fix, stream_implementation
from app.services.router_factory import build_router_for_user

router = APIRouter(tags=["findings"])


async def _owned_finding(db: AsyncSession, finding_id: str, user_id: str) -> tuple[Finding, Scan]:
    finding = await db.get(Finding, finding_id)
    if finding is None:
        raise not_found("Finding not found")
    scan = await db.get(Scan, finding.scan_id)
    if scan is None or scan.user_id != user_id:
        raise not_found("Finding not found")
    return finding, scan


def _repo_key(scan: Scan) -> str:
    return scan.repo or scan.source_url or scan.id


# ---- False positive ---------------------------------------------------------
@router.post("/findings/{finding_id}/false-positive")
async def mark_false_positive(
    finding_id: str,
    body: FalsePositiveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    finding, scan = await _owned_finding(db, finding_id, user.id)
    finding.status = STATUS_FALSE_POSITIVE
    finding.false_positive_reason = body.reason

    # Record a per-repo suppression rule for future scans.
    existing = (
        await db.execute(
            select(FalsePositiveSuppression).where(
                FalsePositiveSuppression.origin_finding_id == finding_id
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(FalsePositiveSuppression(
            user_id=user.id, repo=_repo_key(scan),
            category=finding.category, subcategory=finding.subcategory,
            file_pattern=finding.file, reason=body.reason,
            origin_finding_id=finding_id,
        ))
    await db.flush()
    return envelope(FindingOut.model_validate(finding).model_dump())


@router.delete("/findings/{finding_id}/false-positive")
async def unmark_false_positive(
    finding_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    finding, _ = await _owned_finding(db, finding_id, user.id)
    finding.status = STATUS_OPEN
    finding.false_positive_reason = None
    # Drop the suppression rule this finding created.
    rule = (
        await db.execute(
            select(FalsePositiveSuppression).where(
                FalsePositiveSuppression.origin_finding_id == finding_id
            )
        )
    ).scalar_one_or_none()
    if rule is not None:
        await db.delete(rule)
    await db.flush()
    return envelope(FindingOut.model_validate(finding).model_dump())


@router.post("/findings/{finding_id}/fixed")
async def mark_fixed(
    finding_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    finding, _ = await _owned_finding(db, finding_id, user.id)
    finding.status = STATUS_FIXED
    finding.fixed_via = finding.fixed_via or "manual"
    finding.fixed_at = utcnow()
    await db.flush()
    return envelope(FindingOut.model_validate(finding).model_dump())


# ---- Intentional stubs ------------------------------------------------------
@router.patch("/findings/{finding_id}/mark-intentional")
async def mark_intentional(
    finding_id: str,
    body: IntentionalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a stub finding as intentional (deliberate TODO / planned work).

    Mirrors the false-positive flow: records a per-repo suppression keyed by
    file + content hash so the same stub auto-suppresses on future scans.
    """
    finding, scan = await _owned_finding(db, finding_id, user.id)
    if finding.engine != ENGINE_STUB:
        raise bad_request("Only stub findings can be marked intentional")
    finding.status = STATUS_INTENTIONAL

    content_hash = stub_content_hash(finding.code_snippet)
    existing = (
        await db.execute(
            select(IntentionalStubSuppression).where(
                IntentionalStubSuppression.origin_finding_id == finding_id
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(IntentionalStubSuppression(
            user_id=user.id, repo=_repo_key(scan), file_path=finding.file,
            stub_category=finding.stub_category, content_hash=content_hash,
            reason=body.reason, origin_finding_id=finding_id,
        ))
    await db.flush()
    return envelope(FindingOut.model_validate(finding).model_dump())


@router.patch("/findings/{finding_id}/unmark-intentional")
async def unmark_intentional(
    finding_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    finding, _ = await _owned_finding(db, finding_id, user.id)
    finding.status = STATUS_OPEN
    rule = (
        await db.execute(
            select(IntentionalStubSuppression).where(
                IntentionalStubSuppression.origin_finding_id == finding_id
            )
        )
    ).scalar_one_or_none()
    if rule is not None:
        await db.delete(rule)
    await db.flush()
    return envelope(FindingOut.model_validate(finding).model_dump())


@router.get("/repos/{repo:path}/intentional-stubs")
async def list_intentional_stubs(
    repo: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(IntentionalStubSuppression).where(
                IntentionalStubSuppression.user_id == user.id,
                IntentionalStubSuppression.repo == repo,
            )
        )
    ).scalars().all()
    return envelope([IntentionalStubOut.model_validate(r).model_dump() for r in rows])


# ---- Suppression list -------------------------------------------------------
@router.get("/suppressions")
async def list_suppressions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    repo: str | None = None,
):
    stmt = select(FalsePositiveSuppression).where(
        FalsePositiveSuppression.user_id == user.id
    )
    if repo:
        stmt = stmt.where(FalsePositiveSuppression.repo == repo)
    rows = (await db.execute(stmt)).scalars().all()
    return envelope([SuppressionOut.model_validate(r).model_dump() for r in rows])


@router.delete("/suppressions/{suppression_id}", status_code=204)
async def delete_suppression(
    suppression_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await db.get(FalsePositiveSuppression, suppression_id)
    if rule is None or rule.user_id != user.id:
        raise not_found("Suppression not found")
    await db.delete(rule)
    return  # 204


async def _fetch_file_context(db: AsyncSession, scan, path: str) -> str | None:
    """Best-effort full-file context for a finding's fix.

    GitHub scans re-fetch the live file from the API (picks up post-scan edits);
    any scan type then falls back to the source-file cache written at ingestion,
    so ZIP/URL scans get full-file context too (not just the stored snippet).
    """
    if scan.source_type == "github" and scan.repo:
        from app.core.security import decrypt_secret
        from app.models.github import GitHubConnection
        from app.services import github_client as gh

        conn = (
            await db.execute(
                select(GitHubConnection).where(GitHubConnection.user_id == scan.user_id)
            )
        ).scalar_one_or_none()
        if conn is not None:
            try:
                token = decrypt_secret(conn.encrypted_token)
                text = await gh.get_file_content(
                    token, scan.repo, path, ref=scan.commit or scan.branch
                )
                if text is not None:
                    return text
            except ValueError:
                pass  # fall through to the cache

    from app.services import file_cache

    return file_cache.read_cached_file(scan, path)


# ---- Full-fix streaming (SSE) -----------------------------------------------
@router.post("/findings/{finding_id}/fix")
async def generate_full_fix(
    finding_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a deep, full corrected-code fix via Server-Sent Events."""
    finding, scan = await _owned_finding(db, finding_id, user.id)
    router_obj = await build_router_for_user(user.id, purpose="fix")
    # Snapshot the finding fields we need (the request session closes when the
    # streaming response starts).
    snapshot = Finding(
        scan_id=finding.scan_id, public_id=finding.public_id, engine=finding.engine,
        category=finding.category, severity=finding.severity, file=finding.file,
        line_start=finding.line_start, line_end=finding.line_end,
        code_snippet=finding.code_snippet, explanation=finding.explanation,
        fix_summary=finding.fix_summary, fix_snippet=finding.fix_snippet,
    )

    # Re-fetch the file from GitHub for richer context (best-effort).
    file_text = await _fetch_file_context(db, scan, finding.file)

    async def event_stream():
        async for chunk in stream_full_fix(snapshot, router_obj, file_text):
            yield f"data: {json.dumps({'delta': chunk})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/findings/{finding_id}/generate-implementation")
async def generate_implementation(
    finding_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a full implementation for a stub finding via SSE.

    Same pattern as the vulnerability "Generate Full Fix" endpoint, but uses the
    stub's snippet + surrounding file context + explanation to complete it.
    """
    finding, scan = await _owned_finding(db, finding_id, user.id)
    if finding.engine != ENGINE_STUB:
        raise bad_request("generate-implementation is only for stub findings")
    router_obj = await build_router_for_user(user.id, purpose="fix")
    snapshot = Finding(
        scan_id=finding.scan_id, public_id=finding.public_id, engine=finding.engine,
        category=finding.category, severity=finding.severity, file=finding.file,
        line_start=finding.line_start, line_end=finding.line_end,
        code_snippet=finding.code_snippet, explanation=finding.explanation,
        stub_category=finding.stub_category,
        completion_suggestion=finding.completion_suggestion,
        risk_if_shipped=finding.risk_if_shipped,
    )
    file_text = await _fetch_file_context(db, scan, finding.file)

    async def event_stream():
        async for chunk in stream_implementation(snapshot, router_obj, file_text):
            yield f"data: {json.dumps({'delta': chunk})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
