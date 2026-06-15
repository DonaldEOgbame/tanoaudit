"""Tests for the stub & placeholder detection engine.

Covers: response parsing of the `stubs` array, completeness scoring, content-hash
based intentional suppression, the full pipeline against a planted-stub fixture,
the intentional re-scan flow (suppress -> re-scan -> auto-suppressed -> change
code -> resurfaces), and the mark/unmark/generate-implementation endpoints.
"""
import json

import pytest

from app.core.database import SessionLocal
from app.models.scan import (
    ENGINE_STUB,
    SCAN_COMPLETED,
    STATUS_INTENTIONAL,
    STATUS_OPEN,
    Finding,
    Scan,
)
from app.models.suppression import IntentionalStubSuppression, stub_content_hash
from app.services import scoring
from app.services.analysis import parse_analysis
from app.services.orchestrator import run_scan
from tests.conftest import PREFIX


async def _current_user_id(client, headers) -> str:
    r = await client.get(f"{PREFIX}/profile", headers=headers)
    return r.json()["data"]["id"]


# A fake provider that flags an empty auth middleware as a Critical Incomplete
# stub whenever it sees the planted marker, and otherwise reports clean.
def _make_fake_complete(stub_code="next()"):
    def _stub_hit():
        return {
            "security": [], "optimizations": [],
            "stubs": [{
                "category": "Incomplete", "severity": "Critical", "confidence": "High",
                "line_start": 1, "line_end": 3, "code_snippet": stub_code,
                "explanation": "Auth middleware does nothing and calls next().",
                "completion_suggestion": "verify a JWT and reject missing/invalid tokens",
                "risk_if_shipped": "Authentication is completely bypassed.",
            }],
            "segment_scores": {"security_risk": 0, "optimization_score": 100, "completeness_score": 0},
        }

    def _clean():
        return {"security": [], "optimizations": [], "stubs": [],
                "segment_scores": {"security_risk": 0, "optimization_score": 100, "completeness_score": 100}}

    async def fake_complete(prompt: str, model_hint):
        import re as _re
        # Batch prompt: result per "### SEGMENT i ... ```code```" block.
        if "### SEGMENT 0" in prompt:
            blocks = _re.findall(r"### SEGMENT (\d+).*?```\n(.*?)\n```", prompt, _re.DOTALL)
            results = {i: (_stub_hit() if "TODO: implement auth" in code else _clean())
                       for i, code in blocks}
            return json.dumps({"results": results})
        return json.dumps(_stub_hit() if "TODO: implement auth" in prompt else _clean())
    return fake_complete


# ---- Unit: parsing ----------------------------------------------------------
def test_parse_stubs_array():
    raw = json.dumps({
        "security": [], "optimizations": [],
        "stubs": [{
            "category": "Stub", "severity": "Low", "confidence": "High",
            "line_start": 4, "line_end": 4, "code_snippet": "# TODO: fix",
            "explanation": "leftover TODO", "completion_suggestion": "",
            "risk_if_shipped": "",
        }],
        "segment_scores": {"security_risk": 0, "optimization_score": 100, "completeness_score": 80},
    })
    result = parse_analysis(raw)
    assert result is not None
    assert len(result.stubs) == 1
    assert result.stubs[0].category == "Stub"
    assert result.segment_scores.completeness_score == 80


def test_parse_missing_stubs_defaults_empty():
    # Old-shape responses (no stubs key) still parse with an empty stub list and
    # a default completeness_score of 100.
    raw = '{"security": [], "optimizations": [], "segment_scores": {"security_risk": 0, "optimization_score": 90}}'
    result = parse_analysis(raw)
    assert result is not None
    assert result.stubs == []
    assert result.segment_scores.completeness_score == 100


# ---- Unit: scoring ----------------------------------------------------------
class _F:
    def __init__(self, sev):
        self.severity = sev


def test_completeness_score_clean():
    # No stubs → perfect, regardless of size.
    assert scoring.completeness_score([], segments=100) == 100
    assert scoring.completeness_score([], segments=0) == 100


