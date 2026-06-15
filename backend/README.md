# Akira AI — Backend

FastAPI (async) backend for the Akira AI codebase security audit & optimization
platform. This is a **single-user** product: one user, their scans, findings,
and settings — no teams, roles, or billing.

> **Status: all 18 modules implemented and tested** — Auth & Profile, Settings,
> Scan Pipeline Core, Multi-Model Router, WebSocket Live Events, Reports &
> Exports, False Positives & Fix Generation, Scoped Report Chat, Custom
> Vulnerabilities, Optimization Plans, GitHub Integration, Watchlist, MCP Server
> & Claude Code Handoff, Learning Hub, Notifications, Usage Tracking, Fun Facts,
> and Final Wiring (seed script + worker). **144 passing tests.** A **Repository**
> entity ties scans, plans, and the watchlist together across time.
>
> The build also touched the **frontend** in two places: the Scoped Report Chat
> ([js/chat.jsx](../js/chat.jsx)) was re-centered to a 740px column with message
> actions, and the Learning Hub ([js/page-team-learn.jsx](../js/page-team-learn.jsx))
> was redesigned into a rich Q&A explainer with curated external resource links.
> The rest of the frontend remains mock-driven (see KNOWN_LIMITATIONS.md).
>
> **Quick demo:** `python -m app.seed` creates a demo user (`demo@akira.ai` /
> `demo-password-123`) with a realistic completed scan of `user/ecommerce-api`
> (15 findings, 4 Critical), provider keys, an optimization plan, a watched repo,
> and all reference data.
>
> Module 8 also touched the **frontend** ([js/chat.jsx](../js/chat.jsx)):
> centered the scoped-chat to a 740px reading column, moved the score gauges
> inside the first summary message, and added Copy + 👍/👎 actions under AI
> replies (new `thumbUp`/`thumbDown` icons in [js/icons.js](../js/icons.js)).

> **Before production:** see [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) — a
> consolidated log of every shortcut, spec divergence, and "fix before prod"
> item across all modules, tagged 🔴/🟡/🟢.

## Stack

- **API:** FastAPI, async throughout
- **DB:** PostgreSQL via async SQLAlchemy 2.0 + Alembic (SQLite for local dev/tests)
- **Auth:** JWT access + refresh tokens, bcrypt hashing, optional TOTP 2FA
- **Secrets at rest:** Fernet encryption (provider API keys / OAuth tokens)

## Layout

```
backend/
  app/
    core/        config, async DB/session, JSON envelope + error handlers, security (JWT/bcrypt/Fernet)
    models/      SQLAlchemy models (Module 1: user, sessions, login history, trusted devices)
    schemas/     Pydantic request/response schemas
    api/         routers (auth, profile, security) + shared deps; router.py aggregates them
    main.py      app factory, CORS, exception handlers, /health
  alembic/       migrations (async env wired to app settings + metadata)
  tests/         pytest suite (in-memory SQLite, httpx ASGI client)
```

## API conventions

- All routes under `/api/v1`.
- Consistent envelope: `{"data": ..., "error": null}` on success,
  `{"data": null, "error": {"code": "...", "message": "..."}}` on failure.
- Proper status codes (201 create, 204 no-content, 401/403/404/409/422, etc.).

## Running locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then fill in JWT_SECRET and FERNET_KEY

# generate the two secrets:
python -c "import secrets; print('JWT_SECRET=', secrets.token_urlsafe(48))"
python -c "from cryptography.fernet import Fernet; print('FERNET_KEY=', Fernet.generate_key().decode())"

uvicorn app.main:app --reload   # http://localhost:8000  (docs at /docs)

python -m app.seed              # optional: load the full demo dataset
```

In development the app auto-creates tables on startup. For Postgres/production,
use migrations instead:

```bash
alembic upgrade head
```

## Tests

```bash
pytest            # uses in-memory SQLite; no external services needed
```

> **Python version note:** these deps require prebuilt wheels. Python 3.12–3.14
> all work; the Dockerfile pins 3.12. On 3.14, `requirements.txt` uses lower
> bounds so pip resolves wheels that support it.

## Docker

```bash
docker compose up --build   # api + postgres + worker
```

Set `DATABASE_URL=postgresql+asyncpg://akira:akira@postgres:5432/akira` in `.env`
for the compose Postgres. The stack needs no Redis: the event bus is in-memory,
scans run via the polling `worker` service (and in-process BackgroundTasks), and
rate limiting uses an in-memory window.

