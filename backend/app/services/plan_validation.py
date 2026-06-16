"""AI validation of optimization-plan goals.

Reviews goals for realism / specificity / conflicts against repo context (the
repo's latest scan findings when available). Returns approved or a list of
per-goal issues. Streams validating -> approved | issues_found events.

Validation is AI-only: there is no heuristic fallback. If no model is available
or the model's output can't be parsed, we surface an error rather than silently
approving — a fabricated "approved" would be worse than telling the user it
couldn't validate.
"""
from __future__ import annotations

import json
import re
from typing import AsyncIterator

from app.services.router_model import ModelRouter

VALIDATING = "validating"
APPROVED = "approved"
ISSUES_FOUND = "issues_found"
ERROR = "error"

_PROMPT = """You are validating optimization goals for a security scanner called Akira.
Akira scans source code and detects: vulnerabilities (SQLi, XSS, IDOR, path traversal, etc.),
exposed secrets and hardcoded credentials, outdated/CVE-affected dependencies, and insecure
coding patterns. It does NOT run tests, measure latency or performance, check CI/CD pipelines,
assess test coverage, or execute benchmarks.

A goal is ONLY valid if its completion can be determined entirely from security scan findings —
i.e. by whether specific vulnerability findings exist and whether they are fixed. Goals are
automatically advanced by scans: when all findings tagged to a goal are marked Fixed, the goal
is marked Done. There is no manual override.

Reject ANY goal that requires external tooling to verify (profilers, test runners, benchmarks,
CI logs, coverage tools, deployment checks, load tests, etc.).

Examples of VALID goals:
- "Fix all high-severity SQL injection findings"
- "Eliminate vulnerable dependencies with known CVEs"
- "Remove hardcoded secrets and API keys from source"
- "Resolve all critical authentication bypass findings"
- "Patch all outdated dependencies flagged in the last scan"

Examples of INVALID goals (must be rejected):
- "Reduce API latency by 35%" — requires a profiler, not detectable by scanning
- "Achieve 95% test coverage" — requires a test runner
- "Add SAST scanning to CI/CD" — requires checking CI pipeline config, not a scan finding
- "Reduce N+1 query patterns by 90%" — requires runtime profiling
- "Implement rate limiting" — an implementation task, not a scan-detectable finding

Reply with ONLY valid JSON, no explanation outside it:
{{"status": "approved"}}  OR
{{"status": "issues", "issues": [{{"goal_index": 0, "problem": "<why it cannot be tracked by a security scan>", "suggestion": "<rewrite as a scan-measurable goal, or state it cannot be reformulated>"}}]}}

Repository context: {context}

Goals:
{goals}"""


def _parse(raw: str) -> dict | None:
    m = re.search(r"\{.*\}", raw or "", re.DOTALL)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    if data.get("status") in ("approved", "issues"):
        return data
    return None


async def validate_goals(goals: list[str], context: str, router: ModelRouter) -> dict:
    """Non-streaming validation used by the create endpoint to GATE saving.

    Returns one of:
      {"status": "approved"}
      {"status": "issues", "issues": [...]}
      {"status": "error", "error": "..."}
    AI-only with local heuristics fallback.
    """
    if not goals:
        return {"status": "error", "error": "Provide at least one goal to validate"}

    # 1. Run local heuristics check first
    heuristic_issues = []
    for idx, goal in enumerate(goals):
        g_lower = goal.lower()
        if "coverage" in g_lower:
            heuristic_issues.append({
                "goal_index": idx,
                "problem": "Test/code coverage requires a test runner or coverage tool, which is outside Akira's static security scanning capabilities.",
                "suggestion": "Focus on scan-measurable security objectives, such as fixing authentication or dependency findings."
            })
        elif any(k in g_lower for k in ("latency", "response time", "throughput", "p95", "p99")):
            heuristic_issues.append({
                "goal_index": idx,
                "problem": "Performance and latency metrics require runtime profiling or benchmarking, which cannot be measured via static scanning.",
                "suggestion": "Focus on scan-measurable coding patterns or vulnerability resolution."
            })
        elif any(k in g_lower for k in ("ci/cd", "pipeline")):
            heuristic_issues.append({
                "goal_index": idx,
                "problem": "CI/CD pipeline state or setup requires checking runner configurations, which is outside Akira's scan findings.",
                "suggestion": "Focus on scan-measurable vulnerabilities in source code."
            })
        elif "n+1" in g_lower:
            heuristic_issues.append({
                "goal_index": idx,
                "problem": "N+1 query detection requires runtime database query profiling, which is not detectable by static scanning.",
                "suggestion": "Focus on scan-measurable code quality/security patterns."
            })
        elif "rate limit" in g_lower or "rate limiting" in g_lower:
            heuristic_issues.append({
                "goal_index": idx,
                "problem": "Rate limiting is an implementation task, not a scan-detectable finding.",
                "suggestion": "Focus on scan-measurable security objectives like fixing vulnerabilities."
            })

    # If all goals are rejected by heuristics, short-circuit and avoid LLM call
    if len(heuristic_issues) == len(goals):
        return {"status": "issues", "issues": heuristic_issues}

    # 2. Call AI validator for remaining goals
    if not router.has_any_key():
        if heuristic_issues:
            return {"status": "issues", "issues": heuristic_issues}
        return {"status": "error", "error": "AI validation is unavailable right now. Try again later."}

    goal_lines = "\n".join(f"{i}. {g}" for i, g in enumerate(goals))
    try:
        raw = await router.complete(_PROMPT.format(context=context[:1500], goals=goal_lines))
    except Exception:  # noqa: BLE001
        if heuristic_issues:
            return {"status": "issues", "issues": heuristic_issues}
        return {"status": "error", "error": "Couldn't reach the validation model. Try again."}

    result = _parse(raw)
    if result is None:
        if heuristic_issues:
            return {"status": "issues", "issues": heuristic_issues}
        return {"status": "error", "error": "The validation model returned an unreadable response. Try again."}

    # 3. Merge AI results with heuristic results
    ai_status = result.get("status")
    ai_issues = result.get("issues", []) if ai_status == "issues" else []

    merged_issues_dict = {iss["goal_index"]: iss for iss in ai_issues if "goal_index" in iss}
    for iss in heuristic_issues:
        merged_issues_dict[iss["goal_index"]] = iss

    merged_issues = sorted(list(merged_issues_dict.values()), key=lambda x: x.get("goal_index", 0))

    if merged_issues:
        return {"status": "issues", "issues": merged_issues}
    return {"status": "approved"}


async def validate_plan(
    goals: list[str], context: str, router: ModelRouter
) -> AsyncIterator[tuple[str, dict]]:
    """Streaming wrapper around validate_goals for the SSE validate endpoint."""
    yield VALIDATING, {"goal_count": len(goals)}
    result = await validate_goals(goals, context, router)
    status = result.get("status")
    if status == "approved":
        yield APPROVED, {"status": "approved"}
    elif status == "issues":
        yield ISSUES_FOUND, {"status": "issues", "issues": result.get("issues", [])}
    else:
        yield ERROR, {"status": "error", "error": result.get("error", "Validation failed")}
