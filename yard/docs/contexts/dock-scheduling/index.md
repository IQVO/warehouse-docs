---
id: index
title: Dock Scheduling
sidebar_label: Dock Scheduling
description: "The door calendar of every site, a Supporting context, built, released at v0.1.2 and applied to k3s (api only), that owns booked time on every dock door, inbound and outbound, from booking to door release."
---

# Dock Scheduling

:::info[Built, released at v0.1.2, applied to k3s (reduced footprint)]
Built on develop (merged 2026-11-08) in [IQVO/dock-scheduling](https://github.com/IQVO/dock-scheduling), released at v0.1.2 (first release v0.1.0 on 2026-11-09) and applied to the k3s cluster on 2026-11-10 in a reduced footprint: dock-scheduling runs its API only (it relays inline); yard-management runs its API and relay. Their MCP servers, analytics projectors, report services and sweeps are registered in warehouse-infra but switched off until the cluster has room, so the KPI reports of yard-management ADR 0011 are released, not yet served. The page still derives from [`yard/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml); where the as-built service differs, the model and this page say so (see the as-built notes).
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
| [Domain Events](/yard/contexts/dock-scheduling/domain-events) | The eleven published (seven integration, four analytics only) and fourteen consumed events, with full CloudEvents types | — (event catalogue) |
| [Domain Message Flow](/yard/contexts/dock-scheduling/domain-message-flow) | Booking, arrival to completion, late ETA and no-show, closure and ASN cancellation | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/yard/contexts/dock-scheduling/eventstorming) | Process-level boards with hotspots | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/yard/contexts/dock-scheduling/use-cases) | One section per command: trigger, adapter, flow, errors, events | — (application layer) |
| [Class Diagram](/yard/contexts/dock-scheduling/class-diagram) | Domain types and the hexagonal ports and adapters of the built service | — (UML) |
| [Entity Relationship](/yard/contexts/dock-scheduling/entity-relationship) | The Postgres schema of the built service (OLTP and analytics) | — (ER) |
| [Sequence Diagrams](/yard/contexts/dock-scheduling/sequence-diagrams) | One runtime sequence per command use case | — (UML) |

## In numbers (from the model)

| Item | Count | Where it is listed |
| --- | --- | --- |
| Aggregates | 2: `DockAppointment` (5 states), `DockCalendar` (1 state) | [Aggregate Design Canvas](/yard/contexts/dock-scheduling/aggregate-design-canvas) |
| Invariants with an `Err` name | 16 (12 + 4) | same page |
| Commands | 13 (9 + 4) | [Use Cases](/yard/contexts/dock-scheduling/use-cases) |
| REST routes | 15 | [Bounded Context Canvas](/yard/contexts/dock-scheduling/bounded-context-canvas) |
| Published events | 11: 7 on `warehouse.dock-scheduling.events` (and its analytics twin), 4 analytics only | [Domain Events](/yard/contexts/dock-scheduling/domain-events) |
| Consumed events | 14 (4 of them legacy-import, stage A to D only) | same page |
| Policies | 10 (one of them phase 2, half built) | same page |
| Read models | 5 | [Aggregate Design Canvas](/yard/contexts/dock-scheduling/aggregate-design-canvas) |

## Status

Built on `develop` (merged 2026-11-08, `DockAppointmentDoorReassigned` on the integration topic since 2026-11-09)
in [IQVO/dock-scheduling](https://github.com/IQVO/dock-scheduling); registered in warehouse-infra develop
(`terraform/apps.yaml` entry with a database and analytics, `helm-values/dock-scheduling.yaml`, a dashboard, alert rules and
the image pinned at v0.1.2, main commit `d5db895`), released at v0.1.2 and applied to the k3s cluster on 2026-11-10 in a reduced footprint: only the api runs (it relays its outbox inline, so the dedicated relay is off), and the mcp, projector, reports and sweep components are switched off until the cluster has room. The
helm values give the api four consumer groups (`dock-scheduling-yard`, `dock-scheduling-facility`, `dock-scheduling-asn`,
`dock-scheduling-cpt`), the projector `dock-scheduling-analytics`, Kong routes `/api/dock-scheduling`,
`/api/dock-scheduling/reports` and `/api/mcp/dock-scheduling`, a dedicated relay and the no-show sweep every five minutes;
there is no A2A component, and the strangler stage A group is empty (off). The yard-domain Kafka topics must be pre-created before the
first sync (`docs/kafka-topics-yard-dock.md` in warehouse-infra). An edge is live only when both ends run: the yard-management edges are live (both run), the others depend on the other end's deployment. The no-show sweep does not run while the sweep is off. The model's status line records the same. The contracts
are copied under `yard/apis/dock-scheduling/` and `scripts/check_model.py` compares the model with them.
The service ships six binaries (`api`, `mcp`, `projector`, `relay`, `reports`, `sweep`) and ten ADRs, indexed on the
[ADR page](/yard/adr/).

Where the model was silent, the pages first said **proposed** and reported a gap with an id of the form `DS-Gnn`.
The service's decisions (ADR 0002 and ADR 0009, decisions D-1 to D-13 and X1 to X7) closed them: see the
[Model Gap Register](/yard/strategic-design/model-gap-register). A page that still says **this pack's reading**
marks a point the service does not state.

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
  source switch) and `exception-management` (new consumer), all three built on
  `develop`, `outbound-shipping` (new consumer, built), `warehouse-ops-agent`
  (MCP tools), `warehouse-console` (Dock Calendar remote) and
  `warehouse-floor-client`.
