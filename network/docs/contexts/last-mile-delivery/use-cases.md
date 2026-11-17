---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: One proposed application use case per Last-Mile Delivery command, with trigger, inbound adapter, flow, errors mapped to HTTP problems, events and idempotency.
---

# Use Cases

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One application service per command of the model's aggregates, in
`internal/application/usecases`. Each one loads at most one aggregate,
changes it, and saves it with its events in **one transaction**. The events
go into `outbox_events` in that transaction, and a relay publishes them
(model `integration_rules`). The step-by-step diagrams are on
[Sequence Diagrams](/network/contexts/last-mile-delivery/sequence-diagrams); the
contract is `apis/last-mile-delivery/openapi.yaml`.

Reads are not use cases: `GET /waves?stationNodeId=&serviceDate=` reads the
wave table directly.

## Triggers at a glance

| Use case | Aggregate | Trigger | Inbound adapter |
| --- | --- | --- | --- |
| `ScheduleWave` | `DeliveryWave` | Station planner | REST `POST /waves` |
| `InductPackage` | `DeliveryWave` | policies `InductOnArrival`, `RetryNextWave` | Kafka consumer of `LoadArrived`; internal handler of own `DeliveryAttempted` |
| `CloseInduction` | `DeliveryWave` | Station planner | REST `POST /waves/{waveId}/induction-closures` |
| `DispatchWave` | `DeliveryWave` | Station planner | REST `POST /waves/{waveId}/dispatches` |
| `CompleteWave` | `DeliveryWave` | policy: the last route of the wave completes, or a dispatch with no route (ADR 0002 A9) | none (internal, same transaction) |
| `CancelWave` | `DeliveryWave` | Station planner | REST `POST /waves/{waveId}/cancellations` |
| `DeclareCost` | `DeliveryWave` | Station planner | REST `POST /waves/{waveId}/cost-declarations` |
| `DeclareEmission` | `DeliveryWave` | Station planner | REST `POST /waves/{waveId}/emission-declarations` |
| `PlanRoute` | `Route` | Station planner | REST `POST /routes` |
| `StartRoute` | `Route` | DSP driver app | REST `POST /routes/{routeId}/starts` |
| `RecordAttempt` | `Route` | DSP driver app | REST `POST /routes/{routeId}/attempts` |
| `CompleteRoute` | `Route` | policy `CompleteRouteOnLastAttempt`: the attempt that records the last outstanding package (ADR 0002 A16) | none (internal, same unit of work) |
| `ContractPartner` | `DeliveryServicePartner` | caller not named in the model | REST `POST /partners` |

## Error mapping

Every error is returned as `application/problem+json` (RFC 9457) with a
`type` slug. Domain errors come from the model's invariants. The shared
slugs `not-found`, `illegal-transition`, `concurrent-update` and
`validation-failed` are the same in every retail-network service; the other
slugs are one per `Err...` name (kebab-case, no `Err`). Source: last-mile-delivery
ADR 0002 (invariants table) and `internal/adapters/inbound/http/errors.go`.

| Error | HTTP | Problem `type` | Kind |
| --- | --- | --- | --- |
| `ErrInvalidWaveTimes` | 422 | `invalid-wave-times` | validation |
| `ErrWaveFull` | 409 | `wave-full` | capacity |
| `ErrInductionClosed` | 409 | `induction-closed` | closed |
| `ErrRouteOverCapacity` | 409 | `route-over-capacity` | capacity |
| `ErrRouteNotStarted` | 409 | `route-not-started` | state |
| `ErrAlreadyDelivered` | 409 | `already-delivered` | conflict |
| `ErrInvalidVanCapacity` | 422 | `invalid-van-capacity` | validation |
| `ErrUnknownStation` | 422 | `unknown-station` | validation |
| `ErrPackageNotOnRoute` | 404 | `package-not-on-route` | not found |
| `ErrAttemptAlreadyRecorded` | 409 | `attempt-already-recorded` | conflict |
| `ErrPackageNotInducted` | 409 | `package-not-inducted` | state |
| `ErrPackageAlreadyRouted` | 409 | `package-already-routed` | conflict |
| `ErrStopKeyMismatch` | 409 | `stop-key-mismatch` | validation |
| `ErrPartnerInactive` | 409 | `partner-inactive` | state |
| `ErrPartnerStationMismatch` | 409 | `partner-station-mismatch` | conflict |
| `ErrRouteIncomplete` | 409 | `route-incomplete` | state |
| `ErrNotFound` | 404 | `not-found` | not found |
| `ErrIllegalTransition` | 409 | `illegal-transition` | state |
| `ErrConcurrentUpdate` | 409 | `concurrent-update` | stale |
| `ErrValidation` | 422 | `validation-failed` | validation (malformed body, a value-object rule, an unknown field) |