def test_completeness_score_severity_weighted():
    # Within the same codebase size, a critical hurts more than an info.
    crit = scoring.completeness_score([_F("critical")], segments=50)
    info = scoring.completeness_score([_F("info")], segments=50)
    assert info > crit
    # Enough criticals still clamp to 0.
    assert scoring.completeness_score([_F("critical")] * 50, segments=50) == 0


def test_scores_are_size_relative():
    # The SAME findings score higher in a larger codebase than a tiny one —
    # this is the whole point of normalizing by segment count.
    stubs = [_F("high"), _F("medium"), _F("low")]
    small = scoring.completeness_score(stubs, segments=8)
    large = scoring.completeness_score(stubs, segments=200)
    assert large > small
    assert 0 <= small <= 100 and 0 <= large <= 100

    sec = [_F("critical"), _F("high")]
    assert scoring.security_score(sec, segments=200) > scoring.security_score(sec, segments=8)


def test_tiny_repo_does_not_divide_to_zero():
    # A 1-segment repo with one finding shouldn't crater to 0 (segment floor).
    assert scoring.completeness_score([_F("medium")], segments=1) > 50


# ---- Unit: content hash -----------------------------------------------------
def test_content_hash_ignores_whitespace_stable():
    assert stub_content_hash("next()") == stub_content_hash("next( )")
    assert stub_content_hash("next()") != stub_content_hash("verifyJwt()")
    assert stub_content_hash(None) == stub_content_hash("")


# ---- Integration: full pipeline against a planted-stub fixture --------------
async def _seed_scan(client, headers) -> str:
    async with SessionLocal() as db:
        scan = Scan(
            user_id=(await _current_user_id(client, headers)),
            source_type="zip", repo="user/stub-fixture",
            include_optimization=True, models=["gemini"],
        )
        db.add(scan)
        await db.commit()
        return scan.id


def _write_fixture(tmp_path, auth_body="  // TODO: implement auth\n  next()\n"):
    src = tmp_path / "repo"
    src.mkdir(exist_ok=True)
    (src / "auth.js").write_text(
        "const authMiddleware = (req, res, next) => {\n" + auth_body + "}\n"
    )
    (src / "safe.py").write_text("def add(a, b):\n    return a + b\n")
    return src


@pytest.mark.asyncio
async def test_full_scan_detects_stub(auth, tmp_path):
    client, headers, _ = auth
    src = _write_fixture(tmp_path)
    scan_id = await _seed_scan(client, headers)

    await run_scan(
        scan_id, complete=_make_fake_complete(), workdir=str(src), cleanup=False
    )

    r = await client.get(f"{PREFIX}/scans/{scan_id}", headers=headers)
    scan = r.json()["data"]
    assert scan["status"] == SCAN_COMPLETED
    assert scan["completeness_score"] < 100  # the critical stub drove it down

    r = await client.get(
        f"{PREFIX}/scans/{scan_id}/findings?engine=stub", headers=headers
    )
    stubs = r.json()["data"]
    assert len(stubs) == 1
    s = stubs[0]
    assert s["public_id"].startswith("STB-")
    assert s["severity"] == "critical"
    assert s["stub_category"] == "Incomplete"
    assert "bypassed" in s["risk_if_shipped"]


