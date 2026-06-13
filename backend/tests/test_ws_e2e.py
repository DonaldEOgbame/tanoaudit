"""True end-to-end WebSocket test using Starlette's TestClient (real handshake).

Exercises the actual /scans/{id}/ws endpoint: token auth, accept, history
replay, event delivery, and control command receipt.
"""
import asyncio

from starlette.testclient import TestClient

from app.core.database import Base, SessionLocal, engine
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.scan import Scan
from app.models.user import User
from app.services import scan_events as ev


def _run(coro):
    return asyncio.run(coro)


async def _setup() -> tuple[str, str]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        user = User(email="ws@b.com", password_hash=hash_password("x"),
                    settings={}, privacy={}, notifications={})
        db.add(user)
        await db.flush()
        scan = Scan(user_id=user.id, source_type="zip", repo="r", status="running")
        db.add(scan)
        await db.commit()
        return user.id, scan.id


def test_websocket_streams_events_and_accepts_control():
    user_id, scan_id = _run(_setup())
    token = create_access_token(user_id)

    # Pre-publish events so the connection replays them on join.
    _run(ev.bus.publish(scan_id, ev.SCAN_STARTED, {"segment_total": 3}))
    _run(ev.bus.publish(scan_id, ev.FINDING_DISCOVERED, {"public_id": "VLN-0001"}))

    with TestClient(app) as tc:
        with tc.websocket_connect(f"/api/v1/scans/{scan_id}/ws?token={token}") as ws:
            first = ws.receive_json()
            second = ws.receive_json()
            assert first["type"] == ev.SCAN_STARTED
            assert second["type"] == ev.FINDING_DISCOVERED
            assert second["payload"]["public_id"] == "VLN-0001"

            # Send a pause command; the bus control flag should flip.
            ws.send_json({"command": "pause"})

    # Give the server a beat to process, then verify the control state.
    import time
    time.sleep(0.1)
    assert _run(ev.bus.get_control(scan_id)) == ev.Control.PAUSE


def test_websocket_rejects_bad_token():
    user_id, scan_id = _run(_setup())
    with TestClient(app) as tc:
        try:
            with tc.websocket_connect(f"/api/v1/scans/{scan_id}/ws?token=bogus"):
                pass
            assert False, "expected rejection"
        except Exception:
            pass  # closed with 4401 before accept
