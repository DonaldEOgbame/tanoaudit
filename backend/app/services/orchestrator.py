"""Scan orchestrator: drives a scan from queued -> completed.

Module 3 is single-model and synchronous within a background task. Module 4
replaces `default_complete` with the multi-model router; Module 5 layers in the
WebSocket progress events at the marked points.
"""
from __future__ import annotations

import asyncio
import logging
import shutil
import uuid

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal, utcnow
from app.models.scan import (
    ENGINE_OPTIMIZATION,
    ENGINE_SECURITY,
    ENGINE_STUB,
    SCAN_CANCELLED,
    SCAN_COMPLETED,
    SCAN_FAILED,
    SCAN_RUNNING,
    STATUS_INTENTIONAL,
    Finding,
    Scan,
    Segment,
)
from app.schemas.scan import FindingOut
from app.services.analysis import AnalysisResult, CompleteFn
from app.services.normalization import normalize_label
from app.services import ingestion, scan_events as ev, scoring
from app.services.router_factory import build_router_for_scan
from app.services.router_model import ModelRouter
from app.services.segmentation import SegmentData, segment_files
from app.services.verification import verify_criticals

logger = logging.getLogger("akira.analysis")


class _Cancelled(Exception):
    """Raised internally when a client cancels a running scan."""


async def _await_resume_or_cancel(scan_id: str) -> None:
    """Block while paused; raise _Cancelled if cancelled. Polls the control flag."""
    control = await ev.bus.get_control(scan_id)
    if control == ev.Control.CANCEL:
        raise _Cancelled()
    if control == ev.Control.PAUSE:
        await ev.bus.publish(scan_id, ev.SCAN_PAUSED)
        while await ev.bus.get_control(scan_id) == ev.Control.PAUSE:
            await asyncio.sleep(0.05)
        if await ev.bus.get_control(scan_id) == ev.Control.CANCEL:
            raise _Cancelled()
        await ev.bus.publish(scan_id, ev.SCAN_RESUMED)


async def _drain_router_events(scan_id: str, router: ModelRouter | None) -> None:
    """Forward any new reroute/cooldown events as model_status events."""
    if router is None:
        return
    while router.events:
        e = router.events.pop(0)
        await ev.bus.publish(scan_id, ev.MODEL_STATUS, {
            "model_name": router.label_for(e.provider) or e.provider,
            "status": e.kind,
            "rerouted_to": router.label_for(e.rerouted_to) if e.rerouted_to else None,
        })

# Depth -> how many categories / how aggressive; Module 4 expands this.
_DEPTH_LIMITS = {"fast": 120, "deep": 400, "thorough": 800}


async def default_complete(prompt: str, model_hint: str | None) -> str:
    """Placeholder provider. Returns an empty-but-valid analysis.

    Replaced by the real multi-model router in Module 4. Kept valid so the
    pipeline runs end-to-end even with no provider keys configured.
    """
    return '{"security": [], "optimizations": [], "stubs": [], "segment_scores": {"security_risk": 0, "optimization_score": 100, "completeness_score": 100}}'


async def materialize_source(scan: Scan) -> tuple[str, str | None]:
    """Produce a working dir for the scan's source. Returns (workdir, commit)."""
    if scan.source_type == "zip":
        # The upload endpoint already extracted the ZIP into the shared, scan-id
        # keyed upload dir, which any worker can read.
        return ingestion.scan_upload_dir(scan.id), None
    workdir = ingestion.make_scan_workdir()
    commit = None
    if scan.source_type == "url" and scan.source_url:
        await ingestion.clone_repo(scan.source_url, workdir, scan.branch)
        commit = await ingestion.git_head_commit(workdir)
    elif scan.source_type == "github" and scan.repo:
        # Authenticated clone using the user's stored OAuth token (private repos).
        clone_url = await _github_clone_url(scan.user_id, scan.repo)
        await ingestion.clone_repo(clone_url, workdir, scan.branch)
        commit = await ingestion.git_head_commit(workdir)
    return workdir, commit


async def _github_clone_url(user_id: str, repo_full_name: str) -> str:
    """Build an authenticated https clone URL from the user's GitHub token.

    Falls back to an unauthenticated URL (works for public repos) if there's no
    connection — the clone will simply fail for private repos.
    """
    from app.models.github import GitHubConnection
    from app.core.security import decrypt_secret

    async with SessionLocal() as db:
        conn = (
            await db.execute(
                select(GitHubConnection).where(GitHubConnection.user_id == user_id)
            )
        ).scalar_one_or_none()
    if conn is not None:
        try:
            token = decrypt_secret(conn.encrypted_token)
            return f"https://x-access-token:{token}@github.com/{repo_full_name}.git"
        except ValueError:
            pass
    return f"https://github.com/{repo_full_name}.git"


