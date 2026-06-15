"""AI Executive Summary — the final aggregation call after a scan.

Covers both engines, names priority files, and estimates remediation effort.
Falls back to a templated summary when no provider keys are configured, so a
scan always ends with a useful summary served as the first chat message.
"""
from __future__ import annotations

from app.models.scan import ENGINE_OPTIMIZATION, ENGINE_SECURITY, ENGINE_STUB, Finding, Scan
from app.services.router_model import ModelRouter

_PROMPT = """Write a concise executive summary (4-7 sentences) of this code audit
for an engineering lead. Cover all three engines — security, optimization, and
completeness (stubs/placeholders/incomplete implementations). Call out any
critical auth stubs or business-logic stubs that would create holes if shipped.
Name the 2-3 highest-priority files, and give a rough remediation effort
estimate. Plain prose, no markdown headers.

IMPORTANT — metrics and their direction (use EXACTLY these numbers; do not invent
or round to different values):
- Security RISK: {risk}/100 — HIGHER IS WORSE (more risk). Refer to security as
  "risk" (e.g. "security risk {risk}/100"), never as a "security score".
- Optimization: {opt}/100 — HIGHER IS BETTER (better optimized).
- Completeness: {comp}/100 — HIGHER IS BETTER (more complete despite stubs).
Do not cite any "/100" figure other than these exact ones.

Repository: {repo} (branch {branch} @ {commit})
Security risk: {risk}/100 · Optimization: {opt}/100 · Completeness: {comp}/100
Files: {files} · Findings: {n_sec} security, {n_opt} optimization, {n_stub} stubs

Top findings:
{top}
"""


def _templated(
    scan: Scan, sec: list[Finding], opt: list[Finding], stub: list[Finding]
) -> str:
    crit = [f for f in sec if (f.severity or "").lower() == "critical"]
    files = sorted({f.file for f in crit})[:3]
    files_str = ", ".join(files) if files else "the flagged files"
    crit_stubs = [f for f in stub if (f.severity or "").lower() == "critical"]
    stub_str = (
        f" The completeness analysis found {len(stub)} stub(s)/placeholder(s)"
        + (
            f", including {len(crit_stubs)} critical stub(s) that would create holes if shipped."
            if crit_stubs else "."
        )
        if stub else ""
    )
    risk = max(0, 100 - (scan.security_score or 0))
    return (
        f"Scan complete for {scan.repo or scan.id}: {len(sec)} security findings "
        f"({len(crit)} Critical) and {len(opt)} optimization opportunities across "
        f"{scan.files} files. Security risk {risk}/100, optimization "
        f"{scan.optimization_score}/100, completeness {scan.completeness_score}/100."
        f"{stub_str} Prioritize {files_str}. Estimated remediation: "
        f"{max(1, len(crit))}–{max(2, len(crit) + 1)} engineer-days for the Criticals and Highs."
    )


def _top_lines(findings: list[Finding], limit: int = 12) -> str:
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    ranked = sorted(findings, key=lambda f: order.get((f.severity or "").lower(), 5))
    return "\n".join(
        f"- [{(f.severity or '').upper()}] {f.public_id} {f.category or ''} "
        f"in {f.file}: {(f.explanation or '')[:120]}"
        for f in ranked[:limit]
    )


async def generate_executive_summary(
    scan: Scan, findings: list[Finding], router: ModelRouter | None
) -> str:
    sec = [f for f in findings if f.engine == ENGINE_SECURITY]
    opt = [f for f in findings if f.engine == ENGINE_OPTIMIZATION]
    stub = [f for f in findings if f.engine == ENGINE_STUB]

    if router is None or not router.has_any_key():
        return _templated(scan, sec, opt, stub)

    prompt = _PROMPT.format(
        repo=scan.repo or scan.id, branch=scan.branch or "—", commit=scan.commit or "—",
        risk=max(0, 100 - (scan.security_score or 0)), opt=scan.optimization_score,
        comp=scan.completeness_score, files=scan.files,
        n_sec=len(sec), n_opt=len(opt), n_stub=len(stub), top=_top_lines(findings),
    )
    text = await router.complete(prompt, response_json=False)
    return text.strip() or _templated(scan, sec, opt, stub)
