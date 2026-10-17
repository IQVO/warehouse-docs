---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why keeping a forward pick face stocked is its own bounded context — the min/max policy, the detector and the fullest-reserve-bin-v1 source choice, the replenishment request lifecycle, and what the context deliberately does not do.
---

# Business Context

Written here from the context's own
[introduction](https://iqvo.github.io/pick-face-replenishment/docs/overview/introduction),
its [integration page](https://iqvo.github.io/pick-face-replenishment/docs/ecosystem/integration)
and its ADRs under `docs/adr/` in
[IQVO/pick-face-replenishment](https://github.com/IQVO/pick-face-replenishment)
(0001 to 0005, all Accepted 2026-10-17), checked against the code on
`develop`. Where the code has moved past an ADR's wording, the code is
authoritative.

## The gap

`slotting-optimization` decides which SKU holds which forward pick slot and
`inventory-storage` owns the stock ledger and can relocate stock between bins.
Nothing in the fleet watched whether a forward pick face still held enough of
its SKU, and nothing asked for stock to be moved from a reserve bin when it ran
low. Slotting's own pages listed `REPLENISH` (min/max) work as planned, not
built. Without that, a picker finds an empty face and the problem is solved by
hand.

Replenishment is a stock-level-driven work generator: it reacts to levels,
holds a policy per pick face, and ends when the ledger records the move. That
lifecycle differs from slotting (which plans slots and never watches levels)
and from `fulfillment-execution` (which owns task state and must stay the
single writer of it), so it is a context of its own (ADR 0001).

## What it owns

| Fact | Value |
| --- | --- |
| Subdomain class | **Supporting** (ADR 0001) |
| Tier | **WMS** (CloudEvents subdomain segment `wms`, the sixth `wms` context) |
| Aggregates | `ReplenishmentPolicy` (package `internal/domain/policy`) and `ReplenishmentRequest` (package `internal/domain/replenishment`), ADR 0002 |
| Detector | the pure function `Detect` in `internal/domain/detection`, with the `SourceBinPolicy` port (v1: `fullest-reserve-bin-v1`) |
| Binaries | one: `cmd/api` (REST on `HTTP_ADDR`, default `:8080`, plus up to three Kafka consumers and the outbox relay as goroutines). There is **no** `cmd/mcp` |
| Data store | one Postgres database (embedded migrations), or in-memory adapters when `DATABASE_URL` is unset |
| Kafka | publishes `warehouse.pick-face-replenishment.events` and `warehouse.pick-face-replenishment.analytics`; consumes `warehouse.inventory.events`, `warehouse.slotting-optimization.events` and `warehouse.facility.events` (ADR 0003, ADR 0004) |
| Auth | none (fleet-wide decision) |

- **The policy.** The explicit `MIN_MAX` rule of one (site, SKU): `minQty`,
  `maxQty`, `multiple` and a `version`. Invariants: `0 <= minQty < maxQty`,
  `multiple >= 1`. Declared with `PUT /policies/{siteId}/{sku}` under `If-Match`
  optimistic concurrency and removed with `DELETE`. Declaring publishes the
  analytics-only fact `ReplenishmentPolicyDeclared`.
- **The request.** One decision to move `quantity` units of a SKU from one
  reserve bin to one forward bin: `Requested`, then `Completed` or `Cancelled`
  (both terminal). At most one is open per (site, forward bin, SKU). Its
  priority is `URGENT` when the face had nothing available at detection
  (`on_hand - reserved <= 0`), else `NORMAL`.
- **The detection.** From a pick face, its policy, its open request and the
  candidate reserve bins, one of five verdicts: `NoPolicy`, `AlreadyOpen`,
  `Healthy` (projected level above the minimum), `NoSource` (no reserve bin
  with usable stock, or a quantity below one multiple) and `Raise`.
- **The completion.** Only `inventory-storage`'s `StockRelocated` with reason
  `REPLENISHMENT` and `source_ref` equal to the request id closes a request;
  the quantity actually moved is recorded and can be less than requested.

## The v1 policy

Deterministic and explainable (ADR 0002; see the
[Ubiquitous Language](/contexts/pick-face-replenishment/ubiquitous-language)):

1. **Available** = `on_hand - reserved`. **Projected** = available plus the
   quantity of the face's open request, if any.
2. **Healthy** while projected is above `minQty`. At or below it, the **need**
   is `maxQty - projected`, rounded **down** to a `multiple` so a request never
   overfills the face. A need below one multiple raises nothing.
3. **Source bin** (`fullest-reserve-bin-v1`): among the reserve bins of the
   site other than the forward bin, with usable stock of at least 1, the one
   with the largest usable stock; ties go to the lexically smallest bin code.
   A reserve bin is a `Storage` location in a zone listed in
   `RESERVE_ZONE_CODES` (default `RSV`). A forward assignment whose bin is in
   a known zone outside `FORWARD_ZONE_CODES` (default `FWD`) is not a pick
   face.
4. **Quantity** is capped at the source's usable stock and rounded down again,
   so a partial fill is possible. The next detection raises another request
   once the first closes.

A demand-cover policy (days of cover from `SiteSkuDemandChanged`) is a planned
later version behind the same port. It does not exist today.

## Main capabilities

| Capability | Interface | Use case |
| --- | --- | --- |
| Declare, read, list and remove a min/max policy | `PUT/GET/DELETE /policies/{siteId}/{sku}`, `GET /policies` | see [Use Cases](/contexts/pick-face-replenishment/use-cases) |
| See every pick face with its status (`BELOW_MIN`, `OK`, `NO_SOURCE`, `NO_POLICY`) | `GET /pick-faces` | `ListPickFaces` |
| Raise requests by sweep | `POST /sites/{siteId}/evaluate` | `EvaluateSite` |
| Raise a request by hand | `POST /replenishments` | `RaiseManualRequest` |
| Read requests | `GET /replenishments`, `GET /replenishments/{requestId}` | `GetRequest`, `ListRequests` |
| Cancel a request | `POST /replenishments/{requestId}/cancel` | `CancelRequest` |
| Raise requests as bin levels or the forward map change | Kafka consumers (`INVENTORY_MODE`, `SLOTTING_MODE`, `LAYOUT_MODE` = `kafka`) | `ApplyBinLevel`, `ApplyRelocation`, `ApplyForwardAssignmentMap`, `ApplyZone`, `ApplyLocationRegistered`, `ApplyLocationDecommissioned` |
| Publish requests and their outcome | transactional outbox + relay (needs `DATABASE_URL` and `KAFKA_BROKERS`) | every write use case |

The write endpoints take an `Idempotency-Key` that is enforced with Postgres.
The full catalogue is on [Use Cases](/contexts/pick-face-replenishment/use-cases).

## What it deliberately does not do

- **Own stock levels, slot assignments or locations.** It keeps event-fed local
  copies (`bin_stock_levels`, `forward_assignments`, `zones`, `locations`) and
  never calls a sibling at request time. It makes no outbound HTTP or MCP call
  at all.
- **Create floor work.** It publishes `ReplenishmentRequested`;
  `wes-work-planning` and `fulfillment-execution` own work and task state. A
  request already released as floor work is not recalled by a cancel here.
- **Write the stock ledger.** It requests a move; `inventory-storage` records
  it.
- **Guess.** With no level, no assignment, no reserve location copy or no
  policy, the detector reports `NO_SOURCE` or `NO_POLICY` instead of raising.
- **Schedule.** Nothing re-evaluates a site periodically; requests are raised
  when a bin level or a new forward map is applied, by the sweep, or by hand.
- Out of scope for v1: velocity-derived min/max, multi-SKU faces,
  reserve-to-reserve consolidation, travel-aware source choice.

It has no edge to `inbound-receiving`, `order-management` or `product-master`
(ADR 0001).

## Honest scope today

- The service is built on `IQVO/pick-face-replenishment` `develop`: REST API,
  outbox and relay, the three consumers and the BDD and architecture fitness
  suites. This site holds its `apis/pick-face-replenishment/` specs, the
  generated references and the synced artifact pack and operations pages.
- It is **not deployed in the reference cluster.** `warehouse-infra` `develop`
  has no database, Kong route, ArgoCD application, values file or dashboard
  for it, and the repository has no Dockerfile or Helm chart on `develop`
  (its Runbook says so). It runs only from a locally built binary or image.
  Its declared Kong URL, `http://localhost:8000/api/pick-face-replenishment`,
  therefore routes nowhere yet.
- **The execution chain is not live.** The inputs from `slotting-optimization`
  and `facility-layout` are published by live producers. `inventory-storage`
  does not publish `BinStockLevelChanged` (producer change P1) and its
  `StockRelocated` has no `REPLENISHMENT` reason (P4); `wes-work-planning` has
  no `REPLENISH` work path (P3b) and `fulfillment-execution` no `REPLENISH`
  task (P3). Both consumed contracts were pinned consumer-first (ADR 0003), so
  if the producers ship something different the fix is a follow-up PR in this
  context. Until then a request can be raised and cancelled but not completed,
  and with the bin-level copy empty the pick-face view reports `NO_SOURCE`.
- An analytics read side (`warehouse.pick-face-replenishment.analytics` is
  written, but nothing reads it), a `warehouse-ops-agent` client and a console
  remote are later phases. None of them exists yet.
