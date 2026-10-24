#!/usr/bin/env python3
"""Consistency gate for model/model.yaml.

Checks, with no third-party dependency beyond PyYAML:
  1. every event a context publishes with a named consumer appears in that
     consumer's `consumes` list with the right producer, and vice versa;
  2. every aggregate's `events` are published by its context;
  3. every transition names a state of its aggregate;
  4. every `inbound` evt row names only events the producer publishes;
  5. every context has a `reasons` list; each entry's fields are published event
     data fields (or REST schema fields in apis/<ctx>/openapi.yaml, or a stored
     aggregate), values are unique UPPER_SNAKE and match the OpenAPI enum when
     there is one, and a consumer that branches on a value uses one the
     producer lists;
  6. REST routes <-> inbound rows <-> callers' `sync_calls` (gap G36). Every
     inbound cmd/qry row carries `routes: ["POST /nodes", ...]`, exact
     method+path strings (query part ignored when comparing):
       a. each row has a non-empty `routes` list and every entry is a route in
          that context's `rest`;
       b. every `rest` route is listed by at least one inbound row;
       c. for a row whose `from` is another context id, that context's
          `sync_calls` has an entry with `to` == this context, the same `type`,
          whose channel text names the method+path of every route of the row
          (compact form 'REST POST /a, PUT /b/{id}' is read); and every route
          a `sync_calls` entry names is listed by a matching inbound row of the
          callee (same caller, same type). One route may appear in several
          rows, one per (caller, relationship).
  7. --pages: every CloudEvents type / event name printed under docs/ exists
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


UPPER_SNAKE = re.compile(r"^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$")
_openapi_cache = {}


def openapi_schemas(ctx):
    if ctx not in _openapi_cache:
        path = os.path.join(ROOT, "apis", ctx, "openapi.yaml")
        schemas = None
        if os.path.exists(path):
            with open(path) as f:
                schemas = (yaml.safe_load(f).get("components") or {}).get("schemas") or {}
        _openapi_cache[ctx] = schemas
    return _openapi_cache[ctx]


def rest_enum(schemas, ref):
    """Resolve 'Schema' or 'Schema.field' in an OpenAPI schema map.
    Returns (found, enum or None)."""
    name, _, field = ref.partition(".")
    node = schemas.get(name)
    if node is None:
        return False, None
    if field:
        props = dict(node.get("properties") or {})
        for part in node.get("allOf") or []:
            props.update(part.get("properties") or {})
        if field not in props:
            return False, None
        node = props[field]
    for _ in range(5):  # follow $ref chains
        if "enum" in node:
            return True, list(node["enum"])
        r = node.get("$ref", "")
        if not r.startswith("#/components/schemas/") or r.rsplit("/", 1)[-1] not in schemas:
            break
        node = schemas[r.rsplit("/", 1)[-1]]
    return True, None


def check_reasons(m, ctxs):
    """Every context has a `reasons` list; each entry names fields that exist,
    holds unique UPPER_SNAKE values, and every consumer that branches on a
    value uses one the producer lists."""
    errs = []
    for c in m["contexts"]:
        cid = c["id"]
        if not isinstance(c.get("reasons"), list):
            errs.append(f"{cid}: missing `reasons:` list (use `reasons: []` when the context owns no closed vocabulary)")
            continue
        pubs = {p["event"]: p for p in c.get("publishes", [])}
        aggs = {a["name"] for a in c.get("aggregates", [])}
        names = set()
        for r in c["reasons"]:
            where = f"{cid}.reasons[{r.get('name', '?')}]"
            for key in ("name", "fields", "values"):
                if not r.get(key):
                    errs.append(f"{where}: missing `{key}`")
            if r.get("name") in names:
                errs.append(f"{where}: name is used twice in this context")
            names.add(r.get("name"))
            values = []
            for v in r.get("values") or []:
                val = v.get("value")
                if not isinstance(val, str) or not UPPER_SNAKE.match(val):
                    errs.append(f"{where}: value {val!r} is not UPPER_SNAKE")
                if val in values:
                    errs.append(f"{where}: value {val} is listed twice")
                values.append(val)
                meaning = v.get("meaning")
                if not meaning:
                    errs.append(f"{where}: value {val} has no meaning")
                elif re.search(r"[<>{}|]", meaning):
                    errs.append(f"{where}: meaning of {val} has one of < > {{ }} | (breaks MDX or the table)")
            event_fields = []
            for f in r.get("fields") or []:
                if f.startswith("rest:"):
                    schemas = openapi_schemas(cid)
                    if schemas is None:
                        errs.append(f"{where}: {f} but apis/{cid}/openapi.yaml does not exist")
                        continue
                    found, enum = rest_enum(schemas, f[5:])
                    if not found:
                        errs.append(f"{where}: REST schema field {f[5:]} is not in apis/{cid}/openapi.yaml")
                    elif enum is not None and set(enum) != set(values):
                        errs.append(f"{where}: values differ from the OpenAPI enum of {f[5:]}: "
                                    f"only in model {sorted(set(values) - set(enum))}, only in OpenAPI {sorted(set(enum) - set(values))}")
                elif f.startswith("stored:"):
                    if f[7:] not in aggs:
                        errs.append(f"{where}: {f} names no aggregate of {cid}")
                else:
                    ev, _, fld = f.partition(".")
                    if ev not in pubs:
                        errs.append(f"{where}: field {f} names an event {cid} does not publish")
                    elif fld not in pubs[ev].get("data", []):
                        errs.append(f"{where}: field {f} is not in the data of {ev} ({', '.join(pubs[ev].get('data', []))})")
                    else:
                        event_fields.append(ev)
            for cons in r.get("consumers") or []:
                cc = cons.get("context")
                if cc not in ctxs:
                    errs.append(f"{where}: consumer {cc!r} is not a context")
                    continue
                for u in cons.get("uses") or []:
                    if u not in values:
                        errs.append(f"{where}: {cc} branches on {u}, which {cid} does not list")
                if not cons.get("uses"):
                    errs.append(f"{where}: consumer {cc} lists no `uses`")
                got = {x["event"] for x in ctxs[cc].get("consumes", []) if x["from"] == cid}
                if not got & set(event_fields):
                    errs.append(f"{where}: {cc} branches on a value but consumes none of {sorted(set(event_fields)) or 'any event carrying it'} from {cid}")
    return errs


METHOD = r"(?:GET|POST|PUT|PATCH|DELETE)"
CALL = re.compile(r"\b(" + METHOD + r")\s+(/[^\s,;()]*)")


def norm(route):
    """'GET /nodes?type=' -> ('GET', '/nodes'); None if not method+path."""
    m = re.fullmatch(r"(" + METHOD + r")\s+(/[^\s?]*)(?:\?\S*)?", route.strip())
    return (m.group(1), m.group(2)) if m else None


def named_routes(channel):
    """Every method+path a free-text channel names, query stripped."""
    return {(m, p.split("?")[0]) for m, p in CALL.findall(channel)}


def fmt(r):
    return f"{r[0]} {r[1]}"


def check_routes(ctxs, errs):
    for c in ctxs.values():
        cid = c["id"]
        rest = {}
        for r in c.get("rest", []):
            n = norm(r)
            if n is None:
                errs.append(f"{cid} rest entry {r!r} is not 'METHOD /path'")
            else:
                rest[n] = r
        listed = set()
        for row in c.get("inbound", []):
            if row["type"] not in ("cmd", "qry"):
                continue
            who = f"{cid} inbound row from {row['from']} ({row['type']} {row['message']})"
            routes = row.get("routes") or []
            if not routes:
                errs.append(f"{who} has no `routes` list")
                continue
            parsed = set()
            for r in routes:
                n = norm(r)
                if n is None:
                    errs.append(f"{who}: route {r!r} is not 'METHOD /path'")
                elif n not in rest:
                    errs.append(f"{who}: route {r} is not in {cid}.rest")
                else:
                    parsed.add(n)
                    listed.add(n)
            frm = row["from"]
            if frm in ctxs and frm != cid:
                calls = [s for s in ctxs[frm].get("sync_calls", []) if s["to"] == cid and s["type"] == row["type"]]
                if not any(parsed <= named_routes(s["channel"]) for s in calls):
                    errs.append(f"{who}: no {frm}.sync_calls entry (to {cid}, type {row['type']}) names {', '.join(fmt(n) for n in sorted(parsed))}")
        for n, r in rest.items():
            if n not in listed:
                errs.append(f"{cid} rest route {r} is listed by no inbound row")
    # c (converse): sync_calls entry -> callee rest route + inbound row of the callee
    for c in ctxs.values():
        for s in c.get("sync_calls", []):
            callee = ctxs.get(s["to"])
            who = f"{c['id']}.sync_calls to {s['to']} ({s['type']} {s['message']})"
            if callee is None:
                errs.append(f"{who}: callee is not a context")
                continue
            named = named_routes(s["channel"])
            if not named:
                errs.append(f"{who}: channel {s['channel']!r} names no METHOD /path")
            for n in sorted(named):
                rows = [r for r in callee.get("inbound", []) if r["from"] == c["id"] and r["type"] == s["type"]
                        and n in {norm(x) for x in r.get("routes", [])}]
                if not rows:
                    errs.append(f"{who}: no {s['to']} inbound row from {c['id']} ({s['type']}) lists {fmt(n)}")


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
    # 5 reason vocabularies
    errs.extend(check_reasons(m, ctxs))
    # 6 REST routes, inbound rows, callers' sync_calls
    check_routes(ctxs, errs)
    # 7 pages
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
