---
id: index
title: Yard Management
sidebar_label: Yard Management
description: "A Supporting context, built on develop and not deployed, that owns the present of the yard: who passed the gate, which trailer is where, hostler moves, door work, seals, holds, dwell and yard checks."
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
index (`uq_trailers_one_per_location`).

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/yard/contexts/yard-management/business-context) | The problem, the actors, the decisions, what is out of scope | — (narrative) |
| [Ubiquitous Language](/yard/contexts/yard-management/ubiquitous-language) | Yard, Yard Visit, Trailer, Spot, Dock Door, Hostler, Yard Move, Door Work, Dwell and the neighbour terms used here | — (glossary) |
| [Core Domain Chart](/yard/contexts/yard-management/core-domain-chart) | Why this context is Supporting | [core-domain-charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/yard/contexts/yard-management/bounded-context-canvas) | Purpose, classification, roles, every inbound and outbound message | [bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas) v5 |
| [Context Map](/yard/contexts/yard-management/context-map) | Every upstream and downstream neighbour with its pattern and channel | [context-mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/yard/contexts/yard-management/aggregate-design-canvas) | `YardVisit`, `Trailer`, `YardMove`, `YardCheck` and `YardPolicy`: states, invariants, commands, events | [aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas) v1.1 |
| [Domain Events](/yard/contexts/yard-management/domain-events) | The nineteen published (nine integration, ten analytics only) and thirteen consumed events, with full CloudEvents types and topics | — (event catalogue) |
| [Domain Message Flow](/yard/contexts/yard-management/domain-message-flow) | Live unload, drop and later door call, gate rejection, hostler move with lease expiry | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/yard/contexts/yard-management/eventstorming) | Process-level boards with hotspots | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/yard/contexts/yard-management/use-cases) | One section per command: trigger, adapter, flow, errors, events | — (application layer) |
| [Class Diagram](/yard/contexts/yard-management/class-diagram) | Domain types and the hexagonal ports and adapters of the built service | — (UML) |
| [Entity Relationship](/yard/contexts/yard-management/entity-relationship) | The Postgres schema of the built service (OLTP and analytics) | — (ER) |
| [Sequence Diagrams](/yard/contexts/yard-management/sequence-diagrams) | The four required scenarios, then one runtime sequence per significant command | — (UML) |

The sibling pack is [Dock Scheduling](/yard/contexts/dock-scheduling/). The
industry basis for the capabilities is on
[Benchmarks](/yard/research/benchmarks).

## Service and operations

- **Service:** [IQVO/yard-management](https://github.com/IQVO/yard-management), merged on `develop`
  2026-11-08 (door work and departure on the integration topic, and the KPI reports, 2026-11-09). Not
  deployed: registered nowhere in warehouse-infra. The contracts are copied under `yard/apis/yard-management/`
  and `scripts/check_model.py` compares the model with them. Five binaries: `api`, `mcp`, `relay`,
  `yard-projector` and `yard-reports`. Eleven ADRs, indexed on the [ADR page](/yard/adr/).
- **Runtime:** Postgres and Kafka only (no in-memory mode). Every published
  event leaves through a transactional outbox; every consumer is idempotent on
  the CloudEvents `id`. The analytics read side is a separate database written by `yard-projector` and read by
  `yard-reports`.
- **MCP:** the service ships its own MCP server with 14 tools: eight L1 reads (trailers, visits, moves,
  yard board, yard policy, dwell report) and six L3 writes (`request_move`, `cancel_move`, `place_hold`,
  `release_hold`, `record_seal`, `open_yard_check`), every write with a human approval and `initiated_by`. The
  model's `fleet_changes` row for `warehouse-ops-agent` said read-only; the service goes further.
- **Edges named in the model (`fleet_changes`):** `warehouse-console` gains a
  Yard Board remote (spot and door map, arrivals, at-risk appointments) and
  `warehouse-floor-client` the gate clerk check-in/out, hostler claim/complete move and dock operator door-work
  screens; neither was checked here. `dock-scheduling` consumes the yard's facts; `exception-management` and
  `outbound-shipping` consume its integration events; all are merged on `develop`.
- **Observability:** the read model `YardKpiReport` is built: dwell by kind, door utilisation, moves per hostler
  hour, driver wait, and the KPI standard v1 of the service's ADR 0011 (gate-to-gate turn time per purpose,
  detention exposure over a 120 minute default threshold, exception rates), served by `yard-reports`.

## Elsewhere

- [Strategic context map](/yard/strategic-design/context-map) and
  [subdomain classification](/yard/strategic-design/subdomain-classification).
- [Event standard (CloudEvents)](/yard/strategic-design/event-standard-cloudevents).
- Decisions: [YD-0001 two contexts](/yard/adr/yd-0001-two-contexts),
  [YD-0002 appointment ownership](/yard/adr/yd-0002-appointment-ownership),
  [YD-0003 every location change is a move](/yard/adr/yd-0003-every-location-change-is-a-move),
  [YD-0004 physical facts win](/yard/adr/yd-0004-physical-facts-win),
  [YD-0005 pickups from CPT](/yard/adr/yd-0005-pickups-from-cpt).
- Where the model was silent or contradicted itself, these pages first said **proposed**
  or **this pack's reading** and tagged the point `YM-G<n>`. The gaps were decided before the build
  (decisions Y-1 to Y-14, X1 to X7; see the
  [Model Gap Register](/yard/strategic-design/model-gap-register)) and the pages now state the built
  rule; the hotspot table on
  [EventStorming](/yard/contexts/yard-management/eventstorming#hotspots) says how each was settled.
