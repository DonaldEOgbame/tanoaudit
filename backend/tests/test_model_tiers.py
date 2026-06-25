"""Server-side model tiers + daily scan limit (no BYO keys).

Covers: the public tier catalog hides vendors, the router resolves a tier to the
right server key + concrete model and labels attribution without a vendor name,
and the daily scan cap returns a 429 with resets_in_seconds.
"""
import json
from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.services import model_catalog
from app.services.router_factory import build_router_for_scan
from tests.conftest import PREFIX

_VENDOR_WORDS = ["openrouter", "gemini", "claude", "anthropic", "llama", "openai", "google"]


# ---- catalog ---------------------------------------------------------------
def test_public_catalog_hides_vendors():
    blob = json.dumps(model_catalog.public_tiers()).lower()
    for w in _VENDOR_WORDS:
        assert w not in blob, f"vendor leak in catalog: {w}"
    ids = {t["id"] for t in model_catalog.public_tiers()}
    assert ids == {"akira_fast", "akira_balanced", "akira_deep"}


def test_resolve_tier_to_provider_model():
    # All tiers now run on the OpenRouter provider (Gemini is a fallback only).
    assert model_catalog.resolve("akira_fast") == ("openrouter", settings.tier_fast_model)
    assert model_catalog.resolve("akira_deep") == ("openrouter", settings.tier_deep_model)
    # Unknown id -> default tier, never a crash.
    assert model_catalog.resolve("nope") == model_catalog.resolve(model_catalog.DEFAULT_TIER)


async def test_models_endpoint_vendor_free(auth):
    client, headers, _ = auth
    r = await client.get(f"{PREFIX}/scans/models", headers=headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["default"] == model_catalog.DEFAULT_TIER
    blob = json.dumps(data).lower()
    for w in _VENDOR_WORDS:
        assert w not in blob
    # Never exposes the underlying provider/model fields.
    for t in data["tiers"]:
        assert set(t.keys()) == {"id", "label", "description"}


# ---- router uses SERVER keys + tier model ----------------------------------
async def test_router_injects_server_keys_and_tier_model(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "server-gem")
    monkeypatch.setattr(settings, "openrouter_api_key", "server-or")
    scan = SimpleNamespace(model_mode="manual", models=["akira_deep"], user_id="u1", id="s1")
    r = await build_router_for_scan(scan)
    assert r.has_any_key()
    assert r.keys["openrouter"] == "server-or"          # server key, not user's
    assert r.models["openrouter"] == settings.tier_deep_model  # concrete tier model
    assert r.order[0] == "openrouter"                   # selected tier preferred
    # Attribution label is the Akira tier, never the vendor.
    assert r.label_for("openrouter") == "Akira Deep"
    assert "openrouter" not in r.label_for("openrouter").lower()


async def test_router_no_keys_has_no_key(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", None)
    monkeypatch.setattr(settings, "openrouter_api_key", None)
    scan = SimpleNamespace(model_mode="auto", models=[], user_id="u1", id="s1")
    r = await build_router_for_scan(scan)
    assert not r.has_any_key()  # deploy misconfig -> orchestrator uses placeholder


# ---- daily scan limit ------------------------------------------------------
async def test_daily_scan_limit_blocks_with_reset(auth, monkeypatch):
    monkeypatch.setattr(settings, "daily_scan_limit", 2)
    client, headers, _ = auth

    def body(n):
        return {"source_type": "url", "source_url": f"https://example.com/r{n}.git"}

    # First two succeed.
    for n in range(2):
        r = await client.post(f"{PREFIX}/scans", headers=headers, json=body(n))
        assert r.status_code == 201, r.text

    # Third is blocked with a 429 carrying resets_in_seconds.
    r = await client.post(f"{PREFIX}/scans", headers=headers, json=body(99))
    assert r.status_code == 429
    err = r.json()["error"]
    assert err["code"] == "daily_limit_reached"
    assert err["resets_in_seconds"] > 0
    assert err["remaining"] == 0


async def test_scan_limit_status_endpoint(auth, monkeypatch):
    monkeypatch.setattr(settings, "daily_scan_limit", 5)
    client, headers, _ = auth
    r = await client.get(f"{PREFIX}/scans/limit", headers=headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["limit"] == 5
    assert data["used"] == 0
    assert data["remaining"] == 5
