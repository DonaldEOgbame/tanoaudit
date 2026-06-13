"""Module 15 router: notification preferences + in-app records."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.errors import envelope, not_found
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationOut, NotificationPrefs

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/preferences")
async def get_preferences(user: User = Depends(get_current_user)):
    return envelope(NotificationPrefs(**(user.notifications or {})).model_dump())


@router.put("/preferences")
async def update_preferences(
    body: NotificationPrefs,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    merged = dict(user.notifications or {})
    merged.update(body.model_dump())
    user.notifications = merged
    db.add(user)
    await db.flush()
    return envelope(NotificationPrefs(**merged).model_dump())


@router.get("")
async def list_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.read == False)  # noqa: E712
    rows = (
        await db.execute(stmt.order_by(Notification.created_at.desc()).limit(limit))
    ).scalars().all()
    return envelope([NotificationOut.model_validate(n).model_dump() for n in rows])


@router.get("/unread-count")
async def unread_count(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    n = (
        await db.execute(
            select(func.count()).select_from(Notification).where(
                Notification.user_id == user.id, Notification.read == False  # noqa: E712
            )
        )
    ).scalar_one()
    return envelope({"unread": n})


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    n = await db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise not_found("Notification not found")
    n.read = True
    await db.flush()
    return envelope(NotificationOut.model_validate(n).model_dump())


@router.post("/read-all")
async def mark_all_read(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(
            select(Notification).where(
                Notification.user_id == user.id, Notification.read == False  # noqa: E712
            )
        )
    ).scalars().all()
    for n in rows:
        n.read = True
    return envelope({"marked": len(rows)})


@router.delete("/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    n = await db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise not_found("Notification not found")
    await db.delete(n)
    return  # 204
