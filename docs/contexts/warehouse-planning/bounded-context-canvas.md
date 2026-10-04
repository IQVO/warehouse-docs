---
id: bounded-context-canvas
title: Bounded Context Canvas
sidebar_label: Bounded Context Canvas
description: The full ddd-crew Bounded Context Canvas for warehouse-planning — purpose, strategic classification, roles, inbound/outbound communication, MCP tools, business decisions, open questions.
---

# Bounded Context Canvas

Following the [ddd-crew Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas).

## Name

**Warehouse Planning** (`warehouse-planning`)

## Purpose

To answer whether a warehouse can process the demand assigned to it, given
its current labor, location, equipment, station, conveyor and buffer
constraints: to hold the usable throughput of each process at each location
and window, compose it into a normalized end-to-end path capacity, and record
the result as a **CapacityPlan** with its shortage and bottleneck — then
announce shortages as events. It does not own labor scheduling, storage
slotting, or path capability/eligibility authoring; those remain in their
existing contexts (ADR 0001, Consequences).

## Strategic Classification

| Axis | Verdict |
| --- | --- |
| Domain | **Core Domain** (ADR 0001) |
| Tier | `wes` in the CloudEvents subdomain taxonomy (`wms` is reserved for `facility-layout` / `inventory-storage`) |

**Justification.** The repository's own ADR 0001 introduces it as a new Core
Domain bounded context: a normalized, cross-process effective capacity and a
forward-looking capacity shortage is a capability no other fleet context
provides, and it was judged a genuine missing bounded context rather than a
feature of an existing one.

## Domain Roles

| Role | Applies here? | Notes |
| --- | --- | --- |
| Open Host Service | **Yes** | REST (`:8080`), MCP (`:8090`) and the `warehouse.warehouse-planning.events` topic are documented, stable integration points. |
| Published Language | **Yes** | Four `capacityplan` CloudEvents, documented field by field in `apis/asyncapi.yaml`. |
| Execution/Workflow | No | It evaluates capacity; it does not dispatch, route, or assign work. |
| Analytics / Reporting | **Not yet** | No analytics stream (`warehouse.warehouse-planning.analytics`) and no projector/reports are deployed — tracked deferrals. |

## Inbound Communication

This context makes **no live REST or MCP call** to any sibling — cross-context
facts arrive as Kafka events and are kept as local read models (ADR 0001,
`CLAUDE.md` "Cross-context integration rule"). Delivery is at-least-once: each message is handled in one unit
of work (idempotency claim + effect), offsets are committed only after
success, and transient failures retry the same message with backoff.

| Message | Sent by | Delivery | Status |
| --- | --- | --- | --- |
| `com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted` | `workforce-management` | Kafka `warehouse.workforce.events` (consumer group from env `LABOR_CAPACITY_CONSUMER_GROUP`) — one message per `PathPlan` line becomes a `LABOR` constraint on `Location = building_id` for `[event time, + planned_hours)` | **Live** |
| `com.warehouse.wms.facility-layout.locationslot.LocationSlotRegistered` / `LocationSlotDecommissioned` | `facility-layout` | Kafka `warehouse.facility.events` (consumer group from env `STORAGE_CAPACITY_CONSUMER_GROUP`) — a pure **tally** of storage positions and work-center stations; registers no ProcessCapacity | **Live** |
| REST commands and queries | Operators / tooling via Kong (`/api/warehouse-planning`) | Synchronous REST, RFC 7807 errors, no auth (see `apis/openapi.yaml`) | **Live** |
| MCP tool calls | Any MCP client | Streamable HTTP on `:8090`, no auth | **Live**; no fleet caller yet |

`process-path-management` is deliberately **not** consumed: its `ProcessPath`
has no physical step sequence, so this context owns its own `ProcessPath`
(ADR 0001 Addendum).

## Outbound Communication

| Collaborator(s) | Relationship pattern | Integration | Status |
| --- | --- | --- | --- |
| `order-management` | Open Host Service + Published Language (this context upstream; `order-management` downstream) | `warehouse.warehouse-planning.events` — ADR 0001 anticipates `CapacityShortageDetected` and a capacity-published event feeding order-management; the consumer is "a later, separate change" | **Planned / in progress — NOT live.** Tracked in a parallel change in the `order-management` repository; this row is to be flipped when it lands |
| `warehouse-ops-agent`, `warehouse-console` | Open Host Service (REST/MCP read-only capacity queries, per ADR 0001) | REST / MCP | **Not consumed yet** — neither calls this context today |

