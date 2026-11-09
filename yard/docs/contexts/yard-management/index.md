---
id: index
title: Yard Management
sidebar_label: Yard Management
description: "A proposed Supporting context that owns the present of the yard: who passed the gate, which trailer is where, hostler moves, door work, seals, holds, dwell and yard checks."
---

# Yard Management

:::info[Built on develop, not deployed]
Built on develop (merged 2026-11-08) in [IQVO/yard-management](https://github.com/IQVO/yard-management), not deployed: registered nowhere in warehouse-infra. The page still derives from [`yard/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml); where the as-built service differs, the model and this page say so (see the as-built notes).
:::

<span className="badge-supporting">Supporting</span>

**Yard Management** (`yard-management`, code `YM`, tier `wms`) owns everything
physically on site **outside the four walls**: the gate, the parking spots and
the dock doors. It records who passed the gate (**visits**), which **trailer**
is where (one spot, one door, or one open move), its load, seal and hold state,
the **moves** that hostlers and visiting drivers make, the **door work** done
while a trailer is docked, and **yard checks**. It is the source of dwell, door
occupancy and yard-truck productivity facts.

Its sibling `dock-scheduling` owns the **future** of a door (booked time);
`yard-management` owns the **present** of the yard. Neither records the other's
facts. Arrival, docking and door release are recorded only here
([YD-0004](/yard/adr/yd-0004-physical-facts-win)); `dock-scheduling` applies
them from events. Every location change of a trailer is a `YardMove`
([YD-0003](/yard/adr/yd-0003-every-location-change-is-a-move)).

The invariant that shapes the model: **a trailer on site is at exactly one
place, and a spot or a door holds at most one trailer.** It spans the `Trailer`
and `YardMove` aggregates and is enforced by a domain service
(`Occupancy.CheckFree`) under a per-location advisory lock plus a partial unique
index.

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/yard/contexts/yard-management/business-context) | The problem, the actors, the decisions, what is out of scope | — (narrative) |
| [Ubiquitous Language](/yard/contexts/yard-management/ubiquitous-language) | Yard, Yard Visit, Trailer, Spot, Dock Door, Hostler, Yard Move, Door Work, Dwell and the neighbour terms used here | — (glossary) |
| [Core Domain Chart](/yard/contexts/yard-management/core-domain-chart) | Why this context is Supporting | [core-domain-charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/yard/contexts/yard-management/bounded-context-canvas) | Purpose, classification, roles, every inbound and outbound message | [bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas) v5 |
| [Context Map](/yard/contexts/yard-management/context-map) | Every upstream and downstream neighbour with its pattern and channel | [context-mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/yard/contexts/yard-management/aggregate-design-canvas) | `YardVisit`, `Trailer`, `YardMove`, `YardCheck` and `YardPolicy`: states, invariants, commands, events | [aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas) v1.1 |
| [Domain Events](/yard/contexts/yard-management/domain-events) | The eighteen published and thirteen consumed events, with full CloudEvents types and topics | — (event catalogue) |
| [Domain Message Flow](/yard/contexts/yard-management/domain-message-flow) | Live unload, drop and later door call, gate rejection, hostler move with lease expiry | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/yard/contexts/yard-management/eventstorming) | Process-level boards with hotspots | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/yard/contexts/yard-management/use-cases) | One section per command: trigger, adapter, flow, errors, events | — (application layer) |
| [Class Diagram](/yard/contexts/yard-management/class-diagram) | Proposed domain types and the hexagonal ports and adapters | — (UML) |
| [Entity Relationship](/yard/contexts/yard-management/entity-relationship) | Proposed Postgres schema | — (ER) |
| [Sequence Diagrams](/yard/contexts/yard-management/sequence-diagrams) | The four required scenarios, then one runtime sequence per significant command | — (UML) |

The sibling pack is [Dock Scheduling](/yard/contexts/dock-scheduling/). The
industry basis for the capabilities is on
[Benchmarks](/yard/research/benchmarks).

## Service and operations

- **Service:** none yet. The model is a proposal (`meta.status`: PROPOSED). The
  REST routes, events and error names on these pages are the contract the
  service will implement.
- **Runtime:** Postgres and Kafka only (no in-memory mode). Every published
  event leaves through a transactional outbox; every consumer is idempotent on
  the CloudEvents `id`.
- **Edges named in the model (`fleet_changes`):** `warehouse-console` gains a
  Yard Board remote (spot and door map, arrivals, at-risk appointments);
  `warehouse-floor-client` gains the gate clerk check-in/out, hostler
  claim/complete move and dock operator door-work screens;
  `warehouse-ops-agent` gets read-only MCP tools (yard board, appointments at
  risk, dwell) and no write tools.
- **Observability:** the model defines none beyond the read model `YardKpiReport`
  (dwell by kind, door utilisation, moves per hostler hour, driver wait).

## Elsewhere

- [Strategic context map](/yard/strategic-design/context-map) and
  [subdomain classification](/yard/strategic-design/subdomain-classification).
- [Event standard (CloudEvents)](/yard/strategic-design/event-standard-cloudevents).
- Decisions: [YD-0001 two contexts](/yard/adr/yd-0001-two-contexts),
  [YD-0002 appointment ownership](/yard/adr/yd-0002-appointment-ownership),
  [YD-0003 every location change is a move](/yard/adr/yd-0003-every-location-change-is-a-move),
  [YD-0004 physical facts win](/yard/adr/yd-0004-physical-facts-win),
  [YD-0005 pickups from CPT](/yard/adr/yd-0005-pickups-from-cpt).
- Where the model is silent or contradicts itself, these pages say **proposed**
  or **this pack's reading** and tag the point `YM-G<n>`; the list is
  reported back as model gaps (see the hotspot table on
  [EventStorming](/yard/contexts/yard-management/eventstorming#hotspots)).