def _public_id(engine: str, idx: int) -> str:
    prefix = {ENGINE_SECURITY: "VLN", ENGINE_STUB: "STB"}.get(engine, "OPT")
    return f"{prefix}-{idx:04d}"


def _result_to_findings(
    scan_id: str, seg: SegmentData, result: AnalysisResult,
    sec_counter: list[int], opt_counter: list[int], model_hint: str | None,
    stub_counter: list[int] | None = None,
    intentional_hashes: set[str] | None = None,
) -> list[Finding]:
    out: list[Finding] = []
    for item in result.security:
        sec_counter[0] += 1
        out.append(Finding(
            scan_id=scan_id, public_id=_public_id(ENGINE_SECURITY, sec_counter[0]),
            engine=ENGINE_SECURITY, category=item.category,
            subcategory=normalize_label(item.subcategory), subcategory_raw=item.subcategory or None,
            severity=(item.severity or "info").lower(), confidence=item.confidence,
            file=seg.file_path,
            line_start=item.line_start or seg.line_start,
            line_end=item.line_end or seg.line_end,
            code_snippet=item.code_snippet or None, explanation=item.explanation or None,
            fix_summary=item.fix_summary or None, fix_snippet=item.fix_snippet or None,
            cwe_id=item.cwe_id or None, owasp_ref=item.owasp_ref or None,
            model_attribution=model_hint,
        ))
    for item in result.optimizations:
        opt_counter[0] += 1
        out.append(Finding(
            scan_id=scan_id, public_id=_public_id(ENGINE_OPTIMIZATION, opt_counter[0]),
            engine=ENGINE_OPTIMIZATION, category=item.category,
            subcategory=normalize_label(item.subcategory), subcategory_raw=item.subcategory or None,
            severity=(item.severity or "info").lower(), confidence=item.confidence,
            file=seg.file_path,
            line_start=item.line_start or seg.line_start,
            line_end=item.line_end or seg.line_end,
            code_snippet=item.code_snippet or None, explanation=item.explanation or None,
            fix_summary=item.fix_summary or None, fix_snippet=item.fix_snippet or None,
            impact=item.impact or None, model_attribution=model_hint,
        ))
    if stub_counter is not None:
        from app.models.scan import STATUS_OPEN
        from app.models.suppression import stub_content_hash

        for item in result.stubs:
            stub_counter[0] += 1
            # Auto-suppress stubs the user previously marked intentional, matched
            # by content hash (location-independent within the file).
            is_intentional = (
                intentional_hashes is not None
                and stub_content_hash(item.code_snippet) in intentional_hashes
            )
            out.append(Finding(
                scan_id=scan_id, public_id=_public_id(ENGINE_STUB, stub_counter[0]),
                engine=ENGINE_STUB, category=item.category,
                severity=(item.severity or "info").lower(), confidence=item.confidence,
                file=seg.file_path,
                line_start=item.line_start or seg.line_start,
                line_end=item.line_end or seg.line_end,
                code_snippet=item.code_snippet or None, explanation=item.explanation or None,
                stub_category=item.category or None,
                completion_suggestion=item.completion_suggestion or None,
                risk_if_shipped=item.risk_if_shipped or None,
                status=STATUS_INTENTIONAL if is_intentional else STATUS_OPEN,
                model_attribution=model_hint,
            ))
    return out


