"""Attack-chain correlation pass tests.

Covers the deterministic catalog matcher and the subset-dedup. The LLM free-form
pass is exercised indirectly (router=None -> catalog-only), keeping these tests
provider-independent.
"""
import pytest

from app.models.scan import ENGINE_SECURITY, ENGINE_OPTIMIZATION, Finding
from app.services.attack_chains import (
    _detect_catalog,
    _dedup,
    _matches,
    correlate_attack_chains,
    MIN_STEPS_MATCHED,
)
from app.models.attack_path import AttackPath, SOURCE_CATALOG
from app.core.database import SessionLocal


def _f(pid, category, subcategory, engine=ENGINE_SECURITY, severity="high", cwe=None):
    return Finding(
        scan_id="s", public_id=pid, engine=engine, category=category,
        subcategory=subcategory, severity=severity, file="x.py", cwe_id=cwe,
    )


def test_acronym_and_substring_matching():
    f = _f("VLN-1", "Auth", "Insecure Direct Object Reference (IDOR)")
    assert _matches("Insecure Direct Object Reference (IDOR)", f)
    f2 = _f("VLN-2", "Injection", "SQL Injection (Classic)")
    assert _matches("SQL Injection (Classic)", f2)
    # Unrelated step must not match.
    assert not _matches("Clickjacking", f2)


def test_catalog_detects_ssrf_metadata_chain():
    findings = [
        _f("VLN-1", "API Security", "SSRF via User-Controlled URLs", cwe="CWE-918"),
        _f("VLN-2", "Cloud & Serverless", "Cloud Credentials in Source", cwe="CWE-798"),
    ]
    paths = _detect_catalog(findings)
    names = {p["name"] for p in paths}
    assert "SSRF → Cloud Metadata → Credential Theft" in names
    chain = next(p for p in paths if p["name"].startswith("SSRF"))
    assert chain["finding_public_ids"] == ["VLN-1", "VLN-2"]
    assert chain["source"] == SOURCE_CATALOG
    assert chain["learn_slug"]  # links to a Hub class


def test_synonym_matching_survives_model_rewording():
    # Real labels a live model produced — different wording from the catalog's
    # class names. The synonym layer must still connect them (regression: these
    # used to silently miss, yielding 0 chains on a clearly-vulnerable scan).
    assert _matches("SSRF via User-Controlled URLs",
                    _f("V", "API Security", "Server Side Request Forgery (SSRF)"))
    assert _matches("Hardcoded API Keys",
                    _f("V", "Data Exposure & Secrets", "Hardcoded Credentials"))
    assert _matches("Insecure Direct Object Reference (IDOR)",
                    _f("V", "Auth", "Missing Access Control"))
    assert _matches("File Upload Without Type Validation",
                    _f("V", "File Upload", "Unrestricted File Upload"))
    # Unrelated concepts must NOT match (no false merges).
    assert not _matches("SSRF via User-Controlled URLs",
                        _f("V", "Injection", "SQL Injection (Classic)"))


def test_isolated_findings_produce_no_false_chains():
    # Regression: a real scan of 3 unrelated findings (run-as-root + two
    # hardcoded secrets) must NOT spuriously confirm unrelated chains (RAG leak,
    # plaintext-storage, secrets-in-logs) just because they share generic CWEs /
    # the word "secret". The entry point of each chain isn't present here.
    findings = [
        _f("VLN-1", "Configuration & Infrastructure", "Run as root", cwe="CWE-250", severity="medium"),
        _f("VLN-2", "Data Exposure & Secrets", "Hardcoded Secret Disclosure", cwe="CWE-798"),
        _f("VLN-3", "Data Exposure & Secrets", "Hardcoded Credentials", cwe="CWE-522"),
    ]
    paths = _detect_catalog(findings)
    names = {p["name"] for p in paths}
    assert not any("RAG" in n for n in names)
    assert not any("Plaintext Storage" in n for n in names)
    assert not any("Secrets in Logs" in n for n in names)


def test_cwe_keyed_matching_survives_any_wording():
    # CWE is the primary key: even a label that shares no words with the step
    # matches when the CWE lines up.
    f = _f("V", "Weird Category", "totally different wording", cwe="CWE-89")
    assert _matches({"label": "SQL injection", "cwe": ["CWE-89"]}, f)
    # Generic CWE alone is a WEAK match (won't confirm), specific CWE is strong.
    from app.services.attack_chains import _match_strength, MATCH_WEAK, MATCH_STRONG
    weak = _f("V", "x", "unrelated", cwe="CWE-200")
    assert _match_strength({"label": "data leak", "cwe": ["CWE-200"]}, weak) == MATCH_WEAK
    assert _match_strength({"label": "sqli", "cwe": ["CWE-89"]}, f) == MATCH_STRONG


def test_lenient_json_tolerates_control_chars_and_fences():
    from app.services.attack_chains import _loads_lenient
    # Raw newline inside a string value (strict json.loads rejects this).
    assert _loads_lenient('{"chains": [{"name": "a\nb"}]}')["chains"][0]["name"]
    # Code-fenced JSON.
    assert _loads_lenient('```json\n{"chains": []}\n```') == {"chains": []}
    # Garbage -> {} (never raises).
    assert _loads_lenient("not json") == {}


def test_single_step_does_not_trigger():
    # Only one link present -> below MIN_STEPS_MATCHED -> no chain.
    findings = [_f("VLN-1", "Cloud & Serverless", "Cloud Credentials in Source")]
    assert _detect_catalog(findings) == []
    assert MIN_STEPS_MATCHED == 2


def test_optimization_findings_ignored():
    findings = [
        _f("OPT-1", "Performance", "N+1 Query", engine=ENGINE_OPTIMIZATION),
        _f("OPT-2", "Code Quality", "Dead Code", engine=ENGINE_OPTIMIZATION),
    ]
    assert _detect_catalog(findings) == []


def test_dedup_drops_subset_chains():
    a = {"name": "big", "finding_public_ids": ["VLN-1", "VLN-2", "VLN-3"]}
    b = {"name": "sub", "finding_public_ids": ["VLN-1", "VLN-2"]}
    kept = _dedup([a, b])
    assert len(kept) == 1 and kept[0]["name"] == "big"


async def test_correlate_persists_paths(auth):
    """End-to-end: seed a scan + findings, run correlation (no LLM), read back."""
    from tests.conftest import PREFIX
    client, headers, _ = auth
    uid = (await client.get(f"{PREFIX}/profile", headers=headers)).json()["data"]["id"]

    async with SessionLocal() as db:
        from app.models.scan import Scan, SCAN_COMPLETED
        scan = Scan(user_id=uid, source_type="zip", status=SCAN_COMPLETED, files=1)
        db.add(scan)
        await db.flush()
        sid = scan.id
        findings = [
            _f("VLN-1", "API Security", "SSRF via User-Controlled URLs", cwe="CWE-918"),
            _f("VLN-2", "Cloud & Serverless", "Cloud Credentials in Source", cwe="CWE-798"),
        ]
        for f in findings:
            f.scan_id = sid
            db.add(f)
        await db.commit()

    n = await correlate_attack_chains(sid, findings, router=None)
    assert n >= 1

    r = await client.get(f"{PREFIX}/scans/{sid}/attack-paths", headers=headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert any(p["name"].startswith("SSRF") for p in data)
    assert data[0]["public_id"].startswith("CHN-")
