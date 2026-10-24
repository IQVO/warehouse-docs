#!/usr/bin/env python3
"""Consistency gate for storefront/model/model.yaml.

A port of network/scripts/check_model.py, PLUS cross-model rules that load
network/model/model.yaml READ-ONLY (path from conventions.cross_model):

  1. publish/consume symmetry INSIDE the storefront domain (the network never
     consumes a storefront event; a storefront `consumes` row naming a network
     producer is checked against the network model instead, rule 6);
  2. every aggregate's `events` are published by its context;
  3. every transition names a state of its aggregate;
  4. every `inbound` evt row names only events the producer publishes
     (storefront or network producer);
  5. --pages: every CloudEvents type / event name printed under docs/ exists
     in the storefront or network model, with the right producer and tier
     (storefront contexts only ever use the `storefront` tier);
  6. cross-model consumes: every network event the storefront consumes exists
     in that network context's `publishes`, and every field the consumer
     declares it needs exists in the producer's data fields;
  7. cross-model sync_calls: every storefront sync_call targeting a network
     context names a route in that context's `rest` AND an `inbound` row whose
     caller is "shopper / storefront" (exceptions: the ops-only rows listed in
     conventions.cross_model.ops_only_exceptions); no sync_call may target a
     route the network marks restricted or in-org
     (conventions.cross_model.forbidden_routes).

Exit code 1 on any finding.
"""
import os
import re
import sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.path.join(ROOT, "model", "model.yaml")

ANALYTICS = "analytics only"


def load(path):
    with open(path) as f:
        return yaml.safe_load(f)


def data_fields(data):
    """All identifier tokens of a publishes.data list, incl. nested
    `groups(groupNo, lines(lineNo, ...))` entries."""
    out = set()
    for entry in data or []:
        out.update(re.findall(r"[a-zA-Z][a-zA-Z0-9]*", str(entry)))
    return out


def rest_route(channel):
    """'REST POST /x' -> 'POST /x'; anything else -> None."""
    m = re.match(r"REST\s+(GET|POST|PUT|DELETE|PATCH)\s+(\S+)", channel or "")
    return f"{m.group(1)} {m.group(2)}" if m else None