async def run_scan(
    scan_id: str,
    *,
    complete: CompleteFn | None = None,
    workdir: str | None = None,
    cleanup: bool = True,
) -> None:
    """Execute a scan to completion. Resilient: always reaches a terminal state."""
    owns_workdir = workdir is None

    async with SessionLocal() as db:
        scan = await db.get(Scan, scan_id)
        if scan is None:
            return
        scan.status = SCAN_RUNNING
        scan.started_at = utcnow()
        scan.correlation_id = scan.correlation_id or str(uuid.uuid4())
        await db.commit()

    # Build the real multi-model router from the user's keys unless a provider
    # callable was injected (tests / placeholder).
    router: ModelRouter | None = None
    if complete is None:
        router = await build_router_for_scan(scan)
        complete = router.complete if router.has_any_key() else default_complete

    try:
        if workdir is None:
            workdir, commit = await materialize_source_safe(scan_id)
        else:
            commit = None

        files = ingestion.walk_source(workdir)
        # PR-diff scoping: restrict to changed paths when path_filters is set.
        if scan.path_filters:
            wanted = set(scan.path_filters)
            files = [f for f in files if f.rel_path in wanted]
        segments = segment_files(files)
        suppressions = await _load_suppressions(scan)
        custom_targets = await _load_custom_vulns(scan)
        intentional_hashes = await _load_intentional_stub_hashes(scan)
        # Attribution: the router's first available provider, label form.
        model_hint = None
        if router is not None:
            avail = [p for p in router.order if p in router.keys]
            model_hint = router.label_for(avail[0]) if avail else None

        # Cache source files so fix/implementation generation has full-file
        # context for ZIP/URL scans (GitHub re-fetches from the API instead).
        from app.services import file_cache

        cache_path = file_cache.cache_files(scan_id, files)

        async with SessionLocal() as db:
            scan = await db.get(Scan, scan_id)
            scan.files = len({f.rel_path for f in files})
            scan.segment_total = len(segments)
            if commit:
                scan.commit = commit
            if cache_path:
                scan.file_cache_path = cache_path
            await db.commit()

        await ev.bus.publish(scan_id, ev.SCAN_STARTED, {
            "segment_total": len(segments),
            "estimated_duration": _estimate_seconds(scan.depth, len(segments)),
        })

        # Per-file parse events.
        seg_counts: dict[str, int] = {}
        for s in segments:
            seg_counts[s.file_path] = seg_counts.get(s.file_path, 0) + 1
        for f in files:
            await ev.bus.publish(scan_id, ev.FILE_PARSED, {
                "file_path": f.rel_path,
                "segment_count": seg_counts.get(f.rel_path, 0),
                "language": f.language,
            })

        sec_counter, opt_counter, stub_counter = [0], [0], [0]
        opt_scores: list[int] = []
        analyzed = 0
        unparsed = 0
        total = len(segments) or 1
        started = utcnow()

        # Group segments into batches so we make far fewer LLM requests (one per
        # batch instead of one per segment) — essential under tight provider
        # rate limits. batch_tokens=0 disables batching (one segment per batch).
        from app.services.analysis import analyze_batch, batch_segments

        batch_tokens = settings.analysis_batch_tokens
        if batch_tokens and batch_tokens > 0:
            batches = batch_segments(segments, batch_tokens)
        else:
            batches = [[s] for s in segments]
        logger.info("scan %s: %d segments in %d batch(es)", scan_id, len(segments), len(batches))

        async with SessionLocal() as db:
            scan = await db.get(Scan, scan_id)
            idx = 0
            for batch in batches:
                await _await_resume_or_cancel(scan_id)  # honor pause/cancel per batch
                # One LLM call for the whole batch.
                batch_results = await analyze_batch(
                    batch, complete,
                    include_optimization=scan.include_optimization,
                    custom_vulns=custom_targets,
                    suppressions=suppressions,
                )
                await _drain_router_events(scan_id, router)
                for seg, result in zip(batch, batch_results):
                    idx += 1
                    db.add(Segment(
                        scan_id=scan_id, file_path=seg.file_path, language=seg.language,
                        line_start=seg.line_start, line_end=seg.line_end,
                        content_hash=seg.content_hash, analyzed=result is not None,
                    ))
                    if result is not None:
                        analyzed += 1
                        opt_scores.append(result.segment_scores.optimization_score)
                        for finding in _result_to_findings(
                            scan_id, seg, result, sec_counter, opt_counter, model_hint,
                            stub_counter=stub_counter, intentional_hashes=intentional_hashes,
                        ):
                            db.add(finding)
                            await db.flush()
                            await ev.bus.publish(
                                scan_id, ev.FINDING_DISCOVERED,
                                FindingOut.model_validate(finding).model_dump(mode="json"),
                            )
                    else:
                        # Segment dropped (missing/unparseable in the batch): its
                        # findings are lost. Track it so the scan can surface a
                        # recall-miss count instead of failing silently.
                        unparsed += 1

                    await ev.bus.publish(scan_id, ev.SEGMENT_COMPLETED, {
                        "analyzed": analyzed, "total": len(segments),
                    })
                    percent = round(idx / total * 100)
                    elapsed = (utcnow() - started).total_seconds()
                    eta = round(elapsed / idx * (total - idx)) if idx else None
                    await ev.bus.publish(scan_id, ev.SCAN_PROGRESS, {
                        "percent": percent, "elapsed": round(elapsed), "eta": eta,
                    })
            await db.commit()

        # Cross-model verification of Criticals (only with >=2 keyed providers).
        if router is not None and len([p for p in router.order if p in router.keys]) >= 2:
            async with SessionLocal() as db:
                crits = (
                    await db.execute(
                        select(Finding).where(
                            Finding.scan_id == scan_id,
                            Finding.severity == "critical",
                            # Stubs don't get cross-model verification — a stub is
                            # either there or it isn't; no ambiguity to re-check.
                            Finding.engine == ENGINE_SECURITY,
                        )
                    )
                ).scalars().all()
                await verify_criticals(crits, router, None)
                await db.commit()
                await _drain_router_events(scan_id, router)

        scan = await _finalize(scan_id, analyzed, opt_scores, router, unparsed=unparsed)
        await ev.bus.publish(scan_id, ev.SCAN_COMPLETED, {
            "security_score": scan.security_score,
            "optimization_score": scan.optimization_score,
            "segments_unparsed": scan.segments_unparsed,
            "report_id": scan_id,
        })
        await _emit_scan_notifications(scan_id)
    except _Cancelled:
        async with SessionLocal() as db:
            scan = await db.get(Scan, scan_id)
            if scan:
                scan.status = SCAN_CANCELLED
                scan.completed_at = utcnow()
                await db.commit()
        await ev.bus.publish(scan_id, ev.SCAN_CANCELLED)
    except Exception as exc:  # noqa: BLE001 — scan must always terminate
        # Log the full traceback — otherwise a failed scan only stores str(exc),
        # which is undebuggable (e.g. a bare "'NoneType' object has no attribute").
        logger.exception("scan %s failed", scan_id)
        async with SessionLocal() as db:
            scan = await db.get(Scan, scan_id)
            if scan:
                scan.status = SCAN_FAILED
                scan.error = str(exc)[:500]
                scan.completed_at = utcnow()
                await db.commit()
        await ev.bus.publish(scan_id, ev.SCAN_FAILED, {"error": str(exc)[:500]})
    finally:
        if cleanup and owns_workdir and workdir:
            shutil.rmtree(workdir, ignore_errors=True)


