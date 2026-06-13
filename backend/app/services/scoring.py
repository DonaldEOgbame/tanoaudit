"""Severity-weighted scoring + worst-severity helpers.

Scores are 0–100 where higher is better/safer. Security score is driven down by
the count and severity of open security findings; optimization score is the mean
of per-segment optimization scores when available, else derived from findings.
"""
from __future__ import annotations

from app.models.scan import SEVERITY_ORDER

# How much each open security finding subtracts (before clamping).
_SEC_WEIGHTS = {"critical": 25, "high": 12, "medium": 5, "low": 2, "info": 0}


def security_score(findings: list) -> int:
    penalty = sum(_SEC_WEIGHTS.get((f.severity or "").lower(), 0) for f in findings)
    return max(0, 100 - penalty)


def optimization_score(segment_opt_scores: list[int], opt_findings: list) -> int:
    if segment_opt_scores:
        return round(sum(segment_opt_scores) / len(segment_opt_scores))
    # Fallback: derive from finding count if no per-segment scores.
    penalty = sum(_SEC_WEIGHTS.get((f.severity or "").lower(), 0) for f in opt_findings)
    return max(0, 100 - penalty)


# Per-stub completeness penalty by severity. Criticals penalize heavily, Info
# barely. 100 = no stubs; clamped at 0.
_STUB_WEIGHTS = {"critical": 30, "high": 15, "medium": 6, "low": 2, "info": 1}


def completeness_score(stub_findings: list) -> int:
    penalty = sum(_STUB_WEIGHTS.get((f.severity or "").lower(), 0) for f in stub_findings)
    return max(0, 100 - penalty)


def worst_severity(findings: list) -> str | None:
    worst = None
    worst_rank = -1
    for f in findings:
        rank = SEVERITY_ORDER.get((f.severity or "").lower(), -1)
        if rank > worst_rank:
            worst_rank, worst = rank, (f.severity or "").lower()
    return worst
