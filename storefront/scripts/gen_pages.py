#!/usr/bin/env python3
"""Generate the model-derived strategic pages from storefront/model/model.yaml.

Pages written (fully generated; edit this script or the model, not the page):
  docs/strategic-design/index.md
  docs/strategic-design/context-map.md
  docs/strategic-design/ubiquitous-language.md
  docs/strategic-design/event-standard-cloudevents.md
  docs/strategic-design/subdomain-classification.md

  python3 storefront/scripts/gen_pages.py           # write
  python3 storefront/scripts/gen_pages.py --check   # fail if a page differs from what the model gives

The network model (network/model/model.yaml) is loaded READ-ONLY to draw the
cross-domain edges and label the upstream network contexts.
"""
import os
import re
import sys
from collections import OrderedDict

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = yaml.safe_load(open(os.path.join(ROOT, "model", "model.yaml")))
CTX = OrderedDict((c["id"], c) for c in M["contexts"])
TIER = {ctx: t for t, lst in M["conventions"]["cloudevents"]["tiers"].items() for ctx in lst}
CODE = {c["id"]: c["code"] for c in M["contexts"]}
CLS = {c["id"]: c["classification"] for c in M["contexts"]}


def mdx_braces(text):
    """Escape MDX-active characters outside code spans: bare `{`/`}` are JSX
    expressions and `<word>` is a JSX tag, both break the build (e.g. "Money
    is {amountMinor int64, currency}", "type /problems/<slug>")."""
    parts = text.split("`")
    for i in range(0, len(parts), 2):  # even indices are outside code spans
        parts[i] = (
            parts[i]
            .replace("{", "\\{")
            .replace("}", "\\}")
        )
        parts[i] = re.sub(r"<(?=[A-Za-z/])", "\\<", parts[i])
    return "`".join(parts)

XM = M["conventions"].get("cross_model", {})
NET = None
NET_CODE, NET_CLS = {}, {}
if XM.get("network_model"):
    NET = yaml.safe_load(open(os.path.normpath(os.path.join(ROOT, "model", XM["network_model"]))))
    NET_CODE = {c["id"]: c["code"] for c in NET["contexts"]}
    NET_CLS = {c["id"]: c["classification"] for c in NET["contexts"]}

BANNER = """:::info[Generated from the model]
This page is generated from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
:::
"""


def ce_type(ctx, entity, ev):
    return f"com.retailnetwork.{TIER[ctx]}.{ctx}.{entity}.{ev}"


def published():
    out = OrderedDict()
    for c in M["contexts"]:
        for p in c.get("publishes", []):
            out[p["event"]] = (c["id"], p)
    return out


PUB = published()


def rel_of(consumer, producer, ev):
    for row in CTX[consumer].get("inbound", []):
        if row["from"] == producer and row["type"] == "evt" and ev in [s.strip() for s in row["message"].split(",")]:
            return row["relationship"]
    return "?"


def sync_rel(caller, callee, route):
    """Relationship pattern of a synchronous call: the callee's inbound row
    that names the route, preferring the row whose caller is the actual
    caller, then the OHS storefront caller, then any match."""
    cand = []
    mc = CTX.get(callee)
    if mc:
        cand.append(mc)
    if NET:
        nc = next((c for c in NET["contexts"] if c["id"] == callee), None)
        if nc:
            cand.append(nc)
    ohs = XM.get("ohs_caller", "shopper / storefront")
    rows = [row for mc in cand for row in mc.get("inbound", []) if route and route in row.get("channel", "")]
    for want in (caller, ohs):
        for row in rows:
            if row.get("from") == want:
                return row["relationship"]
    return rows[0]["relationship"] if rows else "Customer/Supplier"


def route_of(channel):
    mt = re.match(r"REST\s+((?:GET|POST|PUT|DELETE|PATCH)\s+\S+)", channel or "")
    return mt.group(1) if mt else None


