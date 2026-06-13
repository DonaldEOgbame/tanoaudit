"""Module 12 router: watchlist (pin/unpin, frequency, change detection,
due re-scans, one-click re-scan, alert badges).

Scheduled re-scans store `frequency` + `next_run_at`; a `/run-due` endpoint
triggers everything that's due. Real cron/worker firing is deferred to the
worker module — see KNOWN_LIMITATIONS.md.
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db, utcnow
from app.core.errors import bad_request, envelope, not_found
from app.models.repository import Repository
from app.models.scan import SCAN_COMPLETED, Scan
from app.models.user import User
from app.schemas.watchlist import (
    FrequencyUpdate,
    RepositoryOut,
    WatchRequest,
    WatchlistItem,
)
from app.services.orchestrator import run_scan
from app.services.repositories import compute_change, link_scan_to_repo

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


async def _owned_repo(db: AsyncSession, repo_id: str, user_id: str) -> Repository:
    repo = await db.get(Repository, repo_id)
    if repo is None or repo.user_id != user_id:
        raise not_found("Repository not found")
    return repo


async def _watchlist_item(db: AsyncSession, repo: Repository) -> dict:
    change = await compute_change(db, repo)
    score = None
    if repo.last_scan_id:
        scan = await db.get(Scan, repo.last_scan_id)
        score = scan.security_score if scan else None
    return WatchlistItem(
        id=repo.id, repo=repo.identifier, score=score,
        change=change["change_label"], change_dir=change["direction"],
        new_criticals=change["new_criticals"], freq=repo.frequency,
        last=repo.last_scanned_at,
    ).model_dump()


@router.get("/repositories")
async def list_repositories(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    github_only: bool = False,
):
    """The user's repositories (watched or not) — for plan/watchlist linking.

    `github_only=true` restricts to github-sourced repos and requires a live
    GitHub connection (used by the optimization-plan repo picker).
    """
    stmt = select(Repository).where(Repository.user_id == user.id)
    if github_only:
        from app.models.github import GitHubConnection
        conn = (
            await db.execute(
                select(GitHubConnection).where(GitHubConnection.user_id == user.id)
            )
        ).scalar_one_or_none()
        if conn is None:
            return envelope([])  # no connection -> no eligible repos
        stmt = stmt.where(Repository.source_type == "github")
    repos = (
        await db.execute(stmt.order_by(Repository.created_at.desc()))
    ).scalars().all()
    return envelope([RepositoryOut.model_validate(r).model_dump() for r in repos])


@router.get("")
async def list_watchlist(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    repos = (
        await db.execute(
            select(Repository).where(
                Repository.user_id == user.id, Repository.watched == True  # noqa: E712
            )
        )
    ).scalars().all()
    return envelope([await _watchlist_item(db, r) for r in repos])


@router.post("/{repo_id}/pin")
async def pin_repo(
    repo_id: str,
    body: WatchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = await _owned_repo(db, repo_id, user.id)
    repo.watched = True
    repo.frequency = body.frequency
    from app.services.repositories import _next_run
    repo.next_run_at = _next_run(body.frequency)
    await db.flush()
    return envelope(RepositoryOut.model_validate(repo).model_dump())


@router.post("/{repo_id}/unpin", status_code=204)
async def unpin_repo(
    repo_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = await _owned_repo(db, repo_id, user.id)
    repo.watched = False
    repo.next_run_at = None
    return  # 204


@router.patch("/{repo_id}/frequency")
async def set_frequency(
    repo_id: str,
    body: FrequencyUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = await _owned_repo(db, repo_id, user.id)
    repo.frequency = body.frequency
    from app.services.repositories import _next_run
    repo.next_run_at = _next_run(body.frequency) if repo.watched else None
    await db.flush()
    return envelope(RepositoryOut.model_validate(repo).model_dump())


@router.get("/alerts")
async def alert_badges(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Aggregate alert badge data: total new issues + new criticals across watched repos."""
    repos = (
        await db.execute(
            select(Repository).where(
                Repository.user_id == user.id, Repository.watched == True  # noqa: E712
            )
        )
    ).scalars().all()
    total_new = total_crit = repos_changed = 0
    for r in repos:
        change = await compute_change(db, r)
        total_new += change["new_issues"]
        total_crit += change["new_criticals"]
        if change["direction"] == "up":
            repos_changed += 1
    return envelope({
        "watched_repos": len(repos),
        "repos_with_new_findings": repos_changed,
        "new_issues": total_new,
        "new_criticals": total_crit,
    })


async def _rescan(db: AsyncSession, repo: Repository, background: BackgroundTasks) -> str | None:
    """Create a new scan reusing the repo's most recent scan config."""
    last = None
    if repo.last_scan_id:
        last = await db.get(Scan, repo.last_scan_id)
    new_scan = Scan(
        user_id=repo.user_id,
        source_type=last.source_type if last else repo.source_type,
        repo=repo.identifier,
        source_url=last.source_url if last else None,
        branch=last.branch if last else None,
        depth=last.depth if last else "deep",
        model_mode=last.model_mode if last else "auto",
        models=last.models if last else ["gemini", "openrouter"],
        include_custom=last.include_custom if last else True,
        include_optimization=last.include_optimization if last else True,
    )
    db.add(new_scan)
    await db.flush()
    await link_scan_to_repo(db, new_scan)
    scan_id = new_scan.id
    background.add_task(run_scan, scan_id)
    return scan_id


@router.post("/{repo_id}/rescan", status_code=201)
async def rescan_now(
    repo_id: str,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = await _owned_repo(db, repo_id, user.id)
    scan_id = await _rescan(db, repo, background)
    return envelope({"scan_id": scan_id})


@router.post("/run-due")
async def run_due(
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger re-scans for all watched repos whose next_run_at is due.

    A scheduler/worker would call this periodically; exposed as an endpoint so
    it's testable and usable without cron infra.
    """
    now = utcnow()
    repos = (
        await db.execute(
            select(Repository).where(
                Repository.user_id == user.id,
                Repository.watched == True,  # noqa: E712
                Repository.next_run_at.is_not(None),
                Repository.next_run_at <= now,
            )
        )
    ).scalars().all()
    triggered = []
    for repo in repos:
        scan_id = await _rescan(db, repo, background)
        triggered.append({"repository_id": repo.id, "scan_id": scan_id})
    return envelope({"triggered": triggered, "count": len(triggered)})
