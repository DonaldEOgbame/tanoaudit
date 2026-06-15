"""Module 11 tests: webhook trigger logic, HMAC, endpoint, settings, post-scan."""
import hashlib
import hmac
import json

import pytest

from app.core.database import SessionLocal
from app.core.security import encrypt_secret
from app.models.github import GitHubConnection, WebhookDelivery
from app.models.scan import Finding, Scan, SCAN_COMPLETED, ENGINE_SECURITY
from app.services import github_client as gh
from app.services.webhook_handler import decide_trigger, head_sha, repo_full_name
from tests.conftest import PREFIX


async def _uid(client, headers):
    r = await client.get(f"{PREFIX}/profile", headers=headers)
    return r.json()["data"]["id"]


async def _connect(user_id, **overrides):
    async with SessionLocal() as db:
        conn = GitHubConnection(
            user_id=user_id, encrypted_token=encrypt_secret("ghp_faketoken"),
            github_username="alexrivera", webhook_secret="testsecret",
        )
        for k, v in overrides.items():
            setattr(conn, k, v)
        db.add(conn)
        await db.commit()
        return conn.webhook_secret


# ---- Unit: trigger decision -------------------------------------------------
def test_push_trigger_branch_filter():
    triggers = {"on_push": True, "branch_filters": ["main", "release/*"]}
    ok, branch, _ = decide_trigger("push", {"ref": "refs/heads/main"}, triggers)
    assert ok and branch == "main"
    ok, branch, _ = decide_trigger("push", {"ref": "refs/heads/feature-x"}, triggers)
    assert not ok  # not in filters


def test_push_disabled():
    ok, _, reason = decide_trigger("push", {"ref": "refs/heads/main"}, {"on_push": False})
    assert not ok and "disabled" in reason


def test_pr_trigger():
    triggers = {"on_pull_request": True}
    payload = {"action": "opened", "pull_request": {"head": {"ref": "feat", "sha": "abc"}}}
    ok, branch, _ = decide_trigger("pull_request", payload, triggers)
    assert ok and branch == "feat"
    assert head_sha("pull_request", payload) == "abc"


def test_release_trigger():
    triggers = {"on_release": True}
    payload = {"action": "published", "release": {"tag_name": "v1.2.0"}}
    ok, tag, _ = decide_trigger("release", payload, triggers)
    assert ok and tag == "v1.2.0"


def test_repo_full_name():
    assert repo_full_name({"repository": {"full_name": "user/x"}}) == "user/x"


# ---- HMAC -------------------------------------------------------------------
def test_verify_signature():
    secret, body = "s3cr3t", b'{"hello": 1}'
    sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert gh.verify_signature(secret, body, sig) is True
    assert gh.verify_signature(secret, body, "sha256=deadbeef") is False
    assert gh.verify_signature(secret, body, None) is False


# ---- OAuth config gate ------------------------------------------------------
async def test_authorize_requires_config(auth):
    client, headers, _ = auth
    # No GITHUB_CLIENT_ID set in tests -> 503.
    r = await client.get(f"{PREFIX}/github/authorize", headers=headers)
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "github_not_configured"


async def test_status_disconnected(auth):
    client, headers, _ = auth
    r = await client.get(f"{PREFIX}/github/status", headers=headers)
    assert r.json()["data"]["connected"] is False


