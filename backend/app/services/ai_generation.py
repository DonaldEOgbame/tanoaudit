"""AI-generation composition analysis, derived from a scan's real findings.

This is a heuristic signal — not a ground-truth classifier. It surfaces the
findings that most often indicate machine-generated code (stub/AI-Generated
markers, missing error handling, permissive CORS boilerplate, unused imports,
copy-pasted validation, generic stubs) and estimates an "AI composition" share
from the density of those signals across the analyzed files.

Everything is computed from data already stored on Finding rows, so it requires
no extra model calls and is always consistent with the report's findings.
"""
from __future__ import annotations

import re

from app.models.scan import Finding

# Each pattern: a label + matcher over (category, subcategory, explanation).
# These map real finding categories to the AI-generation signatures the UI shows.
_PATTERNS = [
    ("Incomplete / AI-generated stubs",
     "Functions left unimplemented or flagged as AI-generated.",
     lambda t: any(k in t for k in ("stub", "placeholder", "incomplete", "ai-generated", "todo", "not implemented", "notimplemented"))),
    ("Permissive CORS boilerplate",
     "Wide-open CORS copied from a snippet (e.g. origin: true / *).",
     lambda t: "cors" in t or "cross-origin" in t),
    ("Unused / hallucinated imports",
     "Imported modules that are never referenced.",
     lambda t: "unused" in t and "import" in t or "dead code" in t or "unreachable" in t),
    ("Missing error handling",
     "Awaited calls with no try/catch on the happy path only.",
     lambda t: "error handling" in t or "unhandled" in t or "no try" in t or "missing catch" in t),
    ("Copy-pasted validation",
     "Duplicated or incorrect validation logic (e.g. regexes).",
     lambda t: "validation" in t or "regex" in t or "sanitiz" in t),
    ("Hardcoded values",
     "Inlined secrets, URLs, or config that a human would externalize.",
     lambda t: "hardcoded" in t or "hard-coded" in t or "secret" in t and "hardcod" in t),
]

_AI_STUB_CATEGORIES = {"ai-generated", "placeholder", "incomplete", "stub"}


def _text(f: Finding) -> str:
    parts = [
        (f.category or ""),
        (f.subcategory or ""),
        (f.stub_category or ""),
        (f.explanation or "")[:200],
    ]
    return " ".join(parts).lower()


def analyze(findings: list[Finding], files: int) -> dict:
    """Compute the AI-generation composition payload from real findings."""
    n = len(findings)
    texts = [_text(f) for f in findings]

    # Pattern counts over real findings.
    patterns = []
    matched_idx: set[int] = set()
    for label, desc, match in _PATTERNS:
        count = 0
        for i, t in enumerate(texts):
            if match(t):
                count += 1
                matched_idx.add(i)
        if count:
            patterns.append({"name": label, "count": count, "desc": desc})
    patterns.sort(key=lambda p: -p["count"])

    # Findings sitting in files that carry an AI/stub signal.
    ai_signal_findings = sum(
        1 for f in findings
        if (f.stub_category or "").lower() in _AI_STUB_CATEGORIES
        or (f.engine == "stub")
    )

    # Heuristic AI-composition share: blend of (a) how many findings carry an AI
    # signature and (b) stub density. Clamped to a sane 5–95 band when there's
    # any signal, else 0. This is intentionally an estimate, surfaced as such.
    if n == 0:
        percent = 0
    else:
        signature_ratio = len(matched_idx) / n
        stub_ratio = ai_signal_findings / n
        raw = 100 * (0.6 * signature_ratio + 0.4 * stub_ratio)
        percent = int(max(5, min(95, round(raw)))) if (matched_idx or ai_signal_findings) else 0

    # "delta": how much more (or less) risky AI-signaled findings are vs the rest.
    #
    # We measure RISK DENSITY — the share of high-severity (critical/high)
    # findings — not "is it a security-engine finding". The old metric only
    # counted engine == "security", but the AI-signaled set is dominated by stub-
    # engine findings (which are never security-engine), so the ratio was forced
    # toward 0 / below 1 and contradicted the card's "more likely" framing. Risk
    # density is engine-agnostic (a stub can be critical) so the comparison is
    # coherent. The UI phrases the direction from `delta` (>1 more, <1 less).
    def _is_risky(f: Finding) -> bool:
        return (f.severity or "").lower() in ("critical", "high")

    ai_set = {i for i, f in enumerate(findings)
              if (f.stub_category or "").lower() in _AI_STUB_CATEGORIES or f.engine == "stub" or i in matched_idx}
    ai_findings = [findings[i] for i in ai_set]
    other_findings = [f for i, f in enumerate(findings) if i not in ai_set]
    ai_risk_rate = (sum(1 for f in ai_findings if _is_risky(f)) / len(ai_findings)) if ai_findings else 0.0
    other_risk_rate = (sum(1 for f in other_findings if _is_risky(f)) / len(other_findings)) if other_findings else 0.0

    if not ai_findings or not other_findings:
        # Nothing to compare against — report parity rather than a misleading number.
        delta = 1.0
    elif other_risk_rate > 0:
        delta = round(ai_risk_rate / other_risk_rate, 1)
    elif ai_risk_rate > 0:
        # AI areas carry risk, human areas carry none → strictly "more likely".
        delta = round(1.0 + ai_risk_rate, 1)
    else:
        delta = 1.0
    # Guard against a 0.0 that reads as "never" — floor at 0.1 when distinct.
    if delta == 0.0:
        delta = 0.1

    return {
        "percent": percent,
        "delta": delta,
        "files_analyzed": files,
        "findings_total": n,
        "ai_signal_findings": ai_signal_findings,
        "patterns": patterns,
        # Make the heuristic nature explicit for the UI.
        "estimate": True,
        "basis": "Derived from stub/AI-Generated markers and AI-signature finding categories across this scan.",
    }
