"""Module 17 model: tech/coding fun facts pool."""
from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FunFact(Base):
    __tablename__ = "fun_facts"

    text: Mapped[str] = mapped_column(String(500), unique=True)
