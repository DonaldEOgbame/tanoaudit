# Known Limitations & Deferred Work

A running, honest log of shortcuts, spec divergences, and "do this before
production" items. After the hardening pass, most prior items are **resolved** —
they're listed at the bottom for traceability. What remains is either
environmental (needs an account/key) or a deliberate, low-risk choice.

> Status legend: 🔴 must-fix before prod · 🟡 should-fix / divergence ·
> 🟢 intentional, low-risk

---

## Remaining — environmental (need a key/account/runtime)

- 🟢 **LLM keys are server-side; GitHub OAuth, search, email are opt-in.** Users
  never provide API keys — set these on the server:
  - `GEMINI_API_KEY` / `OPENROUTER_API_KEY` — the keys behind every user's
    scans/chat. Unset -> that provider is unavailable and scans fall back to the
    empty-result placeholder (a deploy misconfig, not a user state).
  - `GITHUB_CLIENT_ID`/`SECRET` — OAuth; without them `/github/authorize` 503s.
  - `TAVILY_KEY` (or `SERPAPI_KEY`) — live custom-vuln web research.
  - `MAILERSEND_API_KEY` or `SMTP_*` — real email; else logged to an outbox.
  - `MCP_API_KEY` — require bearer auth on `/mcp`.
- 🟢 **Server-side model tiers + daily scan cap (no BYO keys).** Users pick
  Akira-branded tiers — **Akira Fast** (Gemini Flash), **Akira Balanced**
  (Claude Haiku), **Akira Deep** (Claude Sonnet) — exposed via `GET /scans/models`
  as `{id,label,description}` only; the provider/model behind each tier is never
  sent to the client, and finding attribution / usage stats use the tier label,
  never the vendor (`services/model_catalog.py`, `ModelRouter.label_for`). Tier
  backends are env-overridable (`TIER_FAST_MODEL` etc.). A hard rolling-24h scan
  cap per user (`DAILY_SCAN_LIMIT`, default 5) returns **429
  `daily_limit_reached`** with `resets_in_seconds`; `GET /scans/limit` reports
  usage. The old per-user `api_keys` BYO surface (Settings UI + `/settings/api-keys`
  endpoints) is removed; the `api_keys` table is left in place (dormant) and
  `services/providers.py` is orphaned — drop both in a follow-up migration/cleanup.
