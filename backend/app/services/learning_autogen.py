"""Resolve a finding to its Learning Hub class, generating one on demand.

Two responsibilities:

1. `resolve_class_for_finding` — given a finding's category / subcategory / CWE,
   return the best matching `LearningHubClass`. Unlike the old `/for-finding`
   resolver (which matched free-text labels against *static* class names and 404'd
   constantly), this matches on the finding's **category** — and if no class
   exists for that category, it generates one. So a "Learn more" click always
   lands on a real, relevant page.

2. `ensure_classes_for_scan` — after a scan finalizes, make sure every distinct
   finding category has a class. New vuln types grow the Hub automatically.

Generation is idempotent (keyed by slug) and best-effort: if the LLM is
unavailable, a solid templated class is built from the seed generator so the Hub
still grows. Never raises into the scan pipeline.
"""
from __future__ import annotations

import json
import logging

from sqlalchemy import func, or_, select

from app.core.database import SessionLocal
from app.models.learning import LearningHubClass
from app.models.scan import Finding, Scan
from app.services.learning_seed import slugify

logger = logging.getLogger(__name__)


def _finding_category(f: Finding) -> str | None:
    """The taxonomy label a class should be keyed to for this finding."""
    return (f.subcategory or f.category or f.stub_category or "").strip() or None


async def _class_by_category(db, category: str, cwe: str | None = None) -> LearningHubClass | None:
    """Find an existing class for a finding, converging variant wordings onto one
    class so the hub doesn't accumulate near-duplicates.

    Order: (1) exact CWE id — the canonical, language-independent key; the model
    can word the same CWE a dozen ways but they all explain one thing; (2) raw
    category/name match (case-insensitive). Returns None only if nothing matches.

    We deliberately do NOT fuzzy/alias-match on names: seed class names are
    descriptive ("SSRF via User-Controlled URLs"), so concept-string matching is
    unreliable and risks *wrong* merges. CWE is the safe canonical key; without
    one we fall back to exact label matching and let a genuinely new label create
    a class (slug-unique, so still no duplicates).
    """
    # 1) CWE is canonical — same CWE => same class, however it was worded.
    if cwe and cwe.strip():
        row = (
            await db.execute(
                select(LearningHubClass)
                .where(func.lower(LearningHubClass.cwe) == cwe.strip().lower())
                .limit(1)
            )
        ).scalar_one_or_none()
        if row:
            return row

    # 2) Exact category/name match (case-insensitive).
    like = category.strip().lower()
    return (
        await db.execute(
            select(LearningHubClass)
            .where(or_(
                func.lower(LearningHubClass.category) == like,
                func.lower(LearningHubClass.name) == like,
            ))
            .limit(1)
        )
    ).scalar_one_or_none()


_GEN_PROMPT = """You are a security educator writing a Learning Hub explainer for a
vulnerability/code-quality class. Respond ONLY with strict JSON in this shape:

{{"summary": "one-sentence plain-language summary",
  "faq": [{{"question": "...", "answer": "...", "advanced": "optional deeper note"}}],
  "resources": [{{"title": "...", "url": "https://...", "source": "OWASP|CWE|MDN|..."}}]}}

Write 4-6 FAQ entries (what it is, why it's dangerous, how to detect, how to fix,
common pitfalls). Answers 2-4 sentences, beginner-friendly; put deeper technical
detail in "advanced". 2-4 real, reputable resource links.

Class: {name}
Category: {category}
Severity: {severity}
CWE: {cwe}  OWASP: {owasp}
"""


async def _generate_content(router, name, category, severity, cwe, owasp) -> dict | None:
    """LLM-generated content dict, or None to signal templated fallback."""
    if router is None or not router.has_any_key():
        return None
    prompt = _GEN_PROMPT.format(
        name=name, category=category, severity=severity or "medium",
        cwe=cwe or "—", owasp=owasp or "—",
    )
    try:
        raw = await router.complete(prompt, response_json=True)
    except Exception as exc:  # never let generation break the caller
        logger.warning("learning autogen LLM call failed for %r: %s", name, exc)
        return None
    if not (raw or "").strip():
        return None
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return None
    if not isinstance(data, dict) or not data.get("faq"):
        return None
    return {
        "summary": str(data.get("summary") or "")[:600],
        "faq": data.get("faq") or [],
        "resources": data.get("resources") or [],
    }


