"""Custom-vulnerability research pipeline.

Given a name + description, run web searches (pluggable provider), fetch top
results, and LLM-synthesize a structured definition. Emits progress events so the
frontend's research animation reflects real steps.

Search provider is pluggable: a SerpAPI-style HTTP provider when a key is set,
else a deterministic stub so the pipeline runs offline / in the demo.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import AsyncIterator

import httpx

from app.services.router_model import ModelRouter

# Research event type names (consumed by the frontend research animation).
RESEARCH_STARTED = "research_started"
SEARCH_QUERY_SENT = "search_query_sent"
SEARCH_RESULTS_RECEIVED = "search_results_received"
SYNTHESIZING = "synthesizing"
RESEARCH_COMPLETED = "research_completed"
RESEARCH_FAILED = "research_failed"


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str = ""


@dataclass
class StructuredDefinition:
    what_it_is: str = ""
    detection_patterns: str = ""
    what_to_look_for: str = ""
    how_to_fix: str = ""
    source_urls: list[str] = field(default_factory=list)


# ---- Search providers -------------------------------------------------------
async def _tavily_search(query: str, api_key: str) -> list[SearchResult]:
    """Tavily Search API — purpose-built for LLM research, returns ranked results."""
    url = "https://api.tavily.com/search"
    payload = {
        "api_key": api_key,
        "query": query,
        "max_results": 5,
        "search_depth": "basic",
    }
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.post(url, json=payload)
    if r.status_code != 200:
        return []
    data = r.json()
    out = []
    for item in (data.get("results") or [])[:5]:
        out.append(SearchResult(
            title=item.get("title", ""), url=item.get("url", ""),
            snippet=item.get("content", ""),
        ))
    return out


async def _serpapi_search(query: str, api_key: str) -> list[SearchResult]:
    url = "https://serpapi.com/search.json"
    params = {"q": query, "api_key": api_key, "num": 5, "engine": "google"}
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.get(url, params=params)
    if r.status_code != 200:
        return []
    data = r.json()
    out = []
    for item in (data.get("organic_results") or [])[:5]:
        out.append(SearchResult(
            title=item.get("title", ""), url=item.get("link", ""),
            snippet=item.get("snippet", ""),
        ))
    return out


def _stub_search(query: str) -> list[SearchResult]:
    """Deterministic offline results so the pipeline always produces something."""
    return [
        SearchResult(
            title=f"Reference for: {query}",
            url="https://owasp.org/www-community/",
            snippet="General secure-coding guidance relevant to the queried pattern.",
        ),
        SearchResult(
            title="CWE — Common Weakness Enumeration",
            url="https://cwe.mitre.org/",
            snippet="Catalog of software weakness types and detection guidance.",
        ),
    ]


@dataclass
class SearchConfig:
    """Resolved search provider config. Tavily preferred, then SerpAPI, else stub."""
    tavily_key: str | None = None
    serpapi_key: str | None = None

    @property
    def provider(self) -> str:
        if self.tavily_key:
            return "tavily"
        if self.serpapi_key:
            return "serpapi"
        return "stub"


async def _search(query: str, cfg: SearchConfig) -> list[SearchResult]:
    """Dispatch one query to the configured provider, falling back to the stub
    on any provider error so research always yields something."""
    try:
        if cfg.provider == "tavily":
            results = await _tavily_search(query, cfg.tavily_key)
        elif cfg.provider == "serpapi":
            results = await _serpapi_search(query, cfg.serpapi_key)
        else:
            results = _stub_search(query)
    except httpx.HTTPError:
        results = _stub_search(query)
    return results or _stub_search(query)


def build_queries(name: str, description: str | None) -> list[str]:
    base = name or (description or "vulnerability")[:60]
    return [
        f'"{base}" vulnerability patterns',
        f"how to detect {base} in source code",
        f"remediation for {base}",
    ]


# ---- Synthesis --------------------------------------------------------------
_SYNTH_PROMPT = """Synthesize a structured security-detection definition from the
research below. Reply with ONLY this JSON:
{{"what_it_is": "", "detection_patterns": "", "what_to_look_for": "", "how_to_fix": ""}}

Vulnerability: {name}
User description: {description}

Research snippets:
{snippets}"""


def _parse_definition(raw: str, sources: list[str]) -> StructuredDefinition:
    m = re.search(r"\{.*\}", raw or "", re.DOTALL)
    data = {}
    if m:
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            data = {}
    return StructuredDefinition(
        what_it_is=data.get("what_it_is", ""),
        detection_patterns=data.get("detection_patterns", ""),
        what_to_look_for=data.get("what_to_look_for", ""),
        how_to_fix=data.get("how_to_fix", ""),
        source_urls=sources,
    )


def _fallback_definition(name: str, description: str | None, sources: list[str]) -> StructuredDefinition:
    return StructuredDefinition(
        what_it_is=f"{name}: {description or 'a user-defined detection target.'}",
        detection_patterns="Pattern/keyword and entropy analysis on matching string literals and identifiers.",
        what_to_look_for=f"Occurrences of '{name}' patterns across source, config, and client-bundled code.",
        how_to_fix="Remove or relocate the offending value/usage; add a pre-commit/lint guard to prevent recurrence.",
        source_urls=sources,
    )


async def run_research(
    name: str,
    description: str | None,
    router: ModelRouter,
    search_cfg: SearchConfig,
) -> AsyncIterator[tuple[str, dict]]:
    """Async generator yielding (event_type, payload). Final event carries the
    structured definition under payload['definition']."""
    yield RESEARCH_STARTED, {"name": name, "provider": search_cfg.provider}

    queries = build_queries(name, description)
    all_results: list[SearchResult] = []
    for q in queries:
        yield SEARCH_QUERY_SENT, {"query": q}
        results = await _search(q, search_cfg)
        all_results.extend(results)
        yield SEARCH_RESULTS_RECEIVED, {"query": q, "count": len(results)}

    sources = list({r.url for r in all_results if r.url})

    yield SYNTHESIZING, {"source_count": len(sources)}
    snippets = "\n".join(f"- {r.title}: {r.snippet}" for r in all_results)[:3000]
    prompt = _SYNTH_PROMPT.format(name=name, description=description or "", snippets=snippets)

    if router.has_any_key():
        raw = await router.complete(prompt)
        definition = (
            _parse_definition(raw, sources) if raw
            else _fallback_definition(name, description, sources)
        )
        if not definition.what_it_is:
            definition = _fallback_definition(name, description, sources)
    else:
        definition = _fallback_definition(name, description, sources)

    yield RESEARCH_COMPLETED, {"definition": {
        "what_it_is": definition.what_it_is,
        "detection_patterns": definition.detection_patterns,
        "what_to_look_for": definition.what_to_look_for,
        "how_to_fix": definition.how_to_fix,
        "source_urls": definition.source_urls,
    }}