### Idempotency of every POST

Governed by last-mile-delivery ADR 0010 (it supersedes the per-route key and
the 422 on reuse of ADR 0002 A21):

- Every `POST` takes an `Idempotency-Key` of 1 to 128 printable ASCII
  characters: missing is 400 `idempotency-key-required`, malformed is 400
  `idempotency-key-invalid`.
- The key is **global** (looked up by the key alone). The request fingerprint is
  method + path + SHA-256 of the body. The same key and fingerprint replays the
  stored answer with the header `Idempotency-Replayed: true`; the same key with
  another fingerprint is 409 `idempotency-key-reused`.
- A 2xx **and a 4xx** answer are stored (24 hours); a 5xx, an error or a panic
  rolls everything back and is stored nowhere, so the retry re-executes. The
  key row, the aggregate change and the outbox rows commit in one transaction.

## ScheduleWave

- **Actor / trigger**: Station planner.
- **Inbound adapter**: REST `POST /waves` with `Idempotency-Key`.
- **Input**: `stationNodeId`, `serviceDate`, `inductCutoffAt`, `windowStart`,
  `windowEnd`, `stopCapacity`.
- **Preconditions**: `stationNodeId` is a `DELIVERY_STATION` known to
  `StationView` (ADR 0002 A1); an unknown or non-station id is
  `ErrUnknownStation`. The check lives in the use case, not in the aggregate,
  because `StationView` is an application read model. `serviceDate` is a
  `YYYY-MM-DD` date and `stopCapacity` an integer from 0 up.
- **Main flow**:
  1. Look up the `Idempotency-Key`; if it was seen, return the stored response.
  2. Check the station against `StationView`.
  3. Build `DeliveryWave` in `OPEN` with `StopCapacity{stops, assigned: 0}`.
  4. Check `inductCutoffAt < windowStart < windowEnd`.
  5. In one transaction: insert the wave, write `DeliveryWaveScheduled` to the
     outbox, store the idempotency key. Then the packages waiting at the
     station (`AT_STATION`) are inducted into the new wave, oldest arrival
     first, until it is full (ADR 0002 A19).
  6. Return `201` with the wave.
- **Errors**: `ErrUnknownStation` → 422 `unknown-station`;
  `ErrInvalidWaveTimes` → 422 `invalid-wave-times`; 422 `validation-failed`
  (malformed body, bad `serviceDate`).
- **Events**: `DeliveryWaveScheduled`.
- **Idempotency**: `Idempotency-Key` header (see above).

## InductPackage

- **Actor / trigger**: policy `InductOnArrival` (on `LoadArrived` at a
  delivery station) and policy `RetryNextWave` (on a `FAILED` attempt).
- **Inbound adapter**: Kafka consumer of
  `com.retailnetwork.logistics.linehaul-transportation.load.LoadArrived`; an
  internal handler of this context's own `DeliveryAttempted` for retries.
- **Input**: `trackingNumber`, `stationNodeId`, the arrival (or failure)
  instant.
- **Preconditions**: the arrival is at a `DELIVERY_STATION`: the event's
  `nodeType` wins, and `StationView` decides only when the event carries none
  (ADR 0002 A8); otherwise the event is ignored. The package's destination
  area is not `CARRIER_HANDOFF` (ADR 0015, below).
