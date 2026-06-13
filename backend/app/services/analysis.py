"""Unified security + optimization analysis of a single segment.

One LLM call per segment returns one JSON object with `security`,
`optimizations`, and `segment_scores`. This module builds the prompt (with
dynamic taxonomy slicing), invokes a provider, and strictly parses/validates the
response (Pydantic) with a single repair-retry.

The actual provider dispatch (Auto/fallback/rate-limit rerouting) is Module 4;
here we depend on a small `complete()` callable so the pipeline is testable by
injecting a fake model.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Awaitable, Callable

from pydantic import BaseModel, Field, ValidationError

from app.services.segmentation import SegmentData
from app.services.taxonomy import OPTIMIZATION_CATEGORIES, slice_taxonomy

logger = logging.getLogger("akira.analysis")

# A provider call: (prompt, model_hint) -> raw text. Module 4 supplies the real one.
CompleteFn = Callable[[str, str | None], Awaitable[str]]


# ---- Strict response schema -------------------------------------------------
class SecurityItem(BaseModel):
    category: str = ""
    subcategory: str = ""
    severity: str = "Info"
    confidence: str = "Medium"
    line_start: int = 0
    line_end: int = 0
    code_snippet: str = ""
    explanation: str = ""
    fix_summary: str = ""
    fix_snippet: str = ""
    cwe_id: str = ""
    owasp_ref: str = ""


class OptimizationItem(BaseModel):
    category: str = ""
    subcategory: str = ""
    severity: str = "Info"
    confidence: str = "Medium"
    line_start: int = 0
    line_end: int = 0
    code_snippet: str = ""
    explanation: str = ""
    fix_summary: str = ""
    fix_snippet: str = ""
    impact: str = ""


class StubItem(BaseModel):
    category: str = ""  # Stub | Placeholder | Incomplete | AI-Generated
    severity: str = "Info"
    confidence: str = "Medium"
    line_start: int = 0
    line_end: int = 0
    code_snippet: str = ""
    explanation: str = ""
    completion_suggestion: str = ""
    risk_if_shipped: str = ""


class SegmentScores(BaseModel):
    security_risk: int = 0
    optimization_score: int = 0
    completeness_score: int = 100


class AnalysisResult(BaseModel):
    security: list[SecurityItem] = Field(default_factory=list)
    optimizations: list[OptimizationItem] = Field(default_factory=list)
    stubs: list[StubItem] = Field(default_factory=list)
    segment_scores: SegmentScores = Field(default_factory=SegmentScores)


# ---- Prompt -----------------------------------------------------------------
def _instructions(
    *,
    file_path: str,
    language: str | None,
    include_optimization: bool,
    custom_vulns: list[str] | None,
    suppressions: list[str] | None,
    line_rule: str,
) -> str:
    """Shared instruction block for single- and multi-segment prompts.

    `line_rule` describes the allowed line-number range (single segment vs. "the
    range shown for each segment"), the only part that differs across modes.
    """
    cats = slice_taxonomy(file_path, language)
    sec_block = "\n".join(f"- {c}" for c in cats)
    custom_block = ""
    if custom_vulns:
        custom_block = "\nAdditional custom detection targets:\n" + "\n".join(
            f"- {c}" for c in custom_vulns
        )
    suppress_block = ""
    if suppressions:
        suppress_block = "\nDo NOT re-flag these known false positives:\n" + "\n".join(
            f"- {s}" for s in suppressions
        )
    opt_block = ""
    if include_optimization:
        opt_block = (
            "\nAlso analyze for optimization opportunities in these categories:\n"
            + "\n".join(f"- {c}" for c in OPTIMIZATION_CATEGORIES)
        )

    return f"""You are a precise code security and optimization analyzer.
You also detect stubs, placeholders, and incomplete implementations. These are
code sections that are not fully implemented — TODO markers, empty function
bodies, hardcoded test data, placeholder URLs, scaffolding that was never
completed, and AI-generated boilerplate left hollow.

Analyze the code against these security categories:
{sec_block}{custom_block}{opt_block}{suppress_block}

Also detect stubs and placeholders — check for:
- Explicit markers (TODO, FIXME, HACK, NotImplementedError, empty bodies)
- Placeholder values (test emails, localhost URLs, hardcoded ports, dummy data)
- Incomplete implementations (always-null returns, empty catch blocks, pass-through middleware, validation that always passes)
- AI-generated stubs (boilerplate comments like "add your logic here", scaffolded but hollow handlers)
For each stub, assess the risk if shipped to production and set severity:
- Auth/security stubs that create real vulnerabilities = Critical
- Business logic stubs that cause incorrect behavior = High
- Missing functionality = Medium
- TODOs and cosmetic placeholders = Low
- Debug artifacts = Info
The stub "category" is exactly one of: Stub, Placeholder, Incomplete, AI-Generated.

Accuracy rules (these matter as much as coverage):
- Report only issues you can point to in this exact code. Do not flag hypothetical
  or "could be" problems, framework behaviour that is already safe, or test/example
  files behaving as intended. A false positive is worse than a missed low-severity finding.
- "subcategory" should name the specific weakness using standard terminology
  (e.g. "SQL Injection", "Reflected XSS", "Hardcoded Credentials"), not a sentence.
- {line_rule}
- "confidence" is High only when the issue is unambiguous in this snippet; Medium
  when it depends on context not shown; Low when it is a plausible but unconfirmed
  pattern. Calibrate honestly — low-confidence trivial findings may be filtered out.

Example security item (shape only): {{"category":"Injection","subcategory":"SQL Injection","severity":"Critical","confidence":"High","line_start":42,"line_end":42,"code_snippet":"db.query('... ' + userId)","explanation":"User input concatenated into SQL.","fix_summary":"Use a parameterized query.","fix_snippet":"db.query('... = ?', [userId])","cwe_id":"CWE-89","owasp_ref":"A03:2021"}}"""


# The per-segment result shape, reused in both prompt builders.
_RESULT_SHAPE = (
    '{"security": [ {"category","subcategory","severity","confidence","line_start",'
    '"line_end","code_snippet","explanation","fix_summary","fix_snippet","cwe_id","owasp_ref"} ],\n'
    ' "optimizations": [ {"category","subcategory","severity","confidence","line_start",'
    '"line_end","code_snippet","explanation","fix_summary","fix_snippet","impact"} ],\n'
    ' "stubs": [ {"category","severity","confidence","line_start","line_end",'
    '"code_snippet","explanation","completion_suggestion","risk_if_shipped"} ],\n'
    ' "segment_scores": {"security_risk": 0-100, "optimization_score": 0-100, "completeness_score": 0-100} }'
)


def build_prompt(
    segment: SegmentData,
    include_optimization: bool,
    custom_vulns: list[str] | None = None,
    suppressions: list[str] | None = None,
) -> str:
    instructions = _instructions(
        file_path=segment.file_path, language=segment.language,
        include_optimization=include_optimization,
        custom_vulns=custom_vulns, suppressions=suppressions,
        line_rule=(
            '"line_start"/"line_end" are absolute file line numbers and MUST fall '
            f"within {segment.line_start}-{segment.line_end} (the range shown below). "
            "Point at the exact offending line(s), not the whole block."
        ),
    )
    return f"""{instructions}

Return ONE JSON object, no prose, with exactly this shape:
{_RESULT_SHAPE}
severity is one of Critical/High/Medium/Low/Info. completeness_score is 100 when no stubs are found. Report only real issues; empty arrays are fine.

FILE: {segment.file_path} (language: {segment.language or 'unknown'})
LINES {segment.line_start}-{segment.line_end}:
```
{segment.content}
```"""


# ---- Parsing ----------------------------------------------------------------
def _extract_json(text: str | None) -> dict | None:
    text = (text or "").strip()
    # Strip ``` fences if present.
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    # Fall back to first { ... last }.
    if not text.startswith("{"):
        i, j = text.find("{"), text.rfind("}")
        if i == -1 or j == -1:
            return None
        text = text[i : j + 1]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _salvage_items(items: object, model: type[BaseModel]) -> list:
    """Validate a list item-by-item, dropping only the malformed ones.

    A single bad finding inside an otherwise-good array used to fail the whole
    segment (all findings lost). Salvaging per-item turns that into the loss of
    just the offending finding, which is logged.
    """
    if not isinstance(items, list):
        return []
    out = []
    for i, raw_item in enumerate(items):
        try:
            out.append(model.model_validate(raw_item))
        except ValidationError as e:
            logger.warning("dropping malformed %s item #%d: %s", model.__name__, i, e)
    return out


def parse_analysis(raw: str) -> AnalysisResult | None:
    """Parse the analysis JSON.

    Returns None only when the response isn't usable JSON at all. When the JSON
    parses but individual findings are malformed, the valid findings are kept
    (per-item salvage) rather than dropping the whole segment.
    """
    data = _extract_json(raw)
    if data is None:
        return None
    # Fast path: a fully-valid response.
    try:
        return AnalysisResult.model_validate(data)
    except ValidationError:
        pass
    # Salvage path: keep whatever validates per-item.
    if not isinstance(data, dict):
        return None
    try:
        scores = SegmentScores.model_validate(data.get("segment_scores", {}))
    except ValidationError:
        scores = SegmentScores()
    return AnalysisResult(
        security=_salvage_items(data.get("security", []), SecurityItem),
        optimizations=_salvage_items(data.get("optimizations", []), OptimizationItem),
        stubs=_salvage_items(data.get("stubs", []), StubItem),
        segment_scores=scores,
    )


# Findings that are both low-confidence AND low-impact are the noise floor:
# they inflate counts without being actionable. Security findings are never
# dropped (a low-confidence critical still warrants a look); only optimization
# and stub items are filtered, since those tolerate a higher precision bar.
_LOW_SEVERITY = {"low", "info"}


def _is_noise(item: BaseModel) -> bool:
    sev = getattr(item, "severity", "") or ""
    conf = getattr(item, "confidence", "") or ""
    return conf.strip().lower() == "low" and sev.strip().lower() in _LOW_SEVERITY


def _apply_noise_floor(result: AnalysisResult, seg_ref: str) -> AnalysisResult:
    """Drop low-confidence, low-impact optimization/stub findings; log the count."""
    opt = [i for i in result.optimizations if not _is_noise(i)]
    stubs = [i for i in result.stubs if not _is_noise(i)]
    dropped = (len(result.optimizations) - len(opt)) + (len(result.stubs) - len(stubs))
    if dropped:
        logger.info("noise-floor dropped %d low-confidence trivial findings: %s", dropped, seg_ref)
        result.optimizations = opt
        result.stubs = stubs
    return result


async def analyze_segment(
    segment: SegmentData,
    complete: CompleteFn,
    *,
    include_optimization: bool = True,
    model_hint: str | None = None,
    custom_vulns: list[str] | None = None,
    suppressions: list[str] | None = None,
) -> AnalysisResult | None:
    """Run one unified analysis call with a single repair-retry on bad JSON.

    Returns None only if both the initial call and the repair retry fail to
    yield usable JSON; that case is logged because the segment's findings are
    lost entirely (a recall miss that is otherwise invisible).
    """
    seg_ref = f"{segment.file_path}:{segment.line_start}-{segment.line_end}"
    prompt = build_prompt(segment, include_optimization, custom_vulns, suppressions)
    raw = await complete(prompt, model_hint)
    result = parse_analysis(raw)
    if result is None:
        # One repair retry.
        repair = prompt + "\n\nYour previous reply was not valid JSON. Reply with ONLY the JSON object."
        raw = await complete(repair, model_hint)
        result = parse_analysis(raw)
    if result is None:
        logger.warning("segment dropped (unparseable after repair retry): %s", seg_ref)
        return None
    result = _apply_noise_floor(result, seg_ref)
    logger.info(
        "segment analyzed %s: %d security, %d optimization, %d stub findings",
        seg_ref, len(result.security), len(result.optimizations), len(result.stubs),
    )
    return result


# ---- Batched analysis -------------------------------------------------------
# Many segments per LLM call: collapses request count (one per batch instead of
# one per segment), which is what keeps a scan under tight provider rate limits
# (e.g. Gemini free tier's 25 requests/day). Per-segment line numbers and the
# result schema are unchanged; the response is a map of segment index -> result.

# Rough token estimate (~4 chars/token) used only to size batches; it doesn't
# need to be exact, just to keep a batch comfortably under the model's window.
def _est_tokens(text: str) -> int:
    return len(text) // 4 + 1


def batch_segments(segments: list[SegmentData], token_budget: int) -> list[list[SegmentData]]:
    """Group segments into batches whose combined size stays under token_budget.

    A single segment larger than the budget becomes its own batch (never split a
    segment). Order is preserved so results map back cleanly.
    """
    batches: list[list[SegmentData]] = []
    cur: list[SegmentData] = []
    cur_tokens = 0
    for seg in segments:
        t = _est_tokens(seg.content) + 64  # +overhead for the per-segment header
        if cur and cur_tokens + t > token_budget:
            batches.append(cur)
            cur, cur_tokens = [], 0
        cur.append(seg)
        cur_tokens += t
    if cur:
        batches.append(cur)
    return batches


def build_batch_prompt(
    segments: list[SegmentData],
    include_optimization: bool,
    custom_vulns: list[str] | None = None,
    suppressions: list[str] | None = None,
) -> str:
    """Build one prompt covering N segments, asking for results keyed by index."""
    first = segments[0]
    instructions = _instructions(
        file_path=first.file_path, language=first.language,
        include_optimization=include_optimization,
        custom_vulns=custom_vulns, suppressions=suppressions,
        line_rule=(
            '"line_start"/"line_end" are absolute file line numbers and MUST fall '
            "within the LINES range shown for that segment. Point at the exact "
            "offending line(s), not the whole block."
        ),
    )
    blocks = []
    for i, seg in enumerate(segments):
        blocks.append(
            f"### SEGMENT {i} — FILE: {seg.file_path} "
            f"(language: {seg.language or 'unknown'}) LINES {seg.line_start}-{seg.line_end}:\n"
            f"```\n{seg.content}\n```"
        )
    seg_blocks = "\n\n".join(blocks)
    return f"""{instructions}

You will analyze {len(segments)} code segments. Return ONE JSON object, no prose,
mapping each segment's index (as a string) to its result. Each result has exactly
this shape:
{_RESULT_SHAPE}
severity is one of Critical/High/Medium/Low/Info. completeness_score is 100 when
no stubs are found. Report only real issues; empty arrays are fine. Include an
entry for EVERY segment index 0..{len(segments) - 1}, even if all arrays are empty.

Overall shape: {{"results": {{"0": {{...}}, "1": {{...}}, ...}}}}

{seg_blocks}"""


def parse_batch(raw: str | None, n: int) -> list[AnalysisResult | None]:
    """Parse a batched response into n results (index-aligned).

    Missing or malformed per-segment entries become None for just that segment
    (the rest are kept), mirroring single-segment per-item salvage.
    """
    data = _extract_json(raw)
    results: list[AnalysisResult | None] = [None] * n
    if not isinstance(data, dict):
        return results
    # Accept either {"results": {...}} or a bare {"0": {...}} map.
    table = data.get("results") if isinstance(data.get("results"), dict) else data
    if not isinstance(table, dict):
        return results
    for i in range(n):
        entry = table.get(str(i))
        if entry is None and i in table:  # tolerate int keys
            entry = table.get(i)
        if not isinstance(entry, dict):
            continue
        try:
            results[i] = AnalysisResult.model_validate(entry)
        except ValidationError:
            # Salvage per-array, like parse_analysis.
            try:
                scores = SegmentScores.model_validate(entry.get("segment_scores", {}))
            except ValidationError:
                scores = SegmentScores()
            results[i] = AnalysisResult(
                security=_salvage_items(entry.get("security", []), SecurityItem),
                optimizations=_salvage_items(entry.get("optimizations", []), OptimizationItem),
                stubs=_salvage_items(entry.get("stubs", []), StubItem),
                segment_scores=scores,
            )
    return results


async def analyze_batch(
    segments: list[SegmentData],
    complete: CompleteFn,
    *,
    include_optimization: bool = True,
    model_hint: str | None = None,
    custom_vulns: list[str] | None = None,
    suppressions: list[str] | None = None,
) -> list[AnalysisResult | None]:
    """Analyze a batch of segments in one LLM call. Returns index-aligned results.

    One repair-retry if the whole response is unparseable. Any segment still
    without a result is None (its findings are lost — counted by the caller).
    Noise-floor filtering is applied per segment, as in analyze_segment.
    """
    if not segments:
        return []
    if len(segments) == 1:
        # Single segment: reuse the well-tested single path.
        return [await analyze_segment(
            segments[0], complete, include_optimization=include_optimization,
            model_hint=model_hint, custom_vulns=custom_vulns, suppressions=suppressions,
        )]

    prompt = build_batch_prompt(segments, include_optimization, custom_vulns, suppressions)
    raw = await complete(prompt, model_hint)
    results = parse_batch(raw, len(segments))
    if all(r is None for r in results):
        repair = prompt + "\n\nYour previous reply was not valid JSON. Reply with ONLY the JSON object keyed by segment index."
        raw = await complete(repair, model_hint)
        results = parse_batch(raw, len(segments))

    out: list[AnalysisResult | None] = []
    for seg, res in zip(segments, results):
        seg_ref = f"{seg.file_path}:{seg.line_start}-{seg.line_end}"
        if res is None:
            logger.warning("segment dropped (missing/unparseable in batch): %s", seg_ref)
            out.append(None)
            continue
        res = _apply_noise_floor(res, seg_ref)
        logger.info(
            "segment analyzed %s: %d security, %d optimization, %d stub findings",
            seg_ref, len(res.security), len(res.optimizations), len(res.stubs),
        )
        out.append(res)
    return out