# ---- Integration: intentional suppression re-scan flow ----------------------
@pytest.mark.asyncio
async def test_intentional_suppression_lifecycle(auth, tmp_path):
    client, headers, _ = auth
    src = _write_fixture(tmp_path)

    # Scan 1: stub detected, open.
    scan1 = await _seed_scan(client, headers)
    await run_scan(scan1, complete=_make_fake_complete(), workdir=str(src), cleanup=False)
    stubs = (await client.get(
        f"{PREFIX}/scans/{scan1}/findings?engine=stub", headers=headers
    )).json()["data"]
    finding_id = stubs[0]["id"]

    # Mark intentional.
    r = await client.patch(
        f"{PREFIX}/findings/{finding_id}/mark-intentional",
        headers=headers, json={"reason": "planned for v2"},
    )
    assert r.status_code == 200
    assert r.json()["data"]["status"] == STATUS_INTENTIONAL

    # It appears in the per-repo intentional list.
    r = await client.get(
        f"{PREFIX}/repos/user/stub-fixture/intentional-stubs", headers=headers
    )
    assert len(r.json()["data"]) == 1

    # Scan 2 (same code): auto-suppressed and excluded from completeness.
    scan2 = await _seed_scan(client, headers)
    await run_scan(scan2, complete=_make_fake_complete(), workdir=str(src), cleanup=False)
    async with SessionLocal() as db:
        s2 = await db.get(Scan, scan2)
        assert s2.completeness_score == 100  # suppressed stub doesn't count
    stubs2 = (await client.get(
        f"{PREFIX}/scans/{scan2}/findings?engine=stub", headers=headers
    )).json()["data"]
    assert len(stubs2) == 1
    assert stubs2[0]["status"] == STATUS_INTENTIONAL

    # Scan 3 with CHANGED stub code: hash differs, suppression no longer applies.
    src3 = _write_fixture(tmp_path, auth_body="  // TODO: implement auth\n  doSomethingElse()\n")
    scan3 = await _seed_scan(client, headers)
    await run_scan(
        scan3, complete=_make_fake_complete(stub_code="doSomethingElse()"),
        workdir=str(src3), cleanup=False,
    )
    stubs3 = (await client.get(
        f"{PREFIX}/scans/{scan3}/findings?engine=stub", headers=headers
    )).json()["data"]
    assert stubs3[0]["status"] == STATUS_OPEN  # new content -> needs review


@pytest.mark.asyncio
async def test_unmark_intentional(auth, tmp_path):
    client, headers, _ = auth
    src = _write_fixture(tmp_path)
    scan1 = await _seed_scan(client, headers)
    await run_scan(scan1, complete=_make_fake_complete(), workdir=str(src), cleanup=False)
    finding_id = (await client.get(
        f"{PREFIX}/scans/{scan1}/findings?engine=stub", headers=headers
    )).json()["data"][0]["id"]

    await client.patch(f"{PREFIX}/findings/{finding_id}/mark-intentional",
                       headers=headers, json={})
    r = await client.patch(f"{PREFIX}/findings/{finding_id}/unmark-intentional",
                           headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["status"] == STATUS_OPEN
    # Suppression rule was removed.
    async with SessionLocal() as db:
        from sqlalchemy import select
        rows = (await db.execute(select(IntentionalStubSuppression))).scalars().all()
        assert rows == []


@pytest.mark.asyncio
async def test_mark_intentional_rejects_non_stub(auth, tmp_path):
    client, headers, _ = auth
    # Create a security finding directly and try to mark it intentional.
    scan_id = await _seed_scan(client, headers)
    async with SessionLocal() as db:
        f = Finding(
            scan_id=scan_id, public_id="VLN-0001", engine="security",
            severity="high", file="a.js", line_start=1, line_end=2,
        )
        db.add(f)
        await db.commit()
        fid = f.id
    r = await client.patch(f"{PREFIX}/findings/{fid}/mark-intentional",
                           headers=headers, json={})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_generate_implementation_streams(auth, tmp_path):
    client, headers, _ = auth
    src = _write_fixture(tmp_path)
    scan1 = await _seed_scan(client, headers)
    await run_scan(scan1, complete=_make_fake_complete(), workdir=str(src), cleanup=False)
    finding_id = (await client.get(
        f"{PREFIX}/scans/{scan1}/findings?engine=stub", headers=headers
    )).json()["data"][0]["id"]

    r = await client.post(
        f"{PREFIX}/findings/{finding_id}/generate-implementation", headers=headers
    )
    assert r.status_code == 200
    body = r.text
    assert "data:" in body
    assert '"done": true' in body
