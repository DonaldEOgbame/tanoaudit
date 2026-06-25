"""Post-scan correlation pass: detect vulnerability *combinations* (attack chains).

A single Finding is a local weakness. A real hack is usually several weaknesses
chained together (SSRF -> cloud metadata -> credential theft). The per-file
analyzer can never see those compositions because it only sees one segment at a
time. This pass runs in `orchestrator._finalize`, *after* every finding exists,
with the whole finding set in hand.

Detection is hybrid (the user's choice):
  1. Catalog match (deterministic) — for each curated chain in
     `taxonomy_data.ATTACK_CHAINS`, if >=2 of its steps are present among the
     scan's findings, emit a path linking the matched findings.
  2. LLM free-form — when a provider key exists, ask the model to propose
     additional chains (including novel ones) from the finding list, validated to
     reference only real finding public ids.

Best-effort: never raises into the scan pipeline. Idempotent per scan (clears and
rebuilds this scan's paths) so a re-finalize doesn't duplicate.
"""
from __future__ import annotations

import json
import logging
import re

from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.models.attack_path import SOURCE_CATALOG, SOURCE_NOVEL, AttackPath
from app.models.scan import ENGINE_SECURITY, Finding, Scan
from app.services.learning_seed import slugify
from app.services.taxonomy_data import ATTACK_CHAIN_CATEGORY, ATTACK_CHAINS

logger = logging.getLogger(__name__)

# A chain is reported only if at least this many of its steps are present.
MIN_STEPS_MATCHED = 2
# For long chains, this many matched links (with the entry point) = confirmed.
MIN_STEPS_CONFIRMED = 3

# Detection confidence tiers, surfaced so the UI/chat can label honestly.
TIER_CONFIRMED = "confirmed"  # full step-match (or enough links + entry point)
TIER_POTENTIAL = "potential"  # entry point + at least one further link
_STOPWORDS = {"the", "a", "an", "of", "in", "on", "to", "via", "and", "or",
              "with", "without", "from", "for", "by", "into"}


