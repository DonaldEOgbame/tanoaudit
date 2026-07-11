# TanoAudit — Frontend ↔ Backend Wiring Plan

The backend (FastAPI, `backend/`) is **feature-complete**: ~20 routers, JWT auth,
scans + live WebSocket, reports, findings, chat, GitHub, etc. The frontend
(`frontend/`, no build step — React 18 + Babel Standalone in-browser) started as a
**pure prototype on demo globals** (`window.VS_*` from `js/data-findings.js` and
`js/data-meta.js`). "Wiring" = replacing those demo globals with real calls to the
backend through the shared API client.

This document is the single source of truth for what's done, what's left, and how to
split the work across multiple AI agents **without collisions**.

---

## How the pieces fit

- **API client:** `frontend/js/api.js` → `window.TanoAuditAPI`. Handles the `{data, error}`
  envelope, JWT storage + auto-refresh on 401, and a WebSocket helper. Base URL comes
  from `?api=` → `<meta name="tanoaudit-api">` → `http://localhost:8000/api/v1`.
- **Envelope:** every REST response is `{"data": <payload>, "error": null}` on success
  or `{"data": null, "error": {"code","message"}}` on failure. `TanoAuditAPI` already
  unwraps `.data` for you and throws `ApiError(code, message, status)` on failure.
- **Auth:** `TanoAuditAPI.auth.login/register/logout/me`. Tokens live in `localStorage`.
  The app is gated by `Gate` in `app.jsx`.
- **Demo globals to kill:** `window.VS_FINDINGS`, `VS_REPO_META`, `VS_SCANS`,
  `VS_ACTIVITY`, `VS_DEPS`, `VS_AIGEN`, `VS_HISTORY`, `VS_REPO_FILES`, `VS_PLANS`,
  `VS_WATCHLIST`, `VS_CUSTOM_VULNS`, `VS_GH_REPOS`, `VS_MODELS`, `VS_TAXONOMY`,
  `VS_CATEGORIES`, `VS_LEARNING`, `VS_TEAM`, `VS_FACTS`, `VS_LOG_TEMPLATES`,
  `VS_API_BASE`. (`VS_FACTS` is fine to keep — it's just live-scan trivia copy.)

### Local run

```bash
# backend — runs scans, the WebSocket, and the maintenance loop (no separate worker)
cd backend && .venv/bin/python -m uvicorn app.main:app --port 8000
# frontend
cd frontend && python3 -m http.server 8765   # open http://localhost:8765
```

CORS already allows `:8765`. No Redis is required: scans run in-process and live
events stream from the API process (see backend `KNOWN_LIMITATIONS.md`).

---

## ✅ Done

| Area | Files | Endpoints |
| --- | --- | --- |
| API client + JWT + WS helper | `js/api.js` | (infra) |
| Auth gate (login/register/2FA/logout/profile) | `js/auth-screen.jsx`, `js/app.jsx`, `js/shell.jsx` | `/auth/*`, `/profile` |
| Scan create + ZIP upload | `js/page-newscan.jsx`, `js/app.jsx` | `POST /scans`, `POST /scans/upload` |
| Live scan WebSocket stream | `js/page-livescan.jsx` | `WS /scans/{id}/ws`, `POST /scans/{id}/control` |

---

## ⬜ Remaining work — sliced for parallel agents

Each slice below is **file-disjoint** from the others (after Slice 0). Two agents can
run at once as long as they pick different slices. The only shared files are
`js/api.js`, `js/app.jsx`, and `index.html` — those are concentrated in **Slice 0**,
which must land first. After that, agents touch only their slice's page files.

> **Rule for agents:** Do NOT edit `api.js`, `app.jsx`, or `index.html` outside Slice 0
> unless your slice's row explicitly lists them. If you must, coordinate (or take a
> turn) — these are the collision points.

### Slice 0 — Shared client surface (LAND FIRST, single agent)

Add every API namespace the later slices need, in one pass, so nobody else has to touch
`api.js`. Mirror the existing `auth`/`scans` style in `js/api.js`.

- [ ] `findings` — `markFalsePositive`, `unmarkFalsePositive`, `markFixed`,
  `markIntentional`/`unmarkIntentional`, `intentionalStubs(repo)`, `suppressions()`,
  `deleteSuppression(id)`, `generateFix(id)`, `generateImplementation(id)`
- [ ] `reports` — `createExport(scanId, fmt)`, `listExports(scanId)`,
  `downloadExportUrl(reportId)`, `createShare/getShare/deleteShare`, `diff(a,b)`
- [ ] `chat` — `history(scanId)`, `send(scanId, message)`
- [ ] `customVulns` — CRUD + `research(...)`
- [ ] `plans` (optimization-plans) — CRUD + goals CRUD + `validate(...)`
- [ ] `watchlist` — `repositories()`, `list()`, `pin/unpin`, `frequency`, `alerts`,
  `rescan`, `runDue`