- **Main flow**:
  1. Claim the CloudEvents `id` in `processed_events` (skip if seen).
  2. Record the arrival in `InboundPackagesView` (`LoadArrived` only).
  3. For each tracking number, refuse it when its destination postal prefix is
     a known `CARRIER_HANDOFF` service area (see below); otherwise list the
     station's `OPEN` waves whose `inductCutoffAt` is after the instant,
     earliest first.
  4. Call `InductPackage` on the first wave. On `ErrWaveFull` or
     `ErrInductionClosed`, try the next wave.
  5. On success, in one transaction: save the wave (version checked), record
     the package against the wave, and write `DeliveryWaveCapacityChanged`.
- **Errors** (no HTTP; asynchronous): `ErrWaveFull`, `ErrInductionClosed`
  move on to the next wave. If no wave accepts the package it stays
  `AT_STATION` and `PackageInductionDeferred` is raised (ADR 0002 A19).
  `ErrConcurrentUpdate` (`concurrent-update`) retries the whole attempt once.
- **Events**: `DeliveryWaveCapacityChanged`, one per inducted package.
- **Idempotency**: the inbox on the CloudEvents `id`, plus a no-op when the
  tracking number is already inducted in an `OPEN` wave.
- **Carrier-area exclusion (ADR 0015)**: a `ServiceAreaAssigned` whose
  `deliveryMode` is `CARRIER_HANDOFF` is not wave territory. The consumer stores the mode in
  its area read model (an event without `deliveryMode` decodes to
  `NETWORK_ROUTE`); `arriveNew` and `retryWaiting` then refuse a package whose
  destination prefix is such an area: no wave, no stop capacity, no history
  row, no event, and the counter `last_mile_delivery.carrier_area.skipped`
  rises. A package whose prefix has no area row, or whose label data is
  missing (the `pkg:<trackingNumber>` stop), is inducted as usual. Packages
  already inducted when an area flips stay on their wave.
- **Failure count**: `PackageAttemptHistory` counts failed attempts; the third
  failure raises `PackageReturnInitiated` and the package is not re-inducted
  (ADR 0002 A18).

## CloseInduction

- **Actor / trigger**: Station planner.
- **Inbound adapter**: REST `POST /waves/{waveId}/induction-closures` with
  `Idempotency-Key`.
- **Preconditions**: the wave exists and is `OPEN`.
- **Main flow**:
  1. Load the wave by `waveId`.
  2. `CloseInduction`: `OPEN` → `INDUCTION_CLOSED`.
  3. Save (version checked). No event in the model.
  4. Return `200` with the wave.
- **Errors**: 404 `not-found`; 409 `illegal-transition`; 409 `concurrent-update`.
- **Events**: none.
- **Idempotency**: `Idempotency-Key`; a repeated call on an
  `INDUCTION_CLOSED` wave with the same key returns the stored response.

## DispatchWave

- **Actor / trigger**: Station planner.
- **Inbound adapter**: REST `POST /waves/{waveId}/dispatches` with
  `Idempotency-Key`.
- **Preconditions**: the wave is `INDUCTION_CLOSED`.
- **Main flow**:
  1. Load the wave.
  2. `DispatchWave`: `INDUCTION_CLOSED` → `DISPATCHED`.
  3. Save (version checked). Packages inducted in the wave that no route of
     the wave holds are re-inducted onto the next eligible wave in the same
     transaction (ADR 0002 A11). A wave with no route completes at once
     (A9), so the response may show `COMPLETED`. Return `200`.
- **Errors**: 404 `not-found`; 409 `illegal-transition`; 409 `concurrent-update`.
- **Events**: none of its own (a re-induction raises `DeliveryWaveCapacityChanged`
  or `PackageInductionDeferred`).
- **Idempotency**: `Idempotency-Key`.

## CompleteWave

- **Actor / trigger**: none from outside. The wave completes automatically
  (ADR 0002 A9): in the same transaction in which its last route completes
  (every route of the wave is `COMPLETED`), or at once when a wave is
  dispatched with no route.
- **Inbound adapter**: none; there is no REST operation.
- **Preconditions**: the wave is `DISPATCHED`.
- **Main flow**: inside that transaction, `CompleteWave` (`DISPATCHED` →
  `COMPLETED`), save.
- **Errors**: none reach a caller; any other state is `ErrIllegalTransition`
  inside the unit of work.
- **Events**: none.
- **Idempotency**: not applicable, no caller.

## CancelWave

