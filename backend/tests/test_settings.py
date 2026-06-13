"""Module 2 tests: API key storage/masking/test, model prefs, privacy."""
import pytest

import app.api.settings as settings_api
from tests.conftest import PREFIX


async def test_upsert_and_mask_key(auth):
    client, headers, _ = auth
    r = await client.put(
        f"{PREFIX}/settings/api-keys",
        headers=headers,
        json={"provider": "gemini", "key": "AIzaSyD-secret-value-aTf2"},
    )
    assert r.status_code == 200
    data = r.json()["data"]
    # Never returns the full key; only last 4 chars after the mask.
    assert data["masked"].endswith("aTf2")
    assert "secret" not in data["masked"]
    assert data["status"] == "unverified"


async def test_upsert_replaces_not_duplicates(auth):
    client, headers, _ = auth
    for key in ("sk-or-first_000000", "sk-or-second_11111"):
        await client.put(
            f"{PREFIX}/settings/api-keys",
            headers=headers,
            json={"provider": "openrouter", "key": key},
        )
    r = await client.get(f"{PREFIX}/settings/api-keys", headers=headers)
    openrouter_keys = [k for k in r.json()["data"] if k["provider"] == "openrouter"]
    assert len(openrouter_keys) == 1
    assert openrouter_keys[0]["masked"].endswith("1111")


async def test_test_key_endpoint_marks_valid(auth, monkeypatch):
    client, headers, _ = auth
    await client.put(
        f"{PREFIX}/settings/api-keys",
        headers=headers,
        json={"provider": "gemini", "key": "AIzaSyD-secret-value-aTf2"},
    )

    async def fake_test(provider, key):
        assert key == "AIzaSyD-secret-value-aTf2"  # decrypted round-trip
        return True, "ok"

    monkeypatch.setattr(settings_api, "test_provider_key", fake_test)

    r = await client.post(f"{PREFIX}/settings/api-keys/gemini/test", headers=headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "valid"
    assert data["last_verified_at"] is not None


async def test_test_key_marks_invalid(auth, monkeypatch):
    client, headers, _ = auth
    await client.put(
        f"{PREFIX}/settings/api-keys",
        headers=headers,
        json={"provider": "openrouter", "key": "sk-or-bad_key_value"},
    )

    async def fake_test(provider, key):
        return False, "invalid key"

    monkeypatch.setattr(settings_api, "test_provider_key", fake_test)
    r = await client.post(f"{PREFIX}/settings/api-keys/openrouter/test", headers=headers)
    assert r.json()["data"]["status"] == "invalid"


async def test_test_key_missing_404(auth):
    client, headers, _ = auth
    r = await client.post(f"{PREFIX}/settings/api-keys/openrouter/test", headers=headers)
    assert r.status_code == 404


async def test_delete_key(auth):
    client, headers, _ = auth
    await client.put(
        f"{PREFIX}/settings/api-keys",
        headers=headers,
        json={"provider": "github", "key": "ghp_token_value_xyz"},
    )
    r = await client.delete(f"{PREFIX}/settings/api-keys/github", headers=headers)
    assert r.status_code == 204
    r = await client.get(f"{PREFIX}/settings/api-keys", headers=headers)
    assert all(k["provider"] != "github" for k in r.json()["data"])


async def test_invalid_provider_rejected(auth):
    client, headers, _ = auth
    r = await client.put(
        f"{PREFIX}/settings/api-keys",
        headers=headers,
        json={"provider": "openai", "key": "sk-whatever-value"},
    )
    assert r.status_code == 422


async def test_model_settings_roundtrip(auth):
    client, headers, _ = auth
    r = await client.get(f"{PREFIX}/settings/models", headers=headers)
    assert r.json()["data"]["fallback_order"] == ["gemini", "openrouter"]

    r = await client.put(
        f"{PREFIX}/settings/models",
        headers=headers,
        json={
            "default_model": "Gemini 2.0 Flash",
            "fallback_order": ["openrouter", "gemini"],
            "token_budgets": {"Gemini 2.0 Flash": 60},
        },
    )
    data = r.json()["data"]
    assert data["fallback_order"][0] == "openrouter"
    assert data["token_budgets"]["Gemini 2.0 Flash"] == 60

    # Persisted across requests.
    r = await client.get(f"{PREFIX}/settings/models", headers=headers)
    assert r.json()["data"]["default_model"] == "Gemini 2.0 Flash"


async def test_privacy_toggles(auth):
    client, headers, _ = auth
    r = await client.put(
        f"{PREFIX}/settings/privacy",
        headers=headers,
        json={"improve_ai": False, "store_scan_history": False},
    )
    assert r.json()["data"]["improve_ai"] is False
    r = await client.get(f"{PREFIX}/settings/privacy", headers=headers)
    assert r.json()["data"]["store_scan_history"] is False
