#!/usr/bin/env python3
"""Derive the consumer->producer contract edge map for the IQVO warehouse-systems fleet.

Every fact is derived from origin/develop (run `git fetch` first), never from
working trees. Emits contract-edges.json (REST, event, reports, external edges)
and contract-gaps.json (producer-side readiness gaps).

Usage: fleet_contract_edges.py [--ws ~/warehouse-systems] [--out DIR]
"""
import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import sys

WS = os.path.expanduser("~/warehouse-systems")
GHOST = re.compile(r"(^-)|(^\.)|(-bdd\d+$)|(itcov)|(^wt-)|(^e2s-tests$)|(^e2e-tests$)")

SKIP_ENV_EXACT = {
    "DATABASE_URL", "MIGRATIONS_DATABASE_URL", "ANALYTICS_DATABASE_URL",
    "OTEL_EXPORTER_OTLP_ENDPOINT", "A2A_AGENT_URL",  # A2A_AGENT_URL = the agent's own service DNS
}
SKIP_ENV_PREFIX = ("OTEL_",)
SERVICE_SUFFIXES = ("-a2a", "-api", "-reports", "-svc")
# env-name prefixes that do not literally match the producer repo name
NAME_ALIASES = {"WORK_PLANNING": "wes-work-planning", "REPORTS": "SELF"}  # SELF = intra-repo reports binary
# tokens appearing in Kafka topic names that map to a repo (analytics twin topics
# use short forms: warehouse.facility.analytics -> facility-layout)
TOPIC_TOKEN_ALIASES = {
    "facility": "facility-layout", "fulfillment": "fulfillment-execution",
    "inventory": "inventory-storage", "work-planning": "wes-work-planning",
}


