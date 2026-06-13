"""Vulnerability taxonomy categories + dynamic slicing per file.

The full taxonomy (20 categories, 187+ classes) is seeded into the Learning Hub
(Module 14). For prompts we only need category labels and dynamic selection so we
never ship the whole taxonomy per segment.
"""
from __future__ import annotations

# 20 top-level security categories.
CATEGORIES = [
    "Authentication & Authorization",
    "Injection",
    "Data Exposure & Secrets",
    "Input Validation & Sanitization",
    "API Security",
    "Database & Storage",
    "Dependency & Supply Chain",
    "Configuration & Infrastructure",
    "Business Logic",
    "Cryptography",
    "AI-Generated Code Specific",
    "Frontend Specific",
    "Concurrency & Race Conditions",
    "Error Handling & Logging",
    "Memory & Resource Management",
    "Deserialization",
    "Cloud & Serverless",
    "Mobile & Cross-Platform",
    "WebSocket & Real-Time",
    "Third-Party Integration & Webhooks",
]

OPTIMIZATION_CATEGORIES = [
    "Performance", "Code Quality", "Scalability", "Dependency Optimization",
]


def slice_taxonomy(file_path: str, language: str | None) -> list[str]:
    """Return the security categories to send for this file.

    Previously this filtered the taxonomy down to a 5-category base plus
    filename/path heuristics. That dropped recall in two ways: bland filenames
    got only the base set, and several categories (Concurrency, Memory &
    Resource Management, Mobile, Dependency & Supply Chain) were never reachable
    by any heuristic. Sending all 20 category *labels* costs ~20 prompt lines
    (not the full 187-class taxonomy) and removes both blind spots, so we no
    longer slice. The signature is kept for callers/tests.
    """
    return list(CATEGORIES)
