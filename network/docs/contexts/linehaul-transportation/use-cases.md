---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: One section per Linehaul Transportation command use case, with its trigger, inbound adapter, preconditions, main flow, errors mapped to HTTP problems, events and idempotency.
---

# Use Cases

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One section per command in `contexts[linehaul-transportation].aggregates[*].commands`
(15 commands). Package: `internal/application/usecases`. The
runtime sequence of each is on
[Sequence Diagrams](/network/contexts/linehaul-transportation/sequence-diagrams).
Reads (`ListDepartures` on `GET /departures`, and `GET /departures/{departureId}`)
are not use cases: the HTTP adapter reads the departure repository directly.

## Conventions for every use case

- **One transaction.** The aggregate change, its outbox rows and (for a
  Kafka-driven use case) the `processed_events` row commit together.
- **Errors** are RFC 9457 `application/problem+json` with `type`
  `https://retailnetwork.example/problems/<slug>`. Mapping: validation 422,
  conflict or state 409, not found 404, capacity or closed 409, stale 409.
- **Shared slugs.** An unknown id is `ErrNotFound` (404 `not-found`), a
  command from a wrong state `ErrIllegalTransition` (409 `illegal-transition`),
  an optimistic-concurrency conflict `ErrConcurrentUpdate` (409
  `concurrent-update`) and a value-object rule `ErrValidation` (422
  `validation-failed`). The earlier placeholders `invalid-state-transition` and
  `concurrent-modification` are not used (ADR 0002 A25; `apis/openapi.yaml`).
- **Idempotency.** Every state-changing REST call takes an `Idempotency-Key`
  header; a replay with the same key returns the first response. Every
  Kafka consumer is idempotent on the CloudEvents `id`.
- **Kafka-driven errors** have no HTTP status. A domain refusal is logged
  and counted, the event is marked processed, and nothing is retried; an
  infrastructure failure rolls back and the message is redelivered.

## ScheduleDeparture

- **Actor / trigger:** `GenerateDepartures` (policy `HorizonRoll`) for each
  lane-schedule slot in the horizon; policy `PickupFromCutoffs` for each
  cutoff of a vendor fulfillment node on `NodeOperationalProfileDeclared`.
- **Inbound adapter:** internal. The scheduler (`GenerateDepartures`) or the
  Kafka consumer of `retailnetwork.node-topology.events`. No REST route.
- **Preconditions:** the lane is in `LaneView`; for a pickup, the node is in
  `NodeProfileView` as a vendor `FULFILLMENT_CENTER`.