def git(repo, *args, timeout=60):
    r = subprocess.run(["git", "-C", os.path.join(WS, repo), *args],
                       capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout


def show(repo, path):
    rc, out = git(repo, "show", f"origin/develop:{path}")
    return out if rc == 0 else None


def ls_tree(repo, path_glob):
    rc, out = git(repo, "ls-tree", "-r", "--name-only", "origin/develop", "--", path_glob)
    return out.splitlines() if rc == 0 else []


def repo_names(alive):
    return set(alive)


# ---------- REST edges from charts ----------

ENV_LINE = re.compile(r"^\s*([A-Z][A-Z0-9_]*_(?:URL|BASE_URL|ENDPOINT))\s*:\s*(.+)$", re.M)
DEPLOY_ENV = re.compile(r"- name:\s*([A-Z][A-Z0-9_]*_(?:URL|BASE_URL|ENDPOINT))\s*\n\s*value:\s*(\S+)")
VALUES_KEY = re.compile(r"^\s*([A-Za-z][A-Za-z0-9]*Url)\s*:\s*(.+)$", re.M)


def host_of(url):
    m = re.match(r"https?://([^/:]+)", url or "")
    return m.group(1) if m else None


def producer_for_host(host, alive_set):
    if not host:
        return None
    if "svc.cluster.local" not in host and not host.startswith("localhost"):
        return None  # external
    label = host.split(".")[0]
    for suffix in SERVICE_SUFFIXES:
        if label.endswith(suffix):
            label = label[: -len(suffix)]
            break
    if label in alive_set:
        return label
    return None


def producer_from_name(name, alive_set):
    """Derive the producer repo from the env var NAME when no URL default exists.

    SHOPPING_CART_URL -> shopping-cart, INVENTORY_STORAGE_BASE_URL -> inventory-storage,
    WORK_PLANNING_A2A_URL -> wes-work-planning (alias), REPORTS_BASE_URL -> None (self).
    """
    stem = name
    for suffix in ("_A2A_URL", "_BASE_URL", "_ENDPOINT", "_URL"):
        if stem.endswith(suffix):
            stem = stem[: -len(suffix)]
            break
    if stem in NAME_ALIASES:
        mapped = NAME_ALIASES[stem]
        return mapped  # "SELF" resolved by the caller
    repo = stem.lower().replace("_", "-")
    return repo if repo in alive_set else None


def scan_charts(repo, alive_set):
    """Return (edges, externals). Edge = dict(env, default, producer, evidence)."""
    edges, externals = [], []
    files = [f for f in ls_tree(repo, "charts/") if f.endswith((".yaml", ".yml"))]
    values_defaults = {}
    for vf in files:
        content = show(repo, vf)
        if content is None:
            continue
        for key, val in VALUES_KEY.findall(content):
            val = val.strip().strip('"').strip("'")
            if val.startswith("http"):
                values_defaults.setdefault(key, val)

    for f in files:
        content = show(repo, f)
        if content is None:
            continue
        found = {}
        for name, rhs in ENV_LINE.findall(content):
            found[name] = rhs.strip()
        for name, rhs in DEPLOY_ENV.findall(content):
            found.setdefault(name, rhs.strip())
        for name, rhs in found.items():
            if name in SKIP_ENV_EXACT or name.startswith(SKIP_ENV_PREFIX):
                continue
            # resolve {{ .Values.config.xUrl | quote }} to the default
            m = re.search(r"\.Values\.[A-Za-z0-9_.]*?([A-Za-z0-9]*Url)", rhs)
            if m and m.group(1) in values_defaults:
                url = values_defaults[m.group(1)]
            elif rhs.startswith("http"):
                url = rhs.strip('"')
            else:
                url = None
            host = host_of(url) if url else None
            producer = producer_for_host(host, alive_set)
            if producer is None and (url is None or not url.strip()):
                # no in-chart default (wired at deploy time): derive from the env NAME
                producer = producer_from_name(name, alive_set)
                if producer == "SELF":
                    producer = repo
            if producer:
                edges.append({"env": name, "default": url or "", "producer": producer,
                              "evidence": f"{f} ({name})"})
            elif url is not None:
                externals.append({"env": name, "default": url, "evidence": f"{f} ({name})"})
    # dedupe by (env, producer)
    seen, deduped = set(), []
    for e in edges:
        k = (e["env"], e["producer"])
        if k not in seen:
            seen.add(k)
            deduped.append(e)
    return deduped, externals


# ---------- event edges from apis/asyncapi.yaml ----------

def scan_asyncapi(repo):
    """Return (pub_topics, sub_topics) or (None, None) when no spec.

    The fleet's asyncapi.yaml files use CHANNEL-PERSPECTIVE operations
    (inverted from the AsyncAPI 2.6 spec's app perspective — verified against
    product-master/fulfillment-execution specs): a `subscribe:` operation on a
    channel documents a topic THIS app publishes ("written by the outbox
    relay"); a `publish:` operation documents a channel a counterparty
    publishes and this app consumes (tagged `consumed`). We therefore return
    the APP-perspective truth: pub = channels under subscribe:, sub = channels
    under publish:.
    """
    content = show(repo, "apis/asyncapi.yaml")
    if content is None:
        return None, None
    pub, sub = set(), set()
    in_channels = False
    current = None
    for line in content.splitlines():
        if re.match(r"^channels:\s*$", line):
            in_channels = True
            continue
        if in_channels:
            m = re.match(r"^  ([^\s#][^:]*):\s*$", line)
            if m:
                current = m.group(1).strip("'\"")
                continue
            if re.match(r"^\S", line):  # next top-level key
                in_channels = False
                continue
            om = re.match(r"^    (publish|subscribe):\s*$", line)
            if om and current:
                # channel-perspective flip: publish: = we consume, subscribe: = we produce
                (sub if om.group(1) == "publish" else pub).add(current)
    return pub, sub


def owner_from_topic(topic, alive_set):
    """Infer the owning repo from a Kafka topic name (warehouse.<repo>.analytics)."""
    tokens = re.split(r"[.\-/]", topic)
    for tok in tokens:
        if tok in TOPIC_TOKEN_ALIASES and TOPIC_TOKEN_ALIASES[tok]:
            return TOPIC_TOKEN_ALIASES[tok]
        if tok in alive_set:
            return tok
        # short token that prefixes exactly one repo (facility -> facility-layout)
        prefix_matches = [r for r in alive_set if r.startswith(tok + "-")]
        if len(prefix_matches) == 1:
            return prefix_matches[0]
    return None


def scan_code_only_envs(repo, chart_envs):
    """Env names read via os.Getenv in Go code but never wired in charts (findings)."""
    rc, out = git(repo, "grep", "-h", "-o", "-E",
                  r"os\.Getenv\(\"[A-Z0-9_]+_(URL|BASE_URL|A2A_URL)\"\)",
                  "origin/develop", "--", "cmd/", "internal/")
    found = set(re.findall(r'"([A-Z0-9_]+)"', out or "")) if rc == 0 else set()
    return sorted(found - chart_envs)


# ---------- producer readiness gaps ----------

def scan_gaps(repo):
    ci = show(repo, ".github/workflows/ci.yml") or ""
    openapi = show(repo, "apis/openapi.yaml") or ""
    asyncapi = show(repo, "apis/asyncapi.yaml") or ""
    tree = ls_tree(repo, ".")
    return {
        "repo": repo,
        "schemathesis": "Schemathesis" in ci,
        "oasdiff": "oasdiff" in ci,
        "openapi_operations": len(re.findall(r"operationId:", openapi)),
        "openapi_examples": len(re.findall(r"examples?:", openapi)),
        "asyncapi_messages": len(re.findall(r"dataschema:|urn:warehouse:", asyncapi)),
        "asyncapi_examples": len(re.findall(r"examples?:", asyncapi)),
        "golden_files": [t for t in tree if "golden" in t.lower()],
    }


def main():
    global WS
    ap = argparse.ArgumentParser()
    ap.add_argument("--ws", default=WS)
    ap.add_argument("--out", default=".")
    a = ap.parse_args()
    WS = os.path.abspath(os.path.expanduser(a.ws))
    outdir = os.path.abspath(os.path.expanduser(a.out))
    os.makedirs(outdir, exist_ok=True)

    repos = sorted(d for d in os.listdir(WS)
                   if GHOST.search(d) is None and os.path.exists(os.path.join(WS, d, ".git")))
    alive = [r for r in repos if git(r, "rev-parse", "--verify", "--quiet", "origin/develop")[0] == 0]
    alive_set = repo_names(alive)

    def work(repo):
        rest, ext = scan_charts(repo, alive_set)
        pub, sub = scan_asyncapi(repo)
        return repo, rest, ext, pub, sub

    rest_edges, externals, event_map = [], [], {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for repo, rest, ext, pub, sub in ex.map(work, alive):
            for e in rest:
                kind = "reports" if e["env"] == "REPORTS_BASE_URL" else "rest"
                rest_edges.append({"consumer": repo, "producer": e["producer"], "kind": kind,
                                   "env": e["env"], "default": e["default"], "evidence": e["evidence"]})
            externals.extend({"consumer": repo, **e} for e in ext)
            event_map[repo] = {"pub": pub or set(), "sub": sub or set()}

    # match subscribe topics to producers
    topic_producers = {}
    for repo, m in event_map.items():
        for t in m["pub"]:
            topic_producers.setdefault(t, set()).add(repo)
    event_edges, unmatched = [], []
    for repo, m in event_map.items():
        for t in sorted(m["sub"]):
            producers = sorted(p for p in topic_producers.get(t, set()) if p != repo)
            self_pub = repo in topic_producers.get(t, set())
            if producers:
                for p in producers:
                    event_edges.append({"consumer": repo, "producer": p, "topic": t,
                                        "kind": "event", "self_pub": self_pub,
                                        "evidence": "apis/asyncapi.yaml (subscribe)"})
            elif self_pub:
                # the repo consumes a topic it also publishes (e.g. its own analytics
                # stream re-read by a projector): a self-loop, not a cross-context edge
                event_edges.append({"consumer": repo, "producer": repo, "topic": t,
                                    "kind": "event-self", "self_pub": True,
                                    "evidence": "apis/asyncapi.yaml (subscribe/publish self-loop)"})
            else:
                owner = owner_from_topic(t, alive_set)
                if owner == repo:
                    event_edges.append({"consumer": repo, "producer": repo, "topic": t,
                                        "kind": "event-self", "self_pub": False,
                                        "evidence": "analytics-twin self-consumption (topic owner = consumer)"})
                elif owner:
                    # real cross-context edge whose producer declaration the scanner
                    # could not match (publish not declared for this topic): keep it,
                    # flagged, so the registry errs on the side of pinning
                    event_edges.append({"consumer": repo, "producer": owner, "topic": t,
                                        "kind": "event", "self_pub": False, "inferred": True,
                                        "evidence": "apis/asyncapi.yaml (subscribe; producer inferred from topic name)"})
                else:
                    unmatched.append({"consumer": repo, "topic": t})

    gaps = [scan_gaps(r) for r in alive]

    # findings: env names read in Go code but never wired in any chart template
    findings = []
    for repo in alive:
        rc, out = git(repo, "grep", "-h", "-o", "-E",
                      r"os\.Getenv\(\"[A-Z0-9_]+_(URL|BASE_URL|A2A_URL)\"\)",
                      "origin/develop", "--", "cmd/", "internal/")
        code_envs = set(re.findall(r'"([A-Z0-9_]+)"', out or "")) if rc == 0 else set()
        code_envs -= {e for e in SKIP_ENV_EXACT}
        code_envs = {e for e in code_envs if not e.startswith(SKIP_ENV_PREFIX)}
        chart_envs = {e["env"] for e in rest_edges if e["consumer"] == repo} | \
                     {e["env"] for e in externals if e["consumer"] == repo}
        for env in sorted(code_envs - chart_envs):
            findings.append({"repo": repo, "env": env,
                             "note": "read in Go code but not wired in charts (deploy-time or missing wiring)"})

    def ser(o):
        return json.loads(json.dumps(o, default=lambda s: sorted(s) if isinstance(s, set) else list(s)))

    result = {"rest": ser(rest_edges), "events": ser(event_edges),
              "external": ser(externals), "unmatched_subscribed_topics": ser(unmatched),
              "findings": ser(findings)}
    with open(os.path.join(outdir, "contract-edges.json"), "w") as fh:
        json.dump(result, fh, indent=2, sort_keys=True)
    with open(os.path.join(outdir, "contract-gaps.json"), "w") as fh:
        json.dump(ser(gaps), fh, indent=2)

    print(f"REST edges: {len(result['rest'])} "
          f"(cross-repo {sum(1 for e in result['rest'] if e['producer'] != e['consumer'])}, "
          f"intra-repo reports {sum(1 for e in result['rest'] if e['kind'] == 'reports')})")
    print(f"EVENT edges: {len(result['events'])}")
    print(f"external URL envs: {len(result['external'])}")
    print(f"subscribed topics with NO publishing repo: {len(unmatched)}")
    for u in unmatched[:15]:
        print(f"  ?? {u['consumer']} subscribes {u['topic']}")
    print(f"\ncode-only URL envs (not chart-wired): {len(result['findings'])}")
    for f in result["findings"]:
        print(f"  ! {f['repo']}: {f['env']}")
    print("\nREST edges (consumer -> producer):")
    for e in sorted(result["rest"], key=lambda x: (x["consumer"], x["producer"])):
        tag = " [self]" if e["producer"] == e["consumer"] else ""
        print(f"  {e['consumer']:28s} -> {e['producer']}{tag}  ({e['env']})")
    print("\nEVENT edges (consumer -> producer, unique pairs):")
    pairs = sorted({(e["consumer"], e["producer"]) for e in result["events"]})
    for c, p in pairs:
        n = sum(1 for e in result["events"] if e["consumer"] == c and e["producer"] == p)
        print(f"  {c:28s} -> {p}  ({n} topics)")
    print(f"\nwrote {outdir}/contract-edges.json and contract-gaps.json")


if __name__ == "__main__":
    main()
