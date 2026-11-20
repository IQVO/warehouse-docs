---
id: index
title: Warehouse Planning
sidebar_label: Warehouse Planning
description: The Core bounded context that answers "can this warehouse process the demand assigned to it" — process-path capacity, window-coverage resolution, station capacity composition, and capacity plans with shortage and bottleneck detection.
slug: /contexts/warehouse-planning
---

# Warehouse Planning

<span className="badge-core">Core Subdomain</span>

**Warehouse Planning** is one of the fleet's sixteen domain bounded contexts and
sits in the `wes` tier of the CloudEvents subdomain taxonomy. It answers one
question: **can this warehouse process the demand assigned to it**, given its
current labor, location, equipment, station, conveyor and buffer
constraints? That is distinct from Inventory Management ("what do we
have"): none of the other contexts computes a normalized, cross-process
effective capacity or a forward-looking capacity shortage
([ADR 0001](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0001-warehouse-planning-bounded-context.md)).

It owns two sides of one question. The **capacity side**: **process and
process-path capacity** (the minimum across a step's registered constraints,
normalized to orders per hour), the rule by which a registered capacity
window is **resolved by coverage**
([ADR 0003](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0003-window-coverage-semantics.md)),
and the **station capacity composition** done at read time
([ADR 0002](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0002-station-capacity-composition.md)).
On top of those it keeps the **CapacityPlan** aggregate: assigned demand
versus path capacity over a planning window, with the resulting shortage and
the bottleneck step. The **requirement side** (ADRs 0022 to 0025, accepted
2026-11-18): the **workload forecast** per site and path, the **labour plan**
per site, shift and path with its **drift** against what workforce-management
committed (both moved here from `wes-work-planning`, ADR 0023), the **labour
requirement** a plan states per step from labor-performance's standards
([ADR 0022](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0022-labour-standards-from-labor-performance.md)),
and plans that take their demand from the forecast, **scenarios**, a
**comparison read** and **supersession**
([ADR 0024](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0024-forecast-demand-and-plan-scenarios.md)).

:::info[What is live, what is opt-in, and what is planned]
Per this context's own [Context Map](/contexts/warehouse-planning/context-map)
and [Domain Events](/contexts/warehouse-planning/domain-events):

**Live, consumed (every consumer group is required, none is optional):**
`workforce-management`'s `ShiftPlanCommitted` (a `LABOR` constraint, and the
committed heads the drift compares), `facility-layout`'s
`LocationSlotRegistered` and `LocationSlotDecommissioned`, `order-management`'s
`OrderAllocated` and `OrderPartiallyAllocated` (expected demand, at the
event's own `site_id`, else `DEMAND_SITE_ID`, ADR 0021), `dock-scheduling`'s
dock appointment events (inbound labour demand, ADR 0020, which replaced the
`inbound-receiving` events of ADR 0017), `fulfillment-execution`'s
`TaskCompleted` (observed capacity), and `labor-performance`'s
`LaborStandardDefined` and `LaborStandardRevised` from its integration topic
(a local copy of the standards, ADR 0022).

**Live, published:** ten CloudEvents types on
`warehouse.warehouse-planning.events` through a transactional outbox: five
`capacityplan` types (`CapacityPlanCreated`, `CapacityPlanPublished`,
`CapacityShortageDetected`, `BottleneckDetected` and `CapacityPlanSuperseded`,
raised when publishing a plan replaces the plan published before it for the
same site, location, path and window), two `processcapacity` types
(`ProcessCapacityRegistered` and `ProcessCapacityChanged`, no consumer) and
three requirement-side types: `WorkloadForecastReceived`,
`LabourPlanCommitted` and `LabourPlanDriftDetected`. The capacity-plan and
requirement-side events also have an analytics copy on
`warehouse.warehouse-planning.analytics` for its own projector and reports
(ADR 0005). It serves REST (Kong route `/api/warehouse-planning`) and MCP;
`warehouse-ops-agent` reads `get_process_path_capacity` for its daily-brief
capacity outlook, and the console hosts this context's own `capacity_mfe`
remote.

**Live, consumed by siblings:** `order-management` reads the capacity-plan
events into a local read model, including `CapacityPlanSuperseded` (its ADRs
0031 and 0052; opt-in on its side with `PLANNED_CAPACITY_CONSUMER_GROUP`) and
matches a plan by `site_id`, else by `location` (its ADR 0053).
`workforce-management` keeps `LabourPlanCommitted` as the heads a shift
requires and proposes from it (its ADR 0043).

**New REST surface:** `PUT`/`GET /workload-forecasts/{site_id}/{path_id}`,
`PUT`/`GET /labour-plans/{site_id}/{shift_id}/{path_id}`, `GET /labour-plans`
and `GET /capacity-plans/comparisons`. `POST /capacity-plans` takes an
optional `demand_source` (`request`, `orders` or `forecast`) and an optional
`scenario` label. `wes-work-planning`'s `POST /paths/{pathId}/charge` and
`/plan` answer `410` and name these routes.

**Built by [ADR 0017](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0017-inbound-labour-demand-and-observed-capacity-feedback.md):**
observed-capacity feedback from `fulfillment-execution`'s `TaskCompleted`,
compared with the plan by `GET /capacity-plans/{id}/variance`, and inbound
labour demand composed at read time from an operator-declared
`InboundLabourStandard` (`PUT /inbound-labour-standards/{location}/{path_id}`,
`GET /inbound-demand`).

**Built (stage 1):** `ProcessFlow`
([ADR 0025](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0025-process-flows-from-process-path-management.md)).
`process-path-management` publishes an ordered sequence of process-path stages
(`ProcessFlowDefined/Revised/Retired`, full state with a `version`), this context
keeps a version-guarded `process_flows` copy as the path capacity's steps, and
`POST /process-paths` retires through a strangler in stages 2-3 (decided, not
built). Until then both sources coexist and every path read carries
`source: flow|local`.

**Planned, not implemented:** observed capacity from `wes-work-planning`
and demand from `network-fulfillment`, as drawn in ADR 0001's context map.
:::

:::note[Consumed since ADR 0025]
`process-path-management`'s topic `warehouse.process-path-management.events` is
consumed (always on, `PROCESS_FLOW_CONSUMER_GROUP`): the three `processflow.*`
types keep the `process_flows` copy; every other type on the topic
(`ProcessPath*`, `CPTScheduleChanged`) is ignored. The ADR 0001 Addendum's
Separate Ways is now a customer/supplier edge with an anti-corruption layer —
still no live call.
:::

## This context's pages

- [Business Context](/contexts/warehouse-planning/business-context): why
  "how much work can we perform" needed its own context.
- [Ubiquitous Language](/contexts/warehouse-planning/ubiquitous-language):
  ProcessCapacity, CapacityConstraint, CapacityRate, CapacityWindow,
  WorkloadProfile, ProcessPath, StationStandard, CapacityPlan, Bottleneck,
  workload forecast, labour plan, labour plan drift.
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
  customer/supplier edge to process-path-management (ADR 0025).
- [Aggregate Design Canvas](/contexts/warehouse-planning/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  the `CapacityPlan` aggregate (plus the `ProcessCapacity` aggregate).
- [Domain Events](/contexts/warehouse-planning/domain-events):
  the capacity-plan events (`CapacityPlanCreated`, `CapacityPlanPublished`,
  `CapacityShortageDetected`, `BottleneckDetected`), the `processcapacity`
  events, `WorkloadForecastReceived`, `LabourPlanCommitted` and
  `LabourPlanDriftDetected`, plus the events it consumes. The synced page does
  not list `CapacityPlanSuperseded` yet; the generated AsyncAPI reference does.
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
  There are twenty-five on `develop` (0001 to 0025); 0022 to 0025 are the
  requirement side.
- [ADR index](/adr): links to this context's own decision records.
- **Generated references on this site**: [REST](/api-reference/rest/warehouse-planning/warehouse-planning)
  and [AsyncAPI](/api-reference/async/warehouse-planning), generated from
  the real `apis/openapi.yaml` and `apis/asyncapi.yaml`.
- **Fleet-level**: [Context Map](/strategic-design/context-map) and the
  [Event Standard](/strategic-design/event-standard-cloudevents).
