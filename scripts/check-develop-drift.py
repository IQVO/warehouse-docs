#!/usr/bin/env python3
"""Gate: warehouse-docs must agree with every context repo's origin/develop.

The aggregator holds COPIES of each service's contract and hand-written pages that
cite the service's REST routes. Both rot silently when a producer merges to its
`develop`. This script reads `apis/openapi.yaml`, `apis/asyncapi.yaml` and
`apis/openapi-reports.yaml` from `develop` of every context repo and reports:

  spec-drift      a spec copy here is not byte-equal to develop's file
  spec-missing    a copy exists but develop has no such file, or develop has a file
                  the section is expected to carry and the copy is missing
  route-missing   a page cites `METHOD /path` (inline code, table cell, fenced curl
                  example) that is not an operation of the owning context's develop
                  OpenAPI (owner = the page's `contexts/<ctx>/` folder or an explicit
                  `<ctx>:` prefix; pages with no owner must match SOME context)
  retired-shape   a page shows a vocabulary the REST guideline (2026-11-01) retired:
                  `:verb` suffix routes, `X-Action-Id`, `nextToken`, the
                  `purchaseOrders` / `inboundShipments` list envelopes

Exit codes (distinct on purpose, a gate must never pass on a producer it cannot read):
  0  clean
  1  findings
  2  a producer file could not be read (network / auth / 5xx): the gate FAILS
  3  usage / local error

Escape hatches (a page that cites a retired route on purpose):
  `{/* drift-allow: reason */}` at the end of a line allows that line; alone on a line it
  allows the next block (a fence, or lines up to the next blank line);
  `{/* drift-allow-file: reason */}` anywhere allows the whole page;
  a fence whose info string contains the word `historical` is skipped.
ADR bodies (immutable) and generated api-reference output are never scanned.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import difflib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

EXIT_OK, EXIT_FINDINGS, EXIT_UNREADABLE, EXIT_USAGE = 0, 1, 2, 3
ORG = "IQVO"
BRANCH = "develop"
SPEC_NAMES = ("openapi.yaml", "asyncapi.yaml", "openapi-reports.yaml")
# section -> (copy dir, context page dir, spec names the copy dir must carry)
SECTIONS = {
    "wms": ("apis", "docs/contexts", SPEC_NAMES),
    "network": ("network/apis", "network/docs/contexts", ("openapi.yaml",)),
    "storefront": ("storefront/apis", "storefront/docs/contexts", ("openapi.yaml",)),
}
PAGE_ROOTS = ("docs", "network/docs", "storefront/docs")
PAGE_FILES = ("README.md",)
EXCLUDE_DIR_PARTS = ("api-reference", "adr", "node_modules")
# Operational endpoints every service serves but no spec lists.
INFRA_PATHS = {"/healthz", "/readyz", "/livez", "/metrics", "/mcp", "/health", "/ready"}
HTTP_METHODS = ("get", "post", "put", "patch", "delete")


class NotFound(Exception):
    """develop has no such file (a legitimate answer)."""


class Unreadable(Exception):
    """The file could not be read: the gate must fail, never pass."""


# --------------------------------------------------------------------------- fetchers
class GithubFetcher:
    """Reads a file from `develop` through the contents API (no CDN cache)."""

    def __init__(self, token: str | None = None, retries: int = 3):
        self.token = token or os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
        self.retries = retries

    def __call__(self, repo: str, path: str) -> bytes:
        url = f"https://api.github.com/repos/{ORG}/{repo}/contents/{path}?ref={BRANCH}"
        headers = {"Accept": "application/vnd.github.raw", "User-Agent": "warehouse-docs-drift-gate"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        last: Exception | None = None
        for _ in range(self.retries):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as r:
                    return r.read()
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    raise NotFound(f"{repo}:{path}") from e
                last = e
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last = e
        raise Unreadable(f"{repo}:{path} on {BRANCH}: {last}")


def dir_fetcher(base: str):
    """Offline fetcher: <base>/<repo>/<path>. A missing repo directory is Unreadable."""

    def fetch(repo: str, path: str) -> bytes:
        if not (Path(base) / repo).is_dir():
            raise Unreadable(f"{repo}: no such repo in {base}")
        f = Path(base) / repo / path
        if not f.is_file():
            raise NotFound(f"{repo}:{path}")
        return f.read_bytes()

    return fetch


# --------------------------------------------------------------------------- contexts
def discover_contexts(root: Path) -> list[dict]:
    out = []
    for section, (copy_dir, page_dir, names) in SECTIONS.items():
        base = root / copy_dir
        if not base.is_dir():
            continue
        for d in sorted(p for p in base.iterdir() if p.is_dir()):
            out.append({"repo": d.name, "section": section, "copy_dir": f"{copy_dir}/{d.name}",
                        "page_dir": f"{page_dir}/{d.name}", "expect": names})
    return out


def fetch_develop(contexts: list[dict], fetch) -> dict:
    """{repo: {name: bytes|None}}; raises Unreadable on the first unreadable producer file."""
    jobs = [(c["repo"], n) for c in contexts for n in SPEC_NAMES]

    def one(job):
        repo, name = job
        try:
            return job, fetch(repo, f"apis/{name}")
        except NotFound:
            return job, None

    result: dict = {c["repo"]: {} for c in contexts}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for (repo, name), data in ex.map(one, jobs):
            result[repo][name] = data
    return result


# --------------------------------------------------------------------------- spec copies (a)
def check_spec_copies(root: Path, contexts: list[dict], develop: dict) -> list[dict]:
    findings = []
    for c in contexts:
        copy_dir = root / c["copy_dir"]
        have = {p.name for p in copy_dir.glob("*.yaml")}
        for name in sorted(have | set(c["expect"])):
            dev = develop[c["repo"]].get(name)
            copy = (copy_dir / name).read_bytes() if (copy_dir / name).is_file() else None
            rel = f"{c['copy_dir']}/{name}"
            if copy is not None and dev is None:
                findings.append(finding("spec-missing", c["repo"], rel, 0, name,
                                        f"copy exists but {ORG}/{c['repo']} {BRANCH} has no apis/{name}"))
            elif copy is None and dev is not None and name in c["expect"]:
                findings.append(finding("spec-missing", c["repo"], rel, 0, name,
                                        f"{BRANCH} has apis/{name} but the copy is missing here"))
            elif copy is not None and dev is not None and copy != dev:
                a, b = copy.decode("utf-8", "replace").splitlines(), dev.decode("utf-8", "replace").splitlines()
                diff = [d for d in difflib.unified_diff(a, b, lineterm="", n=0) if d[:1] in "+-" and d[:3] not in ("+++", "---")]
                first = next((d for d in diff if d.startswith("+")), diff[0] if diff else "bytes differ")
                findings.append(finding("spec-drift", c["repo"], rel, 0, name,
                                        f"differs from {BRANCH}: {len(diff)} changed lines; first: {first[:100]}"))
    return findings


def finding(cls, ctx, file, line, text, detail, synced=False):
    return {"class": cls, "ctx": ctx, "file": file, "line": line, "text": text, "detail": detail, "synced": synced}


# --------------------------------------------------------------------------- route index
PARAM_SEG = re.compile(r"^(\{[^}]*\}|<[^>]*>|\$\{?\w+\}?|:[A-Za-z_]\w*|\.\.\.|…|\*)$")
EMBED = re.compile(r"\{[^}]*\}|<[^>]*>|\$\{?\w+\}?")


def norm_path(path: str) -> tuple[str, ...]:
    path = re.split(r"[?#]", path, maxsplit=1)[0].strip()
    segs = [s for s in path.split("/") if s != ""]
    out = []
    for s in segs:
        out.append("{}" if PARAM_SEG.match(s) else EMBED.sub("{}", s))
    return tuple(out)


def seg_match(page: str, spec: str) -> bool:
    return page == spec or spec == "{}" or page == "{}"


def build_routes(spec_bytes_list: list[bytes]) -> dict:
    """{'routes': [(METHOD, segs)], 'bases': [prefix segs], 'text': str}"""
    import yaml

    routes, bases, text = [], [()], ""
    for b in spec_bytes_list:
        if b is None:
            continue
        text += b.decode("utf-8", "replace")
        doc = yaml.safe_load(b) or {}
        for s in doc.get("servers") or []:
            u = re.sub(r"^https?://[^/]*", "", str((s or {}).get("url", "")))
            seg = norm_path(u)
            if seg and seg not in bases:
                bases.append(seg)
        for p, item in (doc.get("paths") or {}).items():
            for m in (item or {}):
                if m.lower() in HTTP_METHODS:
                    routes.append((m.upper(), norm_path(p)))
    return {"routes": routes, "bases": bases, "text": text}


def route_exists(idx: dict | None, method: str, segs: tuple[str, ...]) -> bool:
    if idx is None:
        return False
    if "/" + "/".join(segs) in INFRA_PATHS:
        return True
    cands = [segs]
    for b in idx["bases"]:
        if b and segs[: len(b)] == b:
            cands.append(segs[len(b):])
    for m, s in idx["routes"]:
        if m != method:
            continue
        for cand in cands:
            if len(cand) == len(s) and all(seg_match(a, b) for a, b in zip(cand, s)):
                return True
    return False


# --------------------------------------------------------------------------- page scanning
FENCE = re.compile(r"^\s*(`{3,}|~{3,})(.*)$")
ROUTE = re.compile(
    r"(?<![A-Za-z0-9_])(?:(?P<ctx>[a-z][a-z0-9-]*):\s*`?\s*)?"
    r"(?P<m>GET|POST|PUT|PATCH|DELETE)(?![A-Za-z0-9_])[`\s|*_]*"
    r"(?:https?://[^/\s`|)\"']+|\$\{?[A-Za-z_]+\}?)?"
    r"(?P<p>/[^\s`|)\"'\\]*)"
)
CURL = re.compile(r"\bcurl\b")
CURL_URL = re.compile(r"(?:https?://[^/\s'\"]+|\$\{?[A-Za-z_]+\}?)(?P<p>/[^\s'\"\\]*)")
CURL_X = re.compile(r"(?:-X|--request)\s+['\"]?(GET|POST|PUT|PATCH|DELETE)")
BARE_VERB_PATH = re.compile(r"(?<![\w:/.])(?P<p>/(?:[\w{}<>.\-]+/)*[\w{}<>.\-]*[\w}>]:[a-z][a-z\-]+)(?![\w:/])")
ALLOW_LINE = re.compile(r"\{/\*\s*drift-allow:\s*\S.*?\*/\}")
ALLOW_FILE = re.compile(r"\{/\*\s*drift-allow-file:\s*\S.*?\*/\}")
RETIRED_TOKENS = [
    ("X-Action-Id", re.compile(r"X-Action-Id", re.I)),
    ("nextToken", re.compile(r"\bnextToken\b")),
    ("purchaseOrders list envelope", re.compile(r"[\"'`]purchaseOrders[\"'`]\s*:|\.purchaseOrders\b|\bpurchaseOrders\s*\[")),
    ("inboundShipments list envelope", re.compile(r"[\"'`]inboundShipments[\"'`]\s*:|\.inboundShipments\b|\binboundShipments\s*\[")),
]


def clean_path(p: str) -> str:
    p = re.split(r"[?#]", p, maxsplit=1)[0]
    return re.sub(r"[`*_.,;:)\]]+$", "", p)


def logical_lines(lines: list[str], in_fence: list[bool]):
    """Join shell-continued lines (trailing backslash) inside fences; keep the first line number."""
    i = 0
    while i < len(lines):
        text, start = lines[i], i
        while in_fence[i] and text.rstrip().endswith("\\") and i + 1 < len(lines) and in_fence[i + 1]:
            i += 1
            text = text.rstrip()[:-1] + " " + lines[i].strip()
        yield start + 1, text, in_fence[start]
        i += 1


def scan_page(text: str) -> list[dict]:
    """Return citations: {line, kind: route|token|bare-verb, method, path, ctx, token, raw}."""
    if ALLOW_FILE.search(text):
        return []
    lines = text.splitlines()
    n = len(lines)
    in_fence, historical = [False] * n, [False] * n
    allowed = [False] * n
    fence_mark, hist = None, False
    for i, ln in enumerate(lines):
        m = FENCE.match(ln)
        if m and fence_mark is None:
            fence_mark, hist = m.group(1)[0] * len(m.group(1)), "historical" in m.group(2).lower()
            in_fence[i], historical[i] = True, hist
        elif fence_mark is not None:
            in_fence[i], historical[i] = True, hist
            if m and m.group(1).startswith(fence_mark) and not m.group(2).strip():
                fence_mark = None
    for i, ln in enumerate(lines):
        if not ALLOW_LINE.search(ln):
            continue
        allowed[i] = True
        if ALLOW_LINE.sub("", ln).strip():
            continue
        j = i + 1
        while j < n and not lines[j].strip():
            j += 1
        if j < n and FENCE.match(lines[j]):
            k = j
            allowed[k] = True
            k += 1
            while k < n and in_fence[k]:
                allowed[k] = True
                k += 1
        else:
            while j < n and lines[j].strip():
                allowed[j] = True
                j += 1
    cites: list[dict] = []
    for ln_no, ltext, fenced in logical_lines(lines, in_fence):
        idx = ln_no - 1
        if allowed[idx] or historical[idx]:
            continue
        seen = set()
        for m in ROUTE.finditer(ltext):
            path = clean_path(m.group("p"))
            if len(path) < 2 or (m.group("m"), path) in seen:
                continue
            seen.add((m.group("m"), path))
            cites.append({"line": ln_no, "kind": "route", "method": m.group("m"), "path": path,
                          "ctx": m.group("ctx"), "raw": m.group(0).strip()})
        if CURL.search(ltext):
            xm = CURL_X.search(ltext)
            method = xm.group(1) if xm else ("POST" if re.search(r"\s(-d|--data\S*)\s", ltext) else "GET")
            for m in CURL_URL.finditer(ltext):
                path = clean_path(m.group("p"))
                if len(path) >= 2 and (method, path) not in seen:
                    seen.add((method, path))
                    cites.append({"line": ln_no, "kind": "route", "method": method, "path": path,
                                  "ctx": None, "raw": m.group(0)})
        routed_paths = {p for _, p in seen}
        for m in BARE_VERB_PATH.finditer(ltext):
            if clean_path(m.group("p")) not in routed_paths and not any(m.group("p") in rp for rp in routed_paths):
                cites.append({"line": ln_no, "kind": "bare-verb", "method": None, "path": m.group("p"),
                              "ctx": None, "raw": m.group("p")})
        for name, rx in RETIRED_TOKENS:
            if rx.search(ltext):
                cites.append({"line": ln_no, "kind": "token", "method": None, "path": None, "ctx": None,
                              "token": name, "raw": name})
    return cites


# --------------------------------------------------------------------------- pages (b) + (c)
def page_files(root: Path) -> list[Path]:
    files = []
    for pr in PAGE_ROOTS:
        base = root / pr
        if not base.is_dir():
            continue
        for p in sorted(base.rglob("*")):
            if p.suffix not in (".md", ".mdx") or not p.is_file():
                continue
            rel = p.relative_to(root).parts
            if any(part in EXCLUDE_DIR_PARTS for part in rel):
                continue
            files.append(p)
    files += [root / f for f in PAGE_FILES if (root / f).is_file()]
    return files


def owner_of(rel: str, contexts: list[dict]) -> str | None:
    for c in contexts:
        if rel.startswith(c["page_dir"] + "/"):
            return c["repo"]
    return None


def check_pages(root: Path, contexts: list[dict], develop: dict, files: list[Path] | None = None) -> tuple[list[dict], dict]:
    repos = {c["repo"] for c in contexts}
    idx = {}
    for c in contexts:
        blobs = [develop[c["repo"]].get("openapi.yaml"), develop[c["repo"]].get("openapi-reports.yaml")]
        idx[c["repo"]] = build_routes(blobs) if any(blobs) else None
    adopted = {r: bool(i and re.search(r"nextCursor|Idempotency-Key", i["text"])) for r, i in idx.items()}
    all_text = "\n".join(i["text"] for i in idx.values() if i)
    findings, stats = [], {"pages": 0, "citations": 0, "unchecked_no_spec": 0}
    for p in (files if files is not None else page_files(root)):
        rel = p.relative_to(root).as_posix()
        text = p.read_text(encoding="utf-8", errors="replace")
        synced = ":::info[Synced from" in "\n".join(text.splitlines()[:40])
        owner = owner_of(rel, contexts)
        stats["pages"] += 1
        for c in scan_page(text):
            stats["citations"] += 1
            if c["kind"] == "token":
                _token(findings, c, rel, owner, idx, adopted, all_text, synced)
            elif c["kind"] == "bare-verb":
                _bare_verb(findings, c, rel, owner, idx, repos, synced)
            else:
                _route(findings, stats, c, rel, owner, idx, repos, synced)
    return findings, stats


def _route(findings, stats, c, rel, owner, idx, repos, synced):
    segs = norm_path(c["path"])
    if not segs:
        return
    explicit = c["ctx"] if c["ctx"] in repos else None
    target = explicit or owner
    if target is not None and idx.get(target) is None:
        stats["unchecked_no_spec"] += 1
        return
    if target is not None:
        if route_exists(idx[target], c["method"], segs):
            return
        if not explicit and any(route_exists(i, c["method"], segs) for r, i in idx.items() if r != target):
            return  # an owner page citing a sibling's route without a prefix
        where = f"{target} {BRANCH} openapi"
    else:
        if any(route_exists(i, c["method"], segs) for i in idx.values()):
            return
        where = f"any context's {BRANCH} openapi"
    findings.append(finding("route-missing", target or "(fleet)", rel, c["line"], f"{c['method']} {c['path']}",
                            f"not an operation in {where}", synced))


def _bare_verb(findings, c, rel, owner, idx, repos, synced):
    segs = norm_path(c["path"])
    pool = [idx[owner]] if owner and idx.get(owner) else list(idx.values())
    if any(i and any(s == segs and True for _, s in i["routes"]) for i in pool if i):
        return
    if any(i and any(len(s) == len(segs) and all(seg_match(a, b) for a, b in zip(segs, s)) for _, s in i["routes"]) for i in pool if i):
        return
    findings.append(finding("retired-shape", owner or "(fleet)", rel, c["line"], c["path"],
                            "`:verb` suffix route (retired by the REST guideline); no such path on develop", synced))


def _token(findings, c, rel, owner, idx, adopted, all_text, synced):
    tok = c["token"]
    needle = tok.split(" ")[0]
    if owner is not None and idx.get(owner) is not None:
        if not adopted[owner] or needle in idx[owner]["text"]:
            return
    elif needle in all_text:
        return
    findings.append(finding("retired-shape", owner or "(fleet)", rel, c["line"], tok,
                            "vocabulary retired by the REST guideline; not in develop's spec", synced))


# --------------------------------------------------------------------------- driver
def run(root: Path, fetch, only: set[str] | None = None, pages: bool = True) -> tuple[list[dict], dict]:
    contexts = [c for c in discover_contexts(root) if not only or c["repo"] in only]
    develop = fetch_develop(contexts, fetch)  # raises Unreadable
    findings = check_spec_copies(root, contexts, develop)
    stats = {"contexts": len(contexts)}
    if pages:
        pf, ps = check_pages(root, contexts, develop)
        findings += pf
        stats.update(ps)
    return findings, stats


def summarize(findings: list[dict]) -> dict:
    out: dict = {}
    for f in findings:
        out.setdefault(f["ctx"], {}).setdefault(f["class"], 0)
        out[f["ctx"]][f["class"]] += 1
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=str(Path(__file__).resolve().parent.parent))
    ap.add_argument("--from-dir", help="offline: read develop files from <dir>/<repo>/apis/... instead of GitHub")
    ap.add_argument("--only", nargs="*", help="limit to these context repos")
    ap.add_argument("--json", help="write findings + summary to this file")
    ap.add_argument("--no-pages", action="store_true", help="only compare spec copies")
    a = ap.parse_args(argv)
    root = Path(a.root)
    fetch = dir_fetcher(a.from_dir) if a.from_dir else GithubFetcher()
    try:
        import yaml  # noqa: F401
    except ImportError:
        print("pyyaml is required (pip install pyyaml)", file=sys.stderr)
        return EXIT_USAGE
    try:
        findings, stats = run(root, fetch, set(a.only) if a.only else None, not a.no_pages)
    except Unreadable as e:
        print(f"UNREADABLE PRODUCER: {e}\nThe gate fails closed: a spec it cannot read is not a spec that matches.", file=sys.stderr)
        return EXIT_UNREADABLE
    summary = summarize(findings)
    if a.json:
        Path(a.json).write_text(json.dumps({"stats": stats, "summary": summary, "findings": findings}, indent=1))
    for f in sorted(findings, key=lambda f: (f["ctx"], f["class"], f["file"], f["line"])):
        tag = " [synced copy: fix upstream, re-sync]" if f["synced"] else ""
        loc = f"{f['file']}:{f['line']}" if f["line"] else f["file"]
        print(f"{f['class']:14} {f['ctx']:26} {loc}  {f['text']}  -- {f['detail']}{tag}")
    print(f"\n{len(findings)} finding(s) across {stats['contexts']} contexts"
          f" ({stats.get('pages', 0)} pages, {stats.get('citations', 0)} citations,"
          f" {stats.get('unchecked_no_spec', 0)} route citations unchecked: owner has no OpenAPI)")
    for ctx in sorted(summary):
        print(f"  {ctx:28} " + ", ".join(f"{k}={v}" for k, v in sorted(summary[ctx].items())))
    return EXIT_FINDINGS if findings else EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
