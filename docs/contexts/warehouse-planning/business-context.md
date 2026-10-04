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

- **Demand is supplied in the request.** `assigned_demand` and the
  `WorkloadProfile` factors travel in the `POST /capacity-plans` body. The
  final demand-ingestion shape from `order-management` / `network-fulfillment`
  is a documented later decision (ADR 0001), not a wired integration.
- **Downstream consumption is planned.** `order-management` consuming this
  context's events is a separate, in-progress change; see the
  [Context Map](/strategic-design/context-map).
- **No analytics stream and no frontend remote yet** (README, tracked
  deferrals).