- **Main flow:**
  1. Derive a deterministic `departureId` from the lane, the operating day
     and the slot (or cutoff).
  2. If that departure exists, stop (idempotent).
  3. Check the lane is `OPEN` in `LaneView`.
  4. Build `Departure` in `SCHEDULED` with `DepartureKind`,
     `Times{cutoffAt, departsAt, arrivesAt}` and `Capacity{packages, booked: 0}`.
     For a `PICKUP` departure `departsAt = cutoffAt` (the truck leaves at the
     cutoff) and `arrivesAt` is the cutoff plus the lane's
     `nominalTransitMinutes` (ADR 0002 A7).
  5. Save it and write `DepartureScheduled` to the outbox, one transaction.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrInvalidDepartureTimes` | 422 | `invalid-departure-times` |
| `ErrLaneClosed` | 409 | `lane-closed` |

- **Events emitted:** `DepartureScheduled`.
- **Idempotency:** the deterministic `departureId`; the inbox for the
  Kafka-driven path.

## BookCapacity

- **Actor / trigger:** policy `BookOnLock` on `FulfillmentLocked` from
  `order-sourcing`.
- **Inbound adapter:** Kafka consumer of `retailnetwork.order-sourcing.events`
  (type `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentLocked`).
- **Preconditions:** the departure `pickupDepartureId` exists and is
  `SCHEDULED`; no booking is recorded for this `assignmentId`; the lock does
  not carry `consolidatedInto` (a follower's lock books nothing: the inbox row
  is claimed and the use case stops).
- **Main flow:**
  1. Insert the CloudEvents `id` into `processed_events`; if present, stop.
  2. Load the departure by `pickupDepartureId` with its `version`.
  3. Refuse if `now > cutoffAt`.
  4. Refuse if `booked + 1 > packages`.
  5. Increment `booked`; record the booking against `assignmentId` in
     `ExpectedVolumeView`.
  6. Save with the version check and write `DepartureCapacityChanged`
     (`capacityPackages`, `bookedPackages`, `remainingPackages`) to the
     outbox, one transaction.

| Error | HTTP (if exposed) | Problem `type` slug |
| --- | --- | --- |
| `ErrDepartureFull` | 409 | `departure-full` |
| `ErrDepartureClosed` | 409 | `departure-closed` |
| `ErrNotFound` (unknown departure) | 404 | `not-found` |
| `ErrConcurrentUpdate` (version conflict) | 409 | `concurrent-update` (retried by the consumer) |

- **Events emitted:** `DepartureCapacityChanged`.
- **Idempotency:** inbox on the CloudEvents `id`; one booking per
  `assignmentId`.
- **Refusal follow-up (ADR 0002 A14):** when the named departure cannot take
  the booking (`DEPARTURE_UNKNOWN`, `DEPARTURE_CANCELLED`, `DEPARTURE_CLOSED`,
  `DEPARTURE_FULL`) the service books the next `SCHEDULED` pickup departure of
  the same origin node and publishes `DepartureCapacityChanged` and
  `BookingMoved`; with none it publishes `BookingFailed` with the first
  failure's reason.

## ReleaseCapacity

- **Actor / trigger:** none of its own. `ReleaseCapacity` is used only by the
  rebooking that `CancelDeparture` performs (ADR 0002 A15, A28). The release
  branch of `BookOnLock` was removed (gap G15): `FulfillmentCancelled` and
  `FulfillmentReassigned` do **not** release a booking.
- **Inbound adapter:** none (internal, inside the `CancelDeparture`
  transaction).
- **Preconditions:** a booking is recorded on the departure being cancelled.
- **Main flow:**
  1. `CancelDeparture` cancels the departure, then for every assignment booked
     on it releases the package (allowed on `SCHEDULED` and `CANCELLED`
     departures) and books the next eligible pickup departure by the rules of
     `BookCapacity` (reason `DEPARTURE_CANCELLED`), after all departures of one
     event were cancelled.
  2. On a cancelled departure the release publishes no
     `DepartureCapacityChanged`: the cancellation is the signal.
- **Errors:** `ErrIllegalTransition` for a release with nothing booked.
- **Events emitted:** none of its own (`DepartureCapacityChanged` for the
  target departure; `BookingMoved` or `BookingFailed`).
- **Idempotency:** the cancellation is idempotent; a recorded booking is moved
  once.
- **What `FulfillmentCancelled` and `FulfillmentReassigned` do:** only update
  `ExpectedVolumeView` (remove the assignment, or change its node and forget its
  planned departure). `order-sourcing` raises both only before `LOCKED`, so
  nothing is booked yet; if it ever cancels after the lock the capacity stays
  booked until the departure leaves (ADR 0002 A16, reported model gap).

## CloseDeparture

- **Actor / trigger:** driven by `CloseLoad` (ADR 0002 A21): it runs
  `CloseDeparture` when the load's departure is `SCHEDULED`, in the load's
  transaction. No clock closes a departure: `ErrDepartureClosed` is computed
  from `now > cutoffAt` at booking time.
- **Inbound adapter:** none of its own; the operator's REST
  `POST /loads/{loadId}/closures` reaches it.
- **Preconditions:** the departure is `SCHEDULED`.
- **Main flow:**
  1. Load the departure.
  2. Transition `SCHEDULED → CLOSED`.
  3. Save with the version check.

| Error | HTTP (if exposed) | Problem `type` slug |
| --- | --- | --- |
| `ErrIllegalTransition` (not `SCHEDULED`) | 409 | `illegal-transition` |
| `ErrNotFound` (unknown departure) | 404 | `not-found` |

- **Events emitted:** none (the model lists none for this command).
- **Idempotency:** a departure already `CLOSED` is returned unchanged.

## RecordDeparture

- **Actor / trigger:** driven by `DispatchLoad` (ADR 0002 A21): it runs
  `RecordDeparture` on the load's departure, which must be `CLOSED`, in the
  load's transaction.
- **Inbound adapter:** none of its own; the operator's REST
  `POST /loads/{loadId}/dispatches` reaches it.
- **Preconditions:** the departure is `CLOSED`.
- **Main flow:**
  1. Load the departure.
  2. Transition `CLOSED → DEPARTED`, stamp `departedAt`.
  3. Save and write `DepartureDeparted` to the outbox, one transaction.

| Error | HTTP (if exposed) | Problem `type` slug |
| --- | --- | --- |
| `ErrIllegalTransition` (not `CLOSED`) | 409 | `illegal-transition` |
| `ErrNotFound` (unknown departure) | 404 | `not-found` |

- **Events emitted:** `DepartureDeparted` (analytics only).
- **Idempotency:** a departure already `DEPARTED` is returned unchanged.

## RecordArrival

- **Actor / trigger:** driven by `ReceiveLoad` (ADR 0002 A21): it runs
  `RecordArrival` on the load's departure in the load's transaction.
- **Inbound adapter:** none of its own; the operator's REST
  `POST /loads/{loadId}/receipts` reaches it.
- **Preconditions:** the departure is `DEPARTED`.
- **Main flow:**
  1. Load the departure.
  2. Transition `DEPARTED → ARRIVED`, stamp `arrivedAt`.
  3. Save and write `DepartureArrived` to the outbox, one transaction.

| Error | HTTP (if exposed) | Problem `type` slug |
| --- | --- | --- |
| `ErrIllegalTransition` (not `DEPARTED`) | 409 | `illegal-transition` |
| `ErrNotFound` (unknown departure) | 404 | `not-found` |

- **Events emitted:** `DepartureArrived` (analytics only).
- **Idempotency:** a departure already `ARRIVED` is returned unchanged.

## CancelDeparture

- **Actor / trigger:** network-ops planner; policy `PickupFromCutoffs` on
  `NodeSuspended` or `NodeRetired` (every future pickup of the node).
- **Inbound adapter:** REST `POST /departures/{departureId}/cancellations` (body
  `reason`); Kafka consumer of `retailnetwork.node-topology.events`.
- **Preconditions:** the departure is `SCHEDULED`.
- **Main flow:**
  1. Load the departure.
  2. Transition `SCHEDULED → CANCELLED`, stamp `cancelledAt` and `reason`.
  3. Save and write `DepartureCancelled` to the outbox, one transaction.
  4. Return the departure (REST).

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrIllegalTransition` (not `SCHEDULED`) | 409 | `illegal-transition` |
| `ErrNotFound` (unknown departure) | 404 | `not-found` |
| `ErrConcurrentUpdate` (version conflict) | 409 | `concurrent-update` |

