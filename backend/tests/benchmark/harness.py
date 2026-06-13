"""Detection-benchmark harness: corpus annotations + scoring.

Reads `PLANTED: <engine>/<slug>` markers from the corpus, strips them so the
model never sees the answer, and scores a scan's findings against them.

Matching is intentionally lenient: the model emits free-text categories, so a
finding matches a planted issue when it's the same engine, in the same file, and
the planted slug's tokens overlap the finding's category/subcategory. This
measures "did we flag the right kind of problem in the right place", which is the
signal worth tracking — not exact label equality.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

_MARKER_RE = re.compile(r"PLANTED:\s*([a-z]+)\s*/\s*([a-z0-9\-]+)", re.I)
# A marker comment on its own line -> drop the whole line.
_MARKER_OWN_LINE_RE = re.compile(r"^[ \t]*(#|//)[ \t]*PLANTED:.*\n?", re.I | re.M)
# A marker as a trailing comment after code -> strip just the comment.
_MARKER_TRAILING_RE = re.compile(r"[ \t]*(#|//)[ \t]*PLANTED:.*$", re.I | re.M)


@dataclass(frozen=True)
class Planted:
    engine: str
    slug: str
    file: str


@dataclass
class Score:
    planted: int = 0
    detected: int = 0          # findings in this engine
    matched: int = 0           # planted issues a finding covered
    unmatched_findings: int = 0  # findings matching no planted issue (precision drag)
    missed: list = field(default_factory=list)  # planted issues with no finding

    @property
    def recall(self) -> float:
        return self.matched / self.planted if self.planted else 0.0

    @property
    def precision(self) -> float:
        return self.matched / self.detected if self.detected else 0.0


def parse_planted(corpus_dir: str) -> list[Planted]:
    """Collect every PLANTED marker across the corpus."""
    out: list[Planted] = []
    root = Path(corpus_dir)
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix in {".md"}:
            continue
        rel = str(path.relative_to(root))
        for line in path.read_text(errors="replace").splitlines():
            m = _MARKER_RE.search(line)
            if m:
                out.append(Planted(m.group(1).lower(), m.group(2).lower(), rel))
    return out


def strip_markers(text: str) -> str:
    """Remove PLANTED markers before the code is analyzed.

    Own-line marker comments are dropped entirely; trailing marker comments are
    stripped from their code line. Either way the model never sees the answer.
    """
    text = _MARKER_OWN_LINE_RE.sub("", text)
    return _MARKER_TRAILING_RE.sub("", text)


def _tokens(slug_or_label: str) -> set[str]:
    return {t for t in re.split(r"[\s/_\-]+", (slug_or_label or "").lower()) if t}


def _matches(planted: Planted, finding) -> bool:
    if finding["engine"] != planted.engine:
        return False
    if finding["file"] != planted.file:
        return False
    want = _tokens(planted.slug)
    have = _tokens(finding.get("category", "")) | _tokens(finding.get("subcategory", ""))
    # Any meaningful token overlap counts (e.g. "sql" in "SQL Injection").
    return bool(want & have)


def score(planted: list[Planted], findings: list[dict]) -> dict[str, Score]:
    """Score findings against planted issues, broken down by engine.

    `findings` items are dicts with keys: engine, file, category, subcategory.
    Returns {engine: Score} plus an "all" aggregate.
    """
    engines = {p.engine for p in planted} | {f["engine"] for f in findings}
    scores: dict[str, Score] = {e: Score() for e in engines}

    for p in planted:
        scores[p.engine].planted += 1
    for f in findings:
        scores[f["engine"]].detected += 1

    remaining = list(findings)
    for p in planted:
        hit = next((f for f in remaining if _matches(p, f)), None)
        if hit is not None:
            scores[p.engine].matched += 1
            remaining.remove(hit)
        else:
            scores[p.engine].missed.append((p.file, p.slug))
    for f in remaining:
        scores[f["engine"]].unmatched_findings += 1

    agg = Score()
    for s in scores.values():
        agg.planted += s.planted
        agg.detected += s.detected
        agg.matched += s.matched
        agg.unmatched_findings += s.unmatched_findings
        agg.missed.extend(s.missed)
    scores["all"] = agg
    return scores


def format_report(scores: dict[str, Score]) -> str:
    lines = ["", "Detection benchmark", "=" * 40]
    for engine in sorted(scores):
        s = scores[engine]
        lines.append(
            f"{engine:>12}: recall {s.recall:5.0%} ({s.matched}/{s.planted})  "
            f"precision {s.precision:5.0%} ({s.matched}/{s.detected})"
        )
    misses = scores["all"].missed
    if misses:
        lines.append("missed: " + ", ".join(f"{f}:{slug}" for f, slug in misses))
    return "\n".join(lines)
