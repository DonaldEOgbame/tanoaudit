"""Module 11 router: GitHub OAuth, connection settings, repos, issues, webhooks."""
from __future__ import annotations

import secrets

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import APIError, bad_request, envelope, not_found
from app.core.security import (
    create_access_token,
    decode_token,
    decrypt_secret,
    encrypt_secret,
)
from app.models.github import GitHubConnection, WebhookDelivery
from app.models.scan import Finding, Scan
from app.models.user import User
from app.schemas.github import (
    AuthorizeUrl,
    ConnectionStatus,
    CreateIssueRequest,
    IssueSettingsUpdate,
    RepoAccessUpdate,
    RepoOut,
    StatusCheckUpdate,
    TriggersUpdate,
    WebhookDeliveryOut,
)
from app.services import github_client as gh

router = APIRouter(prefix="/github", tags=["github"])


def _require_config() -> None:
    if not (settings.github_client_id and settings.github_client_secret):
        raise APIError(
            "github_not_configured",
            "GitHub OAuth is not configured on this server.",
            503,
        )


async def _connection(db: AsyncSession, user_id: str) -> GitHubConnection | None:
    return (
        await db.execute(
            select(GitHubConnection).where(GitHubConnection.user_id == user_id)
        )
    ).scalar_one_or_none()


def _webhook_url(user_id: str) -> str:
    return f"{settings.public_base_url}{settings.api_v1_prefix}/github/webhook/{user_id}"


# ---- OAuth ------------------------------------------------------------------
@router.get("/authorize")
async def authorize(user: User = Depends(get_current_user)):
    _require_config()
    # Sign the user id into a short-lived state token (CSRF + identity binding).
    state = create_access_token(user.id, purpose="github_oauth", nonce=secrets.token_urlsafe(8))
    return envelope(AuthorizeUrl(authorize_url=gh.oauth_authorize_url(state), state=state).model_dump())


async def _exchange_and_store(code: str, state: str, db: AsyncSession) -> tuple[str, GitHubConnection]:
    """Validate state, exchange the code, persist the connection. Returns
    (user_id, connection). Raises bad_request on any failure."""
    _require_config()
    try:
        payload = decode_token(state)
        if payload.get("purpose") != "github_oauth":
            raise ValueError("bad purpose")
        user_id = payload["sub"]
    except Exception:
        raise bad_request("Invalid OAuth state")

    result = await gh.exchange_code(code)
    token = result.get("token")
    if not token:
        raise bad_request("GitHub did not return an access token")

    profile = await gh.get_user(token)

    conn = await _connection(db, user_id)
    if conn is None:
        conn = GitHubConnection(user_id=user_id)
        db.add(conn)
    conn.encrypted_token = encrypt_secret(token)
    conn.github_username = profile.get("login")
    conn.github_user_id = profile.get("id")
    conn.avatar_url = profile.get("avatar_url")
    conn.scopes = result.get("scopes")
    await db.flush()
    return user_id, conn


@router.post("/callback")
async def callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Exchange the OAuth code (SPA flow: the frontend POSTs code+state here).

    `state` carries the signed user id, so no session cookie is needed.
    """
    user_id, conn = await _exchange_and_store(code, state, db)
    return envelope(_status_payload(conn, user_id))


@router.get("/callback")
async def callback_redirect(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Browser-friendly callback for manual testing.

    GitHub redirects the browser here (a GET) after the user authorizes. The
    real product will redirect to the SPA, which POSTs to /callback; until that
    frontend exists, this GET does the exchange server-side and shows a simple
    result page so the whole flow can be exercised in a browser.
    """
    from fastapi.responses import HTMLResponse

    try:
        user_id, conn = await _exchange_and_store(code, state, db)
    except Exception as exc:  # noqa: BLE001 — render the error, don't 500 the browser
        detail = getattr(exc, "detail", str(exc))
        return HTMLResponse(
            f"<h2>GitHub connection failed</h2><pre>{detail}</pre>", status_code=400
        )
    return HTMLResponse(
        "<h2>✅ GitHub connected</h2>"
        f"<p>Account: <b>{conn.github_username}</b></p>"
        f"<p>Scopes: <code>{conn.scopes}</code></p>"
        "<p>You can close this tab. Check <code>GET /api/v1/github/status</code> to confirm.</p>"
    )