## Module 1 endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Login → token pair (or `totp_required`) |
| POST | `/api/v1/auth/refresh` | Rotate access token; enforces session timeout |
| POST | `/api/v1/auth/logout` | Revoke one session |
| POST | `/api/v1/auth/logout-all` | Revoke all sessions |
| GET/PATCH | `/api/v1/profile` | Read / update profile + general settings |
| POST | `/api/v1/security/change-password` | Verify current, set new |
| POST | `/api/v1/security/2fa/enroll` | Start TOTP, returns secret + otpauth URI |
| POST | `/api/v1/security/2fa/verify` | Confirm TOTP, returns backup codes |
| POST | `/api/v1/security/2fa/disable` | Disable TOTP |
| POST | `/api/v1/security/2fa/backup-codes` | Regenerate backup codes |
| GET | `/api/v1/security/sessions` | List active sessions/devices |
| DELETE | `/api/v1/security/sessions/{id}` | Revoke a session |
| GET | `/api/v1/security/login-history` | Last 20 logins |

## Module 2 endpoints (Settings)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/settings/api-keys` | List configured keys (masked, with status) |
| PUT | `/api/v1/settings/api-keys` | Upsert a provider key (encrypted at rest) |
| POST | `/api/v1/settings/api-keys/{provider}/test` | Live-ping provider; persist valid/invalid |
| DELETE | `/api/v1/settings/api-keys/{provider}` | Remove a key |
| GET/PUT | `/api/v1/settings/models` | Default model, fallback order, per-model budgets |
| GET/PUT | `/api/v1/settings/privacy` | `improve_ai`, `store_scan_history` toggles |

Providers: `gemini`, `openrouter`, `github`. Keys are Fernet-encrypted;
reads expose only the last 4 chars and are never logged.

## Module 3 endpoints (Scan Pipeline Core)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/scans` | Create a github/url scan; runs in background |
| POST | `/api/v1/scans/upload` | Create a scan from a ZIP upload (multipart) |
| GET | `/api/v1/scans` | List scans (paginated) |
| GET | `/api/v1/scans/{id}` | Scan detail + scores + summary |
| GET | `/api/v1/scans/{id}/findings` | Findings (filter by engine/severity/status) |

**Pipeline:** ingestion (`services/ingestion.py` — zip-slip-safe ZIP extract,
shallow git clone, file walk with default + custom ignore globs, language
detect) → segmentation (`services/segmentation.py` — SEGMENTS of 50–200 lines;
tree-sitter when present, sliding-window fallback, content hash for incremental
re-scans) → unified analysis (`services/analysis.py` — one LLM call per segment
for security + optimization, dynamic taxonomy slicing per file, strict Pydantic
JSON parse with one repair-retry) → scoring + persistence
(`services/orchestrator.py`). The orchestrator always reaches a terminal state;
timed-out/unparseable segments are skipped, not fatal.

> **Tree-sitter** is optional — if the grammars aren't installed, segmentation
> transparently uses sliding windows.

## Module 4 (Multi-Model Router)

The orchestrator now builds a `ModelRouter` (`services/router_model.py`) per
scan from the user's decrypted keys (`services/router_factory.py`):

- **Real provider calls** (`services/llm_clients.py`) for Gemini and
  OpenRouter; failures are classified (`RateLimited` / `ProviderTimeout` /
  `ProviderError`).
- **Auto mode:** try providers in order; on 429 cool the provider down for 60s,
  emit a reroute event, and continue on a healthy one. **Manual mode:**
  round-robin across selected providers.
- **Bounded backoff** on transient errors; **timeouts** skip the segment
  (recorded unanalyzed) so the scan always completes. If every provider is
  exhausted, `complete()` returns `""` rather than raising.
- **Cross-model verification** (`services/verification.py`): every Critical is
  re-checked by a *different* provider; on disagreement it's downgraded to High
  with a note, and `verified_by` is recorded. Skipped when <2 providers keyed.

Reroute/cooldown events are collected on the router (`RouterEvent`) for the
WebSocket layer (Module 5) to surface as the frontend's reroute banner. With no
keys configured, scans still run via the `default_complete` placeholder.

## Module 5 (WebSocket Live Events)

`services/scan_events.py` is an in-process pub/sub bus + per-scan control
channel. The orchestrator publishes the full progress stream; the WebSocket
endpoint relays it and accepts control commands.

