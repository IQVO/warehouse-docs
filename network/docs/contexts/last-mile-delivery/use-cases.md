---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: One proposed application use case per Last-Mile Delivery command, with trigger, inbound adapter, flow, errors mapped to HTTP problems, events and idempotency.
---

# Use Cases

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

One application service per command of the model's aggregates, proposed for
`internal/application/usecases`. Each one loads at most one aggregate,
changes it, and saves it with its events in **one transaction**. The events
go into `outbox_events` in that transaction, and a relay publishes them
(model `integration_rules`). The step-by-step diagrams are on
[Sequence Diagrams](/contexts/last-mile-delivery/sequence-diagrams); the
contract is `apis/last-mile-delivery/openapi.yaml`.

Reads are not use cases: `GET /waves?stationNodeId=&serviceDate=` reads the
wave table directly.

## Triggers at a glance

| Use case | Aggregate | Trigger | Inbound adapter |
| --- | --- | --- | --- |
| `ScheduleWave` | `DeliveryWave` | Station planner | REST `POST /waves` |
| `InductPackage` | `DeliveryWave` | policies `InductOnArrival`, `RetryNextWave` | Kafka consumer of `LoadArrived`; internal handler of own `DeliveryAttempted` |
| `CloseInduction` | `DeliveryWave` | Station planner | REST `POST /waves/{waveId}:close-induction` |
| `DispatchWave` | `DeliveryWave` | Station planner | REST `POST /waves/{waveId}:dispatch` |
| `CompleteWave` | `DeliveryWave` | not modelled | none |
| `CancelWave` | `DeliveryWave` | not modelled | none |
| `PlanRoute` | `Route` | Station planner | REST `POST /routes` |
| `StartRoute` | `Route` | DSP driver app | REST `POST /routes/{routeId}:start` |
| `RecordAttempt` | `Route` | DSP driver app | REST `POST /routes/{routeId}/attempts` |
| `CompleteRoute` | `Route` | not modelled | none |
| `ContractPartner` | `DeliveryServicePartner` | caller not named in the model | REST `POST /partners` |

## Error mapping

Every error is returned as `application/problem+json` (RFC 9457) with a
`type` slug. Domain errors come from the model's invariants. The last four
rows have no `Err...` identifier in the model; they are generic outcomes of
the adapters and the repository.

| Error | HTTP | Problem `type` | Kind |
| --- | --- | --- | --- |
| `ErrInvalidWaveTimes` | 422 | `invalid-wave-times` | validation |
| `ErrWaveFull` | 409 | `wave-full` | capacity |
| `ErrInductionClosed` | 409 | `induction-closed` | closed |
| `ErrRouteOverCapacity` | 409 | `route-over-capacity` | capacity |
| `ErrRouteNotStarted` | 409 | `route-not-started` | state |
| `ErrAlreadyDelivered` | 409 | `already-delivered` | conflict |
| `ErrInvalidVanCapacity` | 422 | `invalid-van-capacity` | validation |
| (no `Err...`) aggregate not found | 404 | `not-found` | not found |
| (no `Err...`) command not allowed in the current state | 409 | `invalid-state` | state |
| (no `Err...`) version changed since load | 409 | `stale-version` | stale |
| (no `Err...`) malformed request body | 422 | `invalid-request` | validation |

## ScheduleWave

- **Actor / trigger**: Station planner.
- **Inbound adapter**: REST `POST /waves` with `Idempotency-Key`.
- **Input**: `stationNodeId`, `serviceDate`, `inductCutoffAt`, `windowStart`,
  `windowEnd`, `stopCapacity`.
- **Preconditions**: none in the model. `StationView` can tell whether
  `stationNodeId` is a `DELIVERY_STATION`, but no invariant requires it.
- **Main flow**:
  1. Look up the `Idempotency-Key`; if it was seen, return the stored response.
  2. Build `DeliveryWave` in `OPEN` with `StopCapacity{stops, assigned: 0}`.
  3. Check `inductCutoffAt < windowStart < windowEnd`.
  4. In one transaction: insert the wave, write `DeliveryWaveScheduled` to the
     outbox, store the idempotency key.
  5. Return `201` with the wave.
