"""Generate rich Learning Hub content (FAQ + resources) for every taxonomy class.

Content is templated but category- and class-aware so each of the 187+ classes
reads as a substantive mini-explainer with full answers and curated outbound
links (CWE, OWASP, PortSwigger, MDN, SANS, YouTube, articles).
"""
from __future__ import annotations

import re
from urllib.parse import quote_plus

from app.services.taxonomy_data import (
    ATTACK_CHAIN_CATEGORY,
    ATTACK_CHAINS,
    TAXONOMY,
    attack_chain_classes,
    chain_step_labels,
)


def slugify(category: str, name: str) -> str:
    raw = f"{category} {name}".lower()
    raw = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    return raw[:160]


# Per-category framing used to ground the generic templates in something real.
CATEGORY_CONTEXT: dict[str, str] = {
    "Authentication & Authorization": "how the application proves who a user is and what they're allowed to do",
    "Injection": "how untrusted input is mixed into an interpreter (SQL, a shell, a template, etc.) without separation between code and data",
    "Data Exposure & Secrets": "how sensitive values — credentials, keys, personal data — are stored, transmitted, and logged",
    "Input Validation & Sanitization": "how the application accepts, validates, and encodes data that crosses a trust boundary",
    "API Security": "how API endpoints authenticate callers, authorize objects, and bound the data and load they accept",
    "Database & Storage": "how data is queried and persisted, and how storage permissions and error handling are configured",
    "Dependency & Supply Chain": "the third-party code your application pulls in and trusts at build and run time",
    "Configuration & Infrastructure": "how the runtime, framework, and deployment are configured for production",
    "Business Logic": "the application's intended workflows and the assumptions they make about order, timing, and values",
    "Cryptography": "how the application protects data with hashing, encryption, and randomness",
    "AI-Generated Code Specific": "patterns commonly introduced by AI code assistants when scaffolding or completing code",
    "Frontend Specific": "what runs in the user's browser and what trust the client side is incorrectly given",
    "Concurrency & Race Conditions": "how shared state is accessed when multiple operations run at the same time",
    "Error Handling & Logging": "what happens — and what is revealed or recorded — when things go wrong",
    "Memory & Resource Management": "how memory, handles, connections, and compute are allocated and released",
    "Deserialization": "how serialized data from outside the trust boundary is turned back into live objects",
    "Cloud & Serverless": "how cloud identity, storage, and functions are provisioned and exposed in code/IaC",
    "Mobile & Cross-Platform": "how mobile apps store data, expose components, and talk to other apps and servers",
    "WebSocket & Real-Time": "how long-lived, bidirectional connections are authenticated and bounded",
    "Third-Party Integration & Webhooks": "how the application trusts and calls out to external services and receives their callbacks",
    "Containers & Orchestration": "how container images and Kubernetes workloads are built, privileged, and isolated",
    "Infrastructure as Code": "how cloud infrastructure is declared in Terraform/CloudFormation and what defaults it ships",
    "CI/CD & Build Security": "how the build and deployment pipeline handles secrets, untrusted input, and its own privileges",
    "Supply Chain Integrity": "the integrity and provenance of the dependencies and artifacts your build consumes and produces",
    "AI/LLM Application Security": "how the application builds prompts, handles model output, and bounds an AI agent's tools and cost",
    "Privacy & Compliance": "how personal data is collected, retained, shared, and made auditable and erasable",
    "Protocol & Network": "how HTTP, caching, DNS, email, and RPC protocols are parsed and trusted between hops",
    ATTACK_CHAIN_CATEGORY: "how several individually-fixable weaknesses combine into a single real-world attack path",
}

# PortSwigger Web Security Academy topic mapping for classes that have one.
_PORTSWIGGER = {
    "sql injection": "sql-injection",
    "blind sql injection": "sql-injection/blind",
    "command injection": "os-command-injection",
    "server-side template injection": "server-side-template-injection",
    "xml external entity": "xxe",
    "reflected xss": "cross-site-scripting/reflected",
    "stored xss": "cross-site-scripting/stored",
    "dom-based xss": "cross-site-scripting/dom-based",
    "path traversal": "file-path-traversal",
    "open redirect": "ssrf",  # covered alongside SSRF basics
    "cors misconfiguration": "cors",
    "ssrf via user-controlled urls": "ssrf",
    "insecure direct object reference": "access-control/idor",
    "broken object-level authorization": "access-control",
    "prototype pollution": "prototype-pollution",
    "insecure object deserialization": "deserialization",
    "untrusted data deserialization": "deserialization",
    "clickjacking": "clickjacking",
    "race condition": "race-conditions",
    "missing webhook signature verification": "ssrf",
}


