# Known Limitations & Deferred Work

A running, honest log of shortcuts, spec divergences, and "do this before
production" items. After the hardening pass, most prior items are **resolved** —
they're listed at the bottom for traceability. What remains is either
environmental (needs an account/key) or a deliberate, low-risk choice.

> Status legend: 🔴 must-fix before prod · 🟡 should-fix / divergence ·
> 🟢 intentional, low-risk

---

## Remaining — environmental (need a key/account/runtime)

- 🟢 **Provider keys, GitHub OAuth, search, email are all opt-in.** The app runs
  fully without them (deterministic fallbacks). To enable the real thing, set:
  - `GEMINI`/`OPENROUTER` keys (per-user, via Settings) — real scans/chat/fixes.
  - `GITHUB_CLIENT_ID`/`SECRET` — OAuth; without them `/github/authorize` 503s.
  - `TAVILY_KEY` (or `SERPAPI_KEY`) — live custom-vuln web research.
  - `MAILERSEND_API_KEY` or `SMTP_*` — real email; else logged to an outbox.
  - `REDIS_URL` reachable — cross-process event bus, shared rate limiting, and the
    arq task queue (scans/exports + cron jobs); else in-memory bus + the in-process
    poller/BackgroundTasks fallback.
  - `MCP_API_KEY` — require bearer auth on `/mcp`.
- 🟢 **`requirements.txt` pins exact versions** (`==`) to the resolved,
  full-suite-passing set under Python 3.14; the 3.12 Docker image installs the
  same versions. **redis is pinned to 5.x** because arq 0.28 requires redis<6
  (the `redis.asyncio` pub/sub + pipeline API the event bus uses is unchanged
  5.x↔8.x). *Bump deliberately, re-run the suite, repin.*
- 🟢 **Session location is null.** No GeoIP enrichment; needs a GeoIP DB.

## Frontend ↔ backend wiring (in progress)

The frontend began as a pure prototype on demo globals (`window.VS_*`). Wiring it
to the live API is underway, **foundation-first**:

- ✅ **API client** (`frontend/js/api.js`, `window.AkiraAPI`): resolves the base URL
  (`?api=` → `<meta name="akira-api">` → `http://localhost:8000/api/v1`), unwraps the
  `{data, error}` envelope, stores the JWT pair in `localStorage`, and does a single
  transparent refresh-and-retry on 401. CORS: added `:8765`/`127.0.0.1:8765` (the
  static-server origin) to `CORS_ORIGINS` in `.env`.
- ✅ **Auth gate** (`frontend/js/auth-screen.jsx` + `app.jsx` `Gate`): login/register
  UI wired to `/auth/register`, `/auth/login` (incl. the `totp_required` second-factor
  branch), and `/profile`. App is gated behind a real session; profile name/initials/
  email and the dashboard greeting now come from the authenticated user. Logout clears
  tokens and re-gates. Verified end-to-end via headless Chrome against a live backend.
- 🟡 **Everything else is still demo-data.** Dashboard stats/charts, scans, reports,
  findings, watchlist, plans, custom vulns, library, live-scan WS, chat, settings
  persistence — all still read `window.VS_*`. These are the next wiring slices.

## Post-launch feature additions (this session)

- ✅ **Email OTP 2FA** added *alongside* authenticator TOTP. Users pick the active
  factor; login auto-sends an email code when that's the method. Codes are
  hashed, 10-min expiry, 5/hour cap. Frontend: a method-picker 2FA block in
  Security settings. 🟢 **Resend free tier** only delivers to your own verified
  address until you verify a domain — email OTP works for you in testing, not
  arbitrary users, until then.
- ✅ **Optimization plans → GitHub repo.** Backend already enforced
  `repository_id`; added `GET /watchlist/repositories?github_only=true` (requires
  a live GitHub connection) and a repo picker + repo label + empty-state in the
  plan UI.
