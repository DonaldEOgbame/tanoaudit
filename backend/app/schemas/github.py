"""Schemas for Module 11: GitHub integration."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class ConnectionStatus(BaseModel):
    connected: bool
    github_username: Optional[str] = None
    avatar_url: Optional[str] = None
    scopes: Optional[str] = None
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    triggers: Optional[dict] = None
    issue_settings: Optional[dict] = None
    status_check: Optional[dict] = None
    repo_access: Optional[dict] = None


class AuthorizeUrl(BaseModel):
    authorize_url: str
    state: str


class RepoOut(BaseModel):
    full_name: str
    private: bool
    default_branch: str
    language: Optional[str] = None
    pushed_at: Optional[str] = None


class TriggersUpdate(BaseModel):
    on_push: Optional[bool] = None
    on_pull_request: Optional[bool] = None
    on_release: Optional[bool] = None
    branch_filters: Optional[list[str]] = None
    ignore_paths: Optional[list[str]] = None


class IssueSettingsUpdate(BaseModel):
    auto_create: Optional[bool] = None
    severity_threshold: Optional[Literal["critical", "high", "medium"]] = None
    assignee: Optional[str] = None
    labels: Optional[list[str]] = None
    label_mapping: Optional[dict] = None
    template: Optional[str] = None


class StatusCheckUpdate(BaseModel):
    post_commit_status: Optional[bool] = None
    block_merge_on_critical: Optional[bool] = None
    check_name: Optional[str] = None


class RepoAccessUpdate(BaseModel):
    mode: Literal["all", "selected"]
    selected: list[str] = []


class WebhookDeliveryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event: str
    status: int
    repo: Optional[str] = None
    detail: Optional[str] = None
    triggered_scan_id: Optional[str] = None
    created_at: datetime


class CreateIssueRequest(BaseModel):
    finding_id: str