- [ ] `github` — `status`, `authorizeUrl`, `disconnect`, `repos`, trigger/issue/
  status-check/repo-access PATCHes, `createIssue(findingId)`, `deliveries`
- [ ] `learning` — `classes(...)`, `categories()`, `classDetail(slug)`
- [ ] `notifications` — `list`, `unreadCount`, `markRead(id)`, `readAll`, `delete(id)`,
  `getPreferences`/`putPreferences`
- [ ] `usage` — `get()`
- [ ] `settings` — `getApiKeys/putApiKeys/testApiKey/deleteApiKey`, `getModels/putModels`,
  `getPrivacy/putPrivacy`
- [ ] `security` — `changePassword`, `2fa` enroll/verify/disable/status (totp + email),
  `setMethod`, `backupCodes`, `sessions()`, `deleteSession(id)`, `loginHistory()`
- [ ] `funFacts` — `get()` (optional; can keep `VS_FACTS`)

**Acceptance:** `api.js` exposes all namespaces; `window.TanoAuditAPI` lists them; no page
files changed. Smoke-test a couple of GETs in the browser console.

---

### Slice 1 — Scan Report + tabs  *(highest value; depends on Slice 0)*

**Owns:** `js/page-report.jsx`, `js/report-tabs.jsx`, `js/finding-card.jsx`, `js/chat.jsx`
**Also edits:** `js/app.jsx` (only the `ScanReport` props line — already passes
`scanId`/`repo`).

- [ ] `ScanReport` loads `GET /scans/{scanId}` (scores, summary, repo) and
  `GET /scans/{scanId}/findings` instead of `VS_REPO_META` / `VS_FINDINGS`.
- [ ] Findings tab: real findings; J/K/F nav over the fetched list; "Generate Full Fix"
  → `POST /findings/{id}/fix`; "Generate implementation" (stubs) →
  `/generate-implementation`. Mark fixed / false-positive / intentional wired.
- [ ] Overview chat (`chat.jsx`) → `GET/POST /scans/{id}/chat` (replace `VS_FINDINGS`/
  `VS_REPO_META` scoping with the real scan).
- [ ] Tabs (`report-tabs.jsx`): Dependencies → `VS_DEPS` is demo-only **(see Gaps)**;
  AI-Gen, Heatmap, History derive from real findings / `GET /scans/{id}/diff/{other}`.
- [ ] Export buttons → `POST /scans/{id}/exports` + poll `GET .../exports` + download via
  `reports.downloadExportUrl`. Replace the hardcoded `VS_API_BASE` at
  `page-report.jsx:114` with `TanoAuditAPI.BASE`.
- [ ] Share link → `POST /scans/{id}/share`.

**Acceptance:** Open a finished scan → real scores, real findings, working fix
generation, chat answers, export download.

---

### Slice 2 — Dashboard + Scans list + Sidebar history

**Owns:** `js/page-dashboard.jsx`
**Also edits:** `js/shell.jsx` (sidebar recent-scans + command palette use `VS_SCANS`/
`VS_FINDINGS`/`VS_REPO_FILES`) — **coordinate with Slice 1 if both touch `shell.jsx`;
they don't otherwise.**

- [ ] Dashboard stats/charts from `GET /scans` (list + aggregate) and `GET /usage`.
  Replace `VS_SCANS` / `VS_ACTIVITY` and the hardcoded stat numbers.
- [ ] Sidebar "recent scans" / history → `GET /scans`. Command palette file search:
  `VS_REPO_FILES` is demo-only **(see Gaps)** — scope to scans/findings for now.
- [ ] First-run vs returning state keyed off whether the user has any scans.

**Acceptance:** Dashboard reflects the logged-in user's real scans; empty state for a
fresh account.

---

### Slice 3 — Watchlist + Optimization Plans

**Owns:** `js/page-library.jsx` (Watchlist + Plans sections), `js/tweaks-panel.jsx` (none)
**Note:** `page-library.jsx` also renders Custom Vulns (Slice 4). **Split by section
inside the file is risky for two agents — do Slices 3 and 4 sequentially, or split
`page-library.jsx` into separate files first.**

- [ ] Watchlist → `GET /watchlist`, `/repositories`, pin/unpin, frequency, `alerts`,
  `rescan`. Replace `VS_WATCHLIST`.
- [ ] Optimization Plans → `/optimization-plans` CRUD + goals + `validate`. Repo picker
  → `GET /watchlist/repositories?github_only=true`. Replace `VS_PLANS`.

### Slice 4 — Custom Vulnerabilities

