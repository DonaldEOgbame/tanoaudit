"""Module 5 tests: live event emission, control (cancel), WebSocket auth."""
import asyncio

import pytest

from app.core.database import SessionLocal
from app.models.scan import Scan, SCAN_CANCELLED, SCAN_COMPLETED
from app.services import scan_events as ev
from app.services.orchestrator import run_scan
from tests.conftest import PREFIX


async def _current_user_id(client, headers):
    r = await client.get(f"{PREFIX}/profile", headers=headers)
    return r.json()["data"]["id"]


def _sqli_result(code):
    if "db.raw" in code or "SELECT * FROM" in code:
        return {"security": [{"category": "Injection", "severity": "Critical",
                "confidence": "High", "line_start": 1, "line_end": 2,
                "code_snippet": "db.raw", "explanation": "x", "fix_summary": "y",
                "fix_snippet": "z", "cwe_id": "CWE-89", "owasp_ref": "A03:2021"}],
                "optimizations": [], "stubs": [],
                "segment_scores": {"security_risk": 90, "optimization_score": 80, "completeness_score": 100}}
    return {"security": [], "optimizations": [], "stubs": [],
            "segment_scores": {"security_risk": 0, "optimization_score": 100, "completeness_score": 100}}


async def flag_sqli(prompt, model_hint):
    import json as _json
    import re as _re
    if "### SEGMENT 0" in prompt:
        blocks = _re.findall(r"### SEGMENT (\d+).*?```\n(.*?)\n```", prompt, _re.DOTALL)
        return _json.dumps({"results": {i: _sqli_result(code) for i, code in blocks}})
    return _json.dumps(_sqli_result(prompt))


async def _make_scan(client, headers) -> str:
    async with SessionLocal() as db:
        scan = Scan(
            user_id=await _current_user_id(client, headers),
            source_type="zip", repo="user/fixture", models=["gemini"],
        )
        db.add(scan)
        await db.commit()
        return scan.id


async def test_event_sequence_emitted(auth, tmp_path):
    client, headers, _ = auth
    src = tmp_path / "repo"
    src.mkdir()
    (src / "products.js").write_text(
        "const sql = `SELECT * FROM products`;\nconst r = db.raw(sql);\n"
    )
    scan_id = await _make_scan(client, headers)

    # Subscribe before running so we capture the full stream.
    q = await ev.bus.subscribe(scan_id)
    await run_scan(scan_id, complete=flag_sqli, workdir=str(src), cleanup=False)

    types = []
    while not q.empty():
        types.append((await q.get())["type"])

    assert ev.SCAN_STARTED in types
    assert ev.FILE_PARSED in types
    assert ev.SEGMENT_COMPLETED in types
    assert ev.SCAN_PROGRESS in types
    assert ev.FINDING_DISCOVERED in types
    assert ev.SCAN_COMPLETED in types
    # Ordering: started first, completed last.
    assert types[0] == ev.SCAN_STARTED
    assert types[-1] == ev.SCAN_COMPLETED


async def test_finding_discovered_payload(auth, tmp_path):
    client, headers, _ = auth
    src = tmp_path / "repo"
    src.mkdir()
    (src / "a.js").write_text("const r = db.raw(`SELECT * FROM t`);\n")
    scan_id = await _make_scan(client, headers)

    q = await ev.bus.subscribe(scan_id)
    await run_scan(scan_id, complete=flag_sqli, workdir=str(src), cleanup=False)

    findings = []
    while not q.empty():
        e = await q.get()
        if e["type"] == ev.FINDING_DISCOVERED:
            findings.append(e["payload"])
    assert findings
    assert findings[0]["public_id"].startswith("VLN-")
    assert findings[0]["severity"] == "critical"


async def test_cancel_stops_scan(auth, tmp_path):
    client, headers, _ = auth
    src = tmp_path / "repo"
    src.mkdir()
    for i in range(6):
        (src / f"f{i}.py").write_text("\n".join(f"x={j}" for j in range(120)))
    scan_id = await _make_scan(client, headers)

    # Pre-set cancel so the loop aborts at the first control check.
    await ev.bus.set_control(scan_id, ev.Control.CANCEL)
    await run_scan(scan_id, complete=flag_sqli, workdir=str(src), cleanup=False)

    async with SessionLocal() as db:
        scan = await db.get(Scan, scan_id)
        assert scan.status == SCAN_CANCELLED


async def test_control_endpoint(auth):
    client, headers, _ = auth
    scan_id = await _make_scan(client, headers)
    r = await client.post(
        f"{PREFIX}/scans/{scan_id}/control?command=pause", headers=headers
    )
    assert r.status_code == 200
    assert await ev.bus.get_control(scan_id) == ev.Control.PAUSE
    assert r.json()["data"]["control"] == "pause"


async def test_control_endpoint_rejects_bad_command(auth):
    client, headers, _ = auth
    scan_id = await _make_scan(client, headers)
    r = await client.post(
        f"{PREFIX}/scans/{scan_id}/control?command=explode", headers=headers
    )
    assert r.status_code == 422


async def test_ws_route_registered():
    from app.main import app
    ws_paths = [
        r.path for r in app.routes
        if getattr(r, "path", "").endswith("/ws")
    ]
    assert any("/scans/" in p for p in ws_paths)