# ---- Connection + settings --------------------------------------------------
async def test_status_connected_and_settings(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    await _connect(uid)

    r = await client.get(f"{PREFIX}/github/status", headers=headers)
    data = r.json()["data"]
    assert data["connected"] is True
    assert data["github_username"] == "alexrivera"
    assert data["webhook_url"].endswith(f"/github/webhook/{uid}")
    # Token never leaks.
    assert "ghp_faketoken" not in json.dumps(data)
    assert "encrypted_token" not in data

    r = await client.patch(
        f"{PREFIX}/github/triggers", headers=headers,
        json={"on_release": True, "branch_filters": ["main"]},
    )
    assert r.json()["data"]["on_release"] is True

    r = await client.patch(
        f"{PREFIX}/github/issue-settings", headers=headers,
        json={"auto_create": True, "severity_threshold": "critical"},
    )
    assert r.json()["data"]["severity_threshold"] == "critical"


async def test_disconnect(auth, monkeypatch):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    await _connect(uid)

    async def fake_revoke(token):
        return None
    monkeypatch.setattr(gh, "revoke_token", fake_revoke)

    r = await client.post(f"{PREFIX}/github/disconnect", headers=headers)
    assert r.status_code == 204
    r = await client.get(f"{PREFIX}/github/status", headers=headers)
    assert r.json()["data"]["connected"] is False


# ---- Webhook endpoint -------------------------------------------------------
async def test_webhook_bad_signature_401(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    await _connect(uid)
    r = await client.post(
        f"{PREFIX}/github/webhook/{uid}",
        headers={"X-GitHub-Event": "push", "X-Hub-Signature-256": "sha256=bad"},
        content=b'{"ref": "refs/heads/main"}',
    )
    assert r.status_code == 401


async def test_webhook_triggers_scan(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    secret = await _connect(uid, triggers={"on_push": True, "branch_filters": ["main"]})

    body = json.dumps({
        "ref": "refs/heads/main", "after": "abc123",
        "repository": {"full_name": "user/ecommerce-api"},
    }).encode()
    sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    r = await client.post(
        f"{PREFIX}/github/webhook/{uid}",
        headers={"X-GitHub-Event": "push", "X-Hub-Signature-256": sig},
        content=body,
    )
    assert r.status_code == 200
    assert r.json()["data"]["triggered_scan_id"] is not None

    # Delivery logged.
    r = await client.get(f"{PREFIX}/github/deliveries", headers=headers)
    deliveries = r.json()["data"]
    assert any(d["event"] == "push" and d["triggered_scan_id"] for d in deliveries)


async def test_webhook_respects_selected_repo_access(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    secret = await _connect(
        uid, triggers={"on_push": True, "branch_filters": ["main"]},
        repo_access={"mode": "selected", "selected": ["user/allowed"]},
    )
    body = json.dumps({
        "ref": "refs/heads/main", "after": "abc",
        "repository": {"full_name": "user/not-allowed"},
    }).encode()
    sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    r = await client.post(
        f"{PREFIX}/github/webhook/{uid}",
        headers={"X-GitHub-Event": "push", "X-Hub-Signature-256": sig},
        content=body,
    )
    assert r.status_code == 200
    assert r.json()["data"]["triggered_scan_id"] is None  # blocked by access list


async def test_pr_webhook_scopes_to_changed_files(auth, monkeypatch):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    secret = await _connect(uid, triggers={"on_pull_request": True})

    async def fake_pr_files(token, repo, pr_number):
        return ["src/a.js", "src/b.js"]
    monkeypatch.setattr(gh, "list_pr_files", fake_pr_files)

    body = json.dumps({
        "action": "opened",
        "pull_request": {"number": 7, "head": {"ref": "feature", "sha": "abc"}},
        "repository": {"full_name": "user/ecommerce-api"},
    }).encode()
    sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    r = await client.post(
        f"{PREFIX}/github/webhook/{uid}",
        headers={"X-GitHub-Event": "pull_request", "X-Hub-Signature-256": sig},
        content=body,
    )
    sid = r.json()["data"]["triggered_scan_id"]
    assert sid
    async with SessionLocal() as db:
        scan = await db.get(Scan, sid)
        assert scan.path_filters == ["src/a.js", "src/b.js"]


async def test_register_webhook(auth, monkeypatch):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    await _connect(uid)

    async def fake_create(token, repo, url, secret):
        return {"id": 12345}
    monkeypatch.setattr(gh, "create_webhook", fake_create)

    r = await client.post(f"{PREFIX}/github/repos/user/ecommerce-api/webhook", headers=headers)
    assert r.status_code == 201
    assert r.json()["data"]["hook_id"] == 12345


async def test_webhook_unknown_user_404(client):
    r = await client.post(
        f"{PREFIX}/github/webhook/nonexistent-user",
        headers={"X-GitHub-Event": "push"},
        content=b"{}",
    )
    assert r.status_code == 404


# ---- Manual issue creation --------------------------------------------------
async def test_create_issue_for_finding(auth, monkeypatch):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    await _connect(uid)

    async with SessionLocal() as db:
        scan = Scan(user_id=uid, source_type="github", repo="user/ecommerce-api",
                    status=SCAN_COMPLETED)
        db.add(scan)
        await db.flush()
        f = Finding(scan_id=scan.id, public_id="VLN-0001", engine=ENGINE_SECURITY,
                    category="Injection", severity="critical", confidence="High",
                    file="a.js", line_start=1, line_end=3, explanation="sqli",
                    fix_summary="parameterize", cwe_id="CWE-89")
        db.add(f)
        await db.commit()
        fid = f.id

    async def fake_create(token, repo, title, body, labels=None, assignee=None):
        return {"html_url": "https://github.com/user/ecommerce-api/issues/7"}
    monkeypatch.setattr(gh, "create_issue", fake_create)

    r = await client.post(f"{PREFIX}/github/findings/{fid}/issue", headers=headers)
    assert r.status_code == 201
    assert "/issues/7" in r.json()["data"]["issue_url"]


# ---- Post-scan auto actions -------------------------------------------------
async def test_post_scan_creates_issues_above_threshold(auth, monkeypatch):
    from app.services.github_post_scan import run_post_scan_github

    client, headers, _ = auth
    uid = await _uid(client, headers)
    await _connect(uid, issue_settings={
        "auto_create": True, "severity_threshold": "high",
        "labels": ["security"], "label_mapping": {}, "template": "{public_id}: {explanation}",
    }, status_check={"post_commit_status": False})

    async with SessionLocal() as db:
        scan = Scan(user_id=uid, source_type="github", repo="user/x",
                    status=SCAN_COMPLETED, commit="abc")
        db.add(scan)
        await db.flush()
        db.add(Finding(scan_id=scan.id, public_id="VLN-0001", engine=ENGINE_SECURITY,
                       severity="critical", confidence="High", file="a.js",
                       line_start=1, line_end=2, explanation="x"))
        db.add(Finding(scan_id=scan.id, public_id="VLN-0002", engine=ENGINE_SECURITY,
                       severity="low", confidence="High", file="b.js",
                       line_start=1, line_end=2, explanation="y"))
        await db.commit()
        scan_id = scan.id

    created = []
    async def fake_create(token, repo, title, body, labels=None, assignee=None):
        created.append(title)
        return {"html_url": f"https://github.com/{repo}/issues/{len(created)}"}
    monkeypatch.setattr(gh, "create_issue", fake_create)

    await run_post_scan_github(scan_id)
    # Only the critical (>= high threshold) gets an issue, not the low.
    assert len(created) == 1
    assert "VLN-0001" in created[0]


# ---- Sign in with GitHub (auth flow) ----------------------------------------
@pytest.mark.asyncio
async def test_github_login_start_not_configured(client):
    """Without OAuth credentials, /auth/github/start returns a clear 503."""
    r = await client.get(f"{PREFIX}/auth/github/start")
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "github_not_configured"


@pytest.mark.asyncio
async def test_github_login_creates_user_and_issues_tokens(client, monkeypatch):
    """A GitHub callback for a new email creates a user and redirects with tokens."""
    from app.core.config import settings
    from app.core.security import create_access_token

    monkeypatch.setattr(settings, "github_client_id", "cid")
    monkeypatch.setattr(settings, "github_client_secret", "csec")

    async def fake_exchange(code, redirect_uri=None):
        return {"token": "ghp_login", "scopes": "read:user,user:email"}

    async def fake_user(token):
        return {"login": "newdev", "name": "New Dev", "avatar_url": "http://a/x.png", "email": None}

    async def fake_primary_email(token):
        return "newdev@example.com"

    monkeypatch.setattr(gh, "exchange_code", fake_exchange)
    monkeypatch.setattr(gh, "get_user", fake_user)
    monkeypatch.setattr(gh, "get_primary_email", fake_primary_email)

    state = create_access_token("github_login", purpose="github_login", nonce="n")
    r = await client.get(
        f"{PREFIX}/auth/github/callback",
        params={"code": "abc", "state": state},
        follow_redirects=False,
    )
    assert r.status_code == 303
    loc = r.headers["location"]
    assert "access_token=" in loc and "refresh_token=" in loc
    assert "#" in loc  # tokens go in the fragment

    # The user now exists and can be fetched by the issued access token.
    from urllib.parse import urlparse, parse_qs
    frag = parse_qs(urlparse(loc).fragment)
    at = frag["access_token"][0]
    me = await client.get(f"{PREFIX}/profile", headers={"Authorization": f"Bearer {at}"})
    assert me.status_code == 200
    assert me.json()["data"]["email"] == "newdev@example.com"


@pytest.mark.asyncio
async def test_github_login_bad_state_redirects_error(client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "github_client_id", "cid")
    monkeypatch.setattr(settings, "github_client_secret", "csec")

    r = await client.get(
        f"{PREFIX}/auth/github/callback",
        params={"code": "abc", "state": "not-a-valid-token"},
        follow_redirects=False,
    )
    assert r.status_code == 303
    assert "auth=error" in r.headers["location"]
