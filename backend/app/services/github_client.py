"""GitHub API client + OAuth helpers + webhook HMAC verification.

All network calls are isolated here so the router stays thin and tests can patch
this module. Tokens are passed in decrypted by the caller.
"""
from __future__ import annotations

import hashlib
import hmac
from urllib.parse import urlencode

import httpx

from app.core.config import settings

_API = "https://api.github.com"
_TIMEOUT = httpx.Timeout(15.0)


def oauth_authorize_url(state: str) -> str:
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_oauth_redirect_uri,
        "scope": "repo read:org",
        "state": state,
        # Force GitHub to show the account/authorization chooser instead of
        # silently re-granting whoever is already signed in. Lets a user connect
        # a different account after disconnecting, rather than being bounced
        # straight back into their previous one.
        "prompt": "select_account",
    }
    return f"https://github.com/login/oauth/authorize?{urlencode(params)}"


def login_authorize_url(state: str) -> str:
    """Authorize URL for 'Sign in with GitHub'. Uses the login callback and the
    minimal scope needed to read the user's identity + verified email."""
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_login_redirect_uri,
        "scope": "read:user user:email",
        "state": state,
        "prompt": "select_account",
    }
    return f"https://github.com/login/oauth/authorize?{urlencode(params)}"


async def exchange_code(code: str, redirect_uri: str | None = None) -> dict:
    """Exchange an OAuth code for an access token. Returns {token, scopes}.

    `redirect_uri` defaults to the account-linking callback; the login flow
    passes its own callback (it must match the one used to start the flow)."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        r = await c.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": redirect_uri or settings.github_oauth_redirect_uri,
            },
        )
    data = r.json()
    return {"token": data.get("access_token"), "scopes": data.get("scope", "")}


async def get_primary_email(token: str) -> str | None:
    """Return the user's primary verified email (the /user payload often omits
    email when it's set to private)."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(f"{_API}/user/emails", headers=_headers(token))
        if r.status_code != 200:
            return None
        emails = r.json()
    except (httpx.HTTPError, ValueError):
        return None
    primary = next((e for e in emails if e.get("primary") and e.get("verified")), None)
    if primary:
        return primary.get("email")
    verified = next((e for e in emails if e.get("verified")), None)
    return verified.get("email") if verified else None


def _headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def get_user(token: str) -> dict:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        r = await c.get(f"{_API}/user", headers=_headers(token))
    r.raise_for_status()
    return r.json()


async def list_repos(token: str, page: int = 1, per_page: int = 30, q: str | None = None) -> list[dict]:
    """List the user's repos (most recently pushed first). `q` filters by name."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        r = await c.get(
            f"{_API}/user/repos",
            headers=_headers(token),
            params={"sort": "pushed", "per_page": per_page, "page": page,
                    "affiliation": "owner,collaborator,organization_member"},
        )
    r.raise_for_status()
    repos = r.json()
    out = [
        {
            "full_name": x["full_name"], "private": x["private"],
            "default_branch": x.get("default_branch", "main"),
            "language": x.get("language"), "pushed_at": x.get("pushed_at"),
            "clone_url": x.get("clone_url"),
        }
        for x in repos
    ]
    if q:
        ql = q.lower()
        out = [x for x in out if ql in x["full_name"].lower()]
    return out


async def create_issue(token: str, repo_full_name: str, title: str, body: str,
                       labels: list[str] | None = None, assignee: str | None = None) -> dict:
    payload: dict = {"title": title, "body": body}
    if labels:
        payload["labels"] = labels
    if assignee:
        payload["assignees"] = [assignee.lstrip("@")]
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        r = await c.post(
            f"{_API}/repos/{repo_full_name}/issues",
            headers=_headers(token), json=payload,
        )
    r.raise_for_status()
    return r.json()


async def post_commit_status(token: str, repo_full_name: str, sha: str,
                             state: str, context: str, description: str) -> dict:
    """state: success | failure | pending | error."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
        r = await c.post(
            f"{_API}/repos/{repo_full_name}/statuses/{sha}",
            headers=_headers(token),
            json={"state": state, "context": context, "description": description[:140]},
        )
    r.raise_for_status()
    return r.json()


async def get_file_content(token: str, repo_full_name: str, path: str, ref: str | None = None) -> str | None:
    """Fetch a file's text content from a repo (for richer fix context)."""
    import base64
    params = {"ref": ref} if ref else {}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(
                f"{_API}/repos/{repo_full_name}/contents/{path}",
                headers=_headers(token), params=params,
            )
        if r.status_code != 200:
            return None
        data = r.json()
        if data.get("encoding") == "base64" and data.get("content"):
            return base64.b64decode(data["content"]).decode("utf-8", "replace")
    except (httpx.HTTPError, ValueError):
        return None
    return None


async def create_webhook(token: str, repo_full_name: str, payload_url: str, secret: str) -> dict | None:
    """Create a repo webhook for push/PR/release. Returns the hook or None on error."""
    config = {
        "url": payload_url, "content_type": "json", "secret": secret, "insecure_ssl": "0",
    }
    body = {"name": "web", "active": True,
            "events": ["push", "pull_request", "release"], "config": config}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.post(
                f"{_API}/repos/{repo_full_name}/hooks", headers=_headers(token), json=body
            )
        if r.status_code in (200, 201):
            return r.json()
        return None
    except httpx.HTTPError:
        return None


async def list_pr_files(token: str, repo_full_name: str, pr_number: int) -> list[str]:
    """Return the file paths changed in a pull request."""
    files: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            r = await c.get(
                f"{_API}/repos/{repo_full_name}/pulls/{pr_number}/files",
                headers=_headers(token), params={"per_page": 300},
            )
        if r.status_code == 200:
            files = [f["filename"] for f in r.json() if f.get("filename")]
    except httpx.HTTPError:
        pass
    return files


async def revoke_token(token: str) -> None:
    """Delete the OAuth authorization (best-effort)."""
    if not (settings.github_client_id and settings.github_client_secret):
        return
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            await c.request(
                "DELETE",
                f"{_API}/applications/{settings.github_client_id}/token",
                auth=(settings.github_client_id, settings.github_client_secret),
                headers={"Accept": "application/vnd.github+json"},
                json={"access_token": token},
            )
    except httpx.HTTPError:
        pass


def verify_signature(secret: str, payload_body: bytes, signature_header: str | None) -> bool:
    """Verify GitHub's X-Hub-Signature-256 HMAC header."""
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        secret.encode(), payload_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)
