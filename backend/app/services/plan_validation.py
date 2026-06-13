"""AI validation of optimization-plan goals.

Reviews goals for realism / specificity / conflicts against repo context (the
repo's latest scan findings when available). Returns approved or a list of
per-goal issues. Streams validating -> approved | issues_found events.
"""
from __future__ import annotations

import json
import re
from typing import AsyncIterator

from app.services.router_model import ModelRouter

VALIDATING = "validating"
APPROVED = "approved"
ISSUES_FOUND = "issues_found"

_PROMPT = """You are reviewing optimization goals for realism, specificity, and
conflicts. Reply with ONLY this JSON:
{{"status": "approved"}}  OR
{{"status": "issues", "issues": [{{"goal_index": 0, "problem": "", "suggestion": ""}}]}}

Repository context: {context}

Goals:
{goals}"""


def _heuristic_validate(goals: list[str]) -> dict:
    """Offline fallback: flag obviously vague goals."""
    issues = []
    vague = ("improve", "optimize", "make better", "faster", "clean up", "refactor")
    for i, g in enumerate(goals):
        gl = g.lower().strip()
        if len(gl) < 8 or (any(v in gl for v in vague) and not any(c.isdigit() for c in gl)):
            issues.append({
                "goal_index": i,
                "problem": "Goal is vague or unmeasurable.",
                "suggestion": "Add a specific target, metric, or scope (e.g. a %, a count, or named files).",
            })
    return {"status": "issues", "issues": issues} if issues else {"status": "approved"}


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


async def validate_plan(
    goals: list[str], context: str, router: ModelRouter
) -> AsyncIterator[tuple[str, dict]]:
    yield VALIDATING, {"goal_count": len(goals)}

    if router.has_any_key():
        goal_lines = "\n".join(f"{i}. {g}" for i, g in enumerate(goals))
        raw = await router.complete(_PROMPT.format(context=context[:1500], goals=goal_lines))
        result = _parse(raw) or _heuristic_validate(goals)
    else:
        result = _heuristic_validate(goals)

    if result["status"] == "approved":
        yield APPROVED, {"status": "approved"}
    else:
        yield ISSUES_FOUND, {"status": "issues", "issues": result.get("issues", [])}
