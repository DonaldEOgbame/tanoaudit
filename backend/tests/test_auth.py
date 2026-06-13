"""Auth flow tests: register, login, refresh, logout, envelope shape."""
import pytest

from tests.conftest import PREFIX


async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["error"] is None and body["data"]["status"] == "ok"


async def test_register_and_envelope(client):
    r = await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "a@b.com", "password": "password123"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["error"] is None
    assert body["data"]["email"] == "a@b.com"
    assert body["data"]["totp_enabled"] is False


async def test_duplicate_register_conflicts(client):
    payload = {"email": "dup@b.com", "password": "password123"}
    await client.post(f"{PREFIX}/auth/register", json=payload)
    r = await client.post(f"{PREFIX}/auth/register", json=payload)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "conflict"


async def test_login_returns_tokens(client):
    await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "c@b.com", "password": "password123"},
    )
    r = await client.post(
        f"{PREFIX}/auth/login",
        json={"email": "c@b.com", "password": "password123"},
    )
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["totp_required"] is False
    assert data["tokens"]["access_token"]
    assert data["tokens"]["token_type"] == "bearer"


async def test_login_wrong_password_401(client):
    await client.post(
        f"{PREFIX}/auth/register",
        json={"email": "d@b.com", "password": "password123"},
    )
    r = await client.post(
        f"{PREFIX}/auth/login",
        json={"email": "d@b.com", "password": "wrong"},
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


async def test_refresh_rotates_access_token(auth):
    client, _, tokens = auth
    r = await client.post(
        f"{PREFIX}/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert r.status_code == 200
    assert r.json()["data"]["access_token"]


async def test_logout_revokes_session(auth):
    client, _, tokens = auth
    r = await client.post(f"{PREFIX}/auth/logout", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 204
    # Refresh should now fail against the revoked session.
    r2 = await client.post(
        f"{PREFIX}/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert r2.status_code == 401


async def test_protected_route_requires_token(client):
    r = await client.get(f"{PREFIX}/profile")
    assert r.status_code == 401
