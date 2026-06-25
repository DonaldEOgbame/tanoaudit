"""Module 13 router: handoff token generate / consume / list / revoke."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db, utcnow
from app.core.errors import APIError, envelope, not_found, unauthorized
from app.core.ratelimit import rate_limit
from app.models.handoff import (
    EVT_CONSUMED,
    EVT_GENERATED,
    HandoffEvent,
    HandoffToken,
)
from app.models.scan import Scan
from app.models.user import User
from app.schemas.handoff import (
    HandoffGenerateRequest,
    HandoffGenerateResponse,
    HandoffLinkOut,
)
from app.services import handoff as ho

router = APIRouter(tags=["handoff"])


async def _owned_scan(db: AsyncSession, scan_id: str, user_id: str) -> Scan:
    scan = await db.get(Scan, scan_id)
    if scan is None or scan.user_id != user_id:
        raise not_found("Audit not found")
    return scan


@router.post("/audits/{audit_id}/handoff/generate", status_code=201,
             dependencies=[rate_limit(20, 3600, scope="handoff")])
async def generate_handoff(
    audit_id: str,
    body: HandoffGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scan = await _owned_scan(db, audit_id, user.id)
    if await ho.active_token_count(db, user.id) >= ho.MAX_ACTIVE_TOKENS:
        raise APIError(
            "too_many_tokens",
            f"You have reached the limit of {ho.MAX_ACTIVE_TOKENS} active handoff links.",
            429,
        )
    result = await ho.create_handoff(db, scan, body.scope, body.finding_ids)
    db.add(HandoffEvent(
        user_id=user.id, audit_id=audit_id, kind=EVT_GENERATED,
        detail={"scope": body.scope, "finding_count": result.finding_count,
                "expires_at": result.token.expires_at.isoformat()},
    ))
    await db.flush()
    return envelope(HandoffGenerateResponse(
        url=result.url, expires_at=result.token.expires_at,
        finding_count=result.finding_count,
    ).model_dump())


@router.get("/audits/{audit_id}/handoff", response_class=PlainTextResponse)
async def consume_handoff(
    audit_id: str,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Consume a handoff link → structured markdown. Single-use; marks used.

    Unauthenticated (token-in-URL is the auth). Invalid/expired/used/revoked all
    return a generic 401 with no info leakage.
    """
    valid = await ho.validate_token(db, audit_id, token)
    if valid is None:
        raise unauthorized("Invalid or expired handoff link")

    scan = await db.get(Scan, audit_id)
    if scan is None:
        raise unauthorized("Invalid or expired handoff link")

    findings = await ho.select_findings(db, audit_id, valid.scope, valid.finding_ids)
    attack_paths = await ho.select_attack_paths(db, audit_id, findings)
    valid.used_at = utcnow()  # single-use
    db.add(HandoffEvent(
        user_id=valid.user_id, audit_id=audit_id, kind=EVT_CONSUMED,
        detail={"finding_count": len(findings)},
    ))
    # Commit before notifying: notify() opens its own session, and SQLite allows
    # only one writer at a time.
    await db.commit()

    from app.models.notification import N_HANDOFF_CONSUMED
    from app.services.notifications import notify
    await notify(
        valid.user_id, N_HANDOFF_CONSUMED, f"Handoff consumed for {scan.repo or audit_id}",
        f"{len(findings)} finding(s) were fetched via the handoff link.",
        link={"scan_id": audit_id},
    )
    return ho.render_handoff_markdown(scan, findings, attack_paths)


@router.get("/handoff-links")
async def list_handoff_links(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(
            select(HandoffToken)
            .where(HandoffToken.user_id == user.id)
            .order_by(HandoffToken.created_at.desc())
        )
    ).scalars().all()
    out = []
    for t in rows:
        d = HandoffLinkOut.model_validate(t).model_dump()
        d["status"] = ho.token_status(t)
        out.append(d)
    return envelope(out)


@router.delete("/handoff-links/{token_id}", status_code=204)
async def revoke_handoff_link(
    token_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    t = await db.get(HandoffToken, token_id)
    if t is None or t.user_id != user.id:
        raise not_found("Handoff link not found")
    t.revoked = True
    return  # 204