def edges():
    """(upstream, downstream) -> {'events': [...], 'sync': [...], 'patterns': set()}"""
    e = OrderedDict()
    for ev, (prod, p) in PUB.items():
        for cons in p.get("consumers", []):
            if cons not in CTX:
                continue
            k = (prod, cons)
            d = e.setdefault(k, {"events": [], "sync": [], "patterns": set()})
            d["events"].append(ev)
            d["patterns"].add(rel_of(cons, prod, ev))
    # cross-domain events: storefront consumes network events (storefront
    # producers are already covered by the publishes loop above)
    for c in M["contexts"]:
        for x in c.get("consumes", []):
            if x["from"] not in CTX and NET and x["from"] in {n["id"] for n in NET["contexts"]}:
                k = (x["from"], c["id"])
                d = e.setdefault(k, {"events": [], "sync": [], "patterns": set()})
                d["events"].append(x["event"])
                d["patterns"].add(rel_of(c["id"], x["from"], x["event"]))
    for c in M["contexts"]:
        for s in c.get("sync_calls", []):
            # caller is downstream (Customer), callee upstream (Supplier);
            # external systems (payment-provider) are drawn by hand
            if s["to"] not in CTX and not (NET and s["to"] in {n["id"] for n in NET["contexts"]}):
                continue
            k = (s["to"], c["id"])
            d = e.setdefault(k, {"events": [], "sync": [], "patterns": set()})
            d["sync"].append(f"{s['type']} {s['message']} (`{s['channel']}`)")
            rel = sync_rel(c["id"], s["to"], route_of(s.get("channel", "")))
            d["patterns"].add(rel)
            if "ACL" in (s.get("note") or "") or "ACL" in s.get("channel", ""):
                d["patterns"].add("ACL")
            if s.get("ops_only"):
                d["patterns"].add("ops-only")
    return e


def pat_short(pats):
    m = {"Conformist": "CF", "Customer/Supplier": "C/S", "OHS": "OHS", "ACL": "ACL", "UI": "UI", "ops-only": "ops-only"}
    return " + ".join(sorted(m.get(p, p) for p in pats))


ALL_CODE = dict(NET_CODE, **CODE)
ALL_CLS = dict(NET_CLS, **CLS)


def mermaid_view(nodes, ext=None):
    E = edges()
    L = ['%%{init: {"flowchart": {"nodeSpacing": 22, "rankSpacing": 56, "padding": 6}}}%%', "flowchart TB",
         "    classDef core fill:#1e3a8a,stroke:#1e3a8a,color:#fff",
         "    classDef sup fill:#dbeafe,stroke:#1e40af,color:#172554",
         "    classDef gen fill:#f1f5f9,stroke:#64748b,color:#0f172a",
         "    classDef ext fill:#ffe3e3,stroke:#c92a2a,color:#000"]
    klass = {"Core": "core", "Supporting": "sup", "Generic": "gen"}
    for n in nodes:
        L.append(f'    {ALL_CODE[n]}["{n}"]:::{klass[ALL_CLS[n]]}')
    for (u, d), v in E.items():
        if u in nodes and d in nodes:
            arrow = "==>" if v["events"] else "-->"
            label = pat_short(v['patterns'])
            n = len(v["events"])
            if n:
                label += f" {n}e"
            if v["sync"]:
                label += " +REST"
            L.append(f'    {ALL_CODE[u]} {arrow}|"{label}"| {ALL_CODE[d]}')
    if ext:
        L.extend(ext)
    return "```mermaid\n" + "\n".join(L) + "\n```\n"


NET_UPSTREAM = ["offer-availability", "delivery-promise", "customer-ordering", "order-sourcing", "shipping-and-tracking"]
SF = list(CTX)


