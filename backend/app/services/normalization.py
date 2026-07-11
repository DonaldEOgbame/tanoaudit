"""Normalize free-text finding labels to canonical taxonomy names.

The LLM names its own `subcategory` for each finding, so the same issue gets
labeled inconsistently across segments and scans ("SQL Injection", "SQLi",
"SQL Injection (Classic)"). That defeats grouping and dedup in reports. Here we
map a free-text label to the closest canonical taxonomy class name, keeping the
original around as a display alias.

This is reporting/aggregation hygiene only — it does not gate detection and is
deliberately conservative: if nothing matches well, we return the original
label unchanged rather than guessing.
"""
from __future__ import annotations

import logging
import re
from functools import lru_cache

from app.services.taxonomy import OPTIMIZATION_CATEGORIES
from app.services.taxonomy_data import TAXONOMY

logger = logging.getLogger("tanoaudit.analysis")

# Stub engine categories are a fixed closed set (see analysis.StubItem).
_STUB_CATEGORIES = ["Stub", "Placeholder", "Incomplete", "AI-Generated"]


def _tokens(s: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9]+", s.lower()) if len(t) > 1}


@lru_cache(maxsize=1)
def _canonical_names() -> tuple[str, ...]:
    """All canonical labels we normalize toward, across every engine."""
    names: list[str] = []
    for classes in TAXONOMY.values():
        names.extend(name for name, *_ in classes)
    names.extend(OPTIMIZATION_CATEGORIES)
    names.extend(_STUB_CATEGORIES)
    return tuple(names)


@lru_cache(maxsize=2048)
def normalize_label(label: str | None) -> str | None:
    """Return the canonical taxonomy name closest to `label`.

    Matching, in order: exact (case-insensitive) → unique substring → best
    token-overlap above a threshold. Returns the original label unchanged when
    no candidate is confident enough, so we never silently mislabel a finding.
    """
    if not label or not label.strip():
        return label
    raw = label.strip()
    low = raw.lower()
    canon = _canonical_names()

    # 1. Exact, case-insensitive.
    for name in canon:
        if name.lower() == low:
            return name

    # 2. Unique substring either direction (e.g. "SQL Injection" in
    #    "SQL Injection (Classic)"). Only accept if exactly one candidate.
    subs = [n for n in canon if low in n.lower() or n.lower() in low]
    if len(subs) == 1:
        return subs[0]

    # 3. Best token overlap (Jaccard), with a floor so weak matches are ignored.
    lt = _tokens(raw)
    if not lt:
        return raw
    best, best_score = raw, 0.0
    for name in canon:
        nt = _tokens(name)
        if not nt:
            continue
        score = len(lt & nt) / len(lt | nt)
        if score > best_score:
            best, best_score = name, score
    if best_score >= 0.5:
        if best.lower() != low:
            logger.info("normalized label %r -> %r (jaccard=%.2f)", raw, best, best_score)
        return best
    return raw
