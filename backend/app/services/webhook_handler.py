"""GitHub webhook event handling: decide whether an event triggers an auto-scan.

Pure-ish logic separated from the router so it's unit-testable: given the event
type, payload, and the user's trigger settings, return (should_scan, branch,
reason).
"""
from __future__ import annotations

import fnmatch


def _branch_from_ref(ref: str) -> str:
    # refs/heads/main -> main
    return ref.rsplit("/", 1)[-1] if ref else ""


def _branch_matches(branch: str, filters: list[str]) -> bool:
    if not filters:
        return True
    return any(fnmatch.fnmatch(branch, pat) for pat in filters)


def decide_trigger(event: str, payload: dict, triggers: dict) -> tuple[bool, str | None, str]:
    """Return (should_scan, branch, reason)."""
    triggers = triggers or {}
    filters = triggers.get("branch_filters", [])

    if event == "push":
        if not triggers.get("on_push", False):
            return False, None, "push trigger disabled"
        branch = _branch_from_ref(payload.get("ref", ""))
        if not _branch_matches(branch, filters):
            return False, branch, f"branch '{branch}' not in filters"
        return True, branch, f"push to {branch}"

    if event == "pull_request":
        if not triggers.get("on_pull_request", False):
            return False, None, "PR trigger disabled"
        action = payload.get("action")
        if action not in ("opened", "synchronize", "reopened"):
            return False, None, f"PR action '{action}' ignored"
        branch = (payload.get("pull_request", {}).get("head", {}) or {}).get("ref", "")
        return True, branch, f"pull request {action}"

    if event == "release":
        if not triggers.get("on_release", False):
            return False, None, "release trigger disabled"
        if payload.get("action") != "published":
            return False, None, "release not published"
        tag = (payload.get("release", {}) or {}).get("tag_name", "")
        return True, tag, f"release {tag}"

    return False, None, f"event '{event}' not handled"


def repo_full_name(payload: dict) -> str | None:
    return (payload.get("repository", {}) or {}).get("full_name")


def head_sha(event: str, payload: dict) -> str | None:
    if event == "push":
        return payload.get("after")
    if event == "pull_request":
        return (payload.get("pull_request", {}).get("head", {}) or {}).get("sha")
    return None
