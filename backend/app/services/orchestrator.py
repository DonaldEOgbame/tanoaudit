"""Scan orchestrator: drives a scan from queued -> completed.

Module 3 is single-model and synchronous within a background task. Module 4
replaces `default_complete` with the multi-model router; Module 5 layers in the
WebSocket progress events at the marked points.
"""
from __future__ import annotations

import asyncio
import logging
import re
import shutil
import uuid

from sqlalchemy import select, update

from app.core.config import settings
from app.core.database import SessionLocal, utcnow
from app.models.scan import (
    ENGINE_OPTIMIZATION,
    ENGINE_SECURITY,
    ENGINE_STUB,
    SCAN_CANCELLED,
    SCAN_CLAIMED,
    SCAN_COMPLETED,
    SCAN_FAILED,
    SCAN_QUEUED,
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

logger = logging.getLogger("tanoaudit.analysis")


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


# An empty-but-valid single-segment analysis (the per-segment result shape).
_EMPTY_RESULT = (
    '{"security": [], "optimizations": [], "stubs": [], '
    '"segment_scores": {"security_risk": 0, "optimization_score": 100, '
    '"completeness_score": 100}}'
)
# Matches the per-segment headers build_batch_prompt emits ("### SEGMENT 0 — ...").
_SEGMENT_HEADER_RE = re.compile(r"^### SEGMENT (\d+) ", re.MULTILINE)


async def default_complete(prompt: str, model_hint: str | None) -> str:
    """Placeholder provider. Returns an empty-but-valid analysis.

    Replaced by the real multi-model router in Module 4. Kept valid so the
    pipeline runs end-to-end even with no provider keys configured.

    Critically, this must honor *both* contracts the analyzer uses: a single
    segment expects one flat result object, but a batch prompt
    (`build_batch_prompt`) expects ``{"results": {"0": {...}, ...}}`` keyed by
    index. Returning the flat object for a batch parses to all-None, which forces
    analyze_batch to split the whole batch down to single segments one call at a
    time — defeating batching entirely and flooding logs with "segment dropped"
    warnings. So when we detect batch segment headers, emit the indexed shape with
    an empty result per segment.
    """
    indices = [int(m) for m in _SEGMENT_HEADER_RE.findall(prompt)]
    if indices:
        n = max(indices) + 1
        results = ",".join(f'"{i}": {_EMPTY_RESULT}' for i in range(n))
        return f'{{"results": {{{results}}}}}'
    return _EMPTY_RESULT


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


async def _ignore_globs_for_scan(db, scan: Scan) -> list[str]:
    """The user's configured ignore_paths globs for a github scan, if any.

    Non-github scans (URL/ZIP) have no connection settings, so nothing is
    ignored beyond the built-in excludes.
    """
    if scan.source_type != "github":
        return []
    from app.models.github import GitHubConnection

    conn = (
        await db.execute(
            select(GitHubConnection).where(GitHubConnection.user_id == scan.user_id)
        )
    ).scalar_one_or_none()
    if conn is None:
        return []
    return list((conn.triggers or {}).get("ignore_paths") or [])


async def _scan_dependencies(scan_id: str, workdir: str) -> None:
    """Parse + enrich dependency manifests and persist ScanDependency rows.
    Fully guarded: any failure is logged and swallowed so the code scan proceeds."""
    try:
        from app.services.dependency_scan import analyze_dependencies
        from app.models.dependency import ScanDependency

        deps = await analyze_dependencies(workdir)
        if not deps:
            return
        async with SessionLocal() as db:
            for d in deps:
                db.add(ScanDependency(scan_id=scan_id, **d))
            await db.commit()
        logger.info("scan %s: stored %d dependencies", scan_id, len(deps))
    except Exception:  # noqa: BLE001 — dependency scan is non-critical
        logger.exception("dependency scan failed for %s", scan_id)


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
        # Atomically transition queued/claimed -> running. The API runs a scan as
        # a BackgroundTask while the maintenance loop may also claim it; this
        # guarded UPDATE lets exactly one win (rowcount 0 -> someone else is
        # already running it, so bail without double-running).
        res = await db.execute(
            update(Scan)
            .where(
                Scan.id == scan_id,
                Scan.status.in_([SCAN_QUEUED, SCAN_CLAIMED]),
            )
            .values(
                status=SCAN_RUNNING,
                started_at=utcnow(),
                correlation_id=scan.correlation_id or str(uuid.uuid4()),
            )
        )
        await db.commit()
        if not res.rowcount:
            return

    # Build the multi-model router from the SERVER's provider keys + the scan's
    # selected TanoAudit tiers, unless a provider callable was injected (tests). With
    # no server key configured (deploy misconfig), fall back to the empty-result
    # placeholder so the scan still completes rather than erroring.
    router: ModelRouter | None = None
    if complete is None:
        router = await build_router_for_scan(scan)
        complete = router.complete if router.has_any_key() else default_complete

    try:
        if workdir is None:
            workdir, commit = await materialize_source_safe(scan_id)
        else:
            commit = None

        # For github scans, honor the connection's ignore_paths globs so files
        # the user excluded (e.g. dist/**, *.test.js) are never analyzed.
        ignore_globs = await _ignore_globs_for_scan(db, scan)
        files = ingestion.walk_source(workdir, ignore_globs=ignore_globs)
        # PR-diff scoping: restrict to changed paths when path_filters is set.
        if scan.path_filters:
            wanted = set(scan.path_filters)
            files = [f for f in files if f.rel_path in wanted]
        segments = segment_files(files)

        # Scan-profile coverage cap: the profile (stored as `depth`) bounds how
        # many segments we analyze, so Fast/Balanced/Thorough trade cost for
        # coverage. Larger repos are truncated to the cap; the surplus is
        # reported as unparsed-but-skipped via segments_unparsed below.
        cap = _DEPTH_LIMITS.get(scan.depth, _DEPTH_LIMITS["deep"])
        skipped_for_cap = max(0, len(segments) - cap)
        if skipped_for_cap:
            logger.info(
                "scan %s: profile %r caps at %d segments; truncating %d of %d",
                scan_id, scan.depth, cap, skipped_for_cap, len(segments),
            )
            segments = segments[:cap]

        # Dependency analysis: parse manifests from the working tree and enrich
        # with latest versions + OSV advisories. Best-effort — failures here must
        # never abort the code scan, so it's fully guarded.
        await _scan_dependencies(scan_id, workdir)
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
        include_optimization = scan.include_optimization  # captured before per-batch sessions

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

        # Run batches concurrently (bounded) — the LLM calls dominate wall-clock
        # and are independent. Results are still *processed* in batch order so
        # events/findings/progress stay deterministic; only the model calls
        # overlap. concurrency=1 reproduces the old sequential behavior.
        concurrency = max(1, settings.analysis_concurrency)
        sem = asyncio.Semaphore(concurrency)

        async def _run_batch(batch):
            async with sem:
                # Pause/cancel is checked here so a paused scan stops launching
                # new model calls (already-running ones finish).
                await _await_resume_or_cancel(scan_id)
                return await analyze_batch(
                    batch, complete,
                    include_optimization=include_optimization,
                    custom_vulns=custom_targets,
                    suppressions=suppressions,
                )

        # Schedule all batches; they execute up to `concurrency` at a time. We do
        # NOT hold a DB session open across this (a long-lived transaction would
        # lock the DB for the whole scan); each batch's writes use a short session.
        tasks = [asyncio.create_task(_run_batch(b)) for b in batches]
        idx = 0
        try:
            for batch, task in zip(batches, tasks):
                batch_results = await task  # in submission order
                await _drain_router_events(scan_id, router)
                async with SessionLocal() as db:
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
        finally:
            # If we stop early (cancel/error), don't leave model calls running.
            for t in tasks:
                if not t.done():
                    t.cancel()

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
        # Post-completion side-effects must never flip a finished scan to FAILED.
        # The scan is already finalized and persisted above; a notification or
        # GitHub-API hiccup here is not a scan failure.
        try:
            await _emit_scan_notifications(scan_id)
        except Exception:  # noqa: BLE001
            logger.exception("scan %s: notifications failed (non-fatal)", scan_id)
        try:
            await _emit_github_outcomes(scan_id)
        except Exception:  # noqa: BLE001
            logger.exception("scan %s: github outcomes failed (non-fatal)", scan_id)
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
        sec_risk = max(0, 100 - (scan.security_score or 0))

    await notify(
        user_id, N_SCAN_COMPLETE, f"Scan complete: {repo_name}",
        f"Security risk {sec_risk}/100 · {n_crit} critical finding(s).",
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


_SEVERITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}


async def _emit_github_outcomes(scan_id: str) -> None:
    """Post scan results back to GitHub: commit status and (optionally)
    auto-created issues. Driven entirely by the user's connection settings, and
    only for scans actually linked to a GitHub repo. Best-effort — a GitHub
    outage must never fail an otherwise-successful scan."""
    from app.core.security import decrypt_secret
    from app.models.github import GitHubConnection
    from app.services import github_client as gh

    async with SessionLocal() as db:
        scan = await db.get(Scan, scan_id)
        if scan is None or scan.source_type != "github" or not scan.repo:
            return
        conn = (
            await db.execute(
                select(GitHubConnection).where(GitHubConnection.user_id == scan.user_id)
            )
        ).scalar_one_or_none()
        if conn is None:
            return
        findings = (
            await db.execute(
                select(Finding).where(
                    Finding.scan_id == scan_id, Finding.engine == ENGINE_SECURITY
                )
            )
        ).scalars().all()
        repo = scan.repo
        sha = scan.commit
        status_check = conn.status_check or {}
        issue_settings = conn.issue_settings or {}
        try:
            token = decrypt_secret(conn.encrypted_token)
        except ValueError:
            return

    n_crit = sum(1 for f in findings if (f.severity or "").lower() == "critical")

    # --- Commit status -------------------------------------------------------
    if status_check.get("post_commit_status") and sha:
        state = "failure" if n_crit else "success"
        desc = (f"{n_crit} critical finding(s)" if n_crit
                else "No critical findings")
        try:
            await gh.post_commit_status(
                token, repo, sha, state,
                status_check.get("check_name") or "TanoAudit security check", desc,
            )
        except Exception:  # noqa: BLE001 — best-effort
            logger.exception("commit status post failed for scan %s", scan_id)

    # --- Auto-create issues --------------------------------------------------
    if issue_settings.get("auto_create"):
        threshold = (issue_settings.get("severity_threshold") or "high").lower()
        cutoff = _SEVERITY_RANK.get(threshold, 3)
        template = issue_settings.get("template", "{public_id}: {explanation}")
        base_labels = list(issue_settings.get("labels") or [])
        label_map = issue_settings.get("label_mapping") or {}
        assignee = issue_settings.get("assignee")

        to_file = [
            f for f in findings
            if _SEVERITY_RANK.get((f.severity or "").lower(), 0) >= cutoff
            and not f.github_issue_url
        ]
        async with SessionLocal() as db:
            for f in to_file:
                title, body = _render_issue(f, template)
                labels = list(base_labels)
                mapped = label_map.get((f.severity or "").lower())
                if mapped:
                    labels.append(mapped)
                try:
                    issue = await gh.create_issue(
                        token, repo, title, body, labels=labels, assignee=assignee
                    )
                except Exception:  # noqa: BLE001 — best-effort
                    logger.exception("issue creation failed for finding %s", f.id)
                    continue
                row = await db.get(Finding, f.id)
                if row is not None:
                    row.github_issue_url = issue.get("html_url")
            await db.commit()


def _render_issue(finding: Finding, template: str) -> tuple[str, str]:
    """Render a GitHub issue (title, body) from a finding. Mirrors the manual
    per-finding renderer in the GitHub API router."""
    fields = {
        "public_id": finding.public_id, "severity": (finding.severity or "").upper(),
        "category": finding.category or "", "file": finding.file,
        "line_start": finding.line_start, "line_end": finding.line_end,
        "cwe_id": finding.cwe_id or "—", "owasp_ref": finding.owasp_ref or "—",
        "explanation": finding.explanation or "", "fix_summary": finding.fix_summary or "",
    }
    title = f"[{fields['severity']}] {finding.public_id}: {finding.category or 'Finding'}"
    try:
        body = template.format(**fields)
    except (KeyError, IndexError):
        body = f"{finding.public_id}: {finding.explanation or ''}"
    return title, body


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
        # Scores are normalized by codebase size (analyzed segments).
        seg_n = scan.segment_total or 0
        scan.security_score = scoring.security_score(sec, seg_n)
        scan.optimization_score = scoring.optimization_score(opt_scores, opt, seg_n)
        scan.completeness_score = scoring.completeness_score(stubs, seg_n)
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

    # Correlate findings into attack chains (vulnerability combinations that form
    # real hacks). Runs after all findings exist; best-effort. `router` carries
    # the scan's provider keys for the hybrid LLM pass.
    from app.services.attack_chains import correlate_attack_chains

    await correlate_attack_chains(scan_id, list(findings), router)

    # Grow the Learning Hub: ensure every finding category in this scan has a
    # class, generating new ones for novel vuln types. Best-effort.
    from app.services.learning_autogen import ensure_classes_for_scan

    await ensure_classes_for_scan(scan_id)

    # Post-scan GitHub actions (auto-issues + commit status), best-effort.
    if scan.source_type == "github":
        from app.services.github_post_scan import run_post_scan_github

        await run_post_scan_github(scan_id)
    return scan
