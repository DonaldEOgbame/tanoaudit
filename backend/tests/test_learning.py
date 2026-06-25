"""Module 14 tests: Learning Hub seed, list/search/detail, non-security content,
finding resolver + auto-generation."""
import pytest
from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models.learning import LearningHubClass
from app.models.scan import Finding, Scan, SCAN_COMPLETED, ENGINE_SECURITY
from app.services.learning_seed import build_classes, slugify
from app.services.learning_service import seed_learning_hub
from app.services.taxonomy_data import total_classes
from tests.conftest import PREFIX


async def _uid(client, headers):
    r = await client.get(f"{PREFIX}/profile", headers=headers)
    return r.json()["data"]["id"]


async def _seed_finding(user_id, *, category, subcategory=None, cwe="CWE-89"):
    async with SessionLocal() as db:
        scan = Scan(user_id=user_id, source_type="zip", repo="user/x",
                    status=SCAN_COMPLETED, files=1, segment_total=1)
        db.add(scan)
        await db.flush()
        f = Finding(
            scan_id=scan.id, public_id="VLN-0001", engine=ENGINE_SECURITY,
            category=category, subcategory=subcategory, severity="high",
            confidence="High", file="a.js", line_start=1, line_end=2,
            cwe_id=cwe, explanation="x",
        )
        db.add(f)
        await db.commit()
        return scan.id, f.id


@pytest.fixture
async def seeded_hub(client):
    # Lifespan isn't run under ASGITransport, so seed explicitly per test.
    await seed_learning_hub()
    return client


# ---- Seed -------------------------------------------------------------------
def test_taxonomy_has_187_plus_classes():
    assert total_classes() >= 187


def test_build_classes_content_shape():
    cs = build_classes()
    c = cs[0]
    assert len(c["faq"]) == 7
    assert all("question" in q and "answer" in q for q in c["faq"])
    sources = {r["source"] for r in c["resources"]}
    assert {"CWE / MITRE", "OWASP", "PortSwigger", "MDN", "SANS", "YouTube", "Articles"} <= sources


async def test_seed_is_idempotent(client):  # client fixture sets up the schema
    n1 = await seed_learning_hub()
    n2 = await seed_learning_hub()
    assert n1 >= 187
    assert n2 == 0  # nothing new on second run


# ---- List / search / detail -------------------------------------------------
async def test_list_classes_paginated(seeded_hub):
    client = seeded_hub
    r = await client.get(f"{PREFIX}/learning-hub/classes?limit=10")
    data = r.json()["data"]
    assert data["total"] >= 187
    assert len(data["items"]) == 10
    assert "summary" in data["items"][0]


async def test_search_classes(seeded_hub):
    client = seeded_hub
    r = await client.get(f"{PREFIX}/learning-hub/classes?q=sql injection")
    items = r.json()["data"]["items"]
    assert any("SQL Injection" in i["name"] for i in items)


async def test_categories_count(seeded_hub):
    client = seeded_hub
    r = await client.get(f"{PREFIX}/learning-hub/categories")
    cats = r.json()["data"]
    # 27 security categories + Attack Chains + Optimization + Stubs & Placeholders.
    assert len(cats) == 30
    assert all(c["count"] > 0 for c in cats)


async def test_class_detail_has_faq_and_resources(seeded_hub):
    client = seeded_hub
    slug = slugify("Injection", "SQL Injection (Classic)")
    r = await client.get(f"{PREFIX}/learning-hub/classes/{slug}")
    assert r.status_code == 200
    d = r.json()["data"]
    assert len(d["faq"]) == 7
    assert d["faq"][0]["question"].startswith("What is")
    assert any(res["source"] == "PortSwigger" for res in d["resources"])
    # PortSwigger SQLi gets a specific topic URL, not the generic landing.
    ps = next(r for r in d["resources"] if r["source"] == "PortSwigger")
    assert "sql-injection" in ps["url"]


async def test_class_detail_404(seeded_hub):
    client = seeded_hub
    r = await client.get(f"{PREFIX}/learning-hub/classes/does-not-exist")
    assert r.status_code == 404


# ---- Non-security content ---------------------------------------------------
async def test_optimization_and_stub_classes_seeded(seeded_hub):
    """Optimization + stub classes are browsable standalone Hub entries."""
    client = seeded_hub
    r = await client.get(f"{PREFIX}/learning-hub/categories")
    cats = {row["category"] for row in r.json()["data"]}
    assert "Optimization" in cats
    assert "Stubs & Placeholders" in cats

    r = await client.get(f"{PREFIX}/learning-hub/classes", params={"category": "Optimization"})
    names = {item["name"] for item in r.json()["data"]["items"]}
    assert {"Performance", "Code Quality", "Scalability", "Dependency Optimization"} <= names