def _cwe_url(cwe: str | None) -> str | None:
    if not cwe:
        return None
    m = re.search(r"(\d+)", cwe)
    return f"https://cwe.mitre.org/data/definitions/{m.group(1)}.html" if m else None


def _portswigger_url(name: str) -> str:
    key = name.lower()
    for frag, path in _PORTSWIGGER.items():
        if frag in key:
            return f"https://portswigger.net/web-security/{path}"
    return "https://portswigger.net/web-security/all-topics"


def _build_resources(name: str, category: str, cwe: str | None, owasp: str | None) -> list[dict]:
    res: list[dict] = []
    cwe_url = _cwe_url(cwe)
    if cwe_url:
        res.append({"title": f"{cwe}: definition & mitigations", "url": cwe_url, "source": "CWE / MITRE"})
    res.append({
        "title": "OWASP Cheat Sheet Series",
        "url": "https://cheatsheetseries.owasp.org/",
        "source": "OWASP",
    })
    if owasp and owasp != "—":
        res.append({
            "title": f"OWASP Top 10 — {owasp}",
            "url": "https://owasp.org/Top10/",
            "source": "OWASP",
        })
    res.append({
        "title": f"Web Security Academy: {name}",
        "url": _portswigger_url(name),
        "source": "PortSwigger",
    })
    res.append({
        "title": "Web security fundamentals",
        "url": "https://developer.mozilla.org/en-US/docs/Web/Security",
        "source": "MDN",
    })
    res.append({
        "title": "SANS secure coding & reading room",
        "url": "https://www.sans.org/security-resources/",
        "source": "SANS",
    })
    res.append({
        "title": f"Video: {name} explained",
        "url": f"https://www.youtube.com/results?search_query={quote_plus(name + ' vulnerability explained')}",
        "source": "YouTube",
    })
    res.append({
        "title": f"Articles & write-ups on {name}",
        "url": f"https://www.google.com/search?q={quote_plus(name + ' vulnerability remediation')}",
        "source": "Articles",
    })
    return res


def _summary(name: str, category: str) -> str:
    return (
        f"{name} is a {category} weakness affecting "
        f"{CATEGORY_CONTEXT.get(category, 'application security')}."
    )


def _faq(name: str, category: str, cwe: str | None, owasp: str | None, severity: str) -> list[dict]:
    ctx = CATEGORY_CONTEXT.get(category, "application security")
    nlow = name.lower()
    return [
        {
            "question": f"What is {name}?",
            "answer": (
                f"{name} is a vulnerability in the {category} domain — it concerns "
                f"{ctx}. At its core, it occurs when this part of the system makes an "
                f"unsafe assumption: that input is trustworthy, that a check has already "
                f"happened, or that a default is secure when it is not. It is tracked as "
                f"{cwe or 'a recognised weakness class'}"
                + (f" and maps to OWASP {owasp}." if owasp and owasp != '—' else ".")
            ),
            "advanced": (
                f"Formally, {name} represents a gap between the developer's mental model "
                f"of the system and its actual behaviour under adversarial input. Severity "
                f"here is rated '{severity}' because of the typical blast radius when the "
                f"assumption is violated."
            ),
        },
        {
            "question": "Why does it happen?",
            "answer": (
                f"It usually comes down to one of a few root causes: missing or inconsistent "
                f"validation, trusting data that crossed a boundary, copy-pasted or "
                f"auto-generated boilerplate with insecure defaults, or a check that exists "
                f"in one code path but not another. In the context of {category.lower()}, the "
                f"mistake is specifically about {ctx}."
            ),
        },
        {
            "question": "How do attackers exploit it?",
            "answer": (
                f"An attacker first probes for the weakness — sending crafted input, replaying "
                f"or tampering with requests, or inspecting client-side code and error messages. "
                f"Once they confirm {name} is present, they escalate: turning a small foothold "
                f"into data access, code execution, or account takeover depending on what the "
                f"vulnerable component can reach."
            ),
            "advanced": (
                f"Sophisticated exploitation chains {nlow} with other findings: using it to "
                f"pivot internally, exfiltrate over side channels (DNS, timing), or establish "
                f"persistence. Automated tooling makes discovery cheap, so 'security by "
                f"obscurity' offers no protection."
            ),
        },
        {
            "question": "What's a real-world example?",
            "answer": (
                f"There are many public CVEs and breach post-mortems involving {category.lower()} "
                f"weaknesses like {name}. A representative scenario: a team ships a feature under "
                f"deadline, an unsafe default or missing check slips through review, and months "
                f"later an attacker (or a bug-bounty researcher) finds it in production and "
                f"demonstrates impact. The fix is usually small; the exposure window is what hurts."
            ),
        },
        {
            "question": "How do I know if my code is affected?",
            "answer": (
                f"Look for the tell-tale patterns of {name}: places where {ctx} is handled "
                f"without an explicit, centralised safeguard. Grep for the risky APIs, review the "
                f"code paths that handle untrusted input or privileged actions, and confirm a "
                f"control actually runs on every path — not just the happy path. Akira AI flags "
                f"the specific lines, but a manual read of the surrounding function confirms it."
            ),
        },
        {
            "question": "How do I fix it?",
            "answer": (
                f"Apply the standard remediation for this class: enforce the missing control at a "
                f"single, well-tested choke point rather than sprinkling ad-hoc checks. Prefer "
                f"framework- or platform-provided protections over hand-rolled ones, validate and "
                f"encode at the boundary, fail closed, and add a regression test that reproduces "
                f"the issue so it can't silently return."
            ),
            "advanced": (
                f"Where possible, make the unsafe pattern impossible to express — e.g. a typed "
                f"wrapper, a linter rule, or an architectural change — so future code can't "
                f"reintroduce {name}. Defence in depth: even after the primary fix, add a "
                f"secondary control so a single mistake isn't catastrophic."
            ),
        },
        {
            "question": "How do I prevent it going forward?",
            "answer": (
                f"Bake the protection into your defaults and your pipeline: secure templates, "
                f"a shared validation/authorization layer, dependency and secret scanning, and "
                f"code review checklists that call out {category.lower()} risks. Re-scan on every "
                f"change (the Watchlist can do this automatically) so regressions are caught "
                f"before they reach production."
            ),
        },
    ]


