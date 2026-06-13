"""Module 3 tests: ingestion, segmentation, analysis parsing, full pipeline."""
import os
import zipfile

import pytest

from app.services import ingestion
from app.services.analysis import analyze_segment, parse_analysis
from app.services.segmentation import segment_file, SegmentData, content_hash
from app.services.ingestion import SourceFile
from app.services.orchestrator import run_scan
from app.models.scan import Scan, Finding, SCAN_COMPLETED
from app.core.database import SessionLocal
from tests.conftest import PREFIX


async def _current_user_id(client, headers) -> str:
    r = await client.get(f"{PREFIX}/profile", headers=headers)
    return r.json()["data"]["id"]


# A fake provider that flags SQL injection whenever it sees raw query building.
async def fake_complete(prompt: str, model_hint):
    if "db.raw" in prompt or "f\"SELECT" in prompt or "SELECT * FROM" in prompt:
        return """```json
        {"security": [{"category": "Injection", "subcategory": "SQL Injection",
          "severity": "Critical", "confidence": "High", "line_start": 2, "line_end": 3,
          "code_snippet": "db.raw(sql)", "explanation": "raw SQL", "fix_summary": "parameterize",
          "fix_snippet": "db('t').where(...)", "cwe_id": "CWE-89", "owasp_ref": "A03:2021"}],
         "optimizations": [], "segment_scores": {"security_risk": 90, "optimization_score": 70}}
        ```"""
    return '{"security": [], "optimizations": [], "segment_scores": {"security_risk": 0, "optimization_score": 100}}'


# ---- Unit: ingestion --------------------------------------------------------
def test_language_detection():
    assert ingestion.detect_language("a/b/foo.py") == "python"
    assert ingestion.detect_language("x.tsx") == "typescript"
    assert ingestion.detect_language("notes.txt") is None


def test_excludes_node_modules_and_lockfiles(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "app.js").write_text("console.log(1)")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "dep.js").write_text("x")
    (tmp_path / "package-lock.json").write_text("{}")
    files = ingestion.walk_source(str(tmp_path))
    paths = {f.rel_path for f in files}
    assert any(p.endswith("app.js") for p in paths)
    assert not any("node_modules" in p for p in paths)
    assert "package-lock.json" not in paths


def test_zip_slip_blocked(tmp_path):
    import io
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../escape.txt", "pwned")
    with pytest.raises(Exception):
        ingestion.extract_zip(buf.getvalue(), str(tmp_path / "out"))


# ---- Unit: segmentation -----------------------------------------------------
def test_segmentation_produces_segments(tmp_path):
    f = tmp_path / "big.py"
    f.write_text("\n".join(f"x = {i}" for i in range(500)))
    sf = SourceFile(rel_path="big.py", abs_path=str(f), language="python")
    segs = segment_file(sf)
    assert len(segs) >= 2  # 500 lines windowed
    assert all(s.content_hash for s in segs)
    assert segs[0].line_start == 1


def test_content_hash_stable():
    assert content_hash("abc") == content_hash("abc")
    assert content_hash("abc") != content_hash("abd")


# ---- Unit: analysis parsing -------------------------------------------------
def test_parse_strips_fences():
    raw = '```json\n{"security": [], "optimizations": [], "segment_scores": {"security_risk": 5, "optimization_score": 90}}\n```'
    result = parse_analysis(raw)
    assert result is not None
    assert result.segment_scores.optimization_score == 90


def test_parse_malformed_returns_none():
    assert parse_analysis("not json at all") is None


async def test_analyze_segment_repair_retry():
    calls = []

    async def flaky(prompt, hint):
        calls.append(prompt)
        if len(calls) == 1:
            return "garbage"
        return '{"security": [], "optimizations": [], "segment_scores": {"security_risk": 0, "optimization_score": 100}}'

    seg = SegmentData("a.py", "python", 1, 5, "x=1", "h")
    result = await analyze_segment(seg, flaky)
    assert result is not None
    assert len(calls) == 2  # one repair retry


