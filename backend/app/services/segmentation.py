"""Segmentation: split each file into SEGMENTS (50–200 lines of logical units).

A SEGMENT is the unit everywhere — never "chunk". Tree-sitter is used when
available to cut on function/class boundaries; otherwise (and as a fallback for
parse failures) we use overlapping sliding windows. Each segment carries a
content hash to enable incremental re-scans.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass

from app.services.ingestion import SourceFile

TARGET_MIN_LINES = 50
TARGET_MAX_LINES = 200
WINDOW_OVERLAP = 10


@dataclass
class SegmentData:
    file_path: str
    language: str | None
    line_start: int  # 1-based, inclusive
    line_end: int
    content: str
    content_hash: str


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", "replace")).hexdigest()


def _window(file: SourceFile, lines: list[str]) -> list[SegmentData]:
    """Sliding-window segmentation with small overlap for boundary context."""
    segments: list[SegmentData] = []
    n = len(lines)
    if n == 0:
        return segments
    step = TARGET_MAX_LINES - WINDOW_OVERLAP
    start = 0
    while start < n:
        end = min(start + TARGET_MAX_LINES, n)
        body = "\n".join(lines[start:end])
        segments.append(
            SegmentData(
                file_path=file.rel_path,
                language=file.language,
                line_start=start + 1,
                line_end=end,
                content=body,
                content_hash=content_hash(body),
            )
        )
        if end == n:
            break
        start += step
    return segments


def segment_file(file: SourceFile) -> list[SegmentData]:
    """Return segments for one file. Tree-sitter when present, else windowing."""
    try:
        with open(file.abs_path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except OSError:
        return []

    lines = text.splitlines()
    if not lines:
        return []

    # Tree-sitter path is optional; if unavailable, fall straight through to
    # sliding-window segmentation, which is always correct (if coarser).
    ts_segments = _try_tree_sitter(file, lines)
    if ts_segments is not None:
        return ts_segments
    return _window(file, lines)


def _try_tree_sitter(file: SourceFile, lines: list[str]) -> list[SegmentData] | None:
    """Attempt boundary-aware segmentation. Returns None if TS isn't usable."""
    try:
        from app.services.tree_sitter_support import segment_with_tree_sitter
    except Exception:
        return None
    try:
        return segment_with_tree_sitter(file, lines)
    except Exception:
        # Any parse failure falls back to windowing.
        return None


def segment_files(files: list[SourceFile]) -> list[SegmentData]:
    out: list[SegmentData] = []
    for f in files:
        out.extend(segment_file(f))
    return out