- ✅ **"Hand off to Claude Code" UI.** Report-page button → scope picker →
  one-time URL + expiry → **full Claude Code MCP setup instructions**
  (`claude mcp add … /mcp`, the fetch prompt, what the tools do). Plus a
  **Settings → Handoff links** management view (status + revoke). Backend was
  already complete. 🟡 The frontend modal is still mock-driven (generates a
  placeholder token client-side) — wiring it to `POST
  /audits/{id}/handoff/generate` is the remaining step, consistent with the rest
  of the still-mock frontend.

## Stub & Placeholder Detection engine (this session)

- 🟢 **Third engine runs in the same per-segment LLM call.** `analysis.py` asks for
  `security` + `optimizations` + `stubs` in one JSON response; no extra calls. The
  `stubs` key and `segment_scores.completeness_score` default to empty/100 so
  old-shape responses still parse.
- 🟢 **`completeness_score` is recomputed from stored stub findings at finalize**
  (severity-weighted, `scoring.completeness_score`), not averaged from the
  per-segment scores the model returns. This keeps it consistent with how
  `security_score` works and lets intentional stubs be excluded cleanly. The
  per-segment `completeness_score` the model emits is currently parsed but unused.
- 🟢 **Stubs are excluded from cross-model verification** by design (spec): a stub
  is either present or not, so there's no ambiguity worth a second opinion — saves
  tokens. Enforced by the `engine == security` filter on the verification query.
- 🟢 **Intentional-stub suppression matches on `repo + file_path + content_hash`**
  (`stub_content_hash` = sha256 of the whitespace-stripped snippet). If the code at
  that location changes, the hash differs and the stub resurfaces as `open`. Note
  the hash is location-independent within a repo: an identical stub snippet in a
  different file would also auto-suppress (acceptable — same code, same decision).
- 🟢 **`generate-implementation` and full-fix now have full-file context for all
  scan types.** Source files are cached on disk at ingestion
  (`file_cache.cache_files`, stamped on `scans.file_cache_path`); `_fetch_file_context`
  tries GitHub first (picks up post-scan edits), then falls back to the cache —
  so ZIP/URL scans no longer work from the stored snippet alone. Caches are
  swept after `FILE_CACHE_TTL_DAYS` (default 7) by the worker. Migration
  `f5b2d9e7a3c1`. ✅ **`DELETE /scans/{id}`** now exists: it removes the scan, all
  child rows (findings, segments, reports, share tokens, chat, handoff —
  explicitly, so it's correct on SQLite too, which doesn't enforce FK cascade by
  default) and on-disk artifacts (file cache, ZIP upload dir, rendered exports).
  The TTL sweep remains as a backstop for caches orphaned by a crash.

## Detection robustness pass (this session)

- ✅ **All 20 security categories now sent every scan.** `slice_taxonomy` used to
  filter to a 5-category base + filename/path heuristics, which (a) gave bland
  filenames only the base set and (b) left several categories — Concurrency,
  Memory & Resource Management, Mobile, Dependency & Supply Chain — unreachable
  by *any* heuristic. We now send all 20 category labels (~20 prompt lines, not
  the full 187-class taxonomy). The `slice_taxonomy` signature is kept for
  callers/tests but no longer slices.
- ✅ **Learning Hub finding cross-link removed.** The old `for-finding/{id}`
  resolver matched the model's free-text labels against static class names via
  exact-slug-then-`LOWER(name) CONTAINS` with an arbitrary `rows[0]` tie-break —
  brittle (frequent 404s, silent wrong matches, zero optimization/stub
  coverage). The Hub is now a standalone browsable directory; the endpoint,
  `find_class_for_finding`, and its test were deleted.
- ✅ **Optimization + stub content seeded into the Hub.** 4 optimization + 4 stub
  categories now have purpose-written entries (`learning_seed_nonsec.py`),
  browsable like any other class, registered in frontend `VS_TAXONOMY`. They are
  *not* cross-linked to findings (see above) — they stand alone.
