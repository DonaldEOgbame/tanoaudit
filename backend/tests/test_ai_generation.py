"""Unit tests for the AI-generation composition heuristic.

`analyze()` is pure over a list of Finding rows, so these build findings in memory
(no DB) and assert the percent + delta semantics.
"""
from app.models.scan import Finding
from app.services.ai_generation import analyze


def _f(engine, severity="low", *, stub_category=None, category=None,
       subcategory=None, explanation=None) -> Finding:
    return Finding(
        engine=engine, severity=severity, stub_category=stub_category,
        category=category, subcategory=subcategory, explanation=explanation,
    )


def test_no_findings_is_zero_and_parity():
    out = analyze([], files=10)
    assert out["percent"] == 0
    assert out["delta"] == 1.0
    assert out["patterns"] == []


def test_delta_is_directional_not_always_more_likely():
    """The old metric counted only security-engine findings, so a stub-heavy AI
    set was forced below 1 while the UI claimed 'more likely'. Delta must now be a
    coherent risk-density ratio: when AI areas are NOT riskier, delta must be <= 1."""
    # AI-signaled findings: all low-severity stubs (no risk).
    findings = [_f("stub", "low", stub_category="incomplete") for _ in range(5)]
    # Human findings: several high-severity security issues (the real risk).
    findings += [_f("security", "high", category="Injection") for _ in range(5)]

    out = analyze(findings, files=8)
    # AI set carries no high-severity; human set is all high-severity → safer.
    assert out["delta"] < 1.0
    # And never a misleading 0.0.
    assert out["delta"] >= 0.1


def test_delta_above_one_when_ai_areas_are_riskier():
    # AI-signaled set includes high-severity findings; human set is low risk.
    findings = [
        _f("stub", "critical", stub_category="incomplete"),
        _f("security", "high", category="Hardcoded secret",
           explanation="hardcoded API secret in source"),  # matches signature
    ]
    findings += [_f("optimization", "low", category="Style") for _ in range(6)]

    out = analyze(findings, files=4)
    assert out["delta"] > 1.0
    assert out["percent"] > 0


def test_patterns_counted_from_real_findings():
    findings = [
        _f("stub", "high", stub_category="incomplete", explanation="todo: implement"),
        _f("security", "medium", category="Validation", explanation="weak regex validation"),
        _f("security", "low", category="Dead code", explanation="unused import lodash"),
    ]
    out = analyze(findings, files=3)
    names = {p["name"]: p["count"] for p in out["patterns"]}
    assert "Incomplete / AI-generated stubs" in names
    assert "Copy-pasted validation" in names
    assert sum(p["count"] for p in out["patterns"]) >= 3