- **Events emitted:** `DepartureCancelled` (consumed by `delivery-promise`
  for `RepromiseOnRisk`, and by `order-sourcing`).
- **Idempotency:** `Idempotency-Key`; a departure already `CANCELLED` is
  returned unchanged; inbox on the Kafka path.
- **Business rule:** cancel before `cutoffAt` wherever possible, so
  promises can be revised.

## DefineLaneSchedule

- **Actor / trigger:** network-ops planner.
- **Inbound adapter:** REST `POST /lane-schedules`.
- **Preconditions:** the lane is known in `LaneView`.
- **Main flow:**
  1. Validate the slots (proposed shape: day of week, local cutoff,
     departure and arrival times, package capacity).
  2. Refuse overlapping slots on the lane.
  3. Create `LaneSchedule` in `ACTIVE` for `laneId`.
  4. Save. Departures appear at the next `GenerateDepartures`.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrOverlappingSlots` | 422 | `overlapping-slots` |
| `ErrNotFound` (unknown lane) | 404 | `not-found` |
| `ErrIllegalTransition` (schedule already `RETIRED` for the lane) | 409 | `illegal-transition` |

- **Events emitted:** none (`LaneSchedule.events: []`).
- **Idempotency:** `Idempotency-Key`.

## RetireLaneSchedule

- **Actor / trigger:** not named on an `inbound` row; the route exists.
  Presumably the network-ops planner.
- **Inbound adapter:** REST `POST /lane-schedules/{laneId}/retirements`.
- **Preconditions:** the schedule is `ACTIVE`.
- **Main flow:**
  1. Load the schedule.
  2. Transition `ACTIVE → RETIRED`.
  3. Save. `GenerateDepartures` skips it from now on.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrIllegalTransition` (not `ACTIVE`) | 409 | `illegal-transition` |
| `ErrNotFound` (unknown schedule) | 404 | `not-found` |

- **Events emitted:** none.
- **Idempotency:** `Idempotency-Key`; an already `RETIRED` schedule is
  returned unchanged.

## GenerateDepartures

