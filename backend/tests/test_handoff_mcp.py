"""Module 13 tests: handoff token lifecycle, markdown, MCP handshake + tools."""
import pytest

from app.core.database import SessionLocal
from app.models.handoff import HandoffEvent, HandoffToken
from app.models.scan import Finding, Scan, SCAN_COMPLETED, ENGINE_SECURITY, ENGINE_OPTIMIZATION, STATUS_FIXED
from app.services import handoff as ho
from app.services.mcp_tools import _parse_handoff_url
from tests.conftest import PREFIX


async def _uid(client, headers):
    r = await client.get(f"{PREFIX}/profile", headers=headers)
    return r.json()["data"]["id"]


async def _seed_scan(user_id):
    async with SessionLocal() as db:
        scan = Scan(user_id=user_id, source_type="github", repo="user/ecommerce-api",
                    branch="main", commit="a3f9c21", status=SCAN_COMPLETED,
                    files=2, segment_total=5, security_score=38)
        db.add(scan)
        await db.flush()
        db.add(Finding(scan_id=scan.id, public_id="VLN-0001", engine=ENGINE_SECURITY,
                       category="Injection", severity="critical", confidence="High",
                       file="src/a.js", line_start=41, line_end=43, code_snippet="db.raw(x)",
                       explanation="sqli", fix_summary="parameterize", fix_snippet="safe()",
                       cwe_id="CWE-89", owasp_ref="A03:2021"))
        db.add(Finding(scan_id=scan.id, public_id="VLN-0002", engine=ENGINE_SECURITY,
                       category="Auth", severity="low", confidence="High",
                       file="src/b.js", line_start=1, line_end=2, explanation="x"))
        db.add(Finding(scan_id=scan.id, public_id="OPT-0001", engine=ENGINE_OPTIMIZATION,
                       category="Performance", severity="medium", confidence="High",
                       file="src/c.js", line_start=5, line_end=8, explanation="n+1"))
        await db.commit()
        return scan.id


@pytest.fixture
async def seeded(auth):
    client, headers, _ = auth
    uid = await _uid(client, headers)
    return client, headers, uid, await _seed_scan(uid)


# ---- Token lifecycle --------------------------------------------------------
async def test_generate_and_consume(seeded):
    client, headers, _, audit_id = seeded
    r = await client.post(
        f"{PREFIX}/audits/{audit_id}/handoff/generate", headers=headers,
        json={"scope": "all"},
    )
    assert r.status_code == 201
    data = r.json()["data"]
    assert data["finding_count"] == 3
    url = data["url"]
    token = url.split("token=")[1]

    # Consume -> markdown.
    r = await client.get(f"{PREFIX}/audits/{audit_id}/handoff?token={token}")
    assert r.status_code == 200
    md = r.text
    assert "# Akira AI Security Audit Handoff" in md
    assert "VLN-0001 | CRITICAL | Injection" in md
    assert "CWE-89" in md
    assert "Fix immediately" in md

    # Single-use: second consume fails generically.
    r = await client.get(f"{PREFIX}/audits/{audit_id}/handoff?token={token}")
    assert r.status_code == 401


async def test_scope_filtering(seeded):
    client, headers, _, audit_id = seeded
    r = await client.post(
        f"{PREFIX}/audits/{audit_id}/handoff/generate", headers=headers,
        json={"scope": "critical_high"},
    )
    assert r.json()["data"]["finding_count"] == 1  # only the critical


async def test_invalid_token_generic_401(seeded):
    client, headers, _, audit_id = seeded
    r = await client.get(f"{PREFIX}/audits/{audit_id}/handoff?token=bogus")
    assert r.status_code == 401
    assert "Invalid or expired" in r.json()["error"]["message"]


async def test_list_and_revoke_links(seeded):
    client, headers, _, audit_id = seeded
    await client.post(f"{PREFIX}/audits/{audit_id}/handoff/generate",
                      headers=headers, json={"scope": "all"})
    r = await client.get(f"{PREFIX}/handoff-links", headers=headers)
    links = r.json()["data"]
    assert len(links) == 1 and links[0]["status"] == "active"
    tid = links[0]["id"]

    r = await client.delete(f"{PREFIX}/handoff-links/{tid}", headers=headers)
    assert r.status_code == 204
    r = await client.get(f"{PREFIX}/handoff-links", headers=headers)
    assert r.json()["data"][0]["status"] == "revoked"


async def test_handoff_generated_event_logged(seeded):
    client, headers, uid, audit_id = seeded
    await client.post(f"{PREFIX}/audits/{audit_id}/handoff/generate",
                      headers=headers, json={"scope": "security"})
    async with SessionLocal() as db:
        from sqlalchemy import select
        events = (await db.execute(select(HandoffEvent).where(HandoffEvent.audit_id == audit_id))).scalars().all()
    assert any(e.kind == "handoff_generated" for e in events)