def _estimate_seconds(depth: str, segment_total: int) -> int:
    per = {"fast": 1.0, "deep": 2.5, "thorough": 4.0}.get(depth, 2.5)
    return int(segment_total * per)


async def _emit_scan_notifications(scan_id: str) -> None:
    """Create in-app/email notifications for scan completion, criticals, and
    watchlist changes. Best-effort."""
    from app.models.notification import (
        N_CRITICAL_FOUND, N_SCAN_COMPLETE, N_WATCHLIST_CHANGED,
    )
    from app.services.notifications import notify

    async with SessionLocal() as db:
        scan = await db.get(Scan, scan_id)
        if scan is None:
            return
        crits = (
            await db.execute(
                select(Finding).where(
                    Finding.scan_id == scan_id, Finding.severity == "critical",
                    Finding.engine == ENGINE_SECURITY,
                )
            )
        ).scalars().all()
        repo_name = scan.repo or scan.id
        repository_id = scan.repository_id
        user_id = scan.user_id
        n_crit = len(crits)
        sec_score = scan.security_score

    await notify(
        user_id, N_SCAN_COMPLETE, f"Scan complete: {repo_name}",
        f"Security score {sec_score}/100 · {n_crit} critical finding(s).",
        link={"scan_id": scan_id},
    )
    if n_crit:
        await notify(
            user_id, N_CRITICAL_FOUND, f"{n_crit} critical finding(s) in {repo_name}",
            "Review and remediate the critical issues.", link={"scan_id": scan_id},
        )

    # Watchlist change: if the repo is watched and this re-scan added findings.
    if repository_id:
        from app.models.repository import Repository
        from app.services.repositories import compute_change

        async with SessionLocal() as db:
            repo = await db.get(Repository, repository_id)
            if repo is not None and repo.watched:
                change = await compute_change(db, repo)
                if change["new_issues"] > 0:
                    await notify(
                        user_id, N_WATCHLIST_CHANGED,
                        f"{change['new_issues']} new finding(s) in {repo_name}",
                        change["change_label"], link={"repository_id": repository_id},
                    )


async def materialize_source_safe(scan_id: str) -> tuple[str, str | None]:
    async with SessionLocal() as db:
        scan = await db.get(Scan, scan_id)
    return await materialize_source(scan)