- **Errors**: `ErrInvalidWaveTimes` → 422 `invalid-wave-times`.
- **Events**: `DeliveryWaveScheduled`.
- **Idempotency**: `Idempotency-Key` header.

## InductPackage

- **Actor / trigger**: policy `InductOnArrival` (on `LoadArrived` at a
  delivery station) and policy `RetryNextWave` (on a `FAILED` attempt).
- **Inbound adapter**: Kafka consumer of
  `com.retailnetwork.logistics.linehaul-transportation.load.LoadArrived`; an
  internal handler of this context's own `DeliveryAttempted` for retries.
- **Input**: `trackingNumber`, `stationNodeId`, the arrival (or failure)
  instant.
- **Preconditions**: `stationNodeId` is a `DELIVERY_STATION` in
  `StationView`; otherwise the event is ignored.
- **Main flow**:
  1. Claim the CloudEvents `id` in `processed_events` (skip if seen).
  2. Record the arrival in `InboundPackagesView` (`LoadArrived` only).
  3. For each tracking number, list the station's `OPEN` waves whose
     `inductCutoffAt` is after the instant, earliest first.
  4. Call `InductPackage` on the first wave. On `ErrWaveFull` or
     `ErrInductionClosed`, try the next wave.
  5. On success, in one transaction: save the wave (version checked), record
     the package against the wave, and write `DeliveryWaveCapacityChanged`.
- **Errors** (no HTTP; asynchronous): `ErrWaveFull`, `ErrInductionClosed`
  move on to the next wave. If no wave accepts the package it stays
  uninducted in `InboundPackagesView`; the model has no event for this.
  `stale-version` retries the package.
- **Events**: `DeliveryWaveCapacityChanged`, one per inducted package.
- **Idempotency**: the inbox on the CloudEvents `id`, plus a no-op when the
  tracking number is already inducted in an `OPEN` wave.
- **Not in the model**: the failure count behind "three failures return it
  to sender" (`RetryNextWave`); no aggregate holds it.

## CloseInduction

- **Actor / trigger**: Station planner.
- **Inbound adapter**: REST `POST /waves/{waveId}:close-induction` with
  `Idempotency-Key`.
- **Preconditions**: the wave exists and is `OPEN`.
- **Main flow**:
  1. Load the wave by `waveId`.
  2. `CloseInduction`: `OPEN` → `INDUCTION_CLOSED`.
  3. Save (version checked). No event in the model.
  4. Return `200` with the wave.
- **Errors**: 404 `not-found`; 409 `invalid-state`; 409 `stale-version`.
- **Events**: none.
- **Idempotency**: `Idempotency-Key`; a repeated call on an
  `INDUCTION_CLOSED` wave with the same key returns the stored response.

## DispatchWave

- **Actor / trigger**: Station planner.
- **Inbound adapter**: REST `POST /waves/{waveId}:dispatch` with
  `Idempotency-Key`.
- **Preconditions**: the wave is `INDUCTION_CLOSED`.
- **Main flow**:
  1. Load the wave.
  2. `DispatchWave`: `INDUCTION_CLOSED` → `DISPATCHED`.
  3. Save (version checked). Return `200`.
- **Errors**: 404 `not-found`; 409 `invalid-state`; 409 `stale-version`.
- **Events**: none.
- **Idempotency**: `Idempotency-Key`.

## CompleteWave

- **Actor / trigger**: not modelled (no route, no `inbound` row, no policy).
- **Inbound adapter**: none.
- **Preconditions**: the wave is `DISPATCHED`.
- **Main flow**: load, `CompleteWave` (`DISPATCHED` → `COMPLETED`), save.
- **Errors**: `invalid-state`, `stale-version` if a trigger is added.
- **Events**: none.
- **Idempotency**: a `COMPLETED` wave is left unchanged.

## CancelWave

- **Actor / trigger**: not modelled.
- **Inbound adapter**: none.
- **Preconditions**: the wave is `OPEN`.
- **Main flow**: load, `CancelWave` (`OPEN` → `CANCELLED`) with a `reason`,
  save with `DeliveryWaveCancelled` in the outbox.
- **Errors**: `invalid-state`, `stale-version`.
- **Events**: `DeliveryWaveCancelled` (analytics only).
- **Idempotency**: a `CANCELLED` wave is left unchanged.
- **Not in the model**: what happens to packages already inducted.