- ✅ **Subcategory normalization for grouping.** The model's free-text
  `subcategory` is now normalized to the closest canonical taxonomy name
  (`normalization.py`: exact → unique-substring → token-overlap ≥ 0.5, else left
  unchanged) and stored in `findings.subcategory`, with the original preserved in
  the new `findings.subcategory_raw` column. This is reporting/dedup hygiene only;
  it does not gate detection.
- ✅ **Parse hardening — no more whole-segment loss.** A single malformed finding
  used to fail Pydantic validation for the *entire* segment, silently dropping
  every finding in it. `parse_analysis` now salvages valid items per-array and
  logs the dropped ones. ✅ **A segment unparseable even after the repair retry
  is counted on the scan.** The orchestrator tallies these into the new
  `scans.segments_unparsed` column (Alembic `d3f9a2c5e1b7`), exposed on `ScanOut`
  and the `SCAN_COMPLETED` event, and logs a WARNING at finalize when nonzero —
  so the recall miss is a surfaced number, not just a log line.
- 🟢 **Confidence noise-floor filter.** Optimization/stub findings that are both
  Low-confidence *and* Low/Info-severity are dropped (logged). Security findings
  are never filtered — a low-confidence critical still warrants a look.
- ✅ **Segment batching cuts request count.** Analysis used to make one LLM
  request per segment, so a mid-size repo (e.g. 76 segments) blew straight
  through tight free-tier limits (Gemini free tier = 25 requests/day). The
  orchestrator now packs segments into batches under `ANALYSIS_BATCH_TOKENS`
  (default 6000) and sends one request per batch — `analyze_batch` returns
  results keyed by segment index, preserving per-segment line numbers, events,
  counters, scores, and per-segment salvage. A batch of one reuses the
  single-segment path. Set the budget to 0 to disable.
- ✅ **Truncated-batch recovery.** When the model truncates its JSON (some
  segment indices missing while others parsed), the missing segments are
  *re-analyzed* — as a smaller sub-batch, recursively halving down to the
  single-segment path (most reliable) — instead of being dropped. Extra requests
  are spent only on the segments that failed. The output cap is also raised
  (`MAX_ANALYSIS_TOKENS=16384`) to truncate less often. A real scan of a 76-seg
  repo on a weak free model lost 8 segments before this; recovery reclaims them.
  🟡 *Bigger prompts can still slightly dilute per-segment attention; tune
  `ANALYSIS_BATCH_TOKENS` with the detection benchmark.*
- ✅ **Detection-quality benchmark exists.** `tests/fixtures/vuln_corpus/` is a
  planted-issue corpus (15 seeded issues across security/optimization/stub, each
  tagged `PLANTED: <engine>/<slug>`), with a harness (`tests/benchmark/harness.py`)
  that strips the markers before scanning (the model never sees the answer) and
  scores recall/precision per engine. Harness self-tests run in CI; the live
  recall benchmark (`test_detection_recall`) is opt-in via
  `RUN_DETECTION_BENCHMARK=1` + real keys and asserts a recall floor
  (`DETECTION_RECALL_FLOOR`, default 70%). 🟡 *The corpus is a starter set — grow
  it toward ≥2 examples per category, and run the benchmark before/after prompt
  changes to tell improvement from churn. Still instrumented in `akira.analysis`.*
  **First live run (gemini-flash-latest) caught a real bug** — see below.
- ✅ **Gemini now requests JSON output mode.** The first live benchmark showed the
  model was competent (the one segment that parsed scored 100% precision) but
  larger segments returned **unparseable JSON** and were lost — `complete_gemini`
  sent no `generationConfig`, so the model wrapped/truncated its JSON. Added
  `generationConfig: {responseMimeType: "application/json", maxOutputTokens:
  8192, temperature: 0}` to the analysis completer (not the chat/fix streamer,
  which must stream prose). 🟡 **Validated structurally (a payload test asserts
  JSON mode) but NOT yet against a live model** — the free-tier Gemini quota was
  exhausted by the benchmark runs before a clean re-validation. *Re-run the
  benchmark once quota resets to confirm recall recovers.*
