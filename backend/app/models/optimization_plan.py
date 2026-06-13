"""Module 10 models: optimization plans and their goals.

Each plan targets exactly one repository. Goals belong to a plan and link to
scan findings via Finding.plan_id + Finding.goal_id; a goal auto-advances to Done
when all its tagged findings are fixed (computed from the latest scan).
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Goal statuses (match the frontend's labels).
GOAL_PENDING = "Pending"
GOAL_IN_PROGRESS = "In progress"
GOAL_DONE = "Done"


class OptimizationPlan(Base):
    __tablename__ = "optimization_plans"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # A plan targets one repository.
    repository_id: Mapped[str] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    priority: Mapped[str] = mapped_column(String(16), default="Medium")

    goals: Mapped[list["OptimizationGoal"]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="OptimizationGoal.position",
    )


class OptimizationGoal(Base):
    __tablename__ = "optimization_goals"

    plan_id: Mapped[str] = mapped_column(
        ForeignKey("optimization_plans.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default=GOAL_PENDING)
    position: Mapped[int] = mapped_column(Integer, default=0)

    plan: Mapped["OptimizationPlan"] = relationship(back_populates="goals")
