"""Profile update + security settings tests: password change, 2FA, sessions."""
import pyotp

from tests.conftest import PREFIX


async def test_get_and_update_profile(auth):
    client, headers, _ = auth
    r = await client.get(f"{PREFIX}/profile", headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["email"] == "demo@akira.ai"

    r = await client.patch(
        f"{PREFIX}/profile",
        headers=headers,
        json={"display_name": "Demo", "settings": {"theme": "dark"}},
    )
    data = r.json()["data"]
    assert data["display_name"] == "Demo"
    # settings merge keeps prior keys
    assert data["settings"]["theme"] == "dark"
    assert data["settings"]["default_scan_mode"] == "Deep"


async def test_change_password(auth):
    client, headers, _ = auth
    r = await client.post(
        f"{PREFIX}/security/change-password",
        headers=headers,
        json={"current_password": "supersecret123", "new_password": "newpassword456"},
    )
    assert r.status_code == 204
    # Old password no longer works.
    r2 = await client.post(
        f"{PREFIX}/auth/login",
        json={"email": "demo@akira.ai", "password": "supersecret123"},
    )
    assert r2.status_code == 401


async def test_change_password_wrong_current(auth):
    client, headers, _ = auth
    r = await client.post(
        f"{PREFIX}/security/change-password",
        headers=headers,
        json={"current_password": "wrong", "new_password": "newpassword456"},
    )
    assert r.status_code == 400


async def test_totp_enroll_verify_and_login(auth):
    client, headers, _ = auth
    r = await client.post(f"{PREFIX}/security/2fa/enroll", headers=headers)
    secret = r.json()["data"]["secret"]

    code = pyotp.TOTP(secret).now()
    r = await client.post(f"{PREFIX}/security/2fa/verify", headers=headers, json={"code": code})
    assert r.status_code == 200
    assert len(r.json()["data"]["codes"]) == 10

    # Login now requires a TOTP code.
    r = await client.post(
        f"{PREFIX}/auth/login",
        json={"email": "demo@akira.ai", "password": "supersecret123"},
    )
    assert r.json()["data"]["totp_required"] is True

    r = await client.post(
        f"{PREFIX}/auth/login",
        json={
            "email": "demo@akira.ai",
            "password": "supersecret123",
            "totp_code": pyotp.TOTP(secret).now(),
        },
    )
    assert r.json()["data"]["tokens"] is not None


async def test_sessions_list_and_revoke(auth):
    client, headers, _ = auth
    r = await client.get(f"{PREFIX}/security/sessions", headers=headers)
    sessions = r.json()["data"]
    assert len(sessions) >= 1
    sid = sessions[0]["id"]

    r = await client.delete(f"{PREFIX}/security/sessions/{sid}", headers=headers)
    assert r.status_code == 204

    r = await client.get(f"{PREFIX}/security/sessions", headers=headers)
    assert all(s["id"] != sid for s in r.json()["data"])


async def test_login_history(auth):
    client, headers, _ = auth
    r = await client.get(f"{PREFIX}/security/login-history", headers=headers)
    assert r.status_code == 200
    assert len(r.json()["data"]) >= 1
