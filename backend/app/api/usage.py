"""Module 16 router: usage aggregates for the Usage settings screen."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.errors import envelope
from app.models.user import User
from app.services.usage import aggregate

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("")
async def usage_summary(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return envelope(await aggregate(db, user.id))