def context_map():
    E = edges()
    out = ["---", "id: context-map", "title: Context Map", "sidebar_label: Context Map",
           'description: "Every relationship between the six storefront bounded contexts, the experience layer, the upstream retail-network contexts and the payment provider, with the ddd-crew context-mapping pattern on each edge."',
           "---", "", "# Context Map", "", BANNER, ""]
    out.append("""Following the ddd-crew [Context Mapping](https://github.com/ddd-crew/context-mapping)
notation. On every edge, **U** is upstream and **D** downstream; the pattern
names how the downstream relates to the upstream's model: **OHS** Open Host
Service, **PL** Published Language, **CF** Conformist, **ACL** Anti-Corruption
Layer, **C/S** Customer/Supplier. Thick arrows are Kafka events (CloudEvents
1.0), thin arrows synchronous calls. The storefront is in-org with the retail
network (decision D1): it may consume `retailnetwork.*` topics and call the
network's OHS storefront routes, and **the network never depends on the
storefront** (no network context consumes a storefront topic or calls a
storefront route). The storefront never calls an in-org or restricted network
route (`GET /orders/{id}/ship-to`, `POST /promises`, promise `:confirm` /
`:cancel`, `POST /inventory-feeds`, policy routes).

## The seam to the retail network
""")
    out.append(mermaid_view(SF + NET_UPSTREAM, ext=[
        '    PSP[["payment-provider<br/>(external; payment-provider-simulator in the study)"]]:::ext',
        '    CP -->|"ACL +REST"| PSP',
    ]))
    out.append("Derived from: `model.yaml` → `contexts[*].consumes` (network producers),\n"
               "`contexts[*].sync_calls` (network targets), `external`. The experience layer\n"
               "(`storefront-bff`, `storefront-web`) is not a bounded context: the browser reaches\n"
               "only the BFF under `/api/storefront` (the Storefront Edge), and the BFF composes\n"
               "the six contexts and the network OHS routes.\n")
    out.append("## Inside the storefront\n")
    out.append(mermaid_view(SF))
    out.append("Derived from: `model.yaml` → `contexts[*].publishes[*].consumers`,\n"
               "`contexts[*].sync_calls`, `contexts[*].inbound[*].relationship`. Omitted:\n"
               "analytics-only events, which have no integration consumer.\n")
    out.append("## Every edge\n")
    out.append("| Upstream | Downstream | Pattern | Events (Kafka) | Synchronous calls |")
    out.append("| --- | --- | --- | --- | --- |")
    for (u, d), v in sorted(E.items()):
        evs = ", ".join(f"`{x}`" for x in v["events"]) or "-"
        sy = "; ".join(v["sync"]) or "-"
        out.append(f"| `{u}` | `{d}` | {pat_short(v['patterns'])} | {evs} | {sy} |")
    out.append("| `customer-payments` | `payment-provider` (external) | ACL | none | provider port: Authorize, Capture, Void, Refund, Reauthorize |")
    out.append("")
    out.append("""## Why these patterns

- **`offer-availability` → storefront consumers is Conformist (Published
  Language).** Network item and listing facts are taken as is; only
  `catalogItemId` is the join key.
- **`delivery-promise` → `shopping-cart` is OHS / PL, Conformist.** The quote
  contract is open to any client; the cart stores what the quote returned.
- **`customer-ordering` → `checkout` is OHS + ACL.** The checkout ACL
  translates the network's "Checkout", `offer-not-quotable` and
  `requotedOffers` into storefront terms (place-order step, requote required).
- **`order-sourcing`, `shipping-and-tracking` → `customer-payments` is
  Conformist.** Shipment, cancellation, lost and returned facts drive capture,
  release and refund.
- **`pricing` → cart, discovery and checkout is Customer/Supplier.** Same
  domain, negotiated contract.
- **`customer-payments` → `payment-provider` is ACL.** The provider vocabulary
  stays in one adapter package; the storefront never sees a card number.
- **Sibling data used in a decision is a local, event-fed read model.**
  Synchronous calls exist only where a user request needs an answer, plus the
  declared ops-only bootstrap reads of `product-discovery`.
""")
    return "\n".join(out) + "\n"


