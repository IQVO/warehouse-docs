#!/usr/bin/env python3
"""Consistency gate for the yard model (model.yaml), BUILT on develop 2026-11-08.

Same intent as warehouse-docs network/scripts/check_model.py, smaller:

1. every aggregate transition uses declared states;
2. an aggregate's events == the events published with its entity;
3. every invariant error name is unique inside its context;
4. every inbound REST route appears in the context's `rest` list and back;
5. publish/consume symmetry between the two yard contexts;
6. a consumer outside the model has a `fleet_changes` row;
7. every CONSUMED fleet event exists in the producer's AsyncAPI (this repo's
   apis/<repo>/asyncapi.yaml copy; --fleet reads origin/develop live), with the fields the model relies on (read via git show,
   never from a design document).

8. (as built) each yard context's published events, their stream (integration vs analytics only), their `data` fields and its REST routes
   equal what its own contract says: yard/apis/<context>/{asyncapi,openapi,openapi-reports}.yaml (--fleet reads origin/develop).

Usage: python3 yard/scripts/check_model.py [--model yard/model/model.yaml] [--fleet ~/warehouse-systems]
Exit 0 = clean; 1 = findings (printed).
"""
import argparse
import os
import re
import subprocess
import sys

import yaml

TOPIC_REPO = {
    "warehouse.facility.events": "facility-layout",
    "warehouse.inbound-receiving.events": "inbound-receiving",
    "warehouse.process-path-management.events": "process-path-management",
}


REPO_ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


def producer_messages(fleet, repo):
    """Return {message name: set(property names)} from the producer's AsyncAPI.

    fleet=None (CI default): the copy in this repo, apis/<repo>/asyncapi.yaml.
    fleet=<dir>: the sibling checkout's origin/develop:apis/asyncapi.yaml (live mode).
    """
    if fleet is None:
        path = os.path.join(REPO_ROOT, "apis", repo, "asyncapi.yaml")
        if not os.path.exists(path):
            return None
        doc = yaml.safe_load(open(path))
    else:
        out = subprocess.run(
            ["git", "-C", os.path.join(fleet, repo), "show", "origin/develop:apis/asyncapi.yaml"],
            capture_output=True, text=True, check=False,
        )
        if out.returncode != 0:
            return None
        doc = yaml.safe_load(out.stdout)
    result = {}
    for key, msg in (doc.get("components", {}).get("messages", {}) or {}).items():
        props = set()

        def walk(node):
            if isinstance(node, dict):
                if isinstance(node.get("properties"), dict):
                    props.update(node["properties"].keys())
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)

        walk(msg.get("payload", {}))
        schemas = doc.get("components", {}).get("schemas", {}) or {}
        # resolve one level of $ref into components.schemas (inbound-receiving style)
        text = yaml.safe_dump(msg.get("payload", {}))
        for name, schema in schemas.items():
            if f"#/components/schemas/{name}" in text:
                walk(schema)
        for example in msg.get("examples", []) or []:
            data = (example.get("payload") or {}).get("data")
            if isinstance(data, dict):
                props.update(data.keys())
        name = msg.get("name") or key
        result.setdefault(name, set()).update(props)
        result.setdefault(key, set()).update(props)
    return result


RX_TYPE = re.compile(r"com\.warehouse\.[a-z]+\.([a-z-]+)\.([a-z]+)\.([A-Za-z]+)")
INFRA = {"/healthz", "/readyz", "/livez", "/metrics"}


def own_spec(fleet, repo, name):
    """The context's own contract file: this repo's copy under yard/apis, or sibling origin/develop (--fleet)."""
    if fleet is None:
        path = os.path.join(REPO_ROOT, "yard", "apis", repo, name)
        return yaml.safe_load(open(path)) if os.path.exists(path) else None
    out = subprocess.run(["git", "-C", os.path.join(fleet, repo), "show", f"origin/develop:apis/{name}"],
                         capture_output=True, text=True, check=False)
    return yaml.safe_load(out.stdout) if out.returncode == 0 else None


