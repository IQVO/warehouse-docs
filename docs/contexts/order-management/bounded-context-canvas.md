---
id: bounded-context-canvas
title: Bounded Context Canvas
sidebar_label: Bounded Context Canvas
slug: /contexts/order-management/bounded-context-canvas
description: The full ddd-crew Bounded Context Canvas for order-management — purpose, strategic classification, domain roles, communication, business decisions, assumptions, verification metrics, open questions.
---

# Bounded Context Canvas

The full [ddd-crew Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas)
for `order-management`, filled in from this repo's own `CLAUDE.md`,
ADRs, and docs.

## Name

**Order Management**

## Purpose (business language, no tech)

Give the platform an owner for "an order." Accept what a customer asked
for, decide — line by line — whether the warehouse currently has the
stock to promise it, tell the customer when to expect it, hand the work
to the warehouse floor once it is safe to do so, and let the customer
change their mind up until the point that is no longer possible without
undoing physical work already underway. Before this context existed,
nothing in the platform could answer "what is the state of order X"
without joining three unrelated services by an unvalidated string.

## Strategic Classification

**Domain:** Generic, leaning Supporting. `CLAUDE.md`'s own title states it
directly: *"Order Management (Generic/Supporting Bounded Context — order
intake, allocation, release)."* The reference model
(`amazon-fulfillment-ddd.md`) places the matching capability, **Order
Management / ERP interface**, in the **Generic** bucket — "upstream order
intake; commodity integration surface." Order intake itself — accepting a
well-formed request and validating it — genuinely is a commodity concern.
But this context carries more than intake: BR2 (fail-closed allocation),
BR3 (ship-complete default), and BR6 (the cancellation boundary) are real
business rules with real invariants, enforced in the domain and
unit-tested per failing path, earning it the "Supporting" half of the
label rather than being treated as a thin CRUD proxy.

**Business Model:** Compliance enforcer, in the specific sense that its
job is to make sure the *rules of engagement* between the customer's
intent and the warehouse's physical commitments are never violated — a
line is never allocated twice, a ship-complete order never leaks partial
work, a cancellation either fully reverts or changes nothing. It does not
generate revenue directly and it is not a customer engagement surface; it
is the trust boundary that makes every downstream promise (a promise
date, a released work unit) honest.

**Evolution:** Custom-built. Order intake as a raw capability is a
commodity (any WMS/ERP interface does it), but this context's specific
orchestration of allocation-then-release-then-cancellation against two
Suppliers, with fail-closed semantics and a derived, unbypassable status,
is bespoke to this platform's shape — not a bought or off-the-shelf
product, and not yet a stable, boring "utility" the way `facility-layout`
(Generic, fully extracted) has become. It is closer to genesis-to-custom
than product: the rules were only recently discovered and written down
(ADR-0003, ADR-0004), and ADR-0005 shows the design still actively
evolving in response to review feedback.

## Domain Roles

**Execution context.** This is the only bounded context with visibility
into an order's full line composition before release (per ADR-0008), and
it is the one that actually drives the allocate → release → (cancel)
lifecycle forward by calling out to `inventory-storage` and
`wes-work-planning`. It is not a pure analysis/read context — every use
case it exposes (`ReceiveOrder`, `RetryAllocation`, `ReleaseHeldOrder`,
`CancelOrder`, and the Kafka-driven `RepromiseOrder`) executes a real state
transition, not just a query. (`GetOrder` is the one read-only exception.)

## Inbound Communication

