"""Seed script: produce a complete demo experience.

Creates a demo user (with encrypted provider keys + GitHub connection), a
realistic completed scan of `user/ecommerce-api` matching the frontend's demo
data, an optimization plan, a watched repo, and seeds the Learning Hub taxonomy
and fun-facts pool.

Run:  python -m app.seed       (idempotent — safe to re-run)
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.database import SessionLocal, init_db, utcnow
from app.core.security import hash_password, verify_password
from app.models.optimization_plan import OptimizationGoal, OptimizationPlan
from app.models.repository import FREQ_DAILY, Repository
from app.models.scan import (
    ENGINE_OPTIMIZATION,
    ENGINE_SECURITY,
    ENGINE_STUB,
    SCAN_COMPLETED,
    Finding,
    Scan,
)
from app.models.user import User
from app.services.fun_facts_seed import seed_fun_facts
from app.services.learning_service import seed_learning_hub
from app.services.repositories import link_scan_to_repo

DEMO_EMAIL = "demo@tanoaudit.ai"
DEMO_PASSWORD = "demo-password-123"

# (public_id, engine, category, subcategory, severity, file, ls, le, cwe, owasp, model, verified, summary, fix)
_FINDINGS = [
    ("VLN-0001", ENGINE_SECURITY, "Injection", "SQL Injection (Classic)", "critical",
     "src/routes/products.js", 44, 46, "CWE-89", "A03:2021", "Gemini 2.0 Flash", True,
     "The search endpoint interpolates the raw `q` query parameter directly into a SQL statement, allowing dumping of all tables without authentication.",
     "Use parameterized queries / query builder bindings so user input never enters the SQL grammar."),
    ("VLN-0002", ENGINE_SECURITY, "Data Exposure & Secrets", "Hardcoded API Keys", "critical",
     "src/services/paymentService.js", 3, 3, "CWE-798", "A07:2021", "OpenRouter / Claude Haiku", True,
     "A live Stripe secret key is committed in source. Anyone with repo access can issue refunds and exfiltrate payment data.",
     "Load the key from the environment and rotate the leaked key in the Stripe dashboard."),
    ("VLN-0003", ENGINE_SECURITY, "Authentication & Authorization", "JWT None Algorithm", "critical",
     "src/middleware/auth.js", 15, 18, "CWE-347", "A02:2021", "Gemini 2.0 Flash", True,
     "The auth middleware uses `jwt.decode()` which performs no signature verification, letting any client forge an admin token.",
     "Use `jwt.verify()` with the signing secret and an explicit algorithm allow-list."),
    ("VLN-0004", ENGINE_SECURITY, "Injection", "Command Injection", "critical",
     "src/routes/webhooks.js", 26, 26, "CWE-95", "A03:2021", "OpenRouter / Claude Haiku", False,
     "The webhook handler evaluates a `transform` expression with `eval()`, giving arbitrary code execution on the server.",
     "Never evaluate user-supplied code. Support a fixed set of named operations validated against an allow-list."),
    ("VLN-0005", ENGINE_SECURITY, "Authentication & Authorization", "Missing RBAC", "high",
     "src/routes/admin.js", 57, 62, "CWE-862", "A01:2021", "Gemini 2.0 Flash", True,
     "The `/admin/orders/export` route is mounted before the admin role check, so any authenticated user can download all orders.",
     "Apply the `requireAdmin` middleware before the export route."),
    ("VLN-0006", ENGINE_SECURITY, "Authentication & Authorization", "JWT Weak Secret", "high",
     "src/routes/auth.js", 90, 91, "CWE-330", "A07:2021", "OpenRouter / Claude Haiku", False,
     "Password reset tokens are generated with `Math.random()`, making them predictable and brute-forceable.",
     "Use a cryptographically secure RNG (`crypto.randomBytes`) for reset tokens."),
    ("VLN-0007", ENGINE_SECURITY, "Authentication & Authorization", "Insecure Direct Object Reference (IDOR)", "high",
     "src/routes/orders.js", 20, 22, "CWE-639", "A01:2021", "Gemini 2.0 Flash", True,
     "Order lookup trusts a client-supplied user ID, letting attackers read any customer's orders.",
     "Derive the user from the authenticated session, not the request body."),
    ("VLN-0008", ENGINE_SECURITY, "Input Validation & Sanitization", "File Upload Without Type Validation", "high",
     "src/services/uploadService.js", 11, 15, "CWE-434", "A04:2021", "OpenRouter / Claude Haiku", False,
     "Uploads accept any file type and size, enabling web shells and storage exhaustion.",
     "Validate MIME type and extension against an allow-list and enforce a size cap."),
    ("VLN-0009", ENGINE_SECURITY, "API Security", "CORS Misconfiguration", "high",
     "src/index.js", 16, 19, "CWE-942", "A05:2021", "Gemini 2.0 Flash", False,
     "CORS reflects an arbitrary `Origin` with credentials enabled, defeating same-origin protections.",
     "Use a static allow-list of trusted origins and avoid reflecting the request origin."),
    ("VLN-0010", ENGINE_SECURITY, "Cryptography", "Weak Hashing", "high",
     "src/utils/crypto.js", 7, 7, "CWE-916", "A02:2021", "OpenRouter / Claude Haiku", False,
     "Passwords are hashed with bcrypt cost factor 4 — far too low to resist offline cracking.",
     "Raise the bcrypt cost factor to at least 12."),
    # A couple of mediums/lows for spread
    ("VLN-0011", ENGINE_SECURITY, "Error Handling & Logging", "Stack Traces Exposed", "medium",
     "src/middleware/errorHandler.js", 6, 9, "CWE-209", "A05:2021", "Gemini 2.0 Flash", False,
     "Unhandled errors return full stack traces to clients in production, leaking internal structure.",
     "Return a generic error to clients and log details server-side."),
    ("VLN-0012", ENGINE_SECURITY, "API Security", "Missing Rate Limiting", "medium",
     "src/routes/auth.js", 32, 32, "CWE-770", "A04:2021", "OpenRouter / Claude Haiku", False,
     "The login endpoint has no rate limiting, permitting credential stuffing at network speed.",
     "Apply the existing rate-limit middleware to authentication routes."),
    # Optimizations
    ("OPT-0001", ENGINE_OPTIMIZATION, "Performance", "N+1 Query", "high",
     "src/routes/orders.js", 40, 58, None, None, "Gemini 2.0 Flash", False,
     "The orders endpoint issues one query per line item; eager-loading with a JOIN would cut p95 latency ~60%.",
     "Eager-load line items with a single JOIN query."),
    ("OPT-0002", ENGINE_OPTIMIZATION, "Performance", "Missing Index", "medium",
     "src/routes/products.js", 12, 16, None, None, "OpenRouter / Claude Haiku", False,
     "Product listing filters on `category_id` with no index, forcing a full table scan.",
     "Add a database index on `products.category_id`."),
    ("OPT-0003", ENGINE_OPTIMIZATION, "Dependency Optimization", "Heavy Package", "low",
     "src/utils/helpers.js", 1, 1, None, None, "Gemini 2.0 Flash", False,
     "`lodash` is imported wholesale but only two functions are used — tree-shaking saves ~70 KB.",
     "Import the specific lodash functions or use native equivalents."),
]

# Stub-engine demo findings.
# (public_id, stub_category, severity, file, ls, le, explanation, completion_suggestion, risk_if_shipped)
_STUBS = [
    ("STB-0001", "Incomplete", "critical", "src/middleware/rbac.js", 8, 11,
     "The permission guard is a pass-through: it declares a role check but the body only calls `next()` with no authorization logic.",
     "Look up the user's role and 403 when it doesn't include the required permission before calling next().",
     "Every authenticated user gets admin-level access — the role check is a no-op."),
    ("STB-0002", "Placeholder", "high", "src/services/emailService.js", 14, 16,
     "The transactional email sender returns a hardcoded dummy success response instead of dispatching to a provider.",
     "Wire the function to the real email provider SDK and return its delivery result.",
     "No emails are ever sent (password resets, receipts) while the code reports success."),
    ("STB-0003", "AI-Generated", "medium", "src/routes/orders.js", 31, 34,
     "Scaffolded handler left hollow — body is `// Add your logic here` followed by a generic 200.",
     "Implement order creation: validate the payload, persist the order, return the created resource.",
     "The create-order endpoint silently accepts requests without persisting anything."),
    ("STB-0004", "Stub", "low", "src/utils/cache.js", 5, 5,
     "A `// TODO: add cache eviction` marker on an unbounded in-memory map.",
     "Add an LRU eviction policy or TTL so the cache can't grow without bound.",
     "Memory grows unbounded under sustained load, eventually OOMing the process."),
]


async def _get_or_create_user(db) -> User:
    user = (
        await db.execute(select(User).where(User.email == DEMO_EMAIL))
    ).scalar_one_or_none()
    if user:
        # Re-assert the demo password every run so a stale/corrupt hash left by an
        # older seed (or a different bcrypt version) is repaired instead of locking
        # the demo account out. Seeding is meant to be idempotent and authoritative.
        if not verify_password(DEMO_PASSWORD, user.password_hash or ""):
            user.password_hash = hash_password(DEMO_PASSWORD)
            db.add(user)
            await db.flush()
        return user
    user = User(
        email=DEMO_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
        full_name="Demo User",
        display_name="Demo",
        email_verified=True,
        settings={"theme": "dark", "default_scan_mode": "Deep",
                  "model_settings": {"default_tier": "tanoaudit_balanced"}},
        privacy={"improve_ai": True, "store_scan_history": True},
        notifications={"scan_complete": True, "critical_found": True,
                       "watchlist_changed": True, "weekly_digest": False, "in_app": True},
    )
    db.add(user)
    await db.flush()
    return user


async def _seed_scan(db, user: User) -> Scan | None:
    # Skip if the demo scan already exists.
    existing = (
        await db.execute(
            select(Scan).where(Scan.user_id == user.id, Scan.repo == "user/ecommerce-api")
        )
    ).scalar_one_or_none()
    if existing:
        return existing

    scan = Scan(
        user_id=user.id, source_type="github", repo="user/ecommerce-api",
        branch="main", commit="a3f9c21", depth="deep", model_mode="auto",
        models=["gemini", "openrouter"], include_custom=True,
        include_optimization=True, status=SCAN_COMPLETED,
        files=24, segment_total=318, segments_analyzed=318,
        security_score=38, optimization_score=64, completeness_score=52,
        worst_severity="critical",
        started_at=utcnow(), completed_at=utcnow(),
        executive_summary=(
            "This scan found 4 Critical issues that are remotely exploitable today: SQL "
            "injection in the product search, a forged-token path through auth.js, a live "
            "Stripe key in source, and an eval-based RCE in the webhook handler. Prioritize "
            "src/routes/products.js, src/middleware/auth.js and src/services/paymentService.js — "
            "fixing the top findings removes ~70% of total risk. Estimated remediation: 2–3 "
            "engineer-days for all Criticals and Highs."
        ),
    )
    db.add(scan)
    await db.flush()
    await link_scan_to_repo(db, scan)

    for (pid, engine, cat, sub, sev, file, ls, le, cwe, owasp, model, verified, summary, fix) in _FINDINGS:
        db.add(Finding(
            scan_id=scan.id, public_id=pid, engine=engine, category=cat, subcategory=sub,
            severity=sev, confidence="High" if verified else "Medium",
            file=file, line_start=ls, line_end=le, cwe_id=cwe, owasp_ref=owasp,
            explanation=summary, fix_summary=fix, model_attribution=model,
            verified_by="OpenRouter / Claude Haiku" if verified else None,
        ))

    # Stub engine demo findings.
    for (pid, scat, sev, file, ls, le, expl, suggestion, risk) in _STUBS:
        db.add(Finding(
            scan_id=scan.id, public_id=pid, engine=ENGINE_STUB, category=scat,
            severity=sev, confidence="High", file=file, line_start=ls, line_end=le,
            explanation=expl, stub_category=scat,
            completion_suggestion=suggestion, risk_if_shipped=risk,
            model_attribution="Gemini 2.0 Flash",
        ))
    return scan


async def _seed_plan_and_watch(db, user: User, scan: Scan) -> None:
    repo = (
        await db.execute(
            select(Repository).where(
                Repository.user_id == user.id,
                Repository.identifier == "user/ecommerce-api",
            )
        )
    ).scalar_one_or_none()
    if repo is None:
        return

    # Watch the repo (daily).
    repo.watched = True
    repo.frequency = FREQ_DAILY

    # One optimization plan if none exists.
    existing_plan = (
        await db.execute(
            select(OptimizationPlan).where(OptimizationPlan.repository_id == repo.id)
        )
    ).scalar_one_or_none()
    if existing_plan is None:
        plan = OptimizationPlan(
            user_id=user.id, repository_id=repo.id,
            name="Q3 Latency Reduction", priority="High",
        )
        db.add(plan)
        await db.flush()
        goals = [
            ("Eliminate all N+1 query patterns in order flows", "Done"),
            ("Add composite indexes for top 5 slow queries", "In progress"),
            ("Introduce a 60s TTL cache for the category tree", "In progress"),
            ("Move static assets behind a CDN", "Pending"),
            ("Right-size the Postgres connection pool", "Done"),
        ]
        for i, (text, status) in enumerate(goals):
            db.add(OptimizationGoal(plan_id=plan.id, text=text, status=status, position=i))


async def run_seed() -> dict:
    await init_db()
    await seed_learning_hub()
    facts = await seed_fun_facts()

    async with SessionLocal() as db:
        user = await _get_or_create_user(db)
        scan = await _seed_scan(db, user)
        if scan is not None:
            await _seed_plan_and_watch(db, user, scan)
        await db.commit()
        user_id = user.id
        scan_id = scan.id if scan else None

    return {"user_id": user_id, "email": DEMO_EMAIL, "scan_id": scan_id, "facts_seeded": facts}


def main() -> None:
    result = asyncio.run(run_seed())
    print("Seed complete:")
    print(f"  Demo user: {result['email']}  (password: {DEMO_PASSWORD})")
    print(f"  Demo scan: {result['scan_id']}")
    print("  Learning Hub + fun facts seeded.")


if __name__ == "__main__":
    main()
