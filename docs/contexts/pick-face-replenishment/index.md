---
id: index
title: Pick-Face Replenishment
sidebar_label: Pick-Face Replenishment
description: The Supporting, WMS-tier bounded context that keeps every forward pick face stocked between a min and a max by requesting a move from the fullest reserve bin, and closes the request when the stock ledger records the move.
slug: /contexts/pick-face-replenishment
---

# Pick-Face Replenishment

<span className="badge-supporting">Supporting Subdomain</span>

**Pick-Face Replenishment** is one of the fleet's sixteen domain bounded
contexts. It sits in the `wms` tier of the CloudEvents subdomain taxonomy, the
sixth `wms` context after `facility-layout`, `inventory-storage`,
`product-master`, `inbound-receiving` and `slotting-optimization`, which it
extends: slotting decides which SKU holds which forward slot, this context
keeps that slot stocked. It holds an explicit **min/max policy** per site and
SKU, watches the stock level of each forward bin through event-fed local
copies, and when the projected level reaches the minimum it raises a
**replenishment request**: move a quantity of the SKU from the fullest reserve
bin to the forward bin, never above the policy maximum. It closes the request
when `inventory-storage` records the matching relocation.

:::info[What is built, what is deployed, and what is planned]
Per this context's own [Context Map](/contexts/pick-face-replenishment/context-map)
and [integration page](https://iqvo.github.io/pick-face-replenishment/docs/ecosystem/integration),
checked against `develop` (and, for deployment, `warehouse-infra` `develop`):

**Built on `develop`:** the REST API (twelve operations), the transactional
outbox and relay, and **three** opt-in Kafka consumers (bin levels and
relocations from `inventory-storage`, the forward map from
`slotting-optimization`, zones and locations from `facility-layout`). There is
one binary, `cmd/api`, and **no MCP server**.

**Not deployed.** `warehouse-infra` `develop` has no entry for it: no
database, no Kong route, no ArgoCD application, no values file, no dashboard.
The repository itself has no Dockerfile and no Helm chart on `develop` (its
Runbook lists both as absent). So every edge to and from this context is built
on one side at most and **not wired in the reference cluster**.

**What is built around it, checked on each sibling's `develop`:** the inputs
from `slotting-optimization` (`SlotPlanApproved`) and `facility-layout` (zones
and location slots) are published by live producers, and since the latest
sibling changes so are the two `inventory-storage` inputs:
`inventory-storage` publishes `BinStockLevelChanged` (its ADR 0040) and records
a completed `REPLENISH` task as a `StockRelocated` with the reason
`REPLENISHMENT` and `source_ref` equal to the request id (its ADR 0041).
`fulfillment-execution` creates a `REPLENISH` task from
`WorkReleased.data.replenishment`, announces it and reports `TaskCompleted`
with `request_ref` (its ADR 0050), and `slotting-optimization` no longer
mistakes a `REPLENISHMENT` move for a slot-plan move (its PR #35). Two ends of
the chain exist, but the middle does not:

- Nothing consumes `ReplenishmentRequested`: `wes-work-planning` has no
  consumer of the topic, no `REPLENISH` work unit and no `replenishment`
  object on `WorkReleased` (P3b), and `process-path-management` has no
  `REPLENISH` path.

So today a request can be raised and cancelled, but no floor work is created
for it and it cannot be completed. Everything is moot until this service is
deployed.

**Planned, not built:** the `wes-work-planning` planner (a `REPLENISH` work
unit, a `REPLENISH` path), an analytics read side, a `warehouse-ops-agent`
client and a console remote, and a demand-cover policy behind the same port as
`MIN_MAX`.
:::

It owns two aggregates and one pure function:

- **`ReplenishmentPolicy`** (package `internal/domain/policy`): the `MIN_MAX`
  rule of one (site, SKU) with `minQty`, `maxQty`, `multiple` and a `version`
  for optimistic concurrency. Declared and removed through REST.
- **`ReplenishmentRequest`** (package `internal/domain/replenishment`): one
  decision to move stock from one reserve bin to one forward bin, in the
  states `Requested`, `Completed` and `Cancelled`. At most one is open per
  (site, forward bin, SKU).
- **The detector** (package `internal/domain/detection`): turns a pick face,
  its policy, its open request and the candidate reserve bins into one of five
  verdicts (`Raise`, `Healthy`, `AlreadyOpen`, `NoPolicy`, `NoSource`). The
  source bin policy is `fullest-reserve-bin-v1`.

## This context's pages

- [Business Context](/contexts/pick-face-replenishment/business-context): the
  gap, what it owns, the v1 policy, and what the context deliberately does not
  do.
- [Ubiquitous Language](/contexts/pick-face-replenishment/ubiquitous-language):
  pick face, forward bin, reserve bin, policy, request, projected level,
  priority, source bin policy.
- [Core Domain Chart](/contexts/pick-face-replenishment/core-domain-chart):
  Supporting, and why.
- [Bounded Context Canvas](/contexts/pick-face-replenishment/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, classification, roles, communication, decisions.
- [Context Map](/contexts/pick-face-replenishment/context-map): every edge with
  its pattern, technology and state, planned edges labelled.
- [Aggregate Design Canvas](/contexts/pick-face-replenishment/aggregate-design-canvas):
  `ReplenishmentPolicy` and `ReplenishmentRequest`.
- [Domain Events](/contexts/pick-face-replenishment/domain-events): the four
  published events and the six consumed ones.
- [Domain Message Flow](/contexts/pick-face-replenishment/domain-message-flow),
  [EventStorming](/contexts/pick-face-replenishment/eventstorming),
  [Class Diagram](/contexts/pick-face-replenishment/class-diagram),
  [Entity Relationship](/contexts/pick-face-replenishment/entity-relationship),
  [Sequence Diagrams](/contexts/pick-face-replenishment/sequence-diagrams) and
  [Use Cases](/contexts/pick-face-replenishment/use-cases).
- **Operations**: [Configuration](/contexts/pick-face-replenishment/configuration),
  [Runbook](/contexts/pick-face-replenishment/runbook),
  [Observability](/contexts/pick-face-replenishment/observability),
  [Troubleshooting](/contexts/pick-face-replenishment/troubleshooting) and
  [Testing](/contexts/pick-face-replenishment/testing).
- [Async API](/contexts/pick-face-replenishment/async-api): the Kafka narrative.
- Generated references: [REST](/api-reference/rest/pick-face-replenishment/pick-face-replenishment-api)
  and [AsyncAPI](/api-reference/async/pick-face-replenishment).

## Elsewhere

- **Repository**: [github.com/IQVO/pick-face-replenishment](https://github.com/IQVO/pick-face-replenishment),
  with its own docs site at
  [iqvo.github.io/pick-face-replenishment](https://iqvo.github.io/pick-face-replenishment/).
  Its ADRs live under `docs/adr/`: 0001 (bounded context), 0002 (the two
  aggregates, their invariants and the detection policy), 0003 (event-fed
  local copies and the consumed contracts), 0004 (CloudEvents envelope and
  type catalogue) and 0005 (evaluation semantics and persistence) are all
  Accepted (2026-10-17).
- **Fleet-level**: [Context Map](/strategic-design/context-map) (K39, K40 and
  K42 to K44),
  the [Event Standard](/strategic-design/event-standard-cloudevents)
  (subdomain table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [Ubiquitous Language](/strategic-design/ubiquitous-language).
