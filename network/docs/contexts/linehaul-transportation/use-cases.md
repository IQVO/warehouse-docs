---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: One section per Linehaul Transportation command use case, with its trigger, inbound adapter, preconditions, main flow, errors mapped to HTTP problems, events and idempotency.
---

# Use Cases

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

One section per command in `contexts[linehaul-transportation].aggregates[*].commands`
(15 commands). Proposed package: `internal/application/usecases`. The
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
- **Errors with no `Err...` in the model.** The model names no identifier for
  an unknown id, an illegal state transition or an optimistic-concurrency
  conflict. These pages use 404 `not-found`, 409 `invalid-state-transition`
  and 409 `concurrent-modification` as proposed placeholders; this is a
  reported model gap.
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
  `SCHEDULED`; no booking is recorded for this `assignmentId`.
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
| unknown departure (no `Err...`) | 404 | `not-found` |
| version conflict (no `Err...`) | 409 | `concurrent-modification` (retried by the consumer) |

- **Events emitted:** `DepartureCapacityChanged`.
- **Idempotency:** inbox on the CloudEvents `id`; one booking per
  `assignmentId`.
- **Gap:** the model names no follow-up when booking is refused after the
  vendor has accepted.

## ReleaseCapacity

- **Actor / trigger:** policy `BookOnLock` on `FulfillmentCancelled` or
  `FulfillmentReassigned`.
- **Inbound adapter:** Kafka consumer of `retailnetwork.order-sourcing.events`.
- **Preconditions:** a booking is recorded for the `assignmentId`.
- **Main flow:**
  1. Insert the CloudEvents `id` into `processed_events`; if present, stop.
  2. Find the booking for `assignmentId`; if none, stop (no event).
  3. Load the departure, decrement `booked`, remove the booking.
  4. Save with the version check and write `DepartureCapacityChanged`, one
     transaction.

| Error | HTTP (if exposed) | Problem `type` slug |
| --- | --- | --- |
| version conflict (no `Err...`) | 409 | `concurrent-modification` (retried) |

- **Events emitted:** `DepartureCapacityChanged`.
- **Idempotency:** inbox; releasing only a recorded booking means `booked`
  never goes below zero.
- **Gap:** `order-sourcing` raises both triggers only before `LOCKED`, so
  step 2 always stops in the model as written.

## CloseDeparture

- **Actor / trigger:** not named in the model. The `ErrDepartureClosed`
  invariant ("no booking after `cutoffAt`") suggests `cutoffAt` as the
  closing instant.
- **Inbound adapter:** none in the model (no route, no consumer).
- **Preconditions:** the departure is `SCHEDULED`.
- **Main flow:**
  1. Load the departure.
  2. Transition `SCHEDULED → CLOSED`.
  3. Save with the version check.

| Error | HTTP (if exposed) | Problem `type` slug |
| --- | --- | --- |
| not `SCHEDULED` (no `Err...`) | 409 | `invalid-state-transition` |
| unknown departure (no `Err...`) | 404 | `not-found` |

- **Events emitted:** none (the model lists none for this command).
- **Idempotency:** a departure already `CLOSED` is returned unchanged.

## RecordDeparture

- **Actor / trigger:** not named in the model.
- **Inbound adapter:** none in the model.
- **Preconditions:** the departure is `CLOSED`.
- **Main flow:**
  1. Load the departure.
  2. Transition `CLOSED → DEPARTED`, stamp `departedAt`.
  3. Save and write `DepartureDeparted` to the outbox, one transaction.

| Error | HTTP (if exposed) | Problem `type` slug |
| --- | --- | --- |
| not `CLOSED` (no `Err...`) | 409 | `invalid-state-transition` |
| unknown departure (no `Err...`) | 404 | `not-found` |

- **Events emitted:** `DepartureDeparted` (analytics only).
- **Idempotency:** a departure already `DEPARTED` is returned unchanged.

## RecordArrival

- **Actor / trigger:** not named in the model.
- **Inbound adapter:** none in the model.
- **Preconditions:** the departure is `DEPARTED`.
- **Main flow:**
  1. Load the departure.
  2. Transition `DEPARTED → ARRIVED`, stamp `arrivedAt`.
  3. Save and write `DepartureArrived` to the outbox, one transaction.

| Error | HTTP (if exposed) | Problem `type` slug |
| --- | --- | --- |
| not `DEPARTED` (no `Err...`) | 409 | `invalid-state-transition` |
| unknown departure (no `Err...`) | 404 | `not-found` |

- **Events emitted:** `DepartureArrived` (analytics only).
- **Idempotency:** a departure already `ARRIVED` is returned unchanged.

## CancelDeparture

