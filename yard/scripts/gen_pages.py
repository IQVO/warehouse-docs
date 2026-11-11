#!/usr/bin/env python3
"""Generate the model-derived strategic pages from yard/model/model.yaml.

Pages written (fully generated; edit this script or the model, not the page):
  yard/docs/strategic-design/index.md
  yard/docs/strategic-design/subdomain-classification.md
  yard/docs/strategic-design/context-map.md
  yard/docs/strategic-design/ubiquitous-language.md
  yard/docs/strategic-design/event-standard-cloudevents.md

  python3 yard/scripts/gen_pages.py           # write
  python3 yard/scripts/gen_pages.py --check   # fail if a page differs from what the model gives
"""
import os
import re
import sys
from collections import OrderedDict

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = yaml.safe_load(open(os.path.join(ROOT, "model", "model.yaml")))
CTX = OrderedDict((c["id"], c) for c in M["contexts"])
SUBDOMAIN = "wms"
PUB = OrderedDict()
for c in M["contexts"]:
    for p in c.get("publishes", []):
        PUB[p["event"]] = (c["id"], p)

BANNER = """:::info[Generated from the model]
This page is generated from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
:::
"""


STATUS = """:::info[Built, released at v0.1.2, applied to k3s (reduced footprint)]
Both contexts are merged on `develop` (2026-11-08) in [IQVO/dock-scheduling](https://github.com/IQVO/dock-scheduling) and [IQVO/yard-management](https://github.com/IQVO/yard-management), released at v0.1.2 and applied to the k3s cluster on 2026-11-10 in a reduced footprint (dock-scheduling: API only, it relays inline; yard-management: API and relay). MCP servers, analytics projectors, report services and sweeps are registered in infra but switched off until the cluster has room. The cross-context journey is proven by the `@yard-journey` scenarios of IQVO/e2e-tests (local processes, not the cluster). The model records the as-built contracts: `scripts/check_model.py` compares it with the contract copies under `yard/apis/`.
:::
"""


def esc(text):
    """Escape MDX-active characters outside code spans."""
    parts = str(text).split("`")
    for i in range(0, len(parts), 2):
        parts[i] = parts[i].replace("{", "\\{").replace("}", "\\}")
        parts[i] = re.sub(r"<(?=[A-Za-z/])", "\\<", parts[i])
    return "`".join(parts)


def front(id_, title, label, desc):
    return f'---\nid: {id_}\ntitle: {title}\nsidebar_label: {label}\ndescription: "{desc}"\n---\n\n# {title}\n\n{BANNER}\n'


def ce_type(ctx, entity, ev):
    return f"com.warehouse.{SUBDOMAIN}.{ctx}.{entity}.{ev}"


def page_index():
    out = front("index", "Strategic Design", "Overview",
                "Strategic design of the yard domain, generated from the model: subdomains, context map, ubiquitous language and the event standard.")
    out += STATUS + "\n"
    out += "The yard is the enclosed area outside a site's four walls. It is modelled as two bounded contexts:\n\n"
    out += "| Context | Code | Classification | Purpose |\n| --- | --- | --- | --- |\n"
    for c in M["contexts"]:
        out += f"| `{c['id']}` | {c['code']} | {c['classification']} | {esc(c['purpose'])} |\n"
    out += "\n"
    out += "Pages: [Subdomain Classification](/yard/strategic-design/subdomain-classification), [Context Map](/yard/strategic-design/context-map), "
    out += "[Ubiquitous Language](/yard/strategic-design/ubiquitous-language), [Event Standard](/yard/strategic-design/event-standard-cloudevents), "
    out += "[Model Gap Register](/yard/strategic-design/model-gap-register).\n"
    out += "\n## Counts\n\n| Fact | Value |\n| --- | --- |\n"
    for c in M["contexts"]:
        aggs = len(c["aggregates"])
        invs = sum(len(a.get("invariants", [])) for a in c["aggregates"])
        out += f"| `{c['id']}` aggregates / invariants | {aggs} / {invs} |\n"
        out += f"| `{c['id']}` published events / REST routes | {len(c['publishes'])} / {len(c['rest'])} |\n"
    return out


def page_subdomains():
    out = front("subdomain-classification", "Subdomain Classification", "Subdomain Classification",
                "Core, Supporting or Generic: the two yard bounded contexts, the deferred contexts and the verdict rationale for each.")
    out += "Subdomains are classified by how much competitive advantage they give, not by size.\n\n"
    out += "## Bounded contexts\n\n| Context | Classification | Differentiation | Complexity | Evolution | Business model |\n| --- | --- | --- | --- | --- | --- |\n"
    for c in M["contexts"]:
        ch = c["chart"]
        out += f"| `{c['id']}` | {c['classification']} | {ch['differentiation']} | {ch['complexity']} | {ch['evolution']} | {esc(c['business_model'])} |\n"
    out += "\nBoth are Supporting: every site with trucks needs them and the rules (window length, seal policy, dwell thresholds) differ per operator, but the platform does not win on them. See [Benchmarks](/yard/research/benchmarks).\n"
    out += "\n## Deferred contexts and contexts outside this section\n\n| Context | Classification | Note |\n| --- | --- | --- |\n"
    for f in M.get("future_contexts", []):
        out += f"| `{f['id']}` | {f['classification']} | {esc(f['note'])} |\n"
    out += "\n## Deliberately not contexts\n\n| Item | Reason |\n| --- | --- |\n"
    for n in M.get("not_contexts", []):
        out += f"| {esc(n['item'])} | {esc(n['reason'])} |\n"
    out += "\n## Business decisions each context enforces\n"
    for c in M["contexts"]:
        out += f"\n### `{c['id']}`\n\n"
        for d in c["business_decisions"]:
            out += f"- {esc(d)}\n"
    return out


