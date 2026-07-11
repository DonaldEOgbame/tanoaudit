# Agent prompts — TanoAudit frontend wiring (parallel-safe)

Copy one block into each agent. They are **file-disjoint** and **do not touch**
`js/api.js`, `js/app.jsx`, `js/index.html`, or any report files (those are reserved for
the Slice 0 / Slice 1 agent). Run each on its own git branch/worktree.

## Hard rules every agent must follow (shared context)

- The frontend is `frontend/`, no build step (React 18 + Babel Standalone, plain
  `window.*` globals). Match the existing code style: `const h = React.createElement;`,
  IIFE modules assigning to `window.X`, no JSX-with-angle-brackets unless the file
  already uses it.
- **All backend calls go through `window.TanoAuditAPI`** (defined in `js/api.js`). Responses
  are already unwrapped (the `{data,error}` envelope is handled); failures throw
  `TanoAuditAPI.ApiError` with `.code`, `.message`, `.status`. **Never call `fetch` directly.
  Never edit `js/api.js`.** If a method you need is missing from `TanoAuditAPI`, STOP and
  leave a `// TODO(slice0): TanoAuditAPI.<ns>.<method>` comment instead of adding it — the
  Slice 0 agent owns that file.
- **Do NOT edit:** `js/api.js`, `js/app.jsx`, `index.html`, `js/page-report.jsx`,
  `js/report-tabs.jsx`, `js/finding-card.jsx`, `js/chat.jsx`, `js/shell.jsx`. Only edit
  the file(s) your prompt names.
- Replace demo globals (`window.VS_*`) **only inside your file**. Loading states, empty
  states, and error toasts are required for every list/detail you wire.
- Backend runs at `http://localhost:8000`, frontend served at `http://localhost:8765`
  (`cd frontend && python3 -m http.server 8765`). A test user exists:
  `verify@tanoaudit.ai` / `hunter2pass` — or register via the UI.
- The full endpoint map and field shapes are in `WIRING.md` at the repo root. Read it.
- **Verify before declaring done:** run the backend + frontend, log in, exercise your
  screen in a browser, and confirm real data loads and mutations persist (reload check).
