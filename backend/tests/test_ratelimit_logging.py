"""Cross-cutting tests: rate limiting + correlation-id header."""
import app.core.ratelimit as rl
from app.core.logging import correlation_id, set_correlation_id
from tests.conftest import PREFIX


async def test_correlation_id_header_present(client):
    r = await client.get("/health")
    assert r.headers.get("X-Request-ID")


async def test_correlation_id_honored_from_client(client):
    r = await client.get("/health", headers={"X-Request-ID": "my-trace-123"})
    assert r.headers["X-Request-ID"] == "my-trace-123"


async def test_rate_limit_blocks_when_enabled(client, monkeypatch):
    # Enable limiting + clear the in-memory window.
    monkeypatch.setattr(rl.settings, "rate_limit_enabled", True)
    rl._local.clear()

    payload = {"email": "rl@b.com", "password": "password123"}
    await client.post(f"{PREFIX}/auth/register", json=payload)

    # login limit is 10/min; the 11th should 429.
    codes = []
    for _ in range(12):
        r = await client.post(f"{PREFIX}/auth/login", json=payload)
        codes.append(r.status_code)
    assert 429 in codes


def test_set_correlation_id_roundtrip():
    cid = set_correlation_id("abc")
    assert cid == "abc"
    assert correlation_id.get() == "abc"
