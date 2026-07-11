"""Module 18 tests: the seed script produces a complete, usable demo."""
import pytest

from app.seed import DEMO_EMAIL, DEMO_PASSWORD, run_seed
from tests.conftest import PREFIX


async def test_seed_produces_complete_demo(client):
    result = await run_seed()
    assert result["email"] == DEMO_EMAIL
    assert result["scan_id"]

    # The demo user can log in.
    r = await client.post(
        f"{PREFIX}/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    assert r.status_code == 200
    tokens = r.json()["data"]["tokens"]
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # The demo scan is present and completed with the expected scores.
    r = await client.get(f"{PREFIX}/scans", headers=headers)
    scans = r.json()["data"]["items"]
    assert len(scans) == 1
    demo = scans[0]
    assert demo["repo"] == "user/ecommerce-api"
    assert demo["status"] == "completed"
    assert demo["security_score"] == 38
    assert demo["optimization_score"] == 64

    # Findings (with criticals) are queryable.
    r = await client.get(f"{PREFIX}/scans/{demo['id']}/findings", headers=headers)
    findings = r.json()["data"]
    assert len(findings) == 19  # 12 security + 3 optimization + 4 stub
    assert any(f["public_id"] == "VLN-0001" for f in findings)

    # Stub engine demo findings are present and carry stub-specific fields.
    stubs = [f for f in findings if f["engine"] == "stub"]
    assert len(stubs) == 4
    crit_stub = next(f for f in stubs if f["public_id"] == "STB-0001")
    assert crit_stub["severity"] == "critical"
    assert crit_stub["stub_category"] == "Incomplete"
    assert crit_stub["risk_if_shipped"]
    assert demo["completeness_score"] == 52

    # No per-user API keys: the server holds provider keys. The demo user has a
    # default TanoAudit tier preference instead.
    r = await client.get(f"{PREFIX}/settings/models", headers=headers)
    assert r.json()["data"]["default_tier"] == "tanoaudit_balanced"

    # Optimization plan + watched repo.
    r = await client.get(f"{PREFIX}/watchlist", headers=headers)
    assert len(r.json()["data"]) == 1
    r = await client.get(f"{PREFIX}/optimization-plans", headers=headers)
    plans = r.json()["data"]
    assert len(plans) == 1 and len(plans[0]["goals"]) == 5

    # Reference data: learning hub + fun facts.
    r = await client.get(f"{PREFIX}/learning-hub/classes?limit=1")
    assert r.json()["data"]["total"] >= 187
    r = await client.get(f"{PREFIX}/fun-facts?count=10")
    assert len(r.json()["data"]) == 10


async def test_seed_is_idempotent(client):
    await run_seed()
    await run_seed()  # second run must not duplicate
    r = await client.post(
        f"{PREFIX}/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    headers = {"Authorization": f"Bearer {r.json()['data']['tokens']['access_token']}"}
    r = await client.get(f"{PREFIX}/scans", headers=headers)
    assert len(r.json()["data"]["items"]) == 1  # not duplicated


async def test_seed_repairs_corrupt_password_hash(client):
    """A stale/corrupt password hash on an existing demo user must be repaired by
    re-seeding, so the demo account can never get locked out."""
    from sqlalchemy import select
    from app.core.database import SessionLocal
    from app.models.user import User

    await run_seed()

    # Corrupt the stored hash, simulating an old/incompatible bcrypt artifact.
    async with SessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == DEMO_EMAIL))).scalar_one()
        user.password_hash = "$2b$12$" + "x" * 53
        db.add(user)
        await db.commit()

    # Login is broken with the corrupt hash.
    r = await client.post(
        f"{PREFIX}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    assert r.status_code == 401

    # Re-seeding repairs it.
    await run_seed()
    r = await client.post(
        f"{PREFIX}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    assert r.status_code == 200