def ubiquitous_language():
    out = ["---", "id: ubiquitous-language", "title: Ubiquitous Language", "sidebar_label: Ubiquitous Language",
           'description: "Every term of the digital-storefront domain, the context that owns it, its code identifier, and the network term it must not be confused with."',
           "---", "", "# Ubiquitous Language", "", BANNER, ""]
    out.append("""Each term belongs to the context that owns its meaning. Where the same word
means something else in the retail network, the network counterpart is named.
Code identifiers are the proposed Go package and type names.
""")
    rows = []
    for u in M.get("ul", []):
        rows.append((u["term"].lower(), u["term"], "storefront (domain-wide)", u["definition"], u.get("not_to_be_confused_with", "-"), u["code"]))
    for c in M["contexts"]:
        for u in c.get("ul", []):
            rows.append((u["term"].lower(), u["term"], c["id"], u["definition"], u.get("not_to_be_confused_with", "-"), u["code"]))
    rows.sort()
    out.append("| Term | Context | Definition | Not to be confused with | Code identifier |")
    out.append("| --- | --- | --- | --- | --- |")
    for _, t, ctx, d, ntbc, code in rows:
        out.append(f"| **{t}** | `{ctx}` | {d} | {ntbc} | `{code}` |")
    out.append("")
    out.append("""## Network terms the storefront relies on

These terms belong to the retail network (see
[its ubiquitous language](/network/strategic-design/ubiquitous-language)); the
storefront conforms to them: Catalog Item (`catalogItemId`, the only cross-domain
join key), Listing, Delivery Offer, Service Tier (SAME_DAY, NEXT_DAY, TWO_DAY,
STANDARD), Promise, Shipment Group, Tracking Number, Customer Order, Shopper,
Ship-To. PII terms (Ship-To, names, e-mail) live only in `customer-ordering`;
the storefront stores `shopperId` and `shipToAddressId` references, never the
data.
""")
    return "\n".join(out) + "\n"


