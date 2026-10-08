---
id: index
title: Warehouse Planning
sidebar_label: Warehouse Planning
description: The Core bounded context that answers "can this warehouse process the demand assigned to it" — process-path capacity, window-coverage resolution, station capacity composition, and capacity plans with shortage and bottleneck detection.
slug: /contexts/warehouse-planning
---

# Warehouse Planning

<span className="badge-core">Core Subdomain</span>

**Warehouse Planning** is one of the fleet's fourteen domain bounded contexts and
sits in the `wes` tier of the CloudEvents subdomain taxonomy. It answers one
question: **can this warehouse process the demand assigned to it**, given its
current labor, location, equipment, station, conveyor and buffer
constraints? That is distinct from Inventory Management ("what do we
have"): none of the other contexts computes a normalized, cross-process
effective capacity or a forward-looking capacity shortage
([ADR 0001](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0001-warehouse-planning-bounded-context.md)).

It owns three things: **process and process-path capacity** (the minimum
across a step's registered constraints, normalized to orders per hour), the
rule by which a registered capacity window is **resolved by coverage**
([ADR 0003](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0003-window-coverage-semantics.md)),
and the **station capacity composition** done at read time
([ADR 0002](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0002-station-capacity-composition.md)).
On top of those it keeps the **CapacityPlan** aggregate: assigned demand
versus path capacity over a planning window, with the resulting shortage and
the bottleneck step.

:::info[What is live, what is opt-in, and what is planned]
Per this context's own [Context Map](/contexts/warehouse-planning/context-map):

**Live:** `workforce-management` to `warehouse-planning`
(`ShiftPlanCommitted` on `warehouse.workforce.events`) and
`facility-layout` to `warehouse-planning` (`LocationSlotRegistered` and
`LocationSlotDecommissioned` on `warehouse.facility.events`) are real Kafka
consumers. The context publishes four `capacityplan` CloudEvents types on
`warehouse.warehouse-planning.events` through a transactional outbox, with
an analytics copy of each on `warehouse.warehouse-planning.analytics` for
its own projector and reports (ADR 0005). It serves REST (Kong route
`/api/warehouse-planning`) and MCP. `warehouse-ops-agent` reads
`get_process_path_capacity` for its daily-brief capacity outlook, and the
console hosts this context's own `capacity_mfe` remote.

**Wired, opt-in:** consuming `order-management`'s `OrderAllocated` and
`OrderPartiallyAllocated` as expected demand (off unless
`DEMAND_CONSUMER_GROUP` is set, ADR 0004), and `order-management`
consuming this context's capacity-plan events (its ADR 0031, off unless
`PLANNED_CAPACITY_CONSUMER_GROUP` is set).

**Planned, not implemented:** published-language feeds from
`fulfillment-execution` and `wes-work-planning` (observed capacity) and
from `network-fulfillment` (demand), as drawn in ADR 0001's context map.
:::

:::note[Deliberately not consumed]
`process-path-management` is **not** consumed. Its `ProcessPath` carries
routing and capability metadata (`path_id`, `required_capabilities`,
`eligibility`), never an ordered list of physical process steps, so this
context owns its own, operator-declared `ProcessPath` and shares only the
`path_id` string as a loose human cross-reference (ADR 0001 Addendum).
:::

## This context's pages

- [Business Context](/contexts/warehouse-planning/business-context): why
  "how much work can we perform" needed its own context.
- [Ubiquitous Language](/contexts/warehouse-planning/ubiquitous-language):
  ProcessCapacity, CapacityConstraint, CapacityRate, CapacityWindow,
  WorkloadProfile, ProcessPath, StationStandard, CapacityPlan, Bottleneck.
- [Core Domain Chart](/contexts/warehouse-planning/core-domain-chart)
  ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts)):
  why this context is Core.
- [Bounded Context Canvas](/contexts/warehouse-planning/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, classification, roles, inbound and outbound communication, MCP
  tools, business decisions and open questions.
- [Context Map](/contexts/warehouse-planning/context-map)
  ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)):
  every relationship with its pattern, technology and status, including the
  deliberate Separate Ways.
- [Aggregate Design Canvas](/contexts/warehouse-planning/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  the `CapacityPlan` aggregate (plus the `ProcessCapacity` aggregate).
- [Domain Events](/contexts/warehouse-planning/domain-events):
  `CapacityPlanCreated`, `CapacityPlanPublished`, `CapacityShortageDetected`
  and `BottleneckDetected`, plus the events it consumes.
- [Domain Message Flow](/contexts/warehouse-planning/domain-message-flow)
  ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling)):
  key scenarios as commands, events and queries.
- [EventStorming](/contexts/warehouse-planning/eventstorming)
  ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)):
  process-level boards.
- [Class Diagram](/contexts/warehouse-planning/class-diagram): the domain
  model as it exists in the code.
- [Entity Relationship](/contexts/warehouse-planning/entity-relationship):
  the persisted tables.
- [Sequence Diagrams](/contexts/warehouse-planning/sequence-diagrams): the
  main runtime interactions.
- [Async API](/contexts/warehouse-planning/async-api): the Kafka
  integration in narrative form.

Every page above except the Business Context and the Async API narrative
is synced from the `warehouse-planning` repository.

## Elsewhere

- **Repository**: [github.com/IQVO/warehouse-planning](https://github.com/IQVO/warehouse-planning).
  Its ADRs live under `docs/adr/`, not `docs/docs/adr/`, starting with
  [0001](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0001-warehouse-planning-bounded-context.md),
  [0002](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0002-station-capacity-composition.md)
  and
  [0003](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0003-window-coverage-semantics.md).
  There are eleven on `develop` (0001 to 0011).
- [ADR index](/adr): links to this context's own decision records.
- **Generated references on this site**: [REST](/api-reference/rest/warehouse-planning/warehouse-planning)
  and [AsyncAPI](/api-reference/async/warehouse-planning), generated from
  the real `apis/openapi.yaml` and `apis/asyncapi.yaml`.
- **Fleet-level**: [Context Map](/strategic-design/context-map) and the
  [Event Standard](/strategic-design/event-standard-cloudevents).
