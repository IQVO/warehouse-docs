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

**Built on `develop` (`cac857d`):** the REST API (fourteen path × method
pairs in `apis/openapi.yaml`, including the two analytics report routes,
`/healthz` and `/readyz`), the transactional outbox and relay, and **four**
Kafka consumers, always on since its ADR 0006 (`DATABASE_URL`, `KAFKA_BROKERS`
and every consumer group are mandatory and a missing one is a boot error): bin
levels and relocations from `inventory-storage`, the forward map from
`slotting-optimization`, zones and locations from `facility-layout`, and
product-master's pack levels (its ADR 0009, the pack-derived replenishment
multiple). It ships four binaries: `cmd/api`, a read-only MCP server
(`cmd/mcp`, ADR 0007) and the analytics read side `cmd/pfr-projector` +
`cmd/pfr-reports` (ADR 0008), plus a Dockerfile, a Helm chart and the console
remote `replenishment_mfe`.

**Wired in `warehouse-infra` `develop`:** `terraform/apps.yaml` registers it
(database, analytics database, `frontend_remote: replenishment_mfe`) and
`helm-values/pick-face-replenishment.yaml` sets all four consumer groups
(`inventory`, `slotting`, `layout`, `pack-levels`) and the analytics projector.
`warehouse-ops-agent` has an MCP client for it
(`internal/adapters/outbound/mcpclient/pick_face_replenishment.go`). The kind
cluster was not checked.

**What is built around it, checked on each sibling's `develop`:** the inputs
from `slotting-optimization` (`SlotPlanApproved`) and `facility-layout` (zones
and location slots) are published by live producers, and so are the two
`inventory-storage` inputs: `inventory-storage` publishes `BinStockLevelChanged`
(its ADR 0040) and records a completed `REPLENISH` task as a `StockRelocated`
with the reason `REPLENISHMENT` and `source_ref` equal to the request id (its
ADR 0041). The output side is built too, hop by hop (fleet edge K44):

1. `wes-work-planning` consumes `ReplenishmentRequested` and
   `ReplenishmentCancelled` and plans one `REPLENISH` work unit per request id
   (its ADR 0042, `internal/adapters/inbound/kafka/replenishment_consumer.go`).
   The consumer is opt-in: `REPLENISHMENT_MODE=kafka` with a stable
   `REPLENISHMENT_CONSUMER_GROUP`; the default `permissive` consumes nothing.
2. `process-path-management` declares the `REPLENISH` path (its ADR 0036:
   `catalogue/paths.json`, intake `REPLENISHMENT`), applied by its
   `scripts/seed_catalogue.py`.
3. `wes-work-planning` releases the unit with the additive `replenishment`
   object on `WorkReleased`, and `fulfillment-execution` creates a `REPLENISH`
   task from it, announces it and reports `TaskCompleted` with `request_ref`
   (its ADR 0050).
4. `inventory-storage` applies that completion as the `REPLENISHMENT`
   relocation that closes the request (K43), and `slotting-optimization` no
   longer mistakes a `REPLENISHMENT` move for a slot-plan move (its PR #35).

So on `develop` a request can be raised, planned, executed and completed, and
every hop is wired in `warehouse-infra` `develop` (this service's values file,
`REPLENISHMENT_MODE=kafka` for `wes-work-planning`). The `REPLENISH` path
reaches a cluster only through the catalogue seed (an operator step), and no
request has been traced through all five hops on a cluster.

**Planned, not built:** a demand-cover policy behind the same port as
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
  type catalogue), 0005 (evaluation semantics and persistence), 0006
  (Postgres and Kafka are the only runtime), 0007 (MCP server), 0008
  (analytics read side) and 0009 (pack-derived replenishment multiple).
- **Fleet-level**: [Context Map](/strategic-design/context-map) (K39, K40,
  K42 to K44 and the pack-level edge K62, all live: built on both ends and
  wired in `warehouse-infra` `develop`),
  the [Event Standard](/strategic-design/event-standard-cloudevents)
  (subdomain table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [Ubiquitous Language](/strategic-design/ubiquitous-language).
