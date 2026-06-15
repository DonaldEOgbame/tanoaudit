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

_PROMPT = """You are reviewing optimization goals for realism, specificity, and
conflicts. Reply with ONLY this JSON:
{{"status": "approved"}}  OR
{{"status": "issues", "issues": [{{"goal_index": 0, "problem": "", "suggestion": ""}}]}}

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
    AI-only — no heuristic fallback (mirrors validate_plan).
    """
    if not goals:
        return {"status": "error", "error": "Provide at least one goal to validate"}
    if not router.has_any_key():
        return {"status": "error", "error": "AI validation is unavailable right now. Try again later."}

    goal_lines = "\n".join(f"{i}. {g}" for i, g in enumerate(goals))
    try:
        raw = await router.complete(_PROMPT.format(context=context[:1500], goals=goal_lines))
    except Exception:  # noqa: BLE001
        return {"status": "error", "error": "Couldn't reach the validation model. Try again."}

    result = _parse(raw)
    if result is None:
        return {"status": "error", "error": "The validation model returned an unreadable response. Try again."}
    if result["status"] == "approved":
        return {"status": "approved"}
    return {"status": "issues", "issues": result.get("issues", [])}


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
