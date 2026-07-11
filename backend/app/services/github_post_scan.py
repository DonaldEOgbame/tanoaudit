"""Post-scan GitHub actions: auto-create issues + post commit status.

Runs after a github-sourced scan finalizes, if the user has a connection and the
relevant settings enabled. Network failures are swallowed (logged) so they never
fail the scan.
"""
from __future__ import annotations

import logging

import httpx
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import decrypt_secret
from app.models.github import GitHubConnection, WebhookDelivery
from app.models.scan import ENGINE_SECURITY, Finding, Scan
from app.services import github_client as gh

logger = logging.getLogger(__name__)

_SEV_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}


def _render_issue(finding: Finding, template: str) -> tuple[str, str]:
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


def _record(db, scan, event: str, status: int, detail: str) -> None:
    """Log a post-scan GitHub action to the webhook-deliveries feed so the user
    sees outcomes (and failures) in the Integrations UI, not just server logs."""
    db.add(WebhookDelivery(
        user_id=scan.user_id, event=event, status=status,
        repo=scan.repo, detail=detail[:1000], triggered_scan_id=scan.id,
    ))


async def run_post_scan_github(scan_id: str) -> None:
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
        try:
            token = decrypt_secret(conn.encrypted_token)
        except ValueError:
            return

        findings = (
            await db.execute(select(Finding).where(Finding.scan_id == scan_id))
        ).scalars().all()
        sec = [f for f in findings if f.engine == ENGINE_SECURITY]

        await _maybe_create_issues(db, token, scan, sec, conn)
        await _maybe_post_status(db, token, scan, sec, conn)
        await db.commit()


async def _maybe_create_issues(db, token, scan, sec_findings, conn) -> None:
    s = conn.issue_settings or {}
    if not s.get("auto_create"):
        return
    threshold = _SEV_RANK.get(s.get("severity_threshold", "high"), 3)
    template = s.get("template", "{public_id}: {explanation}")
    base_labels = list(s.get("labels", []))
    mapping = s.get("label_mapping") or {}

    created = 0
    failed = 0
    last_error = ""
    for f in sec_findings:
        if f.github_issue_url:  # already filed
            continue
        if _SEV_RANK.get((f.severity or "").lower(), 0) < threshold:
            continue
        title, body = _render_issue(f, template)
        labels = base_labels + ([mapping[f.severity.lower()]] if mapping.get((f.severity or "").lower()) else [])
        try:
            issue = await gh.create_issue(
                token, scan.repo, title, body, labels=labels, assignee=s.get("assignee")
            )
            f.github_issue_url = issue.get("html_url")
            created += 1
        except httpx.HTTPError as exc:
            # Don't fail the scan over one issue, but make the failure visible —
            # a silent no-op here is what makes "auto-create issues" look broken
            # (usually a missing token scope or a 403/422 from GitHub).
            failed += 1
            last_error = str(exc)
            logger.warning(
                "auto-create issue failed for %s in %s: %s",
                f.public_id, scan.repo, exc,
            )
            continue

    if failed:
        _record(db, scan, "issues", 502,
                f"Created {created} issue(s); {failed} failed — {last_error}")
    elif created:
        _record(db, scan, "issues", 200, f"Created {created} GitHub issue(s)")


async def _maybe_post_status(db, token, scan, sec_findings, conn) -> None:
    sc = conn.status_check or {}
    if not sc.get("post_commit_status") or not scan.commit:
        return
    criticals = [f for f in sec_findings if (f.severity or "").lower() == "critical"]
    block = sc.get("block_merge_on_critical", False)
    if criticals and block:
        state, desc = "failure", f"{len(criticals)} critical finding(s) — merge blocked"
    elif criticals:
        state, desc = "success", f"{len(criticals)} critical finding(s) found"
    else:
        state, desc = "success", f"Security score {scan.security_score}/100"
    try:
        await gh.post_commit_status(
            token, scan.repo, scan.commit, state,
            sc.get("check_name", "TanoAudit security check"), desc,
        )
        _record(db, scan, "status", 200, f"Commit status posted: {state} — {desc}")
    except httpx.HTTPError as exc:
        logger.warning(
            "post commit status failed for %s @ %s: %s",
            scan.repo, scan.commit, exc,
        )
        _record(db, scan, "status", 502, f"Commit status failed — {exc}")
