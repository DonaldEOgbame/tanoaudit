"""Scan ingestion: materialise a source (ZIP / git URL) into an isolated temp
dir, then walk it into analysable files.

Security: ZIP extraction is zip-slip-safe and bounded (size + file count);
everything lands in a per-scan temp dir that the caller cleans up.
"""
from __future__ import annotations

import asyncio
import os
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path

from app.core.errors import bad_request

# Limits
MAX_ZIP_BYTES = 100 * 1024 * 1024  # 100 MB compressed
MAX_FILES = 10_000
MAX_FILE_BYTES = 1 * 1024 * 1024  # skip files larger than 1 MB

# Default excludes (dirs and exact filenames/suffixes).
EXCLUDE_DIRS = {
    "node_modules", "dist", "build", ".git", "__pycache__", "vendor",
    ".venv", "venv", ".next", ".cache", "coverage", ".pytest_cache",
}
EXCLUDE_SUFFIXES = {
    ".lock", ".min.js", ".min.css", ".map",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".pdf", ".zip", ".gz", ".tar", ".woff", ".woff2", ".ttf", ".eot",
    ".mp4", ".mp3", ".mov", ".wasm", ".so", ".dll", ".dylib", ".bin",
    ".pyc", ".class", ".o",
}
EXCLUDE_NAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
    "Cargo.lock", "composer.lock", "Gemfile.lock",
}

# Extension -> language (subset; extend freely).
LANG_BY_EXT = {
    ".py": "python", ".js": "javascript", ".jsx": "javascript",
    ".ts": "typescript", ".tsx": "typescript", ".java": "java",
    ".go": "go", ".rb": "ruby", ".php": "php", ".cs": "csharp",
    ".c": "c", ".h": "c", ".cpp": "cpp", ".cc": "cpp", ".rs": "rust",
    ".kt": "kotlin", ".swift": "swift", ".scala": "scala",
    ".sql": "sql", ".sh": "bash", ".yaml": "yaml", ".yml": "yaml",
    ".json": "json", ".tf": "hcl", ".html": "html", ".css": "css",
}


@dataclass
class SourceFile:
    rel_path: str
    abs_path: str
    language: str | None


def detect_language(path: str) -> str | None:
    return LANG_BY_EXT.get(Path(path).suffix.lower())


def _is_excluded(rel: str, extra_globs: list[str]) -> bool:
    parts = Path(rel).parts
    if any(p in EXCLUDE_DIRS for p in parts):
        return True
    name = Path(rel).name
    if name in EXCLUDE_NAMES:
        return True
    suffix = Path(rel).suffix.lower()
    if name.endswith(".min.js") or name.endswith(".min.css"):
        return True
    if suffix in EXCLUDE_SUFFIXES:
        return True
    for pattern in extra_globs:
        if Path(rel).match(pattern):
            return True
    return False


def _looks_binary(abs_path: str) -> bool:
    try:
        with open(abs_path, "rb") as f:
            chunk = f.read(2048)
        return b"\x00" in chunk
    except OSError:
        return True


def extract_zip(data: bytes, dest: str) -> None:
    """Zip-slip-safe, bounded extraction into `dest`."""
    if len(data) > MAX_ZIP_BYTES:
        raise bad_request("ZIP exceeds the 100 MB limit")

    import io

    dest_root = Path(dest).resolve()
    dest_root.mkdir(parents=True, exist_ok=True)
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise bad_request("Uploaded file is not a valid ZIP archive")

    members = [m for m in zf.namelist() if not m.endswith("/")]
    if len(members) > MAX_FILES:
        raise bad_request(f"ZIP contains more than {MAX_FILES} files")

    for member in members:
        target = (dest_root / member).resolve()
        # Zip-slip: target must stay within dest_root.
        if not str(target).startswith(str(dest_root) + os.sep):
            raise bad_request("ZIP contains an unsafe path (zip slip)")
        target.parent.mkdir(parents=True, exist_ok=True)
        with zf.open(member) as src, open(target, "wb") as out:
            out.write(src.read())


CLONE_TIMEOUT_S = 120


async def clone_repo(url: str, dest: str, branch: str | None = None) -> None:
    """Shallow-clone a git URL into `dest`, with a hard timeout.

    Without the timeout a network stall (unreachable host, hung transfer) would
    block the scan — and the worker — forever.
    """
    args = ["git", "clone", "--depth", "1"]
    if branch:
        args += ["--branch", branch]
    args += [url, dest]
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=CLONE_TIMEOUT_S)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise bad_request(f"Repository clone timed out after {CLONE_TIMEOUT_S}s")
    if proc.returncode != 0:
        raise bad_request(f"Could not clone repository: {stderr.decode()[:200]}")


async def git_head_commit(path: str) -> str | None:
    proc = await asyncio.create_subprocess_exec(
        "git", "-C", path, "rev-parse", "--short", "HEAD",
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
    )
    out, _ = await proc.communicate()
    commit = out.decode().strip()
    return commit or None


def walk_source(root: str, ignore_globs: list[str] | None = None) -> list[SourceFile]:
    """Walk `root`, returning analysable files (excludes + binary filtered)."""
    ignore_globs = ignore_globs or []
    files: list[SourceFile] = []
    root_path = Path(root)

    for dirpath, dirnames, filenames in os.walk(root):
        # Prune excluded dirs in-place for efficiency.
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fname in filenames:
            abs_path = os.path.join(dirpath, fname)
            rel = os.path.relpath(abs_path, root_path)
            if _is_excluded(rel, ignore_globs):
                continue
            try:
                if os.path.getsize(abs_path) > MAX_FILE_BYTES:
                    continue
            except OSError:
                continue
            if _looks_binary(abs_path):
                continue
            files.append(
                SourceFile(rel_path=rel, abs_path=abs_path, language=detect_language(rel))
            )
            if len(files) >= MAX_FILES:
                return files
    return files


def make_scan_workdir() -> str:
    return tempfile.mkdtemp(prefix="akira_scan_")


def scan_upload_dir(scan_id: str) -> str:
    """Deterministic, scan-id-keyed dir for uploaded ZIP sources.

    Lives under a shared storage root (sibling of the export dir) rather than a
    process-local temp dir, so an arq worker in a separate process/host can read
    the extracted files. The path is reconstructable from the scan id alone, so
    ZIP scans flow through the same `run_scan_task(scan_id)` enqueue as
    github/url scans — no workdir argument that wouldn't survive a process hop.
    """
    from app.core.config import settings

    root = os.path.join(
        os.path.dirname(settings.export_dir.rstrip("/")) or ".", "scan_uploads"
    )
    return os.path.join(root, scan_id)