- 🟢 **No Redis / external broker, single process by design.** The event bus is
  in-memory and rate limiting uses an in-memory window. Every scan runs inside the
  API process — user scans as BackgroundTasks, headless scans (scheduled/orphan)
  via the in-process maintenance loop — so live events always reach the WebSocket.
  No arq/Celery, no Redis, no separate worker process. Run a single API replica
  (the maintenance loop's claim path is not built for multi-process contention).
- 🟢 **`requirements.txt` pins exact versions** (`==`) to the resolved,
  full-suite-passing set under Python 3.14; the 3.12 Docker image installs the
  same versions. *Bump deliberately, re-run the suite, repin.*
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
- ✅ **Scan flow** (`page-newscan.jsx`, `page-livescan.jsx`, `app.jsx`): New Scan now
  emits a real `ScanCreate` config (github/url/ZIP, depth, models, include flags; ZIP
  captures the actual `File` via drag/drop or click-to-browse) and `startScan` calls
  `POST /scans` (or `/scans/upload`). The full-screen Live Scan binds to the returned
  scan id and streams `scan_started`/`file_parsed`/`scan_progress`/`finding_discovered`/
  `scan_completed`/`scan_failed` over the WebSocket (`AkiraAPI.scans.openWS`), driving
  the percentage + live finding count; Cancel sends the cancel control. With no scan id
  (the Tweaks "Run a demo scan" showcase) it falls back to the timed simulation.
  Verified end-to-end through the real frontend (headless Chrome): login → ZIP upload →
  live WS event stream → completion, zero exceptions.
- 🟡 **Report page still demo-data.** The live scan transitions into `ScanReport`, which
  still renders `window.VS_*` findings; `scanId`/`repo` are now passed in but not yet
  consumed. Remaining demo-data screens: report/findings tabs, dashboard stats/charts,
  scans list, watchlist, plans, custom vulns, library, chat, settings persistence.
- 🟢 **Live events always stream** (by design): every scan runs inside the API
  process (user scans as BackgroundTasks, headless scans via the in-process
  maintenance loop), and the in-memory event bus feeds the WebSocket in that same
  process. The only time the WS shows no *live* events is a reconnect to an
  already-finished scan, which gets the DB-derived terminal event
  (`api/scan_ws._terminal_event`). There is no process boundary a scan can run
  behind, so there is no "scan ran somewhere the WS couldn't see it" case.

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
- 🟢 **All scores are RELATIVE TO CODEBASE SIZE.** `security_score`,
  `completeness_score`, and the optimization fallback normalize their
  severity-weighted penalty against the number of analyzed segments
  (`scoring._relative_score`, budget = max(segments, 8) × 4 penalty-pts). Before,
  they were flat penalty sums, so a few minor findings in a large repo scored the
  same as a tiny all-broken repo (FundingRateBot completeness was a misleading 19;
  size-relative it's 73). `completeness_score` is recomputed from stored stub
  findings at finalize (lets intentional stubs be excluded); the per-segment
  `completeness_score` the model emits is parsed but unused.
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
- ✅ **Concurrent batches cut wall-clock time.** Batches run up to
  `ANALYSIS_CONCURRENCY` (default 4) at a time via `asyncio` + a semaphore — the
  model calls (the slow part) overlap, while results are still *processed* in
  batch order so events/findings/progress stay deterministic. Pause/cancel is
  honored per batch and pending model calls are cancelled on early stop.
  **DB note:** result writes use a short session *per batch* (committed and
  closed each batch) rather than one session held open for the whole scan — a
  long-lived transaction otherwise locks SQLite for the scan's duration (a real
  bug this change surfaced and fixed). `ANALYSIS_CONCURRENCY=1` is fully
  sequential.
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

- 🟢 **In-process scan execution + maintenance loop (no broker, no worker).** A
  user scan is committed as `queued` and run immediately in a FastAPI
  BackgroundTask. A DB-backed maintenance loop runs inside the API process
  (`app.worker.run_maintenance_loop`, started in `app.main.lifespan`) and claims
  any `queued`/orphaned scan — scheduled watchlist re-scans and crash-orphans that
  have no attached client — running them via the same `run_scan` orchestrator, in
  the same process, so their progress still streams. `run_scan` does a guarded
  `queued|claimed -> running` UPDATE, so the BackgroundTask and the loop can never
  double-run the same scan (rowcount 0 -> the other side won; bail). **ZIP-upload
  scans** extract into a scan-id-keyed dir (`ingestion.scan_upload_dir`) that
  `materialize_source` resolves from the id alone, so all scan types share the
  `run_scan(scan_id)` path. Single API replica (the claim path isn't built for
  multi-process contention).
- ✅ **Orphan-scan recovery.** A scan stuck in `claimed`/`running` past 15 min
  (e.g. an API restart mid-scan) is re-queued under a retry cap
  (`scans.retry_count`, max 3), then marked failed. Runs in the maintenance loop.
  Migration `f5b2d9e7a3c1`.
- ✅ **Batch-recovery / placeholder-provider parse bug (fixed).** Two issues made
  a *completely* failed batch needlessly expensive. (1) `analyze_batch` only ran
  recovery `if missing and len(missing) < len(segments)`, so a batch where *every*
  segment failed to parse was dropped instead of retried — now `if missing:`.
  (2) `default_complete` (the keyless-scan placeholder) returned a single flat
  result object, but `build_batch_prompt` expects the indexed
  `{"results": {"0": {...}, ...}}` shape; the flat object parsed to all-None,
  forcing `_analyze_subset` to split the whole batch down to single segments one
  call at a time and log "segment dropped" for each. `default_complete` now
  detects batch prompts (via the `### SEGMENT i` headers) and emits the indexed
  shape, so a keyless batch resolves in one call. Regression test:
  `test_default_complete_satisfies_batch_contract`.
- 🟢 **MCP transport is a minimal direct implementation** (initialize/tools.list/
  tools.call/ping over POST; SSE GET is keep-alive). Bearer auth is supported.
  It now advertises current protocol versions (`2025-06-18`/`2025-03-26`/
  `2024-11-05`) and negotiates — echoing the client's requested version when
  supported, else offering its newest. Session-ids/resumable streams are
  intentionally omitted: this server is request/response only (no
  server-initiated messages), so there's nothing to resume. *Add session
  management only if a streaming feature (e.g. server-pushed scan progress over
  MCP) is added.*
- 🟢 **Exports render in an in-process BackgroundTask** (`_render_export_bg`).
  `create_export`
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
- 🟢 **Usage page shows the real daily-scan cap + per-tier daily token limits**
  (from `/usage`: `daily_scans` and `daily_tokens_by_model[].limit`). The old
  invented "current session token quota" card was removed — there's no real
  session-token concept; all numbers are now backend-sourced.
- 🟢 **Scan profile now caps coverage for real.** The New Scan modal offers one
  "Scan profile" (Fast/Balanced/Thorough) that sets both the engine (Akira tier)
  and the segment cap. `orchestrator._DEPTH_LIMITS` (120/400/800) is now applied
  to truncate segments per profile (it was previously dead code — every scan
  analyzed all segments). Surplus segments are logged, not analyzed.
- 🟢 **No "% AI-generated" composition number — by design.** Reliable AI-vs-human
  code detection isn't currently possible (research detectors ~84% in a lab, worse
  on clean/polished AI code), so the AI-Gen tab shows only concrete, defensible
  signals: counts of patterns commonly left by code-generation tools (stubs,
  copy-paste validation, hardcoded values, etc.) + a real finding-density risk
  `delta`. The old findings-ratio percentage overstated it (FundingRateBot showed
  33%); a code-based line scanner was prototyped and removed because even that only
  catches lazy tells and read ~0% on known-AI code — a false negative. `/scans/{id}/
  ai-generation` returns `patterns`, `signal_count`, `delta` (deprecated `percent`
  kept for back-compat, not shown).
