"""Cross-model verification of Critical findings.

Any finding rated Critical is re-checked by a second (different) provider before
being persisted as Critical. If the second model disagrees, it is downgraded to
High with a note; both model attributions are recorded. This runs on the handful
of Criticals per scan, so the cost is small.
"""
from __future__ import annotations

import json
import re

from app.models.scan import ENGINE_SECURITY, Finding
from app.services.router_model import ModelRouter

_PROMPT = """You are verifying a reported security finding. Answer with ONLY a JSON object:
{{"confirmed": true|false, "reason": "brief"}}

A finding was reported as CRITICAL severity:
- Category: {category}
- File: {file} lines {ls}-{le}
- Explanation: {explanation}

Code:
```
{code}
```

Is this genuinely a CRITICAL-severity security vulnerability? Confirm only if the
risk is real and high-impact."""


def _parse_confirm(raw: str | None) -> bool | None:
    raw = (raw or "").strip()
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    val = data.get("confirmed")
    return bool(val) if isinstance(val, bool) else None


async def verify_criticals(
    findings: list[Finding], router: ModelRouter, primary_provider: str | None
) -> None:
    """Mutate findings in place: confirm or downgrade each Critical."""
    available = [p for p in router.order if p in router.keys]
    # Pick a verifier different from the finding's primary provider when possible.
    for f in findings:
        if f.engine != ENGINE_SECURITY or (f.severity or "").lower() != "critical":
            continue

        verifier = next(
            (p for p in available if router.label_for(p) != f.model_attribution),
            None,
        )
        if verifier is None:
            # Only one provider available — cannot independently verify; keep as-is
            # but mark that no second opinion was possible.
            f.verified_by = None
            continue

        prompt = _PROMPT.format(
            category=f.category or "", file=f.file, ls=f.line_start, le=f.line_end,
            explanation=(f.explanation or "")[:600], code=(f.code_snippet or "")[:1500],
        )
        raw = await router.complete(prompt, model_hint=verifier)
        confirmed = _parse_confirm(raw)
        verifier_label = router.label_for(verifier)

        if confirmed is False:
            f.severity = "high"
            note = f"Downgraded from Critical: {verifier_label} did not confirm."
            f.explanation = f"{f.explanation or ''}\n\n[{note}]".strip()
            f.verified_by = verifier_label
        elif confirmed is True:
            f.verified_by = verifier_label
        # confirmed is None (unparseable) -> leave Critical, no attribution change
