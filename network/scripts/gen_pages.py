#!/usr/bin/env python3
"""Generate the model-derived strategic pages from model/model.yaml.

Pages written (fully generated; edit this script or the model, not the page):
  docs/strategic-design/context-map.md
  docs/strategic-design/ubiquitous-language.md
  docs/strategic-design/event-standard-cloudevents.md (also the Reason vocabularies section)

  python3 scripts/gen_pages.py           # write
  python3 scripts/gen_pages.py --check   # fail if a page differs from what the model gives
"""
import os
import re
import sys
from collections import OrderedDict, defaultdict

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = yaml.safe_load(open(os.path.join(ROOT, "model", "model.yaml")))
CTX = OrderedDict((c["id"], c) for c in M["contexts"])
TIER = {ctx: t for t, lst in M["conventions"]["cloudevents"]["tiers"].items() for ctx in lst}
CODE = {c["id"]: c["code"] for c in M["contexts"]}
CLS = {c["id"]: c["classification"] for c in M["contexts"]}

BANNER = """:::info[Generated from the model]
This page is generated from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
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
    for c in M["contexts"]:
        for s in c.get("sync_calls", []):
            # caller is downstream (Customer), callee upstream (Supplier)
            k = (s["to"], c["id"])
            d = e.setdefault(k, {"events": [], "sync": [], "patterns": set()})
            d["sync"].append(f"{s['type']} {s['message']} (`{s['channel']}`)")
            d["patterns"].add("Customer/Supplier")
    return e


def pat_short(pats):
    m = {"Conformist": "CF", "Customer/Supplier": "C/S", "OHS": "OHS"}
    return " + ".join(sorted(m.get(p, p) for p in pats))


def mermaid_view(title, nodes, ext=None):
    E = edges()
    L = ['%%{init: {"flowchart": {"nodeSpacing": 22, "rankSpacing": 56, "padding": 6}}}%%', "flowchart TB",
         "    classDef core fill:#1e3a8a,stroke:#1e3a8a,color:#fff",
         "    classDef sup fill:#dbeafe,stroke:#1e40af,color:#172554",
         "    classDef gen fill:#f1f5f9,stroke:#64748b,color:#0f172a",
         "    classDef ext fill:#ffe3e3,stroke:#c92a2a,color:#000"]
    klass = {"Core": "core", "Supporting": "sup", "Generic": "gen"}
    for n in nodes:
        L.append(f'    {CODE[n]}["{n}"]:::{klass[CLS[n]]}')
    for (u, d), v in E.items():
        if u in nodes and d in nodes:
            kind = "evt" if v["events"] else "sync"
            arrow = "==>" if v["events"] else "-->"
            label = pat_short(v['patterns'])
            n = len(v["events"])
            if n:
                label += f" {n}e"
            if v["sync"]:
                label += " +REST"
            L.append(f'    {CODE[u]} {arrow}|"{label}"| {CODE[d]}')
    if ext:
        L.extend(ext)
    return "```mermaid\n" + "\n".join(L) + "\n```\n"


def context_map():
    E = edges()
    out = ["---", "id: context-map", "title: Context Map", "sidebar_label: Context Map",
           'description: "Every relationship between the eleven retail-network bounded contexts and the one seam to the warehouse-systems fleet, with the ddd-crew context-mapping pattern on each edge."',
           "---", "", "# Context Map", "", BANNER, ""]
    out.append("""Following the ddd-crew [Context Mapping](https://github.com/ddd-crew/context-mapping)
notation. On every edge, **U** is upstream and **D** downstream; the pattern
names how the downstream relates to the upstream's model: **OHS** Open Host
Service, **PL** Published Language, **CF** Conformist, **ACL** Anti-Corruption
Layer, **C/S** Customer/Supplier. Thick arrows are Kafka events (CloudEvents
1.0), thin arrows synchronous in-organization REST calls. The map is split
into four views so each stays readable; an edge label such as `CF 3e +REST`
reads "Conformist, three events, plus a synchronous call". The table under the
views lists every edge with its messages.

## The organizational seam

The network and the warehouse-systems fleet are two organizations. The only
channel between them is the Vendor API of `vendor-connectivity`.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 16, "rankSpacing": 40, "padding": 6}}}%%
flowchart TB
    classDef sup fill:#dbeafe,stroke:#1e40af,color:#172554
    classDef ext fill:#ffe3e3,stroke:#c92a2a,color:#000
    classDef fleet fill:#ccfbf1,stroke:#0f766e,color:#042f2e
    subgraph RN["retail-network organization"]
        VC["vendor-connectivity<br/>OHS + PL<br/>Vendor API"]:::sup
    end
    subgraph WS["warehouse-systems organization"]
        NF["network-fulfillment<br/>CF + ACL"]:::fleet
        OM["order-management"]:::fleet
        PPM["process-path-management"]:::fleet
        WWP["wes-work-planning"]:::fleet
        INV["inventory-storage"]:::fleet
    end
    NF -->|"REST: poll POs, acknowledge,<br/>inventory feed, node profile,<br/>labels, shipment confirmation,<br/>poll inbound shipments,<br/>submit inbound receipts"| VC
    NF -->|"held order, FeasibleBy,<br/>release, cancel"| OM
    PPM ==>|"CPT schedule,<br/>cycle time p95"| NF
    WWP ==>|"PathCapacityChanged"| NF
    NF -.->|"usable stock"| INV
