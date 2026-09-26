---
id: bounded-context-canvas
title: Bounded Context Canvas
sidebar_label: Bounded Context Canvas
description: The full ddd-crew Bounded Context Canvas for wes-work-planning — purpose, strategic classification, domain roles, inbound/outbound communication, business decisions, assumptions, verification metrics, open questions.
---

# Bounded Context Canvas

Following the [ddd-crew Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas)
template.

## Name

**Work Planning & Release** (`wes-work-planning`) — internally and in
conversation, simply **"the conductor."**

## Purpose

> Turn a shift's charge into a committed plan, then admit work onto the
> floor continuously in deadline order, correcting the flow from live
> buffer telemetry — so that every parcel makes its truck without the floor
> ever being starved or flooded.

This is the WES tier's core: the real-time orchestration layer that
reconciles what work exists (from Order Management / Inventory), what
capacity exists (from Workforce / installed stations), and how work should
flow right now — re-planned continuously rather than computed once.

## Strategic Classification

| Dimension | Classification | Justification |
|---|---|---|
| **Domain** | **Core** | The platform builds its own WES rather than integrating a vendor product behind an anti-corruption layer. The release policy, the WIP-limit invariant, the Drum-Buffer-Rope rebalance rule, and the CPT priority function are all written, owned, and unit-tested in this repository — precisely the conditional the platform's strategic reference draws between "Core if you build/tune your own DC" and "Supporting/Generic if you consume a vendor WES at arm's length." |
| **Business Model** | **Differentiator** | Continuous re-planning to the fastest/cheapest path — rather than a static, once-computed schedule — is the platform's central competitive edge, per the reference model's analysis of what actually distinguishes large fulfilment operations. |
| **Evolution** | **Product** (heading toward Commodity only at the edges) | The core release/rebalance logic is custom and actively evolving (ADR-0002, ADR-0003 record deliberate departures from off-the-shelf wave-based WES patterns). Supporting mechanics — the Kafka envelope, RFC 7807 error model, hexagonal layering — are Commodity: copied conventions shared by every sibling context, not differentiators in themselves. |

## Domain Roles

| Role | Manifestation here |
|---|---|
| **Policy** | `release.ReleasePolicy` — the admission decision, deliberately named as a separate, replaceable domain-service object rather than a method on `WorkPool` or a `SORT BY` clause. |
| **Analyzer / decision** | `RebalanceDecision` — a synchronous domain service evaluated on read over a pool snapshot; recommends `ThrottleUpstream`, `ReassignLabor`, or `NoActionNeeded`. Analogous to the reference model's `AssignmentOptimizer` role: cross-aggregate judgement, not a method any one aggregate could compute about itself. |
| **Standard aggregate** | `ChargeForecast`, `ShiftPlan`/`PathPlan`, `WorkPool`, `WorkUnit` — each protects one invariant surface with a validating constructor and typed error sentinels. |
| **Gateway / read-only projection** | `LaborPlanObserved` and `UsableInventoryObserved` — plain values with exported fields and no constructor, deliberately, because the facts they hold are owned by another bounded context and this service is not entitled to reject them. |

## Inbound Communication