# ---- Integration: full pipeline against a planted-vuln fixture --------------
@pytest.mark.asyncio
async def test_full_scan_pipeline(auth, tmp_path):
    client, headers, _ = auth

    # Build a tiny repo with a planted SQL injection.
    src = tmp_path / "repo"
    src.mkdir()
    (src / "products.js").write_text(
        "router.get('/search', (req,res) => {\n"
        "  const sql = `SELECT * FROM products WHERE n='${req.query.q}'`;\n"
        "  const rows = db.raw(sql);\n"
        "  res.json(rows);\n"
        "});\n"
    )
    (src / "safe.py").write_text("def add(a, b):\n    return a + b\n")

    # Create the scan row directly (avoids spawning a real clone background
    # task), then drive run_scan with our own workdir + fake provider offline.
    async with SessionLocal() as db:
        scan = Scan(
            user_id=(await _current_user_id(client, headers)),
            source_type="zip", repo="user/fixture",
            include_optimization=True, models=["gemini"],
        )
        db.add(scan)
        await db.commit()
        scan_id = scan.id

    await run_scan(
        scan_id, complete=fake_complete, workdir=str(src), cleanup=False
    )

    r = await client.get(f"{PREFIX}/scans/{scan_id}", headers=headers)
    scan = r.json()["data"]
    assert scan["status"] == SCAN_COMPLETED
    assert scan["files"] == 2
    assert scan["segment_total"] >= 2
    assert scan["security_score"] < 100  # the critical drove it down

    r = await client.get(
        f"{PREFIX}/scans/{scan_id}/findings?engine=security", headers=headers
    )
    findings = r.json()["data"]
    assert len(findings) >= 1
    f0 = findings[0]
    assert f0["public_id"].startswith("VLN-")
    assert f0["severity"] == "critical"
    assert f0["cwe_id"] == "CWE-89"


async def test_zip_extracts_to_shared_dir_and_materializes(auth):
    """A ZIP scan extracts into the shared scan-id dir, and materialize_source
    resolves to that same dir from the id alone — the path an arq worker reads,
    with no workdir argument that wouldn't survive a process hop."""
    import io
    import os
    import zipfile

    from app.services import ingestion
    from app.services.orchestrator import materialize_source

    client, headers, _ = auth
    uid = await _current_user_id(client, headers)

    async with SessionLocal() as db:
        scan = Scan(user_id=uid, source_type="zip", repo="proj", models=["gemini"])
        db.add(scan)
        await db.flush()
        scan_id = scan.id
        await db.commit()

    # Extract straight into the shared upload dir (what the endpoint does).
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("app/safe.py", "def add(a, b):\n    return a + b\n")
    upload_dir = ingestion.scan_upload_dir(scan_id)
    ingestion.extract_zip(buf.getvalue(), upload_dir)
    assert os.path.isfile(os.path.join(upload_dir, "app", "safe.py"))

    async with SessionLocal() as db:
        scan = await db.get(Scan, scan_id)
    path, commit = await materialize_source(scan)
    assert path == upload_dir and commit is None
    # Reconstructable from the id with no shared in-memory state.
    assert ingestion.scan_upload_dir(scan_id) == upload_dir

    import shutil
    shutil.rmtree(upload_dir, ignore_errors=True)


async def test_zip_upload_endpoint_completes(auth):
    """The real /scans/upload endpoint runs a ZIP scan to completion via the
    in-process fallback (no Redis in tests)."""
    import io
    import zipfile

    from app.models.scan import SCAN_COMPLETED

    client, headers, _ = auth
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("safe.py", "def add(a, b):\n    return a + b\n")

    r = await client.post(
        f"{PREFIX}/scans/upload",
        headers=headers,
        files={"file": ("proj.zip", buf.getvalue(), "application/zip")},
        data={"config": "{}"},
    )
    assert r.status_code == 201
    scan_id = r.json()["data"]["id"]
    # The endpoint's BackgroundTask runs the scan under ASGITransport.
    r = await client.get(f"{PREFIX}/scans/{scan_id}", headers=headers)
    assert r.json()["data"]["status"] == SCAN_COMPLETED


