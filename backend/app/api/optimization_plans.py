"""Module 10 router: optimization plan CRUD, goal management, AI validation."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.errors import APIError, bad_request, envelope, not_found
from app.models.optimization_plan import OptimizationGoal, OptimizationPlan
from app.models.repository import Repository
from app.models.scan import Finding
from app.models.user import User
from app.schemas.optimization_plan import (
    GoalCreate,
    GoalOut,
    GoalUpdate,
    PlanCreate,
    PlanOut,
    PlanUpdate,
    ValidateRequest,
)
from app.services.goal_tracking import plan_health, plan_progress
from app.services.plan_validation import validate_goals, validate_plan
from app.services.router_factory import build_router_for_user

router = APIRouter(prefix="/optimization-plans", tags=["optimization-plans"])


async def _owned_plan(db: AsyncSession, plan_id: str, user_id: str) -> OptimizationPlan:
    plan = await db.get(OptimizationPlan, plan_id)
    if plan is None or plan.user_id != user_id:
        raise not_found("Plan not found")
    return plan


async def _plan_out(db: AsyncSession, plan: OptimizationPlan) -> dict:
    goals = (
        await db.execute(
            select(OptimizationGoal)
            .where(OptimizationGoal.plan_id == plan.id)
            .order_by(OptimizationGoal.position)
        )
    ).scalars().all()
    linked = (
        await db.execute(
            select(func.count()).select_from(Finding).where(Finding.plan_id == plan.id)
        )
    ).scalar_one()
    return PlanOut(
        id=plan.id, repository_id=plan.repository_id, name=plan.name,
        priority=plan.priority,
        goals=[GoalOut.model_validate(g) for g in goals],
        health=plan_health(goals), progress=plan_progress(goals),
        linked=linked, created_at=plan.created_at,
    ).model_dump()


@router.get("")
async def list_plans(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    repository_id: str | None = None,
):
    stmt = select(OptimizationPlan).where(OptimizationPlan.user_id == user.id)
    if repository_id:
        stmt = stmt.where(OptimizationPlan.repository_id == repository_id)
    plans = (await db.execute(stmt.order_by(OptimizationPlan.created_at.desc()))).scalars().all()
    return envelope([await _plan_out(db, p) for p in plans])


@router.post("", status_code=201)
async def create_plan(
    body: PlanCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = await db.get(Repository, body.repository_id)
    if repo is None or repo.user_id != user.id:
        raise bad_request("repository_id does not reference one of your repositories")

    # Server-side validation gate: goals MUST pass AI validation before a plan is
    # saved. This holds for every path (UI, direct API, MCP) — not just the UI
    # button. Rejected with 422 + the per-goal issues so callers can fix them.
    goals_text = [g.text for g in body.goals if (g.text or "").strip()]
    if not goals_text:
        raise bad_request("A plan needs at least one goal")
    context = "No prior scan context."
    if repo.last_scan_id:
        from app.models.scan import Scan
        scan = await db.get(Scan, repo.last_scan_id)
        if scan and scan.executive_summary:
            context = scan.executive_summary
    router_obj = await build_router_for_user(user.id)
    verdict = await validate_goals(goals_text, context, router_obj)
    if verdict.get("status") == "issues":
        raise APIError(
            "plan_validation_failed",
            "Some goals need attention before this plan can be saved.",
            422,
            details={"issues": verdict.get("issues", [])},
        )
    if verdict.get("status") != "approved":
        raise APIError(
            "plan_validation_unavailable",
            verdict.get("error", "Plan validation could not be completed. Try again."),
            422,
        )

    plan = OptimizationPlan(
        user_id=user.id, repository_id=body.repository_id,
        name=body.name, priority=body.priority,
    )
    db.add(plan)
    await db.flush()
    for i, g in enumerate(body.goals):
        db.add(OptimizationGoal(plan_id=plan.id, text=g.text, status=g.status, position=i))
    await db.flush()
    return envelope(await _plan_out(db, plan))


@router.patch("/{plan_id}")
async def update_plan(
    plan_id: str,
    body: PlanUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _owned_plan(db, plan_id, user.id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    await db.flush()
    return envelope(await _plan_out(db, plan))


@router.delete("/{plan_id}", status_code=204)
async def delete_plan(
    plan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _owned_plan(db, plan_id, user.id)
    await db.delete(plan)
    return  # 204


# ---- Goals ------------------------------------------------------------------
@router.post("/{plan_id}/goals", status_code=201)
async def add_goal(
    plan_id: str,
    body: GoalCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _owned_plan(db, plan_id, user.id)
    count = (
        await db.execute(
            select(func.count()).select_from(OptimizationGoal)
            .where(OptimizationGoal.plan_id == plan_id)
        )
    ).scalar_one()
    db.add(OptimizationGoal(plan_id=plan.id, text=body.text, status=body.status, position=count))
    await db.flush()
    return envelope(await _plan_out(db, plan))


@router.patch("/goals/{goal_id}")
async def update_goal(
    goal_id: str,
    body: GoalUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await db.get(OptimizationGoal, goal_id)
    if goal is None:
        raise not_found("Goal not found")
    plan = await _owned_plan(db, goal.plan_id, user.id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    await db.flush()
    return envelope(await _plan_out(db, plan))


@router.delete("/goals/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await db.get(OptimizationGoal, goal_id)
    if goal is None:
        raise not_found("Goal not found")
    await _owned_plan(db, goal.plan_id, user.id)
    await db.delete(goal)
    return  # 204


# ---- AI validation (SSE) ----------------------------------------------------
@router.post("/validate")
async def validate(
    body: ValidateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream goal validation: validating -> approved | issues_found."""
    if not body.goals:
        raise bad_request("Provide at least one goal to validate")

    # Build repo context from the latest scan's executive summary, if any.
    context = "No prior scan context."
    if body.repository_id:
        repo = await db.get(Repository, body.repository_id)
        if repo and repo.user_id == user.id and repo.last_scan_id:
            from app.models.scan import Scan
            scan = await db.get(Scan, repo.last_scan_id)
            if scan and scan.executive_summary:
                context = scan.executive_summary

    router_obj = await build_router_for_user(user.id)
    goals = list(body.goals)

    async def event_stream():
        async for event_type, payload in validate_plan(goals, context, router_obj):
            yield f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