**Connect:** `GET /api/v1/scans/{scan_id}/ws?token=<access_token>` (token in
query — browsers can't set the `Authorization` header on a WebSocket). On
connect, buffered event history is replayed so late joiners catch up.

**Server → client** `{"type", "payload"}` for each event: `scan_started`,
`file_parsed`, `segment_completed`, `finding_discovered`, `model_status`
(rate-limit / reroute, drained from the router), `scan_progress`
(percent/elapsed/eta), `scan_completed`, `scan_failed`, `scan_cancelled`,
`scan_paused`, `scan_resumed`.

**Client → server** `{"command": "pause" | "resume" | "cancel"}`. There's also a
REST fallback: `POST /api/v1/scans/{id}/control?command=...`. The orchestrator
checks the control flag between segments — pause blocks, cancel ends the scan
cleanly as `cancelled`.

> In-memory = single process. Every scan runs inside the API process, so live
> events always stream to WebSocket clients. (A finished scan with no live
> listener — e.g. a reconnect — still gets the DB-derived terminal event.)

## Module 6 (Reports & Exports)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/scans/{id}/exports` | Generate an export (`pdf`/`json`/`csv`) |
| GET | `/api/v1/scans/{id}/exports` | List a scan's exports |
| GET | `/api/v1/exports/{report_id}/download` | Download a ready export |
| POST | `/api/v1/scans/{id}/share` | Create a revocable public share link |
| GET | `/api/v1/scans/{id}/share` | List share links |
| DELETE | `/api/v1/share/{token_id}` | Revoke a share link |
| GET | `/api/v1/public/reports/{slug}` | **Unauthenticated** sanitized report |
| GET | `/api/v1/scans/{id}/diff/{other_id}` | Diff vs an older scan → new/fixed/still-open |

- **Exports** (`services/exporters.py`): JSON (full), CSV (findings table), PDF
  (WeasyPrint). PDF degrades to HTML if WeasyPrint's native deps are absent, so
  exports never hard-fail. Rendered inline (no network I/O) and stored under
  `EXPORT_DIR`.
- **Share links**: unguessable `secrets.token_urlsafe` slugs, revocable; the
  public endpoint serves only findings + scores (no `user_id`, no keys).
- **Scan diff** (`services/scan_diff.py`): matches by category + file + fuzzy
  line proximity (±10 lines) → new / fixed / still-open buckets.

## Module 7 (False Positives & Fix Generation)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/findings/{id}/false-positive` | Mark FP (+reason); creates a suppression |
| DELETE | `/api/v1/findings/{id}/false-positive` | Unmark; drops the suppression |
| POST | `/api/v1/findings/{id}/fixed` | Mark fixed (`fixed_via=manual`) |
| POST | `/api/v1/findings/{id}/fix` | **SSE** stream of a deep full-fix |
| GET | `/api/v1/suppressions` | List per-repo suppression rules |
| DELETE | `/api/v1/suppressions/{id}` | Delete a suppression |

- **Suppressions** (`models/suppression.py`): marking a finding false-positive
  records a per-repo rule (category + file pattern); future scans of that repo
  inject these as "do not re-flag" context into segment prompts (wired in the
  orchestrator via `_load_suppressions`). Unmarking removes the rule.
- **Full fix** (`services/fix_generator.py`): a deeper LLM call than the
  scan-time `fix_summary`/`fix_snippet`, streamed over Server-Sent Events as
  `data: {"delta": "..."}` chunks then `data: {"done": true}`. Falls back to a
  deterministic fix when the user has no provider keys, so the UI always works.

## Module 8 (Scoped Report Chat)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/scans/{id}/chat` | Chat info: exec summary (first message), counters |
| POST | `/api/v1/scans/{id}/chat` | **SSE** stream of the assistant reply |

- **Strict system prompt** (`services/scoped_chat.py`) is built server-side with
  the scan's findings/scores/summary injected, and **never appears in any
  response payload** (tested).
- **Jailbreak / off-topic** messages are detected by pattern, short-circuited to
  a brief redirect *without reaching the model*, and logged (`ChatLog.flagged`)
  for silent monitoring.
- **Rate limit** 30 msgs/hour/scan (429); **conversation cap** 50 (409). Cross-
  scan/user isolation enforced (404). The client sends truncated history on
  edit/resend — no special server handling needed.

## Module 9 (Custom Vulnerabilities)

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/v1/custom-vulnerabilities` | List / create rules |
| PATCH/DELETE | `/api/v1/custom-vulnerabilities/{id}` | Edit (incl. active toggle) / delete |
| POST | `/api/v1/custom-vulnerabilities/research` | **SSE** research pipeline → persists definition |

- **Research pipeline** (`services/research.py`): name + description → web search
  (pluggable; **Tavily** when `TAVILY_KEY` set, then SerpAPI, else a
  deterministic offline stub) →
  LLM synthesis into a structured definition (what it is / detection patterns /
  what to look for / how to fix / sources). Streams `research_started`,
  `search_query_sent`, `search_results_received`, `synthesizing`,
  `research_completed`, then a `saved` event.
- **Scan wiring**: active custom vulns are appended to segment prompts as extra
  detection targets when the scan has `include_custom` (orchestrator
  `_load_custom_vulns`).

## Modules 10 & 12 (Optimization Plans + Watchlist)

A **`Repository`** (`models/repository.py`) is the backbone both modules share —
a stable per-user repo record resolved/created on scan creation
(`services/repositories.py`), so scans, plans, and the watchlist reference it
instead of matching a bare repo string.

**Optimization Plans** (`/api/v1/optimization-plans`): CRUD; each plan targets
one repository; goals (Pending / In progress / Done) link to findings via
`Finding.plan_id` + `goal_id`. Plan **health** = done÷total goals; **progress**
is weighted. `POST /validate` streams AI goal validation
(`validating → approved | issues_found`; heuristic fallback without keys). Goals
**auto-advance** when their tagged findings are all fixed
(`services/goal_tracking.py`, run at scan finalize).

**Watchlist** (`/api/v1/watchlist`): pin/unpin with `frequency`
(manual/daily/weekly), `GET` cards with score + change delta, `/alerts` badge
aggregate, one-click `/{id}/rescan` (reuses the last scan's config), and
`/run-due` to trigger all due re-scans. `next_run_at` is stored; a scheduler
calling `/run-due` is deferred to the worker module (see KNOWN_LIMITATIONS.md).
Change detection (`compute_change`) diffs the repo's two latest completed scans.

Repo discovery: `GET /api/v1/watchlist/repositories` lists all the user's repos
(watched or not) for plan/watchlist linking.

## Module 11 (GitHub Integration)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/github/authorize` | OAuth authorize URL (signed state) |
| POST | `/api/v1/github/callback` | Exchange code → store encrypted token |
| GET | `/api/v1/github/status` | Connection status + settings + webhook URL/secret |
| POST | `/api/v1/github/disconnect` | Revoke token, clear connection |
| GET | `/api/v1/github/repos` | List repos (paginated + search) |
| PATCH | `/api/v1/github/{triggers,issue-settings,status-check,repo-access}` | Settings |
| POST | `/api/v1/github/findings/{id}/issue` | Manually create a GitHub issue |
| POST | `/api/v1/github/webhook/{user_id}` | **Webhook receiver** (HMAC-verified) |
| GET | `/api/v1/github/deliveries` | Recent webhook delivery log |

- **OAuth**: authorization-code flow; the access token is Fernet-encrypted at
  rest and never returned. `state` is a signed short-lived JWT binding the user.
- **Webhooks** (`services/webhook_handler.py`): per-user HMAC secret verifies
  `X-Hub-Signature-256`; `push` / `pull_request` / `release` events trigger
  auto-scans per the user's `triggers` (with branch-filter globs). Every delivery
  is logged.
- **Issues & status checks** (`services/github_post_scan.py`): after a
  github-sourced scan finalizes, issues are auto-created for findings ≥ the
  severity threshold (templated, labelled, optional assignee) and a commit status
  is posted (optionally failing on Critical to block merges). Both best-effort —
  network errors never fail the scan.
- **Authenticated clone**: `source_type="github"` scans now clone via the stored
  token (`orchestrator._github_clone_url`), enabling private repos.

## Module 13 (MCP Server & Claude Code Handoff)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/audits/{id}/handoff/generate` | Create a handoff link (scoped); returns raw token once |
| GET | `/api/v1/audits/{id}/handoff?token=…` | **Consume** → structured markdown (single-use) |
| GET | `/api/v1/handoff-links` | List links with computed status |
| DELETE | `/api/v1/handoff-links/{id}` | Revoke a link |
| POST/GET | `/mcp` | **MCP server** (JSON-RPC 2.0; SSE keep-alive on GET) |

- **Handoff tokens** (`services/handoff.py`): 32-byte url-safe, **bcrypt-hashed
  (raw never stored)**, single-use, 24h, max 10 active/user. Scopes:
  `all` / `critical_high` / `security` / `optimizations` / `custom`
  (explicit finding ids). Invalid/expired/used/revoked all return a generic 401.
- **Markdown** matches the spec format (repo/branch/date header, then per-finding
  blocks with current code, suggested fix, and priority).
- **MCP server** (`/mcp`, outside the API prefix): `initialize` → tools
  capability; `tools/list`; `tools/call`. Two tools —
  **`fetch_audit_handoff`** (parses the handoff URL, validates token-in-URL,
  returns markdown) and **`mark_finding_fixed`** (requires a consumed handoff
  covering the finding; sets `status=fixed`, `fixed_via=claude_code`, and pushes
  a `finding_fixed` WebSocket event so an open report updates live).
- **Events** (`handoff_generated` / `handoff_consumed` /
  `finding_fixed_via_claude_code`) are logged for the History tab.

## Module 14 (Learning Hub)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/learning-hub/classes` | List/search classes (filter by `q`, `category`; paginated) |
| GET | `/api/v1/learning-hub/categories` | Categories with class counts |
| GET | `/api/v1/learning-hub/classes/{slug}` | Full class detail (FAQ + resources) |

- **Seeded content**: 20 security categories (**193 classes**, ≥187) plus two
  non-security categories — **Optimization** (4) and **Stubs & Placeholders**
  (4) — for **201 classes** total, seeded idempotently on startup
  (`services/learning_service.seed_learning_hub`). Security source data in
  `services/taxonomy_data.py` (content generated by `services/learning_seed.py`);
  optimization/stub content is purpose-written in
  `services/learning_seed_nonsec.py`.
- **FAQ-style content**: each security class has a 7-question explainer (what it
  is / why it happens / how it's exploited / real-world example / how to know
  you're affected / how to fix / how to prevent), each answer with an optional
  deeper "advanced" note, plus 8 curated resource links (CWE, OWASP ×2,
  PortSwigger — topic-specific where known, MDN, SANS, YouTube, articles).
  Optimization/stub classes have a 3-question explainer and generic resources.
- **Standalone, not cross-linked**: the Learning Hub is a browsable directory.
  Findings are *not* resolved to a class page — the former `for-finding/{id}`
  resolver matched the model's free-text labels against static class names,
  which was brittle (frequent 404s, no optimization/stub coverage) and was
  removed. See `KNOWN_LIMITATIONS.md`.

## Modules 15–17 (Notifications · Usage Tracking · Fun Facts)

| Method | Path | Description |
|--------|------|-------------|
| GET/PUT | `/api/v1/notifications/preferences` | Per-type email/in-app flags |
| GET | `/api/v1/notifications` | In-app records (`unread_only` filter) |
| GET | `/api/v1/notifications/unread-count` | Unread badge count |
| POST | `/api/v1/notifications/{id}/read` · `/read-all` | Mark read |
| DELETE | `/api/v1/notifications/{id}` | Delete a notification |
| GET | `/api/v1/usage` | Usage aggregates for the Usage settings screen |
| GET | `/api/v1/fun-facts?count=N` | Shuffled batch of tech facts (public) |

- **Notifications** (`services/notifications.py`): `notify()` always creates an
  in-app record (unless in-app is off) and emails when the gating preference is
  on. Email (`services/email.py`) sends via SMTP, or records to an outbox/log
  when SMTP is unconfigured. **Triggers** are wired for: scan completion,
  Critical found, watchlist change (on a watched repo's re-scan), handoff
  consumed, and finding-fixed-via-Claude-Code.
- **Usage tracking** (`services/usage.py`): every LLM call is logged with
  provider/model/tokens/scan/purpose (recorded inside `ModelRouter` once a
  `user_id` is set on the per-scan/per-user router). `/usage` returns current-
  session tokens, daily tokens per model, scans this month, lifetime segments,
  API calls by provider, and a last-updated timestamp.
- **Fun facts** (`services/fun_facts_seed.py`): 45 seeded facts; `/fun-facts`
  returns a shuffled batch for the live-scan screen.

## Module 18 (Final Wiring · Seed · Worker)

- **Seed script** (`app/seed.py`, `python -m app.seed`) — idempotent; creates the
  demo user + encrypted provider keys, a realistic completed scan of
  `user/ecommerce-api` (15 findings incl. 4 Critical, scores 38/64 matching the
  frontend demo), an optimization plan with goals, a watched repo, and seeds the
  Learning Hub (193 classes) + fun facts (45).
- **Maintenance loop** (`app/worker.py:run_maintenance_loop`) — started inside
  the API process on startup (`app.main.lifespan`). Triggers due watchlist
  re-scans, claims and runs any queued/orphaned scan via the same `run_scan`
  orchestrator (in-process, so live events stream), and runs orphan recovery,
  weekly digests, and the file-cache sweep. No separate worker process: every
  scan runs where the WebSocket can see it. Run a single API replica.
- **Migrations** — the initial auth migration plus a second migration covering
  all 20 module tables (`alembic upgrade head`).

**All 18 modules complete.** Remaining polish items (PR-diff scoping, real token
streaming, scheduler wiring, frontend↔API wiring) are catalogued in
[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).
