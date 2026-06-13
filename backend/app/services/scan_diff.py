"""Scan diff: compare two scans of the same repo into new / fixed / still-open.

Findings are matched by (category, file, fuzzy line proximity). A finding in the
newer scan with no match in the older is "new"; one in the older with no match in
the newer is "fixed"; matched-in-both is "still open".
"""
from __future__ import annotations

from dataclasses import dataclass

from app.models.scan import Finding

LINE_FUZZ = 10  # lines of proximity that still count as "the same" finding


@dataclass
class DiffResult:
    new: list[Finding]
    fixed: list[Finding]
    still_open: list[Finding]


def _key(f: Finding) -> tuple[str, str, str]:
    return ((f.engine or "").lower(), (f.category or "").lower(), f.file.lower())


def _matches(a: Finding, b: Finding) -> bool:
    if _key(a) != _key(b):
        return False
    return abs((a.line_start or 0) - (b.line_start or 0)) <= LINE_FUZZ


def diff_findings(old: list[Finding], new: list[Finding]) -> DiffResult:
    old_matched: set[int] = set()
    new_items: list[Finding] = []
    still_open: list[Finding] = []

    for nf in new:
        match_idx = next(
            (i for i, of in enumerate(old) if i not in old_matched and _matches(of, nf)),
            None,
        )
        if match_idx is None:
            new_items.append(nf)
        else:
            old_matched.add(match_idx)
            still_open.append(nf)

    fixed = [of for i, of in enumerate(old) if i not in old_matched]
    return DiffResult(new=new_items, fixed=fixed, still_open=still_open)
