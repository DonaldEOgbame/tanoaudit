"""Severity-weighted scoring + worst-severity helpers.

Scores are 0–100 where higher is better/safer. They are RELATIVE TO CODEBASE SIZE:
the severity-weighted penalty from findings is normalized against the number of
analyzed segments, so a handful of issues in a large repo doesn't score the same
as the same issues in a tiny one. (Optimization is already size-relative — it's
the mean of per-segment scores.)

The displayed "security risk" the UI shows is 100 − security_score.
"""
from __future__ import annotations

from app.models.scan import SEVERITY_ORDER

# How much each finding contributes to the penalty, by severity.
_SEC_WEIGHTS = {"critical": 25, "high": 12, "medium": 5, "low": 2, "info": 0}
# Per-stub completeness penalty by severity. Criticals penalize most.
_STUB_WEIGHTS = {"critical": 30, "high": 15, "medium": 6, "low": 2, "info": 1}

# Penalty "budget" per analyzed segment. A repo of N segments tolerates roughly
# N * _PENALTY_PER_SEGMENT severity-points before the score floors at 0. Tuned so
# real repos land sensibly (serious issues still score low, but a few minor
# findings across a large codebase don't crater the score).
_PENALTY_PER_SEGMENT = 4.0
# Floor on the segment count so tiny repos (1–2 segments) don't swing wildly /
# divide toward zero on a single finding.
_MIN_SEGMENTS = 8


def _relative_score(penalty: float, segments: int) -> int:
    """0–100 score from a severity-weighted penalty normalized by codebase size."""
    budget = max(segments or 0, _MIN_SEGMENTS) * _PENALTY_PER_SEGMENT
    if budget <= 0:
        return 100
    return max(0, min(100, round(100 * (1 - penalty / budget))))


def security_score(findings: list, segments: int = 0) -> int:
    penalty = sum(_SEC_WEIGHTS.get((f.severity or "").lower(), 0) for f in findings)
    return _relative_score(penalty, segments)


def optimization_score(segment_opt_scores: list[int], opt_findings: list, segments: int = 0) -> int:
    if segment_opt_scores:
        return round(sum(segment_opt_scores) / len(segment_opt_scores))
    # Fallback: derive from finding count if no per-segment scores (size-relative).
    penalty = sum(_SEC_WEIGHTS.get((f.severity or "").lower(), 0) for f in opt_findings)
    return _relative_score(penalty, segments)


def completeness_score(stub_findings: list, segments: int = 0) -> int:
    penalty = sum(_STUB_WEIGHTS.get((f.severity or "").lower(), 0) for f in stub_findings)
    return _relative_score(penalty, segments)


def worst_severity(findings: list) -> str | None:
    worst = None
    worst_rank = -1
    for f in findings:
        rank = SEVERITY_ORDER.get((f.severity or "").lower(), -1)
        if rank > worst_rank:
            worst_rank, worst = rank, (f.severity or "").lower()
    return worst