- This is a static server that caches by `?v=` query string. You normally can't bump it
  (that's in `index.html`, which you must not edit) — instead, hard-reload with cache
  disabled when testing, and note in your summary that `index.html`'s `?v=` should be
  bumped at integration time.

---

## AGENT A — Settings modal  (`js/settings.jsx` only)

> Wire `frontend/js/settings.jsx` to the real backend. This file is self-contained
> (the Settings modal). **Only edit `js/settings.jsx`.** Follow the shared rules above
> (use `window.TanoAuditAPI`, never edit `api.js`/`app.jsx`/`index.html`).
>
> Wire each section to its endpoints:
> - **Profile** (`ProfileSec`): load `TanoAuditAPI.profile.get()` (← `GET /profile`), save via
>   `TanoAuditAPI.profile.update(patch)` (← `PATCH /profile`). Replace any `VS_REPO_META` use.
> - **Account / password** (`AccountSec`): `TanoAuditAPI.security.changePassword(...)`
>   (`POST /security/change-password`).
> - **2FA** (`TwoFactorBlock`, `SecuritySec`): TOTP + email OTP enroll/verify/disable,
>   set active method, backup codes, sessions list + revoke, login history — all under
>   `TanoAuditAPI.security.*` (`/security/2fa/*`, `/security/sessions`, `/security/login-history`).
> - **API keys** (`ApiKeysSec`): `TanoAuditAPI.settings.getApiKeys/putApiKeys/testApiKey/
>   deleteApiKey` (`/settings/api-keys*`).
> - **Models** (`ModelsSec`): `TanoAuditAPI.settings.getModels/putModels` (`/settings/models`).
> - **Privacy** (`PrivacySec`): `TanoAuditAPI.settings.getPrivacy/putPrivacy` (`/settings/privacy`).
> - **Usage** (`UsageSec`): `TanoAuditAPI.usage.get()` (`/usage`).
> - **Notifications** (`NotifSec`): `TanoAuditAPI.notifications.getPreferences/putPreferences`
>   (`/notifications/preferences`).
> - **Handoff links** (`HandoffLinksSec`): `TanoAuditAPI.handoff.links()` +
>   `TanoAuditAPI.handoff.deleteLink(id)` (`/handoff-links`).
>
> Some `TanoAuditAPI` methods above may not exist yet (Slice 0 is adding them in parallel).
> If one is missing, leave a `// TODO(slice0): ...` and wire what you can. Add loading/
> error/empty states. The `2fa` enroll returns an `otpauth_uri` for QR rendering — show
> the secret/URI; a real QR image is optional.
>
> Verify: open Settings, edit profile + save + reload (persists), view sessions/usage,
> add/remove an API key. Report which `TanoAuditAPI` methods you needed that were missing.

---

## AGENT B — Learning Hub + Integrations  (`js/page-team-learn.jsx` only)

> Wire `frontend/js/page-team-learn.jsx` to the real backend. This file defines BOTH
> `LearningPage` and `IntegrationsPage`. **Only edit `js/page-team-learn.jsx`.** Follow
> the shared rules above.
>
> **Learning Hub** (`LearningPage`): replace `VS_TAXONOMY`, `VS_CATEGORIES`, `VS_LEARNING`
> with `TanoAuditAPI.learning.categories()` (`GET /learning-hub/categories`),
> `.classes({category?, q?})` (`/learning-hub/classes`), and `.classDetail(slug)`
> (`/learning-hub/classes/{slug}`). It's a browsable directory — list categories →
> classes → class detail.
>
> **Integrations / GitHub** (`IntegrationsPage`): replace `VS_GH_REPOS` with:
> - status: `TanoAuditAPI.github.status()` (`GET /github/status`)
> - connect: redirect the browser to `TanoAuditAPI.github.authorizeUrl()` (`GET /github/authorize`
>   returns/links the OAuth URL — follow how the backend returns it)
> - disconnect: `TanoAuditAPI.github.disconnect()`
> - repos: `TanoAuditAPI.github.repos()` (`GET /github/repos`)
> - trigger / issue / status-check / repo-access settings → the corresponding
>   `TanoAuditAPI.github.*` PATCH methods (`/github/triggers`, `/issue-settings`, etc.)
> - webhook deliveries: `TanoAuditAPI.github.deliveries()`
>
> `VS_TEAM` (team activity) has **no backend** — leave it as-is with a clear
> `// TODO(no-endpoint): VS_TEAM has no backend (see WIRING.md Gaps)` and don't fake it.
> If GitHub OAuth isn't configured locally, `GET /github/authorize` returns a clear
> "not configured" error — handle it gracefully (show a "connect GitHub" prompt + the
> error message).
>
> Missing `TanoAuditAPI` methods → `// TODO(slice0): ...`. Add loading/error/empty states.
>
> Verify: Learning Hub lists real categories/classes and opens a class detail;
> Integrations shows real connection status and (if connected) real repos.

---

## AGENT C — Library: Custom Vulns + Plans + Watchlist  (`js/page-library.jsx` only)

> Wire `frontend/js/page-library.jsx` to the real backend. This file defines
> `CustomVulnsPage`, `PlansPage`, `WatchlistPage`, and `ReportsPage`. **Only edit
> `js/page-library.jsx`.** Follow the shared rules above. (Wire all four sections;
> `ReportsPage` uses `TanoAuditAPI.reports.*` — see WIRING.md.)
>
> - **Custom Vulnerabilities** (`CustomVulnsPage`): CRUD via `TanoAuditAPI.customVulns.*`
>   (`/custom-vulnerabilities`), and "research" → `TanoAuditAPI.customVulns.research(...)`
>   (`POST /custom-vulnerabilities/research`). Replace `VS_CUSTOM_VULNS`.
> - **Optimization Plans** (`PlansPage`): CRUD + goals + validate via `TanoAuditAPI.plans.*`
>   (`/optimization-plans`, `/optimization-plans/{id}/goals`, `/optimization-plans/validate`).
>   The repo picker uses `TanoAuditAPI.watchlist.repositories({github_only:true})`
>   (`GET /watchlist/repositories?github_only=true`) — show an empty-state if no GitHub
>   connection. Replace `VS_PLANS`.
> - **Watchlist** (`WatchlistPage`): `TanoAuditAPI.watchlist.list()`, `.repositories()`,
>   `.pin(id)/.unpin(id)`, `.frequency(id, freq)`, `.alerts()`, `.rescan(id)`
>   (`/watchlist*`). Replace `VS_WATCHLIST`.
> - **Reports** (`ReportsPage`): list/download exports + shares via `TanoAuditAPI.reports.*`
>   (per-scan: `/scans/{id}/exports`, `/scans/{id}/share`; download via
>   `TanoAuditAPI.reports.downloadExportUrl(reportId)`). If this needs a scan context the page
>   doesn't have, wire what's possible and `// TODO` the rest.
>
> Missing `TanoAuditAPI` methods → `// TODO(slice0): ...`. Add loading/error/empty states;
> confirm create/delete persist across reload.
>
> Verify: create a custom vuln + reload (persists); create a plan with a goal; pin/unpin
> a watched repo; change re-scan frequency.

---

## AGENT D — New Scan source/config lists  (`js/page-newscan.jsx` only)

> Wire the data lists in `frontend/js/page-newscan.jsx` to the real backend. The scan
> *submission* logic is already wired (don't touch `onStart`/`buildConfig`/the upload
> flow). **Only edit `js/page-newscan.jsx`.** Follow the shared rules above.
>
> - **GitHub repo picker** (`StepSource`, github tab): replace `window.VS_GH_REPOS` with
>   `TanoAuditAPI.github.repos()` (`GET /github/repos`). If GitHub isn't connected, the call
>   errors or returns empty — show a "Connect GitHub in Integrations" empty-state instead
>   of the repo list (the github/url/zip tabs must all still work; url + zip need no API).
> - **Model selection** (`StepConfig`, manual mode): replace `window.VS_MODELS` with
>   `TanoAuditAPI.settings.getModels()` (`GET /settings/models`). Confirm the returned shape
>   has `{id, name, color?}`-ish fields; adapt the rendering to the real shape. If a field
>   like `color` is absent, pick a sensible default — don't crash.
>
> Missing `TanoAuditAPI` methods → `// TODO(slice0): ...`. Add loading/error/empty states.
> Verify: open New Scan → github tab lists your real repos (or a clean empty-state);
> manual model mode lists real models. The scan still starts correctly.

---

## Full coverage accounting (so nothing is silently dropped)

Every `VS_*` demo global and who owns replacing it:

| Global(s) | File(s) | Owner |
| --- | --- | --- |
| `VS_REPO_META`, `VS_FINDINGS`, `VS_AIGEN`, `VS_HISTORY`, `VS_API_BASE` | report / tabs / chat | **Slice 1 (lead)** |
| `VS_CATEGORIES`, `VS_LEARNING`, `VS_TAXONOMY`, `VS_GH_REPOS`(team-learn copy) | page-team-learn | **Agent B** |
| `VS_CUSTOM_VULNS`, `VS_PLANS`, `VS_WATCHLIST`, `VS_GH_REPOS`(library copy), `VS_FINDINGS`(library copy) | page-library | **Agent C** |
| `VS_REPO_META`(settings copy) | settings | **Agent A** |
| `VS_GH_REPOS`(newscan copy), `VS_MODELS` | page-newscan | **Agent D** |
| `VS_SCANS`, `VS_ACTIVITY` | page-dashboard (+ shell) | **Agent E — after Slice 1** |
| `VS_FACTS` | page-livescan | keep as-is (live-scan trivia, no backend needed) |
| `VS_DEPS`, `VS_REPO_FILES`, `VS_TEAM` | report-tabs / shell / team-learn | **no backend — leave TODOs** |

### Agent E — Dashboard  (`js/page-dashboard.jsx`, AFTER Slice 1)
Not parallel-safe yet: Dashboard wiring also wants `js/shell.jsx` (sidebar recent scans +
command palette), which Slice 1 edits. Dispatch Agent E once Slice 1 has merged. Prompt:
> Wire `frontend/js/page-dashboard.jsx` only. Replace `VS_SCANS`/`VS_ACTIVITY` with
> `TanoAuditAPI.scans.list()` (`GET /scans`) and `TanoAuditAPI.usage.get()` (`GET /usage`); derive
> the stat cards/charts from real scans; show the first-run empty state when the user has
> zero scans. Do NOT edit `js/shell.jsx` (the lead handles sidebar/palette). Follow the
> shared rules above.

### Deferred to the lead (not for parallel agents)
- **Notifications bell** — lives in `js/app.jsx` (shared); done by the lead after Slice 0/1.
- **`js/shell.jsx`** sidebar recent-scans + command palette (`VS_SCANS`/`VS_FINDINGS`/
  `VS_REPO_FILES`) — done by the lead with Slice 1.
- **Report + tabs + chat** = Slice 1 (lead).

## Gaps with no backend (don't fake; leave TODOs)
`VS_DEPS` (Dependencies tab), `VS_REPO_FILES` (file tree / palette search), `VS_TEAM`
(team activity). These need a product decision (add endpoint / derive client-side / drop).
See `WIRING.md` → Gaps.