def event_standard():
    cv = M["conventions"]["cloudevents"]
    out = ["---", "id: event-standard-cloudevents", "title: Event Standard (CloudEvents)", "sidebar_label: Event Standard",
           'description: "The CloudEvents 1.0 envelope, naming and topic rules every storefront event follows, and the full catalogue of storefront event types."',
           "---", "", "# Event Standard (CloudEvents)", "", BANNER, ""]
    out.append(f"""Every Kafka message in the storefront is a CloudEvents 1.0 structured JSON
envelope, the same rule the fleet and the network apply. The storefront tier
segment is always `storefront` (`com.retailnetwork.storefront.<context>...`),
distinct from the network's `commerce`, `logistics` and `partner` tiers; the
storefront consumes `retailnetwork.*` topics of the network (in-org, D1) and
never produces or consumes a `warehouse.*` topic.

| Attribute | Rule |
| --- | --- |
| `specversion` | `1.0` |
| `type` | `{cv['type']}` |
| `source` | `{cv['source']}` |
| `subject` | {cv['subject']} |
| `dataschema` | `{cv['dataschema']}` |
| `datacontenttype` | `application/json` |
| `id` | UUID; consumers are idempotent on it (inbox table) |
| `time` | the instant the fact became true, not the publish time |
| Topic | `{cv['topic']}` (integration), `{cv['analytics_topic']}` (analytics) |

Tiers (the `<tier>` segment):

| Tier | Contexts |
| --- | --- |""")
    for t, lst in cv["tiers"].items():
        out.append(f"| `{t}` | {', '.join('`'+x+'`' for x in lst)} |")
    out.append("")
    out.append("Integration rules carried by every context:\n")
    for r in M["conventions"]["integration_rules"]:
        out.append(f"- {mdx_braces(r)}")
    out.append("")
    out.append("""## Example envelope

```json
{
  "specversion": "1.0",
  "id": "7b1d3f0e-2c4a-4f7e-9a51-3c2b8e6d1f20",
  "source": "/retailnetwork/checkout",
  "type": "com.retailnetwork.storefront.checkout.checkoutsession.CheckoutCompleted",
  "subject": "cs-01J9Z6Q8K2",
  "time": "2026-10-24T14:05:11Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:checkout:events:CheckoutCompleted:v1",
  "data": {
    "sessionId": "cs-01J9Z6Q8K2",
    "orderId": "co-88231",
    "shopperId": "sh-0042",
    "cartId": "cart-01J9YXY2AB",
    "authorizationId": "pa-01J9Z6R0T4",
    "currency": "USD",
    "totalMinor": 12998,
    "groups": [{"groupNo": 1, "tier": "NEXT_DAY", "amountMinor": 12998}],
    "completedAt": "2026-10-24T14:05:11Z"
  }
}
```

## Event catalogue
""")
    for c in M["contexts"]:
        if not c.get("publishes"):
            continue
        out.append(f"### `{c['id']}`\n")
        out.append(f"Topic `retailnetwork.{c['id']}.events` (analytics-only events on `retailnetwork.{c['id']}.analytics`).\n")
        out.append("| Event | CloudEvents type | Consumers |")
        out.append("| --- | --- | --- |")
        for p in c["publishes"]:
            cons = ", ".join(f"`{x}`" if x in CTX else x for x in p.get("consumers", [])) or "-"
            out.append(f"| `{p['event']}` | `{ce_type(c['id'], p['entity'], p['event'])}` | {cons} |")
        out.append("")
    out.append("""## Consumed network events

The storefront conforms to these network event types (produced on the
network's `commerce` and `logistics` tiers; see the network
[Event Standard](/network/strategic-design/event-standard-cloudevents) for the
full network catalogue):

| Consumer | Event | Producer |
| --- | --- | --- |""")
    seen = set()
    for c in M["contexts"]:
        for x in c.get("consumes", []):
            if x["from"] in CTX:
                continue
            key = (c["id"], x["event"], x["from"])
            if key in seen:
                continue
            seen.add(key)
            out.append(f"| `{c['id']}` | `{x['event']}` | `{x['from']}` |")
    out.append("")
    return "\n".join(out) + "\n"


def subdomain_classification():
    out = ["---", "id: subdomain-classification", "title: Subdomain Classification", "sidebar_label: Subdomain Classification",
           'description: "Core, Supporting or Generic: the six storefront bounded contexts, the deferred and later subdomains, and the verdict rationale for each."',
           "---", "", "# Subdomain Classification", "", BANNER, ""]
    out.append("""Domain-Driven Design splits a domain into **Core**, **Supporting** and
**Generic** subdomains by how much competitive advantage each gives, not by
size or difficulty. The evidence for the verdicts is on
[Benchmarks](/storefront/research/benchmarks).
""")
    out.append("## Problem space: the subdomains\n")
    out.append("| Subdomain | What the business must be good at | Verdict | Why |")
    out.append("| --- | --- | --- | --- |")
    for s in M["subdomains"]:
        why = s.get("rationale") or "-"
        good = s.get("must_be_good_at") or "-"
        out.append(f"| {s['name']} | {good} | {s['verdict']} | {why} |")
    out.append("")
    out.append("""## Solution space: the bounded contexts

Order management and customer accounts are deliberately absent: the network
already owns them (`customer-ordering`). The six contexts map 1:1 onto the
composable-commerce capability lists [18] minus those two.
""")
    out.append("| Bounded context | Classification | Tier | Business model | Evolution | Aggregates |")
    out.append("| --- | --- | --- | --- | --- | --- |")
    badge = {"Core": "badge-core", "Supporting": "badge-supporting", "Generic": "badge-generic"}
    for c in M["contexts"]:
        aggs = ", ".join(a["name"] for a in c.get("aggregates", [])) or "(read side only)"
        cls = c["classification"]
        out.append(f"| `{c['id']}` | <span class=\"{badge[cls]}\">{cls}</span> | `{c['tier']}` | {c['business_model']} | {c['chart']['evolution']} | {aggs} |")
    counts = {}
    for c in M["contexts"]:
        counts[c["classification"]] = counts.get(c["classification"], 0) + 1
    out.append("")
    out.append("Count: " + ", ".join(f"{v} {k}" for k, v in sorted(counts.items(), key=lambda kv: -kv[1])) + ".")
    out.append("")
    out.append("Future contexts named by the model but not built in this phase:\n")
    out.append("| Context | Classification | Note |")
    out.append("| --- | --- | --- |")
    for f in M.get("future_contexts", []):
        out.append(f"| `{f['id']}` | {f['classification']} | {f['note']} |")
    out.append("")
    out.append("""The experience layer (`storefront-bff`, `storefront-web`) and the
`payment-provider-simulator` stand-in carry no domain model and are not
bounded contexts.
""")
    return "\n".join(out) + "\n"


