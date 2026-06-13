"""Module 9 tests: custom-vuln CRUD, research pipeline + events, scan wiring."""
import pytest

from app.core.database import SessionLocal
from app.models.scan import Scan
from app.services.research import (
    RESEARCH_STARTED,
    SEARCH_QUERY_SENT,
    SEARCH_RESULTS_RECEIVED,
    SYNTHESIZING,
    RESEARCH_COMPLETED,
    SearchConfig,
    build_queries,
    run_research,
)
from app.services.router_model import ModelRouter
from tests.conftest import PREFIX


async def _uid(client, headers):
    r = await client.get(f"{PREFIX}/profile", headers=headers)
    return r.json()["data"]["id"]


# ---- CRUD -------------------------------------------------------------------
async def test_crud_lifecycle(auth):
    client, headers, _ = auth
    r = await client.post(
        f"{PREFIX}/custom-vulnerabilities", headers=headers,
        json={"name": "Leaked Slack webhook", "description": "hooks.slack.com in source", "severity": "high"},
    )
    assert r.status_code == 201
    vid = r.json()["data"]["id"]
    assert r.json()["data"]["active"] is True

    # toggle inactive
    r = await client.patch(
        f"{PREFIX}/custom-vulnerabilities/{vid}", headers=headers, json={"active": False}
    )
    assert r.json()["data"]["active"] is False

    r = await client.get(f"{PREFIX}/custom-vulnerabilities", headers=headers)
    assert len(r.json()["data"]) == 1

    r = await client.delete(f"{PREFIX}/custom-vulnerabilities/{vid}", headers=headers)
    assert r.status_code == 204
    r = await client.get(f"{PREFIX}/custom-vulnerabilities", headers=headers)
    assert r.json()["data"] == []


async def test_ownership_enforced(auth):
    client, headers, _ = auth
    async with SessionLocal() as db:
        from app.models.custom_vuln import CustomVulnerability
        v = CustomVulnerability(user_id="someone-else", name="x")
        db.add(v)
        await db.commit()
        vid = v.id
    r = await client.patch(
        f"{PREFIX}/custom-vulnerabilities/{vid}", headers=headers, json={"active": False}
    )
    assert r.status_code == 404


# ---- Research pipeline (unit) -----------------------------------------------
def test_build_queries():
    qs = build_queries("SQL injection", "raw queries")
    assert len(qs) == 3
    assert any("SQL injection" in q for q in qs)


def test_search_provider_precedence():
    assert SearchConfig().provider == "stub"
    assert SearchConfig(serpapi_key="s").provider == "serpapi"
    assert SearchConfig(tavily_key="t", serpapi_key="s").provider == "tavily"


async def test_tavily_used_when_keyed(monkeypatch):
    import app.services.research as research
    seen = {}

    async def fake_tavily(query, key):
        seen["key"] = key
        from app.services.research import SearchResult
        return [SearchResult(title="t", url="https://x", snippet="s")]

    monkeypatch.setattr(research, "_tavily_search", fake_tavily)
    results = await research._search("q", SearchConfig(tavily_key="tav-key"))
    assert seen["key"] == "tav-key"
    assert results[0].url == "https://x"


async def test_run_research_event_sequence():
    router = ModelRouter(keys={}, order=["gemini"])  # no keys -> fallback synth
    events = []
    definition = None
    # No search keys -> stub provider.
    async for et, payload in run_research("Leaked webhook", "slack urls", router, SearchConfig()):
        events.append(et)
        if et == RESEARCH_COMPLETED:
            definition = payload["definition"]

    assert events[0] == RESEARCH_STARTED
    assert SEARCH_QUERY_SENT in events
    assert SEARCH_RESULTS_RECEIVED in events
    assert SYNTHESIZING in events
    assert events[-1] == RESEARCH_COMPLETED
    assert definition["what_it_is"]  # fallback populated it
    assert isinstance(definition["source_urls"], list)


# ---- Research endpoint (SSE) ------------------------------------------------
async def test_research_endpoint_streams_and_persists(auth):
    client, headers, _ = auth
    r = await client.post(
        f"{PREFIX}/custom-vulnerabilities/research", headers=headers,
        json={"name": "Hardcoded internal token", "description": "acme_sk_ prefix"},
    )
    assert r.status_code == 200
    body = r.text
    assert "event: research_started" in body
    assert "event: search_query_sent" in body
    assert "event: research_completed" in body
    assert "event: saved" in body

    # A researched custom vuln was persisted.
    r = await client.get(f"{PREFIX}/custom-vulnerabilities", headers=headers)
    rows = r.json()["data"]
    assert len(rows) == 1
    assert rows[0]["researched"] is True
    assert rows[0]["what_it_is"]


# ---- Scan wiring ------------------------------------------------------------
async def test_active_custom_vulns_feed_scan_prompt(auth):
    from app.services.orchestrator import _load_custom_vulns

    client, headers, _ = auth
    uid = await _uid(client, headers)
    await client.post(
        f"{PREFIX}/custom-vulnerabilities", headers=headers,
        json={"name": "Active rule", "description": "d", "active": True},
    )
    await client.post(
        f"{PREFIX}/custom-vulnerabilities", headers=headers,
        json={"name": "Inactive rule", "description": "d", "active": False},
    )
    async with SessionLocal() as db:
        scan = Scan(user_id=uid, source_type="zip", repo="r", include_custom=True)
        db.add(scan)
        await db.commit()
        targets = await _load_custom_vulns(scan)
    joined = " ".join(targets)
    assert "Active rule" in joined
    assert "Inactive rule" not in joined


async def test_custom_vulns_skipped_when_disabled(auth):
    from app.services.orchestrator import _load_custom_vulns

    client, headers, _ = auth
    uid = await _uid(client, headers)
    await client.post(
        f"{PREFIX}/custom-vulnerabilities", headers=headers,
        json={"name": "Rule", "active": True},
    )
    async with SessionLocal() as db:
        scan = Scan(user_id=uid, source_type="zip", repo="r", include_custom=False)
        db.add(scan)
        await db.commit()
        assert await _load_custom_vulns(scan) == []
