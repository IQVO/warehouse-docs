#!/usr/bin/env python3
"""Fleet pin-drift report (read-only).

Every consumer repo in the IQVO org pins producers' native specs as byte-copies,
registered in `contracts/pinned.json` (docs/architecture/consumer-contract-testing.md,
CCT-1/CCT-2). The consumer's own CI gate (`scripts/harness/pinned_contract_gate.py`)
fails when a pin differs from the producer's file, but only when some PR runs it, so a
stale pin is otherwise discovered by an UNRELATED consumer PR going red. This script
scans the whole fleet at once and reports which pins are stale.

For every repo of the org with `contracts/pinned.json` on its `develop`, each pin's local
copy is compared byte-for-byte with the producer's file at `pin.ref`. Everything is read
through `gh api` (no clones), so the answer is origin truth, not a stale working tree.

Output (deterministic: sorted, no timestamps):
  * Markdown report on stdout, grouped by PRODUCER and by CONSUMER; SELF pins flagged;
    unreadable pins (producer path deleted/renamed, pin copy missing, bad pinned.json)
    in their own section; every drifted pin carries a +/- line stat from the pin to the
    producer's file, so a comment-only change can be told from a schema change.
  * `--json FILE` writes the same data as JSON (adds `clean`).

Exit codes: 0 whenever the scan ran (drift is reported, never a failure: this is a sensor,
not a gate); 2 when the GitHub API/auth failed, so the report cannot be trusted.

Stdlib only; needs the `gh` CLI and a token (GH_TOKEN / GITHUB_TOKEN, or `gh auth login`).
Public repositories need no extra scope.

    python3 scripts/pin-drift-report.py                  # report on stdout
    python3 scripts/pin-drift-report.py --json out.json  # + machine-readable copy
"""
import argparse
import difflib
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote

ORG = "IQVO"
CONSUMER_REF = "develop"
PINNED = "contracts/pinned.json"
RUNBOOK = "docs/architecture/consumer-contract-testing.md#refresh-runbook"


class ApiError(RuntimeError):
    """The GitHub API (or gh itself) failed in a way that is not a plain 404."""


# ---- I/O (the only impure part; tests inject fakes with the same shape) ------------------------

def gh_api(args):
    try:
        r = subprocess.run(["gh", "api", *args], capture_output=True, text=True)
    except FileNotFoundError as e:
        raise ApiError("the `gh` CLI is not installed") from e
    return r


def list_repos(org=ORG):
    """-> sorted names of the org's non-archived repos."""
    r = gh_api(["--paginate", f"orgs/{org}/repos?per_page=100&type=all",
                "--jq", ".[] | select(.archived | not) | .name"])
    if r.returncode != 0:
        raise ApiError(f"listing {org} repos failed: {r.stderr.strip() or r.stdout.strip()}")
    return sorted({x for x in r.stdout.split() if x})


def read_file(repo, path, ref):
    """-> file text, or None when the path/ref does not exist (HTTP 404). `repo` is `org/name`.
    Any other failure (auth, rate limit, 5xx, network) raises ApiError."""
    url = f"repos/{repo}/contents/{quote(path, safe='/')}?ref={quote(ref, safe='')}"
    r = gh_api(["-H", "Accept: application/vnd.github.raw", url])
    if r.returncode == 0:
        return r.stdout
    err = (r.stderr or r.stdout).strip()
    if "HTTP 404" in err or "Not Found" in err:
        return None
    raise ApiError(f"reading {repo}:{path}@{ref} failed: {err}")


# ---- pure functions ----------------------------------------------------------------------------

def parse_pins(text):
    """-> (pins, error). `pins` is the list of {local, repo, path, ref} dicts; when the file is
    not usable (bad JSON, no `pins` list, an entry missing a field) -> ([], reason)."""
    try:
        doc = json.loads(text)
    except json.JSONDecodeError as e:
        return [], f"pinned.json is not valid JSON ({e.msg} at line {e.lineno})"
    pins = doc.get("pins") if isinstance(doc, dict) else None
    if not isinstance(pins, list):
        return [], "pinned.json has no `pins` list"
    for i, p in enumerate(pins):
        if not isinstance(p, dict) or not all(isinstance(p.get(k), str) and p[k] for k in ("local", "repo", "path", "ref")):
            return [], f"pins[{i}] lacks one of local/repo/path/ref"
    return pins, None


