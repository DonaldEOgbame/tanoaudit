"""Goal auto-advancement + plan health.

A goal's findings are those tagged with the goal_id across the repo's scans. A
goal advances to Done when it has at least one tagged finding and all of them are
fixed; to In progress when some are fixed; else stays Pending. Plan health % =
done goals / total goals.
"""
from __future__ import annotations

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.optimization_plan import (
    GOAL_DONE,
    GOAL_IN_PROGRESS,
    GOAL_PENDING,
    OptimizationGoal,
    OptimizationPlan,
)
from app.models.scan import STATUS_FIXED, Finding


def _status_for(findings: list[Finding]) -> str:
    """Derive a goal status from its tagged findings.

    Goals are scan-driven: there is no manual override. A goal with no tagged
    findings is Pending (waiting for the next scan to link findings to it).
    """
    if not findings:
        return GOAL_PENDING  # no tagged findings -> always reset to Pending
    fixed = sum(1 for f in findings if f.status == STATUS_FIXED)
    if fixed == len(findings):
        return GOAL_DONE
    if fixed > 0:
        return GOAL_IN_PROGRESS
    return GOAL_PENDING


async def advance_goals_for_repo(repository_id: str) -> None:
    async with SessionLocal() as db:
        plans = (
            await db.execute(
                select(OptimizationPlan).where(
                    OptimizationPlan.repository_id == repository_id
                )
            )
        ).scalars().all()
        for plan in plans:
            goals = (
                await db.execute(
                    select(OptimizationGoal).where(OptimizationGoal.plan_id == plan.id)
                )
            ).scalars().all()
            for goal in goals:
                tagged = (
                    await db.execute(
                        select(Finding).where(Finding.goal_id == goal.id)
                    )
                ).scalars().all()
                # _status_for always returns a value; no manual override is allowed
                goal.status = _status_for(tagged)
        await db.commit()



_STOPWORDS = {
    "all", "the", "a", "an", "for", "to", "of", "and", "in", "on", "add",
    "remove", "fix", "introduce", "move", "right", "size", "reduce", "patterns",
    "queries", "query", "with", "into", "across", "top", "slow", "use",
}


def _keywords(text: str) -> set[str]:
    return {
        w.strip(".,:;()").lower()
        for w in (text or "").split()
        if len(w) > 3 and w.strip(".,:;()").lower() not in _STOPWORDS
    }


async def tag_findings_to_goals(scan_id: str, repository_id: str) -> int:
    """Tag a scan's findings to the repo's plan goals by keyword/category overlap.

    A finding is tagged to the best-matching goal (plan_id + goal_id) when their
    keyword overlap is non-trivial. Enables auto-advancement. Returns the count
    of tagged findings.
    """
    async with SessionLocal() as db:
        plans = (
            await db.execute(
                select(OptimizationPlan).where(
                    OptimizationPlan.repository_id == repository_id
                )
            )
        ).scalars().all()
        if not plans:
            return 0

        # Build (plan_id, goal_id, keywords) index.
        goal_index: list[tuple[str, str, set[str]]] = []
        for plan in plans:
            goals = (
                await db.execute(
                    select(OptimizationGoal).where(OptimizationGoal.plan_id == plan.id)
                )
            ).scalars().all()
            for g in goals:
                goal_index.append((plan.id, g.id, _keywords(g.text)))
        if not goal_index:
            return 0

        findings = (
            await db.execute(select(Finding).where(Finding.scan_id == scan_id))
        ).scalars().all()

        tagged = 0
        for f in findings:
            f_words = _keywords(f.category or "") | _keywords(f.subcategory or "") | _keywords(f.explanation or "")
            best, best_overlap = None, 0
            for plan_id, goal_id, g_words in goal_index:
                overlap = len(f_words & g_words)
                if overlap > best_overlap:
                    best, best_overlap = (plan_id, goal_id), overlap
            if best and best_overlap >= 1:
                f.plan_id, f.goal_id = best
                tagged += 1
        await db.commit()
        return tagged


def plan_health(goals: list[OptimizationGoal]) -> int:
    if not goals:
        return 0
    done = sum(1 for g in goals if g.status == GOAL_DONE)
    return round(done / len(goals) * 100)


def plan_progress(goals: list[OptimizationGoal]) -> int:
    """Weighted progress: Done=1, In progress=0.5, Pending=0."""
    if not goals:
        return 0
    weight = {GOAL_DONE: 1.0, GOAL_IN_PROGRESS: 0.5, GOAL_PENDING: 0.0}
    total = sum(weight.get(g.status, 0.0) for g in goals)
    return round(total / len(goals) * 100)
