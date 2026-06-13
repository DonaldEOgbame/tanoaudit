"""Profile endpoints: read and update the single user's profile + general settings."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.errors import envelope
from app.models.user import User
from app.schemas.auth import ProfileUpdate, UserOut

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("")
async def get_profile(user: User = Depends(get_current_user)):
    return envelope(UserOut.model_validate(user).model_dump())


@router.patch("")
async def update_profile(
    body: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)

    # Merge dict-typed settings rather than overwriting wholesale.
    for blob in ("settings", "privacy", "notifications"):
        if blob in data and data[blob] is not None:
            merged = dict(getattr(user, blob) or {})
            merged.update(data.pop(blob))
            setattr(user, blob, merged)

    for field, value in data.items():
        setattr(user, field, value)

    db.add(user)
    await db.flush()
    return envelope(UserOut.model_validate(user).model_dump())