| Collaborator | Message(s) | Relationship pattern |
| --- | --- | --- |
| caller (external — any client of the public API) | `ReceiveOrder` command (`POST /orders`) | Open Host Service — this context publishes a stable REST contract (`apis/openapi.yaml`) any caller can consume |
| caller (external) | `RetryAllocation` command (`POST /orders/{id}/retry-allocation`) | Open Host Service |
| caller (external) | `CancelOrder` command (`DELETE /orders/{id}`) | Open Host Service |
| caller (external) | `GetOrder` query (`GET /orders/{id}`) | Open Host Service |
| caller (external) | `ReleaseHeldOrder` command (`POST /orders/{id}/release`) — releases an order received with `releaseOnAllocation=false`; `409 order-not-held` otherwise | Open Host Service ([ADR-0020](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0020-network-originated-demand-hold-and-deadline-feasibility.md)) |
| `network-fulfillment` | `POST /orders` (held: `releaseOnAllocation=false`, `requiredShipBy` = the network's deadline), then `POST /orders/{id}/release` to commit or `DELETE /orders/{id}` to reject | Customer of this context's Open Host Service. `network-fulfillment` is the Anti-Corruption Layer to an external retail fulfillment network; its vocabulary (PO, ASIN, acknowledgement) and customer PII stay on its side ([ADR-0020](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0020-network-originated-demand-hold-and-deadline-feasibility.md)) |
| `process-path-management` | `ProcessPathCreated`/`ProcessPathUpdated`/`ProcessPathDeactivated` and `CPTScheduleChanged` on `warehouse.process-path-management.events` | Conformist — local-cache consumers (`kafkacatalog`, `kafkacptschedule`) feeding path validation and the capability-derived promise ([ADR-0013](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0013-process-path-selection-as-a-domain-policy.md), [ADR-0014](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0014-promise-derived-from-fulfillment-capability.md)). Enabled only by `PATH_CATALOGUE_SOURCE=kafka` (default `none`, in which case the promise falls back to `LeadTimePolicy`) |
| `wes-work-planning` | `PathCapacityChanged` on `warehouse.work-planning.events` | Conformist — local-cache consumer (`kafkapathcapacity`) for remaining path capacity per cutoff ([ADR-0015](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0015-wes-work-planning-path-capacity-changed-wired.md)); same `PATH_CATALOGUE_SOURCE=kafka` gate |
| `fulfillment-execution` | `TaskCPTMissed`, `PackageManifested` on `warehouse.fulfillment.events` | Conformist — `RepromiseConsumer` (stable group `order-management-repromise`, runs whenever `KAFKA_BROKERS` is set) drives `RepromiseOrder`, which may raise `OrderRepromised` ([ADR-0018](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0018-repromise-order-consumer-and-order-repromised.md)) |
| AI agents (MCP clients) | `get_order`, `get_promise_health` tools on `cmd/mcp` | Open Host Service — read-only MCP inbound adapter ([ADR-0010](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0010-mcp-inbound-adapter.md); `get_promise_health` since [ADR-0019](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0019-promise-kpis-on-order-funnel.md)); no write tool |
| `warehouse-ops-agent` console-bff | `GET /orders/{id}` — first hop of the cross-cutting Order Lifecycle fan-out | Conformist (read-only fan-out) — per ADR-0007, no new endpoint was needed; the BFF is simply another Customer of the existing contract |
| `order-mgmt-mfe` (this repo's own `web/` Module Federation remote) | This service's full REST API | Conformist — a plain browser client of this service's own contract, per ADR-0007. **Live**: the remote is real (`web/`, Vite + React, port 5181), scaffolded in PR #48 — a place-order form, a lookup-by-id panel, and a cancel button, using 3 of this service's REST endpoints (there is no list/search endpoint to build a list screen against; retry-allocation and hold/release are not wired into the UI). Not a speculative intent; `npm run build` produces a real, non-empty `remoteEntry.js` the `warehouse-console` shell's federation config resolves. |

## Outbound Communication

| Collaborator | Message(s) | Relationship pattern |
| --- | --- | --- |
| `inventory-storage` | `POST /reservations`, `DELETE /reservations/{id}` | Customer/Supplier — this context is the Customer, `inventory-storage` is the Supplier/Open Host Service. Synchronous HTTP, unchanged since ADR-0002 (`INVENTORY_STORAGE_MODE`, default `permissive`, which deliberately fails allocation with `ErrDownstreamNotConfigured` rather than faking success). |
| `inventory-storage` | `GET /products/{sku}/classification` | Customer/Supplier — separate fail-open adapter feeding eligibility-driven path selection ([ADR-0016](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0016-eligibility-driven-process-path-selection.md)); opt-in via `PRODUCT_CLASSIFICATION_MODE=http` (default `permissive`); a miss drops a routing hint, never rejects intake |
| `wes-work-planning` | (was) `POST /paths/{pathId}/work-units`; superseded by publishing `OrderAllocated`/`OrderPartiallyAllocated` on `warehouse.order-management.events` | Was Customer/Supplier (synchronous HTTP, ADR-0002); now Open Host Service + Published Language via Kafka choreography (ADR-0005) — `wes-work-planning`'s own consumer reacts to the fact "these lines were released" instead of being called directly |
| any subscriber | `OrderRepromised` on `warehouse.order-management.events` (`EVENT_PUBLISHER=kafka`) | Open Host Service + Published Language ([ADR-0018](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0018-repromise-order-consumer-and-order-repromised.md)) — the fleet's "your delivery is delayed" signal. No sibling context consumes it yet. |
| this context's own `cmd/order-projector` | all ten domain events on `warehouse.order-management.analytics` | Internal analytics fan-out for the Order Funnel data product ([ADR-0006](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0006-analytical-data-product.md), promise KPIs per [ADR-0019](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0019-promise-kpis-on-order-funnel.md)) — not a cross-context contract |

## Ubiquitous Language

Order, OrderLine, Status, Allocation, Release, Promise, Hold, Backordered,
FulfillmentClass — see the dedicated
[Ubiquitous Language](/contexts/order-management/ubiquitous-language) page for full definitions
and code references.

## Business Decisions

- **BR2 — fail-closed allocation.** Only a `409` from `inventory-storage`'s
  `POST /reservations` is a backorder (a business fact). Any other error —
  timeout, 5xx, transport failure — is not a fact about stock; it fails the
  whole allocation call rather than silently marking a line backordered.
- **BR3 — ship-complete is the default.** `allowPartialShipment` defaults
  to `false`. With it false, any `Backordered` line puts the WHOLE order
  in `Backordered` and no line proceeds to release until `RetryAllocation`
  clears it. With it `true`, allocated lines are independently eligible for
  release and the order reads `PartiallyAllocated`.
- **The order-level status is derived, never stored.** `Order.Status()` is
  computed from line statuses on every read; there is no `status` column
  and no field on the aggregate that could drift out of sync.
- **BR6 — the cancellation boundary is release.** `CancelOrder` is legal
  ONLY while no line has reached `Released`. The check happens before any
  reservation is revoked, so a rejected cancellation leaves
  `inventory-storage` completely untouched. A legal cancellation revokes
  every allocated line's reservation, then cancels every line.
- **A failed revoke fails the whole cancellation.** The order is not
  marked cancelled and the reservation ids are still recorded, so retrying
  is safe and converges.
- **A `404` from `DELETE /reservations/{id}` counts as success**, since
  the desired end state (that reservation no longer holding stock) is true
  either way.

## Assumptions

- **No live carrier integration for the promise.** Since ADR-0014 the
  promise is a CPT window derived from fulfillment capability
  (process-path cycle time, eligibility, site CPT schedule,
  wes-work-planning path capacity) — i.e. the instant the order leaves the
  building, not a delivery date from a carrier-rate or transit-time lookup.
  When the capability caches are cold or `PATH_CATALOGUE_SOURCE=none`, it
  falls back to the configurable per-path lead time (`PromiseBasis=LeadTime`).
  A deadline-constrained order (`requiredShipBy`, ADR-0020) never falls back:
  an infeasible deadline returns no `promiseDate` at all.
- **An order's path, for analytics enrichment, is its first line's path**
  — exact only because intake places every line of an order on the same
  default path today (ADR-0006).
- **`PathId` is always the internal default (`pick`)** — never
  caller-supplied since ADR-0005; a caller has no visibility into or
  control over process-path routing. Since ADR-0013/0016 that default is
  validated against the live catalogue and its declared eligibility, but
  it is still the only path the policy can select (the catalogue port has
  no "list active paths" method).
- **No cross-service transaction exists.** `allocateAndRelease` can
  succeed on line 1 and hard-fail on line 2; the use case explicitly
  persists whatever genuinely succeeded before returning the error, so
  nothing is stranded upstream and a retry resumes.
- **Fire-and-forget release, deliberately.** v1 has no release-confirmation
  reply event from `wes-work-planning`; this context never learns whether
  the consumer actually processed the Kafka event.

## Verification Metrics

*(Suggested — not sourced from the docs, proposed given what this context
measures and does.)*

- **Allocation success rate**: share of `AllocateOrder`/`RetryAllocation`
  passes that complete without a hard (non-409) failure. A drop signals a
  Supplier integration problem, not a stock problem — distinguishable
  because of BR2.
- **Backorder rate**: share of lines landing in `Backordered` out of all
  lines allocated in a window — a genuine stock-availability signal once
  BR2 guarantees it isn't polluted by transport noise. The existing [Order
  Funnel & Allocation Health report](https://github.com/claudioed/order-management/blob/develop/docs/docs/analytics/order-funnel-report.md)
  already tracks the raw counts this metric would be computed from.
- **Ship-complete stall time**: for orders with `allowPartialShipment=false`,
  the time an order spends `Backordered` before a `RetryAllocation` clears
  it (or it is cancelled) — a proxy for how much unfulfilled customer
  promise sits blocked behind BR3.

## Open Questions

- **No Kafka consumer confirms release landed.** v1 ships
  fire-and-forget: `OrderAllocated`/`OrderPartiallyAllocated` are
  published and this context moves on with no reply event from
  `wes-work-planning`. A confirmation-loop pattern is a real, documented
  v1 gap, not an oversight (ADR-0005).
- **Released work is not clawed back on cancellation.** Once any line is
  `Released`, this context has no compensating command to call on
  `wes-work-planning`'s published contract, and inventing one would mean
  changing that service — ruled out by ADR-0002. Closing this would need a
  cancellation/withdrawal operation on `wes-work-planning`, a compensating
  stow flow on `inventory-storage` for already-picked goods, and a new
  `Cancelling` order state to model the asynchronous, partially-failable
  nature of that flow (ADR-0004).
- **A partially released order cannot be cancelled at all** — not even its
  still-allocated lines. That is the strict reading of BR6; the first
  thing to revisit if the business asks for finer-grained cancellation
  (ADR-0004).
- **Nothing sweeps an orphaned hold.** An order held with
  `releaseOnAllocation=false` that its caller never releases or cancels
  keeps real inventory reservations until someone does (ADR-0020).
- **`FulfillmentClass` is currently unconsumed.** No downstream context
  reads the `fulfillment_class` field yet — its value is propagated
  correctly on the wire, but its usefulness depends on a future
  `wes-work-planning` decision this repo deliberately does not make
  (ADR-0008).
- **Two independently-maintained copies of the `WorkUnitID` formula.**
  `{orderID}-line-{lineNo}` must match byte-for-byte between this
  context and `wes-work-planning`'s consumer, with zero wire-level
  enforcement — only manual review and cross-repo test discipline catch a
  drift (ADR-0005).
