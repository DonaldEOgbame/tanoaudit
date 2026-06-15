"""MCP tool implementations + definitions.

Two tools are exposed:
- fetch_audit_handoff: parse a handoff URL, validate the token, return the
  audit markdown. (Token-in-URL auth; consumes the handoff like the REST GET.)
- mark_finding_fixed: mark a finding fixed after a fix is applied; requires a
  valid (used, not revoked) handoff token for the audit that included it.
"""
from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from sqlalchemy import select

from app.core.database import SessionLocal, utcnow
from app.models.handoff import (
    EVT_CONSUMED,
    EVT_FIXED_VIA_CLAUDE,
    HandoffEvent,
    HandoffToken,
)
from app.models.scan import STATUS_FIXED, Finding, Scan
from app.services import handoff as ho

TOOL_DEFINITIONS = [
    {
        "name": "fetch_audit_handoff",
        "description": (
            "Fetch a structured security audit from Akira AI containing "
            "vulnerabilities and optimization findings with locations, "
            "descriptions, and suggested fixes."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "audit_url": {
                    "type": "string",
                    "description": "The full Akira AI handoff URL",
                }
            },
            "required": ["audit_url"],
        },
    },
    {
        "name": "mark_finding_fixed",
        "description": "Mark a specific finding as fixed after applying the remediation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "audit_id": {"type": "string"},
                "finding_id": {"type": "string"},
            },
            "required": ["audit_id", "finding_id"],
        },
    },
]


def _parse_handoff_url(url: str) -> tuple[str | None, str | None]:
    """Extract (audit_id, token) from a handoff URL like
    https://akira.ai/handoff/{audit_id}?token=..."""
    try:
        parsed = urlparse(url)
        token = (parse_qs(parsed.query).get("token") or [None])[0]
        parts = [p for p in parsed.path.split("/") if p]
        audit_id = None
        if "handoff" in parts:
            i = parts.index("handoff")
            if i + 1 < len(parts):
                audit_id = parts[i + 1]
        return audit_id, token
    except Exception:
        return None, None


async def tool_fetch_audit_handoff(args: dict) -> str:
    """Return audit markdown as a text block, or a clear error string."""
    url = (args or {}).get("audit_url", "")
    audit_id, token = _parse_handoff_url(url)
    if not audit_id or not token:
        return "Error: could not parse audit_url. Expected an Akira AI handoff URL."

    async with SessionLocal() as db:
        valid = await ho.validate_token(db, audit_id, token)
        if valid is None:
            return "Error: Invalid or expired handoff link."
        scan = await db.get(Scan, audit_id)
        if scan is None:
            return "Error: Invalid or expired handoff link."
        findings = await ho.select_findings(db, audit_id, valid.scope, valid.finding_ids)
        valid.used_at = utcnow()
        db.add(HandoffEvent(
            user_id=valid.user_id, audit_id=audit_id, kind=EVT_CONSUMED,
            detail={"via": "mcp", "finding_count": len(findings)},
        ))
        await db.commit()
        return ho.render_handoff_markdown(scan, findings)


async def _finding_covered_by_handoff(db, audit_id: str, finding: Finding) -> HandoffToken | None:
    """A consumed (used, not revoked) handoff for this audit that included the finding."""
    tokens = (
        await db.execute(
            select(HandoffToken).where(
                HandoffToken.audit_id == audit_id,
                HandoffToken.revoked == False,  # noqa: E712
            )
        )
    ).scalars().all()
    for t in tokens:
        if t.used_at is None:
            continue
        covered = await ho.select_findings(db, audit_id, t.scope, t.finding_ids)
        if any(c.id == finding.id for c in covered):
            return t
    return None


async def tool_mark_finding_fixed(args: dict) -> str:
    audit_id = (args or {}).get("audit_id", "")
    finding_id = (args or {}).get("finding_id", "")
    if not audit_id or not finding_id:
        return "Error: audit_id and finding_id are required."

    async with SessionLocal() as db:
        # Allow lookup by internal id or public id.
        finding = await db.get(Finding, finding_id)
        if finding is None:
            # first(): duplicate rows can share a public_id, so avoid
            # scalar_one_or_none() which raises MultipleResultsFound.
            finding = (
                await db.execute(
                    select(Finding)
                    .where(
                        Finding.scan_id == audit_id, Finding.public_id == finding_id
                    )
                    .order_by(Finding.id)
                )
            ).scalars().first()
        if finding is None or finding.scan_id != audit_id:
            return "Error: finding not found for this audit."

        token = await _finding_covered_by_handoff(db, audit_id, finding)
        if token is None:
            return "Error: no valid handoff covers this finding. Fetch the handoff first."

        finding.status = STATUS_FIXED
        finding.fixed_via = "claude_code"
        finding.fixed_at = utcnow()
        finding.handoff_status = "handed_off"
        db.add(HandoffEvent(
            user_id=token.user_id, audit_id=audit_id, kind=EVT_FIXED_VIA_CLAUDE,
            detail={"finding_id": finding.public_id},
        ))
        await db.commit()
        public_id = finding.public_id
        scan_id = finding.scan_id

    # Push a live WS event so an open report updates the badge.
    from app.services import scan_events as ev
    await ev.bus.publish(scan_id, "finding_fixed", {
        "finding_id": public_id, "fixed_via": "claude_code",
    })

    from app.models.notification import N_FIXED_VIA_CLAUDE
    from app.services.notifications import notify
    await notify(
        token.user_id, N_FIXED_VIA_CLAUDE, f"{public_id} fixed via Claude Code",
        "A finding was marked fixed after remediation by Claude Code.",
        link={"scan_id": scan_id},
    )
    return f"Marked {public_id} as fixed (via Claude Code)."


async def call_tool(name: str, args: dict) -> str:
    if name == "fetch_audit_handoff":
        return await tool_fetch_audit_handoff(args)
    if name == "mark_finding_fixed":
        return await tool_mark_finding_fixed(args)
    return f"Error: unknown tool '{name}'."