# ---- Finding resolver + auto-generation -------------------------------------
async def test_for_finding_resolves_existing_category(seeded_hub, auth):
    """A finding whose category already has classes resolves without generating."""
    client, headers, _ = auth
    uid = await _uid(client, headers)
    _, fid = await _seed_finding(uid, category="Injection", subcategory="Injection")

    r = await client.get(f"{PREFIX}/learning-hub/for-finding/{fid}", headers=headers)
    assert r.status_code == 200
    slug = r.json()["data"]["slug"]
    # Resolves to a real, fetchable class in the Injection category.
    d = await client.get(f"{PREFIX}/learning-hub/classes/{slug}")
    assert d.status_code == 200
    assert d.json()["data"]["category"] == "Injection"


async def test_for_finding_generates_class_for_novel_category(seeded_hub, auth):
    """A finding with a category no class covers gets a generated class (templated
    fallback, since tests have no LLM keys)."""
    client, headers, _ = auth
    uid = await _uid(client, headers)
    novel = "Quantum Side-Channel Leakage"
    _, fid = await _seed_finding(uid, category=novel, subcategory=novel, cwe=None)

    async with SessionLocal() as db:
        before = (await db.execute(select(func.count()).select_from(LearningHubClass))).scalar()

    r = await client.get(f"{PREFIX}/learning-hub/for-finding/{fid}", headers=headers)
    assert r.status_code == 200
    slug = r.json()["data"]["slug"]
    assert slug == slugify(novel, novel)

    async with SessionLocal() as db:
        after = (await db.execute(select(func.count()).select_from(LearningHubClass))).scalar()
        cls = (await db.execute(select(LearningHubClass).where(LearningHubClass.slug == slug))).scalar_one()
    assert after == before + 1
    assert cls.faq  # has real content
    assert cls.summary


async def test_for_finding_is_idempotent(seeded_hub, auth):
    """Resolving the same novel finding twice generates exactly one class."""
    client, headers, _ = auth
    uid = await _uid(client, headers)
    novel = "Holographic Cache Poisoning"
    _, fid = await _seed_finding(uid, category=novel, subcategory=novel, cwe=None)

    await client.get(f"{PREFIX}/learning-hub/for-finding/{fid}", headers=headers)
    await client.get(f"{PREFIX}/learning-hub/for-finding/{fid}", headers=headers)

    async with SessionLocal() as db:
        n = (await db.execute(
            select(func.count()).select_from(LearningHubClass)
            .where(LearningHubClass.slug == slugify(novel, novel))
        )).scalar()
    assert n == 1


async def test_for_finding_ownership_enforced(seeded_hub, auth):
    """Another user's finding can't be resolved."""
    client, headers, _ = auth
    # Seed a finding under a different (random) user id.
    _, fid = await _seed_finding("someone-else-uid", category="Injection")
    r = await client.get(f"{PREFIX}/learning-hub/for-finding/{fid}", headers=headers)
    assert r.status_code == 404


async def test_ensure_classes_for_scan_grows_hub(seeded_hub, auth):
    """The post-scan hook generates classes for novel categories in a scan."""
    from app.services.learning_autogen import ensure_classes_for_scan
    client, headers, _ = auth
    uid = await _uid(client, headers)
    scan_id, _ = await _seed_finding(uid, category="Esoteric Bytecode Drift", subcategory="Esoteric Bytecode Drift", cwe=None)

    created = await ensure_classes_for_scan(scan_id)
    assert created == 1
    # Running again creates nothing (idempotent).
    assert await ensure_classes_for_scan(scan_id) == 0


async def test_cwe_dedup_converges_variant_wordings(seeded_hub, auth):
    """Differently-worded findings sharing a CWE resolve to ONE class (the CWE is
    the canonical key), so the hub doesn't accumulate near-duplicates."""
    from app.services.learning_autogen import _class_by_category
    client, headers, _ = auth
    uid = await _uid(client, headers)

    # CWE-918 (SSRF) is seeded as "SSRF via User-Controlled URLs". A finding worded
    # differently but carrying CWE-918 must resolve to that existing class.
    _, f1 = await _seed_finding(uid, category="Server-Side Request Forgery",
                                subcategory="Server-Side Request Forgery", cwe="CWE-918")
    r1 = await client.get(f"{PREFIX}/learning-hub/for-finding/{f1}", headers=headers)
    slug1 = r1.json()["data"]["slug"]

    async with SessionLocal() as db:
        n_before = (await db.execute(select(func.count()).select_from(LearningHubClass))).scalar()
        # A wholly different wording but the same CWE → same class, no new row.
        hit_cwe = await _class_by_category(db, "Totally Different Wording", cwe="CWE-918")
    assert hit_cwe is not None and hit_cwe.slug == slug1

    # A second variant-worded, same-CWE finding creates NO new class.
    _, f2 = await _seed_finding(uid, category="Outbound Request Forgery",
                                subcategory="Outbound Request Forgery", cwe="CWE-918")
    r2 = await client.get(f"{PREFIX}/learning-hub/for-finding/{f2}", headers=headers)
    assert r2.json()["data"]["slug"] == slug1
    async with SessionLocal() as db:
        n_after = (await db.execute(select(func.count()).select_from(LearningHubClass))).scalar()
    assert n_after == n_before
