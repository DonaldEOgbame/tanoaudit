"""Learning Hub content for the non-security engines: optimization & stubs.

These engines don't map to CWE/OWASP, and the security templates in
`learning_seed` (which talk about attackers and exploitation) read wrong for
them. So the 8 classes here (4 optimization categories + 4 stub categories) get
purpose-written summaries, FAQs, and resources. They're seeded as standalone,
browsable Learning Hub entries — no per-finding cross-link — through the same
`build_classes` pipeline.
"""
from __future__ import annotations

from urllib.parse import quote_plus

from app.services.learning_seed import slugify

# (name, summary, [(question, answer), ...])
_OPTIMIZATION: list[tuple[str, str, list[tuple[str, str]]]] = [
    (
        "Performance",
        "Performance findings flag code that does more work, more often, or more "
        "slowly than it needs to — hot loops, N+1 queries, blocking I/O on a "
        "request path, and unbounded allocations.",
        [
            ("What counts as a performance issue?",
             "Anything that makes the program slower or hungrier for CPU, memory, "
             "or I/O than an equivalent correct implementation would be: repeated "
             "work that could be cached, synchronous calls that could be batched "
             "or parallelised, algorithms with worse-than-necessary complexity, "
             "and queries issued one row at a time."),
            ("Why does it matter if the code still works?",
             "Correct-but-slow code passes tests and then degrades in production "
             "under real data volumes and concurrency. Latency compounds: a 50ms "
             "inefficiency on a hot path becomes seconds of tail latency at scale, "
             "and wasted compute is a direct cost."),
            ("How do I fix it?",
             "Measure first — profile to confirm where time actually goes, then "
             "address the dominant cost: batch or cache repeated work, replace an "
             "N+1 query with a single join or prefetch, move blocking work off the "
             "request path, and pick a data structure matched to the access pattern. "
             "Re-measure to confirm the change helped."),
        ],
    ),
    (
        "Code Quality",
        "Code-quality findings flag maintainability risks — duplication, dead "
        "code, overly complex functions, unclear naming, and missing error "
        "handling — that don't break today but slow every future change.",
        [
            ("Is this just style nitpicking?",
             "No. The targets are structural: high cyclomatic complexity, copy-paste "
             "duplication that drifts out of sync, functions doing too many things, "
             "and swallowed errors. These predict where bugs and regressions cluster."),
            ("Why fix it now rather than later?",
             "Quality debt compounds. A tangled function is harder to change safely, "
             "so changes take longer and introduce more defects, which makes the code "
             "more tangled. Paying it down early keeps the change cost flat."),
            ("How do I address it?",
             "Refactor toward smaller, single-purpose units; extract duplication to one "
             "source of truth; name things for intent; and make error paths explicit. "
             "Lean on a linter and tests so refactors stay behaviour-preserving."),
        ],
    ),
    (
        "Scalability",
        "Scalability findings flag designs that work at current load but won't hold "
        "as data, traffic, or concurrency grow — in-memory state that can't shard, "
        "global locks, and unbounded growth.",
        [
            ("How is this different from performance?",
             "Performance is about speed at a given load; scalability is about how "
             "behaviour changes as load grows. Code can be fast today and still fail "
             "to scale — e.g. it keeps all sessions in process memory, or serialises "
             "every request through one lock."),
            ("What patterns get flagged?",
             "Per-process mutable state that blocks horizontal scaling, coarse global "
             "locks, work that grows superlinearly with input, missing pagination or "
             "back-pressure, and assumptions of a single instance."),
            ("How do I fix it?",
             "Push shared state into a store built to scale, bound queues and result "
             "sets, make work stateless where possible, and replace coarse locks with "
             "finer-grained or lock-free designs. Load-test against projected growth, "
             "not today's traffic."),
        ],
    ),
    (
        "Dependency Optimization",
        "Dependency-optimization findings flag third-party usage that bloats the "
        "build or runtime — heavyweight libraries used for trivial tasks, "
        "duplicate transitive packages, and unused dependencies.",
        [
            ("Why optimise dependencies at all?",
             "Every dependency adds install time, bundle/image size, attack surface, "
             "and upgrade burden. Pulling a large library to use one helper, or "
             "shipping packages you no longer import, is pure cost."),
            ("What gets flagged?",
             "Large libraries used for a single small function, multiple packages that "
             "do the same job, unused or dev-only dependencies leaking into production, "
             "and duplicate transitive versions inflating the tree."),
            ("How do I fix it?",
             "Replace a heavyweight import with a small built-in or focused utility, "
             "remove what you don't use, deduplicate versions, and split dev "
             "dependencies out of the production build. Re-check bundle/image size after."),
        ],
    ),
]

