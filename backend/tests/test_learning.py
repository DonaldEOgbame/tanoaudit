"""Module 14 tests: Learning Hub seed, list/search/detail, non-security content."""
import pytest

from app.services.learning_seed import build_classes, slugify
from app.services.learning_service import seed_learning_hub
from app.services.taxonomy_data import total_classes
from tests.conftest import PREFIX


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
    # 20 security categories + Optimization + Stubs & Placeholders.
    assert len(cats) == 22
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
