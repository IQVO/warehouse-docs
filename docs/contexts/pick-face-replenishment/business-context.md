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
| Binaries | four: `cmd/api` (REST on `HTTP_ADDR`, default `:8080`, plus four Kafka consumers and the outbox relay as goroutines), `cmd/mcp` (read-only MCP server, ADR 0007), `cmd/pfr-projector` and `cmd/pfr-reports` (the analytics read side, ADR 0008) |
| Data store | one Postgres database (embedded migrations). `DATABASE_URL` and `KAFKA_BROKERS` are mandatory (a boot error naming the variable); the in-memory adapters are test doubles only (its ADR 0006) |
| Kafka | publishes `warehouse.pick-face-replenishment.events` and `warehouse.pick-face-replenishment.analytics`; consumes `warehouse.inventory.events`, `warehouse.slotting-optimization.events`, `warehouse.facility.events` and `warehouse.product-master.events` (pack levels, ADR 0009) (ADR 0003, ADR 0004) |
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
| Raise requests as bin levels or the forward map change | Kafka consumers (always on; `INVENTORY_MODE`, `SLOTTING_MODE` and `LAYOUT_MODE` default to `kafka`) | `ApplyBinLevel`, `ApplyRelocation`, `ApplyForwardAssignmentMap`, `ApplyZone`, `ApplyLocationRegistered`, `ApplyLocationDecommissioned` |
| Publish requests and their outcome | transactional outbox + relay (always on; both are mandatory) | every write use case |

The write endpoints require an `Idempotency-Key` in every deployment (enforced with Postgres).
The full catalogue is on [Use Cases](/contexts/pick-face-replenishment/use-cases).

## What it deliberately does not do

- **Own stock levels, slot assignments or locations.** It keeps event-fed local
  copies (`bin_stock_levels`, `forward_assignments`, `zones`, `locations`) and
  never calls a sibling at request time. It makes no outbound HTTP or MCP call
  at all.
- **Create floor work.** It publishes `ReplenishmentRequested`;
  `wes-work-planning` and `fulfillment-execution` own work and task state. A
  cancel withdraws the planned unit only while `wes-work-planning` still holds it
  Pending (its ADR 0042); a request already released as floor work is not
  recalled.
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
  outbox and relay, the four consumers, the read-only MCP server, the analytics
  projector and reports, the console remote and the BDD and architecture
  fitness suites. This site holds its `apis/pick-face-replenishment/` specs, the
  generated references and the synced artifact pack and operations pages.
- It is **wired in `warehouse-infra` `develop`**: `terraform/apps.yaml`
  registers it (database, analytics database, web remote `replenishment_mfe`)
  and `helm-values/pick-face-replenishment.yaml` sets every consumer group. Its
  Kong URL is `http://localhost:8000/api/pick-face-replenishment`. The kind
  cluster was not checked for this page.
- **The execution chain is complete on `develop` and wired.** The inputs
  from `slotting-optimization`, `facility-layout`, `inventory-storage` and
  `product-master` are published by producers on `develop` (`inventory-storage`
  publishes `BinStockLevelChanged` and records a completed `REPLENISH` task as a
  `StockRelocated` with reason `REPLENISHMENT`, its ADR 0040 and ADR 0041).
  The output side exists as well: `wes-work-planning` consumes
  `ReplenishmentRequested` and `ReplenishmentCancelled` and plans one
  `REPLENISH` work unit per request (its ADR 0042), `process-path-management`
  declares the `REPLENISH` path (its ADR 0036) and `fulfillment-execution` runs
  `REPLENISH` tasks (its ADR 0050). Both consumed contracts were pinned
  consumer-first (ADR 0003) and the producers now match them (field names
  equal, key `<bin>:<sku>`). `warehouse-infra` sets `REPLENISHMENT_MODE=kafka`
  for the planner. The `REPLENISH` path exists on a cluster only after the
  catalogue seed (an operator step), and no request has been traced through
  every hop on a cluster.
- The analytics topic is read only by this context's own projector. A
  demand-cover policy behind the `MIN_MAX` port is a later phase.
