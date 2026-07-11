"""Module 11 models: GitHub connection (OAuth) + webhook delivery log.

Single-user product: one GitHub connection per user. The OAuth token is
Fernet-encrypted at rest (never returned in full). Auto-scan triggers, issue
settings, and status-check config live in JSON blobs on the connection.
"""
from __future__ import annotations

import secrets
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _default_triggers() -> dict:
    return {
        "on_push": True,
        "on_pull_request": True,
        "on_release": False,
        "branch_filters": ["main", "release/*"],
        "ignore_paths": ["dist/**", "*.test.js"],
    }


def _default_issue_settings() -> dict:
    return {
        "auto_create": False,
        "severity_threshold": "high",  # critical|high|medium
        "assignee": None,
        "labels": ["security", "tanoaudit-ai"],
        "label_mapping": {
            "critical": "security:critical",
            "high": "security:high",
            "medium": "security:medium",
        },
        "template": (
            "## {public_id} — {severity}: {category}\n\n"
            "**File:** {file} (lines {line_start}-{line_end})\n"
            "**CWE:** {cwe_id} · **OWASP:** {owasp_ref}\n\n"
            "{explanation}\n\n"
            "### Suggested fix\n{fix_summary}\n\n"
            "_Reported by TanoAudit._"
        ),
    }


def _default_status_check() -> dict:
    return {
        "post_commit_status": True,
        "block_merge_on_critical": False,
        "check_name": "TanoAudit security check",
    }


class GitHubConnection(Base):
    __tablename__ = "github_connections"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    # Fernet-encrypted OAuth access token.
    encrypted_token: Mapped[str] = mapped_column(String(1000))
    github_username: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    github_user_id: Mapped[Optional[int]] = mapped_column(nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    scopes: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)

    # Per-user webhook HMAC secret (generated on connect).
    webhook_secret: Mapped[str] = mapped_column(
        String(64), default=lambda: secrets.token_hex(20)
    )

    # Settings blobs.
    triggers: Mapped[dict] = mapped_column(JSON, default=_default_triggers)
    issue_settings: Mapped[dict] = mapped_column(JSON, default=_default_issue_settings)
    status_check: Mapped[dict] = mapped_column(JSON, default=_default_status_check)
    # Repo access: "all" or "selected" + a list of selected repo full names.
    repo_access: Mapped[dict] = mapped_column(
        JSON, default=lambda: {"mode": "all", "selected": []}
    )


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    event: Mapped[str] = mapped_column(String(60))
    status: Mapped[int] = mapped_column(default=200)  # HTTP-like status we returned
    repo: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    triggered_scan_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