- **Actor / trigger**: Station planner.
- **Inbound adapter**: REST `POST /waves/{waveId}/cancellations` with
  `Idempotency-Key`.
- **Input**: `reason`, 1 to 200 characters, required.
- **Preconditions**: the wave is `OPEN`.
- **Main flow**:
  1. Load the wave.
  2. `CancelWave` (`OPEN` → `CANCELLED`) with the `reason`.
  3. In the same transaction every package inducted in the wave is
     re-inducted onto the next eligible wave (ADR 0002 A10, A6, A7); a
     package with no eligible wave is unplaced and raises
     `PackageInductionDeferred`. The cancelled wave keeps its induction list as
     a record.
  4. Save (version checked) with `DeliveryWaveCancelled` in the outbox.
  5. Return `200` with the wave (`state` `CANCELLED`, `cancelReason`).
- **Errors**: 404 `not-found`; 409 `illegal-transition` when the wave is not
  `OPEN`; 409 `concurrent-update`; 422 `validation-failed` (empty or too long
  `reason`).
- **Events**: `DeliveryWaveCancelled` on the integration stream
  `retailnetwork.last-mile-delivery.events` (consumed by `delivery-promise` and
  `order-sourcing`; ADR 0002 A22), plus `DeliveryWaveCapacityChanged` /
  `PackageInductionDeferred` for the re-inducted packages.
- **Idempotency**: `Idempotency-Key` (see above). A second cancel of a
  `CANCELLED` wave under a new key is **not** an unchanged 200: it is
  409 `illegal-transition`, the wave stays `CANCELLED` and no second
  `DeliveryWaveCancelled` is raised.

## PlanRoute

- **Actor / trigger**: Station planner.
- **Inbound adapter**: REST `POST /routes` with `Idempotency-Key`.
- **Input**: `waveId`, `dspId`, `stops[]` of `{stopNo, trackingNumbers[]}`.
- **Preconditions** (ADR 0002 A12): the wave exists and is
  `INDUCTION_CLOSED` (`ErrIllegalTransition` otherwise); the partner exists,
  is `ACTIVE` (`ErrPartnerInactive`) and works for the wave's station
  (`ErrPartnerStationMismatch`); stop numbers run 1..n without gaps or
  duplicates; a tracking number appears at most once per route; every package
  is inducted in the wave (`ErrPackageNotInducted`) and on no other route
  (`ErrPackageAlreadyRouted`); one `stopKey` per stop
  (`ErrStopKeyMismatch`).
- **Main flow**:
  1. Look up the `Idempotency-Key`.
  2. Load the `DeliveryServicePartner` (read only) for its van capacity.
  3. Load the wave (read only) for its state and `stationNodeId`.
  4. Build `Route` in `PLANNED`; check stop count `<=` van capacity.
  5. In one transaction: insert the route and its stops, write
     `RoutePlanned`, store the key. Return `201`.
- **Errors**: 404 `not-found` (wave or partner); 409 `illegal-transition`
  (wave not `INDUCTION_CLOSED`); 409 `route-over-capacity`,
  `partner-inactive`, `partner-station-mismatch`, `package-not-inducted`,
  `package-already-routed`, `stop-key-mismatch`; 422 `validation-failed`.
- **Events**: `RoutePlanned` (analytics only).
- **Idempotency**: `Idempotency-Key`.

## StartRoute

- **Actor / trigger**: DSP driver app.
- **Inbound adapter**: REST `POST /routes/{routeId}/starts` with
  `Idempotency-Key`.
- **Preconditions**: the route is `PLANNED` and its wave is `DISPATCHED`
  (ADR 0002 A14: otherwise `ErrIllegalTransition`; the use case reads the wave
  and does not change it).
- **Main flow**:
  1. Load the route.
  2. `StartRoute`: `PLANNED` → `OUT_FOR_DELIVERY`.
  3. In one transaction: save (version checked) and write one
     `PackageOutForDelivery` per tracking number on the route.
  4. Return `200`.
- **Errors**: 404 `not-found`; 409 `illegal-transition`; 409 `concurrent-update`.
- **Events**: `PackageOutForDelivery` × packages.
- **Idempotency**: `Idempotency-Key`.

## RecordAttempt

