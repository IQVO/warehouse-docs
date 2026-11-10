---
id: index
title: Strategic Design
sidebar_label: Overview
description: "Strategic design of the yard domain, generated from the model: subdomains, context map, ubiquitous language and the event standard."
---

# Strategic Design

:::info[Generated from the model]
This page is generated from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
:::

:::info[Built, released at v0.1.2, applied to k3s (reduced footprint)]
Both contexts are merged on `develop` (2026-11-08) in [IQVO/dock-scheduling](https://github.com/IQVO/dock-scheduling) and [IQVO/yard-management](https://github.com/IQVO/yard-management), released at v0.1.2 and applied to the k3s cluster on 2026-11-10 in a reduced footprint (dock-scheduling: API only, it relays inline; yard-management: API and relay). MCP servers, analytics projectors, report services and sweeps are registered in infra but switched off until the cluster has room. The cross-context journey is proven by the `@yard-journey` scenarios of IQVO/e2e-tests (local processes, not the cluster). The model records the as-built contracts: `scripts/check_model.py` compares it with the contract copies under `yard/apis/`.
:::

The yard is the enclosed area outside a site's four walls. It is modelled as two bounded contexts:

| Context | Code | Classification | Purpose |
| --- | --- | --- | --- |
| `dock-scheduling` | DS | Supporting | Owns the door calendar of every site: every booked time window on every dock door, inbound and outbound, from booking through arrival to door release, the no-double-booking rule, door opening hours and closures, ETA-driven risk and no-shows. |
| `yard-management` | YM | Supporting | Owns everything physically on site outside the four walls: who passed the gate (visits), which trailer is where (spot, door or an open move), its load, seal and hold state, the moves hostlers and visiting drivers make, door work at the door, and yard checks. The source of dwell, door occupancy and yard truck productivity facts. |

Pages: [Subdomain Classification](/yard/strategic-design/subdomain-classification), [Context Map](/yard/strategic-design/context-map), [Ubiquitous Language](/yard/strategic-design/ubiquitous-language), [Event Standard](/yard/strategic-design/event-standard-cloudevents), [Model Gap Register](/yard/strategic-design/model-gap-register).

## Counts

| Fact | Value |
| --- | --- |
| `dock-scheduling` aggregates / invariants | 2 / 16 |
| `dock-scheduling` published events / REST routes | 11 / 15 |
| `yard-management` aggregates / invariants | 5 / 25 |
| `yard-management` published events / REST routes | 19 / 32 |