def node(i):
    return i.replace("-", "_")


def page_context_map():
    out = front("context-map", "Context Map", "Context Map",
                "Relationships between the yard contexts and the fleet contexts they consume or feed, with the strategic pattern on each edge.")
    own = list(CTX)
    edges = OrderedDict()  # (up, down) -> {events, patterns}

    def add(up, down, ev, pat):
        d = edges.setdefault((up, down), {"events": [], "patterns": set()})
        if ev not in d["events"]:
            d["events"].append(ev)
        d["patterns"].add(pat)

    for ev, (prod, p) in PUB.items():
        for cons in p["consumers"]:
            if cons == "analytics only":
                continue
            pat = "Customer/Supplier" if cons in CTX else "Customer/Supplier"
            for row in CTX[cons]["inbound"] if cons in CTX else []:
                if row["from"] == prod and row["type"] == "evt" and ev in [s.strip() for s in row["message"].split(",")]:
                    pat = row["relationship"]
            add(prod, cons, ev, pat)
    for c in M["contexts"]:
        for row in c["inbound"]:
            if row["type"] == "evt" and row["from"] not in CTX:
                for ev in [s.strip() for s in row["message"].split(",")]:
                    add(row["from"], c["id"], ev, row["relationship"])
    ids = []
    for (u, d) in edges:
        for x in (u, d):
            if x not in ids:
                ids.append(x)
    out += "## Map\n\nSolid arrows are event flows (upstream to downstream). The label is the relationship pattern and the number of event types.\n\n"
    out += "```mermaid\nflowchart TD\n"
    for i in ids:
        shape = f'{node(i)}["{i}"]'
        if i in CTX:
            shape = f'{node(i)}[["{i}"]]'
        out += f"  {shape}\n"
    for (u, d), v in edges.items():
        pats = "/".join(sorted(v["patterns"]))
        out += f"  {node(u)} -->|{pats}, {len(v['events'])}| {node(d)}\n"
    out += "```\n\n"
    out += "## Edges\n\n| Upstream | Downstream | Pattern | Events |\n| --- | --- | --- | --- |\n"
    for (u, d), v in edges.items():
        out += f"| `{u}` | `{d}` | {', '.join(sorted(v['patterns']))} | {', '.join('`'+e+'`' for e in v['events'])} |\n"
    out += "\n## Changes in existing contexts\n\n| Context | Kind | Summary |\n| --- | --- | --- |\n"
    for f in M["fleet_changes"]:
        out += f"| `{f['context']}` | {f['kind']} | {esc(f['summary'])} |\n"
    out += f"\n## Boundary rules\n\n- {esc(M['meta']['scope_rule'])}\n- {esc(M['meta']['hard_boundary'])}\n"
    for r in M["conventions"]["integration_rules"]:
        out += f"- {esc(r)}\n"
    return out


def page_ul():
    out = front("ubiquitous-language", "Ubiquitous Language", "Ubiquitous Language",
                "The yard glossary by bounded context, with the code name each term has in the model.")
    for c in M["contexts"]:
        out += f"## `{c['id']}`\n\n| Term | Definition | Code |\n| --- | --- | --- |\n"
        for t in c["ul"]:
            out += f"| {esc(t['term'])} | {esc(t['definition'])} | `{t['code']}` |\n"
        out += "\n"
    return out


def page_events():
    out = front("event-standard-cloudevents", "Event Standard (CloudEvents)", "Event Standard",
                "The CloudEvents type, source, topic and key convention for the yard contexts, and the full catalogue of published events.")
    cv = M["conventions"]["cloudevents"]
    out += f"Spec: {esc(cv['spec'])}.\n\n| Field | Rule |\n| --- | --- |\n"
    for k in ("type", "subdomain", "entity_rule", "source", "dataschema", "subject", "topic", "analytics_topic", "payload_case", "version_field"):
        out += f"| {k} | {esc(cv[k])} |\n"
    out += f"\nSite key: {esc(M['conventions']['site_key'])}\n\n{esc(cv['analytics_rule'] if 'analytics_rule' in cv else M['conventions']['analytics_rule'])}\n"
    out += "\n"
    for c in M["contexts"]:
        out += f"## `{c['id']}` published events\n\n| Event | CloudEvents type | Stream | Data | Consumers |\n| --- | --- | --- | --- | --- |\n"
        for p in c["publishes"]:
            stream = "analytics only" if p["consumers"] == ["analytics only"] else "integration + analytics"
            out += f"| `{p['event']}` | `{ce_type(c['id'], p['entity'], p['event'])}` | {stream} | {', '.join('`'+d+'`' for d in p['data'])} | {', '.join(p['consumers']) or 'none yet'} |\n"
        out += "\n"
    return out


PAGES = OrderedDict([
    ("index.md", page_index),
    ("subdomain-classification.md", page_subdomains),
    ("context-map.md", page_context_map),
    ("ubiquitous-language.md", page_ul),
    ("event-standard-cloudevents.md", page_events),
])


def main():
    check = "--check" in sys.argv
    bad = 0
    d = os.path.join(ROOT, "docs", "strategic-design")
    os.makedirs(d, exist_ok=True)
    for name, fn in PAGES.items():
        text = fn()
        path = os.path.join(d, name)
        if check:
            have = open(path).read() if os.path.exists(path) else None
            if have != text:
                print(f"DIFF: {path} differs from the model")
                bad += 1
        else:
            open(path, "w").write(text)
            print(f"wrote {path}")
    if check:
        print("FAIL" if bad else "OK: generated pages match the model")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
