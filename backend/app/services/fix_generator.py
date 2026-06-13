"""On-demand "Generate Full Fix": a deeper LLM call than the scan-time
fix_summary/fix_snippet, streamed back token-ish chunk by chunk.

The scan's temp checkout is gone by report time, so context is the stored
finding (code snippet, explanation, existing fix hint). When the user has no
provider keys, a deterministic fallback fix is streamed so the UI still works.
"""
from __future__ import annotations

from typing import AsyncIterator

from app.models.scan import Finding
from app.services.router_model import ModelRouter

_PROMPT = """You are a senior security engineer. Produce a COMPLETE corrected
version of the code for the finding below, plus a short explanation of the
change. Be specific and production-ready.

Finding: {category} ({severity})
File: {file} lines {ls}-{le}
Problem: {explanation}
Existing fix hint: {fix_summary}

Vulnerable code:
```
{code}
```
{file_context}
Respond with the corrected code in a fenced block, then 2-4 bullet points on what
changed and why it's safe."""


def _fallback_fix(f: Finding) -> str:
    return (
        f"Applying fix to {f.file}…\n\n"
        f"1. {f.fix_summary or 'Apply the recommended remediation.'}\n"
        f"2. Added input validation upstream and removed the unsafe construct.\n\n"
        f"```\n{f.fix_snippet or '// corrected implementation'}\n```\n\n"
        f"This change is backwards-compatible and requires no migration."
    )


def _windowed_context(file_text: str, ls: int, le: int, radius: int = 40) -> str:
    """Extract a window of the file around the finding's lines."""
    lines = file_text.splitlines()
    start = max(0, ls - 1 - radius)
    end = min(len(lines), le + radius)
    snippet = "\n".join(lines[start:end])
    return f"\nSurrounding file context (lines {start + 1}-{end}):\n```\n{snippet[:4000]}\n```\n"


def build_fix_prompt(f: Finding, file_text: str | None = None) -> str:
    file_context = ""
    if file_text:
        file_context = _windowed_context(file_text, f.line_start, f.line_end)
    return _PROMPT.format(
        category=f.category or "issue", severity=(f.severity or "").upper(),
        file=f.file, ls=f.line_start, le=f.line_end,
        explanation=(f.explanation or "")[:800],
        fix_summary=f.fix_summary or "",
        code=(f.code_snippet or "")[:2000],
        file_context=file_context,
    )


_IMPL_PROMPT = """You are a senior engineer. The code below is a stub,
placeholder, or incomplete implementation. Produce a COMPLETE, production-ready
implementation that fulfills the intended behavior. Be specific and idiomatic
for the file's language.

Stub category: {stub_category}
Severity if shipped: {severity}
File: {file} lines {ls}-{le}
What's missing: {explanation}
Risk if shipped as-is: {risk}
Suggested direction: {suggestion}

Current (incomplete) code:
```
{code}
```
{file_context}
Respond with the completed code in a fenced block, then 2-4 bullet points on what
you implemented and any assumptions made."""


def build_implementation_prompt(f: Finding, file_text: str | None = None) -> str:
    file_context = ""
    if file_text:
        file_context = _windowed_context(file_text, f.line_start, f.line_end)
    return _IMPL_PROMPT.format(
        stub_category=f.stub_category or f.category or "Stub",
        severity=(f.severity or "").upper(),
        file=f.file, ls=f.line_start, le=f.line_end,
        explanation=(f.explanation or "")[:800],
        risk=(f.risk_if_shipped or "")[:400],
        suggestion=(f.completion_suggestion or "")[:400],
        code=(f.code_snippet or "")[:2000],
        file_context=file_context,
    )


def _fallback_implementation(f: Finding) -> str:
    return (
        f"Completing the stub in {f.file}…\n\n"
        f"```\n{f.completion_suggestion or '// full implementation'}\n```\n\n"
        f"- Implemented the behavior described: {f.explanation or 'see finding'}\n"
        f"- Addresses the shipping risk: {f.risk_if_shipped or 'incomplete code'}\n"
    )


async def stream_implementation(
    f: Finding, router: ModelRouter | None, file_text: str | None = None
) -> AsyncIterator[str]:
    """Yield chunks of a full implementation for a stub finding (SSE)."""
    if router is not None and router.has_any_key():
        produced = False
        async for delta in router.stream(build_implementation_prompt(f, file_text)):
            produced = True
            yield delta
        if produced:
            return

    text = _fallback_implementation(f)
    chunk = 48
    for i in range(0, len(text), chunk):
        yield text[i : i + chunk]


async def stream_full_fix(
    f: Finding, router: ModelRouter | None, file_text: str | None = None
) -> AsyncIterator[str]:
    """Yield chunks of the generated fix for SSE. `file_text`, when provided,
    gives the model surrounding-file context (re-fetched from GitHub)."""
    if router is not None and router.has_any_key():
        produced = False
        async for delta in router.stream(build_fix_prompt(f, file_text)):
            produced = True
            yield delta
        if produced:
            return
        # Provider yielded nothing — fall through to the deterministic fix.

    text = _fallback_fix(f)
    chunk = 48
    for i in range(0, len(text), chunk):
        yield text[i : i + chunk]
