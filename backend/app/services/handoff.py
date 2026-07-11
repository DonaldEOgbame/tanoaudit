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
from app.models.attack_path import AttackPath
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


def _dedup(findings: list[Finding]) -> list[Finding]:
    """Collapse duplicate findings (same logical vuln persisted more than once).

    Two rows that share engine, location, and identity (public_id / cwe /
    subcategory) describe the same issue; emitting both spams the handoff and
    inflates finding_count. Keeps the first occurrence and preserves order.
    """
    seen: set[tuple] = set()
    out: list[Finding] = []
    for f in findings:
        key = (
            f.engine, f.public_id, f.file, f.line_start, f.line_end,
            f.cwe_id, f.subcategory,
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(f)
    return out


async def select_findings(
    db: AsyncSession, audit_id: str, scope: str, finding_ids: list[str] | None
) -> list[Finding]:
    rows = _dedup(
        (
            await db.execute(select(Finding).where(Finding.scan_id == audit_id))
        ).scalars().all()
    )

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


async def select_attack_paths(
    db: AsyncSession, audit_id: str, findings: list[Finding]
) -> list[AttackPath]:
    """Attack chains relevant to the findings being handed off.

    A chain is included when at least one of its constituent findings (referenced
    by public id) is in the selected set. So security/all/critical-high handoffs
    carry their chains, while an optimizations-only or stubs-only handoff — which
    selects no security findings — carries none, since chains are security-derived.
    """
    selected_ids = {f.public_id for f in findings if f.public_id}
    if not selected_ids:
        return []
    paths = (
        await db.execute(select(AttackPath).where(AttackPath.scan_id == audit_id))
    ).scalars().all()
    return [
        p for p in paths
        if selected_ids.intersection(p.finding_public_ids or [])
    ]


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
    if f.confidence:
        lines.append(f"- **Confidence:** {f.confidence}")
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


def _render_attack_path_block(p: AttackPath) -> str:
    sev = (p.severity or "high").upper()
    refs = ", ".join(p.finding_public_ids or []) or "—"
    lines = [
        f"### {p.public_id} | {sev} | {p.name}",
        f"- **Tier:** {p.tier}",
        f"- **Chained findings:** {refs}",
    ]
    if p.cwe_id:
        lines.append(f"- **CWE:** {p.cwe_id}")
    lines.append("")
    steps = p.steps or []
    if steps:
        lines.append("**Exploitation steps:**")
        for i, step in enumerate(steps, 1):
            text = step.get("text") if isinstance(step, dict) else str(step)
            lines.append(f"{i}. {text}")
        lines.append("")
    if p.impact:
        lines += ["**Impact if chained:**", p.impact, ""]
    if p.real_world:
        lines += ["**Real-world precedent:**", p.real_world, ""]
    if p.remediation:
        lines += ["**Break the chain:**", p.remediation, ""]
    lines += ["", "---", ""]
    return "\n".join(lines)


def render_handoff_markdown(
    scan: Scan, findings: list[Finding], attack_paths: list[AttackPath] | None = None
) -> str:
    attack_paths = attack_paths or []
    sec = [f for f in findings if f.engine == ENGINE_SECURITY]
    opt = [f for f in findings if f.engine == ENGINE_OPTIMIZATION]
    stub = [f for f in findings if f.engine == ENGINE_STUB]
    date = (scan.completed_at or scan.created_at)
    date_str = date.strftime("%Y-%m-%d") if date else "—"

    chain_note = f", {len(attack_paths)} attack chains" if attack_paths else ""
    head = [
        "# TanoAudit Security Audit Handoff",
        f"## Repository: {scan.repo or scan.id}",
        f"## Branch: {scan.branch or '—'} @ {scan.commit or '—'}",
        f"## Scan date: {date_str}",
        f"## Findings included: {len(findings)} ({len(sec)} security, "
        f"{len(opt)} optimizations, {len(stub)} stubs{chain_note})",
        "",
        "---",
        "",
    ]

    # Attack chains first: they explain how the individual findings below combine
    # into a real exploit, so Claude sees the big picture before the line items.
    if attack_paths:
        head += [
            "## Attack Chains",
            "These are *combinations* of the findings below that form a real "
            "exploitation path. Breaking any one link defeats the chain.",
            "",
        ]
        for p in attack_paths:
            head.append(_render_attack_path_block(p))

    blocks = []
    # Group by engine so the body matches the header summary ordering.
    for f in [*sec, *opt, *stub]:
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
        if f.confidence:
            lines.append(f"- **Confidence:** {f.confidence}")
        if f.cwe_id:
            lines.append(f"- **CWE:** {f.cwe_id}")
        if f.owasp_ref:
            lines.append(f"- **OWASP:** {f.owasp_ref}")
        lines.append("")
        lines.append("**Description:**")
        lines.append(f.explanation or "(no description)")
        lines.append("")
        if f.impact:
            lines += ["**Impact:**", f.impact, ""]
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
