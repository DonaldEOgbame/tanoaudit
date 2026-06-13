"""Modules 10 + 12 tests: repositories, optimization plans, goals, watchlist."""
import pytest

from app.core.database import SessionLocal, utcnow
from app.models.optimization_plan import OptimizationGoal, OptimizationPlan
from app.models.repository import Repository
from app.models.scan import Finding, Scan, SCAN_COMPLETED, ENGINE_SECURITY, STATUS_FIXED
from app.services.goal_tracking import (
    advance_goals_for_repo,
    plan_health,
    plan_progress,
)
from app.services.repositories import resolve_or_create_repo, compute_change
from tests.conftest import PREFIX


async def _uid(client, headers):
    r = await client.get(f"{PREFIX}/profile", headers=headers)
    return r.json()["data"]["id"]


async def _make_repo(user_id, identifier="user/ecommerce-api") -> str:
    async with SessionLocal() as db:
        repo = await resolve_or_create_repo(db, user_id, identifier, "github")
        await db.commit()
        return repo.id


# ---- Repository resolution --------------------------------------------------
async def test_resolve_or_create_is_idempotent(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    async with SessionLocal() as db:
        r1 = await resolve_or_create_repo(db, uid, "user/x", "github")
        await db.commit()
        id1 = r1.id
    async with SessionLocal() as db:
        r2 = await resolve_or_create_repo(db, uid, "user/x", "github")
        await db.commit()
        assert r2.id == id1  # same repo, not a duplicate


async def test_github_only_repos_filter(auth):
    from app.core.security import encrypt_secret
    from app.models.github import GitHubConnection

    client, headers, _ = auth
    uid = await _uid(client, headers)
    # A github repo and a zip repo.
    async with SessionLocal() as db:
        await resolve_or_create_repo(db, uid, "user/gh-repo", "github")
        await resolve_or_create_repo(db, uid, "uploaded.zip", "zip")
        await db.commit()

    # Without a GitHub connection, github_only returns nothing.
    r = await client.get(f"{PREFIX}/watchlist/repositories?github_only=true", headers=headers)
    assert r.json()["data"] == []

    # With a connection, only the github repo is returned.
    async with SessionLocal() as db:
        db.add(GitHubConnection(user_id=uid, encrypted_token=encrypt_secret("t"),
                                webhook_secret="s"))
        await db.commit()
    r = await client.get(f"{PREFIX}/watchlist/repositories?github_only=true", headers=headers)
    idents = [x["identifier"] for x in r.json()["data"]]
    assert idents == ["user/gh-repo"]


async def test_scan_creation_links_repository(auth):
    client, headers, _ = auth
    r = await client.post(
        f"{PREFIX}/scans", headers=headers,
        json={"source_type": "github", "repo": "user/linked-repo"},
    )
    scan_id = r.json()["data"]["id"]
    # The repo now appears in the repositories list.
    r = await client.get(f"{PREFIX}/watchlist/repositories", headers=headers)
    idents = [x["identifier"] for x in r.json()["data"]]
    assert "user/linked-repo" in idents


# ---- Optimization plans -----------------------------------------------------
@pytest.fixture
async def repo_ctx(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    repo_id = await _make_repo(uid)
    return client, headers, uid, repo_id


async def test_plan_crud_and_health(repo_ctx):
    client, headers, _, repo_id = repo_ctx
    r = await client.post(
        f"{PREFIX}/optimization-plans", headers=headers,
        json={"repository_id": repo_id, "name": "Q3 Latency", "priority": "High",
              "goals": [{"text": "Eliminate N+1 queries", "status": "Done"},
                        {"text": "Add indexes", "status": "Pending"}]},
    )
    assert r.status_code == 201
    plan = r.json()["data"]
    assert plan["health"] == 50  # 1 of 2 done
    assert len(plan["goals"]) == 2
    plan_id = plan["id"]

    # Add a goal -> health recomputes (1 of 3 done).
    r = await client.post(
        f"{PREFIX}/optimization-plans/{plan_id}/goals", headers=headers,
        json={"text": "CDN for assets", "status": "Pending"},
    )
    assert r.json()["data"]["health"] == 33

    r = await client.get(f"{PREFIX}/optimization-plans", headers=headers)
    assert len(r.json()["data"]) == 1


async def test_plan_requires_owned_repo(repo_ctx):
    client, headers, _, _ = repo_ctx
    r = await client.post(
        f"{PREFIX}/optimization-plans", headers=headers,
        json={"repository_id": "nonexistent", "name": "X"},
    )
    assert r.status_code == 400


async def test_goal_update_and_delete(repo_ctx):
    client, headers, _, repo_id = repo_ctx
    r = await client.post(
        f"{PREFIX}/optimization-plans", headers=headers,
        json={"repository_id": repo_id, "name": "P", "goals": [{"text": "g1"}]},
    )
    plan = r.json()["data"]
    goal_id = plan["goals"][0]["id"]
    r = await client.patch(
        f"{PREFIX}/optimization-plans/goals/{goal_id}", headers=headers,
        json={"status": "Done"},
    )
    assert r.json()["data"]["health"] == 100
    r = await client.delete(f"{PREFIX}/optimization-plans/goals/{goal_id}", headers=headers)
    assert r.status_code == 204


# ---- Plan validation (SSE) --------------------------------------------------
async def test_validate_flags_vague_goals(repo_ctx):
    client, headers, _, repo_id = repo_ctx
    r = await client.post(
        f"{PREFIX}/optimization-plans/validate", headers=headers,
        json={"repository_id": repo_id, "goals": ["make it faster", "Cut p95 latency by 30%"]},
    )
    assert r.status_code == 200
    body = r.text
    assert "event: validating" in body
    # "make it faster" is vague -> issues_found (heuristic, no keys).
    assert "event: issues_found" in body


# ---- Goal auto-advance ------------------------------------------------------
async def test_goal_autoadvance_from_findings(repo_ctx):
    client, headers, uid, repo_id = repo_ctx
    # Plan with one goal.
    async with SessionLocal() as db:
        plan = OptimizationPlan(user_id=uid, repository_id=repo_id, name="P")
        db.add(plan)
        await db.flush()
        goal = OptimizationGoal(plan_id=plan.id, text="Fix injection", status="Pending")
        db.add(goal)
        await db.flush()
        # A scan with two findings tagged to this goal, both fixed.
        scan = Scan(user_id=uid, repository_id=repo_id, source_type="zip",
                    repo="user/ecommerce-api", status=SCAN_COMPLETED)
        db.add(scan)
        await db.flush()
        for pid in ("VLN-0001", "VLN-0002"):
            db.add(Finding(
                scan_id=scan.id, public_id=pid, engine=ENGINE_SECURITY,
                severity="high", confidence="High", file="a.js",
                line_start=1, line_end=2, plan_id=plan.id, goal_id=goal.id,
                status=STATUS_FIXED,
            ))
        await db.commit()
        goal_id = goal.id

    await advance_goals_for_repo(repo_id)
    async with SessionLocal() as db:
        goal = await db.get(OptimizationGoal, goal_id)
        assert goal.status == "Done"  # all tagged findings fixed


def test_health_and_progress_helpers():
    G = lambda s: OptimizationGoal(plan_id="p", text="x", status=s)
    goals = [G("Done"), G("In progress"), G("Pending")]
    assert plan_health(goals) == 33  # 1/3 done
    assert plan_progress(goals) == 50  # (1 + .5 + 0)/3


# ---- Watchlist --------------------------------------------------------------
async def test_pin_unpin_and_frequency(repo_ctx):
    client, headers, _, repo_id = repo_ctx
    r = await client.post(
        f"{PREFIX}/watchlist/{repo_id}/pin", headers=headers,
        json={"frequency": "daily"},
    )
    assert r.status_code == 200
    assert r.json()["data"]["watched"] is True
    assert r.json()["data"]["next_run_at"] is not None

    r = await client.get(f"{PREFIX}/watchlist", headers=headers)
    assert len(r.json()["data"]) == 1
    assert r.json()["data"][0]["freq"] == "daily"

    r = await client.patch(
        f"{PREFIX}/watchlist/{repo_id}/frequency", headers=headers,
        json={"frequency": "weekly"},
    )
    assert r.json()["data"]["frequency"] == "weekly"

    r = await client.post(f"{PREFIX}/watchlist/{repo_id}/unpin", headers=headers)
    assert r.status_code == 204
    r = await client.get(f"{PREFIX}/watchlist", headers=headers)
    assert r.json()["data"] == []


async def test_change_detection(repo_ctx):
    client, headers, uid, repo_id = repo_ctx
    # Two completed scans with a new finding in the newer one.
    async with SessionLocal() as db:
        repo = await db.get(Repository, repo_id)
        older = Scan(user_id=uid, repository_id=repo_id, source_type="zip",
                     repo="user/ecommerce-api", status=SCAN_COMPLETED,
                     completed_at=utcnow(), security_score=40)
        db.add(older)
        await db.flush()
        db.add(Finding(scan_id=older.id, public_id="VLN-0001", engine=ENGINE_SECURITY,
                       category="Injection", severity="high", confidence="High",
                       file="a.js", line_start=10, line_end=12))
        await db.flush()
        import asyncio
        newer = Scan(user_id=uid, repository_id=repo_id, source_type="zip",
                     repo="user/ecommerce-api", status=SCAN_COMPLETED,
                     completed_at=utcnow(), security_score=30)
        db.add(newer)
        await db.flush()
        db.add(Finding(scan_id=newer.id, public_id="VLN-0001", engine=ENGINE_SECURITY,
                       category="Injection", severity="high", confidence="High",
                       file="a.js", line_start=10, line_end=12))
        db.add(Finding(scan_id=newer.id, public_id="VLN-0002", engine=ENGINE_SECURITY,
                       category="XSS", severity="critical", confidence="High",
                       file="b.js", line_start=5, line_end=6))
        repo.last_scan_id = newer.id
        await db.commit()
        change = await compute_change(db, repo)
    assert change["new_issues"] == 1      # VLN-0002 is new
    assert change["new_criticals"] == 1
    assert change["direction"] == "up"


async def test_run_due_triggers_rescans(repo_ctx):
    client, headers, uid, repo_id = repo_ctx
    # Pin daily, then force next_run_at into the past.
    await client.post(f"{PREFIX}/watchlist/{repo_id}/pin", headers=headers,
                      json={"frequency": "daily"})
    async with SessionLocal() as db:
        from datetime import timedelta
        repo = await db.get(Repository, repo_id)
        repo.next_run_at = utcnow() - timedelta(hours=1)
        await db.commit()

    r = await client.post(f"{PREFIX}/watchlist/run-due", headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["count"] == 1


async def test_alerts_aggregate(repo_ctx):
    client, headers, _, repo_id = repo_ctx
    await client.post(f"{PREFIX}/watchlist/{repo_id}/pin", headers=headers,
                      json={"frequency": "manual"})
    r = await client.get(f"{PREFIX}/watchlist/alerts", headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["watched_repos"] == 1
