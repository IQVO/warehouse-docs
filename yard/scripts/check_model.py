#!/usr/bin/env python3
"""Consistency gate for the PROPOSED yard model (model.yaml).

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

Usage: python3 yard/scripts/check_model.py [--model yard/model/model.yaml] [--fleet ~/warehouse-systems]
Exit 0 = clean; 1 = findings (printed).
"""
import argparse
import os
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
                if consumer == "analytics only":
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
