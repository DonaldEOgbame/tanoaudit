"""Email-OTP 2FA tests: enroll, login challenge + auto-send, method preference."""
import re

import pytest

from app.services.email import sent_outbox
from tests.conftest import PREFIX


async def _extract_code() -> str:
    # The most recent outbox email contains "code is NNNNNN".
    body = sent_outbox[-1]["body"]
    return re.search(r"code is (\d{6})", body).group(1)


async def test_email_otp_enroll_and_login(auth):
    client, headers, _ = auth
    sent_outbox.clear()

    # Enroll -> code emailed.
    r = await client.post(f"{PREFIX}/security/2fa/email/enroll", headers=headers)
    assert r.status_code == 200 and r.json()["data"]["sent"] is True
    code = await _extract_code()

    # Verify -> email OTP enabled, becomes the active method.
    r = await client.post(f"{PREFIX}/security/2fa/email/verify", headers=headers,
                          json={"code": code})
    data = r.json()["data"]
    assert data["email_otp_enabled"] is True and data["method"] == "email"

    # Now login requires the second factor; correct password alone auto-sends a code.
    sent_outbox.clear()
    r = await client.post(f"{PREFIX}/auth/login",
                          json={"email": "demo@akira.ai", "password": "supersecret123"})
    body = r.json()["data"]
    assert body["totp_required"] is True and body["method"] == "email"
    assert body["tokens"] is None
    login_code = await _extract_code()  # auto-sent

    # Supplying the emailed code completes login.
    r = await client.post(f"{PREFIX}/auth/login",
                          json={"email": "demo@akira.ai", "password": "supersecret123",
                                "totp_code": login_code})
    assert r.json()["data"]["tokens"] is not None


async def test_email_otp_wrong_code_rejected(auth):
    client, headers, _ = auth
    sent_outbox.clear()
    await client.post(f"{PREFIX}/security/2fa/email/enroll", headers=headers)
    r = await client.post(f"{PREFIX}/security/2fa/email/verify", headers=headers,
                          json={"code": "000000"})
    assert r.status_code == 400


async def test_email_otp_disable(auth):
    client, headers, _ = auth
    sent_outbox.clear()
    await client.post(f"{PREFIX}/security/2fa/email/enroll", headers=headers)
    code = await _extract_code()
    await client.post(f"{PREFIX}/security/2fa/email/verify", headers=headers,
                      json={"code": code})

    r = await client.post(f"{PREFIX}/security/2fa/email/disable", headers=headers)
    assert r.status_code == 204
    r = await client.get(f"{PREFIX}/security/2fa/status", headers=headers)
    assert r.json()["data"]["email_otp_enabled"] is False
    assert r.json()["data"]["method"] is None

    # Login no longer challenges.
    r = await client.post(f"{PREFIX}/auth/login",
                          json={"email": "demo@akira.ai", "password": "supersecret123"})
    assert r.json()["data"]["tokens"] is not None


async def test_2fa_status_default(auth):
    client, headers, _ = auth
    r = await client.get(f"{PREFIX}/security/2fa/status", headers=headers)
    d = r.json()["data"]
    assert d == {"totp_enabled": False, "email_otp_enabled": False, "method": None}


async def test_method_preference_with_both(auth):
    import pyotp
    client, headers, _ = auth
    sent_outbox.clear()

    # Enable email OTP.
    await client.post(f"{PREFIX}/security/2fa/email/enroll", headers=headers)
    await client.post(f"{PREFIX}/security/2fa/email/verify", headers=headers,
                      json={"code": await _extract_code()})
    # Enable TOTP too -> becomes active method.
    r = await client.post(f"{PREFIX}/security/2fa/enroll", headers=headers)
    secret = r.json()["data"]["secret"]
    await client.post(f"{PREFIX}/security/2fa/verify", headers=headers,
                      json={"code": pyotp.TOTP(secret).now()})
    r = await client.get(f"{PREFIX}/security/2fa/status", headers=headers)
    assert r.json()["data"]["method"] == "totp"  # TOTP preferred

    # Switch the active method to email.
    r = await client.put(f"{PREFIX}/security/2fa/method?method=email", headers=headers)
    assert r.json()["data"]["method"] == "email"
