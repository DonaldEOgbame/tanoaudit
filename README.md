# Akira AI

A unified, AI-powered codebase **security audit + optimization** platform. One scan runs two engines at once — a security engine (187 vulnerability classes across 20 categories) and an optimization engine (performance, code quality, scalability, dependencies) — and surfaces the results in a Claude.ai-style shell: sidebar navigation + history on the left, dashboards / reports / scan flows in the main area.

This is a fully interactive front-end prototype built from the [Claude Design](https://claude.ai/design) handoff. It runs in the browser with no build step — React 18 + Babel Standalone compile the JSX in-page.

## Running it

It's a static site, living in `frontend/`. Serve that folder over HTTP (opening `index.html` via `file://` won't work because the browser blocks the module-style script loads):

```bash
cd frontend
python3 -m http.server 8765
# then open http://localhost:8765
```

Any static server works (`npx serve`, `php -S`, etc.). An internet connection is required on first load — React, ReactDOM, Babel, and the Geist fonts are pulled from CDNs.

## What's in here

The frontend lives in `frontend/`; the FastAPI service lives in `backend/`. Paths below are relative to `frontend/`.

| Path | What it is |
| --- | --- |
| `index.html` | Entry point — loads CDN deps, then the data/component scripts, mounts `window.VaultApp` |
| `css/tokens.css` | Design tokens — 3 themes (Carbon / Mono / Warm) × dark/light, severity color system |
| `css/app.css` | Component + layout styles |
| `css/animations.css` | Keyframes and motion (respects `prefers-reduced-motion`) |
| `js/data-findings.js` | Demo data — the 43 findings for `user/ecommerce-api`, with real code snippets + diffs |
| `js/data-meta.js` | Demo data — facts pool, dependencies, scans, learning-hub content |
| `js/icons.js` | Inline SVG icon set |
| `js/ui.jsx` | Shared primitives — count-up hook, gauges, badges, code highlighter, toasts |
| `js/charts.jsx` | Bespoke charts (bar, severity ring, area trend, heat grid) |
| `js/chat.jsx` | Scoped report chat (the Overview tab's conversational interface) |
| `js/shell.jsx` | Sidebar, command palette (⌘K), profile popover |
| `js/page-*.jsx` | Screens — dashboard, new-scan flow, live-scan showcase, report, library, etc. |
| `js/finding-card.jsx`, `js/report-tabs.jsx` | Report sub-components |
| `js/settings.jsx` | Claude-style settings modal |
| `js/tweaks-panel.jsx` | Design-tool preview controls (no-ops outside the design host) |
| `js/app.jsx` | Root — theme/router state, layout, top bar |
| `logo.svg` | Wordmark |

## Key screens

- **Dashboard** — returning-user overview + first-run onboarding (toggle via the Tweaks panel inside the design host).
- **New Scan** — 3-step modal: source (GitHub / Git URL / ZIP), configuration (depth + models), review.
- **Live Scan** — the animation showcase: hero progress, rotating tech facts, live findings feed, file checklist, per-model activity with rate-limit reroute, terminal ticker. Runs as a compressed ~45s simulation (speed-adjustable), then transitions into the report.
- **Scan Report** — animated risk + optimization gauges, AI executive summary, a scoped report chat, and tabs: Overview, Findings, Optimizations, Dependencies, AI-Gen Analysis, History. Findings use a two-panel file-tree + diff layout with J/K/F keyboard nav and on-demand "Generate Full Fix".
- **Custom Vulnerabilities, Optimization Plans, Watchlist, Reports, Integrations (GitHub), Learning Hub**, and a full settings modal.

Demo data is realistic throughout — a fake `user/ecommerce-api` repo with 43 findings, populated reports, and believable code.

## Notes

- Dark mode is the default; light mode and three visual themes are first-class.
- Animations are core, not decoration, and degrade gracefully under reduced-motion / throttled contexts.
- This is a prototype: scans are simulated and no real code is analyzed.