```

Derived from: `model.yaml` → `meta.hard_boundary`,
`contexts[vendor-connectivity].inbound`; the fleet side from
`IQVO/network-fulfillment` `internal/application/ports/ports.go` on
`origin/develop`. Separate Ways at the messaging level: no Kafka topic is
shared in either direction. Details on
[WMS/WES Integration](/integration/wms-wes-integration).

## Commerce view: promise, order, sourcing
""")
    out.append(mermaid_view("commerce", ["customer-ordering", "delivery-promise", "order-sourcing", "offer-availability", "vendor-connectivity"]))
    out.append("Derived from: `model.yaml` → `contexts[*].publishes[*].consumers`, `contexts[*].sync_calls`, `contexts[*].inbound[*].relationship`.\n")
    out.append("## Logistics view: topology, middle mile, last mile, tracking\n")
    out.append(mermaid_view("logistics", ["node-topology", "linehaul-transportation", "last-mile-delivery", "shipping-and-tracking", "vendor-connectivity"]))
    out.append("Derived from: same sections as above.\n")
    out.append("## Partner view: sellers, inbound shipments and receipts\n")
    out.append("`seller-inbound` is the proposed eleventh context ([ADR 0009](/adr/0009-seller-inbound-and-case-packed-shipments)). It reaches the vendor only through `vendor-connectivity`.\n")
    out.append(mermaid_view("partner", ["seller-inbound", "vendor-connectivity", "offer-availability", "node-topology", "node-performance"]))
    out.append("Derived from: same sections as above.\n")
    out.append("## Feedback view: what feeds the two Core contexts\n")
    out.append(mermaid_view("feedback", ["node-topology", "offer-availability", "linehaul-transportation", "last-mile-delivery", "node-performance", "delivery-promise", "order-sourcing"]))
    out.append("Derived from: same sections as above. Omitted from all views: analytics-only events, which have no integration consumer.\n")
    out.append("## Every edge\n")
    out.append("| Upstream | Downstream | Pattern | Events (Kafka) | Synchronous calls |")
    out.append("| --- | --- | --- | --- | --- |")
    for (u, d), v in sorted(E.items()):
        evs = ", ".join(f"`{x}`" for x in v["events"]) or "-"
        sy = "; ".join(v["sync"]) or "-"
        out.append(f"| `{u}` | `{d}` | {pat_short(v['patterns'])} | {evs} | {sy} |")
    out.append("| `vendor-connectivity` | `network-fulfillment` (warehouse-systems) | OHS + PL / CF + ACL | none (no shared topic) | Vendor API, called by the downstream |")
    out.append("")
    out.append("""## Why these patterns

- **`node-topology`, `linehaul-transportation`, `last-mile-delivery`,
  `offer-availability` and `node-performance` are upstream of the two Core
  contexts, which conform to their events.** Their facts (a node's profile, a
  departure's remaining capacity, a wave's stops) are not negotiable by the
  promise; the promise keeps local, event-fed copies and makes no synchronous
  call on its hot path.
- **`customer-ordering` → `delivery-promise` is Customer/Supplier.** Checkout
  needs an answer inside the shopper's request, so it calls the promise API;
  the promise context sets the contract.
- **`order-sourcing` ↔ `vendor-connectivity` is Customer/Supplier in both
  directions by event.** Sourcing decides (release, cancel); the vendor
  protocol reports what the vendor did (accepted, rejected, expired, shipped).
- **`vendor-connectivity` is a customer of `node-topology`,
  `offer-availability` and `shipping-and-tracking`.** It is a gateway: it
  validates and times a vendor's write, then hands it to the owner of the
  fact. It never owns node profiles, availability or labels itself.
- **`shipping-and-tracking` → `customer-ordering` is a restricted
  Customer/Supplier read.** The label needs the address; nothing else does.
- **`seller-inbound` ↔ `vendor-connectivity` is Customer/Supplier in both
  directions by event.** The shipment manifest goes out as
  `InboundShipmentShipped`; the vendor's carton-level answer comes back as
  `InboundReceiptSubmitted`. The vendor never calls `seller-inbound`: the
  Vendor API stays the only channel, and the seller never reaches the vendor.
- **`seller-inbound` conforms to `node-topology` and `offer-availability`.**
  A node's inbound limits and a catalogue item's packaging hierarchy are
  their facts; `seller-inbound` keeps local, event-fed copies
  (`NodeInboundView`, `CatalogPackagingView`) and makes no synchronous call.
""")
    return "\n".join(out) + "\n"


def ubiquitous_language():
    out = ["---", "id: ubiquitous-language", "title: Ubiquitous Language", "sidebar_label: Ubiquitous Language",
           'description: "Every term of the retail-network domain, the context that owns it, and its code identifier; with the translation to the warehouse-systems fleet vocabulary."',
           "---", "", "# Ubiquitous Language", "", BANNER, ""]
    out.append("""Each term belongs to the context that owns its meaning. Where the same word
appears in two contexts with two meanings, both are listed. Code identifiers
are the proposed Go package and type names. Each context's own
[ubiquitous-language page](/contexts) adds usage notes.
""")
    rows = []
    for c in M["contexts"]:
        for u in c.get("ul", []):
            rows.append((u["term"].lower(), u["term"], c["id"], u["definition"], u["code"]))
    rows.sort()
    out.append("| Term | Context | Definition | Code identifier |")
    out.append("| --- | --- | --- | --- |")
    for _, t, ctx, d, code in rows:
        out.append(f"| **{t}** | `{ctx}` | {d} | `{code}` |")
    out.append("")
    out.append("""## Node types

| Node type | Operator | Capabilities | Meaning |
| --- | --- | --- | --- |""")
    for nt, v in M["node_types"].items():
        out.append(f"| `{nt}` | {', '.join(v['operator_allowed'])} | {', '.join(v['capabilities'])} | {v['description']} |")
    out.append("")
    out.append("""## Service tiers

| Tier | Max calendar days | May use nominal lane times |
| --- | --- | --- |""")
    for t, v in M["service_tiers"].items():
        out.append(f"| `{t}` | {v['max_calendar_days']} | {'yes (basis NOMINAL)' if v['nominal_fallback'] else 'no'} |")
    out.append("")
    out.append("""## Translation to the warehouse-systems fleet

The two organizations deliberately use different words. The translation
happens in exactly one place: the fleet's `network-fulfillment`
Anti-Corruption Layer (its `internal/adapters/outbound/network/` package
today, renamed `outbound/retailnetwork/` by its ADR 0009). Fleet terms below
are read from `IQVO/network-fulfillment`, `IQVO/order-management` and
`IQVO/facility-layout` on `origin/develop`.

| retail-network term | warehouse-systems term | Note |
| --- | --- | --- |
| Vendor V-WS | the fleet | one vendor among many |
| Node (`nodeId`) | Site (`siteCode`) | mapping persisted in `network-fulfillment`, never a string convention |
| `vendorNodeCode` | `siteCode` | what the fleet sends when it registers a node |
| Node type `FULFILLMENT_CENTER` + subtype | `siteRole` (facility-layout ADR 0037) | see [Node model](/network-model/node-model) |
| Cutoff / pickup departure | CPT (`CPTSchedule`, process-path-management ADR 0010) | the fleet's CPT **is** the network's pickup cutoff at that node |
| Handling Time | `cycleTimeP95` of the eligible path | declared from the fleet's own number |
| Throughput Cap / cutoff `maxOrders` | remaining path capacity (`PathCapacityChanged`) | |
| Listing availability + basis | `CapabilityOffer{advertisedQuantity, basis}` | `PHYSICAL` / `THROUGHPUT_CONSTRAINED` exist on both sides |
| Purchase Order (`poNumber`) | `NetworkOrder` (`NetworkRef`) | |
| Required Ship-By | `requiredShipBy`, checked by OM `FeasibleBy` | |
| Acknowledgement accept / reject | `SubmitAcknowledgement(accepted)` | fill-or-kill on both sides |
| `CANNOT_MEET_SHIP_BY` | `INFEASIBLE_DEADLINE` | reject reason |
| `UNKNOWN_LISTING` | `UNTRANSLATABLE_SKU` | reject reason |
| Purchase order `EXPIRED` | `ACKNOWLEDGEMENT_DEADLINE_MISSED` | |
| Transaction (`transactionId`) | `SubmissionStatus` | pending until reconciled |
| Label (`labelRef`, `trackingNumber`) | `LabelResult` | no address on either side of the seam |
| Promise / deliver-by window | (none) | the fleet never sees the delivery promise; it sees only `requiredShipBy` |
""")
    return "\n".join(out) + "\n"


def event_standard():
    cv = M["conventions"]["cloudevents"]
    out = ["---", "id: event-standard-cloudevents", "title: Event Standard (CloudEvents)", "sidebar_label: Event Standard",
           'description: "The CloudEvents 1.0 envelope, naming and topic rules every retail-network event follows, and the full catalogue of event types."',
           "---", "", "# Event Standard (CloudEvents)", "", BANNER, ""]
    out.append(f"""Every Kafka message in the network is a CloudEvents 1.0 structured JSON
envelope, the same rule the warehouse-systems fleet applies to itself. The
namespace is different on purpose (see
[ADR 0007](/adr/0007-cloudevents-namespace)): the two organizations share no
topic, so no consumer can mistake one organization's event for the other's.

| Attribute | Rule |
| --- | --- |
| `specversion` | `1.0` |
| `type` | `{cv['type']}` ({cv['entity_rule']}) |
| `source` | `{cv['source']}` |
| `subject` | {cv['subject']} |
| `dataschema` | `{cv['dataschema']}` |
| `datacontenttype` | `application/json` |
| `id` | UUID; consumers are idempotent on it (inbox table `processed_events`) |
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
        out.append(f"- {r}")
    out.append("")
    out.append("""## Example envelope

```json
{
  "specversion": "1.0",
  "id": "7b1d3f0e-2c4a-4f7e-9a51-3c2b8e6d1f20",
  "source": "/retailnetwork/order-sourcing",
  "type": "com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReleasedToNode",
  "subject": "asg-01J9Z6Q8K2",
  "time": "2026-10-22T14:05:11Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:order-sourcing:events:FulfillmentReleasedToNode:v1",
  "data": {
    "assignmentId": "asg-01J9Z6Q8K2",
    "releaseNo": 1,
    "orderId": "co-88231",
    "groupNo": 1,
    "nodeId": "N-VWS-AUS3",
    "pickupDepartureId": "dep-AUS3-20261022-1800",
    "requiredShipBy": "2026-10-22T23:00:00Z",
    "promisedDeliverByLatest": "2026-10-23T21:00:00Z",
    "tier": "NEXT_DAY",
    "lines": [{"catalogItemId": "ci-1001", "listingId": "lst-1001-AUS3", "quantity": 2}]
  }
}
```

## Event catalogue
""")
    for c in M["contexts"]:
        if not c.get("publishes"):
            continue
        out.append(f"### `{c['id']}`\n")
        out.append(f"Topic `retailnetwork.{c['id']}.events`.\n")
        out.append("| Event | CloudEvents type | Consumers |")
        out.append("| --- | --- | --- |")
        for p in c["publishes"]:
            cons = ", ".join(f"`{x}`" if x in CTX else x for x in p.get("consumers", [])) or "-"
            out.append(f"| `{p['event']}` | `{ce_type(c['id'], p['entity'], p['event'])}` | {cons} |")
        out.append("")
    out.extend(reason_vocabularies())
    return "\n".join(out) + "\n"


def where(f):
    if f.startswith("rest:"):
        return f"REST `{f[5:]}`"
    if f.startswith("stored:"):
        return f"stored by `{f[7:]}`"
    return f"`{f}`"


def reason_vocabularies():
    """The `Reason vocabularies` section: one table per vocabulary of each
    context's `reasons`, plus the contexts that own none."""
    out = ["## Reason vocabularies", "",
           "Closed vocabularies of reason-like fields (`reason`, `cause`, `kind`, `outcome`), "
           "one block per owning context, from `contexts[*].reasons` in the model. A value is "
           "listed only when the spec or the domain code of the built service has it. Fields "
           "that carry free text are not listed. A consumer line names a consumer that "
           "branches on a value; consumers that only store the text are not listed.", ""]
    for c in M["contexts"]:
        if not c.get("reasons"):
            continue
        out.append(f"### Reasons of `{c['id']}`")
        out.append("")
        for r in c["reasons"]:
            out.append(f"**`{r['name']}`**: {r['about']}")
            out.append("")
            out.append("Appears in: " + ", ".join(where(f) for f in r["fields"]) + ".")
            out.append("")
            out.append("| Value | Meaning |")
            out.append("| --- | --- |")
            for v in r["values"]:
                out.append(f"| `{v['value']}` | {v['meaning']} |")
            out.append("")
            for cons in r.get("consumers", []):
                uses = ", ".join(f"`{u}`" for u in cons["uses"])
                out.append(f"Branched on by `{cons['context']}` ({uses}): {cons['rule']}")
                out.append("")
    none = [c["id"] for c in M["contexts"] if not c.get("reasons")]
    if none:
        out.append("Contexts that own no closed reason vocabulary (their reason fields, if any, are free text): "
                   + ", ".join(f"`{x}`" for x in none) + ".")
        out.append("")
    return out


PAGES = {
    "docs/strategic-design/context-map.md": context_map,
    "docs/strategic-design/ubiquitous-language.md": ubiquitous_language,
    "docs/strategic-design/event-standard-cloudevents.md": event_standard,
}


BASE = "/network"  # routeBasePath of this section's docs instance


def prefix_base(text):
    """Absolute markdown links must carry the section prefix: the pages are
    served under /network, a bare /contexts link would resolve into the
    warehouse section of the merged site."""
    return re.sub(r"\]\(/(?!network/)", "](" + BASE + "/", text)


def main(argv):
    bad = 0
    for path, fn in PAGES.items():
        full = os.path.join(ROOT, path)
        text = prefix_base(fn())
        if "--check" in argv:
            cur = open(full).read() if os.path.exists(full) else ""
            if cur != text:
                print(f"STALE {path}: run python3 scripts/gen_pages.py")
                bad += 1
        else:
            os.makedirs(os.path.dirname(full), exist_ok=True)
            open(full, "w").write(text)
            print(f"wrote {path}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