- **Actor / trigger:** network-ops planner; policy `PickupFromCutoffs` on
  `NodeSuspended` or `NodeRetired` (every future pickup of the node).
- **Inbound adapter:** REST `POST /departures/{departureId}:cancel` (body
  `reason`); Kafka consumer of `retailnetwork.node-topology.events`.
- **Preconditions:** the departure is `SCHEDULED`.
- **Main flow:**
  1. Load the departure.
  2. Transition `SCHEDULED → CANCELLED`, stamp `cancelledAt` and `reason`.
  3. Save and write `DepartureCancelled` to the outbox, one transaction.
  4. Return the departure (REST).

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| not `SCHEDULED` (no `Err...`) | 409 | `invalid-state-transition` |
| unknown departure (no `Err...`) | 404 | `not-found` |
| version conflict (no `Err...`) | 409 | `concurrent-modification` |

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
| unknown lane (no `Err...`) | 404 | `not-found` |
| schedule already `RETIRED` for the lane (no `Err...`) | 409 | `invalid-state-transition` |

- **Events emitted:** none (`LaneSchedule.events: []`).
- **Idempotency:** `Idempotency-Key`.

## RetireLaneSchedule

- **Actor / trigger:** not named on an `inbound` row; the route exists.
  Presumably the network-ops planner.
- **Inbound adapter:** REST `POST /lane-schedules/{laneId}:retire`.
- **Preconditions:** the schedule is `ACTIVE`.
- **Main flow:**
  1. Load the schedule.
  2. Transition `ACTIVE → RETIRED`.
  3. Save. `GenerateDepartures` skips it from now on.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| not `ACTIVE` (no `Err...`) | 409 | `invalid-state-transition` |
| unknown schedule (no `Err...`) | 404 | `not-found` |

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
| unknown departure (no `Err...`) | 404 | `not-found` |

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
| load not `OPEN` (no `Err...`) | 409 | `invalid-state-transition` |
| unknown load (no `Err...`) | 404 | `not-found` |
| version conflict (no `Err...`) | 409 | `concurrent-modification` |

- **Events emitted:** none.
- **Idempotency:** `Idempotency-Key`; adding a tracking number already on
  this load is a no-op.

## CloseLoad

- **Actor / trigger:** sort-centre or station operator.
- **Inbound adapter:** REST `POST /loads/{loadId}:close`.
- **Preconditions:** the load is `OPEN`.
- **Main flow:**
  1. Transition `OPEN → CLOSED`.
  2. Save and write `LoadClosed` (`loadId`, `departureId`, `packageCount`)
     to the outbox, one transaction.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| load not `OPEN` (no `Err...`) | 409 | `invalid-state-transition` |
| unknown load (no `Err...`) | 404 | `not-found` |

- **Events emitted:** `LoadClosed` (analytics only).
- **Idempotency:** `Idempotency-Key`; a `CLOSED` load is returned
  unchanged.

## DispatchLoad

- **Actor / trigger:** sort-centre or station operator, when the truck
  leaves.
- **Inbound adapter:** REST `POST /loads/{loadId}:dispatch`.
- **Preconditions:** the load is `CLOSED`.
- **Main flow:**
  1. Transition `CLOSED → DEPARTED`, stamp `departedAt`.
  2. Save and write `LoadDeparted` (`loadId`, `departureId`,
     `originNodeId`, `trackingNumbers`, `departedAt`), one transaction.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| load not `CLOSED` (no `Err...`) | 409 | `invalid-state-transition` |
| unknown load (no `Err...`) | 404 | `not-found` |

- **Events emitted:** `LoadDeparted` (consumed by `shipping-and-tracking`).
- **Idempotency:** `Idempotency-Key`; a `DEPARTED` load is returned
  unchanged.

## ReceiveLoad

- **Actor / trigger:** operator at the destination node (for example a
  delivery station).
- **Inbound adapter:** REST `POST /loads/{loadId}:receive`.
- **Preconditions:** the load is `DEPARTED`.
- **Main flow:**
  1. Transition `DEPARTED → ARRIVED`, stamp `arrivedAt`.
  2. Save and write `LoadArrived` (`loadId`, `departureId`,
     `destinationNodeId`, `trackingNumbers`, `arrivedAt`), one transaction.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| load not `DEPARTED` (no `Err...`) | 409 | `invalid-state-transition` |
| unknown load (no `Err...`) | 404 | `not-found` |

- **Events emitted:** `LoadArrived` (consumed by `shipping-and-tracking`
  and `last-mile-delivery`, whose `InductOnArrival` inducts the packages).
- **Idempotency:** `Idempotency-Key`; an `ARRIVED` load is returned
  unchanged.
