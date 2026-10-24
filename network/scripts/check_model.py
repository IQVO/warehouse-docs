#!/usr/bin/env python3
"""Consistency gate for model/model.yaml.

Checks, with no third-party dependency beyond PyYAML:
  1. every event a context publishes with a named consumer appears in that
     consumer's `consumes` list with the right producer, and vice versa;
  2. every aggregate's `events` are published by its context;
  3. every transition names a state of its aggregate;
  4. every `inbound` evt row names only events the producer publishes;
  5. --pages: every CloudEvents type / event name printed under docs/ exists
     in the model (catches pages inventing messages).
Exit code 1 on any finding.
"""
import os
import re
import sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.path.join(ROOT, "model", "model.yaml")


def load():
    with open(MODEL) as f:
        return yaml.safe_load(f)


def main(argv):
    m = load()
    ctxs = {c["id"]: c for c in m["contexts"]}
    errs = []
    published = {}  # event -> (ctx, consumers)
    for c in m["contexts"]:
        for p in c.get("publishes", []):
            if p["event"] in published:
                errs.append(f"event {p['event']} published by two contexts")
            published[p["event"]] = (c["id"], [x for x in p.get("consumers", []) if x in ctxs])
    # 1. publish -> consume
    for ev, (prod, cons) in published.items():
        for cc in cons:
            if not any(x["event"] == ev and x["from"] == prod for x in ctxs[cc].get("consumes", [])):
                errs.append(f"{prod} says {cc} consumes {ev}, but {cc}.consumes lacks it")
    # consume -> publish
    for c in m["contexts"]:
        for x in c.get("consumes", []):
            ev, frm = x["event"], x["from"]
            if ev not in published or published[ev][0] != frm:
                errs.append(f"{c['id']} consumes {ev} from {frm}, which does not publish it")
            elif c["id"] not in published[ev][1]:
                errs.append(f"{c['id']} consumes {ev} but {frm} does not list it as a consumer")
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
    # 4 inbound evt rows
    for c in m["contexts"]:
        for row in c.get("inbound", []):
            if row["type"] != "evt" or row["from"] not in ctxs:
                continue
            for name in [s.strip() for s in row["message"].split(",")]:
                if name not in published or published[name][0] != row["from"]:
                    errs.append(f"{c['id']} inbound row names {name} from {row['from']}, not published there")
                if not any(x["event"] == name for x in c.get("consumes", [])):
                    errs.append(f"{c['id']} inbound row names {name} but consumes lacks it")
    # 5 pages
    if "--pages" in argv:
        known = set(published)
        for c in m["contexts"]:
            for a in c.get("aggregates", []):
                known.update(a.get("commands", []))
        typ = re.compile(r"com\.retailnetwork\.([a-z]+)\.([a-z-]+)\.([a-z]+)\.([A-Z][A-Za-z]+)")
        tiers = {ctx: tier for tier, lst in m["conventions"]["cloudevents"]["tiers"].items() for ctx in lst}
        for dp, _, files in os.walk(os.path.join(ROOT, "docs")):
            for fn in files:
                if not fn.endswith((".md", ".mdx")):
                    continue
                path = os.path.join(dp, fn)
                text = open(path).read()
                for mt in typ.finditer(text):
                    tier, ctx, _entity, ev = mt.groups()
                    rel = os.path.relpath(path, ROOT)
                    if ev not in published:
                        errs.append(f"{rel}: unknown event in type {mt.group(0)}")
                    elif published[ev][0] != ctx:
                        errs.append(f"{rel}: {ev} printed under {ctx}, model producer is {published[ev][0]}")
                    elif tiers.get(ctx) != tier:
                        errs.append(f"{rel}: wrong tier segment in {mt.group(0)}")
    for e in errs:
        print("ERROR", e)
    print(f"checked {len(ctxs)} contexts, {len(published)} events: {len(errs)} finding(s)")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
