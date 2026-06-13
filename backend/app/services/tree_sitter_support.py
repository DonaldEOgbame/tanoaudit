"""Tree-sitter boundary-aware segmentation.

Cuts files on logical units (functions, classes, methods) using
tree-sitter-language-pack grammars. Written defensively so it works across the
two common binding flavours: attributes-as-properties (py-tree-sitter) and
attributes-as-methods (the Rust-style binding shipped on some platforms).

If grammars or the package aren't available, `segmentation._try_tree_sitter`
catches the import/parse error and falls back to sliding windows.
"""
from __future__ import annotations

from app.services.ingestion import SourceFile
from app.services.segmentation import SegmentData, content_hash

# Map our detected language -> tree-sitter grammar name.
_GRAMMAR = {
    "python": "python", "javascript": "javascript", "typescript": "typescript",
    "java": "java", "go": "go", "ruby": "ruby", "php": "php", "csharp": "csharp",
    "c": "c", "cpp": "cpp", "rust": "rust", "kotlin": "kotlin", "swift": "swift",
    "scala": "scala", "bash": "bash",
}

# Node kinds large enough to be worth splitting into per-child segments.
_CONTAINER_KINDS = {
    "class_definition", "class_declaration", "class_body",
    "impl_item", "trait_item", "module", "namespace_declaration",
}

# Reuse the window targets from segmentation.
from app.services.segmentation import (  # noqa: E402
    TARGET_MAX_LINES,
    TARGET_MIN_LINES,
)


def _call(obj, name):
    """Read attribute `name` whether it's a property or a zero-arg method."""
    val = getattr(obj, name)
    return val() if callable(val) else val


def _root(parser, text: str):
    # py-tree-sitter wants bytes; the Rust-style binding wants str.
    try:
        tree = parser.parse(text.encode("utf-8"))
    except TypeError:
        tree = parser.parse(text)
    rn = getattr(tree, "root_node")
    return rn() if callable(rn) else rn


def _kind(node) -> str:
    # py-tree-sitter: node.type ; rust binding: node.kind()
    if hasattr(node, "type"):
        return _call(node, "type")
    return _call(node, "kind")


def _row(point) -> int:
    # Point.row attribute (both bindings) or tuple (row, col).
    if hasattr(point, "row"):
        return _call(point, "row")
    return point[0]


def _start_row(node) -> int:
    p = node.start_position if hasattr(node, "start_position") else node.start_point
    return _row(p() if callable(p) else p)


def _end_row(node) -> int:
    p = node.end_position if hasattr(node, "end_position") else node.end_point
    return _row(p() if callable(p) else p)


def _named_children(node) -> list:
    count = _call(node, "named_child_count")
    out = []
    for i in range(count):
        child_fn = getattr(node, "named_child")
        out.append(child_fn(i))
    return out


def _leaf_regions(node, depth: int = 0) -> list[tuple[int, int]]:
    """Return (start_row, end_row) regions covering ALL of `node`'s top-level
    children. Large container nodes (classes/modules) are recursed into so big
    files split on method boundaries; everything else is taken whole. This
    guarantees full file coverage — no code is ever dropped."""
    regions: list[tuple[int, int]] = []
    for child in _named_children(node):
        s, e = _start_row(child), _end_row(child)
        if e < s:
            continue
        if depth < 2 and _kind(child) in _CONTAINER_KINDS and (e - s) > TARGET_MAX_LINES:
            inner = _leaf_regions(child, depth + 1)
            regions.extend(inner or [(s, e)])
        else:
            regions.append((s, e))
    return regions


def segment_with_tree_sitter(file: SourceFile, lines: list[str]) -> list[SegmentData] | None:
    """Return boundary-aware segments covering the whole file, or None to fall
    back to windowing."""
    grammar = _GRAMMAR.get(file.language or "")
    if grammar is None:
        return None

    from tree_sitter_language_pack import get_parser  # may raise -> caught upstream

    parser = get_parser(grammar)
    text = "\n".join(lines)
    root = _root(parser, text)

    regions = _leaf_regions(root)
    if not regions:
        return None  # nothing structural -> let windowing handle it
    regions.sort()

    n = len(lines)
    segments: list[SegmentData] = []

    def flush(start_row: int, end_row: int) -> None:
        start_row = max(0, start_row)
        end_row = min(n - 1, end_row)
        if end_row < start_row:
            return
        body = "\n".join(lines[start_row : end_row + 1])
        if not body.strip():
            return
        segments.append(SegmentData(
            file_path=file.rel_path, language=file.language,
            line_start=start_row + 1, line_end=end_row + 1,
            content=body, content_hash=content_hash(body),
        ))

    # Greedily pack adjacent regions into segments up to the max-line target,
    # covering the gaps between regions too (so nothing is missed).
    seg_start, seg_end = regions[0]
    for s, e in regions[1:]:
        if (e - seg_start) <= TARGET_MAX_LINES or (seg_end - seg_start) < TARGET_MIN_LINES:
            seg_end = max(seg_end, e)
        else:
            flush(seg_start, s - 1)   # include the gap up to the next region
            seg_start, seg_end = s, e
    flush(seg_start, n - 1)           # final segment runs to EOF
    return segments or None