def index():
    out = ["---", "id: index", "title: Strategic Design", "sidebar_label: Overview",
           'description: "The strategic artefacts for the digital storefront: subdomains, context map, ubiquitous language, event standard, gap register and benchmarks."',
           "slug: /strategic-design", "---", "", "# Strategic Design", "", BANNER, ""]
    out.append("""The strategic artefact set for the digital storefront, a second domain in
the retail-network organisation that turns the network's promise engine into a
shop (browse, search, product page with real delivery dates, cart, checkout
with payment, order history and tracking).

| Artefact | Page |
| --- | --- |
| Subdomains and their classification | [Subdomain Classification](/storefront/strategic-design/subdomain-classification) (generated) |
| Relationships and patterns | [Context Map](/storefront/strategic-design/context-map) (generated) |
| Terms | [Ubiquitous Language](/storefront/strategic-design/ubiquitous-language) (generated) |
| Event envelope and catalogue | [Event Standard](/storefront/strategic-design/event-standard-cloudevents) (generated) |
| What the model does not decide yet (S1-S6) | [Model Gap Register](/storefront/strategic-design/model-gap-register) |
| The research the design rules rest on | [Benchmarks](/storefront/research/benchmarks) |

Per-context artefacts (the 14-page ddd-crew packs: Bounded Context Canvas,
Aggregate Design Canvas, EventStorming, class, ER and sequence diagrams) are a
later wave and are **not** part of this instance yet; see
[Bounded Contexts](/storefront/contexts). The upstream network's artefacts are
under [retail-network](/network/).
""")
    return "\n".join(out) + "\n"


PAGES = {
    "docs/strategic-design/index.md": index,
    "docs/strategic-design/context-map.md": context_map,
    "docs/strategic-design/ubiquitous-language.md": ubiquitous_language,
    "docs/strategic-design/event-standard-cloudevents.md": event_standard,
    "docs/strategic-design/subdomain-classification.md": subdomain_classification,
}

BASE = "/storefront"  # routeBasePath of this section's docs instance


def prefix_base(text):
    """Absolute markdown links must carry the section prefix: the pages are
    served under /storefront, a bare /contexts link would resolve into the
    warehouse section of the merged site. Network links already carry /network."""
    return re.sub(r"\]\(/(?!storefront/|network/)", "](" + BASE + "/", text)


def main(argv):
    bad = 0
    for path, fn in PAGES.items():
        full = os.path.join(ROOT, path)
        text = prefix_base(fn())
        if "--check" in argv:
            cur = open(full).read() if os.path.exists(full) else ""
            if cur != text:
                print(f"STALE {path}: run python3 storefront/scripts/gen_pages.py")
                bad += 1
        else:
            os.makedirs(os.path.dirname(full), exist_ok=True)
            open(full, "w").write(text)
            print(f"wrote {path}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
