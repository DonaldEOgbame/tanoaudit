"""Detection benchmark.

Two layers:
1. `test_harness_*` — always run in CI. They validate the annotation parser,
   marker stripping, and scoring logic against synthetic findings (no LLM), so
   the benchmark scaffolding itself is trusted.
2. `test_detection_recall` — opt-in (`RUN_DETECTION_BENCHMARK=1`, real provider
   keys). It scans the corpus and asserts a recall floor, printing per-engine
   recall/precision. Skipped otherwise, because the deterministic fallback
   provider finds nothing and there's no network in CI.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest

from tests.benchmark import harness

CORPUS = str(Path(__file__).parent.parent / "fixtures" / "vuln_corpus")
RECALL_FLOOR = float(os.getenv("DETECTION_RECALL_FLOOR", "0.70"))


# ---- Layer 1: harness self-tests (always run) -------------------------------
def test_harness_parses_planted_markers():
    planted = harness.parse_planted(CORPUS)
    assert len(planted) >= 15  # the seeded corpus
    engines = {p.engine for p in planted}
    assert {"security", "optimization", "stub"} <= engines
    # A known marker is present.
    assert any(p.slug == "sql-injection" and p.file == "auth_api.js" for p in planted)


def test_harness_strips_markers():
    src = "const x = 1; // PLANTED: security/xss\nconst y = 2;\n"
    stripped = harness.strip_markers(src)
    assert "PLANTED" not in stripped
    assert "const y = 2;" in stripped


def test_harness_scoring_recall_and_precision():
    planted = [
        harness.Planted("security", "sql-injection", "a.js"),
        harness.Planted("security", "xss", "a.js"),
        harness.Planted("stub", "todo-stub", "b.py"),
    ]
    findings = [
        {"engine": "security", "file": "a.js", "category": "Injection",
         "subcategory": "SQL Injection"},                       # matches #1
        {"engine": "stub", "file": "b.py", "category": "TODO stub",
         "subcategory": ""},                                     # matches #3
        {"engine": "security", "file": "a.js", "category": "Logging",
         "subcategory": "Verbose logs"},                        # unmatched -> precision drag
    ]
    scores = harness.score(planted, findings)
    assert scores["security"].matched == 1
    assert scores["security"].unmatched_findings == 1
    assert scores["stub"].matched == 1
    # xss was planted but never found.
    assert ("a.js", "xss") in scores["all"].missed
    assert scores["all"].planted == 3 and scores["all"].matched == 2
    assert abs(scores["all"].recall - 2 / 3) < 1e-9


# ---- Layer 2: live benchmark (opt-in) ---------------------------------------
@pytest.mark.skipif(
    os.getenv("RUN_DETECTION_BENCHMARK") != "1",
    reason="set RUN_DETECTION_BENCHMARK=1 (and provider keys) to run the live benchmark",
)
@pytest.mark.asyncio
async def test_detection_recall(tmp_path, auth):
    """Scan the corpus with real models and assert a recall floor."""
    from app.core.database import SessionLocal
    from app.models.scan import Finding, Scan, SCAN_COMPLETED
    from app.services.orchestrator import run_scan
    from sqlalchemy import select

    client, headers, _ = auth
    uid = (await client.get("/api/v1/profile", headers=headers)).json()["data"]["id"]

    # Copy corpus into a workdir with markers stripped, so the model can't cheat.
    src = Path(CORPUS)
    work = tmp_path / "corpus"
    for path in src.rglob("*"):
        if path.is_file() and path.suffix != ".md":
            rel = path.relative_to(src)
            dest = work / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(harness.strip_markers(path.read_text(errors="replace")))

    async with SessionLocal() as db:
        scan = Scan(user_id=uid, source_type="zip", repo="corpus", models=["gemini"])
        db.add(scan)
        await db.flush()
        scan_id = scan.id
        await db.commit()

    await run_scan(scan_id, workdir=str(work), cleanup=False)

    async with SessionLocal() as db:
        scan = await db.get(Scan, scan_id)
        assert scan.status == SCAN_COMPLETED
        rows = (await db.execute(
            select(Finding).where(Finding.scan_id == scan_id)
        )).scalars().all()

    findings = [
        {"engine": f.engine, "file": f.file,
         "category": f.category or "", "subcategory": f.subcategory or ""}
        for f in rows
    ]
    planted = harness.parse_planted(CORPUS)
    scores = harness.score(planted, findings)
    print(harness.format_report(scores))

    assert scores["all"].recall >= RECALL_FLOOR, (
        f"detection recall {scores['all'].recall:.0%} below floor {RECALL_FLOOR:.0%}"
    )