- 🟢 **Gemini model default is `gemini-flash-latest`.** `gemini-2.0-flash` has had
  free-tier quota zeroed (`limit: 0`) on at least one account; `gemini-flash-latest`
  works. Override per-deployment with `GEMINI_MODEL`. The `PROVIDER_LABELS` UI
  string still reads "Gemini 2.0 Flash" — cosmetic, update when settled.

## Remaining — deliberate / low-risk

- 🟢 **Worker now runs on arq (Redis task queue), with the poller as fallback.**
  Primary dispatch is arq: `app/services/dispatch.enqueue` enqueues `run_scan_task`
  / `export_report_task` when `ARQ_ENABLED` and Redis is reachable; the
  `WorkerSettings` worker (`arq app.worker.WorkerSettings`) gives retries
  (`max_tries=3`), backpressure (`max_jobs=5`), timeouts, and cron jobs
  (watchlist re-scans, orphan recovery, weekly digest, file-cache sweep). When
  Redis is down / `ARQ_ENABLED=false`, `enqueue` returns False and work runs
  in-process (FastAPI BackgroundTasks for scans, the polling worker for
  watchlist/digest) — so a Redis-less box still scans. The atomic-claim path
  (`queued`→`claimed`, `SELECT ... FOR UPDATE SKIP LOCKED` / guarded UPDATE)
  remains as the poller's no-double-run guarantee. **ZIP-upload scans now also go
  to arq**: the upload endpoint extracts into a shared, scan-id-keyed dir
  (`ingestion.scan_upload_dir`, under the storage root, mountable across
  workers), and `materialize_source` resolves a ZIP scan to that dir from the id
  alone — so all scan types flow through the same `run_scan_task(scan_id)` enqueue.
  *Pinned to redis 5.x (arq 0.28 requires redis<6).*
- ✅ **Orphan-scan recovery.** A scan stuck in `claimed`/`running` past 15 min
  (worker crash) is re-queued under a retry cap (`scans.retry_count`, max 3),
  then marked failed. Runs as an arq cron and in the poller loop. Migration
  `f5b2d9e7a3c1`.
- 🟢 **MCP transport is a minimal direct implementation** (initialize/tools.list/
  tools.call/ping over POST; SSE GET is keep-alive). Bearer auth is supported.
  It now advertises current protocol versions (`2025-06-18`/`2025-03-26`/
  `2024-11-05`) and negotiates — echoing the client's requested version when
  supported, else offering its newest. Session-ids/resumable streams are
  intentionally omitted: this server is request/response only (no
  server-initiated messages), so there's nothing to resume. *Add session
  management only if a streaming feature (e.g. server-pushed scan progress over
  MCP) is added.*
- 🟢 **Exports render in the arq worker** (`export_report_task`), with an
  in-process BackgroundTask fallback when arq is unavailable. `create_export`
  returns the `pending` report immediately; the client polls
  `list_exports`/`download_export` until `ready`. `_render_export` is the single
  shared renderer for both paths.
- 🟢 **passlib dropped for direct bcrypt** (passlib 1.7.4 vs bcrypt 4.x).
- 🟢 **OAuth `state` is a signed JWT, no server-side nonce store** — replayable
  until expiry; fine for a single-user product.
- 🟡 **GitHub callback has a test-only `GET /github/callback`.** The real flow is
  SPA-style — the frontend catches GitHub's redirect and POSTs `code`+`state` to
  `POST /github/callback`. Until that frontend exists, a `GET /github/callback`
  does the exchange server-side and renders a success page so the OAuth round-trip
  is testable in a browser. Both share one validated exchange helper. *Remove (or
  repurpose to redirect into the SPA) once the real frontend lands.*
