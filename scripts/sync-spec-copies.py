#!/usr/bin/env python3
"""Refresh every spec copy the develop-drift gate compares, from each producer's develop.

The copies under apis/, network/apis/, storefront/apis/ and yard/apis/ must equal what
scripts/check-develop-drift.py expects (develop's bytes plus its one link transformation). This script
writes exactly that, using the gate's own discovery, fetcher and `expected_copy`, so a refresh can never
disagree with the gate. It only writes copies: route-missing / retired-shape findings on pages, and a copy
whose producer no longer ships the file, need a human (they are reported, never deleted or edited).

Usage: sync-spec-copies.py [--root .] [--from-dir DIR]  (DIR: offline <dir>/<repo>/apis/..., as the gate)
Exit:  0 done (prints `changed <path>` per rewritten copy, or NO-DRIFT), 2 a producer could not be read,
       3 usage error.
After a change: `npm run clean-api-docs:*` + `npm run build` regenerate the committed REST/AsyncAPI pages
(.claude/rules/spec-sync.md); the specs-refresh workflow runs the whole sequence.
"""
from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_gate():
    spec = importlib.util.spec_from_file_location("check_develop_drift", HERE / "check-develop-drift.py")
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def sync(root: Path, gate, fetch) -> tuple[list[str], list[str]]:
    """-> (rewritten copy paths, copies whose producer has no such file on develop)."""
    contexts = [c for c in gate.discover_contexts(root) if not c.get("route_only")]
    develop = gate.fetch_develop(contexts, fetch)
    changed, orphaned = [], []
    for c in contexts:
        copy_dir = root / c["copy_dir"]
        have = {p.name for p in copy_dir.glob("*.yaml")}
        for name in sorted(have | set(c["expect"])):
            dev = develop[c["repo"]].get(name)
            target = copy_dir / name
            rel = f"{c['copy_dir']}/{name}"
            if dev is None:
                if target.is_file():
                    orphaned.append(rel)
                continue
            want = gate.expected_copy(c["repo"], dev)
            if not target.is_file() or target.read_bytes() != want:
                target.write_bytes(want)
                changed.append(rel)
    return changed, orphaned


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=str(HERE.parent))
    ap.add_argument("--from-dir", help="offline: read develop files from <dir>/<repo>/apis/... instead of GitHub")
    a = ap.parse_args(argv)
    gate = load_gate()
    fetch = gate.dir_fetcher(a.from_dir) if a.from_dir else gate.GithubFetcher()
    try:
        changed, orphaned = sync(Path(a.root), gate, fetch)
    except gate.Unreadable as e:
        print(f"UNREADABLE PRODUCER: {e}: nothing written for certain, rerun", file=sys.stderr)
        return gate.EXIT_UNREADABLE
    for p in changed:
        print(f"changed {p}")
    for p in orphaned:
        print(f"no-producer-file {p} (the producer dropped it: a human decides, the gate stays red)")
    if not changed:
        print("NO-DRIFT")
    return 0


if __name__ == "__main__":
    sys.exit(main())
