"""Schemas for Module 14: Learning Hub."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict


class FaqEntry(BaseModel):
    question: str
    answer: str
    advanced: Optional[str] = None


class ResourceLink(BaseModel):
    title: str
    url: str
    source: str


class ClassSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    name: str
    category: str
    severity: str
    cwe: Optional[str] = None
    owasp: Optional[str] = None
    summary: str


class ClassDetail(ClassSummary):
    faq: list[FaqEntry] = []
    resources: list[ResourceLink] = []


class CategoryGroup(BaseModel):
    category: str
    count: int
    classes: list[ClassSummary]
