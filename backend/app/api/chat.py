"""Module 8 router: scoped report chat.

GET  /scans/{id}/chat        -> info (exec summary first message, counters)
POST /scans/{id}/chat        -> SSE stream of the assistant reply

The strict system prompt is built server-side and never appears in any response
payload. Off-topic / jailbreak attempts are short-circuited to a brief redirect
and logged (silently) for monitoring.
"""
from __future__ import annotations

import json
from datetime import timedelta

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import SessionLocal, get_db, utcnow
from app.core.errors import APIError, envelope, not_found
from app.models.attack_path import AttackPath
from app.models.chat import ChatLog
from app.models.scan import Finding, Scan
from app.models.user import User
from app.schemas.chat import ChatInfo, ChatRequest
from app.services.router_factory import build_router_for_chat
from app.services.scoped_chat import (
    REFUSAL,
    build_messages,
    build_system_prompt,
    flatten_for_completion,
    looks_like_jailbreak,
)

router = APIRouter(tags=["chat"])

RATE_LIMIT_PER_HOUR = 30
MAX_CONVERSATION = 50


async def _owned_scan(db: AsyncSession, scan_id: str, user_id: str) -> Scan:
    scan = await db.get(Scan, scan_id)
    if scan is None or scan.user_id != user_id:
        raise not_found("Scan not found")
    return scan


async def _recent_count(db: AsyncSession, scan_id: str, user_id: str) -> int:
    since = utcnow() - timedelta(hours=1)
    return (
        await db.execute(
            select(func.count())
            .select_from(ChatLog)
            .where(
                ChatLog.scan_id == scan_id,
                ChatLog.user_id == user_id,
                ChatLog.created_at >= since,
            )
        )
    ).scalar_one()


@router.get("/scans/{scan_id}/chat")
async def chat_info(
    scan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scan = await _owned_scan(db, scan_id, user.id)
    total = (
        await db.execute(
            select(func.count()).select_from(ChatLog).where(ChatLog.scan_id == scan_id)
        )
    ).scalar_one()
    recent = await _recent_count(db, scan_id, user.id)
    return envelope(ChatInfo(
        executive_summary=scan.executive_summary,
        message_count=total,
        messages_remaining_this_hour=max(0, RATE_LIMIT_PER_HOUR - recent),
    ).model_dump())


@router.post("/scans/{scan_id}/chat")
async def chat(
    scan_id: str,
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scan = await _owned_scan(db, scan_id, user.id)

    # 50-message conversation cap (client sends history; count its turns).
    if len(body.messages) >= MAX_CONVERSATION:
        raise APIError(
            "conversation_full",
            "This conversation has reached its limit. Clear it to continue.",
            409,
        )

    # 30 messages/hour/scan rate limit.
    if await _recent_count(db, scan_id, user.id) >= RATE_LIMIT_PER_HOUR:
        raise APIError("rate_limited", "Chat rate limit reached. Try again later.", 429)

    findings = (
        await db.execute(select(Finding).where(Finding.scan_id == scan_id))
    ).scalars().all()
    attack_paths = (
        await db.execute(
            select(AttackPath).where(AttackPath.scan_id == scan_id)
            .order_by(AttackPath.public_id)
        )
    ).scalars().all()

    flagged = looks_like_jailbreak(body.message)
    user_id = user.id

    if flagged:
        # Short-circuit: never reach the model; log silently; redirect briefly.
        log = ChatLog(
            user_id=user_id, scan_id=scan_id, user_message=body.message,
            assistant_message=REFUSAL, flagged=True, refused=True,
        )
        db.add(log)
        await db.flush()

        async def refusal_stream():
            yield f"data: {json.dumps({'delta': REFUSAL})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

        return StreamingResponse(refusal_stream(), media_type="text/event-stream")

    # Build the strict prompt + provider call.
    system_prompt = build_system_prompt(scan, findings, attack_paths)
    history = [{"role": m.role, "content": m.content} for m in body.messages]
    messages = build_messages(system_prompt, history, body.message)
    # Keep the flattened prompt as a fallback (used by the no-key path below),
    # but pass structured messages to the router so providers that support native
    # chat roles (Gemini systemInstruction, OpenAI-style messages) use them.
    prompt = flatten_for_completion(messages)
    router_obj = await build_router_for_chat(user_id, body.tier, purpose="chat")
    message_text = body.message

    summary_fallback = scan.executive_summary or "No findings context is available to answer that."

    async def event_stream():
        collected: list[str] = []
        if router_obj.has_any_key():
            # Real provider-side token streaming with structured messages so the
            # system prompt is honoured as a genuine system role.
            async for delta in router_obj.stream(prompt, messages=messages):
                collected.append(delta)
                yield f"data: {json.dumps({'delta': delta})}\n\n"
            reply = "".join(collected) or REFUSAL
            if not collected:
                # Provider produced nothing — emit the refusal text.
                yield f"data: {json.dumps({'delta': REFUSAL})}\n\n"
        else:
            # No keys: stream a summary-derived reply in chunks.
            reply = summary_fallback
            for i in range(0, len(reply), 40):
                yield f"data: {json.dumps({'delta': reply[i:i+40]})}\n\n"

        # Persist the turn.
        async with SessionLocal() as s:
            s.add(ChatLog(
                user_id=user_id, scan_id=scan_id, user_message=message_text,
                assistant_message=reply, flagged=False, refused=False,
            ))
            await s.commit()
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
