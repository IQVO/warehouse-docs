---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: "One section per Yard Management command use case, with its trigger, inbound adapter, preconditions, main flow, errors mapped to HTTP problems, events and idempotency."
---

# Use Cases

:::info[Proposed design]
Derived from [`yard/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml). This context's service is not built yet; identifiers (`Err...` names, REST paths, CloudEvents types) are the names the service will use.
:::

One section per command in `contexts[yard-management].aggregates[*].commands`
(23 commands) plus `DwellSweep`, an inbound message that is on no aggregate's command
list (24 sections). Proposed package: `internal/application/usecases`. The runtime
sequence of the significant ones is on
[Sequence Diagrams](/yard/contexts/yard-management/sequence-diagrams). Reads
(`ListVisits`, `GetVisit`, `ListTrailers`, `GetTrailer`, `ListMoves`, `GetYardBoard`,
`GetYardPolicy`) are not use cases: the HTTP adapter reads the repositories and the
read models directly.

## Conventions for every use case

- **One transaction.** The aggregate changes, their outbox rows and (for a
  Kafka-driven use case) the inbox row commit together. A use case that touches two
  aggregates (`ClaimNextMove`: move and trailer; `CompleteMove`: move and trailer;
  `CheckInVisit`: visit, trailers and first move) does so in one unit of work, as the
  model's `Trailer.notes` states for `StartMoving` and `ArriveAt`.
- **Errors** are `application/problem+json`. The model assigns an HTTP status only to
  four generic errors:

  | Error | HTTP | Problem `type` slug |
  | --- | --- | --- |
  | `ErrNotFound` | 404 | `not-found` |
  | `ErrIllegalTransition` | 409 | `illegal-transition` |
  | `ErrConcurrentUpdate` | 409 | `concurrent-update` |
  | `ErrValidation` | 422 | `validation-failed` |

- **Domain errors** (`ErrLocationOccupied`, `ErrAppointmentRequired`, ...) have a name
  in the model and no status. **Proposed** mapping used below: a conflict with current
  state (occupancy, ownership, release, an open check) is **409**; a value-object or
  reference rule (`ErrInvalidCarrier`, `ErrUnknownLocation`,
  `ErrUnexplainedDestination`) is **422**. The problem `type` slug is proposed as the
  kebab case of the name without `Err` (`ErrLocationOccupied` becomes
  `location-occupied`). This is gap YM-G16.
- **Idempotency.** Every state-changing `POST` and `PUT` takes an `Idempotency-Key`
  header; a replay with the same key returns the first response. Mutable aggregates
  carry a `version` (ETag / If-Match); a stale write is `ErrConcurrentUpdate`. Every
  Kafka consumer is idempotent on the CloudEvents `id` (inbox).
- **Kafka-driven errors** have no HTTP status. A policy refusal is logged and counted,
  the event is marked processed, and nothing is retried; an infrastructure failure
  rolls back and the message is redelivered.
- **Where the model is silent** the flow says *proposed* or *this pack's reading* and
  names the gap.

## YardVisit

### CheckInVisit

- **Actor / trigger:** gate clerk or kiosk (a camera or ANPR adapter issues the same
  command).
- **Inbound adapter:** REST `POST /visits`. Body (proposed): carrier, `carrier_scac?`,
  tractor plate, `driver_ref`, `purpose`, `appointment_id?`, the trailers in.
- **Preconditions:** the site has a `YardPolicy` (otherwise defaults are unknown, gap
  YM-G24).
- **Main flow:**
  1. Read the site's `YardPolicy` (`require_appointment`, `holding_spot_codes`,
     `parking_zone_ids`, `seal_mismatch_action`).
  2. Validate the carrier; refuse a second `CHECKED_IN` visit for the plate.
  3. If the site requires appointments, the named appointment must be `BOOKED` for this
     site in `AppointmentView`.
  4. Create `YardVisit` in `CHECKED_IN`.
  5. For each trailer brought in, `RecordArrival` (below).
  6. `SealCheckAtGate`: compare a recorded seal with the appointment's
     `expected_seal_number`; a mismatch raises `SealExceptionRaised`, and under
     `REJECT` the visit is rejected instead (gap YM-G7).
  7. `DirectOnCheckIn` and `VisitingDriverMove`: for each trailer in, create the first
     move, `CLAIMED`, performer `VISITING_DRIVER`, no lease. Destination: a door when the
     appointment's door is free, not closed and flow-compatible (reason `TO_DOOR`); the
     holding spot when it is a walk-in or the arrival is earlier than the tolerance
     (`TO_HOLDING`); otherwise the first free spot of the parking zones by location code.
  8. Save and write `VisitCheckedIn` to the outbox, one transaction.

| Error | HTTP (proposed except generic) | Problem `type` slug |
| --- | --- | --- |
| `ErrInvalidCarrier` | 422 | `invalid-carrier` |
| `ErrVisitAlreadyOpen` | 409 | `visit-already-open` |
| `ErrAppointmentRequired` | 409 | `appointment-required` |
| `ErrTrailerAlreadyOnSite` (from `RecordArrival`) | 409 | `trailer-already-on-site` |
| `ErrDestinationReserved` (first move) | 409 | `destination-reserved` |
| `ErrValidation` | 422 | `validation-failed` |

- **Events emitted:** `VisitCheckedIn`; `SealExceptionRaised` when the seal mismatches;
  `VisitRejected` under `REJECT`; analytics move events for the first move.
- **Idempotency:** `Idempotency-Key`; `ErrVisitAlreadyOpen` is the natural second guard.
- **Gaps:** the tolerance is unknown here (YM-G5); the reason of a move to a plain spot
  (YM-G4); no free spot (YM-G22); the move's origin when it comes from the gate
  (YM-G2).

### RejectAtGate

- **Actor / trigger:** gate clerk or kiosk, when a visit must not enter.
- **Inbound adapter:** REST `POST /visit-rejections`. Body (proposed): carrier,
  `carrier_scac?`, `appointment_id?`, `reason` (a `RejectionReason`).
- **Preconditions:** none (this pack's reading: the rejected visit never became
  `CHECKED_IN`).
- **Main flow:**
  1. Validate the carrier and the reason.
  2. Create `YardVisit` in `REJECTED`; no trailer is recorded on site.
  3. Save and write `VisitRejected` to the outbox, one transaction.

| Error | HTTP (proposed except generic) | Problem `type` slug |
| --- | --- | --- |
| `ErrInvalidCarrier` | 422 | `invalid-carrier` |
| `ErrValidation` (unknown reason) | 422 | `validation-failed` |

- **Events emitted:** `VisitRejected` (consumed by `exception-management`).
- **Idempotency:** `Idempotency-Key`.
- **Gap:** the relation to the errors raised by `CheckInVisit`, and to the `REJECT` seal
  outcome (YM-G7).

### CheckOutVisit

- **Actor / trigger:** gate clerk or kiosk.
- **Inbound adapter:** REST `POST /visits/{visitId}/check-outs`. Body: the trailers
  taken out (proposed; the model does not specify it, gap YM-G13).
- **Preconditions:** the visit is `CHECKED_IN`.
- **Main flow:**
  1. Load the visit and the trailers it takes out.
  2. Every trailer is on site and released: not `DOCKED`, no open move. The model also
     lets a live visit leave from its door (`DOCKED → DEPARTED`, `Depart` needs door work
     `DONE`), so the two rules contradict for a live visit. This pack's reading: for the
     trailer leaving from the door, "released" means door work `DONE` and no open move
     (gap YM-G28).
  3. Every `LOADED` trailer taken out on an outbound purpose carries a seal.
  4. `Depart` for each trailer taken out (this pack's reading, gap YM-G8).
  5. Transition `CHECKED_IN → CHECKED_OUT`, compute `on_site_minutes`.
  6. Save and write `VisitCheckedOut` (analytics) and, per trailer, `TrailerDeparted`
     (analytics) and `TrailerUndocked` (when it left a door; reading), one transaction.

| Error | HTTP (proposed except generic) | Problem `type` slug |
| --- | --- | --- |
| `ErrTrailerNotReleased` | 409 | `trailer-not-released` |
| `ErrSealRequired` | 409 | `seal-required` |
| `ErrDoorWorkOpen` (from `Depart`) | 409 | `door-work-open` |
| `ErrIllegalTransition` | 409 | `illegal-transition` |
| `ErrNotFound` | 404 | `not-found` |
| `ErrConcurrentUpdate` | 409 | `concurrent-update` |

- **Events emitted:** `VisitCheckedOut`, `TrailerDeparted`, `TrailerUndocked`.
- **Idempotency:** `Idempotency-Key`; a visit already `CHECKED_OUT` is returned
  unchanged (this pack's reading).

## Trailer

### RecordArrival

- **Actor / trigger:** `CheckInVisit`, once per trailer in (this pack's reading). No
  route of its own.
- **Inbound adapter:** internal (called by the visit use case).
- **Preconditions:** the natural key `(scac, number)` is not already on site.
- **Main flow:**
  1. Create `Trailer` with `UnitNumber`, `TrailerKind`, `LoadState`, `Contents`
     (`asn_numbers` from the appointment and `AsnContentView`, or `outbound_ref`),
     `Seal` and `ArrivedAt` (the dwell clock start).
  2. The first state is not defined by the model (gap YM-G2).
  3. Save.

| Error | HTTP (proposed except generic) | Problem `type` slug |
| --- | --- | --- |
| `ErrTrailerAlreadyOnSite` | 409 | `trailer-already-on-site` |
| `ErrValidation` | 422 | `validation-failed` |

- **Events emitted:** none of its own (`VisitCheckedIn` carries the trailers).
- **Idempotency:** the natural key; the visit's `Idempotency-Key`.

### StartMoving

- **Actor / trigger:** the `ClaimNextMove` use case (and, for a visiting driver's move,
  its creation), in the same unit of work. Not an inbound message.
- **Preconditions:** the trailer is `PARKED` or `DOCKED`.
- **Main flow:**
  1. Transition to `IN_MOVE`; the place (spot or door) is released (this pack's reading,
     gap YM-G11).
  2. When it left a door: raise `TrailerUndocked` (this pack's reading, gap YM-G8).

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrIllegalTransition` | 409 | `illegal-transition` |

- **Events emitted:** `TrailerUndocked` when leaving a door (reading).
- **Idempotency:** none of its own; the claim's.

### ArriveAt

- **Actor / trigger:** the `CompleteMove` use case, in the same unit of work.
- **Preconditions:** the trailer is `IN_MOVE`.
- **Main flow:**
  1. The location is a known, active slot of the trailer's site (`LocationView`).
  2. For a door: not under a closure (`DoorClosureView`), flow allows the trailer's
     direction (`LocationView.dockFlow`), the trailer is not on hold.
  3. `Occupancy.CheckFree` on the location under a per-location advisory lock (a partial
     unique index is the backstop).
  4. Transition to `PARKED` (spot) or `DOCKED` (door); at a door, `DoorWork` starts
     `WAITING` (this pack's reading).
  5. Raise `TrailerParked` or `TrailerDocked`.

| Error | HTTP (proposed except generic) | Problem `type` slug |
| --- | --- | --- |
| `ErrUnknownLocation` | 422 | `unknown-location` |
| `ErrDoorClosed` | 409 | `door-closed` |
| `ErrDoorFlowMismatch` | 409 | `door-flow-mismatch` |
| `ErrTrailerOnHold` | 409 | `trailer-on-hold` |
| `ErrLocationOccupied` | 409 | `location-occupied` |
| `ErrIllegalTransition` | 409 | `illegal-transition` |

- **Events emitted:** `TrailerParked` (analytics) or `TrailerDocked` (integration).
- **Idempotency:** the completion's.
- **Gap:** these checks run when the hostler is already at the location (YM-G11); the
  direction of an `EMPTY` trailer (YM-G12).

### StartDoorWork

- **Actor / trigger:** dock operator (floor client).
- **Inbound adapter:** REST `POST /trailers/{trailerId}/door-work-starts`.
- **Preconditions:** the trailer is `DOCKED` and its door work is `WAITING`.
- **Main flow:**
  1. Load the trailer.
  2. Set `DoorWork` to `IN_PROGRESS`.
  3. Save and write `DoorWorkStarted` (`started_at`) to the outbox. The driver wait KPI
     is arrival to this instant.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrNotFound` | 404 | `not-found` |
| `ErrIllegalTransition` (not `DOCKED`) | 409 | `illegal-transition` |
| `ErrConcurrentUpdate` | 409 | `concurrent-update` |

- **Events emitted:** `DoorWorkStarted` (analytics only).
- **Idempotency:** `Idempotency-Key`; door work already `IN_PROGRESS` is returned
  unchanged (this pack's reading).

### CompleteDoorWork

- **Actor / trigger:** dock operator; policy `AutoCompleteUnload` on `ReceiptClosed`.
- **Inbound adapter:** REST `POST /trailers/{trailerId}/door-work-completions` (body:
  the resulting `load_state`, proposed); Kafka consumer of
  `warehouse.inbound-receiving.events` for the policy.
- **Preconditions:** the trailer is `DOCKED`.
- **Main flow:**
  1. Load the trailer with its `version`.
  2. Set `DoorWork` to `DONE` and record the `load_state` (`EMPTY` for the policy).
  3. Save and write `DoorWorkCompleted` to the outbox.
  4. `ClearDoorAfterWork`: a `DROP` trailer gets a `HOSTLER` move `FROM_DOOR` to a free
     spot (`RequestMove`); a `LIVE` trailer stays until its visit checks out. How the
     trailer knows it is a drop is the visit's purpose (gap YM-G9).

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrNotFound` | 404 | `not-found` |
| `ErrIllegalTransition` (not `DOCKED`) | 409 | `illegal-transition` |
| `ErrConcurrentUpdate` | 409 | `concurrent-update` |

- **Events emitted:** `DoorWorkCompleted` (analytics only).
- **Idempotency:** `Idempotency-Key`, inbox for the policy; completing `DONE` work is
  a no-op.
- **Gap:** the receipt-to-trailer join and several ASNs on one trailer (YM-G10).

### RecordSeal

- **Actor / trigger:** yard supervisor.
- **Inbound adapter:** REST `POST /trailers/{trailerId}/seals` (body: seal number).
- **Preconditions:** the trailer is on site.
- **Main flow:**
  1. Set `Seal{number, INTACT}`.
  2. If the trailer's appointment has an `expected_seal_number` that differs, raise
     `SealExceptionRaised` (`SealCheckAtGate`; the moment of comparison is gap YM-G23).
  3. Save with the version check.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrNotFound` | 404 | `not-found` |
| `ErrValidation` | 422 | `validation-failed` |
| `ErrIllegalTransition` (`DEPARTED`) | 409 | `illegal-transition` |
| `ErrConcurrentUpdate` | 409 | `concurrent-update` |

- **Events emitted:** `SealExceptionRaised` (consumed by `exception-management`) on
  mismatch; none otherwise.
- **Idempotency:** `Idempotency-Key`.

### BreakSeal

- **Actor / trigger:** not named in the model (no route, no policy).
- **Inbound adapter:** none in the model.
- **Preconditions:** the trailer is on site.
- **Main flow:** set `Seal.state` to `BROKEN`; save. Whether it places a `SEAL_BROKEN`
  hold is not stated (gap YM-G23).
- **Errors:** `ErrNotFound`, `ErrIllegalTransition`.
- **Events emitted:** none in the model.
- **Idempotency:** a seal already `BROKEN` is unchanged.

### PlaceHold

- **Actor / trigger:** yard supervisor.
- **Inbound adapter:** REST `POST /trailers/{trailerId}/holds` (body: `reason`, a
  `HoldReason`).
- **Preconditions:** the trailer is on site and not already held.
- **Main flow:**
  1. Set `Hold{reason}`.
  2. Save and write `TrailerHeld` to the outbox. A held trailer cannot be docked
     (`ErrTrailerOnHold`); a hold on an already `DOCKED` trailer is not addressed (gap
     YM-G23).

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrNotFound` | 404 | `not-found` |
| `ErrValidation` (unknown reason) | 422 | `validation-failed` |
| `ErrIllegalTransition` (`DEPARTED`) | 409 | `illegal-transition` |
| `ErrConcurrentUpdate` | 409 | `concurrent-update` |

- **Events emitted:** `TrailerHeld` (analytics only).
- **Idempotency:** `Idempotency-Key`.

### ReleaseHold

- **Actor / trigger:** yard supervisor.
- **Inbound adapter:** REST `POST /trailers/{trailerId}/hold-releases`.
- **Preconditions:** the trailer is on hold.
- **Main flow:** clear the hold; save; write `TrailerHoldReleased`.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrNotFound` | 404 | `not-found` |
| `ErrIllegalTransition` (not held) | 409 | `illegal-transition` |
| `ErrConcurrentUpdate` | 409 | `concurrent-update` |

- **Events emitted:** `TrailerHoldReleased` (analytics only).
- **Idempotency:** `Idempotency-Key`; a trailer not held is returned unchanged
  (this pack's reading).

### RecordLoadState

- **Actor / trigger:** not named in the model; `DoorWorkCompleted` carries a
  `load_state`, and `AutoCompleteUnload` sets `EMPTY`.
- **Inbound adapter:** none of its own in the model.
- **Main flow:** set `LoadState` (`EMPTY`, `LOADED` or `PARTIAL`); save. This pack reads
  it as a step of `CompleteDoorWork`.
- **Errors:** `ErrNotFound`, `ErrValidation`.
- **Events emitted:** none of its own.
- **Idempotency:** setting the same value is a no-op.

### Depart

- **Actor / trigger:** not named in the model. This pack's reading: `CheckOutVisit`
  calls it for each trailer taken out.
- **Inbound adapter:** none of its own (no route).
- **Preconditions:** the trailer is `PARKED` or `DOCKED`; if `DOCKED`, its door work is
  `DONE`.
- **Main flow:**
  1. Transition to `DEPARTED`; compute `dwell_minutes` from `ArrivedAt`.
  2. Save; write `TrailerDeparted` and, when it left a door, `TrailerUndocked`.

| Error | HTTP (proposed except generic) | Problem `type` slug |
| --- | --- | --- |
| `ErrDoorWorkOpen` | 409 | `door-work-open` |
| `ErrIllegalTransition` (`IN_MOVE` or already `DEPARTED`) | 409 | `illegal-transition` |

- **Events emitted:** `TrailerDeparted` (analytics), `TrailerUndocked` (integration, for
  a trailer leaving a door; reading).
- **Idempotency:** the visit's.

### DwellSweep

- **Actor / trigger:** scheduler (cron), policy `DwellSweep`.
- **Inbound adapter:** REST `POST /dwell-sweeps`.
- **Preconditions:** none.
- **Main flow:**
  1. For each trailer on site, compare its dwell (now minus `ArrivedAt`) with the
     `dwell_threshold_minutes` of its `TrailerKind` in the site's `YardPolicy`.
  2. For each trailer that crossed its threshold and has not been reported for it, write
     `TrailerDwellExceeded` (`dwell_minutes`, `threshold_minutes`, `location_code`).
  3. Return the count raised.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| a missing threshold for a kind (no `Err...`) | — | skipped, logged |

- **Events emitted:** `TrailerDwellExceeded` (consumed by `exception-management`).
- **Idempotency:** once per trailer and threshold crossing, so a rerun raises nothing new;
  where the marker is kept is gap YM-G21. The model attaches the policy to no aggregate
  command (gap YM-G8).

## YardMove

### RequestMove

- **Actor / trigger:** yard supervisor; policies `DirectOnCheckIn`, `CallToDoor`,
  `ClearDoorAfterWork`.
- **Inbound adapter:** REST `POST /moves` (body, proposed: `trailer_id`, `to_location`,
  `reason`, `priority`, `due_by`); the policies call the use case in-process.
- **Preconditions:** the trailer is on site and not `IN_MOVE` with another move.
- **Main flow:**
  1. Load the trailer; `from_location` is its current place.
  2. Refuse if the trailer has another `REQUESTED` or `CLAIMED` move.
  3. Under the destination's advisory lock: the destination is free
     (`Occupancy.CheckFree`) and no other open move names it; reserve it.
  4. Create `YardMove` in `REQUESTED`, performer `HOSTLER`.
  5. Save and write `YardMoveRequested` to the outbox.

| Error | HTTP (proposed except generic) | Problem `type` slug |
| --- | --- | --- |
| `ErrTrailerHasOpenMove` | 409 | `trailer-has-open-move` |
| `ErrDestinationReserved` | 409 | `destination-reserved` |
| `ErrNotFound` (trailer) | 404 | `not-found` |
| `ErrValidation` | 422 | `validation-failed` |

- **Events emitted:** `YardMoveRequested` (analytics only).
- **Idempotency:** `Idempotency-Key`; the open-move invariant is the guard.
- **Gap:** closure, flow and hold are not checked at request in the model (YM-G11).

### ClaimNextMove

- **Actor / trigger:** hostler (floor client).
- **Inbound adapter:** REST `POST /moves/claims` (body, proposed: `hostler_ref`, site).
- **Preconditions:** the hostler holds no `CLAIMED` move.
- **Main flow:**
  1. Refuse if the hostler already holds a `CLAIMED` move.
  2. Pick the next `REQUESTED` `HOSTLER` move of the site: priority band, then `due_by`
     (order proposed, gap YM-G19), skipping rows locked by another claim.
  3. Transition `REQUESTED → CLAIMED` with `Lease{hostler_ref, expires_at}`, where
     `expires_at` = now plus the site's `lease_seconds`.
  4. `Trailer.StartMoving` in the same unit of work.
  5. Save and write `YardMoveClaimed`.

| Error | HTTP (proposed except generic) | Problem `type` slug |
| --- | --- | --- |
| `ErrHostlerBusy` | 409 | `hostler-busy` |
| `ErrConcurrentUpdate` (another hostler won) | 409 | `concurrent-update` |
| no move available (no `Err...`) | 204, empty (proposed) | — |
| `ErrValidation` | 422 | `validation-failed` |

- **Events emitted:** `YardMoveClaimed` (analytics only).
- **Idempotency:** `Idempotency-Key`; a replay returns the same claim.

### CompleteMove

- **Actor / trigger:** the lease-holding hostler; for a `VISITING_DRIVER` move the dock
  operator or gate clerk (policy text; gap YM-G3).
- **Inbound adapter:** REST `POST /moves/{moveId}/completions` (body, proposed:
  `actual_location`, `reason?`).
- **Preconditions:** the move is `CLAIMED`.
- **Main flow:**
  1. Load the move with its `version`.
  2. Only the lease holder completes it. A `VISITING_DRIVER` move has no lease.
  3. A location other than the destination needs a reason.
  4. `Trailer.ArriveAt(actual_location)`, with its checks and `Occupancy.CheckFree`, in
     the same unit of work.
  5. Transition `CLAIMED → COMPLETED`; compute `duration_seconds`.
  6. Save and write `YardMoveCompleted` and the trailer's `TrailerParked` or
     `TrailerDocked`.

| Error | HTTP (proposed except generic) | Problem `type` slug |
| --- | --- | --- |
| `ErrNotLeaseHolder` | 409 | `not-lease-holder` |
| `ErrUnexplainedDestination` | 422 | `unexplained-destination` |
| `ErrLocationOccupied`, `ErrDoorClosed`, `ErrDoorFlowMismatch`, `ErrTrailerOnHold`, `ErrUnknownLocation` (from `ArriveAt`) | 409 / 422 | see `ArriveAt` |
| `ErrIllegalTransition` (not `CLAIMED`, for example after lease expiry) | 409 | `illegal-transition` |
| `ErrNotFound` | 404 | `not-found` |
| `ErrConcurrentUpdate` | 409 | `concurrent-update` |

- **Events emitted:** `YardMoveCompleted` (analytics), `TrailerParked` or
  `TrailerDocked`.
- **Idempotency:** `Idempotency-Key`; a `COMPLETED` move is returned unchanged.

### CancelMove

- **Actor / trigger:** yard supervisor; policy `NoShowFreesHolding` on
  `DockAppointmentNoShow` or `DockAppointmentCancelled`.
- **Inbound adapter:** REST `POST /moves/{moveId}/cancellations` (body: `reason`);
  Kafka consumer of `warehouse.dock-scheduling.events` for the policy.
- **Preconditions:** the move is `REQUESTED` or `CLAIMED`.
- **Main flow:**
  1. Load the move.
  2. Transition to `CANCELLED`; release the destination reservation.
  3. Save and write `YardMoveCancelled`.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrIllegalTransition` (`COMPLETED` or already `CANCELLED`) | 409 | `illegal-transition` |
| `ErrNotFound` | 404 | `not-found` |
| `ErrConcurrentUpdate` | 409 | `concurrent-update` |

- **Events emitted:** `YardMoveCancelled` (analytics only).
- **Idempotency:** `Idempotency-Key`, inbox for the policy; a `CANCELLED` move is
  returned unchanged.
- **Gap:** a cancelled `CLAIMED` move leaves the trailer `IN_MOVE` (YM-G1); how the
  policy finds the move of an appointment (YM-G9, YM-G27).

### ExpireLease

- **Actor / trigger:** scheduler (cron), policy `LeaseExpirySweep`.
- **Inbound adapter:** REST `POST /move-lease-sweeps`.
- **Preconditions:** none.
- **Main flow:**
  1. Select `CLAIMED` moves whose `Lease.expires_at` is in the past.
  2. For each, transition `CLAIMED → REQUESTED` and clear the lease; its destination
     stays reserved.
  3. Return the count.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| a move that changed since selection (no `Err...`) | — | skipped, next sweep |

- **Events emitted:** none in the model (gap YM-G14).
- **Idempotency:** rerunning returns the same moves to `REQUESTED` only once.
- **Gap:** the trailer's state after expiry (YM-G1).

## YardCheck

### OpenYardCheck

- **Actor / trigger:** yard supervisor.
- **Inbound adapter:** REST `POST /yard-checks`.
- **Main flow:** refuse if the site has an `OPEN` check; create `YardCheck` in `OPEN`;
  save.

| Error | HTTP (proposed except generic) | Problem `type` slug |
| --- | --- | --- |
| `ErrYardCheckOpen` | 409 | `yard-check-open` |
| `ErrValidation` | 422 | `validation-failed` |

- **Events emitted:** none (the model lists only `YardCheckClosed`).
- **Idempotency:** `Idempotency-Key`; `ErrYardCheckOpen` is the natural guard.

### RecordObservation

- **Actor / trigger:** yard supervisor, walking the yard.
- **Inbound adapter:** REST `POST /yard-checks/{yardCheckId}/observations` (body:
  `location_code`, `unit_number?`).
- **Preconditions:** the check is `OPEN`.
- **Main flow:** refuse a location already observed in this check; append the
  `Observation`; save.

| Error | HTTP (proposed except generic) | Problem `type` slug |
| --- | --- | --- |
| `ErrLocationAlreadyObserved` | 409 | `location-already-observed` |
| `ErrIllegalTransition` (`CLOSED`) | 409 | `illegal-transition` |
| `ErrNotFound` | 404 | `not-found` |
| `ErrValidation` | 422 | `validation-failed` |

- **Events emitted:** none.
- **Idempotency:** `Idempotency-Key`; the same observation replayed is refused by the
  invariant.

### CloseYardCheck

- **Actor / trigger:** yard supervisor.
- **Inbound adapter:** REST `POST /yard-checks/{yardCheckId}/closures`.
- **Preconditions:** the check is `OPEN`.
- **Main flow:**
  1. Compare the observations with the trailers the model places at those locations.
  2. Build the `Discrepancy` list: `MISSING`, `UNEXPECTED` or `WRONG_LOCATION`. The rules
     are not spelled out (gap YM-G18).
  3. Transition `OPEN → CLOSED`.
  4. Save and write `YardCheckClosed` with the discrepancies.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrIllegalTransition` (`CLOSED`) | 409 | `illegal-transition` |
| `ErrNotFound` | 404 | `not-found` |
| `ErrConcurrentUpdate` | 409 | `concurrent-update` |

- **Events emitted:** `YardCheckClosed` (consumed by `exception-management`, one case
  per discrepancy).
- **Idempotency:** `Idempotency-Key`; a `CLOSED` check is returned unchanged.

## YardPolicy

### DeclareYardPolicy

- **Actor / trigger:** yard supervisor.
- **Inbound adapter:** REST `PUT /sites/{siteId}/yard-policy` (If-Match for a change).
- **Main flow:**
  1. Validate: holding spots are known Yard slots of the site (`LocationView`);
     thresholds and lease are positive.
  2. Replace the policy of the site: `require_appointment`, `holding_spot_codes`,
     `parking_zone_ids`, `dwell_threshold_minutes` per kind, `lease_seconds`,
     `seal_mismatch_action`, optional `free_time_minutes`.
  3. Save.

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrUnknownLocation` (proposed 422) | 422 | `unknown-location` |
| `ErrValidation` | 422 | `validation-failed` |
| `ErrConcurrentUpdate` | 409 | `concurrent-update` |

- **Events emitted:** none (`YardPolicy.events: []`).
- **Idempotency:** `PUT` replaces; the same body is a no-op; `Idempotency-Key`.

## Event-driven reactions that are not commands

These policies react to a Kafka event and call the use cases above; the projectors
update the read models in their own transaction.

| Trigger event | Reaction | Use case called |
| --- | --- | --- |
| `TrailerUndocked` (own) | `CallToDoor` | `RequestMove` (`HOSTLER`, `TO_DOOR`) |
| `DoorWorkCompleted` (own) | `ClearDoorAfterWork` | `RequestMove` (`FROM_DOOR`) for a `DROP` trailer |
| `ReceiptClosed` (`inbound-receiving`) | `AutoCompleteUnload` | `CompleteDoorWork` |
| `DockAppointmentNoShow`, `DockAppointmentCancelled` | `NoShowFreesHolding` | `CancelMove` |
| `DockAppointmentBooked`, `Rescheduled`, `Cancelled`, `NoShow` | projector | `AppointmentView` |
| `DoorClosureScheduled`, `DoorClosureLifted` | projector | `DoorClosureView` |
| `LocationSlotRegistered`, `LocationSlotDecommissioned`, `ZoneRegistered` | projector | `LocationView` |
| `ASNRegistered`, `ASNCancelled` | projector | `AsnContentView` |
| `ReceiptOpened`, `ReceiptClosed` | projector | `ReceiptAtDoorView` |