def main(argv):
    m = load(MODEL)
    ctxs = {c["id"]: c for c in m["contexts"]}
    errs = []

    xm = m["conventions"].get("cross_model", {})
    net = None
    net_ctxs, net_published = {}, {}
    ohs_caller = xm.get("ohs_caller", "shopper / storefront")
    exceptions = {(e["context"], e["route"]) for e in xm.get("ops_only_exceptions", [])}
    forbidden = set(xm.get("forbidden_routes", []))
    if xm.get("network_model"):
        net = load(os.path.normpath(os.path.join(os.path.dirname(MODEL), xm["network_model"])))
        net_ctxs = {c["id"]: c for c in net["contexts"]}
        for c in net["contexts"]:
            for p in c.get("publishes", []):
                net_published[p["event"]] = (c["id"], p)

    published = {}  # event -> (ctx, publish entry), storefront only
    for c in m["contexts"]:
        for p in c.get("publishes", []):
            if p["event"] in published:
                errs.append(f"event {p['event']} published by two storefront contexts")
            published[p["event"]] = (c["id"], p)

    # 1. publish -> consume (storefront-internal only; the network never
    #    consumes a storefront event, so a consumer must be a storefront
    #    context or "analytics only")
    for ev, (prod, p) in published.items():
        for cc in p.get("consumers", []):
            if cc == ANALYTICS:
                continue
            if cc in net_ctxs:
                errs.append(f"{prod} lists network context {cc} as a consumer of {ev}: the network never depends on the storefront")
                continue
            if cc not in ctxs:
                errs.append(f"{prod} lists unknown consumer {cc} of {ev}")
                continue
            if not any(x["event"] == ev and x["from"] == prod for x in ctxs[cc].get("consumes", [])):
                errs.append(f"{prod} says {cc} consumes {ev}, but {cc}.consumes lacks it")
    # consume -> publish (storefront producers); network producers via rule 6
    for c in m["contexts"]:
        for x in c.get("consumes", []):
            ev, frm = x["event"], x["from"]
            if frm in ctxs:
                if ev not in published or published[ev][0] != frm:
                    errs.append(f"{c['id']} consumes {ev} from {frm}, which does not publish it")
                elif c["id"] not in [cc for cc in published[ev][1].get("consumers", [])]:
                    errs.append(f"{c['id']} consumes {ev} but {frm} does not list it as a consumer")
            elif frm not in net_ctxs:
                errs.append(f"{c['id']} consumes {ev} from unknown context {frm}")
            # declared fields must exist in the producer's data (either model)
            prod_entry = None
            if frm in ctxs and ev in published and published[ev][0] == frm:
                prod_entry = published[ev][1]
            elif frm in net_ctxs and ev in net_published and net_published[ev][0] == frm:
                prod_entry = net_published[ev][1]
            if prod_entry is not None:
                missing = [f for f in x.get("fields", []) if f not in data_fields(prod_entry.get("data"))]
                if missing:
                    errs.append(f"{c['id']} consumes {ev} from {frm} needing fields {missing}, absent from the producer's data")

    # 2/3 aggregates
    for c in m["contexts"]:
        pubs = {p["event"] for p in c.get("publishes", [])}
        for a in c.get("aggregates", []):
            for e in a.get("events", []):
                if e not in pubs:
                    errs.append(f"{c['id']}.{a['name']} event {e} not in publishes")
            states = set(a.get("states", []))
            for t in a.get("transitions", []):
                if t[0] not in states or t[1] not in states:
                    errs.append(f"{c['id']}.{a['name']} transition {t} uses unknown state")

    # 4 inbound evt rows (storefront or network producer)
    for c in m["contexts"]:
        for row in c.get("inbound", []):
            if row["type"] != "evt" or (row["from"] not in ctxs and row["from"] not in net_ctxs):
                continue
            for name in [s.strip() for s in row["message"].split(",")]:
                ok_sf = name in published and published[name][0] == row["from"]
                ok_net = name in net_published and net_published[name][0] == row["from"]
                if not (ok_sf or ok_net):
                    errs.append(f"{c['id']} inbound row names {name} from {row['from']}, not published there")
                if not any(x["event"] == name for x in c.get("consumes", [])):
                    errs.append(f"{c['id']} inbound row names {name} but consumes lacks it")

    # 5. every storefront context lives in the storefront tier
    tiers = {ctx: tier for tier, lst in m["conventions"]["cloudevents"]["tiers"].items() for ctx in lst}
    for c in m["contexts"]:
        if tiers.get(c["id"]) != "storefront" or c.get("tier") != "storefront":
            errs.append(f"{c['id']} must carry the storefront tier (model tier={c.get('tier')}, conventions tier={tiers.get(c['id'])})")

    # 6. cross-model consumes: the event exists in the network producer's
    #    publishes (fields already checked above)
    if net is not None:
        for c in m["contexts"]:
            for x in c.get("consumes", []):
                if x["from"] in net_ctxs:
                    ev = x["event"]
                    if ev not in net_published or net_published[ev][0] != x["from"]:
                        errs.append(f"{c['id']} consumes {ev} from network context {x['from']}, which does not publish it")
                    elif ev in published:
                        errs.append(f"{ev} is published by both a storefront and a network context")

    # 7. cross-model sync_calls: route exists in the network context's rest,
    #    an inbound row names the OHS caller for it (or it is a declared
    #    ops-only exception), and it is never a restricted or in-org route
    if net is not None:
        restricted = {}  # (ctx, route) -> marking, derived from the network model
        for nc in net["contexts"]:
            ohs_routes = {
                r
                for row in nc.get("inbound", [])
                if row.get("from") == ohs_caller
                for r in [rest_route(row.get("channel", ""))]
                if r and r in row.get("channel", "")
            }
            for row in nc.get("inbound", []):
                chan = row.get("channel", "")
                if "in-org" in chan or "restricted" in chan:
                    r = rest_route(chan)
                    # a route that is also an OHS storefront route is not restricted
                    if r and r not in ohs_routes:
                        restricted[(nc["id"], r)] = "restricted/in-org"
        for route in forbidden:
            for ncid in net_ctxs:
                restricted.setdefault((ncid, route), "forbidden (00-common rule 3)")
        for c in m["contexts"]:
            for s in c.get("sync_calls", []):
                to = s["to"]
                if to not in net_ctxs:
                    continue
                route = rest_route(s.get("channel", ""))
                if route is None:
                    errs.append(f"{c['id']} sync_call to {to} has no REST route in channel {s.get('channel')!r}")
                    continue
                nc = net_ctxs[to]
                if route not in nc.get("rest", []):
                    errs.append(f"{c['id']} calls {route} on {to}, absent from that context's rest")
                if (to, route) in restricted and (to, route) not in exceptions:
                    errs.append(f"{c['id']} calls {route} on {to}, which the network marks {restricted[(to, route)]}")
                ohs = any(
                    row.get("from") == ohs_caller and route in row.get("channel", "")
                    for row in nc.get("inbound", [])
                )
                if not ohs and (to, route) not in exceptions and not s.get("ops_only"):
                    errs.append(f"{c['id']} calls {route} on {to}, but no inbound row there names caller {ohs_caller!r} (and it is not a declared ops-only exception)")
        # declared exceptions must be real routes
        for to, route in exceptions:
            if to in net_ctxs and route not in net_ctxs[to].get("rest", []):
                errs.append(f"ops-only exception names {route} on {to}, absent from that context's rest")

    # --pages: every CloudEvents type printed under docs/ exists in one of
    # the two models, with the right producer and tier
    if "--pages" in argv:
        all_pub = {}  # event -> (ctx, tier)
        for ev, (ctx, _p) in published.items():
            all_pub[ev] = (ctx, "storefront")
        net_tiers = {}
        if net is not None:
            net_tiers = {ctx: t for t, lst in net["conventions"]["cloudevents"]["tiers"].items() for ctx in lst}
            for ev, (ctx, _p) in net_published.items():
                all_pub.setdefault(ev, (ctx, net_tiers.get(ctx)))
        typ = re.compile(r"com\.retailnetwork\.([a-z]+)\.([a-z-]+)\.([a-z]+)\.([A-Z][A-Za-z]+)")
        for dp, _, files in os.walk(os.path.join(ROOT, "docs")):
            for fn in files:
                if not fn.endswith((".md", ".mdx")):
                    continue
                path = os.path.join(dp, fn)
                text = open(path).read()
                for mt in typ.finditer(text):
                    tier, ctx, _entity, ev = mt.groups()
                    rel = os.path.relpath(path, ROOT)
                    if ev not in all_pub:
                        errs.append(f"{rel}: unknown event in type {mt.group(0)}")
                    elif all_pub[ev][0] != ctx:
                        errs.append(f"{rel}: {ev} printed under {ctx}, model producer is {all_pub[ev][0]}")
                    elif all_pub[ev][1] != tier:
                        errs.append(f"{rel}: wrong tier segment in {mt.group(0)} (want {all_pub[ev][1]})")

    for e in errs:
        print("ERROR", e)
    print(f"checked {len(ctxs)} storefront contexts, {len(published)} storefront events "
          f"(+{len(net_published)} network events read-only): {len(errs)} finding(s)")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