- 🟢 **Live provider/GitHub calls are mocked in tests** (no network in CI).
- 🟢 **Frontend is mock-driven** except the redesigned Chat + Learning Hub.
  Wiring it to the API is the next phase; the backend returns the shapes it needs.
  (The static frontend now lives in `frontend/`; the FastAPI service in `backend/`.)

---

## Resolved in the hardening pass

- ✅ **🔴 Valid secrets.** `.env.example` ships working sample `JWT_SECRET`/
  `FERNET_KEY`; `python -m scripts.generate_secrets` mints real ones; the app
  **refuses to boot in production** with the samples (`assert_production_safe`).
- ✅ **In-memory event bus.** `scan_events` fans scan progress out to WebSocket
  subscribers via asyncio queues, with in-memory history (replay) and
  pause/cancel control flags. Single-process; control methods are async.
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
- ✅ **Global rate limiting.** `core/ratelimit.rate_limit` (in-memory fixed window)
  on login/register/scan-create/handoff-generate; toggle via `RATE_LIMIT_ENABLED`.
- ✅ **Structured logging + correlation IDs.** JSON logs with a per-request
  `X-Request-ID` (`core/logging`), echoed in the response header.
- ✅ **True end-to-end WebSocket test** (`test_ws_e2e.py`, real handshake via
  Starlette TestClient).
- ✅ **WeasyPrint in Docker** (cairo/pango installed) → real PDF exports in the
  container; HTML fallback remains for local/no-deps.
- ✅ **GitHub authenticated clone** (private repos) — done in Module 11.
  Hardened: blank/whitespace branch treated as default; a nonexistent remote
  branch retries once on the default branch instead of failing the scan;
  `GIT_TERMINAL_PROMPT=0`/`GIT_ASKPASS=true` prevent interactive hangs; embedded
  `x-access-token` credentials are redacted from clone errors/logs.
- ✅ **GitHub outcomes wired to scan completion.** `_emit_github_outcomes`
  posts a commit status (when `status_check.post_commit_status` + a known SHA)
  and auto-creates issues for findings at/above `issue_settings.severity_threshold`
  (when `auto_create`), both best-effort. Webhooks auto-register on repos as they
  are added to `repo_access: selected`. OAuth uses `prompt=select_account` so a
  user can connect a different account after disconnecting.
- ✅ **Alembic migrations** cover every table + the new columns.
