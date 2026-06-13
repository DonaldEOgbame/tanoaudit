# Detection benchmark corpus

A small repo of source files with **deliberately planted** issues, each tagged
with a machine-readable marker so the benchmark harness can measure detection
recall/precision.

## Marker format

Every planted issue carries a comment on (or just above) the offending line:

```
# PLANTED: <engine>/<category-slug>   (Python, shell, YAML)
// PLANTED: <engine>/<category-slug>  (JS/TS/Go/Java/...)
```

- `engine` ∈ `security` | `optimization` | `stub`
- `category-slug` is a stable slug (e.g. `sql-injection`, `n-plus-one`,
  `todo-stub`). It matches against a finding's normalized category/subcategory.

Markers are **stripped before the code is sent to the model** (see
`tests/benchmark/harness.py`), so they never leak the answer to the LLM — they're
only read by the harness to know what *should* have been found and where.

## Running

The benchmark needs real provider keys (the deterministic fallback finds
nothing), so it's opt-in:

```bash
RUN_DETECTION_BENCHMARK=1 GEMINI=... pytest tests/benchmark -s
```

It prints recall/precision per engine and asserts a minimum recall floor. Grow
the corpus over time; treat the printed numbers as the signal when tuning prompts
(did recall go up or down?), not the pass/fail of unrelated changes.
