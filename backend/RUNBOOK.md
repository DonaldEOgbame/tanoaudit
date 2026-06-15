# Running a real scan

This is the practical guide to running Akira against real code on your own
machine, where there are no sandbox limits (processes aren't reaped, and `git
clone` reaches GitHub normally).

There are two ways: a **one-command CLI** (fastest, no servers) and the **full
stack** (API + worker, the production shape).

---

## Prerequisites

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # first time only
pip install -r requirements.txt                      # first time only
alembic upgrade head                                  # apply DB migrations
```

You need at least one **provider key** (OpenRouter or Gemini). Put it in `.env`
as `DEMO_OPENROUTER_KEY=...` (the seed/CLI default), or pass it on the CLI.

> Free-tier reality: providers cap **requests per day** (Gemini free = 25/day).
> Batching keeps a small/medium repo under that, but a large repo or repeated
> scans will hit the provider's daily cap — that's the provider, not Akira. A
> paid key removes it.

---

## Option A — one-command CLI (recommended to start)

Runs the whole pipeline in-process. No API server, no Redis, no worker.

```bash
# A local folder — no clone, no GitHub needed (the easiest first test):
python -m scripts.run_full_scan --dir /path/to/a/project

# A public git URL:
python -m scripts.run_full_scan --url https://github.com/org/repo.git

# A private GitHub repo (pass a token with 'repo' scope):
python -m scripts.run_full_scan --repo owner/name --github-token ghp_xxx

# A ZIP:
python -m scripts.run_full_scan --zip /path/to/project.zip
```

It prints status, **wall-clock time**, **how many LLM requests** batching
collapsed the scan into, scores, and the findings. Options: `--depth
fast|deep|thorough`, `--provider openrouter|gemini`, `--no-optimization`.

This is the fastest way to confirm a real scan completes and to see real timing
on your hardware.

---

## Option B — full stack (API serves scans + WebSocket)

The production shape: the API runs scans in-process and streams live progress
over the WebSocket. There is no separate worker — a maintenance loop (scheduled
watchlist re-scans, orphan recovery, digests, file-cache sweep) starts inside the
API automatically. Run a single API replica.

```bash
# Just the API — runs scans, the WebSocket, and the maintenance loop.
uvicorn app.main:app --port 8000
```

Then create a scan over HTTP (log in first to get a token):

```bash
TOKEN=$(curl -s -X POST localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@akira.ai","password":"demo-password-123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['tokens']['access_token'])")

curl -s -X POST localhost:8000/api/v1/scans -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"source_type":"github","repo":"owner/name","depth":"deep"}'

# Poll it:
curl -s localhost:8000/api/v1/scans/<SCAN_ID> -H "Authorization: Bearer $TOKEN"
```

GitHub private repos need a connected account first — see the OAuth flow:
`GET /api/v1/github/authorize`.

---

## Tuning for speed / rate limits (all env vars, see `.env.example`)

| Var | Default | Effect |
| --- | --- | --- |
| `ANALYSIS_CONCURRENCY` | 4 | Batches run in parallel — the main speed lever. Raise for faster scans, lower to be gentle on rate limits. |
| `ANALYSIS_BATCH_TOKENS` | 6000 | Code packed per request. Higher = fewer requests (beats daily caps); lower = smaller prompts, better per-segment quality. `0` disables batching. |
| `SEGMENT_TIMEOUT_S` | 60 | Per-request timeout. Raise for slow models / big batches. |
| `GEMINI_MODEL` | gemini-flash-latest | `gemini-2.0-flash` is free-tier quota-zeroed; use the default or a paid model. |

**Rough timing** (concurrency 4, ~8s/request on a free model):
`time ≈ (segments ÷ batch-packing ÷ 4) × 8s`. A ~120-segment repo ≈ under a
minute of model time; a ~600-segment repo ≈ a few minutes.

---

## If a scan drops segments (`unparsed > 0`)

The model truncated some batches. Akira auto-recovers (re-analyzes the missing
segments individually), so this should be rare. If it persists on a weak model,
lower `ANALYSIS_BATCH_TOKENS` (e.g. 2500) so each request is smaller, or use a
more capable model.
