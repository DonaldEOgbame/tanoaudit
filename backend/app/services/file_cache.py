"""On-disk cache of a scan's source files.

GitHub scans can re-fetch a file from the API for fix/implementation context;
ZIP and URL scans have no remote to re-fetch from once the workdir is gone. So at
ingestion we copy the (text) source files into a per-scan cache dir and stamp
`scan.file_cache_path`. Fix/implementation generation reads full-file context
from here when GitHub isn't the source.

The cache is removed when the scan is deleted; a TTL sweep (worker) cleans up any
caches orphaned by a crash. Content is keyed by the file's repo-relative path.
"""
from __future__ import annotations

import logging
import os
import shutil
import time

from app.core.config import settings

logger = logging.getLogger("akira.file_cache")

# Skip very large files — fix context only needs ordinary source files, and we
# don't want to balloon disk on a vendored blob that slipped past ingestion.
_MAX_FILE_BYTES = 1_000_000


def _cache_root() -> str:
    # Sibling of the export dir, under the app's storage area.
    return os.path.join(os.path.dirname(settings.export_dir.rstrip("/")) or ".", "scan_cache")


def cache_dir_for(scan_id: str) -> str:
    return os.path.join(_cache_root(), scan_id)


def cache_files(scan_id: str, files) -> str | None:
    """Copy each SourceFile's content into the scan's cache dir.

    `files` is an iterable of objects with `.rel_path` and `.abs_path`. Returns
    the cache base path (to store on the scan), or None if nothing was cached.
    Best-effort: a single unreadable file is skipped, not fatal.
    """
    base = cache_dir_for(scan_id)
    cached = 0
    for f in files:
        try:
            if os.path.getsize(f.abs_path) > _MAX_FILE_BYTES:
                continue
            dest = os.path.join(base, f.rel_path)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copyfile(f.abs_path, dest)
            cached += 1
        except (OSError, ValueError) as exc:
            logger.debug("file_cache skip %s: %s", getattr(f, "rel_path", "?"), exc)
    if cached == 0:
        return None
    logger.info("file_cache: stored %d files for scan %s", cached, scan_id)
    return base


def read_cached_file(scan, rel_path: str) -> str | None:
    """Read a cached file's text by its repo-relative path. None if absent."""
    base = getattr(scan, "file_cache_path", None)
    if not base:
        return None
    path = os.path.join(base, rel_path)
    # Guard against path traversal via a crafted rel_path.
    if not os.path.realpath(path).startswith(os.path.realpath(base)):
        return None
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return None


def clear_cache(scan) -> None:
    """Remove a scan's cache dir (called on scan delete). Best-effort."""
    base = getattr(scan, "file_cache_path", None)
    if base and os.path.isdir(base):
        shutil.rmtree(base, ignore_errors=True)


def sweep_expired() -> int:
    """Remove cache dirs older than the configured TTL. Returns count removed."""
    root = _cache_root()
    if not os.path.isdir(root):
        return 0
    cutoff = time.time() - settings.file_cache_ttl_days * 86400
    removed = 0
    for name in os.listdir(root):
        path = os.path.join(root, name)
        try:
            if os.path.isdir(path) and os.path.getmtime(path) < cutoff:
                shutil.rmtree(path, ignore_errors=True)
                removed += 1
        except OSError:
            pass
    return removed