Anticipated by ADR 0001 but with no code behind them today: observed-capacity
feedback from `fulfillment-execution` / `wes-work-planning`, and
assigned-demand ingestion from `order-management` / `network-fulfillment`
(ADR 0001 itself says the final shape is "to be confirmed before the
demand-ingestion phase"). Demand is currently carried in the
`POST /capacity-plans` request body.

Events are written through the **transactional outbox** (`outbox_events`, a
relay in `cmd/api`, `EVENT_PUBLISHER=kafka|log`): the plan and its encoded
CloudEvents commit in one database transaction, and a relay drains them to
Kafka at-least-once, keyed and `subject`ed by the plan id.

## MCP tools

One MCP server (`cmd/mcp`, official Go SDK, Streamable HTTP only on `:8090`
at `/` and `/mcp`, open `GET /healthz`, **no auth**) over the same use cases
as REST. It never starts the outbox relay and never dials Kafka. The tool
budget is 10 (7 original + 3 station-capacity tools):

| Tool | R/W | Purpose |
| --- | --- | --- |
| `register_process_capacity_constraint` | write | Upsert one constraint on a ProcessCapacity (exact window key) |
| `get_effective_process_capacity` | read | Effective rate and binding constraint for one process, location, window (exact key) |
| `register_process_path` | write | Declare a ProcessPath (ordered, non-empty steps) |
| `get_process_path_capacity` | read | Normalized path capacity, bottleneck step, `step_breakdown`, warnings (window coverage) |
| `create_capacity_plan` | write | Create a DRAFT CapacityPlan (queues `CapacityPlanCreated`) |
| `publish_capacity_plan` | write | Publish a plan (queues the publish-time events) |
| `get_capacity_plan` | read | Read a plan |
| `declare_station_standard` | write (idempotent) | Declare the throughput of one station of a process at a site |
| `list_station_standards` | read | List declared station standards |
| `get_storage_capacity` | read | The site's storage positions and station counts — a read model |

## Ubiquitous Language

See [Ubiquitous Language](./ubiquitous-language): `ProcessCapacity`,
`CapacityConstraint`, `CapacityRate`, `CapacityWindow`, `WorkloadProfile`,
`ProcessPath`, `StationStandard`, `ProcessPathCapacity`, `CapacityPlan`,
`Bottleneck`.

## Business Decisions

1. **A capacity number always carries a window**, and a registered window
   applies to a planning window only when it **covers** it
   (`C.start <= W.start AND C.end >= W.end`). Overlap and containment of the
   registered window in the request were considered and rejected as
   overstating capacity (ADR 0003).
2. **Newest wins, per constraint type.** Among covering aggregates, the
   constraint of each type comes from the one with the latest window start
   (tie: the narrower window); another type in an older aggregate still
   applies (ADR 0003).
3. **Station capacity is composed at read time**, never stored: `count x
   StationStandard`, normalized with the other candidates, minimum taken. No
   standard declared means a warning, never an invented throughput (ADR
   0002).
4. **Every candidate is normalized to ORDER per hour before comparing.**
   Units per hour and packages per hour are not comparable raw; a `LINE` rate
   cannot be normalized and is rejected.
5. **A plan keeps the requested window.** `capacity_over_window` and the
   shortage come from the requested window's length, never from a
   constraint's own window; demand equal to capacity is not a shortage.
6. **A plan is published at most once.** A second publish is rejected
   (`409 capacity-plan-already-published`) and queues nothing.
7. **No live cross-context lookup, ever** — upstream facts are consumed as
   events (ADR 0001).
8. **Missing coverage is explicit.** A step with no covering aggregate and no
   STATION constraint is `422 missing-step-capacity`, naming the step.

## Assumptions

- The labor window `[event time, event time + planned_hours)` is a documented
  assumption: no upstream field carries a real shift-start time (ADR 0001
  Addendum, kept by ADR 0003).
- `planned_rate`'s native unit is not specified upstream; the labor rate
  (`planned_heads * planned_rate`) is registered as `UNIT/HOUR`, a documented
  default.
- Site = building id = the first dash-separated segment of a facility zone id.
  A documented fleet convention, with the fail-safe that a zone with no
  matching site contributes nothing (`SIM1-` never matches `SIM10-`).
- Storage positions are **not** process throughput and have no "consumed"
  figure — stock is never read from `inventory-storage`.

## Verification Metrics

- **Envelope conformance**: a golden exact-JSON test per published `type`
  (all attributes plus the `content-type` header), and a
  legacy-flat-message-rejected test per consumer.
- **At-least-once with an atomic effect**: consumer rollback/retry/redelivery
  proven against real Postgres + Kafka (testcontainers).
- **Outbox atomicity**: plan + outbox rows in one transaction, retry carries
  the same CloudEvents `id`.
- **Spec drift**: the `docs-api-drift` CI job fails if the generated docs
  disagree with `apis/openapi.yaml`.

## Open Questions

- What is the final demand-ingestion shape from `order-management` /
  `network-fulfillment`, replacing `assigned_demand` in the request body
  (ADR 0001)?
- Should `workforce-management` expose a real shift-start timestamp, replacing
  the derived labor window?
- A message failing with an unrecognised but deterministic error blocks its
  partition (retried with a 5s capped backoff) by design — there is no DLQ
  yet.
- Which events will `order-management` consume first, once its consumer
  lands? (Planned / in progress.)
