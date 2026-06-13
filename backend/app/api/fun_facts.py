"""Module 17 router: fun facts (shuffled batch for the live scan screen)."""
from __future__ import annotations

import random

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import envelope
from app.models.fun_fact import FunFact

router = APIRouter(tags=["fun-facts"])


@router.get("/fun-facts")
async def fun_facts(
    db: AsyncSession = Depends(get_db),
    count: int = Query(20, ge=1, le=100),
):
    """Return a shuffled batch of fun facts (public; no auth needed)."""
    rows = (await db.execute(select(FunFact.text))).scalars().all()
    facts = list(rows)
    random.shuffle(facts)
    return envelope(facts[:count])