def _loads_lenient(raw: str):
    """Parse model JSON tolerantly: strip ```json fences, allow raw control
    characters in strings (strict=False), and fall back to the first {...} block.
    Models routinely emit a stray newline inside a string value, which the strict
    parser rejects — we don't want that to drop a whole batch of chains."""
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n?|\n?```$", "", s).strip()
    try:
        return json.loads(s, strict=False)
    except (ValueError, TypeError):
        m = re.search(r"\{.*\}", s, re.DOTALL)
        if not m:
            return {}
        try:
            return json.loads(m.group(0), strict=False)
        except (ValueError, TypeError):
            return {}


def _tokens(text: str) -> set[str]:
    raw = re.sub(r"[^a-z0-9 ]+", " ", (text or "").lower())
    return {t for t in raw.split() if t and t not in _STOPWORDS and len(t) > 2}


def _finding_labels(f: Finding) -> str:
    return " ".join(
        p for p in (f.category, f.subcategory, f.subcategory_raw) if p
    )


# Concept synonym groups: the model words the same weakness many ways
# ("SSRF" / "Server Side Request Forgery", "Hardcoded API Keys" / "Hardcoded
# Credentials"). A catalog step and a finding match if BOTH contain a phrase from
# the SAME group. Groups are concept-specific, so this widens recall without
# false-merging unrelated classes. Phrases are matched as lowercased substrings.
_CONCEPT_GROUPS: list[list[str]] = [
    ["ssrf", "server side request forgery", "server-side request forgery"],
    ["idor", "insecure direct object reference", "broken object level",
     "broken object-level", "missing access control", "missing authorization"],
    ["sql injection", "sqli"],
    ["command injection", "os command", "rce", "remote code execution"],
    ["path traversal", "directory traversal", "../"],
    ["file upload", "unrestricted upload", "arbitrary file upload"],
    # Kept narrow: "hardcoded/embedded secret" is its own concept, distinct from
    # "plaintext credential storage" or "secret in logs" (separate chains). Don't
    # add bare "secret"/"credential" here — they bleed across unrelated chains.
    ["hardcoded", "hard-coded", "embedded credential", "embedded secret",
     "api key in", "private key in source"],
    ["broken authentication", "auth bypass", "authentication bypass",
     "missing authentication", "plaintext password"],
    ["rate limit", "rate-limit", "rate limiting"],
    ["deserialization", "unpickle", "pickle", "unserialize"],
    ["xss", "cross site scripting", "cross-site scripting"],
    ["open redirect", "unvalidated redirect"],
    ["cloud credential", "iam", "metadata", "instance metadata", "169.254"],
    ["prompt injection"],
    ["request smuggling", "desync"],
    ["cache poisoning", "cache deception"],
    ["websocket", "ws upgrade"],
    ["dependency confusion", "typosquat"],
    ["verbose error", "stack trace", "error message"],
    ["excessive data exposure", "data leakage", "pii"],
]


def _acronyms(text: str) -> set[str]:
    return {a.lower() for a in re.findall(r"\b([A-Z]{2,6})\b", text)}


def _concepts(text_l: str) -> set[int]:
    """Indices of concept groups present in a lowercased string."""
    return {i for i, grp in enumerate(_CONCEPT_GROUPS)
            if any(phrase in text_l for phrase in grp)}


def _cwe_num(cwe: str | None) -> str | None:
    """Normalize a CWE to its bare number string ('CWE-89' / 'cwe89' -> '89')."""
    if not cwe:
        return None
    m = re.search(r"(\d+)", str(cwe))
    return m.group(1) if m else None


def _step_label(step) -> str:
    """A step is either a plain label string or a dict {label, cwe:[...]}."""
    return step["label"] if isinstance(step, dict) else str(step)


def _step_cwes(step) -> set[str]:
    """Acceptable CWE numbers for a step (empty for legacy string steps)."""
    if not isinstance(step, dict):
        return set()
    raw = step.get("cwe") or []
    if isinstance(raw, str):
        raw = [raw]
    return {n for n in (_cwe_num(c) for c in raw) if n}


def _text_matches(label_text: str, f: Finding) -> bool:
    """Wording-independent text match (the original `_matches` body): shared
    concept group, shared acronym, substring, or strong token overlap."""
    label = _finding_labels(f).lower()
    if not label:
        return False
    step_l = label_text.lower()
    if _concepts(step_l) & _concepts(label):
        return True
    # Genuine acronyms only — from the ORIGINAL casing. Never uppercase the whole
    # string first (that turns every word into a fake acronym, so "DATA"/"CONTEXT"
    # spuriously match). Require length >=3 to avoid 2-letter noise.
    sa = {a for a in _acronyms(label_text) if len(a) >= 3}
    fa = {a for a in _acronyms(_finding_labels(f)) if len(a) >= 3}
    if sa & fa:
        return True
    if step_l in label or label in step_l:
        return True
    st, lt = _tokens(label_text), _tokens(label)
    if not st:
        return False
    return len(st & lt) >= max(2, (len(st) + 1) // 2)


# Broad CWEs that appear across many unrelated chains. A match on ONE of these
# alone is weak — it's evidence (counts toward a 'potential' path) but must not by
# itself 'confirm' a step, or generic findings (a hardcoded secret) spuriously
# complete chains they have nothing to do with (e.g. a RAG-leak chain).
_GENERIC_CWES = {"200", "522", "284", "693", "1188", "20", "732", "269", "863",
                 "311", "312", "538", "770"}

# Match strength for a step against a finding.
MATCH_NONE = 0
MATCH_WEAK = 1    # generic-CWE overlap only
MATCH_STRONG = 2  # specific CWE, or a text/concept match


def _match_strength(step, f: Finding) -> int:
    """How strongly finding `f` matches the weakness the step names.

    Strong = a specific (non-generic) CWE hit, or a text/concept/acronym hit on
    the label. Weak = only a generic CWE overlaps. None = no signal. Keeping the
    two tiers separate is what stops a broad finding from silently confirming an
    unrelated chain just because both touch CWE-200/CWE-522.
    """
    fn = _cwe_num(f.cwe_id)
    step_cwes = _step_cwes(step)
    if fn and fn in step_cwes and fn not in _GENERIC_CWES:
        return MATCH_STRONG
    if _text_matches(_step_label(step), f):
        return MATCH_STRONG
    if fn and fn in step_cwes:  # generic CWE only
        return MATCH_WEAK
    return MATCH_NONE


def _matches(step, f: Finding) -> bool:
    """Back-compat boolean match (any signal). Prefer `_match_strength`."""
    return _match_strength(step, f) > MATCH_NONE


def _detect_catalog(findings: list[Finding]) -> list[dict]:
    """Deterministic matches against the curated ATTACK_CHAINS catalog.

    Tiered: a chain whose FIRST step (the entry point) and at least one further
    link both match is a 'potential' path; a chain with ALL of its steps matched
    (or >=MIN_STEPS_CONFIRMED for long chains) is 'confirmed'. Potential paths
    maximise recall while staying honest about confidence — they're flagged so the
    UI/chat can label them as such.
    """
    sec = [f for f in findings if f.engine == ENGINE_SECURITY]
    out: list[dict] = []
    for key, chain in ATTACK_CHAINS.items():
        steps = chain["steps"]
        matched: list[Finding] = []
        ordered_steps: list[str] = []
        step_strengths: list[int] = []
        for step in steps:
            # Pick the strongest-matching unused finding for this step.
            best, best_str = None, MATCH_NONE
            for f in sec:
                if f in matched:
                    continue
                s = _match_strength(step, f)
                if s > best_str:
                    best, best_str = f, s
                    if s == MATCH_STRONG:
                        break
            if best is not None and best_str > MATCH_NONE:
                matched.append(best)
                ordered_steps.append(_step_label(step))
                step_strengths.append(best_str)
            else:
                step_strengths.append(MATCH_NONE)
        n = len(matched)
        strong_count = sum(1 for s in step_strengths if s == MATCH_STRONG)
        entry_strong = step_strengths and step_strengths[0] == MATCH_STRONG
        # The ENTRY POINT defines the chain — it must match strongly and
        # specifically, or the chain doesn't apply (this is what stops a generic
        # secret finding from completing an unrelated RAG/log/storage chain). Also
        # require >=2 links and >=2 strong links overall.
        if n < MIN_STEPS_MATCHED or strong_count < 2 or not entry_strong:
            continue
        # Confirmed: the entry point and every matched link are STRONG (specific)
        # and there are >=2 of them. A path resting on any weak/generic link, or
        # with only one strong link, stays 'potential'. This confirms a real 2-of-3
        # chain (e.g. SSRF + cloud creds) without confirming generic-overlap noise.
        weak_links = sum(1 for s in step_strengths if s == MATCH_WEAK)
        confirmed = strong_count >= 2 and weak_links == 0
        tier = TIER_CONFIRMED if confirmed else TIER_POTENTIAL
        prefix = "" if confirmed else "Potential: "
        out.append({
            "name": prefix + key,
            "severity": chain["severity"],
            "source": SOURCE_CATALOG,
            "catalog_key": key,
            "tier": tier,
            "finding_public_ids": [f.public_id for f in matched],
            "steps": ordered_steps,
            "impact": chain["impact"],
            "real_world": chain["real_world"],
            "remediation": (
                f"Break the chain by removing any one link — start with "
                f"'{ordered_steps[0]}'. Fixing the entry point alone stops the path."
            ),
            "cwe_id": chain.get("cwe"),
            "learn_slug": slugify(ATTACK_CHAIN_CATEGORY, key),
        })
    return out


_LLM_PROMPT = """You are a senior offensive-security engineer reviewing a code
audit's findings. Identify ATTACK CHAINS: combinations of TWO OR MORE of the
findings below that, chained together, form a realistic exploitation path (a real
hack), not just isolated bugs.

Rules:
- Only chain findings that actually appear in the list, referenced by their exact
  id (e.g. "VLN-0007"). Never invent ids.
- A chain needs at least 2 findings and a plausible cause->effect progression.
- Prefer high-impact paths (account takeover, RCE, data exfiltration, privilege
  escalation, supply-chain compromise).
- Skip chains already covered by the catalog names provided.

Respond ONLY with strict JSON:
{{"chains": [{{"name": "Short Arrow Title (A -> B -> C)",
  "severity": "critical|high|medium|low",
  "finding_ids": ["VLN-0001", "VLN-0005"],
  "steps": ["what the attacker does at each link"],
  "impact": "one sentence: what they ultimately achieve",
  "real_world": "a real breach or canonical technique this resembles",
  "remediation": "how to break the chain (one link is enough)",
  "cwe": "CWE-XXX for the terminal step"}}]}}

Return an empty list if no genuine chains exist. Do not force weak combinations.

Catalog chains already detected (do not repeat): {already}

Findings:
{findings}
"""


def _finding_lines(findings: list[Finding], limit: int = 60) -> str:
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    sec = [f for f in findings if f.engine == ENGINE_SECURITY]
    ranked = sorted(sec, key=lambda f: order.get((f.severity or "").lower(), 5))
    return "\n".join(
        f"- {f.public_id} [{(f.severity or '').upper()}] {_finding_labels(f)} "
        f"in {f.file}: {(f.explanation or '')[:100]}"
        for f in ranked[:limit]
    )


async def _detect_llm(findings: list[Finding], already: list[str], router) -> list[dict]:
    sec = [f for f in findings if f.engine == ENGINE_SECURITY]
    if router is None or not router.has_any_key() or len(sec) < 2:
        return []
    valid_ids = {f.public_id for f in sec}
    prompt = _LLM_PROMPT.format(
        already=", ".join(already) or "(none)", findings=_finding_lines(findings),
    )
    try:
        raw = await router.complete(prompt, response_json=True)
        data = _loads_lenient(raw or "{}")
    except Exception as exc:  # never break finalize
        logger.warning("attack-chain LLM pass failed: %s", exc)
        return []
    if not isinstance(data, dict):
        return []
    out: list[dict] = []
    for ch in (data.get("chains") or []):
        if not isinstance(ch, dict):
            continue
        ids = [i for i in (ch.get("finding_ids") or []) if i in valid_ids]
        ids = list(dict.fromkeys(ids))  # de-dup, preserve order
        name = str(ch.get("name") or "").strip()
        if len(ids) < MIN_STEPS_MATCHED or not name:
            continue  # hallucinated ids or trivial — drop
        sev = str(ch.get("severity") or "high").lower()
        if sev not in {"critical", "high", "medium", "low"}:
            sev = "high"
        out.append({
            "name": name[:200],
            "severity": sev,
            "source": SOURCE_NOVEL,
            "catalog_key": None,
            "tier": TIER_CONFIRMED,  # the model asserts a concrete combination
            "finding_public_ids": ids,
            "steps": [str(s)[:300] for s in (ch.get("steps") or [])][:8],
            "impact": (str(ch.get("impact") or "") or None),
            "real_world": (str(ch.get("real_world") or "") or None),
            "remediation": (str(ch.get("remediation") or "") or None),
            "cwe_id": (str(ch.get("cwe") or "") or None),
            # Novel chains have no curated Hub class; the generic category page
            # for ATTACK_CHAIN_CATEGORY still covers the concept.
            "learn_slug": None,
        })
    return out


def _dedup(paths: list[dict]) -> list[dict]:
    """Drop chains whose finding set is a subset of an already-kept chain, so the
    LLM doesn't restate a weaker version of a catalog chain and a 'potential'
    partial doesn't shadow a 'confirmed' superset. Confirmed + larger sets are
    kept first, so a partial subset of a confirmed chain is dropped."""
    def rank(p):
        return (0 if p.get("tier") == TIER_POTENTIAL else 1,
                len(p["finding_public_ids"]))
    kept: list[dict] = []
    for p in sorted(paths, key=rank, reverse=True):
        pset = set(p["finding_public_ids"])
        if any(pset <= set(k["finding_public_ids"]) for k in kept):
            continue
        kept.append(p)
    return kept


_SEV_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1}


async def correlate_attack_chains(scan_id: str, findings: list[Finding], router) -> int:
    """Detect and persist attack chains for a finalized scan. Returns the count.
    Best-effort: logs and returns 0 on any failure."""
    try:
        catalog = _detect_catalog(findings)
        novel = await _detect_llm(findings, [c["name"] for c in catalog], router)
        paths = _dedup(catalog + novel)
        # Confirmed before potential, then by severity.
        paths.sort(key=lambda p: (
            0 if p.get("tier") == TIER_POTENTIAL else 1,
            _SEV_ORDER.get(p["severity"], 0),
        ), reverse=True)

        async with SessionLocal() as db:
            # Idempotent: rebuild this scan's paths.
            await db.execute(delete(AttackPath).where(AttackPath.scan_id == scan_id))
            for i, p in enumerate(paths, start=1):
                db.add(AttackPath(
                    scan_id=scan_id, public_id=f"CHN-{i:04d}", **p,
                ))
            await db.commit()
        if paths:
            logger.info("scan %s: detected %d attack chain(s)", scan_id, len(paths))
        return len(paths)
    except Exception as exc:
        logger.warning("attack-chain correlation failed for %s: %s", scan_id, exc)
        return 0
