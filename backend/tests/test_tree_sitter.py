"""Tree-sitter boundary-aware segmentation tests (with windowing fallback)."""
import pytest

from app.services.ingestion import SourceFile
from app.services.segmentation import segment_file

try:
    import tree_sitter_language_pack  # noqa: F401
    HAS_TS = True
except Exception:
    HAS_TS = False


def _write(tmp_path, name, code):
    p = tmp_path / name
    p.write_text(code)
    lang = {".py": "python", ".js": "javascript"}.get("." + name.split(".")[-1])
    return SourceFile(rel_path=name, abs_path=str(p), language=lang)


def _covers_all_lines(segs, total_lines: int) -> bool:
    """Every source line must appear in some segment (no dropped code)."""
    covered = set()
    for s in segs:
        covered.update(range(s.line_start, s.line_end + 1))
    return all(ln in covered for ln in range(1, total_lines + 1))


@pytest.mark.skipif(not HAS_TS, reason="tree-sitter not installed")
def test_python_segmentation_covers_whole_file(tmp_path):
    code = (
        "import os\n\n"
        "def alpha(x):\n    return x + 1\n\n\n"
        "class Service:\n    def run(self):\n        return 1\n\n\n"
        "def beta(y):\n    return y * 2\n"
    )
    sf = _write(tmp_path, "svc.py", code)
    segs = segment_file(sf)
    assert segs and all(s.content_hash for s in segs)
    assert _covers_all_lines(segs, len(code.splitlines()))


@pytest.mark.skipif(not HAS_TS, reason="tree-sitter not installed")
def test_call_expression_handlers_are_not_dropped(tmp_path):
    # Regression: Express-style route handlers are call expressions, not
    # function/class declarations. They must still be covered by a segment.
    code = (
        "const router = require('express').Router();\n"
        "router.get('/search', async (req, res) => {\n"
        "  const sql = `SELECT * FROM products WHERE name='${req.query.q}'`;\n"
        "  res.json(await db.raw(sql));\n"
        "});\n"
        "module.exports = router;\n"
    )
    sf = _write(tmp_path, "products.js", code)
    segs = segment_file(sf)
    assert _covers_all_lines(segs, len(code.splitlines()))
    # The vulnerable line must be inside some segment's content.
    assert any("SELECT * FROM products" in s.content for s in segs)


@pytest.mark.skipif(not HAS_TS, reason="tree-sitter not installed")
def test_large_file_splits_into_multiple_segments(tmp_path):
    # ~30 functions of ~12 lines each (~360 lines) should split on boundaries.
    blocks = []
    for i in range(30):
        blocks.append(
            f"def func_{i}(x):\n" + "".join(f"    y{j} = x + {j}\n" for j in range(10)) + f"    return y0\n"
        )
    code = "\n\n".join(blocks)
    sf = _write(tmp_path, "big.py", code)
    segs = segment_file(sf)
    assert len(segs) >= 2  # boundary splitting kicks in for large files
    assert _covers_all_lines(segs, len(code.splitlines()))


def test_unstructured_file_falls_back_to_windows(tmp_path):
    # 500 plain assignments: no function/class units -> sliding-window path.
    code = "\n".join(f"x{i} = {i}" for i in range(500))
    sf = _write(tmp_path, "big.py", code)
    segs = segment_file(sf)
    assert len(segs) >= 2  # windowed
    assert segs[0].line_start == 1
