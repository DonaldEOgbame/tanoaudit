"""Dependency analysis for a scanned repo.

Parses dependency manifests from the cloned/extracted source tree, then enriches
each dependency with:
- the latest published version (npm registry / PyPI JSON API), and
- any known security advisories from OSV.dev (https://osv.dev) for the
  installed version.

The result is a list of plain dicts ready to persist as ScanDependency rows.
Everything is best-effort and network-tolerant: if a registry/OSV call fails or
times out, the dependency is still returned (status falls back to "clean" with a
note), so a dependency scan never breaks the overall code scan.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
from dataclasses import dataclass, field

import httpx

from app.models.dependency import (
    STATUS_CLEAN,
    STATUS_OUTDATED,
    STATUS_VULNERABLE,
)

_OSV_URL = "https://api.osv.dev/v1/query"
_NPM_URL = "https://registry.npmjs.org/{name}/latest"
_PYPI_URL = "https://pypi.org/pypi/{name}/json"
_TIMEOUT = httpx.Timeout(8.0, connect=5.0)
_MAX_DEPS = 200  # safety cap so a huge monorepo can't fan out forever

# Severity rank for picking the "worst" advisory severity label.
_SEV_RANK = {"critical": 4, "high": 3, "medium": 2, "moderate": 2, "low": 1}


@dataclass
class ParsedDep:
    manifest: str
    ecosystem: str  # "npm" | "PyPI"
    name: str
    version: str | None
    dev: bool = False
    # filled in by enrichment:
    latest_version: str | None = None
    status: str = STATUS_CLEAN
    advisory_id: str | None = None
    advisory_summary: str | None = None
    advisory_severity: str | None = None
    advisories: list = field(default_factory=list)
    suggested: str | None = None
    note: str | None = None

    def as_dict(self) -> dict:
        return {
            "manifest": self.manifest,
            "ecosystem": self.ecosystem,
            "name": self.name,
            "version": self.version,
            "dev": self.dev,
            "latest_version": self.latest_version,
            "status": self.status,
            "advisory_id": self.advisory_id,
            "advisory_summary": self.advisory_summary,
            "advisory_severity": self.advisory_severity,
            "advisories": self.advisories,
            "suggested": self.suggested,
            "note": self.note,
        }


# --------------------------------------------------------------------------- #
# Parsing
# --------------------------------------------------------------------------- #

_VER_CLEAN = re.compile(r"^[\^~>=<\s]*v?")


def _clean_version(spec: str | None) -> str | None:
    """Reduce a version spec ("^4.17.15", ">=1.2.0", "1.2.3") to a concrete
    version string when possible. Range/tag specs (*, latest, git urls) -> None."""
    if not spec or not isinstance(spec, str):
        return None
    spec = spec.strip()
    if spec in ("*", "latest", "") or spec.startswith(("git", "http", "file", "link", "workspace")):
        return None
    m = re.search(r"(\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?)", spec)
    return m.group(1) if m else None


def _parse_package_json(path: str, rel: str) -> list[ParsedDep]:
    out: list[ParsedDep] = []
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return out
    for key, dev in (("dependencies", False), ("devDependencies", True),
                     ("optionalDependencies", False), ("peerDependencies", False)):
        block = data.get(key)
        if not isinstance(block, dict):
            continue
        for name, spec in block.items():
            out.append(ParsedDep(
                manifest=rel, ecosystem="npm", name=name,
                version=_clean_version(spec), dev=dev,
            ))
    return out


_REQ_LINE = re.compile(
    r"^\s*([A-Za-z0-9._-]+)\s*(?:\[[^\]]*\])?\s*(?:==|>=|~=|<=|!=|>|<|===)?\s*([0-9][\w.\-+]*)?"
)


def _parse_requirements(path: str, rel: str) -> list[ParsedDep]:
    out: list[ParsedDep] = []
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except OSError:
        return out
    for line in lines:
        line = line.strip()
        if not line or line.startswith(("#", "-", "git+", "http")):
            continue
        m = _REQ_LINE.match(line)
        if not m:
            continue
        name = m.group(1)
        out.append(ParsedDep(
            manifest=rel, ecosystem="PyPI", name=name,
            version=_clean_version(m.group(2)),
            dev=("dev" in rel.lower() or "test" in rel.lower()),
        ))
    return out


def _parse_pyproject(path: str, rel: str) -> list[ParsedDep]:
    """Best-effort [project].dependencies / [tool.poetry.dependencies] parse
    without a TOML dependency (regex over the relevant blocks)."""
    out: list[ParsedDep] = []
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
    except OSError:
        return out
    # PEP 621: dependencies = ["foo>=1.0", "bar==2.3"]
    for block in re.findall(r"dependencies\s*=\s*\[(.*?)\]", text, re.DOTALL):
        for item in re.findall(r"['\"]([^'\"]+)['\"]", block):
            m = _REQ_LINE.match(item)
            if m:
                out.append(ParsedDep(manifest=rel, ecosystem="PyPI", name=m.group(1),
                                     version=_clean_version(m.group(2))))
    # Poetry: under [tool.poetry.dependencies] -> name = "^1.2.3"
    poet = re.search(r"\[tool\.poetry\.dependencies\](.*?)(?:\n\[|\Z)", text, re.DOTALL)
    if poet:
        for name, spec in re.findall(r"^\s*([A-Za-z0-9._-]+)\s*=\s*['\"]([^'\"]+)['\"]",
                                     poet.group(1), re.MULTILINE):
            if name.lower() == "python":
                continue
            out.append(ParsedDep(manifest=rel, ecosystem="PyPI", name=name,
                                 version=_clean_version(spec)))
    return out


_MANIFESTS = {
    "package.json": _parse_package_json,
    "requirements.txt": _parse_requirements,
    "pyproject.toml": _parse_pyproject,
}

_SKIP_DIRS = {"node_modules", ".git", "venv", ".venv", "dist", "build", "__pycache__", ".tox"}


def parse_manifests(root: str) -> list[ParsedDep]:
    """Walk the source tree and parse every supported manifest. De-dupes by
    (ecosystem, name), keeping the first concrete version seen."""
    found: dict[tuple[str, str], ParsedDep] = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
        for fname in filenames:
            parser = _MANIFESTS.get(fname)
            if not parser:
                continue
            rel = os.path.relpath(os.path.join(dirpath, fname), root)
            # requirements*.txt variants also count.
            for dep in parser(os.path.join(dirpath, fname), rel):
                key = (dep.ecosystem, dep.name.lower())
                if key not in found or (dep.version and not found[key].version):
                    found[key] = dep
        # also pick up requirements-*.txt / *-requirements.txt
        for fname in filenames:
            if fname.endswith(".txt") and "require" in fname.lower() and fname != "requirements.txt":
                rel = os.path.relpath(os.path.join(dirpath, fname), root)
                for dep in _parse_requirements(os.path.join(dirpath, fname), rel):
                    key = (dep.ecosystem, dep.name.lower())
                    if key not in found or (dep.version and not found[key].version):
                        found[key] = dep
    deps = list(found.values())
    deps.sort(key=lambda d: (d.ecosystem, d.name.lower()))
    return deps[:_MAX_DEPS]


# --------------------------------------------------------------------------- #
# Enrichment (latest version + OSV advisories)
# --------------------------------------------------------------------------- #

def _norm_sev(label: str | None) -> str | None:
    if not label:
        return None
    low = label.lower()
    if low in _SEV_RANK:
        return "medium" if low == "moderate" else low
    return None


def _osv_severity(vuln: dict) -> str | None:
    # OSV puts a coarse label under database_specific or ecosystem_specific.
    for path in (("database_specific", "severity"), ("ecosystem_specific", "severity")):
        node = vuln
        ok = True
        for k in path:
            node = node.get(k) if isinstance(node, dict) else None
            if node is None:
                ok = False
                break
        if ok and isinstance(node, str):
            s = _norm_sev(node)
            if s:
                return s
    return None


async def _latest_version(client: httpx.AsyncClient, dep: ParsedDep) -> str | None:
    try:
        if dep.ecosystem == "npm":
            r = await client.get(_NPM_URL.format(name=dep.name))
            if r.status_code == 200:
                return (r.json() or {}).get("version")
        else:  # PyPI
            r = await client.get(_PYPI_URL.format(name=dep.name))
            if r.status_code == 200:
                return ((r.json() or {}).get("info") or {}).get("version")
    except (httpx.HTTPError, ValueError):
        return None
    return None


async def _osv_advisories(client: httpx.AsyncClient, dep: ParsedDep) -> list[dict]:
    if not dep.version:
        return []
    payload = {
        "version": dep.version,
        "package": {"name": dep.name, "ecosystem": dep.ecosystem},
    }
    try:
        r = await client.post(_OSV_URL, json=payload)
        if r.status_code == 200:
            return (r.json() or {}).get("vulns", []) or []
    except (httpx.HTTPError, ValueError):
        return []
    return []


def _pick_fixed_version(vulns: list[dict], ecosystem: str, name: str) -> str | None:
    """Find the smallest 'fixed' version across the matching advisories."""
    fixes: list[str] = []
    for v in vulns:
        for aff in v.get("affected", []):
            pkg = aff.get("package", {})
            if pkg.get("name", "").lower() != name.lower():
                continue
            for rng in aff.get("ranges", []):
                for ev in rng.get("events", []):
                    if "fixed" in ev:
                        fixes.append(ev["fixed"])
    return sorted(fixes, key=_version_key)[0] if fixes else None


def _version_key(v: str) -> tuple:
    parts = re.findall(r"\d+", v or "")
    return tuple(int(p) for p in parts[:4]) or (0,)


async def _enrich(client: httpx.AsyncClient, dep: ParsedDep, sem: asyncio.Semaphore) -> ParsedDep:
    async with sem:
        latest, vulns = await asyncio.gather(
            _latest_version(client, dep),
            _osv_advisories(client, dep),
        )
    dep.latest_version = latest
    if vulns:
        ids = []
        worst_sev = None
        summary = None
        for v in vulns:
            vid = v.get("aliases", [None])
            primary = next((a for a in (v.get("aliases") or []) if a.startswith("CVE-")), None) or v.get("id")
            if primary:
                ids.append(primary)
            sev = _osv_severity(v)
            if sev and (worst_sev is None or _SEV_RANK.get(sev, 0) > _SEV_RANK.get(worst_sev, 0)):
                worst_sev = sev
            if summary is None:
                summary = v.get("summary") or (v.get("details") or "")[:160]
        dep.status = STATUS_VULNERABLE
        dep.advisories = ids
        dep.advisory_id = ids[0] if ids else (vulns[0].get("id"))
        dep.advisory_summary = summary
        dep.advisory_severity = worst_sev or "high"
        fixed = _pick_fixed_version(vulns, dep.ecosystem, dep.name)
        dep.suggested = fixed or latest
        dep.note = summary or "Known advisory affects this version."
    elif latest and dep.version and _version_key(latest) > _version_key(dep.version):
        dep.status = STATUS_OUTDATED
        dep.suggested = latest
        dep.note = "Newer version available"
    else:
        dep.status = STATUS_CLEAN
        dep.suggested = None
        dep.note = "Up to date" if dep.version else "Version not pinned"
    return dep


async def analyze_dependencies(root: str) -> list[dict]:
    """Parse + enrich all dependencies under `root`. Returns dicts for storage.
    Network failures degrade gracefully (deps still returned as best-effort)."""
    deps = parse_manifests(root)
    if not deps:
        return []
    sem = asyncio.Semaphore(10)
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers={"User-Agent": "Akira-DepScan"}) as client:
            enriched = await asyncio.gather(
                *[_enrich(client, d, sem) for d in deps], return_exceptions=True
            )
    except Exception:  # noqa: BLE001 — never let dep-scan break the code scan
        return [d.as_dict() for d in deps]
    out: list[dict] = []
    for res in enriched:
        if isinstance(res, ParsedDep):
            out.append(res.as_dict())
        elif isinstance(res, BaseException):
            continue
    # Sort: vulnerable first, then outdated, then clean; then by name.
    order = {STATUS_VULNERABLE: 0, STATUS_OUTDATED: 1, STATUS_CLEAN: 2}
    out.sort(key=lambda d: (order.get(d["status"], 3), d["name"].lower()))
    return out
