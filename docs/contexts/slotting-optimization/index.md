---
id: index
title: Slotting Optimization
sidebar_label: Slotting Optimization
description: The Supporting, WMS-tier bounded context that decides which SKUs deserve a forward pick slot, and which slot each one gets, by pick velocity, with human approval.
slug: /contexts/slotting-optimization
---

# Slotting Optimization

<span className="badge-supporting">Supporting Subdomain</span>

**Slotting Optimization** is one of the fleet's sixteen domain bounded
contexts. It sits in the `wms` tier of the CloudEvents subdomain taxonomy, the
fifth `wms` context after `facility-layout`, `inventory-storage`,
`product-master` and `inbound-receiving`. It decides **which SKUs deserve a
forward pick slot, and which slot each one gets**. It computes a reviewable
proposal (a *slot plan*), a human approves or rejects it, and an approved plan
is published as a CloudEvent carrying the full forward assignment map and the
physical moves it implies.

:::info[What is built, what is deployed, and what is planned]
Per this context's own [Context Map](/contexts/slotting-optimization/context-map)
and [integration page](https://iqvo.github.io/slotting-optimization/docs/ecosystem/integration),
checked against `develop` (and, for deployment, `warehouse-infra` `develop`):

**Built on `develop`:** the REST API (seven operations), the transactional
outbox and relay, **four** opt-in Kafka consumers (demand from
`order-management`, product facts from `product-master`, zones and slots from
`facility-layout`, and executed relocations from `inventory-storage`) and a
read-only MCP server (`cmd/mcp`, ADR 0005).

**Slot-plan execution is built, end to end** (ADR 0010, which supersedes
ADR 0007). Approving a plan publishes `SlotPlanApproved`;
`wes-work-planning` plans one `RELOCATE` work unit per move (its ADR 0040);
`fulfillment-execution` runs the task and its `TaskCompleted` carries the
moved SKU, bins and counted quantity (its ADR 0047); `inventory-storage`
applies it as `RelocateStock` and raises `StockRelocated` (its ADR 0039);
this context consumes that into per-plan `execution` progress on
`GET /slot-plans/{planId}`. It never creates floor work and never writes the
stock ledger itself.

**Deployed:** `warehouse-infra` `develop` registers it (database, Kong route
`/api/slotting-optimization`, ArgoCD application) and
`helm-values/slotting-optimization.yaml` turns on the Kafka publisher and all
four consumers, so the edges are **live**. The `RELOCATE` process path must be
seeded in `process-path-management` first. Nothing in `warehouse-ops-agent`
calls the MCP server yet.

**Not owned here:** `REPLENISH` (min/max) work belongs to
`pick-face-replenishment` (`wms`, Supporting), [built on `develop`](/contexts/pick-face-replenishment)
(2026-10-17). It consumes this context's `SlotPlanApproved` as the forward map, but it is
not deployed: `warehouse-infra` `develop` has no values file, route or ArgoCD application for it, so the edge is
wired-but-unused (K39 in the fleet [Context Map](/strategic-design/context-map)). The whole
loop it needs is built on `develop`: `inventory-storage` publishes `BinStockLevelChanged` and the
`REPLENISHMENT` relocation reason (its ADR 0040 and ADR 0041), `wes-work-planning` plans `REPLENISH`
work from `ReplenishmentRequested` (its ADR 0042, opt-in and off in the reference deployment),
`process-path-management` declares the `REPLENISH` path (its ADR 0036) and `fulfillment-execution`
runs `REPLENISH` tasks (its ADR 0050). Nothing runs it yet (K44, wired-but-unused).
This context's own `RecordRelocation` ignores a `REPLENISHMENT` relocation: since its PR #35 only reason
`SLOTTING` executes a slot-plan move.

**Planned, not built** (checked on `develop`): an analytics read side
(`warehouse.slotting-optimization.analytics` is reserved by ADR 0004 and
nothing is published there; the AsyncAPI declares no such channel) and a
console remote (there is no `web/` directory and `warehouse-console` has no
slotting feature).
:::

It owns one aggregate, **`SlotPlan`** (package `internal/domain/slotplan`),
generated as a `Draft` by the `abc-velocity-v1` policy (package
`internal/domain/planning`) and moved to `Approved` or `Rejected` by a human.
Approving a plan supersedes the site's previous Approved plan in the same
transaction (`Superseded` is the fourth state).

## This context's pages

- [Business Context](/contexts/slotting-optimization/business-context): the
  gap, what it owns, the v1 policy, the decisions taken, and what the context
  deliberately does not do.
- [Ubiquitous Language](/contexts/slotting-optimization/ubiquitous-language):
  slot plan, forward slot, assignment, move, velocity, demand window,
  stickiness, local copy.
- [Core Domain Chart](/contexts/slotting-optimization/core-domain-chart):
  Supporting, and why.
- [Bounded Context Canvas](/contexts/slotting-optimization/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, classification, roles, inbound and outbound communication,
  business decisions and open questions.
- [Context Map](/contexts/slotting-optimization/context-map): every edge with
  its pattern, technology and state, planned edges labelled.
- [Aggregate Design Canvas](/contexts/slotting-optimization/aggregate-design-canvas):
  `SlotPlan`.
- [Domain Events](/contexts/slotting-optimization/domain-events): the three
  published events and the eight consumed ones.
- [Domain Message Flow](/contexts/slotting-optimization/domain-message-flow),
  [EventStorming](/contexts/slotting-optimization/eventstorming),
  [Class Diagram](/contexts/slotting-optimization/class-diagram),
  [Entity Relationship](/contexts/slotting-optimization/entity-relationship),
  [Sequence Diagrams](/contexts/slotting-optimization/sequence-diagrams) and
  [Use Cases](/contexts/slotting-optimization/use-cases).
- [Async API](/contexts/slotting-optimization/async-api): the Kafka narrative.
- Generated references: [REST](/api-reference/rest/slotting-optimization/slotting-optimization-api)
  and [AsyncAPI](/api-reference/async/slotting-optimization).

## Elsewhere

- **Repository**: [github.com/IQVO/slotting-optimization](https://github.com/IQVO/slotting-optimization),
  with its own docs site at
  [iqvo.github.io/slotting-optimization](https://iqvo.github.io/slotting-optimization/).
  Its ADRs live under `docs/adr/`: 0001 (bounded context), 0002 (the
  `SlotPlan` aggregate, its invariants and the `abc-velocity-v1` policy), 0003
  (event-fed local copies and the consumed contracts), 0004 (CloudEvents
  envelope and type catalogue) and 0005 (MCP server) are Accepted
  (2026-10-08). 0007 (executing an approved plan) is **Superseded** by 0010
  (Accepted, 2026-10-14: approved plans are executed as WES relocation work,
  plus the `StockRelocated` consumer and the plan's `execution` progress).
  0008 and 0009 cover the outbox attempt cap and trace context.
- **Fleet-level**: [Context Map](/strategic-design/context-map) (K25 to K27,
  K29 and K38; K37 is the `inventory-storage` hop in between), the
  [Event Standard](/strategic-design/event-standard-cloudevents)
  (subdomain table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [Ubiquitous Language](/strategic-design/ubiquitous-language).