def _norm(text):
    """Comment-insensitive form: trailing whitespace, blank lines and `#` comment lines removed."""
    return [ln.rstrip() for ln in text.splitlines() if ln.strip() and not ln.lstrip().startswith("#")]


def diff_stat(pin_text, producer_text):
    """-> {added, removed, cosmetic}: lines the refresh would add to / remove from the pin.
    `cosmetic` is a heuristic: True when only comments, blank lines or trailing whitespace differ."""
    added = removed = 0
    for ln in difflib.unified_diff(pin_text.splitlines(), producer_text.splitlines(), lineterm="", n=0):
        if ln.startswith("+++") or ln.startswith("---"):
            continue
        if ln.startswith("+"):
            added += 1
        elif ln.startswith("-"):
            removed += 1
    return {"added": added, "removed": removed, "cosmetic": _norm(pin_text) == _norm(producer_text)}


def check_pin(consumer, pin, fetch):
    """Compare one pin. `fetch(repo, path, ref)` -> text or None. -> a result dict:
    status `ok` | `drift` | `unreadable`; unreadable carries `reason`, drift carries `stat`."""
    producer = pin["repo"]
    res = {"consumer": consumer, "local": pin["local"], "producer": producer, "path": pin["path"],
           "ref": pin["ref"], "self": producer.split("/")[-1] == consumer}
    pin_text = fetch(f"{ORG}/{consumer}", pin["local"], CONSUMER_REF)
    prod_text = fetch(producer, pin["path"], pin["ref"])
    if prod_text is None:
        res.update(status="unreadable", reason="producer file missing (deleted, renamed or wrong ref)")
    elif pin_text is None:
        res.update(status="unreadable", reason=f"pin copy missing in the consumer's {CONSUMER_REF}")
    elif pin_text == prod_text:
        res["status"] = "ok"
    else:
        res.update(status="drift", stat=diff_stat(pin_text, prod_text))
    return res


def scan_repo(consumer, fetch):
    """-> (pin_count, [non-ok result dicts]) or None when the repo carries no pinned.json."""
    text = fetch(f"{ORG}/{consumer}", PINNED, CONSUMER_REF)
    if text is None:
        return None
    pins, error = parse_pins(text)
    if error:
        return 0, [{"consumer": consumer, "local": PINNED, "producer": "", "path": "", "ref": "",
                    "self": False, "status": "unreadable", "reason": error}]
    results = [check_pin(consumer, p, fetch) for p in pins]
    return len(pins), [r for r in results if r["status"] != "ok"]


def build_report(repos, fetch, workers=8):
    """Scan every repo. -> report dict (pure given `fetch`)."""
    with ThreadPoolExecutor(workers) as ex:
        scanned = list(ex.map(lambda r: (r, scan_repo(r, fetch)), repos))
    with_pins = [(r, s) for r, s in scanned if s is not None]
    problems = [x for _, (_, bad) in with_pins for x in bad]
    drifted = sorted((x for x in problems if x["status"] == "drift"), key=_pin_key)
    unreadable = sorted((x for x in problems if x["status"] == "unreadable"), key=_pin_key)
    return {
        "summary": {"repos_scanned": len(repos), "repos_with_pins": len(with_pins),
                    "pins": sum(n for _, (n, _) in with_pins),
                    "drifted_pins": len(drifted),
                    "drifted_consumers": len({x["consumer"] for x in drifted}),
                    "unreadable_pins": len(unreadable)},
        "clean": not drifted and not unreadable,
        "drifted": drifted,
        "unreadable": unreadable,
        "by_producer": group_by_producer(drifted),
        "by_consumer": group_by_consumer(drifted),
    }


def _pin_key(x):
    return (x["consumer"], x["producer"], x["path"], x["local"])


def group_by_producer(drifted):
    """-> [{producer, path, consumers: [consumer,...]}] sorted; one entry per producer spec."""
    groups = {}
    for x in drifted:
        groups.setdefault((x["producer"], x["path"]), set()).add(x["consumer"])
    return [{"producer": p, "path": path, "consumers": sorted(c)} for (p, path), c in sorted(groups.items())]