| From | Relationship pattern | What arrives | Effect here |
|---|---|---|---|
| `inventory-storage` | Customer/Supplier + OHS/Published Language, with an **ACL on our side** | `StockReserved`, `ReservationRevoked` on `warehouse.inventory.events` | Projected into `UsableInventoryObserved`, keyed by SKU. Also a synchronous, once-at-release-time HTTP read of `GET /products/{sku}/classification` for `ProductClassificationView` (not part of this table's event flow — see [Async API](./async-api)). |
| `workforce-management` | Customer/Supplier, with an **ACL on our side** | `ShiftPlanCommitted` on `warehouse.workforce.events` (one message per path line) | Projected into `LaborPlanObserved`, keyed by `path_id`. **Never** fed into this service's own `ShiftPlan`/`PathPlan` aggregate — same word, different bounded context. |
| `order-management` | Customer/Supplier, choreographed and **fire-and-forget** | `OrderAllocated`, `OrderPartiallyAllocated` on `warehouse.order-management.events` | For each line, calls the existing `EnqueueWorkUnit` use case with a deterministic `work_unit_id` (`"{order_id}-line-{line_no}"`). No reply event — order-management learns of downstream progress only via this service's own published events, if it chooses to subscribe. |
| `fulfillment-execution` (feedback edge) | Customer/Supplier, **roles reversed** from the outbound edge below | `TaskCompleted` on `warehouse.fulfillment.events` | Calls the existing `RecordCompletion` use case — the same code path `POST /work-units/{id}/complete` uses. Closes the control loop: WIP drops, the next release can proceed. |
| `process-path-management` | **Conformist** to its OHS/Published Language | `ProcessPathCreated` / `ProcessPathUpdated` / `ProcessPathDeactivated` on `warehouse.process-path-management.events` — **only when `PATH_CATALOGUE_SOURCE=kafka`** (default `file` reads the same catalogue from YAML) | Replayed from the beginning, under its own per-process consumer group, into the in-memory catalogue that validates every `pathId` ([ADR-0012](https://github.com/claudioed/wes-work-planning/blob/develop/docs/docs/adr/0012-process-path-catalogue-validation.md)). A state rebuild, not an effect — no `processed_events` row. |
| API callers (`warehouse-ops-agent`, `warehouse-console`) | Open-Host Service (REST + MCP) | REST calls (e.g. `GET /work-units?reference=`, the reports API) and MCP tool calls; the console shell mounts this repo's `web/` micro-frontend | Every REST and MCP route is **unauthenticated by deliberate decision** — the static-bearer layer was removed ([ADR-0016](https://github.com/claudioed/wes-work-planning/blob/develop/docs/docs/adr/0016-remove-rest-mcp-static-bearer-auth.md)); network-level isolation is the only access control. |

The inbound Kafka adapter (`internal/adapters/inbound/kafka/consumer.go`) is
the concrete, locatable home of the ACL for the four integration topics: unexported structs
(`inventoryEventData`, `shiftPlanCommittedData`, `taskCompletedData`,
`orderAllocatedData`) hold the foreign shape and never cross into the
application layer.

## Outbound Communication

| To | Relationship pattern | What is sent | Consumer effect |
|---|---|---|---|
| `fulfillment-execution` | Customer/Supplier, **we are the supplier**; Open-Host Service + Published Language | `WorkReleased` on `warehouse.work-planning.events`, enriched at the adapter with `cpt` and `ref` (and optionally `required_capabilities`, `fragile`, `gift_wrap`) | Builds its own `Task` — a different model with a different lifecycle (leases, claims, stations). The enrichment makes the contract self-sufficient: no callback into this service is required. |
| `order-management` (capacity edge) | Customer/Supplier, **we are the supplier**; OHS + Published Language | `PathCapacityChanged` on `warehouse.work-planning.events` — `path_id`, `cutoff_at`, `remaining_units`, `known`; raised only when `GET /paths/{pathId}/telemetry` is called with `cutoffAt` ([ADR-0018](https://github.com/claudioed/wes-work-planning/blob/develop/docs/docs/adr/0018-path-capacity-changed.md)) | Its `kafkapathcapacity` adapter caches remaining capacity per (path, cutoff) behind its `PathCapacity` port, correlating `cutoff_at` against its own CPT windows. |
| `facility-layout` (synchronous query) | **Conformist** to its OHS | `GET /distance?from=&to=`, once, when `CommitShiftPlan` is given both `fromLocationCode` and `toLocationCode` ([ADR-0017](https://github.com/claudioed/wes-work-planning/blob/develop/docs/docs/adr/0017-travel-distance-lookup-on-commit-shift-plan.md)) | Stamps an optional `travelDistanceM`/`travelDistanceEstimated` hint onto the `PathPlan`. Opt-in via `TRAVEL_DISTANCE_MODE=http` (default `permissive` — no call) and fail-open: a lookup failure never blocks the commit. |
| `inventory-storage` (synchronous query) | Customer/Supplier, we conform to its OHS | `GET /products/{sku}/classification`, once per release ([ADR-0009](https://github.com/claudioed/wes-work-planning/blob/develop/docs/docs/adr/0009-product-classification-propagation-to-work-released.md)) | Supplies the optional `required_capabilities`/`fragile` hints on `WorkReleased`. Opt-in via `PRODUCT_CLASSIFICATION_MODE=http` (default `permissive`) and fail-open. |

`fulfillment-execution` is downstream of us for release and **upstream of
us** for completion (the inbound feedback edge above) — two directed
Customer/Supplier relationships between the same pair of contexts, not one
bidirectional relationship, because the two edges carry different
contracts, different payloads, and different failure modes.

The other eight domain events are also written to
`warehouse.work-planning.events` with a `{"path_id": ...}`-shaped payload,
but nothing in the platform consumes them today — published for
observability and future subscribers. See
[Domain Events](/contexts/wes-work-planning/domain-events).

## Ubiquitous Language

Charge, CPT, Process Path, Work Pool, WorkUnit, ShiftPlan/PathPlan, Release,
Flow balancing — plus the feed-mode distinction (release-fed vs flow-fed)
and five explicit traps where this context's vocabulary collides with a
sibling's. Full glossary: [Ubiquitous Language](./ubiquitous-language).

## Business Decisions

- **Waveless, continuous release.** Work is admitted one unit at a time, in
  earliest-CPT order, on demand — never batched into waves. Priority is
  re-evaluated at every release call; there is no schedule, batch window,
  or wave identifier anywhere in the service. See
  [ADR-0002](https://github.com/claudioed/wes-work-planning/blob/develop/docs/docs/adr/0002-waveless-continuous-release.md).
- **CPT-driven priority, and nothing else.** No age factor, no weighting,
  no secondary sort key. CPT is the deadline that physically exists; any
  other key would be a proxy for it.
- **Flow balancing as a two-lever policy, not a scheduled sweep.**
  Evaluated synchronously on read over a pool snapshot: a flow-fed pool
  over its alarm threshold recommends `ThrottleUpstream`; a release-fed
  pool at its WIP limit with backlog remaining recommends `ReassignLabor`;
  otherwise `NoActionNeeded` is itself a real answer. See
  [ADR-0003](https://github.com/claudioed/wes-work-planning/blob/develop/docs/docs/adr/0003-flow-balancing-as-domain-service.md).
- **The WIP limit is enforceable only on release-fed pools.** On a
  flow-fed pool the same number is merely an alarm threshold, because you
  cannot refuse a tote a conveyor has already delivered — the invariant
  boundary follows the physical control boundary exactly.
- **`plannedHeads ≤ installedStations` is enforced at construction**, not
  validated after the fact — an invalid `PathPlan` cannot exist even
  transiently.
- **Recommendations are advice, never actions.** `RebalanceDecision` never
  moves headcount and never stops the release policy — both would be
  automatic control-loop actions taken from a single telemetry sample,
  which is how oscillation starts.

## Assumptions

- The platform runs one shared Kafka broker across every publishing
  service in the fleet; this repository does not run its own.
- `KAFKA_BROKERS` being set starts the inbound consumer independently of
  `EVENT_PUBLISHER` — a service can observe the platform without emitting
  to it.
- `EVENT_PUBLISHER=log` (the default) means published domain events reach a
  log, not Kafka, in most environments; the ✅ marks in the
  [domain events catalogue](./domain-events) mean "a payload mapping and a
  publishing call exist," not "this is flowing in your environment right
  now." With `EVENT_PUBLISHER=kafka` **and** `DATABASE_URL` set, events
  are written to an `outbox_events` table in the same transaction as the
  aggregate and relayed to both Kafka topics by an in-process relay
  ([ADR-0014](https://github.com/claudioed/wes-work-planning/blob/develop/docs/docs/adr/0014-transactional-outbox.md));
  without `DATABASE_URL` they are published directly.
- Product classification lookups (`ProductClassificationLookup`) are
  fail-open by design: a lookup failure omits the optional enrichment
  rather than blocking or delaying release. This is a deliberate asymmetry
  with `inventory-storage`'s own fail-closed `StowStock` placement check.
  Travel-distance lookups (`TravelDistanceLookup`, ADR-0017) follow the
  same rule: missing location codes, an unknown or cross-zone pair, or
  facility-layout being down all degrade to "no hint", never a failed
  `CommitShiftPlan`. Both lookups default to `permissive` (no network call);
  the deployed cluster sets them to `http`.
- `order-management`'s fire-and-forget enqueue integration assumes
  duplicate-safe enqueue via a deterministic `work_unit_id`
  (`"{order_id}-line-{line_no}"`) as a second line of defense on top of
  `event_id` idempotency.

## Verification Metrics

- **Failing-path coverage.** Every named invariant (see
  [Aggregate Design Canvas](./aggregate-design-canvas)) has a corresponding
  failing-path unit test; this is treated as a completion criterion, not an
  aspiration.
- **Mutation testing on domain packages**, because a Core domain's tests
  should be shown to actually kill defects, not merely execute lines
  (`make mutation` runs the blocking subset CI enforces on
  `internal/domain/release`).
- **Architecture fitness tests** (`internal/architecture/architecture_test.go`,
  [ADR-0007](https://github.com/claudioed/wes-work-planning/blob/develop/docs/docs/adr/0007-arch-go-fitness-tests.md))
  fail the build if the hexagonal dependency rule is violated — six
  assertions, plus an MCP-adapter dependency rule (ADR-0008) in
  `internal/architecture/fitness_test.go`, run as a blocking CI job.
- **Idempotency under redelivery**, unit-tested per consumed event type:
  replaying `StockReserved`/`ReservationRevoked` does not double-adjust
  `UsableInventoryObserved`; replaying `ShiftPlanCommitted` does not
  re-write `LaborPlanObserved`; replaying `TaskCompleted` does not call
  `RecordCompletion` twice.
- **Release Throughput & Backlog Health** analytical report (per path ×
  hour: `workReleased`, `workUnitCompleted`, `backlogThresholdBreached`,
  `pathThrottled`, `rateDeviationDetected`) — an operational verification
  surface built from this service's own domain events, with a documented
  freshness SLA (p95 event-to-report lag < 30s).

## Open Questions

- **The travel-distance hint is thin by design.** Since ADR-0017,
  `CommitShiftPlan` reads facility-layout's `GET /distance` — but only for
  two **caller-supplied** location codes (nothing derives them from the
  process-path catalogue yet), only once at commit time (a later layout
  change is not retroactively applied), and release is still not
  travel-aware: travel time, congestion and route choice remain unmodelled
  here. No facility-layout Kafka topic is consumed.
- **`PathCapacityChanged` is a snapshot, driven from outside.** It is
  published only when someone calls `GET /paths/{pathId}/telemetry` with
  `cutoffAt` — there is no scheduler — and `known` is always `false` for a
  flow-fed path. Correlation with order-management's CPT windows is by
  timestamp, not by `cptId`, an accepted v1 imprecision
  ([ADR-0018](https://github.com/claudioed/wes-work-planning/blob/develop/docs/docs/adr/0018-path-capacity-changed.md)).
- **`RateDeviationDetected` is declared but never raised.** It exists in
  the domain event catalogue and in `apis/asyncapi.yaml`, but computing
  rate deviation needs a time-windowed actual-rate projection that is not
  built. Documented rather than quietly dropped.
- **Nothing detects drift unless someone asks.** `RebalanceDecision` has no
  staleness because it has no schedule — but that also means a path can sit
  over its alarm threshold indefinitely with no recommendation computed
  until a poller, dashboard, or operator calls
  `GET /paths/{pathId}/rebalance`. Continuous monitoring is a gap this
  context accepts knowingly rather than embed a scheduler in the core
  domain.
- **The running wire format still lags the published contract.**
  `apis/asyncapi.yaml` documents a CloudEvents 1.0 structured-mode
  envelope; the running adapters still write the platform's earlier,
  simpler `{event_id, event_type, occurred_at, source, data}` shape, and
  sibling consumers expect that simpler shape today. See
  [Async API](./async-api).
- **`order-management`'s fire-and-forget enqueue has no reply event.**
  order-management does not learn from Kafka whether or when its lines
  were enqueued — a confirmed v1 design choice made when rejecting its
  former synchronous coupling, not an oversight, but still an open
  question for anyone building an SLA on top of it.
