"""WebSocket endpoint for live scan progress + control commands.

Connect: GET /api/v1/scans/{scan_id}/ws?token=<access_token>
(WebSocket can't carry an Authorization header from the browser, so the access
token is passed as a query param and validated the same way as REST.)

Server -> client: {"type": <event>, "payload": {...}} for every scan event.
On connect, buffered history is replayed so late joiners catch up.

Client -> server: {"command": "pause" | "resume" | "cancel"}.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SessionLocal
from app.models.scan import (
    SCAN_CANCELLED,
    SCAN_COMPLETED,
    SCAN_FAILED,
    Scan,
)
from app.core.security import ACCESS, decode_token
from app.services import scan_events as ev

router = APIRouter(tags=["scans"])

# Scan statuses from which no further events will ever be published.
_TERMINAL = {SCAN_COMPLETED, SCAN_FAILED, SCAN_CANCELLED}


async def _authorize(scan_id: str, token: str | None) -> Scan | None:
    """Return the owned Scan if the token is valid and owns it, else None."""
    if not token:
        return None
    try:
        payload = decode_token(token, expected_type=ACCESS)
    except Exception:
        return None
    user_id = payload.get("sub")
    async with SessionLocal() as db:  # type: AsyncSession
        scan = await db.get(Scan, scan_id)
    if scan is None or scan.user_id != user_id:
        return None
    return scan


def _terminal_event(scan: Scan) -> dict | None:
    """Synthesize the terminal event for an already-finished scan, so a late
    joiner (or a reconnect after the in-memory event buffer was lost, e.g. a
    server restart, or a scan run in a separate worker process) still learns the
    real outcome instead of spinning at 0% forever."""
    if scan.status == SCAN_COMPLETED:
        return {"type": ev.SCAN_COMPLETED, "payload": {
            "security_score": scan.security_score,
            "optimization_score": scan.optimization_score,
            "segments_unparsed": scan.segments_unparsed,
            "report_id": scan.id,
        }}
    if scan.status == SCAN_FAILED:
        return {"type": ev.SCAN_FAILED, "payload": {"error": scan.error or "Scan failed."}}
    if scan.status == SCAN_CANCELLED:
        return {"type": ev.SCAN_CANCELLED, "payload": {}}
    return None


@router.websocket("/scans/{scan_id}/ws")
async def scan_ws(websocket: WebSocket, scan_id: str):
    token = websocket.query_params.get("token")
    scan = await _authorize(scan_id, token)
    if scan is None:
        await websocket.close(code=4401)  # unauthorized
        return

    await websocket.accept()

    # If the scan already finished, the in-memory event buffer may be empty (late
    # join, a server restart, or a scan run in a separate worker process). Send
    # the DB-derived terminal event and close — the client transitions to its
    # done/error state.
    if scan.status in _TERMINAL:
        buffered = await ev.bus.replay(scan_id)
        for evt in buffered:
            await websocket.send_json(evt)
        # Only synthesize the terminal event if the replay didn't already carry
        # one (avoids a duplicate scan_failed/completed for in-process late joins).
        already_terminal = any(
            e.get("type") in (ev.SCAN_COMPLETED, ev.SCAN_FAILED, ev.SCAN_CANCELLED)
            for e in buffered
        )
        if not already_terminal:
            term = _terminal_event(scan)
            if term is not None:
                await websocket.send_json(term)
        await websocket.close()
        return

    # Subscribe BEFORE replaying, so any event published in the gap between the
    # status read above and now is delivered live through the queue rather than
    # missed (if the scan terminates here, its terminal event arrives on the
    # subscription and the client transitions normally).
    queue = await ev.bus.subscribe(scan_id)

    # Replay buffered events so a late joiner sees prior progress.
    for evt in await ev.bus.replay(scan_id):
        await websocket.send_json(evt)

    async def pump_events() -> None:
        while True:
            evt = await queue.get()
            await websocket.send_json(evt)

    async def pump_commands() -> None:
        while True:
            msg = await websocket.receive_json()
            cmd = (msg or {}).get("command")
            if cmd == "pause":
                await ev.bus.set_control(scan_id, ev.Control.PAUSE)
            elif cmd == "resume":
                await ev.bus.set_control(scan_id, ev.Control.RUNNING)
            elif cmd == "cancel":
                await ev.bus.set_control(scan_id, ev.Control.CANCEL)

    sender = asyncio.create_task(pump_events())
    receiver = asyncio.create_task(pump_commands())
    try:
        await asyncio.wait({sender, receiver}, return_when=asyncio.FIRST_COMPLETED)
    except WebSocketDisconnect:
        pass
    finally:
        sender.cancel()
        receiver.cancel()
        ev.bus.unsubscribe(scan_id, queue)