- **Actor / trigger:** the scheduler, nightly (policy `HorizonRoll`).
- **Inbound adapter:** internal timer.
- **Preconditions:** none.
- **Main flow:**
  1. For each `ACTIVE` lane schedule, list the slots that fall in the next
     14 days.
  2. For each pickup lane, list the cutoffs of the origin node from
     `NodeProfileView` on its operating days (skipping holidays).
  3. For each slot or cutoff with no departure yet, run `ScheduleDeparture`.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrInvalidDepartureTimes`, `ErrLaneClosed` (per departure, logged, the rest continue) | — | — |

- **Events emitted:** `DepartureScheduled` per new departure (through
  `ScheduleDeparture`).
- **Idempotency:** deterministic `departureId`s; a rerun schedules nothing
  new.

## OpenLoad

- **Actor / trigger:** sort-centre or station operator.
- **Inbound adapter:** REST `POST /loads` (body `departureId`).
- **Preconditions:** the departure exists at this context's origin node.
- **Main flow:**
  1. Load the departure; copy `originNodeId`, `destinationNodeId` and
     `capacityPackages` into the new load (capacity snapshot for
     `ErrLoadOverCapacity`).
  2. Create `Load` in `OPEN` with a new `loadId`.
  3. Save. Return `201` with the load.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrNotFound` (unknown departure) | 404 | `not-found` |

- **Events emitted:** none.
- **Idempotency:** `Idempotency-Key`.

## AddPackage

- **Actor / trigger:** sort-centre or station operator (scanner).
- **Inbound adapter:** REST `POST /loads/{loadId}/packages` (body
  `trackingNumber`).
- **Preconditions:** the load is `OPEN`.
- **Main flow:**
  1. Load the load with its `version`.
  2. Refuse if the tracking number is on another `OPEN` or `CLOSED` load.
  3. Refuse if the package count would exceed the departure capacity.
  4. Add the tracking number; save with the version check.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrPackageAlreadyLoaded` | 409 | `package-already-loaded` |
| `ErrLoadOverCapacity` | 409 | `load-over-capacity` |
| `ErrIllegalTransition` (load not `OPEN`) | 409 | `illegal-transition` |
| `ErrNotFound` (unknown load) | 404 | `not-found` |
| `ErrConcurrentUpdate` (version conflict) | 409 | `concurrent-update` |

- **Events emitted:** none.
- **Idempotency:** `Idempotency-Key`; adding a tracking number already on
  this load is a no-op.

## CloseLoad

- **Actor / trigger:** sort-centre or station operator.
- **Inbound adapter:** REST `POST /loads/{loadId}/closures`.
- **Preconditions:** the load is `OPEN`.
- **Main flow:**
  1. Transition `OPEN → CLOSED`.
  2. Save and write `LoadClosed` (`loadId`, `departureId`, `packageCount`)
     to the outbox, one transaction.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrIllegalTransition` (load not `OPEN`) | 409 | `illegal-transition` |
| `ErrNotFound` (unknown load) | 404 | `not-found` |

- **Events emitted:** `LoadClosed` (analytics only).
- **Idempotency:** `Idempotency-Key`; a `CLOSED` load is returned
  unchanged.

## DispatchLoad

- **Actor / trigger:** sort-centre or station operator, when the truck
  leaves.
- **Inbound adapter:** REST `POST /loads/{loadId}/dispatches`.
- **Preconditions:** the load is `CLOSED`.
- **Main flow:**
  1. Transition `CLOSED → DEPARTED`, stamp `departedAt`.
  2. Save and write `LoadDeparted` (`loadId`, `departureId`,
     `originNodeId`, `trackingNumbers`, `departedAt`), one transaction.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrIllegalTransition` (load not `CLOSED`) | 409 | `illegal-transition` |
| `ErrNotFound` (unknown load) | 404 | `not-found` |

- **Events emitted:** `LoadDeparted` (consumed by `shipping-and-tracking`).
- **Idempotency:** `Idempotency-Key`; a `DEPARTED` load is returned
  unchanged.

## ReceiveLoad

- **Actor / trigger:** operator at the destination node (for example a
  delivery station).
- **Inbound adapter:** REST `POST /loads/{loadId}/receipts`.
- **Preconditions:** the load is `DEPARTED`.
- **Main flow:**
  1. Transition `DEPARTED → ARRIVED`, stamp `arrivedAt`.
  2. Save and write `LoadArrived` (`loadId`, `departureId`,
     `destinationNodeId`, `trackingNumbers`, `arrivedAt`), one transaction.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrIllegalTransition` (load not `DEPARTED`) | 409 | `illegal-transition` |
| `ErrNotFound` (unknown load) | 404 | `not-found` |

- **Events emitted:** `LoadArrived` (consumed by `shipping-and-tracking`
  and `last-mile-delivery`, whose `InductOnArrival` inducts the packages).
- **Idempotency:** `Idempotency-Key`; an `ARRIVED` load is returned
  unchanged.
