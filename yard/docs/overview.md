---
id: overview
title: Yard Management
sidebar_label: Overview
description: "A yard management domain for the warehouse-systems fleet, modelled with Domain-Driven Design as two bounded contexts, built on develop, registered in infra and not applied to k3s: dock-scheduling (door time) and yard-management (the physical yard)."
slug: /
---

# Yard Management

The **yard** is the enclosed area outside a site's four walls: the gate, the
parking spots and the dock doors. Warehouse and transportation meet there, and
analysts call it the place where companies lack visibility to activities,
inventory and equipment ([Benchmarks](/yard/research/benchmarks)). This instance
models a yard management system (YMS) for the warehouse-systems fleet as
**two bounded contexts** in the `wms` tier.

:::info[Built on develop, registered in infra, not applied]
Built on develop (merged 2026-11-08) in [IQVO/dock-scheduling](https://github.com/IQVO/dock-scheduling) and
[IQVO/yard-management](https://github.com/IQVO/yard-management), registered in warehouse-infra develop (apps.yaml entry, helm
values, dashboards and alert rules, images pinned at v0.1.1), not applied to the k3s cluster (no pods). An edge is live only when
both ends run, so with no pod of either service every edge is wired in infra, not applied.
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

These changes are merged on `develop` in the neighbouring contexts. In warehouse-infra develop, `inbound-receiving` and
`warehouse-planning` have a consumer group for the `dock-scheduling` topic, `helm-values/exception-management.yaml` sets no
group for the yard or `dock-scheduling` topics, and `outbound-shipping` is not registered (no apps.yaml entry, no chart). No yard
service runs, so none of these edges is live:

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
