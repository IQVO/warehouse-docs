---
id: index
title: Warehouse Planning
sidebar_label: Warehouse Planning
description: The Core bounded context that answers "can this warehouse process the demand assigned to it" — process-path capacity, window-coverage resolution, station capacity composition, and capacity plans with shortage and bottleneck detection.
slug: /contexts/warehouse-planning
---

# Warehouse Planning

<span class="badge-core">Core Domain</span>

**Warehouse Planning** is the fleet's eleventh backend bounded context and
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

:::info[What is live, and what is planned]
**Live (verified against the repository's own docs):**
`workforce-management` → `warehouse-planning` (`ShiftPlanCommitted` on
`warehouse.workforce.events`) and `facility-layout` → `warehouse-planning`
(`LocationSlotRegistered` / `LocationSlotDecommissioned` on
`warehouse.facility.events`) are real Kafka consumers. The context publishes
four `capacityplan` CloudEvents on `warehouse.warehouse-planning.events`
through a transactional outbox, and serves REST (`:8080`, Kong route
`/api/warehouse-planning`) and MCP (10 tools, Streamable HTTP on `:8090`).

**Planned / in progress, NOT live:** `order-management` as a consumer of this
context's events — a separate change in a separate repository, in progress.
No other context consumes this context's events today, and neither
`warehouse-ops-agent` nor `warehouse-console` calls it yet.

**Not built:** an analytics stream
(`warehouse.warehouse-planning.analytics`), the analytics projector/reports,
and a `web/` frontend remote.
:::

:::note[Deliberately not consumed]
`process-path-management` is **not** consumed. Its `ProcessPath` carries
routing and capability metadata (`path_id`, `required_capabilities`,
`eligibility`), never an ordered list of physical process steps, so this
context owns its own, operator-declared `ProcessPath` and shares only the
`path_id` string as a loose human cross-reference (ADR 0001 Addendum).
:::

## On this page set

- **[Business Context](/contexts/warehouse-planning/business-context)** — why
  "how much work can we perform" needed its own context.
- **[Ubiquitous Language](/contexts/warehouse-planning/ubiquitous-language)** —
  ProcessCapacity, CapacityConstraint, CapacityRate, CapacityWindow,
  WorkloadProfile, ProcessPath, StationStandard, CapacityPlan, Bottleneck.
- **[Bounded Context Canvas](/contexts/warehouse-planning/bounded-context-canvas)** —
  the full ddd-crew canvas: purpose, classification, roles, inbound/outbound
  communication, MCP tools, business decisions, open questions.
- **[Aggregate Design Canvas](/contexts/warehouse-planning/aggregate-design-canvas)** —
  the `CapacityPlan` aggregate (plus the `ProcessCapacity` aggregate).
- **[Domain Events](/contexts/warehouse-planning/domain-events)** —
  `CapacityPlanCreated`, `CapacityPlanPublished`, `CapacityShortageDetected`,
  `BottleneckDetected`.
- **[Async API](/contexts/warehouse-planning/async-api)** — the Kafka
  integration, narrative form.

## Elsewhere

- **Repository** — [github.com/IQVO/warehouse-planning](https://github.com/IQVO/warehouse-planning)
- **ADRs** — [0001](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0001-warehouse-planning-bounded-context.md),
  [0002](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0002-station-capacity-composition.md),
  [0003](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0003-window-coverage-semantics.md)
  (this context keeps them under `docs/adr/`, not `docs/docs/adr/`; there is
  no separate docs site of its own)
- **Generated API Reference** — [REST](/api-reference/rest/warehouse-planning/warehouse-planning)
  and [AsyncAPI](/api-reference/async/warehouse-planning), generated from the
  real `apis/openapi.yaml` and `apis/asyncapi.yaml`
- **Fleet-level** — [Context Map](/strategic-design/context-map) and the
  [Event Standard](/strategic-design/event-standard-cloudevents)