def resolve(doc, node, depth=0):
    if depth > 8 or not isinstance(node, dict):
        return node
    if "$ref" in node:
        cur = doc
        for part in node["$ref"].lstrip("#/").split("/"):
            cur = cur[part]
        return resolve(doc, cur, depth + 1)
    out = dict(node)
    if "allOf" in node:
        props = {}
        for part in node["allOf"]:
            props.update(resolve(doc, part, depth + 1).get("properties", {}) or {})
        out["properties"] = {**props, **(out.get("properties") or {})}
    return out


def own_events(doc, cid):
    """{event: {"entity", "fields", "streams"}} for the types this context publishes on its own two topics."""
    pubs = {}
    for key, ch in (doc.get("channels") or {}).items():
        topic = ch.get("address") or key
        if topic not in (f"warehouse.{cid}.events", f"warehouse.{cid}.analytics"):
            continue
        stream = "analytics" if topic.endswith(".analytics") else "events"
        msgs = []
        for m in (ch.get("messages") or {}).values():  # AsyncAPI 3.0
            msgs.append(resolve(doc, m))
        for op in ("publish", "subscribe"):  # AsyncAPI 2.6
            if op in ch:
                node = ch[op].get("message", {})
                msgs += [resolve(doc, m) for m in (node.get("oneOf") or [node])]
        for m in msgs:
            t = RX_TYPE.search(yaml.safe_dump(m))
            if not t or t.group(1) != cid:
                continue
            data = resolve(doc, (resolve(doc, m.get("payload", {})).get("properties") or {}).get("data", {}))
            rec = pubs.setdefault(t.group(3), {"entity": t.group(2), "fields": sorted((data.get("properties") or {}).keys()), "streams": set()})
            rec["streams"].add(stream)
    return pubs


def check_own_contract(fleet, cid, ctx, findings):
    doc = own_spec(fleet, cid, "asyncapi.yaml")
    if doc is None:
        findings.append(f"{cid}: no asyncapi.yaml (yard/apis/{cid} or origin/develop)")
    else:
        built = own_events(doc, cid)
        model = {p["event"]: p for p in ctx.get("publishes", [])}
        for ev in sorted(set(built) - set(model)):
            findings.append(f"{cid}: contract publishes {ev}, the model does not")
        for ev in sorted(set(model) - set(built)):
            findings.append(f"{cid}: model publishes {ev}, the contract does not")
        for ev in sorted(set(model) & set(built)):
            b, m = built[ev], model[ev]
            if b["entity"] != m["entity"]:
                findings.append(f"{cid}.{ev}: entity {m['entity']} in the model, {b['entity']} in the contract")
            if sorted(m["data"]) != b["fields"]:
                findings.append(f"{cid}.{ev}: data fields differ: model-only {sorted(set(m['data']) - set(b['fields']))}, contract-only {sorted(set(b['fields']) - set(m['data']))}")
            if "analytics" not in b["streams"]:
                findings.append(f"{cid}.{ev}: not on the analytics topic")
            integration = "events" in b["streams"]
            if integration == (m["consumers"] == ["analytics only"]):
                findings.append(f"{cid}.{ev}: stream differs: the contract has it {'on' if integration else 'off'} the integration topic, the model consumers are {m['consumers']}")
    routes = set()
    for name in ("openapi.yaml", "openapi-reports.yaml"):
        spec = own_spec(fleet, cid, name)
        for path, ops in ((spec or {}).get("paths") or {}).items():
            for meth in ops:
                if meth in ("get", "post", "put", "patch", "delete") and path not in INFRA:
                    routes.add(f"{meth.upper()} {path}")
    if not routes:
        findings.append(f"{cid}: no openapi.yaml routes (yard/apis/{cid} or origin/develop)")
    else:
        for r in sorted(routes - set(ctx.get("rest", []))):
            findings.append(f"{cid}: contract route {r} is missing from the model")
        for r in sorted(set(ctx.get("rest", [])) - routes):
            findings.append(f"{cid}: model route {r} is not in the contract")


