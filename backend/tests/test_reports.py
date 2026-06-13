"""Module 6 tests: exports, share links, public report, scan diff."""
import pytest

from app.core.database import SessionLocal
from app.models.scan import Finding, Scan, SCAN_COMPLETED, ENGINE_SECURITY
from app.services.scan_diff import diff_findings
from tests.conftest import PREFIX


async def _uid(client, headers):
    r = await client.get(f"{PREFIX}/profile", headers=headers)
    return r.json()["data"]["id"]


async def _seed_scan(user_id, findings_spec) -> str:
    """findings_spec: list of (public_id, category, file, line_start, severity)."""
    async with SessionLocal() as db:
        scan = Scan(
            user_id=user_id, source_type="zip", repo="user/ecommerce-api",
            branch="main", commit="a3f9c21", status=SCAN_COMPLETED,
            files=3, segment_total=10, security_score=38, optimization_score=64,
            worst_severity="critical", executive_summary="demo summary",
        )
        db.add(scan)
        await db.flush()
        for pid, cat, file, ls, sev in findings_spec:
            db.add(Finding(
                scan_id=scan.id, public_id=pid, engine=ENGINE_SECURITY,
                category=cat, severity=sev, confidence="High",
                file=file, line_start=ls, line_end=ls + 2,
                code_snippet="x", explanation="e", fix_summary="fix",
            ))
        await db.commit()
        return scan.id


@pytest.fixture
async def seeded(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    scan_id = await _seed_scan(uid, [
        ("VLN-0001", "Injection", "src/a.js", 41, "critical"),
        ("VLN-0002", "Secrets", "src/b.js", 3, "high"),
    ])
    return client, headers, scan_id


# ---- Exports ----------------------------------------------------------------
async def test_json_export_generates_and_downloads(seeded):
    client, headers, scan_id = seeded
    r = await client.post(
        f"{PREFIX}/scans/{scan_id}/exports", headers=headers, json={"format": "json"}
    )
    assert r.status_code == 201
    report_id = r.json()["data"]["id"]

    # Background task runs within the request under ASGITransport; export ready.
    r = await client.get(f"{PREFIX}/scans/{scan_id}/exports", headers=headers)
    report = next(x for x in r.json()["data"] if x["id"] == report_id)
    assert report["status"] == "ready"

    r = await client.get(f"{PREFIX}/exports/{report_id}/download", headers=headers)
    assert r.status_code == 200
    assert b"VLN-0001" in r.content


async def test_csv_export(seeded):
    client, headers, scan_id = seeded
    r = await client.post(
        f"{PREFIX}/scans/{scan_id}/exports", headers=headers, json={"format": "csv"}
    )
    report_id = r.json()["data"]["id"]
    r = await client.get(f"{PREFIX}/exports/{report_id}/download", headers=headers)
    assert r.status_code == 200
    assert b"public_id" in r.content  # CSV header


async def test_pdf_export_falls_back_gracefully(seeded):
    client, headers, scan_id = seeded
    r = await client.post(
        f"{PREFIX}/scans/{scan_id}/exports", headers=headers, json={"format": "pdf"}
    )
    report_id = r.json()["data"]["id"]
    # Whether weasyprint is present or not, the export must reach "ready".
    r = await client.get(f"{PREFIX}/scans/{scan_id}/exports", headers=headers)
    report = next(x for x in r.json()["data"] if x["id"] == report_id)
    assert report["status"] == "ready"


async def test_export_bad_format_422(seeded):
    client, headers, scan_id = seeded
    r = await client.post(
        f"{PREFIX}/scans/{scan_id}/exports", headers=headers, json={"format": "xml"}
    )
    assert r.status_code == 422


# ---- Share links ------------------------------------------------------------
async def test_share_create_view_revoke(seeded):
    client, headers, scan_id = seeded
    r = await client.post(f"{PREFIX}/scans/{scan_id}/share", headers=headers)
    assert r.status_code == 201
    data = r.json()["data"]
    slug = data["slug"]
    token_id = data["id"]
    assert data["url"].endswith(slug)

    # Public, unauthenticated view works and is sanitized.
    r = await client.get(f"{PREFIX}/public/reports/{slug}")
    assert r.status_code == 200
    body = r.json()["data"]
    assert body["repo"] == "user/ecommerce-api"
    assert len(body["findings"]) == 2
    assert "user_id" not in body  # no PII leak

    # Revoke -> public view 404s.
    r = await client.delete(f"{PREFIX}/share/{token_id}", headers=headers)
    assert r.status_code == 204
    r = await client.get(f"{PREFIX}/public/reports/{slug}")
    assert r.status_code == 404


async def test_public_report_unknown_slug_404(client):
    r = await client.get(f"{PREFIX}/public/reports/nope")
    assert r.status_code == 404


# ---- Scan diff --------------------------------------------------------------
def test_diff_unit():
    f = lambda pid, cat, file, ls: Finding(
        scan_id="s", public_id=pid, engine=ENGINE_SECURITY, category=cat,
        severity="high", confidence="High", file=file, line_start=ls, line_end=ls,
    )
    old = [f("A", "Injection", "a.js", 40), f("B", "Secrets", "b.js", 10)]
    new = [f("A", "Injection", "a.js", 43), f("C", "XSS", "c.js", 5)]  # A moved 3 lines
    res = diff_findings(old, new)
    assert [x.public_id for x in res.still_open] == ["A"]  # fuzzy-matched
    assert [x.public_id for x in res.new] == ["C"]
    assert [x.public_id for x in res.fixed] == ["B"]


async def test_diff_endpoint(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    old = await _seed_scan(uid, [("VLN-0001", "Injection", "a.js", 40, "critical"),
                                 ("VLN-0002", "Secrets", "b.js", 10, "high")])
    new = await _seed_scan(uid, [("VLN-0001", "Injection", "a.js", 42, "critical"),
                                 ("VLN-0003", "XSS", "c.js", 5, "medium")])
    r = await client.get(f"{PREFIX}/scans/{new}/diff/{old}", headers=headers)
    assert r.status_code == 200
    d = r.json()["data"]
    assert len(d["still_open"]) == 1
    assert len(d["new"]) == 1
    assert len(d["fixed"]) == 1
