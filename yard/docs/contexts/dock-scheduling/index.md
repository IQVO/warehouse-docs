---
id: index
title: Dock Scheduling
sidebar_label: Dock Scheduling
description: "The door calendar of every site, a proposed Supporting context that owns booked time on every dock door, inbound and outbound, from booking to door release."
---

# Dock Scheduling

:::info[Proposed design]
Derived from [`yard/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml). This context's service is not built yet; identifiers (`Err...` names, REST paths, CloudEvents types) are the names the service will use.
:::

<span className="badge-supporting">Supporting</span>

**Dock Scheduling** (`dock-scheduling`, code `DS`, tier `wms`) owns the
**door calendar** of every site: every booked time window on every dock door,
inbound and outbound, from booking through arrival to door release. It keeps
one rule above all: no two active appointments (`BOOKED` or `CHECKED_IN`)
overlap on the same door, and it checks every booking against the door's
direction (`dockFlow`), its operating hours and its closures. It also owns
the ETA-driven advisory `DockAppointmentAtRisk` and the no-show sweep.

It owns the **future** of a door. Its sibling `yard-management` owns the
**present** of the yard (who and what is physically where). Neither records
the other's facts: arrival, docking and door release are physical facts that
this context only **applies from yard-management events**
(`VisitCheckedIn`, `TrailerDocked`, `TrailerUndocked`), never from its own
API. The model records the decision as YD-0004, "Physical facts win".

The appointment itself moves here from `inbound-receiving` (YD-0002): one
owner of door time for both directions, delivered through the strangler
stages A to E listed in `fleet_changes`.

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/yard/contexts/dock-scheduling/business-context) | The problem, the actors, the decisions, what is out of scope | — (narrative) |
| [Ubiquitous Language](/yard/contexts/dock-scheduling/ubiquitous-language) | Dock Appointment, Door Window, Door Calendar, Closure, Arrival Status, No-Show, SCAC, CPT and the neighbour terms used here | — (glossary) |
| [Core Domain Chart](/yard/contexts/dock-scheduling/core-domain-chart) | Why this context is Supporting | [core-domain-charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/yard/contexts/dock-scheduling/bounded-context-canvas) | Purpose, classification, roles, every inbound and outbound message | [bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas) v5 |
| [Context Map](/yard/contexts/dock-scheduling/context-map) | Every upstream and downstream neighbour with its pattern and channel | [context-mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/yard/contexts/dock-scheduling/aggregate-design-canvas) | `DockAppointment` and `DockCalendar`: states, invariants, commands, events | [aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas) v1.1 |
| [Domain Events](/yard/contexts/dock-scheduling/domain-events) | The eleven published and thirteen consumed events, with full CloudEvents types | — (event catalogue) |
| [Domain Message Flow](/yard/contexts/dock-scheduling/domain-message-flow) | Booking, arrival to completion, late ETA and no-show, closure and ASN cancellation | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/yard/contexts/dock-scheduling/eventstorming) | Process-level boards with hotspots | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/yard/contexts/dock-scheduling/use-cases) | One section per command: trigger, adapter, flow, errors, events | — (application layer) |
| [Class Diagram](/yard/contexts/dock-scheduling/class-diagram) | Proposed domain types and the hexagonal ports and adapters | — (UML) |
| [Entity Relationship](/yard/contexts/dock-scheduling/entity-relationship) | Proposed Postgres schema | — (ER) |
| [Sequence Diagrams](/yard/contexts/dock-scheduling/sequence-diagrams) | One runtime sequence per command use case | — (UML) |

## In numbers (from the model)

| Item | Count | Where it is listed |
| --- | --- | --- |
| Aggregates | 2: `DockAppointment` (5 states), `DockCalendar` (1 state) | [Aggregate Design Canvas](/yard/contexts/dock-scheduling/aggregate-design-canvas) |
| Invariants with an `Err` name | 13 (10 + 3) | same page |
| Commands | 13 (9 + 4) | [Use Cases](/yard/contexts/dock-scheduling/use-cases) |
| REST routes | 14 | [Bounded Context Canvas](/yard/contexts/dock-scheduling/bounded-context-canvas) |
| Published events | 11: 6 on `warehouse.dock-scheduling.events`, 5 analytics only | [Domain Events](/yard/contexts/dock-scheduling/domain-events) |
| Consumed events | 13 (4 of them legacy-import, stage A to D only) | same page |
| Policies | 9 (one of them phase 2) | same page |
| Read models | 5 | [Aggregate Design Canvas](/yard/contexts/dock-scheduling/aggregate-design-canvas) |

## Status

The model's status line reads: PROPOSED (2026-11-05), not built. There is no
`apis/` contract and no service yet. Where the model is silent or
contradicts itself, a page says **proposed** or **this pack's reading** and
the open point is listed as a gap with an id of the form `DS-Gnn`, returned
with this pack for the model gap register.

## Elsewhere

- Industry basis for the yard design: [benchmarks](/yard/research/benchmarks).
- The sibling pack for the present of the yard:
  [yard-management Domain Events](/yard/contexts/yard-management/domain-events).
- Decisions in the model this context rests on: YD-0001 (two contexts),
  YD-0002 (the appointment moves from `inbound-receiving`), YD-0004
  (physical facts win) and YD-0005 (outbound pickups come from the fleet's
  CPT schedule, never from the retail network).
- Changes the model asks of existing contexts (`fleet_changes`):
  `inbound-receiving` (ownership transfer), `warehouse-planning` (consumer
  source switch), `exception-management` (new consumer), `warehouse-ops-agent`
  (read-only client), `warehouse-console` (Dock Calendar remote) and
  `warehouse-floor-client`.