- **Actor / trigger**: DSP driver app.
- **Inbound adapter**: REST `POST /routes/{routeId}/attempts` with
  `Idempotency-Key`.
- **Input**: `trackingNumber`, `outcome` (`DELIVERED` or `FAILED`),
  `outcomeDetail` (optional: `NOT_HOME`, `ACCESS_PROBLEM` or `OTHER` on
  `FAILED`, `SAFE_PLACE_USED` on `DELIVERED`; omitted means not reported),
  `failureReason` (when `FAILED`), `at`.
- **Preconditions**: the route is `OUT_FOR_DELIVERY` and carries the
  tracking number; one attempt per package per route (ADR 0002 A15).
- **Main flow**:
  1. Load the route.
  2. Check the state (`ErrRouteNotStarted`).
  3. Check the tracking number is on the route (`ErrPackageNotOnRoute`) and
     was not attempted before (`ErrAlreadyDelivered` after a `DELIVERED`,
     `ErrAttemptAlreadyRecorded` after a `FAILED`).
  4. Record the attempt and set the stop's outcome.
  5. In one transaction: save (version checked), write `DeliveryAttempted`,
     and fold the attempt into the `DeliveryPointProfile` of the stop
     (ADR 0014), which may raise `DeliveryPointFlagged` for the packages
     newly affected.
  6. Return `201` with the attempt.
  7. When this was the last outstanding package, the route completes right
     after the attempt (`CompleteRouteOnLastAttempt`, a second save in the same
     unit of work), and the wave completes when its last route does (A9, A16).
  8. After the commit, if `FAILED`, `RetryNextWave` runs `InductPackage` in
     its own transaction (one aggregate per transaction).
- **Errors**: `ErrRouteNotStarted` → 409 `route-not-started`;
  `ErrAlreadyDelivered` → 409 `already-delivered`;
  `ErrAttemptAlreadyRecorded` → 409 `attempt-already-recorded`; 404
  `not-found` (route); 404 `package-not-on-route` (a tracking number not on
  the route); 409 `concurrent-update`; 422 `validation-failed` (including an
  `outcomeDetail` that does not pair with the outcome, and `COLLECTED` on a
  delivery induction).
- **Events**: `DeliveryAttempted`; `DeliveryPointFlagged` when the stop's
  profile crosses the two-strike threshold.
- **Idempotency**: `Idempotency-Key`. A retried `DELIVERED` with a new key
  fails with `ErrAlreadyDelivered`, which is the invariant doing its job.

## CompleteRoute

- **Actor / trigger**: none from outside. Policy `CompleteRouteOnLastAttempt`
  (ADR 0002 A16): the route completes right after the attempt that records its
  last outstanding package.
- **Inbound adapter**: none; there is no REST operation.
- **Preconditions**: the route is `OUT_FOR_DELIVERY` and every package has an
  attempt; the domain refuses it with `ErrRouteIncomplete` while one has none.
- **Main flow**: a second save in the unit of work of `RecordAttempt`:
  `CompleteRoute` (`OUT_FOR_DELIVERY` → `COMPLETED`), then the wave completes
  if this was its last route. A route whose driver never records every package
  stays `OUT_FOR_DELIVERY`.
- **Errors**: none reach a caller.
- **Events**: none.
- **Idempotency**: not applicable, no caller.

## ContractPartner

- **Actor / trigger**: not named in the model (assumed: Station planner).
- **Inbound adapter**: REST `POST /partners` with `Idempotency-Key`.
- **Input**: `stationNodeId`, `vanCapacity`.
- **Preconditions**: `stationNodeId` is a `DELIVERY_STATION` known to
  `StationView` (ADR 0002 A1).
- **Main flow**:
  1. Look up the `Idempotency-Key`.
  2. Check the station against `StationView`.
  3. Build `DeliveryServicePartner` in `ACTIVE`; check van capacity `> 0`.
  4. Insert it and store the key in one transaction. Return `201`.
- **Errors**: `ErrUnknownStation` → 422 `unknown-station`;
  `ErrInvalidVanCapacity` → 422 `invalid-van-capacity`; 422 `validation-failed`.
- **Events**: none (`events: []`).
- **Idempotency**: `Idempotency-Key`.