# ---- URL parsing ------------------------------------------------------------
def test_parse_handoff_url():
    aid, tok = _parse_handoff_url("https://akira.ai/handoff/scan-123?token=abc.def")
    assert aid == "scan-123" and tok == "abc.def"
    aid, tok = _parse_handoff_url("not a url")
    assert aid is None or tok is None


# ---- MCP server -------------------------------------------------------------
async def test_mcp_initialize(client):
    r = await client.post("/mcp", json={
        "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {},
    })
    assert r.status_code == 200
    data = r.json()
    assert data["result"]["serverInfo"]["name"] == "akira-ai"
    assert "tools" in data["result"]["capabilities"]
    # No version requested -> server offers its newest supported version.
    assert data["result"]["protocolVersion"] == "2025-06-18"


async def test_mcp_initialize_echoes_supported_client_version(client):
    r = await client.post("/mcp", json={
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2024-11-05"},
    })
    # Client asked for an older-but-supported version; server echoes it back.
    assert r.json()["result"]["protocolVersion"] == "2024-11-05"


async def test_mcp_initialize_falls_back_on_unknown_version(client):
    r = await client.post("/mcp", json={
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "1999-01-01"},
    })
    # Unsupported version -> server offers its newest instead.
    assert r.json()["result"]["protocolVersion"] == "2025-06-18"


async def test_mcp_tools_list(client):
    r = await client.post("/mcp", json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    tools = {t["name"] for t in r.json()["result"]["tools"]}
    assert tools == {"fetch_audit_handoff", "mark_finding_fixed"}


async def test_mcp_fetch_audit_handoff_tool(seeded):
    client, headers, _, audit_id = seeded
    r = await client.post(f"{PREFIX}/audits/{audit_id}/handoff/generate",
                          headers=headers, json={"scope": "all"})
    url = r.json()["data"]["url"]

    r = await client.post("/mcp", json={
        "jsonrpc": "2.0", "id": 3, "method": "tools/call",
        "params": {"name": "fetch_audit_handoff", "arguments": {"audit_url": url}},
    })
    result = r.json()["result"]
    assert result["isError"] is False
    assert "Akira AI Security Audit Handoff" in result["content"][0]["text"]


async def test_mcp_mark_finding_fixed_requires_handoff(seeded):
    client, headers, _, audit_id = seeded
    # Without consuming a handoff, marking fixed should be refused.
    r = await client.post("/mcp", json={
        "jsonrpc": "2.0", "id": 4, "method": "tools/call",
        "params": {"name": "mark_finding_fixed",
                   "arguments": {"audit_id": audit_id, "finding_id": "VLN-0001"}},
    })
    assert "no valid handoff" in r.json()["result"]["content"][0]["text"].lower()


async def test_mcp_mark_finding_fixed_after_handoff(seeded):
    client, headers, _, audit_id = seeded
    r = await client.post(f"{PREFIX}/audits/{audit_id}/handoff/generate",
                          headers=headers, json={"scope": "all"})
    url = r.json()["data"]["url"]
    # Consume via the MCP fetch tool (marks the token used).
    await client.post("/mcp", json={
        "jsonrpc": "2.0", "id": 5, "method": "tools/call",
        "params": {"name": "fetch_audit_handoff", "arguments": {"audit_url": url}},
    })
    # Now mark fixed.
    r = await client.post("/mcp", json={
        "jsonrpc": "2.0", "id": 6, "method": "tools/call",
        "params": {"name": "mark_finding_fixed",
                   "arguments": {"audit_id": audit_id, "finding_id": "VLN-0001"}},
    })
    text = r.json()["result"]["content"][0]["text"]
    assert "fixed" in text.lower()

    # Finding is now fixed via claude_code.
    async with SessionLocal() as db:
        from sqlalchemy import select
        f = (await db.execute(select(Finding).where(
            Finding.scan_id == audit_id, Finding.public_id == "VLN-0001"))).scalar_one()
    assert f.status == STATUS_FIXED
    assert f.fixed_via == "claude_code"


async def test_mcp_unknown_method(client):
    r = await client.post("/mcp", json={"jsonrpc": "2.0", "id": 9, "method": "bogus/method"})
    assert r.json()["error"]["code"] == -32601


async def test_mcp_bearer_auth_enforced(client, monkeypatch):
    import app.api.mcp as mcp_api
    monkeypatch.setattr(mcp_api.settings, "mcp_api_key", "secret-mcp-key")

    # No header -> 401.
    r = await client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    assert r.status_code == 401

    # Correct bearer -> 200.
    r = await client.post(
        "/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        headers={"Authorization": "Bearer secret-mcp-key"},
    )
    assert r.status_code == 200
    assert "tools" in r.json()["result"]
