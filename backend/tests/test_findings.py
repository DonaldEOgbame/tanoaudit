"""Module 7 tests: false-positive marking, suppressions, fix streaming."""
import pytest

from app.core.database import SessionLocal
from app.models.scan import Finding, Scan, SCAN_COMPLETED, ENGINE_SECURITY
from app.services.fix_generator import stream_full_fix, _fallback_fix
from tests.conftest import PREFIX


async def _uid(client, headers):
    r = await client.get(f"{PREFIX}/profile", headers=headers)
    return r.json()["data"]["id"]


async def _seed(user_id, repo="user/ecommerce-api"):
    async with SessionLocal() as db:
        scan = Scan(
            user_id=user_id, source_type="zip", repo=repo, status=SCAN_COMPLETED,
            files=1, segment_total=1,
        )
        db.add(scan)
        await db.flush()
        f = Finding(
            scan_id=scan.id, public_id="VLN-0001", engine=ENGINE_SECURITY,
            category="Injection", subcategory="SQL Injection", severity="critical",
            confidence="High", file="src/a.js", line_start=41, line_end=43,
            code_snippet="db.raw(sql)", explanation="raw sql",
            fix_summary="parameterize", fix_snippet="db('t').where(...)",
        )
        db.add(f)
        await db.commit()
        return scan.id, f.id


@pytest.fixture
async def seeded(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    scan_id, finding_id = await _seed(uid)
    return client, headers, scan_id, finding_id


async def test_mark_and_unmark_false_positive(seeded):
    client, headers, _, fid = seeded
    r = await client.post(
        f"{PREFIX}/findings/{fid}/false-positive",
        headers=headers, json={"reason": "test fixture, not real"},
    )
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "false_positive"

    # A suppression rule was created.
    r = await client.get(f"{PREFIX}/suppressions", headers=headers)
    rules = r.json()["data"]
    assert len(rules) == 1
    assert rules[0]["category"] == "Injection"
    assert rules[0]["origin_finding_id"] == fid

    # Unmark -> back to open, rule removed.
    r = await client.delete(f"{PREFIX}/findings/{fid}/false-positive", headers=headers)
    assert r.json()["data"]["status"] == "open"
    r = await client.get(f"{PREFIX}/suppressions", headers=headers)
    assert r.json()["data"] == []


async def test_mark_fixed(seeded):
    client, headers, _, fid = seeded
    r = await client.post(f"{PREFIX}/findings/{fid}/fixed", headers=headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "fixed"
    assert data["fixed_via"] == "manual"
    assert data["fixed_at"] is not None


async def test_finding_ownership_enforced(auth):
    client, headers, _ = auth
    # Another user's finding.
    other = await _seed("someone-else", repo="other/repo")
    r = await client.post(
        f"{PREFIX}/findings/{other[1]}/fixed", headers=headers
    )
    assert r.status_code == 404


async def test_suppression_feeds_next_scan_prompt(auth):
    """Suppressions for the repo are loaded into the orchestrator's prompt ctx."""
    from app.services.orchestrator import _load_suppressions

    client, headers, _ = auth
    uid = await _uid(client, headers)
    scan_id, fid = await _seed(uid)
    await client.post(
        f"{PREFIX}/findings/{fid}/false-positive",
        headers=headers, json={"reason": "fp"},
    )
    async with SessionLocal() as db:
        scan = await db.get(Scan, scan_id)
        sup = await _load_suppressions(scan)
    assert any("Injection" in s for s in sup)
    assert any("src/a.js" in s for s in sup)


# ---- Fix streaming ----------------------------------------------------------
async def test_fix_stream_fallback_unit():
    f = Finding(
        scan_id="s", public_id="VLN-1", engine=ENGINE_SECURITY, category="Injection",
        severity="critical", confidence="High", file="a.js", line_start=1, line_end=3,
        code_snippet="x", explanation="e", fix_summary="parameterize",
        fix_snippet="safe()",
    )
    chunks = [c async for c in stream_full_fix(f, None)]
    text = "".join(chunks)
    assert "parameterize" in text
    assert len(chunks) >= 1


async def test_fix_endpoint_streams_sse(seeded):
    client, headers, _, fid = seeded
    r = await client.post(f"{PREFIX}/findings/{fid}/fix", headers=headers)
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    body = r.text
    assert "data:" in body
    assert '"done": true' in body
    assert "parameterize" in body