def group_by_consumer(drifted):
    """-> [{consumer, pins: [{producer, path, local, self, added, removed, cosmetic}]}] sorted."""
    groups = {}
    for x in drifted:
        s = x["stat"]
        groups.setdefault(x["consumer"], []).append(
            {"producer": x["producer"], "path": x["path"], "local": x["local"], "self": x["self"],
             "added": s["added"], "removed": s["removed"], "cosmetic": s["cosmetic"]})
    return [{"consumer": c, "pins": sorted(p, key=lambda y: (y["producer"], y["path"], y["local"]))}
            for c, p in sorted(groups.items())]


def _stat(s):
    return f"+{s['added']}/-{s['removed']}" + (" (comments/whitespace only)" if s["cosmetic"] else "")


def render_markdown(report):
    """-> the Markdown report (deterministic for a given report)."""
    s = report["summary"]
    out = ["# Pin drift report", ""]
    out.append(f"Scanned {s['repos_scanned']} repositories in `{ORG}`; {s['repos_with_pins']} carry "
               f"`{PINNED}` on `{CONSUMER_REF}` ({s['pins']} pins). Each pin copy is compared byte-for-byte "
               f"with the producer's file at `pin.ref`; `+/-` counts the lines a refresh would add to / remove "
               f"from the pin.")
    out.append("")
    if report["clean"]:
        out += ["**Status: CLEAN** — every pin equals its producer's file.", ""]
    else:
        out.append(f"**Status: DRIFT** — {s['drifted_pins']} drifted pin(s) in {s['drifted_consumers']} "
                   f"consumer(s); {s['unreadable_pins']} unreadable pin(s).")
        out.append("")
    if report["drifted"]:
        out += ["## Drifted pins by producer", ""]
        bp = {(g["producer"], g["path"]): g for g in report["by_producer"]}
        stats = {(x["consumer"], x["producer"], x["path"]): x["stat"] for x in report["drifted"]}
        for (producer, path), g in sorted(bp.items()):
            out += [f"### `{producer}` `{path}` — {len(g['consumers'])} consumer(s)", ""]
            out += ["| Consumer | Change | Self pin |", "|---|---|---|"]
            for c in g["consumers"]:
                st = stats[(c, producer, path)]
                selfpin = "SELF" if c == producer.split("/")[-1] else ""
                out.append(f"| `{c}` | {_stat(st)} | {selfpin} |")
            out.append("")
        out += ["## Drifted pins by consumer", ""]
        out += ["| Consumer | Pin copy | Producer file | Change | Self pin |", "|---|---|---|---|---|"]
        for g in report["by_consumer"]:
            for p in g["pins"]:
                out.append(f"| `{g['consumer']}` | `{p['local']}` | `{p['producer']}` `{p['path']}` | "
                           f"{_stat(p)} | {'SELF' if p['self'] else ''} |")
        out.append("")
        if any(x["self"] for x in report["drifted"]):
            out += ["A SELF pin is a spec the repo pins from itself: it goes stale right after its own spec change "
                    "merges (the gate compares with `develop`), so refresh it in a follow-up PR.", ""]
    out += ["## Unreadable pins", ""]
    if report["unreadable"]:
        out += ["A pin the scan could not compare; the producer path was deleted or renamed, or the pin file is missing "
                "or malformed. These need a human decision, not a copy.", ""]
        out += ["| Consumer | Pin copy | Producer file | Reason |", "|---|---|---|---|"]
        for x in report["unreadable"]:
            prod = f"`{x['producer']}` `{x['path']}`@`{x['ref']}`" if x["producer"] else ""
            out.append(f"| `{x['consumer']}` | `{x['local']}` | {prod} | {x['reason']} |")
    else:
        out.append("None.")
    out.append("")
    if not report["clean"]:
        out += ["## Refresh", "",
                f"Refresh is a byte-copy of the producer's file, one PR per consumer, never hand-edited: see the "
                f"refresh runbook (`{RUNBOOK}`). Informational: refresh a stale pin before the next unrelated "
                f"consumer PR needs to merge.", ""]
    return "\n".join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--json", metavar="FILE", help="also write the report as JSON")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args(argv)
    try:
        report = build_report(list_repos(), read_file, args.workers)
    except ApiError as e:
        print(f"pin-drift-report: {e}", file=sys.stderr)
        return 2
    if args.json:
        with open(args.json, "w") as f:
            json.dump(report, f, indent=1, sort_keys=True)
            f.write("\n")
    print(render_markdown(report))
    return 0


if __name__ == "__main__":
    sys.exit(main())
