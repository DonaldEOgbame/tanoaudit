"""Run a full, real scan from the command line and print timing + findings.

This drives the whole pipeline in-process (no API server, no Redis, no arq
worker needed) so you can run a real scan on your own machine and see exactly
how it performs — wall-clock time, how many LLM requests batching collapsed it
to, and the findings.

USAGE
-----
From the backend/ directory, with the venv active and a real provider key set:

  # A local directory (fastest to try — no clone, no GitHub needed):
  python -m scripts.run_full_scan --dir /path/to/some/project

  # A public git URL:
  python -m scripts.run_full_scan --url https://github.com/org/repo.git

  # A private GitHub repo (needs a connected GitHub account — see --github-token):
  python -m scripts.run_full_scan --repo owner/name --github-token ghp_xxx

  # A ZIP file:
  python -m scripts.run_full_scan --zip /path/to/project.zip

PROVIDER KEY
------------
The scan uses a per-user stored key. This script seeds a throwaway user with the
key from --openrouter-key, or $OPENROUTER_KEY, or DEMO_OPENROUTER_KEY in .env.
Use --gemini-key / $GEMINI_KEY instead to scan with Gemini.

OPTIONS
-------
  --depth fast|deep|thorough   (default: deep)
  --provider openrouter|gemini (default: openrouter)
  --no-optimization            disable the optimization engine
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
import uuid
from collections import Counter

# Make sure we can import the app package when run as a script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def _amain(args) -> int:
    from sqlalchemy import select

    from app.core.config import settings
    from app.core.database import SessionLocal, init_db
    from app.core.security import encrypt_secret
    from app.models.api_key import STATUS_VALID, ApiKey
    from app.models.github import GitHubConnection
    from app.models.scan import Finding, Scan
    from app.models.user import User
    from app.services import llm_clients
    from app.services.orchestrator import run_scan

    # --- resolve the provider key ---
    provider = args.provider
    if provider == "openrouter":
        key = args.openrouter_key or os.environ.get("OPENROUTER_KEY") or settings.demo_openrouter_key
    else:
        key = args.gemini_key or os.environ.get("GEMINI_KEY") or settings.demo_gemini_key
    if not key:
        print(f"ERROR: no {provider} key. Pass --{provider}-key, set ${provider.upper()}_KEY, "
              f"or DEMO_{provider.upper()}_KEY in .env.", file=sys.stderr)
        return 2

    # --- count real LLM requests so you can see the batching effect ---
    counter = {"n": 0}
    completer = getattr(llm_clients, f"complete_{provider}")

    async def counting(k, prompt, model=None):
        counter["n"] += 1
        return await completer(k, prompt, model)

    llm_clients.COMPLETERS[provider] = counting
    setattr(llm_clients, f"complete_{provider}", counting)

    await init_db()

    # --- seed a throwaway user with the key (+ GitHub connection if needed) ---
    async with SessionLocal() as db:
        user = User(email=f"scan-{uuid.uuid4().hex[:8]}@local", password_hash="x", full_name="scan")
        db.add(user)
        await db.flush()
        db.add(ApiKey(
            user_id=user.id, provider=provider, encrypted_key=encrypt_secret(key),
            last_four=key[-4:], status=STATUS_VALID,
        ))
        if args.repo and args.github_token:
            db.add(GitHubConnection(
                user_id=user.id, encrypted_token=encrypt_secret(args.github_token),
                github_username="cli", scopes="repo",
            ))
        scan = Scan(
            user_id=user.id,
            source_type=("github" if args.repo else "url" if args.url else "zip"),
            repo=args.repo or (os.path.basename(args.dir.rstrip("/")) if args.dir else "upload"),
            source_url=args.url,
            depth=args.depth, model_mode="manual", models=[provider],
            include_optimization=not args.no_optimization, include_custom=True,
        )
        db.add(scan)
        await db.flush()
        scan_id = scan.id
        await db.commit()

    # --- run it (a local dir / zip is passed as workdir; github/url clone) ---
    workdir = None
    if args.dir:
        workdir = args.dir
    elif args.zip:
        from app.services import ingestion
        workdir = ingestion.scan_upload_dir(scan_id)
        with open(args.zip, "rb") as fh:
            ingestion.extract_zip(fh.read(), workdir)

    label = args.repo or args.url or args.dir or args.zip
    print(f"Scanning {label}  (depth={args.depth}, provider={provider})\n")
    t0 = time.time()
    try:
        await run_scan(scan_id, workdir=workdir, cleanup=False)
    except Exception:  # noqa: BLE001
        import traceback
        print("!!! run_scan raised:\n" + traceback.format_exc(), file=sys.stderr)
    dt = time.time() - t0

    # --- report ---
    async with SessionLocal() as db:
        scan = await db.get(Scan, scan_id)
        rows = (await db.execute(select(Finding).where(Finding.scan_id == scan_id))).scalars().all()

    print("\n" + "=" * 56)
    print(f"  status        : {scan.status}")
    print(f"  duration      : {dt:.0f}s")
    print(f"  files         : {scan.files}")
    print(f"  segments      : {scan.segment_total}")
    print(f"  analyzed      : {scan.segments_analyzed}")
    print(f"  unparsed      : {scan.segments_unparsed}")
    seg = scan.segment_total or 1
    print(f"  LLM requests  : {counter['n']}   ({seg / max(counter['n'], 1):.1f}x fewer than 1/segment)")
    print(f"  security      : {scan.security_score}")
    print(f"  optimization  : {scan.optimization_score}")
    print(f"  completeness  : {scan.completeness_score}")
    print(f"  worst severity: {scan.worst_severity}")
    print(f"  findings      : {len(rows)}")
    if scan.error:
        print(f"  error         : {scan.error}")
    print("=" * 56)
    if rows:
        by = Counter((f.engine, f.severity) for f in rows)
        for (eng, sev), n in sorted(by.items()):
            print(f"    {eng:12} {sev:8} x{n}")
        print("\n  top findings:")
        order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        for f in sorted(rows, key=lambda f: order.get((f.severity or "").lower(), 9))[:15]:
            print(f"    [{f.severity}] {f.engine}/{f.category} — {f.file}:{f.line_start}")
    print(f"\nScan id: {scan_id}  (GET /api/v1/scans/{scan_id} for the full report)")
    return 0 if scan.status == "completed" else 1


def main() -> int:
    p = argparse.ArgumentParser(description="Run a full Akira scan from the CLI.")
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--dir", help="Scan a local directory (no clone needed)")
    src.add_argument("--url", help="Scan a public git URL")
    src.add_argument("--repo", help="Scan a GitHub repo 'owner/name' (needs --github-token)")
    src.add_argument("--zip", help="Scan a .zip file")
    p.add_argument("--github-token", help="GitHub token for private --repo scans")
    p.add_argument("--openrouter-key", help="OpenRouter key (else $OPENROUTER_KEY / .env)")
    p.add_argument("--gemini-key", help="Gemini key (else $GEMINI_KEY / .env)")
    p.add_argument("--provider", choices=["openrouter", "gemini"], default="openrouter")
    p.add_argument("--depth", choices=["fast", "deep", "thorough"], default="deep")
    p.add_argument("--no-optimization", action="store_true")
    args = p.parse_args()
    return asyncio.run(_amain(args))


if __name__ == "__main__":
    raise SystemExit(main())
