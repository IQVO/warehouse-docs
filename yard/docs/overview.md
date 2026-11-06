---
id: overview
title: Yard Management
sidebar_label: Overview
description: "A yard management domain for the warehouse-systems fleet, modelled with Domain-Driven Design as two bounded contexts: dock-scheduling (door time) and yard-management (the physical yard)."
slug: /
---

# Yard Management

The **yard** is the enclosed area outside a site's four walls: the gate, the
parking spots and the dock doors. Warehouse and transportation meet there, and
analysts call it the place where companies lack visibility to activities,
inventory and equipment ([Benchmarks](/yard/research/benchmarks)). This instance
models a yard management system (YMS) for the warehouse-systems fleet as
**two bounded contexts** in the `wms` tier.

:::info[Proposed design, not built]
Nothing here is implemented yet. The canonical model is
[`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml);
every page derives from it, and `scripts/check_model.py` fails the build when a
consumed fleet event or field does not exist in the producer's contract. When a
context ships, an as-built refresh folds the differences back into the model.
:::

## The two contexts

| Context | One sentence |
| --- | --- |
| `dock-scheduling` | Owns the **future** of every dock door: inbound and outbound appointments on one calendar per door, opening hours, closures, ETA risk and no-shows. |
| `yard-management` | Owns the **present** of the yard: gate visits, where each trailer is (spot, door or in a move), seals and holds, hostler moves, work at the door and yard audits. |

Neither records the other's facts. Arrival, docking and door release are physical
facts that only `yard-management` records; `dock-scheduling` applies them from events.

## What changes in the fleet

- `DockAppointment` moves from `inbound-receiving` to `dock-scheduling` (a door that
  serves both directions cannot have two owners of its time), migrated in stages.
- `warehouse-planning` reads appointments from `dock-scheduling`, which adds the site
  it could not see before.
- `exception-management` opens cases for rejected visits, seal mismatches, dwell
  breaches, yard-check discrepancies and no-shows.

See [Context Map](/yard/strategic-design/context-map) and the
[Business Capability Map](/yard/strategic-design/business-capability-map).

## Where to read next

- [Strategic Design](/yard/strategic-design/): subdomains, context map, language, events.
- [Bounded Contexts](/yard/contexts/): the ddd-crew pack of each context.
- [ADRs](/yard/adr/): the five design decisions.
- [Benchmarks](/yard/research/benchmarks): the cited research.
