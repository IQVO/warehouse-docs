---
id: overview
title: Yard Management
sidebar_label: Overview
description: "A yard management domain for the warehouse-systems fleet, modelled with Domain-Driven Design as two bounded contexts, built, released at v0.1.2 and applied to k3s in a reduced footprint: dock-scheduling (door time) and yard-management (the physical yard)."
slug: /
---

# Yard Management

The **yard** is the enclosed area outside a site's four walls: the gate, the
parking spots and the dock doors. Warehouse and transportation meet there, and
analysts call it the place where companies lack visibility to activities,
inventory and equipment ([Benchmarks](/yard/research/benchmarks)). This instance
models a yard management system (YMS) for the warehouse-systems fleet as
**two bounded contexts** in the `wms` tier.

:::info[Built, released at v0.1.2, applied to k3s (reduced footprint)]
Built on develop (merged 2026-11-08) in [IQVO/dock-scheduling](https://github.com/IQVO/dock-scheduling) and
[IQVO/yard-management](https://github.com/IQVO/yard-management), released at v0.1.2 (first release v0.1.0 on 2026-11-09, images
and charts on GHCR) and applied to the k3s cluster on 2026-11-10 in a reduced footprint, because the cluster is nearly full:
dock-scheduling runs its API only (it relays its outbox inline) and yard-management runs its API and relay. MCP servers,
analytics projectors, report services and sweeps are registered in warehouse-infra and switched off until capacity is freed, so
the KPI reports are released but not yet served. The cross-context journey (appointment, gate, dock, receive, depart, ship-confirm)
is proven end to end by the `@yard-journey` scenarios of IQVO/e2e-tests, which run the services as local processes against their
own broker, not on the cluster.
The canonical model is
[`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml);
every page still derives from it, and the as-built refresh of 2026-11-09 folded the differences back in.
`scripts/check_model.py` fails the build when the model disagrees with the contract copies under
[`yard/apis/`](https://github.com/IQVO/warehouse-docs/tree/main/yard/apis) or when a consumed fleet event or field does
not exist in the producer's contract.
:::

## The two contexts

| Context | One sentence |
| --- | --- |
| `dock-scheduling` | Owns the **future** of every dock door: inbound and outbound appointments on one calendar per door, opening hours, closures, ETA risk and no-shows. |
| `yard-management` | Owns the **present** of the yard: gate visits, where each trailer is (spot, door or in a move), seals and holds, hostler moves, work at the door and yard audits. |

Neither records the other's facts. Arrival, docking and door release are physical
facts that only `yard-management` records; `dock-scheduling` applies them from events.

## What changes in the fleet

These changes are merged on `develop` in the neighbouring contexts. In warehouse-infra `develop`, `inbound-receiving`,
`warehouse-planning` and `exception-management` set a consumer group for the `dock-scheduling` topic
(`exception-management` also for the yard topic) and the yard services are registered. `dock-scheduling`
and `yard-management` run on k3s at v0.1.2 (applied 2026-11-10, read-only `kubectl`), so the edges into
`inbound-receiving`, `warehouse-planning` and `exception-management` are live. `outbound-shipping`
is released as `v0.1.0` and registered and image-pinned in warehouse-infra `develop` (PR 205, consumer groups
for the yard and dock topics set) but not applied (no pod), so its two edges from the yard are wired in infra
and not live (see [Context Map](/yard/strategic-design/context-map)):

- `DockAppointment` moved from `inbound-receiving` to `dock-scheduling` (a door that
  serves both directions cannot have two owners of its time). `inbound-receiving` retired its
  appointment write routes and keeps an appointments copy fed from `dock-scheduling` (its ADR 0019).
- `warehouse-planning` reads appointments from `dock-scheduling` (its ADR 0020), which adds the site
  it could not see before.
- `exception-management` opens cases for rejected visits, seal mismatches, dwell
  breaches, yard-check discrepancies and no-shows.
- `outbound-shipping` confirms a shipment when the trailer physically leaves, from the yard's
  `TrailerDocked`, `DoorWorkCompleted` and `TrailerDeparted`.

See [Context Map](/yard/strategic-design/context-map) and the
[Business Capability Map](/yard/strategic-design/business-capability-map).

## Where to read next

- [Strategic Design](/yard/strategic-design/): subdomains, context map, language, events.
- [Bounded Contexts](/yard/contexts/): the ddd-crew pack of each context.
- [ADRs](/yard/adr/): the five design decisions and the implementation ADRs of both services.
- [Benchmarks](/yard/research/benchmarks): the cited research.
