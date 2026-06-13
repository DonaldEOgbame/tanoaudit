"""Handoff token lifecycle + scope resolution + markdown rendering.

Tokens are 32-byte url-safe, bcrypt-hashed (raw never stored), single-use, 24h.
Validation re-hashes the candidate against stored hashes for the audit (cheap:
few tokens per audit).
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import as_aware, utcnow
from app.core.security import hash_password, verify_password
from app.models.handoff import (
    SCOPE_ALL,
    SCOPE_CRITICAL_HIGH,
    SCOPE_CUSTOM,
    SCOPE_OPTIMIZATIONS,
    SCOPE_SECURITY,
    SCOPE_STUBS,
    HandoffToken,
)
from app.models.scan import (
    ENGINE_OPTIMIZATION,
    ENGINE_SECURITY,
    ENGINE_STUB,
    Finding,
    Scan,
)

TOKEN_TTL_HOURS = 24
MAX_ACTIVE_TOKENS = 10


@dataclass
class GeneratedHandoff:
    token: HandoffToken
    raw_token: str
    url: str
    finding_count: int


def _new_raw_token() -> str:
    return secrets.token_urlsafe(32)


def handoff_url(audit_id: str, raw_token: str) -> str:
    return f"{settings.public_base_url}/handoff/{audit_id}?token={raw_token}"


async def select_findings(
    db: AsyncSession, audit_id: str, scope: str, finding_ids: list[str] | None
) -> list[Finding]:
    rows = (
        await db.execute(select(Finding).where(Finding.scan_id == audit_id))
    ).scalars().all()

    if scope == SCOPE_ALL:
        return rows
    if scope == SCOPE_SECURITY:
        return [f for f in rows if f.engine == ENGINE_SECURITY]
    if scope == SCOPE_OPTIMIZATIONS:
        return [f for f in rows if f.engine == ENGINE_OPTIMIZATION]
    if scope == SCOPE_STUBS:
        return [f for f in rows if f.engine == ENGINE_STUB]
    if scope == SCOPE_CRITICAL_HIGH:
        return [
            f for f in rows
            if f.engine == ENGINE_SECURITY and (f.severity or "").lower() in ("critical", "high")
        ]
    if scope == SCOPE_CUSTOM:
        ids = set(finding_ids or [])
        return [f for f in rows if f.id in ids or f.public_id in ids]
    return rows


async def active_token_count(db: AsyncSession, user_id: str) -> int:
    now = utcnow()
    rows = (
        await db.execute(
            select(HandoffToken).where(
                HandoffToken.user_id == user_id,
                HandoffToken.revoked == False,  # noqa: E712
                HandoffToken.used_at.is_(None),
            )
        )
    ).scalars().all()
    return sum(1 for t in rows if as_aware(t.expires_at) > now)


async def create_handoff(
    db: AsyncSession, scan: Scan, scope: str, finding_ids: list[str] | None
) -> GeneratedHandoff:
    raw = _new_raw_token()
    findings = await select_findings(db, scan.id, scope, finding_ids)
    token = HandoffToken(
        audit_id=scan.id, user_id=scan.user_id, scope=scope,
        finding_ids=finding_ids if scope == SCOPE_CUSTOM else None,
        token_hash=hash_password(raw),
        expires_at=utcnow() + timedelta(hours=TOKEN_TTL_HOURS),
    )
    db.add(token)
    await db.flush()
    return GeneratedHandoff(
        token=token, raw_token=raw,
        url=handoff_url(scan.id, raw), finding_count=len(findings),
    )


async def validate_token(
    db: AsyncSession, audit_id: str, raw_token: str
) -> HandoffToken | None:
    """Return the matching valid token or None. Does NOT consume it."""
    now = utcnow()
    candidates = (
        await db.execute(
            select(HandoffToken).where(HandoffToken.audit_id == audit_id)
        )
    ).scalars().all()
    for t in candidates:
        if t.revoked or t.used_at is not None or as_aware(t.expires_at) <= now:
            continue
        if verify_password(raw_token, t.token_hash):
            return t
    return None


def token_status(t: HandoffToken) -> str:
    if t.revoked:
        return "revoked"
    if t.used_at is not None:
        return "used"
    if as_aware(t.expires_at) <= utcnow():
        return "expired"
    return "active"


# ---- Markdown rendering -----------------------------------------------------
_PRIORITY = {
    "critical": "Fix immediately. This is remotely exploitable.",
    "high": "Fix soon. High-impact issue.",
    "medium": "Address in normal remediation.",
    "low": "Low priority.",
    "info": "Informational.",
}


def _render_stub_block(f: Finding) -> str:
    sev = (f.severity or "info").upper()
    cat = f.category or "Stub"
    lines = [
        f"### {f.public_id} | {sev} | {cat}",
        f"- **File:** {f.file}",
        f"- **Lines:** {f.line_start}–{f.line_end}",
        f"- **Category:** {f.stub_category or cat}",
    ]
    if f.risk_if_shipped:
        lines.append(f"- **Risk if shipped:** {f.risk_if_shipped}")
    lines.append("")
    if f.explanation:
        lines += ["**What's missing:**", f.explanation, ""]
    if f.code_snippet:
        lines += ["**Current code:**", "```", f.code_snippet, "```", ""]
    if f.completion_suggestion:
        lines += ["**Suggested implementation:**", "```", f.completion_suggestion, "```", ""]
    lines.append(f"**Priority:** {_PRIORITY.get((f.severity or '').lower(), 'Review.')}")
    lines += ["", "---", ""]
    return "\n".join(lines)


def render_handoff_markdown(scan: Scan, findings: list[Finding]) -> str:
    sec = [f for f in findings if f.engine == ENGINE_SECURITY]
    opt = [f for f in findings if f.engine == ENGINE_OPTIMIZATION]
    stub = [f for f in findings if f.engine == ENGINE_STUB]
    date = (scan.completed_at or scan.created_at)
    date_str = date.strftime("%Y-%m-%d") if date else "—"

    head = [
        "# Akira AI Security Audit Handoff",
        f"## Repository: {scan.repo or scan.id}",
        f"## Branch: {scan.branch or '—'} @ {scan.commit or '—'}",
        f"## Scan date: {date_str}",
        f"## Findings included: {len(findings)} ({len(sec)} security, "
        f"{len(opt)} optimizations, {len(stub)} stubs)",
        "",
        "---",
        "",
    ]

    blocks = []
    for f in findings:
        if f.engine == ENGINE_STUB:
            blocks.append(_render_stub_block(f))
            continue
        sev = (f.severity or "info").upper()
        cat = f.category or "Finding"
        sub = f" → {f.subcategory}" if f.subcategory else ""
        lines = [
            f"### {f.public_id} | {sev} | {cat}",
            f"- **File:** {f.file}",
            f"- **Lines:** {f.line_start}–{f.line_end}",
            f"- **Category:** {cat}{sub}",
        ]
        if f.cwe_id:
            lines.append(f"- **CWE:** {f.cwe_id}")
        if f.owasp_ref:
            lines.append(f"- **OWASP:** {f.owasp_ref}")
        lines.append("")
        lines.append("**Description:**")
        lines.append(f.explanation or "(no description)")
        lines.append("")
        if f.code_snippet:
            lines += ["**Current code:**", "```", f.code_snippet, "```", ""]
        if f.fix_snippet or f.fix_summary:
            lines.append("**Suggested fix:**")
            if f.fix_summary:
                lines.append(f.fix_summary)
            if f.fix_snippet:
                lines += ["```", f.fix_snippet, "```"]
            lines.append("")
        lines.append(f"**Priority:** {_PRIORITY.get((f.severity or '').lower(), 'Review.')}")
        lines += ["", "---", ""]
        blocks.append("\n".join(lines))

    return "\n".join(head) + "\n".join(blocks)
