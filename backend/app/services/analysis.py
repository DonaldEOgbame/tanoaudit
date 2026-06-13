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
def build_prompt(
    segment: SegmentData,
    include_optimization: bool,
    custom_vulns: list[str] | None = None,
    suppressions: list[str] | None = None,
) -> str:
    cats = slice_taxonomy(segment.file_path, segment.language)
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

Analyze the code segment below against these security categories:
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
- "line_start"/"line_end" are absolute file line numbers and MUST fall within
  {segment.line_start}-{segment.line_end} (the range shown below). Point at the
  exact offending line(s), not the whole block.
- "confidence" is High only when the issue is unambiguous in this snippet; Medium
  when it depends on context not shown; Low when it is a plausible but unconfirmed
  pattern. Calibrate honestly — low-confidence trivial findings may be filtered out.

Example security item (shape only): {{"category":"Injection","subcategory":"SQL Injection","severity":"Critical","confidence":"High","line_start":42,"line_end":42,"code_snippet":"db.query('... ' + userId)","explanation":"User input concatenated into SQL.","fix_summary":"Use a parameterized query.","fix_snippet":"db.query('... = ?', [userId])","cwe_id":"CWE-89","owasp_ref":"A03:2021"}}

Return ONE JSON object, no prose, with exactly this shape:
{{"security": [ {{"category","subcategory","severity","confidence","line_start","line_end","code_snippet","explanation","fix_summary","fix_snippet","cwe_id","owasp_ref"}} ],
 "optimizations": [ {{"category","subcategory","severity","confidence","line_start","line_end","code_snippet","explanation","fix_summary","fix_snippet","impact"}} ],
 "stubs": [ {{"category","severity","confidence","line_start","line_end","code_snippet","explanation","completion_suggestion","risk_if_shipped"}} ],
 "segment_scores": {{"security_risk": 0-100, "optimization_score": 0-100, "completeness_score": 0-100}} }}
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