def main():
    ap = argparse.ArgumentParser()
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument("--model", default=os.path.join(here, "..", "model", "model.yaml"))
    ap.add_argument("--fleet", default=None, help="sibling checkouts dir for live mode (default: use apis/<repo>/asyncapi.yaml copies in this repo)")
    args = ap.parse_args()
    model = yaml.safe_load(open(args.model))
    findings = []
    contexts = {c["id"]: c for c in model["contexts"]}
    changed = {row["context"] for row in model.get("fleet_changes", [])}

    for cid, ctx in contexts.items():
        check_own_contract(args.fleet, cid, ctx, findings)
        published = {p["event"]: p for p in ctx.get("publishes", [])}
        aggregate_events = {}
        errors = []
        for agg in ctx.get("aggregates", []):
            states = set(agg.get("states", []))
            for frm, to, cmd in agg.get("transitions", []):
                if frm not in states or to not in states:
                    findings.append(f"{cid}.{agg['name']}: transition {frm}->{to} ({cmd}) uses an undeclared state")
                if cmd not in agg.get("commands", []):
                    findings.append(f"{cid}.{agg['name']}: transition command {cmd} is not in commands")
            for ev in agg.get("events", []):
                aggregate_events[ev] = agg["name"].lower()
            errors += [inv["error"] for inv in agg.get("invariants", [])]
        dup = {e for e in errors if errors.count(e) > 1 and e not in ("ErrInvalidCarrier", "ErrUnknownLocation", "ErrValidation")}
        for e in sorted(dup):
            findings.append(f"{cid}: invariant error {e} is used by more than one rule")
        for ev, entity in aggregate_events.items():
            if ev not in published:
                findings.append(f"{cid}: aggregate event {ev} is not published")
            elif published[ev]["entity"] != entity:
                findings.append(f"{cid}: {ev} entity {published[ev]['entity']} != aggregate {entity}")
        for ev in published:
            if ev not in aggregate_events:
                findings.append(f"{cid}: published {ev} belongs to no aggregate")
        inbound_routes = {r for row in ctx.get("inbound", []) for r in row.get("routes", []) or []}
        rest = set(ctx.get("rest", []))
        reports = {r for r in rest if r.startswith("GET /reports/")}
        for r in sorted(inbound_routes - rest):
            findings.append(f"{cid}: inbound route {r} missing from rest")
        for r in sorted(rest - inbound_routes - reports):
            findings.append(f"{cid}: rest route {r} has no inbound row")
        for ev, pub in published.items():
            for consumer in pub["consumers"]:
                if consumer in ("analytics only", "none yet"):
                    continue
                if consumer in contexts:
                    rows = [c for c in contexts[consumer].get("consumes", []) if c["producer"] == cid]
                    if not any(ev in row["events"] for row in rows):
                        findings.append(f"{cid}.{ev}: consumer {consumer} does not list it in consumes")
                elif consumer not in changed:
                    findings.append(f"{cid}.{ev}: external consumer {consumer} has no fleet_changes row")

        for row in ctx.get("consumes", []):
            prod = row["producer"]
            if prod in contexts:
                pubs = {p["event"]: p for p in contexts[prod].get("publishes", [])}
                for ev in row["events"]:
                    if ev not in pubs:
                        findings.append(f"{cid}: consumes {prod}.{ev}, which {prod} does not publish")
                    elif cid not in pubs[ev]["consumers"]:
                        findings.append(f"{cid}: consumes {prod}.{ev} but is not listed as its consumer")
                continue
            repo = TOPIC_REPO.get(row["topic"], prod)
            msgs = producer_messages(args.fleet, repo)
            if msgs is None:
                findings.append(f"{cid}: cannot read {repo} origin/develop:apis/asyncapi.yaml")
                continue
            for ev in row["events"]:
                if ev not in msgs and ev[0].lower() + ev[1:] not in msgs:
                    findings.append(f"{cid}: {repo} publishes no message {ev}")
                    continue
                props = msgs.get(ev) or msgs.get(ev[0].lower() + ev[1:])
                for field in (row.get("fields") or {}).get(ev, []):
                    if field not in props:
                        findings.append(f"{cid}: {repo} {ev} has no field {field}")

    if findings:
        print("\n".join(findings))
        print(f"FAIL: {len(findings)} finding(s)")
        return 1
    print(f"OK: {len(contexts)} contexts, model consistent with producer contracts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