def _status_payload(conn: GitHubConnection | None, user_id: str) -> dict:
    if conn is None:
        return ConnectionStatus(connected=False).model_dump()
    return ConnectionStatus(
        connected=True,
        github_username=conn.github_username,
        avatar_url=conn.avatar_url,
        scopes=conn.scopes,
        webhook_url=_webhook_url(user_id),
        webhook_secret=conn.webhook_secret,
        triggers=conn.triggers,
        issue_settings=conn.issue_settings,
        status_check=conn.status_check,
        repo_access=conn.repo_access,
    ).model_dump()


@router.get("/status")
async def status(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    conn = await _connection(db, user.id)
    return envelope(_status_payload(conn, user.id))


@router.post("/disconnect", status_code=204)
async def disconnect(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    conn = await _connection(db, user.id)
    if conn is not None:
        try:
            await gh.revoke_token(decrypt_secret(conn.encrypted_token))
        except ValueError:
            pass
        await db.delete(conn)
    return  # 204


# ---- Repos ------------------------------------------------------------------
@router.get("/repos")
async def repos(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    q: str | None = None,
):
    conn = await _connection(db, user.id)
    if conn is None:
        raise bad_request("GitHub is not connected")
    token = decrypt_secret(conn.encrypted_token)
    try:
        items = await gh.list_repos(token, page=page, per_page=per_page, q=q)
    except httpx.HTTPError:
        raise APIError("github_error", "Could not fetch repositories", 502)
    return envelope([RepoOut(**r).model_dump() for r in items])


# ---- Settings ---------------------------------------------------------------
async def _require_conn(db: AsyncSession, user_id: str) -> GitHubConnection:
    conn = await _connection(db, user_id)
    if conn is None:
        raise bad_request("GitHub is not connected")
    return conn


def _merge(blob: dict, update: dict) -> dict:
    merged = dict(blob or {})
    merged.update({k: v for k, v in update.items() if v is not None})
    return merged


@router.patch("/triggers")
async def update_triggers(
    body: TriggersUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conn = await _require_conn(db, user.id)
    conn.triggers = _merge(conn.triggers, body.model_dump(exclude_unset=True))
    await db.flush()
    return envelope(conn.triggers)


@router.patch("/issue-settings")
async def update_issue_settings(
    body: IssueSettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conn = await _require_conn(db, user.id)
    conn.issue_settings = _merge(conn.issue_settings, body.model_dump(exclude_unset=True))
    await db.flush()
    return envelope(conn.issue_settings)


@router.patch("/status-check")
async def update_status_check(
    body: StatusCheckUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conn = await _require_conn(db, user.id)
    conn.status_check = _merge(conn.status_check, body.model_dump(exclude_unset=True))
    await db.flush()
    return envelope(conn.status_check)


@router.patch("/repo-access")
async def update_repo_access(
    body: RepoAccessUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conn = await _require_conn(db, user.id)
    conn.repo_access = {"mode": body.mode, "selected": body.selected}
    await db.flush()
    return envelope(conn.repo_access)


# ---- Issues -----------------------------------------------------------------
def _render_issue(finding: Finding, template: str) -> tuple[str, str]:
    fields = {
        "public_id": finding.public_id, "severity": (finding.severity or "").upper(),
        "category": finding.category or "", "file": finding.file,
        "line_start": finding.line_start, "line_end": finding.line_end,
        "cwe_id": finding.cwe_id or "—", "owasp_ref": finding.owasp_ref or "—",
        "explanation": finding.explanation or "", "fix_summary": finding.fix_summary or "",
    }
    title = f"[{fields['severity']}] {finding.public_id}: {finding.category or 'Finding'}"
    try:
        body = template.format(**fields)
    except (KeyError, IndexError):
        body = f"{finding.public_id}: {finding.explanation or ''}"
    return title, body


@router.post("/findings/{finding_id}/issue", status_code=201)
async def create_issue_for_finding(
    finding_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conn = await _require_conn(db, user.id)
    finding = await db.get(Finding, finding_id)
    if finding is None:
        raise not_found("Finding not found")
    scan = await db.get(Scan, finding.scan_id)
    if scan is None or scan.user_id != user.id:
        raise not_found("Finding not found")
    if not scan.repo:
        raise bad_request("This finding's scan is not linked to a GitHub repo")

    token = decrypt_secret(conn.encrypted_token)
    s = conn.issue_settings or {}
    title, body = _render_issue(finding, s.get("template", "{public_id}: {explanation}"))
    labels = list(s.get("labels", []))
    mapped = (s.get("label_mapping") or {}).get((finding.severity or "").lower())
    if mapped:
        labels.append(mapped)
    try:
        issue = await gh.create_issue(
            token, scan.repo, title, body, labels=labels, assignee=s.get("assignee")
        )
    except httpx.HTTPError:
        raise APIError("github_error", "Could not create GitHub issue", 502)

    finding.github_issue_url = issue.get("html_url")
    await db.flush()
    return envelope({"issue_url": finding.github_issue_url})


@router.post("/repos/{owner}/{repo}/webhook", status_code=201)
async def register_webhook(
    owner: str,
    repo: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-create the Akira AI webhook on a repo (push/PR/release)."""
    conn = await _require_conn(db, user.id)
    token = decrypt_secret(conn.encrypted_token)
    full = f"{owner}/{repo}"
    hook = await gh.create_webhook(
        token, full, _webhook_url(user.id), conn.webhook_secret
    )
    if hook is None:
        raise APIError("github_error", "Could not create webhook (already exists?)", 502)
    return envelope({"repo": full, "hook_id": hook.get("id")})


# ---- Webhook receiver (unauthenticated; HMAC-verified) ----------------------
@router.post("/webhook/{user_id}")
async def receive_webhook(
    user_id: str,
    request: Request,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Receive a GitHub webhook for `user_id`. Verifies the HMAC signature, logs
    the delivery, and triggers an auto-scan when the user's settings say so."""
    from app.services import webhook_handler as wh
    from app.services.repositories import link_scan_to_repo

    body = await request.body()
    event = request.headers.get("X-GitHub-Event", "unknown")
    signature = request.headers.get("X-Hub-Signature-256")

    conn = await _connection(db, user_id)
    if conn is None:
        # Don't reveal whether the user exists.
        return Response(status_code=404)

    if not gh.verify_signature(conn.webhook_secret, body, signature):
        db.add(WebhookDelivery(
            user_id=user_id, event=event, status=401, detail="bad signature"
        ))
        return Response(status_code=401)

    import json as _json
    try:
        payload = _json.loads(body)
    except ValueError:
        payload = {}

    if event == "ping":
        db.add(WebhookDelivery(user_id=user_id, event="ping", status=200, detail="pong"))
        return envelope({"pong": True})

    should_scan, branch, reason = wh.decide_trigger(event, payload, conn.triggers)
    repo_name = wh.repo_full_name(payload)

    # Enforce repo-access: if mode == "selected", only scan listed repos.
    access = conn.repo_access or {}
    if should_scan and access.get("mode") == "selected":
        if repo_name not in set(access.get("selected", [])):
            should_scan = False
            reason = f"repo '{repo_name}' not in selected access list"

    scan_id = None
    if should_scan and repo_name:
        # PR-diff scoping: scan only the files changed in the PR.
        path_filters = None
        if event == "pull_request":
            pr_number = (payload.get("pull_request", {}) or {}).get("number")
            if pr_number is not None:
                try:
                    token = decrypt_secret(conn.encrypted_token)
                    changed = await gh.list_pr_files(token, repo_name, pr_number)
                    path_filters = changed or None
                except ValueError:
                    path_filters = None

        scan = Scan(
            user_id=user_id, source_type="github", repo=repo_name, branch=branch,
            depth="deep", model_mode="auto",
            models=["gemini", "groq", "openrouter"],
            include_custom=True, include_optimization=True,
            path_filters=path_filters,
        )
        db.add(scan)
        await db.flush()
        await link_scan_to_repo(db, scan)
        scan_id = scan.id
        from app.services.orchestrator import run_scan
        background.add_task(run_scan, scan_id)

    db.add(WebhookDelivery(
        user_id=user_id, event=event, status=200, repo=repo_name,
        detail=reason, triggered_scan_id=scan_id,
    ))
    return envelope({"event": event, "triggered_scan_id": scan_id, "reason": reason})


# ---- Webhook deliveries log --------------------------------------------------
@router.get("/deliveries")
async def deliveries(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(
            select(WebhookDelivery)
            .where(WebhookDelivery.user_id == user.id)
            .order_by(WebhookDelivery.created_at.desc())
            .limit(20)
        )
    ).scalars().all()
    return envelope([WebhookDeliveryOut.model_validate(d).model_dump() for d in rows])