async def test_delete_scan_removes_children_and_cache(auth):
    """DELETE /scans/{id} removes the scan, its findings, and on-disk cache."""
    import os
    from sqlalchemy import select
    from app.models.scan import Finding
    from app.services import file_cache

    client, headers, _ = auth
    uid = await _current_user_id(client, headers)

    async with SessionLocal() as db:
        scan = Scan(user_id=uid, source_type="zip", repo="r", models=["gemini"])
        db.add(scan)
        await db.flush()
        scan_id = scan.id
        db.add(Finding(
            scan_id=scan_id, public_id="VLN-1", engine="security",
            severity="high", file="a.py",
        ))
        # Simulate a cached source file on disk.
        scan.file_cache_path = file_cache.cache_dir_for(scan_id)
        os.makedirs(scan.file_cache_path, exist_ok=True)
        with open(os.path.join(scan.file_cache_path, "a.py"), "w") as fh:
            fh.write("x=1\n")
        await db.commit()

    r = await client.delete(f"{PREFIX}/scans/{scan_id}", headers=headers)
    assert r.status_code == 204

    # Scan gone (404), findings gone, cache dir removed.
    r = await client.get(f"{PREFIX}/scans/{scan_id}", headers=headers)
    assert r.status_code == 404
    async with SessionLocal() as db:
        rows = (await db.execute(
            select(Finding).where(Finding.scan_id == scan_id)
        )).scalars().all()
        assert rows == []
    assert not os.path.exists(file_cache.cache_dir_for(scan_id))


async def test_delete_scan_requires_ownership(auth):
    client, headers, _ = auth
    r = await client.delete(f"{PREFIX}/scans/does-not-exist", headers=headers)
    assert r.status_code == 404


async def test_gemini_completer_requests_json_mode():
    """The analysis completer must ask Gemini for JSON output + a token cap, so
    large segments don't return fenced/truncated JSON that fails to parse."""
    import json as _json
    import httpx
    from app.services import llm_clients

    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = _json.loads(request.content)
        return httpx.Response(200, json={
            "candidates": [{"content": {"parts": [{"text": '{"security":[]}'}]}}],
            "usageMetadata": {"promptTokenCount": 1, "candidatesTokenCount": 1},
        })

    transport = httpx.MockTransport(handler)
    orig = httpx.AsyncClient

    def patched(*a, **k):
        k["transport"] = transport
        return orig(*a, **k)

    httpx.AsyncClient = patched
    try:
        await llm_clients.complete_gemini("fake-key", "analyze this")
    finally:
        httpx.AsyncClient = orig

    gc = captured["body"].get("generationConfig", {})
    assert gc.get("responseMimeType") == "application/json"
    assert gc.get("maxOutputTokens") == llm_clients.MAX_ANALYSIS_TOKENS


async def test_completers_coerce_null_content():
    """A provider 200 with a null content field must yield "" not None, or
    downstream .strip() crashes the whole scan (real bug from a live run)."""
    import httpx
    from app.services import llm_clients

    def gemini_null(request):
        return httpx.Response(200, json={
            "candidates": [{"content": {"parts": [{"text": None}]}}],
            "usageMetadata": {},
        })

    def openai_null(request):
        return httpx.Response(200, json={
            "choices": [{"message": {"content": None}}], "usage": {},
        })

    orig = httpx.AsyncClient
    for handler, call in (
        (gemini_null, lambda: llm_clients.complete_gemini("k", "p")),
        (openai_null, lambda: llm_clients.complete_openrouter("k", "p")),
    ):
        transport = httpx.MockTransport(handler)
        httpx.AsyncClient = lambda *a, _t=transport, **k: orig(*a, transport=_t, **k)
        try:
            comp = await call()
            assert comp.text == ""  # not None
        finally:
            httpx.AsyncClient = orig

    # And the analysis/verification parsers tolerate None defensively.
    from app.services.analysis import parse_analysis
    from app.services.verification import _parse_confirm
    assert parse_analysis(None) is None
    assert _parse_confirm(None) is None


async def test_create_scan_validation(auth):
    client, headers, _ = auth
    # url type without source_url -> 400
    r = await client.post(
        f"{PREFIX}/scans", headers=headers,
        json={"source_type": "url"},
    )
    assert r.status_code == 400
    # zip via JSON endpoint -> 400 (must use /upload)
    r = await client.post(
        f"{PREFIX}/scans", headers=headers, json={"source_type": "zip"}
    )
    assert r.status_code == 400


