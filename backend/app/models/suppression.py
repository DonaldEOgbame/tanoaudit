"""Module 7 model: per-repo false-positive suppression rules.

When a finding is marked false-positive, a suppression rule (repo + finding
class + file pattern) is recorded. Future scans of the same repo inject these as
"do not re-flag" context into segment prompts.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FalsePositiveSuppression(Base):
    __tablename__ = "false_positive_suppressions"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Repo identity the rule applies to (repo slug or source url).
    repo: Mapped[str] = mapped_column(String(300), index=True)
    category: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    subcategory: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    file_pattern: Mapped[Optional[str]] = mapped_column(String(600), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # The finding that originated this rule (for unmark/cleanup).
    origin_finding_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)


def stub_content_hash(code_snippet: str | None) -> str:
    """Stable hash of a stub's code body, used to match intentional stubs across
    scans. If the code at that location changes, the hash differs and the
    suppression no longer applies — it's a new stub that needs review.
    """
    import hashlib

    normalized = "".join((code_snippet or "").split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class IntentionalStubSuppression(Base):
    """A stub the user deliberately keeps (planned future work, accepted TODO).

    Matched on future scans by repo + file_path + stub_category + content_hash.
    When matched, the stub is auto-marked `intentional` and excluded from the
    completeness score. Mirrors FalsePositiveSuppression for the stub engine.
    """

    __tablename__ = "intentional_stub_suppressions"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    repo: Mapped[str] = mapped_column(String(300), index=True)
    file_path: Mapped[str] = mapped_column(String(600))
    stub_category: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # sha256 of the normalized stub code body (see stub_content_hash).
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    origin_finding_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
