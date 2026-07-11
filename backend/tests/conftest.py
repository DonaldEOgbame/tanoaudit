"""Test fixtures: in-memory SQLite, ASGI client, helper to register+login."""
from __future__ import annotations

import os
import tempfile

# Don't load the real .env into the test config (it may have real keys set).
os.environ["TANOAUDIT_TESTING"] = "1"

# A temp *file* DB (not :memory:) so the orchestrator's separate sessions —
# which run in background tasks on their own connections — share state.
_db_path = os.path.join(tempfile.gettempdir(), "tanoaudit_test.db")
os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{_db_path}")
os.environ.setdefault("FERNET_KEY", "X43ZaXmyDjfp88SFRC8ISRZMvv8a9XCWobN_PO6tdO4=")
os.environ.setdefault("JWT_SECRET", "test-secret")
# Disable rate limiting in tests (the in-memory window would accumulate across
# the many shared-IP login calls).
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

PREFIX = "/api/v1"


@pytest_asyncio.fixture
async def client():
    # Fresh schema per test for isolation.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def auth(client):
    """Register + login a user; return (client, headers, tokens)."""
    email = "demo@tanoaudit.ai"
    password = "supersecret123"
    await client.post(f"{PREFIX}/auth/register", json={"email": email, "password": password})
    r = await client.post(f"{PREFIX}/auth/login", json={"email": email, "password": password})
    tokens = r.json()["data"]["tokens"]
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    return client, headers, tokens
