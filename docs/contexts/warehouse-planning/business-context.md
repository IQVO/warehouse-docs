---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why "can this warehouse process the demand assigned to it" is its own bounded context — the gap between what each existing context knows and a normalized capacity answer.
---

# Business Context

Sourced from the repository's `README.md`, `CLAUDE.md` and
[ADR 0001](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0001-warehouse-planning-bounded-context.md).

## The question nobody answered

Every other context in the fleet knows a piece of what limits warehouse
throughput:

- `workforce-management` knows labor — how many heads are committed to which
  process path for a shift;
- `facility-layout` knows physical structure — which zones, which slots,
  which work centers support which activities;
- `process-path-management` knows path topology — routing and capability
  metadata;
- `inventory-storage` knows what stock exists, and `fulfillment-execution`
  and `wes-work-planning` know execution-time flow.

None of them answers **"can this warehouse process the demand assigned to
it?"** — and `workforce-management` explicitly stops at the path boundary.
Inventory Management answers "what do we have"; this context answers "how
much work can we perform". A reference study of Warehouse Capacity Planning
identified it as a genuine missing bounded context rather than something to
bolt onto an existing service (ADR 0001, Context).

## What it computes

- **Effective capacity of one process at one location for one window** — the
  minimum across its registered constraints (labor, location, equipment,
  station, conveyor, buffer, replenishment).
- **Normalized path capacity** — a path such as Pick → Rebin → Pack is only
  as fast as its slowest step, after every step's native unit (units/hour,
  packages/hour, orders/hour) is converted to orders per hour with a
  `WorkloadProfile`. Raw rates in different units are never compared.
- **A capacity plan** — assigned demand for a location and window versus the
  capacity over that window, with the **shortage** (never negative; demand
  exactly equal to capacity is not a shortage) and the **bottleneck** step
  that limits end-to-end flow.
- **The labour a plan requires** — per step of the path, the tasks the demand
  implies times the engineered standard seconds from `labor-performance`,
  as required labour hours and average heads. A step with no standard or no
  task factor is reported unknown with a reason, never guessed (ADR 0022).

## The requirement side: forecast, labour plan, scenarios

On 2026-11-18 four decisions (ADRs 0022 to 0025) made this context the owner
of the requirement side of planning, next to the capacity side above. Before,
the forecast and the shift plan were saved in `wes-work-planning`, and the
shift's heads were committed separately in `workforce-management`. Now:

- **The workload forecast** — the volume a process path will receive at a
  site, in CPT buckets, saved by `PUT /workload-forecasts/{site_id}/{path_id}`
  (ADR 0023). It is what `wes-work-planning` called the charge forecast;
  that context stopped recording it (ADR 0049 there).
- **The labour plan** — the heads a path needs for one shift at one site,
  saved by `PUT /labour-plans/{site_id}/{shift_id}/{path_id}` and published as
  `LabourPlanCommitted`, which `workforce-management` turns into proposed
  heads (its ADR 0043). Heads can be derived from the forecast when the caller
  omits them. The invariant that planned heads never exceed installed
  stations moved here unchanged.
- **Drift** — the signed difference between the heads workforce-management
  committed (read from `ShiftPlanCommitted`) and the heads the plan needs,
  raised as `LabourPlanDriftDetected` only when it is non-zero and has
  changed. It never corrects either side.
- **Forecast demand** — `POST /capacity-plans` accepts
  `demand_source: forecast`: the demand is the forecast quantity whose CPT
  falls in the plan window, divided by the request's `units_per_order`
  (required for this source). No bucket in the window is no data, not zero
  demand (ADR 0024).
- **Scenarios and the comparison read** — several draft plans of one window
  are what-if scenarios, each with a `scenario` label.
  `GET /capacity-plans/comparisons?ids=` lines two to five of them up side by
  side, reading stored plans rather than recomputing.
- **Supersession** — publishing a plan moves the plan previously published for
  the same site, location, path and window to the terminal status
  `SUPERSEDED` and raises `CapacityPlanSuperseded`, so a consumer keeps the
  newest published plan per window. `order-management` consumes it (its ADR
  0052) and matches plans by the plan's `site_id`, else by `location` (its
  ADR 0053).

`ProcessFlow` (ADR 0025) is decided and not built: `process-path-management`
would publish the ordered stages of a flow and this context would read them
as a path's steps instead of declaring them with `POST /process-paths`. Until
it is built, a path's steps are still declared here.

## Why capacity is composed, not stored

Two decisions shaped the model after the first phases met real cluster data:

1. **A station count is not a throughput** (ADR 0002). Ten stations at 180
   packages per hour per station is 1,800 packages per hour; the count alone
   means nothing. Station capacity is therefore composed **at read time**
   from the facility tally and an operator-declared `StationStandard`, so the
   answer converges whatever order the inputs arrived in, leaves no stale
   rows, and handles a standard declared after the stations were tallied.
2. **A registered window applies when it covers the planning window**
   (ADR 0003). The labor consumer registers one window per fanned-out
   `ShiftPlanCommitted` line, all starting at the event time and ending after
   each line's own planned hours — so no single exact `(start, end)` pair
   exists for all steps of a path. Coverage lets a real path resolve for every
   window inside the intersection of its step windows, and rejects a window
   reaching past a step's end rather than assuming capacity beyond the hours
   planned.

## No live cross-context calls

A capacity decision must stay available and fast even when an upstream
context is degraded. This context therefore never makes a synchronous REST or
MCP call to a sibling: the facts it needs from `workforce-management` and
`facility-layout` arrive as published CloudEvents and are kept as local read
models — generalizing the rule already adopted by `process-path-management`
and `labor-performance` (ADR 0001).

## Honest scope today

- **Demand.** Order demand arrives from `order-management`'s allocation
  events (ADR 0004), at the event's own `site_id` (ADR 0021), and inbound
  labour demand from `dock-scheduling`'s dock appointments (ADR 0020, which
  replaced `inbound-receiving`'s); the workload forecast (ADR 0024) and
  `assigned_demand` with the `WorkloadProfile` factors can still travel in
  the `POST /capacity-plans` body. Demand from
  `network-fulfillment` remains a documented later decision (ADR 0001).
- **Downstream consumption.** `order-management` consumes the capacity-plan
  events, `CapacityPlanSuperseded` included, into a local read model (its
  ADRs 0031 and 0052); `workforce-management` consumes `LabourPlanCommitted`
  (its ADR 0043); see the
  [Context Map](/strategic-design/context-map).
- **Read side.** The analytics stream and `planning-projector` (ADR 0005)
  and the console's `capacity_mfe` remote are built.
