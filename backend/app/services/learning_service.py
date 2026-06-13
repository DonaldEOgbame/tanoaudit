"""Seed helpers for the Learning Hub."""
from __future__ import annotations

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.learning import LearningHubClass
from app.services.learning_seed import build_classes


async def seed_learning_hub(force: bool = False) -> int:
    """Insert any missing Learning Hub classes. Idempotent (keyed by slug)."""
    classes = build_classes()
    async with SessionLocal() as db:
        existing = set(
            (await db.execute(select(LearningHubClass.slug))).scalars().all()
        )
        added = 0
        for c in classes:
            if c["slug"] in existing and not force:
                continue
            if c["slug"] in existing:  # force refresh
                row = (
                    await db.execute(
                        select(LearningHubClass).where(LearningHubClass.slug == c["slug"])
                    )
                ).scalar_one()
                for k, v in c.items():
                    setattr(row, k, v)
            else:
                db.add(LearningHubClass(**c))
                added += 1
        await db.commit()
        return added