**Owns:** `js/page-library.jsx` (Custom Vulns section) — see Slice 3 note.

- [ ] CRUD → `/custom-vulnerabilities`; "research" → `POST /custom-vulnerabilities/research`.
  Replace `VS_CUSTOM_VULNS`.

### Slice 5 — Integrations (GitHub)

**Owns:** the Integrations page (currently inside `page-library.jsx` or `page-team-learn.jsx` —
confirm before starting).

- [ ] Connection status `GET /github/status`; connect via `GET /github/authorize`
  (redirect); disconnect; repo list `GET /github/repos`; trigger/issue settings PATCHes;
  per-finding "Create issue" `POST /github/findings/{id}/issue`. Replace `VS_GH_REPOS`.

### Slice 6 — Learning Hub

**Owns:** `js/page-team-learn.jsx`

- [ ] `GET /learning-hub/categories`, `/classes`, `/classes/{slug}`. Replace
  `VS_TAXONOMY`, `VS_CATEGORIES`, `VS_LEARNING`. (`VS_TEAM` has no backend — see Gaps.)

### Slice 7 — Settings modal (all sections)

**Owns:** `js/settings.jsx`

- [ ] Profile → `GET/PATCH /profile`. Account/password + 2FA + sessions + login history →
  `/security/*`. API keys + models + privacy → `/settings/*`. Usage → `/usage`.
  Notifications → `/notifications/preferences`. Handoff links → `/handoff-links`.
  Replace `VS_REPO_META` usage. Most of this is per-section and self-contained.

### Slice 8 — Notifications (top bar bell)

**Owns:** `js/app.jsx` top-bar bell + a small new `js/notifications.jsx` (create it).

- [ ] Bell badge → `GET /notifications/unread-count`; dropdown → `GET /notifications`;
  mark-read/read-all/delete. **This touches `app.jsx` — sequence after Slice 0/1 or
  coordinate.**

---

## ⚠️ Gaps — demo data with NO backend endpoint

These can't be wired as-is. Each needs a product decision (add an endpoint, derive
client-side, or drop the feature):

- **`VS_DEPS`** (Dependencies tab) — no dependency-scan endpoint exists. Either add one
  to the backend or hide the tab until then.
- **`VS_REPO_FILES`** (command-palette file search, report file tree) — no
  "list files in scan" endpoint. The report file tree can be derived from findings'
  `file` fields; the command-palette file search has no source.
- **`VS_TEAM`** (Learning Hub team activity) — no team/multi-user endpoints exist.
- **`VS_MODELS`** (model picker in New Scan) — partially covered by `GET /settings/models`;
  confirm the shape matches before relying on it.
- **`VS_REPO_META`** — mostly replaced by `GET /scans/{id}`; a few fields (e.g. stars,
  languages breakdown) may have no source. Map field-by-field in Slice 1/7.

---

## Coordinating multiple agents (recommended workflow)

Yes, parallel agents are fine. To avoid stepping on each other:

1. **Land Slice 0 first, solo.** Everything else imports from `api.js`.
2. **One agent per slice, one git branch (or worktree) per agent.** With Claude Code:
   spawn each in its own worktree so edits are physically isolated until merge:
   - `git worktree add ../tanoaudit-slice1 -b wire/report`
   - `git worktree add ../tanoaudit-slice2 -b wire/dashboard`
3. **Respect the "Owns" / "Also edits" columns.** A slice may only edit files it owns.
   The shared trio (`api.js`, `app.jsx`, `index.html`) is the collision risk — keep
   those edits tiny and listed.
4. **`page-library.jsx` is shared by Slices 3+4** and **`shell.jsx` by Slices 1+2.** Either
   do those pairs sequentially, or first split the files (e.g. carve Custom Vulns into
   its own `page-custom.jsx`) so each agent owns one file.
5. **Each slice is independently verifiable** against the running backend — finish with a
   browser/headless check before merging (see "Done" slices for the pattern).
6. **Bump the `?v=` cache-buster** in `index.html` when you change a JS file (the static
   server caches by query string). This is the one `index.html` edit any slice may make.

### Suggested first wave (3 agents, no collisions)
- Agent A: **Slice 0** → then **Slice 1** (report).
- Agent B: **Slice 6** (Learning Hub — fully isolated file).
- Agent C: **Slice 7** (Settings — fully isolated file).

(B and C can start the moment Slice 0 merges; they don't touch `app.jsx`/`shell.jsx`.)

---

## Backend notes (mostly leave alone)

The backend is complete and tested, and runs with no Redis/broker (in-memory event
bus, in-process + polling-worker scan execution, in-memory rate limiting). If a slice
needs a missing endpoint (the Gaps above), treat that as a separate backend task with
its own tests — don't bolt client-only workarounds onto demo data.