## PlanRoute

- **Actor / trigger**: Station planner.
- **Inbound adapter**: REST `POST /routes` with `Idempotency-Key`.
- **Input**: `waveId`, `dspId`, `stops[]` of `{stopNo, trackingNumbers[]}`.
- **Preconditions**: the partner exists. The model sets no rule on the
  wave's state or on whether the packages are inducted in that wave.
- **Main flow**:
  1. Look up the `Idempotency-Key`.
  2. Load the `DeliveryServicePartner` (read only) for its van capacity.
  3. Load the wave (read only) for its `stationNodeId`.
  4. Build `Route` in `PLANNED`; check stop count `<=` van capacity.
  5. In one transaction: insert the route and its stops, write
     `RoutePlanned`, store the key. Return `201`.
- **Errors**: `ErrRouteOverCapacity` → 409 `route-over-capacity`; 404
  `not-found` (wave or partner); 422 `invalid-request`.
- **Events**: `RoutePlanned` (analytics only).
- **Idempotency**: `Idempotency-Key`.

## StartRoute

- **Actor / trigger**: DSP driver app.
- **Inbound adapter**: REST `POST /routes/{routeId}:start` with
  `Idempotency-Key`.
- **Preconditions**: the route is `PLANNED`.
- **Main flow**:
  1. Load the route.
  2. `StartRoute`: `PLANNED` → `OUT_FOR_DELIVERY`.
  3. In one transaction: save (version checked) and write one
     `PackageOutForDelivery` per tracking number on the route.
  4. Return `200`.
- **Errors**: 404 `not-found`; 409 `invalid-state`; 409 `stale-version`.
- **Events**: `PackageOutForDelivery` × packages.
- **Idempotency**: `Idempotency-Key`.

## RecordAttempt

- **Actor / trigger**: DSP driver app.
- **Inbound adapter**: REST `POST /routes/{routeId}/attempts` with
  `Idempotency-Key`.
- **Input**: `trackingNumber`, `outcome` (`DELIVERED` or `FAILED`),
  `failureReason` (when `FAILED`), `at`.
- **Preconditions**: the route is `OUT_FOR_DELIVERY` and carries the
  tracking number.
- **Main flow**:
  1. Load the route.
  2. Check the state (`ErrRouteNotStarted`).
  3. Check the package was not delivered before (`ErrAlreadyDelivered`).
  4. Record the attempt and set the stop's outcome.
  5. In one transaction: save (version checked), write `DeliveryAttempted`.
  6. Return `201` with the attempt.
  7. After the commit, if `FAILED`, `RetryNextWave` runs `InductPackage` in
     its own transaction (one aggregate per transaction).
- **Errors**: `ErrRouteNotStarted` → 409 `route-not-started`;
  `ErrAlreadyDelivered` → 409 `already-delivered`; 404 `not-found` (route,
  or a tracking number not on it); 409 `stale-version`; 422
  `invalid-request`.
- **Events**: `DeliveryAttempted`.
- **Idempotency**: `Idempotency-Key`. A retried `DELIVERED` with a new key
  fails with `ErrAlreadyDelivered`, which is the invariant doing its job.

## CompleteRoute

- **Actor / trigger**: not modelled.
- **Inbound adapter**: none.
- **Preconditions**: the route is `OUT_FOR_DELIVERY`.
- **Main flow**: load, `CompleteRoute` (`OUT_FOR_DELIVERY` → `COMPLETED`),
  save.
- **Errors**: `invalid-state`, `stale-version`.
- **Events**: none.
- **Idempotency**: a `COMPLETED` route is left unchanged.

## ContractPartner

- **Actor / trigger**: not named in the model (assumed: Station planner).
- **Inbound adapter**: REST `POST /partners` with `Idempotency-Key`.
- **Input**: `stationNodeId`, `vanCapacity`.
- **Preconditions**: none.
- **Main flow**:
  1. Look up the `Idempotency-Key`.
  2. Build `DeliveryServicePartner` in `ACTIVE`; check van capacity `> 0`.
  3. Insert it and store the key in one transaction. Return `201`.
- **Errors**: `ErrInvalidVanCapacity` → 422 `invalid-van-capacity`.
- **Events**: none (`events: []`).
- **Idempotency**: `Idempotency-Key`.