async def _load_suppressions(scan: Scan) -> list[str]:
    """Active 'do not re-flag' rules for this repo, as prompt-ready strings."""
    from app.models.suppression import FalsePositiveSuppression

    repo = scan.repo or scan.source_url or scan.id
    async with SessionLocal() as db:
        rows = (
            await db.execute(
                select(FalsePositiveSuppression).where(
                    FalsePositiveSuppression.user_id == scan.user_id,
                    FalsePositiveSuppression.repo == repo,
                )
            )
        ).scalars().all()
    out = []
    for r in rows:
        parts = [p for p in (r.category, r.subcategory) if p]
        loc = f" in {r.file_pattern}" if r.file_pattern else ""
        out.append(f"{' / '.join(parts) or 'finding'}{loc}")
    return out


async def _load_intentional_stub_hashes(scan: Scan) -> set[str]:
    """Content hashes of stubs the user marked intentional for this repo.

    A stub re-detected with the same content hash is auto-suppressed; if the code
    changed, the hash differs and it surfaces as a fresh stub.
    """
    from app.models.suppression import IntentionalStubSuppression

    repo = scan.repo or scan.source_url or scan.id
    async with SessionLocal() as db:
        rows = (
            await db.execute(
                select(IntentionalStubSuppression.content_hash).where(
                    IntentionalStubSuppression.user_id == scan.user_id,
                    IntentionalStubSuppression.repo == repo,
                )
            )
        ).scalars().all()
    return set(rows)


async def _load_custom_vulns(scan: Scan) -> list[str]:
    """Active custom-vuln detection targets for this scan's user (if enabled)."""
    if not scan.include_custom:
        return []
    from app.models.custom_vuln import CustomVulnerability

    async with SessionLocal() as db:
        rows = (
            await db.execute(
                select(CustomVulnerability).where(
                    CustomVulnerability.user_id == scan.user_id,
                    CustomVulnerability.active == True,  # noqa: E712
                )
            )
        ).scalars().all()
    return [v.as_prompt_target() for v in rows]


async def _finalize(
    scan_id: str, analyzed: int, opt_scores: list[int],
    router: ModelRouter | None = None, *, unparsed: int = 0,
) -> Scan:
    from app.services.exec_summary import generate_executive_summary

    async with SessionLocal() as db:
        scan = await db.get(Scan, scan_id)
        findings = (
            await db.execute(select(Finding).where(Finding.scan_id == scan_id))
        ).scalars().all()
        sec = [f for f in findings if f.engine == ENGINE_SECURITY]
        opt = [f for f in findings if f.engine == ENGINE_OPTIMIZATION]
        # Intentional stubs don't count against completeness.
        stubs = [
            f for f in findings
            if f.engine == ENGINE_STUB and f.status != STATUS_INTENTIONAL
        ]

        scan.segments_analyzed = analyzed
        scan.segments_unparsed = unparsed
        if unparsed:
            logger.warning(
                "scan %s finished with %d unparseable segment(s) — findings lost",
                scan_id, unparsed,
            )
        scan.security_score = scoring.security_score(sec)
        scan.optimization_score = scoring.optimization_score(opt_scores, opt)
        scan.completeness_score = scoring.completeness_score(stubs)
        scan.worst_severity = scoring.worst_severity(sec) or "clean"
        scan.status = SCAN_COMPLETED
        scan.completed_at = utcnow()
        # AI executive summary (real LLM aggregation when keys exist, else templated).
        scan.executive_summary = await generate_executive_summary(scan, findings, router)

        # Update the repository's latest-scan pointer (Modules 10/12).
        if scan.repository_id:
            from app.models.repository import Repository
            from app.services.repositories import mark_repo_scanned

            repo = await db.get(Repository, scan.repository_id)
            if repo is not None:
                await mark_repo_scanned(db, repo, scan)

        await db.commit()
        await db.refresh(scan)

    # Tag findings to plan goals, then auto-advance goals for this repo.
    if scan.repository_id:
        from app.services.goal_tracking import (
            advance_goals_for_repo,
            tag_findings_to_goals,
        )

        await tag_findings_to_goals(scan_id, scan.repository_id)
        await advance_goals_for_repo(scan.repository_id)

    # Post-scan GitHub actions (auto-issues + commit status), best-effort.
    if scan.source_type == "github":
        from app.services.github_post_scan import run_post_scan_github

        await run_post_scan_github(scan_id)
    return scan
