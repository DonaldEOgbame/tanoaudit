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
def _seg_result(has_sqli: bool) -> dict:
    if has_sqli:
        return {"security": [{"category": "Injection", "subcategory": "SQL Injection",
            "severity": "Critical", "confidence": "High", "line_start": 2, "line_end": 3,
            "code_snippet": "db.raw(sql)", "explanation": "raw SQL", "fix_summary": "parameterize",
            "fix_snippet": "db('t').where(...)", "cwe_id": "CWE-89", "owasp_ref": "A03:2021"}],
            "optimizations": [], "stubs": [],
            "segment_scores": {"security_risk": 90, "optimization_score": 70, "completeness_score": 100}}
    return {"security": [], "optimizations": [], "stubs": [],
            "segment_scores": {"security_risk": 0, "optimization_score": 100, "completeness_score": 100}}


def _has_sqli(text: str) -> bool:
    return "db.raw" in text or 'f"SELECT' in text or "SELECT * FROM" in text


async def fake_complete(prompt: str, model_hint):
    import json as _json
    import re as _re

    # Batch prompt: one entry per "### SEGMENT i ... ```<code>```" block.
    if "### SEGMENT 0" in prompt:
        blocks = _re.findall(r"### SEGMENT (\d+).*?```\n(.*?)\n```", prompt, _re.DOTALL)
        results = {i: _seg_result(_has_sqli(code)) for i, code in blocks}
        return _json.dumps({"results": results})
    # Single-segment prompt.
    return _json.dumps(_seg_result(_has_sqli(prompt)))


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


async def test_scan_profile_caps_segments_analyzed(auth, tmp_path, monkeypatch):
    """The profile (stored as `depth`) bounds how many segments are analyzed.

    With a repo of N functions and a cap of 1, only 1 segment is analyzed and
    segment_total reflects the cap, not the full repo.
    """
    from app.services import orchestrator

    src = tmp_path / "repo"
    src.mkdir()
    # Several small functions → several segments, comfortably above the cap.
    (src / "many.py").write_text(
        "\n\n".join(f"def f{i}(a, b):\n    return a + b + {i}" for i in range(6)) + "\n"
    )

    # Force a tiny cap for the "fast" profile so the test stays small.
    monkeypatch.setitem(orchestrator._DEPTH_LIMITS, "fast", 1)

    client, headers, _ = auth
    user_id = await _current_user_id(client, headers)
    async with SessionLocal() as db:
        scan = Scan(
            user_id=user_id,
            source_type="zip", repo="user/fixture", depth="fast",
            include_optimization=True, models=["gemini"],
        )
        db.add(scan)
        await db.commit()
        scan_id = scan.id

    await run_scan(scan_id, complete=fake_complete, workdir=str(src), cleanup=False)

    r = await client.get(f"{PREFIX}/scans/{scan_id}", headers=headers)
    scan = r.json()["data"]
    assert scan["status"] == SCAN_COMPLETED
    # Capped: only 1 segment analyzed even though the file has 6 functions.
    assert scan["segment_total"] == 1
    assert scan["segments_analyzed"] == 1