# (name, summary, [(question, answer), ...])
_STUB: list[tuple[str, str, list[tuple[str, str]]]] = [
    (
        "Stub",
        "A stub is a function or module that exists but has no real implementation — "
        "an empty body, a hardcoded return, or a `NotImplementedError` standing in "
        "for logic that was never written.",
        [
            ("What is a stub?",
             "A placeholder implementation that satisfies a signature or interface "
             "without doing the work: an empty handler, a method that always returns "
             "the same value, or one that raises 'not implemented'. It compiles and "
             "may even pass shallow tests while doing nothing useful."),
            ("Why is shipping a stub risky?",
             "A stub on a real code path silently does nothing or returns a fixed "
             "value, so the system appears to work while skipping a step — payments "
             "that never charge, checks that never run, data that's never saved. "
             "The failure is invisible until something downstream depends on the "
             "missing behaviour."),
            ("How do I resolve it?",
             "Implement the intended logic, or — if the stub is deliberate — make that "
             "explicit: guard it behind a feature flag, raise a clear error so it can't "
             "silently no-op, and track it as work to finish. Don't leave a hollow body "
             "on a path that callers treat as complete."),
        ],
    ),
    (
        "Placeholder",
        "A placeholder is a stand-in value left in code — a test email, a localhost "
        "URL, a dummy API key, sample data — that was meant to be replaced before "
        "the code went live.",
        [
            ("What counts as a placeholder?",
             "Hardcoded sample values that aren't the real thing: `test@example.com`, "
             "`http://localhost:3000`, `YOUR_API_KEY_HERE`, lorem-ipsum content, or "
             "fixture data wired into production logic instead of real configuration."),
            ("Why do placeholders cause problems?",
             "They make code behave correctly in development and wrongly in production: "
             "requests go to the wrong host, emails to a dummy address, integrations "
             "fail against a fake key. Because the value looks plausible, the mistake "
             "often isn't caught until it's live."),
            ("How do I resolve it?",
             "Move the value into configuration or an environment variable, supply the "
             "real value per environment, and fail loudly when a required value is "
             "missing rather than falling back to a placeholder default."),
        ],
    ),
    (
        "Incomplete",
        "An incomplete implementation is code that's partially written — a function "
        "that handles the happy path but not errors, validation that always passes, "
        "an empty catch block, or a branch left unfinished.",
        [
            ("How is 'incomplete' different from a stub?",
             "A stub is empty or trivial; incomplete code is partly real but missing "
             "pieces — it does some of the job. Examples: validation that returns true "
             "regardless of input, a catch block that swallows the error, or a switch "
             "missing cases."),
            ("Why is it dangerous to ship?",
             "Incomplete code usually works on the inputs you tested and fails on the "
             "ones you didn't: an unhandled error path, an unvalidated edge case, a "
             "branch that silently does nothing. It gives a false sense of completeness."),
            ("How do I resolve it?",
             "Finish the missing paths: handle and surface errors instead of swallowing "
             "them, make validation actually reject bad input, cover the remaining "
             "branches, and add tests that exercise the edges — not just the happy path."),
        ],
    ),
    (
        "AI-Generated",
        "AI-generated stubs are hollow scaffolding left by code assistants — "
        "boilerplate handlers, `// add your logic here` comments, and plausible-"
        "looking structure with no real behaviour behind it.",
        [
            ("What does this flag?",
             "Scaffolding an AI assistant produced and a human never filled in: "
             "comment markers like 'implement this' or 'add your logic here', handlers "
             "that return canned responses, and functions whose names promise behaviour "
             "the body doesn't deliver."),
            ("Why call this out specifically?",
             "AI-generated boilerplate is fluent and well-structured, so it reads as "
             "finished even when it's empty. That fluency is exactly what makes hollow "
             "code easy to merge by accident — it looks more complete than it is."),
            ("How do I resolve it?",
             "Treat the scaffold as a TODO, not a finished feature: implement the "
             "intended logic, remove the placeholder comments, and review AI-written "
             "code for behaviour rather than appearance before relying on it."),
        ],
    ),
]


def _resources(name: str, category: str) -> list[dict]:
    """Generic, non-security learning resources for a non-sec class."""
    return [
        {
            "title": f"Search: {name} ({category}) best practices",
            "url": f"https://www.google.com/search?q={quote_plus(name + ' ' + category + ' best practices')}",
            "source": "Articles",
        },
        {
            "title": f"Video: {name} explained",
            "url": f"https://www.youtube.com/results?search_query={quote_plus(name + ' ' + category)}",
            "source": "YouTube",
        },
    ]


def _build(entries: list[tuple[str, str, list[tuple[str, str]]]], category: str,
           severity: str) -> list[dict]:
    out: list[dict] = []
    for name, summary, qas in entries:
        out.append({
            "slug": slugify(category, name),
            "name": name,
            "category": category,
            "severity": severity,
            "cwe": None,
            "owasp": None,
            "summary": summary,
            "faq": [{"question": q, "answer": a} for q, a in qas],
            "resources": _resources(name, category),
        })
    return out


def build_nonsecurity_classes() -> list[dict]:
    """Optimization + stub Learning Hub classes, ready to insert."""
    return (
        _build(_OPTIMIZATION, "Optimization", "info")
        + _build(_STUB, "Stubs & Placeholders", "info")
    )
