"""Module 2 tests: model tier preference + privacy.

Users no longer provide API keys (the server holds provider keys), so the
api-key endpoints are gone. Preference is just the default Akira tier.
"""
from tests.conftest import PREFIX


async def test_api_key_endpoints_removed(auth):
    """The BYO api-key surface is fully gone (404, not a silent success)."""
    client, headers, _ = auth
    r = await client.put(
        f"{PREFIX}/settings/api-keys",
        headers=headers,
        json={"provider": "gemini", "key": "AIzaSyD-secret-value-aTf2"},
    )
    assert r.status_code == 404
    r = await client.get(f"{PREFIX}/settings/api-keys", headers=headers)
    assert r.status_code == 404


async def test_model_settings_default_tier_roundtrip(auth):
    client, headers, _ = auth
    r = await client.get(f"{PREFIX}/settings/models", headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["default_tier"]  # some default tier

    r = await client.put(
        f"{PREFIX}/settings/models",
        headers=headers,
        json={"default_tier": "akira_deep"},
    )
    assert r.status_code == 200
    assert r.json()["data"]["default_tier"] == "akira_deep"

    # Persisted across requests.
    r = await client.get(f"{PREFIX}/settings/models", headers=headers)
    assert r.json()["data"]["default_tier"] == "akira_deep"


async def test_model_settings_rejects_unknown_tier(auth):
    client, headers, _ = auth
    r = await client.put(
        f"{PREFIX}/settings/models",
        headers=headers,
        json={"default_tier": "gpt5_ultra"},
    )
    assert r.status_code == 400


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