- 🟢 **Research synthesizes from search snippets, not fetched page bodies.**
- 🟢 **Learning Hub content is templated** (category/class-aware), not hand-authored
  per class; some resource links are searches (YouTube/articles).
- 🟢 **Chat thumbs up/down are visual only** (no feedback storage).
- 🟢 **Usage "current session" = rolling 24h** (no real session concept).
- 🟢 **Live provider/GitHub calls are mocked in tests** (no network in CI).
- 🟢 **Frontend is mock-driven** except the redesigned Chat + Learning Hub.
  Wiring it to the API is the next phase; the backend returns the shapes it needs.
  (The static frontend now lives in `frontend/`; the FastAPI service in `backend/`.)

---

## Resolved in the hardening pass

- ✅ **🔴 Valid secrets.** `.env.example` ships working sample `JWT_SECRET`/
  `FERNET_KEY`; `python -m scripts.generate_secrets` mints real ones; the app
  **refuses to boot in production** with the samples (`assert_production_safe`).
- ✅ **🔴 Redis-backed event bus.** `scan_events` now uses Redis pub/sub +
  history + control keys when `REDIS_URL` is reachable (cross-process
  pause/cancel/stream), with an identical in-memory fallback. Control methods are
  async.
- ✅ **🔴 Tree-sitter segmentation.** `tree-sitter` + `tree-sitter-language-pack`
  installed; `tree_sitter_support.segment_with_tree_sitter` cuts on function/
  class boundaries (binding-agnostic), with sliding-window fallback. **Now
  coverage-complete** — an earlier version only emitted segments for cherry-
  picked node kinds and silently dropped call-expression route handlers (e.g.
  Express `router.get(...)`), so their vulnerabilities were never analyzed. It
  now packs *all* top-level regions into segments (regression-tested), verified
  end-to-end against a live Gemini scan that correctly flagged a planted SQLi.
- ✅ **Provider model IDs** are now env-overridable (`GEMINI_MODEL`, etc.).
- ✅ **Real token streaming.** `STREAMERS` (SSE) per provider + `ModelRouter.stream`;
  scoped chat and full-fix stream real deltas.
- ✅ **Real executive summary.** `exec_summary.generate_executive_summary` makes a
  final LLM aggregation call (templated fallback without keys).
- ✅ **Goal auto-tagging.** `goal_tracking.tag_findings_to_goals` tags findings to
  plan goals by keyword/category overlap during finalize, before auto-advance.
- ✅ **MCP bearer auth** (`MCP_API_KEY`, optional).
- ✅ **GitHub hardening.** Auto-register webhook (`POST /github/repos/{o}/{r}/webhook`),
  PR scans scoped to changed files (`path_filters`), and `repo_access: selected`
  enforced on webhook triggers.
- ✅ **Email provider.** Resend HTTP option in addition to SMTP.
- ✅ **Weekly digest + system scheduler.** `digest.send_weekly_digests` + the
  worker fires due re-scans system-wide and digests ~daily.
- ✅ **Full-fix context.** The fix endpoint re-fetches the file from GitHub
  (`get_file_content`) and passes a surrounding-lines window to the model.
- ✅ **Global rate limiting.** `core/ratelimit.rate_limit` (Redis or in-memory)
  on login/register/scan-create/handoff-generate; toggle via `RATE_LIMIT_ENABLED`.
- ✅ **Structured logging + correlation IDs.** JSON logs with a per-request
  `X-Request-ID` (`core/logging`), echoed in the response header.
- ✅ **True end-to-end WebSocket test** (`test_ws_e2e.py`, real handshake via
  Starlette TestClient).
- ✅ **WeasyPrint in Docker** (cairo/pango installed) → real PDF exports in the
  container; HTML fallback remains for local/no-deps.
- ✅ **GitHub authenticated clone** (private repos) — done in Module 11.
- ✅ **Alembic migrations** cover every table + the new columns.
