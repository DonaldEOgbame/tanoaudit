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
from app.core.security import ACCESS, decode_token
from app.models.scan import Scan
from app.services import scan_events as ev

router = APIRouter(tags=["scans"])


async def _authorize(scan_id: str, token: str | None) -> str | None:
    """Return user_id if the token is valid and owns the scan, else None."""
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
    return user_id


@router.websocket("/scans/{scan_id}/ws")
async def scan_ws(websocket: WebSocket, scan_id: str):
    token = websocket.query_params.get("token")
    user_id = await _authorize(scan_id, token)
    if user_id is None:
        await websocket.close(code=4401)  # unauthorized
        return

    await websocket.accept()
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