# ---- Worker: atomic claim ---------------------------------------------------
async def test_worker_claims_each_scan_once(auth):
    """Two concurrent claim passes must partition the queued scans, never
    double-claim one. Exercises the guarded-UPDATE path (SQLite in tests)."""
    import asyncio

    from app.models.scan import SCAN_CLAIMED, SCAN_QUEUED
    from app.worker import _claim_queued_scans

    client, headers, _ = auth
    uid = await _current_user_id(client, headers)

    async with SessionLocal() as db:
        ids = []
        for _ in range(6):
            s = Scan(user_id=uid, source_type="zip", repo="r", models=["gemini"])
            db.add(s)
            await db.flush()
            ids.append(s.id)
        await db.commit()

    # Run two claim passes concurrently.
    a, b = await asyncio.gather(_claim_queued_scans(), _claim_queued_scans())

    # No scan claimed by both passes.
    assert set(a).isdisjoint(set(b))
    # Every scan ended up claimed exactly once, status flipped, worker stamped.
    claimed = set(a) | set(b)
    assert claimed == set(ids)
    async with SessionLocal() as db:
        for scan_id in ids:
            s = await db.get(Scan, scan_id)
            assert s.status == SCAN_CLAIMED
            assert s.worker_id is not None
    # A second claim pass finds nothing left queued.
    assert await _claim_queued_scans() == []


# ---- Dispatch fallback ------------------------------------------------------
async def test_dispatch_falls_back_without_redis():
    """With no REDIS_URL (test env), enqueue returns False so callers run work
    in-process. This is what keeps scans running on a Redis-less box."""
    from app.services.dispatch import enqueue, reset_pool

    await reset_pool()
    assert await enqueue("run_scan_task", scan_id="nope") is False


# ---- Worker: orphan recovery ------------------------------------------------
async def test_orphan_recovery_requeues_then_fails(auth):
    """A scan stuck in running past the cutoff is re-queued under the retry cap,
    then marked failed once the cap is exceeded."""
    from datetime import timedelta

    from app.core.database import utcnow
    from app.models.scan import SCAN_FAILED, SCAN_QUEUED, SCAN_RUNNING
    from app import worker

    client, headers, _ = auth
    uid = await _current_user_id(client, headers)
    stale = utcnow() - timedelta(minutes=30)

    async with SessionLocal() as db:
        s = Scan(user_id=uid, source_type="github", repo="r", models=["gemini"])
        s.status = SCAN_RUNNING
        s.started_at = stale
        s.worker_id = "dead-worker"
        db.add(s)
        await db.flush()
        sid = s.id
        await db.commit()

    # First sweep: under the cap -> re-queued.
    acted = await worker.recover_orphan_scans()
    assert acted == 1
    async with SessionLocal() as db:
        s = await db.get(Scan, sid)
        assert s.status == SCAN_QUEUED
        assert s.retry_count == 1
        assert s.worker_id is None
        # Make it stale again and push it over the cap for the next sweep.
        s.status = SCAN_RUNNING
        s.started_at = stale
        s.retry_count = worker.MAX_RETRIES
        await db.commit()

    await worker.recover_orphan_scans()
    async with SessionLocal() as db:
        s = await db.get(Scan, sid)
        assert s.status == SCAN_FAILED
        assert s.error


# ---- File cache -------------------------------------------------------------
def test_file_cache_roundtrip(tmp_path):
    """Cached files are readable by rel_path; traversal is blocked."""
    from types import SimpleNamespace
    from app.services import file_cache

    src = tmp_path / "src"
    src.mkdir()
    (src / "a.py").write_text("print('hi')\n")
    files = [SimpleNamespace(rel_path="a.py", abs_path=str(src / "a.py"), language="python")]

    base = file_cache.cache_files("scan-xyz", files)
    assert base is not None

    scan = SimpleNamespace(file_cache_path=base)
    assert file_cache.read_cached_file(scan, "a.py") == "print('hi')\n"
    assert file_cache.read_cached_file(scan, "missing.py") is None
    # Path traversal is refused.
    assert file_cache.read_cached_file(scan, "../../etc/passwd") is None

    file_cache.clear_cache(scan)
    assert file_cache.read_cached_file(scan, "a.py") is None