def build_classes() -> list[dict]:
    """Return every Learning Hub class as a ready-to-insert content dict.

    Covers the security taxonomy plus the non-security engines (optimization &
    stubs), which use purpose-written content rather than the security templates.
    """
    out: list[dict] = []
    for category, classes in TAXONOMY.items():
        for name, cwe, owasp, severity in classes:
            out.append({
                "slug": slugify(category, name),
                "name": name,
                "category": category,
                "severity": severity,
                "cwe": cwe,
                "owasp": owasp,
                "summary": _summary(name, category),
                "faq": _faq(name, category, cwe, owasp, severity),
                "resources": _build_resources(name, category, cwe, owasp),
            })
    # Attack chains: vulnerability combinations that form real hacks.
    for name, cwe, owasp, severity in attack_chain_classes():
        out.append({
            "slug": slugify(ATTACK_CHAIN_CATEGORY, name),
            "name": name,
            "category": ATTACK_CHAIN_CATEGORY,
            "severity": severity,
            "cwe": cwe,
            "owasp": owasp,
            "summary": _chain_summary(name),
            "faq": _chain_faq(name),
            "resources": _build_resources(name, ATTACK_CHAIN_CATEGORY, cwe, owasp),
        })

    # Non-security engines: optimization + stub/placeholder content.
    from app.services.learning_seed_nonsec import build_nonsecurity_classes
    out.extend(build_nonsecurity_classes())
    return out


def _chain_summary(name: str) -> str:
    c = ATTACK_CHAINS[name]
    steps = chain_step_labels(c)
    return (
        f"{name} is an attack chain: {' then '.join(steps)}. "
        f"On its own each step is fixable, but combined they let an attacker {c['impact'].lower()}"
    )


def _chain_faq(name: str) -> list[dict]:
    c = ATTACK_CHAINS[name]
    steps = chain_step_labels(c)
    return [
        {
            "question": f"What is the {name} attack chain?",
            "answer": (
                f"It's a real-world exploitation path built from {len(steps)} weaknesses chained "
                f"in order: {', then '.join(steps)}. The danger isn't any single bug — it's how they "
                f"compose. The end result: {c['impact'].lower()}"
            ),
            "advanced": f"Representative CWE for the terminal step: {c['cwe']}.",
        },
        {
            "question": "Has this happened in the real world?",
            "answer": c["real_world"],
        },
        {
            "question": "Why do individual fixes miss it?",
            "answer": (
                "Each weakness in the chain may look low-risk in isolation and get deprioritised, "
                "so reviewers triage them separately and never see the combined path. Attackers, by "
                "contrast, look for exactly these compositions."
            ),
        },
        {
            "question": "How do I break the chain?",
            "answer": (
                "You only need to remove one link to stop the full attack, but fix as many as you can: "
                f"address {steps[0].lower()} first (the entry point), then ensure the escalation steps "
                f"({', '.join(steps[1:]) or 'the follow-on weaknesses'}) can't be reached. Defence in "
                "depth means even if one link returns, the chain stays broken."
            ),
            "advanced": (
                "Akira flags the constituent findings individually and links them into this path so you "
                "can see the whole chain, not just isolated dots."
            ),
        },
    ]
