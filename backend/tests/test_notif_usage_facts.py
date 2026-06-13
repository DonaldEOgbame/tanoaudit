"""Modules 15/16/17 tests: notifications, usage tracking, fun facts."""
import pytest

from app.core.database import SessionLocal
from app.models.scan import Scan, SCAN_COMPLETED
from app.services.email import sent_outbox
from app.services.fun_facts_seed import FACTS, seed_fun_facts
from app.services.notifications import notify
from app.services.usage import record_usage
from tests.conftest import PREFIX


async def _uid(client, headers):
    r = await client.get(f"{PREFIX}/profile", headers=headers)
    return r.json()["data"]["id"]


# ---- Notifications ----------------------------------------------------------
async def test_notification_prefs_roundtrip(auth):
    client, headers, _ = auth
    r = await client.get(f"{PREFIX}/notifications/preferences", headers=headers)
    assert r.json()["data"]["scan_complete"] is True

    r = await client.put(
        f"{PREFIX}/notifications/preferences", headers=headers,
        json={"scan_complete": False, "critical_found": True,
              "watchlist_changed": True, "weekly_digest": True, "in_app": True},
    )
    assert r.json()["data"]["scan_complete"] is False
    assert r.json()["data"]["weekly_digest"] is True


async def test_in_app_notification_lifecycle(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    await notify(uid, "scan_complete", "Scan done", "body", link={"scan_id": "x"})
    await notify(uid, "critical_found", "Critical!", "body")

    r = await client.get(f"{PREFIX}/notifications", headers=headers)
    items = r.json()["data"]
    assert len(items) == 2

    r = await client.get(f"{PREFIX}/notifications/unread-count", headers=headers)
    assert r.json()["data"]["unread"] == 2

    nid = items[0]["id"]
    await client.post(f"{PREFIX}/notifications/{nid}/read", headers=headers)
    r = await client.get(f"{PREFIX}/notifications/unread-count", headers=headers)
    assert r.json()["data"]["unread"] == 1

    await client.post(f"{PREFIX}/notifications/read-all", headers=headers)
    r = await client.get(f"{PREFIX}/notifications/unread-count", headers=headers)
    assert r.json()["data"]["unread"] == 0

    r = await client.delete(f"{PREFIX}/notifications/{nid}", headers=headers)
    assert r.status_code == 204


async def test_email_sent_when_pref_on(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    # Enable the scan_complete email pref.
    await client.put(
        f"{PREFIX}/notifications/preferences", headers=headers,
        json={"scan_complete": True, "critical_found": True,
              "watchlist_changed": True, "weekly_digest": False, "in_app": True},
    )
    sent_outbox.clear()
    await notify(uid, "scan_complete", "Scan done", "body")
    # SMTP unconfigured -> recorded in the outbox.
    assert any(e["subject"] == "Scan done" for e in sent_outbox)


async def test_email_not_sent_when_pref_off(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    await client.put(
        f"{PREFIX}/notifications/preferences", headers=headers,
        json={"scan_complete": False, "critical_found": True,
              "watchlist_changed": True, "weekly_digest": False, "in_app": True},
    )
    sent_outbox.clear()
    await notify(uid, "scan_complete", "Quiet", "body")
    assert not any(e["subject"] == "Quiet" for e in sent_outbox)
    # But the in-app record is still created.
    r = await client.get(f"{PREFIX}/notifications", headers=headers)
    assert any(n["title"] == "Quiet" for n in r.json()["data"])


# ---- Usage ------------------------------------------------------------------
async def test_usage_aggregate(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    await record_usage(uid, "gemini", "gemini-2.0-flash", 100, 50, purpose="scan")
    await record_usage(uid, "gemini", "gemini-2.0-flash", 80, 40, purpose="chat")
    await record_usage(uid, "groq", "llama-3.3", 60, 30, purpose="scan")

    # A completed scan for this month + lifetime segments.
    async with SessionLocal() as db:
        db.add(Scan(user_id=uid, source_type="zip", repo="r",
                    status=SCAN_COMPLETED, segments_analyzed=12))
        await db.commit()

    r = await client.get(f"{PREFIX}/usage", headers=headers)
    data = r.json()["data"]
    calls = {c["provider"]: c["calls"] for c in data["api_calls_by_provider"]}
    assert calls["gemini"] == 2 and calls["groq"] == 1
    assert data["scans_this_month"] == 1
    assert data["lifetime_segments"] == 12
    assert data["session"]["tokens"] == 100 + 50 + 80 + 40 + 60 + 30
    assert "last_updated" in data


async def test_usage_isolated_per_user(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    await record_usage("other-user", "gemini", "m", 999, 999)
    await record_usage(uid, "gemini", "m", 10, 10)
    r = await client.get(f"{PREFIX}/usage", headers=headers)
    total = sum(c["calls"] for c in r.json()["data"]["api_calls_by_provider"])
    assert total == 1  # only this user's call


# ---- Weekly digest ----------------------------------------------------------
async def test_weekly_digest_opt_in(auth):
    from app.services.digest import send_weekly_digests

    client, headers, _ = auth
    uid = await _uid(client, headers)
    await client.put(
        f"{PREFIX}/notifications/preferences", headers=headers,
        json={"scan_complete": True, "critical_found": True,
              "watchlist_changed": True, "weekly_digest": True, "in_app": True},
    )
    # A scan this week gives the digest content.
    async with SessionLocal() as db:
        db.add(Scan(user_id=uid, source_type="zip", repo="user/x",
                    status=SCAN_COMPLETED, segments_analyzed=5))
        await db.commit()

    sent = await send_weekly_digests()
    assert sent >= 1
    r = await client.get(f"{PREFIX}/notifications", headers=headers)
    assert any(n["type"] == "weekly_digest" for n in r.json()["data"])


# ---- Fun facts --------------------------------------------------------------
def test_fact_pool_size():
    assert len(FACTS) >= 40


async def test_seed_and_shuffle(client):
    added = await seed_fun_facts()
    assert added >= 40
    # Idempotent.
    assert await seed_fun_facts() == 0

    r = await client.get(f"{PREFIX}/fun-facts?count=5")
    facts = r.json()["data"]
    assert len(facts) == 5
    assert all(isinstance(f, str) for f in facts)


async def test_fun_facts_no_auth_needed(client):
    await seed_fun_facts()
    r = await client.get(f"{PREFIX}/fun-facts")
    assert r.status_code == 200
    assert len(r.json()["data"]) >= 1
