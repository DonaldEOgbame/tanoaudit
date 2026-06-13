"""Export generators: JSON, CSV, and PDF (WeasyPrint when available).

Each returns (bytes, file_extension). PDF degrades gracefully to HTML if
WeasyPrint isn't installed, so exports never hard-fail on a missing native dep.
"""
from __future__ import annotations

import csv
import io
import json
from html import escape

from app.models.scan import Finding, Scan

_FINDING_FIELDS = [
    "public_id", "engine", "category", "subcategory", "severity", "confidence",
    "file", "line_start", "line_end", "cwe_id", "owasp_ref", "status",
    "model_attribution", "verified_by", "fix_summary",
    "stub_category", "risk_if_shipped",
]


def _finding_dict(f: Finding) -> dict:
    return {k: getattr(f, k, None) for k in _FINDING_FIELDS}


def export_json(scan: Scan, findings: list[Finding]) -> tuple[bytes, str]:
    payload = {
        "scan": {
            "id": scan.id, "repo": scan.repo, "branch": scan.branch,
            "commit": scan.commit, "depth": scan.depth,
            "security_score": scan.security_score,
            "optimization_score": scan.optimization_score,
            "completeness_score": scan.completeness_score,
            "worst_severity": scan.worst_severity,
            "files": scan.files, "segment_total": scan.segment_total,
            "executive_summary": scan.executive_summary,
        },
        "findings": [_finding_dict(f) for f in findings],
    }
    return json.dumps(payload, indent=2, default=str).encode("utf-8"), "json"


def export_csv(_: Scan, findings: list[Finding]) -> tuple[bytes, str]:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=_FINDING_FIELDS)
    writer.writeheader()
    for f in findings:
        writer.writerow(_finding_dict(f))
    return buf.getvalue().encode("utf-8"), "csv"


def _report_html(scan: Scan, findings: list[Finding]) -> str:
    rows = "".join(
        f"<tr><td>{escape(f.public_id)}</td>"
        f"<td>{escape((f.severity or '').upper())}</td>"
        f"<td>{escape(f.category or '')}</td>"
        f"<td>{escape(f.file)}:{f.line_start}-{f.line_end}</td>"
        f"<td>{escape((f.fix_summary or '')[:200])}</td></tr>"
        for f in findings
    )
    return f"""<!doctype html><html><head><meta charset="utf-8">
<style>
body {{ font-family: sans-serif; color: #111; margin: 40px; }}
h1 {{ font-size: 22px; }} table {{ border-collapse: collapse; width: 100%; font-size: 12px; }}
th, td {{ border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }}
th {{ background: #f4f4f5; }}
.scores {{ margin: 16px 0; font-size: 14px; }}
</style></head><body>
<h1>Akira AI Security Audit — {escape(scan.repo or scan.id)}</h1>
<div class="scores">
  Branch: {escape(scan.branch or '—')} @ {escape(scan.commit or '—')}<br>
  Security score: <b>{scan.security_score}/100</b> ·
  Optimization score: <b>{scan.optimization_score}/100</b> ·
  Completeness score: <b>{scan.completeness_score}/100</b><br>
  {scan.files} files · {scan.segment_total} segments · {len(findings)} findings
</div>
<p>{escape(scan.executive_summary or '')}</p>
<table><thead><tr><th>ID</th><th>Severity</th><th>Category</th><th>Location</th><th>Fix</th></tr></thead>
<tbody>{rows}</tbody></table>
</body></html>"""


def export_pdf(scan: Scan, findings: list[Finding]) -> tuple[bytes, str]:
    html = _report_html(scan, findings)
    try:
        from weasyprint import HTML  # type: ignore
    except Exception:
        # WeasyPrint (or its native deps) unavailable — serve the HTML report.
        return html.encode("utf-8"), "html"
    pdf = HTML(string=html).write_pdf()
    return pdf, "pdf"


EXPORTERS = {
    "json": export_json,
    "csv": export_csv,
    "pdf": export_pdf,
}