async def test_zip_extracts_to_shared_dir_and_materializes(auth):
    """A ZIP scan extracts into the shared scan-id dir, and materialize_source
    resolves to that same dir from the id alone — the path a separate polling
    worker reads, with no workdir argument that wouldn't survive a process hop."""
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
    in-process BackgroundTask."""
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


def test_batch_segments_respects_token_budget():
    from app.services.analysis import batch_segments
    from app.services.segmentation import SegmentData
    # Each segment ~25 tokens of content; budget 200 -> a few per batch.
    segs = [SegmentData(f"f{i}.py", "python", 1, 5, "x = " + "a" * 80, f"h{i}") for i in range(10)]
    batches = batch_segments(segs, 200)
    assert len(batches) > 1                      # actually split
    assert sum(len(b) for b in batches) == 10    # nothing lost
    assert [s for b in batches for s in b] == segs  # order preserved


def test_batch_segments_oversized_segment_is_own_batch():
    from app.services.analysis import batch_segments
    from app.services.segmentation import SegmentData
    big = SegmentData("big.py", "python", 1, 500, "z" * 40000, "h")
    small = SegmentData("s.py", "python", 1, 2, "x=1", "h2")
    batches = batch_segments([big, small], 1000)
    assert [len(b) for b in batches] == [1, 1]   # big alone, small alone


def test_parse_batch_salvages_per_segment():
    import json
    from app.services.analysis import parse_batch
    raw = json.dumps({"results": {
        "0": {"security": [], "optimizations": [], "stubs": [],
              "segment_scores": {"security_risk": 0, "optimization_score": 100, "completeness_score": 100}},
        # index 1 missing entirely -> None; index 2 malformed but salvageable
        "2": {"security": [{"severity": "High"}], "optimizations": "not-a-list"},
    }})
    out = parse_batch(raw, 3)
    assert out[0] is not None
    assert out[1] is None                        # missing -> None, not a crash
    assert out[2] is not None and len(out[2].security) == 1
    assert out[2].optimizations == []            # bad array salvaged to empty


async def test_analyze_batch_single_segment_uses_single_path():
    # A batch of one should behave exactly like analyze_segment.
    from app.services.analysis import analyze_batch
    from app.services.segmentation import SegmentData
    seg = SegmentData("a.js", "js", 1, 4, "const sql = `SELECT * FROM t`;", "h")
    out = await analyze_batch([seg], fake_complete)
    assert len(out) == 1 and out[0] is not None
    assert len(out[0].security) == 1             # SQLi detected


async def test_analyze_batch_recovers_truncated_segments():
    """When the model truncates a batch (some indices missing), the missing
    segments are recovered by re-analysis — not silently dropped."""
    import json
    from app.services.analysis import analyze_batch
    from app.services.segmentation import SegmentData

    segs = [SegmentData(f"f{i}.py", "python", 1, 3, f"x = {i}", f"h{i}") for i in range(4)]
    clean = {"security": [], "optimizations": [], "stubs": [],
             "segment_scores": {"security_risk": 0, "optimization_score": 100, "completeness_score": 100}}
    calls = {"n": 0}

    async def truncating(prompt, model_hint):
        calls["n"] += 1
        import re
        blocks = re.findall(r"### SEGMENT (\d+)", prompt)
        idxs = [int(b) for b in blocks]
        # First call (the full batch of 4): only return indices 0,1 — simulate
        # the model truncating its JSON before segments 2,3.
        if calls["n"] == 1 and len(idxs) == 4:
            return json.dumps({"results": {"0": clean, "1": clean}})
        # Recovery calls: answer everything asked.
        return json.dumps({"results": {str(i): clean for i in range(len(idxs))}})

    out = await analyze_batch(segs, truncating)
    assert len(out) == 4
    assert all(r is not None for r in out)       # all 4 recovered, none dropped
    assert calls["n"] >= 2                        # the recovery actually ran


async def test_default_complete_satisfies_batch_contract():
    """The placeholder provider must answer a batch prompt in the indexed
    {"results": {"0": ...}} shape, not a single flat object. A flat object parses
    to all-None, which would force analyze_batch to split the whole batch down to
    single segments one call at a time. Regression: keyless scans degraded to
    1-call-per-segment and logged "segment dropped" for every segment first."""
    from app.services.analysis import analyze_batch, build_batch_prompt, parse_batch
    from app.services.orchestrator import default_complete
    from app.services.segmentation import SegmentData

    segs = [SegmentData(f"f{i}.py", "python", 1, 3, f"x = {i}", f"h{i}") for i in range(4)]

    # Direct parse: the batch response is fully index-aligned, zero None.
    raw = await default_complete(build_batch_prompt(segs, True, None, None), None)
    assert all(r is not None for r in parse_batch(raw, 4))

    # End-to-end: exactly one provider call (no split-to-singles recovery).
    calls = {"n": 0}

    async def counting(prompt, model_hint):
        calls["n"] += 1
        return await default_complete(prompt, model_hint)

    out = await analyze_batch(segs, counting)
    assert len(out) == 4 and all(r is not None for r in out)
    assert calls["n"] == 1, f"expected 1 batch call, got {calls['n']} (split-to-singles)"

    # The single-segment contract is unchanged: a non-batch prompt gets the flat
    # object (single path reuses analyze_segment, which expects that shape).
    single = await default_complete("analyze one segment", None)
    assert '"results"' not in single


async def test_concurrent_batches_complete_and_order_findings(auth, tmp_path):
    """With concurrency>1, batches run in parallel but results must still be
    correct: every segment analyzed, findings attributed to the right file,
    progress reaches 100%."""
    import asyncio as _asyncio
    import json as _json
    import random
    import re as _re
    from app.core.config import settings as _settings

    client, headers, _ = auth
    src = tmp_path / "repo"
    src.mkdir()
    # 12 files, each its own segment; half contain SQLi.
    for i in range(12):
        if i % 2 == 0:
            (src / f"f{i}.js").write_text(f"const r = db.raw(`SELECT * FROM t{i}`);\n")
        else:
            (src / f"f{i}.py").write_text(f"def fn{i}(a):\n    return a + {i}\n")

    async def jittery(prompt, model_hint):
        await _asyncio.sleep(random.uniform(0, 0.05))  # out-of-order completion
        if "### SEGMENT 0" in prompt:
            blocks = _re.findall(r"### SEGMENT (\d+).*?```\n(.*?)\n```", prompt, _re.DOTALL)
            return _json.dumps({"results": {i: _seg_result(_has_sqli(code)) for i, code in blocks}})
        return _json.dumps(_seg_result(_has_sqli(prompt)))

    # Force small batches so there are several concurrent ones.
    old_tok, old_conc = _settings.analysis_batch_tokens, _settings.analysis_concurrency
    _settings.analysis_batch_tokens = 30
    _settings.analysis_concurrency = 5
    try:
        async with SessionLocal() as db:
            scan = Scan(user_id=(await _current_user_id(client, headers)),
                        source_type="zip", repo="user/conc", models=["gemini"])
            db.add(scan); await db.commit(); sid = scan.id
        await run_scan(sid, complete=jittery, workdir=str(src), cleanup=False)
    finally:
        _settings.analysis_batch_tokens = old_tok
        _settings.analysis_concurrency = old_conc

    r = await client.get(f"{PREFIX}/scans/{sid}", headers=headers)
    s = r.json()["data"]
    assert s["status"] == SCAN_COMPLETED
    assert s["segments_analyzed"] == s["segment_total"] == 12
    assert s["segments_unparsed"] == 0
    r = await client.get(f"{PREFIX}/scans/{sid}/findings?engine=security", headers=headers)
    findings = r.json()["data"]
    assert len(findings) == 6                      # one per SQLi file, none lost
    # Each finding is attributed to a .js file (the ones with SQLi), not mixed up.
    assert all(f["file"].endswith(".js") for f in findings)


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
