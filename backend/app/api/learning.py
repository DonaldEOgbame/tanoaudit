"""Module 14 router: Learning Hub list / search / detail.

The Learning Hub is a standalone, browsable directory. Findings are not
cross-linked to it: the previous /for-finding resolver matched the model's
free-text labels against static class names, which was brittle (frequent 404s,
no coverage for optimization/stub findings). It was removed in favour of the
Hub standing on its own. See backend/KNOWN_LIMITATIONS.md.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import envelope, not_found
from app.models.learning import LearningHubClass
from app.schemas.learning import ClassDetail, ClassSummary

router = APIRouter(prefix="/learning-hub", tags=["learning-hub"])


@router.get("/classes")
async def list_classes(
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(None, description="Search by name/category/keyword"),
    category: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List classes, optionally filtered by search query and/or category."""
    stmt = select(LearningHubClass)
    count_stmt = select(func.count()).select_from(LearningHubClass)

    if category:
        stmt = stmt.where(LearningHubClass.category == category)
        count_stmt = count_stmt.where(LearningHubClass.category == category)
    if q:
        like = f"%{q.lower()}%"
        cond = or_(
            func.lower(LearningHubClass.name).like(like),
            func.lower(LearningHubClass.category).like(like),
            func.lower(LearningHubClass.summary).like(like),
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    total = (await db.execute(count_stmt)).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(LearningHubClass.category, LearningHubClass.name)
            .limit(limit).offset(offset)
        )
    ).scalars().all()
    return envelope({
        "items": [ClassSummary.model_validate(r).model_dump() for r in rows],
        "total": total, "limit": limit, "offset": offset,
    })


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    """Categories with their class counts (for the grouped Learning Hub view)."""
    rows = (
        await db.execute(
            select(LearningHubClass.category, func.count())
            .group_by(LearningHubClass.category)
            .order_by(LearningHubClass.category)
        )
    ).all()
    return envelope([{"category": c, "count": n} for c, n in rows])


@router.get("/classes/{slug}")
async def class_detail(slug: str, db: AsyncSession = Depends(get_db)):
    row = (
        await db.execute(select(LearningHubClass).where(LearningHubClass.slug == slug))
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Class not found")
    return envelope(ClassDetail.model_validate(row).model_dump())