def _templated_content(name, category, cwe, owasp, severity) -> dict:
    """Deterministic fallback content reusing the seed generator's templates."""
    from app.services import learning_seed as seed
    return {
        "summary": seed._summary(name, category),
        "faq": seed._faq(name, category, cwe, owasp, severity),
        "resources": seed._build_resources(name, category, cwe, owasp),
    }


async def _create_class(db, *, name, category, severity, cwe, owasp, router) -> LearningHubClass:
    """Insert (idempotently) a class for `name`/`category` and return it."""
    slug = slugify(category, name)
    existing = (
        await db.execute(select(LearningHubClass).where(LearningHubClass.slug == slug))
    ).scalar_one_or_none()
    if existing:
        return existing

    content = await _generate_content(router, name, category, severity, cwe, owasp)
    if content is None:
        content = _templated_content(name, category, cwe, owasp, severity)

    cls = LearningHubClass(
        slug=slug, name=name, category=category, severity=(severity or "medium"),
        cwe=cwe, owasp=owasp, summary=content["summary"],
        faq=content["faq"], resources=content["resources"],
    )
    db.add(cls)
    try:
        await db.flush()
    except Exception:
        # Lost a race to another insert with the same slug — fetch the winner.
        await db.rollback()
        return (
            await db.execute(select(LearningHubClass).where(LearningHubClass.slug == slug))
        ).scalar_one_or_none() or cls
    return cls


async def resolve_class_for_finding(finding_id: str, user_id: str, router=None) -> str | None:
    """Return the slug of the class that best explains `finding_id`, generating
    one if its category has no class yet. None only if the finding isn't found."""
    async with SessionLocal() as db:
        f = await db.get(Finding, finding_id)
        if f is None:
            return None
        # Ownership: the finding's scan must belong to the user.
        scan = await db.get(Scan, f.scan_id)
        if scan is None or scan.user_id != user_id:
            return None

        category = _finding_category(f)
        if not category:
            return None

        hit = await _class_by_category(db, category, cwe=f.cwe_id)
        if hit:
            return hit.slug

        cls = await _create_class(
            db, name=category, category=(f.category or category),
            severity=f.severity, cwe=f.cwe_id, owasp=f.owasp_ref, router=router,
        )
        await db.commit()
        return cls.slug


async def ensure_classes_for_scan(scan_id: str) -> int:
    """Generate Hub classes for any finding categories in this scan that don't
    have one yet. Returns how many were created. Best-effort; never raises."""
    created = 0
    try:
        from app.services.router_factory import build_router_for_user

        async with SessionLocal() as db:
            scan = await db.get(Scan, scan_id)
            if scan is None:
                return 0
            findings = (
                await db.execute(select(Finding).where(Finding.scan_id == scan_id))
            ).scalars().all()

            # Distinct (category, representative finding) pairs.
            seen: dict[str, Finding] = {}
            for f in findings:
                cat = _finding_category(f)
                if cat and cat not in seen:
                    seen[cat] = f
            if not seen:
                return 0

            router = await build_router_for_user(scan.user_id, purpose="learning")
            for cat, f in seen.items():
                if await _class_by_category(db, cat, cwe=f.cwe_id):
                    continue
                await _create_class(
                    db, name=cat, category=(f.category or cat), severity=f.severity,
                    cwe=f.cwe_id, owasp=f.owasp_ref, router=router,
                )
                created += 1
            await db.commit()
    except Exception as exc:
        logger.warning("ensure_classes_for_scan failed for %s: %s", scan_id, exc)
    return created
