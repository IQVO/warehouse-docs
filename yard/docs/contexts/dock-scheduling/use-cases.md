---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: "One section per Dock Scheduling command use case, with its trigger, inbound adapter, preconditions, main flow, errors mapped to HTTP problems, events and idempotency."
---

# Use Cases

:::info[Built, released at v0.1.2, applied to k3s (reduced footprint)]
Built on develop (merged 2026-11-08) in [IQVO/dock-scheduling](https://github.com/IQVO/dock-scheduling), released at v0.1.2 (first release v0.1.0 on 2026-11-09) and applied to the k3s cluster on 2026-11-10 in a reduced footprint: dock-scheduling runs its API only (it relays inline); yard-management runs its API and relay. Their MCP servers, analytics projectors, report services and sweeps are registered in warehouse-infra but switched off until the cluster has room, so the KPI reports of yard-management ADR 0011 are released, not yet served. The page still derives from [`yard/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml); where the as-built service differs, the model and this page say so (see the as-built notes).
:::

One section per command in `contexts[dock-scheduling].aggregates[*].commands`
(13 commands: nine on `DockAppointment`, four on `DockCalendar`). Package
(as built): `internal/application/usecases`. The runtime sequence of each is on
[Sequence Diagrams](/yard/contexts/dock-scheduling/sequence-diagrams). Reads
(`GET /appointments`, `GET /appointments/{appointmentId}`,
`GET /doors/{doorCode}/availability`, `GET /sites/{siteId}/dock-calendar`,
`GET /reports/schedule-adherence`, `GET /reports/freshness`) are not use cases: the HTTP
adapter reads the repositories and read models directly, and the two report routes are served by
the separate `reports` binary from the analytics database.

## Conventions for every use case

- **One transaction.** The aggregate change, its outbox rows and (for a
  Kafka-driven use case) the inbox row commit together.
- **Errors** are `application/problem+json`. The model fixes four generic
  errors with status and problem slug (`conventions.errors`); every other
  `Err...` below has the status of decision D-10 (409 for a conflict with state, 422 for a
  value or reference rule) and the kebab-case of its name as slug (service ADR 0002):

| Error | HTTP | Problem slug | Source |
| --- | --- | --- | --- |
| `ErrNotFound` | 404 | `not-found` | model |
| `ErrIllegalTransition` | 409 | `illegal-transition` | model |
| `ErrConcurrentUpdate` | 409 | `concurrent-update` | model |
| `ErrValidation` | 422 | `validation-failed` | model |
| `ErrInvalidDoorCode`, `ErrInvalidCarrier`, `ErrInvalidWindow`, `ErrInvalidOperatingHours` | 422 | `invalid-door-code`, `invalid-carrier`, `invalid-window`, `invalid-operating-hours` | service |
| `ErrWindowInPast`, `ErrUnknownDoor`, `ErrDoorFlowMismatch`, `ErrUnknownAsn`, `ErrMissingOutboundRef` | 422 | `window-in-past`, `unknown-door`, `door-flow-mismatch`, `unknown-asn`, `missing-outbound-ref` | service |
| `ErrDoorDoubleBooked`, `ErrDoorUnavailable`, `ErrOverlappingClosure`, `ErrClosureConflictsWithAppointments` | 409 | `door-double-booked`, `door-unavailable`, `overlapping-closure`, `closure-conflicts-with-appointments` | service |
| `ErrAsnAlreadyScheduled`, `ErrHoursConflictWithAppointments`, `ErrNoShowTooEarly`, `ErrClosureAlreadyLifted` | 409 | `asn-already-scheduled`, `hours-conflict-with-appointments`, `no-show-too-early`, `closure-already-lifted` | service (added as built) |
| `ErrUnknownClosure` | 404 | `unknown-closure` | service |
| `ErrInvalidSettings`, `ErrInvalidClosure`, `ErrInvalidReason`, `ErrInvalidEta`, `ErrDuplicateAsn`, `ErrInvalidRefs` | 422 | the kebab-case of the name | service |

- **Idempotency.** Every state-changing `POST` and `PUT` takes an
  `Idempotency-Key` header; a replay with the same key returns the first
  response. Every Kafka consumer is idempotent on the CloudEvents `id`
  (inbox). Mutable aggregates carry a `version` exposed as an ETag and
  checked with `If-Match` (`ErrConcurrentUpdate` on a lost race, `412` on an `If-Match` mismatch). As built the ETag is the
  weak `W/"<version>"`, `If-Match` is honoured on reschedule and cancel and is optional (no `428`),
  creating `POST`s require the `Idempotency-Key` and a replay answers byte-identically with
  `Idempotency-Replayed: true`; `PUT` is idempotent by method.
- **Kafka-driven use cases** have no HTTP status. A domain refusal that the
  model calls "ignored and counted" is counted and the event is marked
  processed; an infrastructure failure rolls back and the message is
  redelivered.
- **Order of checks** in a booking is this pack's reading (the service does not state it): cheap
  value-object checks first, then the event-fed copies, then the calendar,
  and the per-door lock last so that it is held for the shortest time.
- **Request and response bodies** are not in the model; fields named below
  come from the event payloads and value objects.

## BookAppointment

- **Actor / trigger:** carrier scheduler (carrier portal).
- **Inbound adapter:** REST `POST /appointments`.
- **Preconditions:** none on the aggregate; the door, ASN and CPT copies
  must already hold the facts the booking cites.
- **Main flow:**
  1. Validate the value objects: door code (`ErrInvalidDoorCode`), carrier
     (`ErrInvalidCarrier`), window (`ErrInvalidWindow`), start not before now
     (`ErrWindowInPast`).
  2. Look the door up in `DoorView`: a known, active Dock slot
     (`ErrUnknownDoor`). The door's zone gives the `site_id`.
  3. Check the direction against the door's `dockFlow`
     (`ErrDoorFlowMismatch`).
  4. Load the site's `DockCalendar`; the window must be inside the door's
     operating hours and outside its closures (`ErrDoorUnavailable`).
  5. `INBOUND`: every ASN is in `AsnView` and not cancelled
     (`ErrUnknownAsn`). `OUTBOUND`: the `cpt_id` is in `CutoffView`, or at
     least one `shipment_ref` is given (`ErrMissingOutboundRef`).
  6. Take the per-door advisory lock and run `DoorSchedule.CheckNoOverlap`
     against the door's `BOOKED` and `CHECKED_IN` appointments
     (`ErrDoorDoubleBooked`).
  7. Create the appointment in `BOOKED` with `version` 1, save it and write
     `DockAppointmentBooked` to the outbox, in one transaction.
  8. Return the appointment with its ETag.
- **Errors:** `ErrInvalidDoorCode`, `ErrInvalidCarrier`, `ErrInvalidWindow`,
  `ErrWindowInPast`, `ErrUnknownDoor`, `ErrDoorFlowMismatch`,
  `ErrDoorUnavailable`, `ErrUnknownAsn`, `ErrMissingOutboundRef`,
  `ErrDoorDoubleBooked`, `ErrValidation`.
- **Events emitted:** `DockAppointmentBooked`.
- **Idempotency:** `Idempotency-Key`; the overlap check and the insert run
  under the same per-door lock.

## RescheduleAppointment

- **Actor / trigger:** carrier scheduler.
- **Inbound adapter:** REST `POST /appointments/{appointmentId}/reschedules`,
  `If-Match` with the appointment `version`.
- **Preconditions:** the appointment is `BOOKED`.
- **Main flow:**
  1. Load the appointment; refuse if not `BOOKED` (`ErrIllegalTransition`).
  2. Validate the new window, and the new door when one is given, as in
     `BookAppointment` steps 1, 3 and 4: a reschedule may change the door and the window (decision D-4).
  3. Under the per-door lock, run `DoorSchedule.CheckNoOverlap` for the new
     window, ignoring this appointment (`ErrDoorDoubleBooked`).
  4. Keep the state `BOOKED`; store the new window and the previous one;
     save with the version check and write `DockAppointmentRescheduled`
     (`previous_window_start`, `previous_window_end`, `previous_door_code`,
     `arrival_tolerance_minutes`), one transaction.
- **Errors:** `ErrNotFound`, `ErrIllegalTransition`, `ErrConcurrentUpdate`,
  `ErrInvalidWindow`, `ErrWindowInPast`, `ErrDoorFlowMismatch`,
  `ErrDoorUnavailable`, `ErrDoorDoubleBooked`.
- **Events emitted:** `DockAppointmentRescheduled`.
- **Idempotency:** `Idempotency-Key` and `If-Match`.

## CancelAppointment

- **Actor / trigger:** carrier scheduler; policy `CancelWhenAllAsnsCancelled`
  on `ASNCancelled` (reason `ASN_CANCELLED`); policy `CancelOnVisitRejected` on `VisitRejected`
  (reason `TURNED_AWAY`). The REST route accepts `CARRIER_REQUEST` and `SITE_REQUEST`, the latter
  for the dock planner (decisions D-5, X2).
- **Inbound adapter:** REST `POST /appointments/{appointmentId}/cancellations`
  with a `CancellationReason`; Kafka consumer of
  `warehouse.inbound-receiving.events` for the policy.
- **Preconditions:** the appointment is `BOOKED` or `CHECKED_IN`.
- **Main flow:**
  1. Load the appointment; refuse if not `BOOKED` or `CHECKED_IN`
     (`ErrIllegalTransition`).
  2. Transition to `CANCELLED` with the reason.
  3. Save with the version check and write `DockAppointmentCancelled`
     (`reason`), one transaction.
  4. Policy path: for each `INBOUND` `BOOKED` appointment of the cancelled ASN
     whose ASNs are now all cancelled, run steps 2 and 3.
- **Errors:** `ErrNotFound`, `ErrIllegalTransition`, `ErrConcurrentUpdate`,
  `ErrValidation` (a reason outside the list).
- **Events emitted:** `DockAppointmentCancelled`.
- **Idempotency:** `Idempotency-Key` and `If-Match`; inbox on the Kafka path.

## ReportEta

- **Actor / trigger:** carrier scheduler (later, possibly a
  `transport-visibility` feed).
- **Inbound adapter:** REST `POST /appointments/{appointmentId}/eta-reports`.
- **Preconditions:** the appointment exists. The model does not name the
  states that accept an ETA; this pack's reading is `BOOKED` only.
- **Main flow:**
  1. Load the appointment with its `version`.
  2. Store `Eta` (`eta_at`, `reported_at`, `source`).
  3. If `eta_at` is later than `window_start` plus the arrival tolerance,
     write `DockAppointmentAtRisk` with cause `LATE_ETA` (policy `EtaRisk`),
     once per ETA report.
  4. Save with the version check, one transaction. Nothing is rescheduled.
- **Errors:** `ErrNotFound`, `ErrIllegalTransition`, `ErrConcurrentUpdate`,
  `ErrValidation`.
- **Events emitted:** `DockAppointmentAtRisk` when the ETA is late; none
  otherwise.
- **Idempotency:** `Idempotency-Key`; one `AtRisk` per ETA report.

## RecordArrival

- **Actor / trigger:** policy `ArrivalFromGate` on `VisitCheckedIn` naming an
  `appointment_id`. There is no REST route: arrival is a physical fact owned
  by `yard-management`.
- **Inbound adapter:** Kafka consumer of `warehouse.yard-management.events`
  (type `com.warehouse.wms.yard-management.yardvisit.VisitCheckedIn`).
- **Preconditions:** the appointment is `BOOKED`.
- **Main flow:**
  1. Insert the CloudEvents `id` into the inbox; if present, stop.
  2. Load the appointment. Unknown or terminal (`COMPLETED`, `CANCELLED`,
     `NO_SHOW`): ignore and count. A late `VisitCheckedIn` for a `COMPLETED`
     appointment is also ignored.
  3. Compute `ArrivalStatus` from `arrived_at`, the window and the site's
     arrival tolerance (EARLY before `window_start` minus the tolerance, LATE after `window_start` plus the
     tolerance, else ON_TIME; decision X6).
  4. Transition `BOOKED` to `CHECKED_IN`; save with the version check and
     write `DockAppointmentCheckedIn` (`checked_in_at`, `arrival_status`,
     `visit_id`) to the analytics topic, one transaction.
- **Errors:** none returned; refusals are counted. An appointment already
  `CHECKED_IN` is left unchanged and counted.
- **Events emitted:** `DockAppointmentCheckedIn` (analytics only).
- **Idempotency:** inbox on the CloudEvents `id`.

## ReassignDoor

- **Actor / trigger:** policy `ActualDoorWins` on `TrailerDocked` whose
  `door_code` differs from the booked door. No REST route.
- **Inbound adapter:** Kafka consumer of `warehouse.yard-management.events`
  (type `com.warehouse.wms.yard-management.trailer.TrailerDocked`).
- **Preconditions:** the appointment is active: `BOOKED` and `CHECKED_IN` accept
  the command (the model lists both as self-transitions).
- **Main flow:**
  1. Inbox check on the CloudEvents `id`.
  2. Load the appointment by `appointment_id`; if the door equals the booked
     door, stop (the model names no reaction).
  3. Change the door **without** the overlap refusal: the physical fact wins.
  4. Find later appointments that now overlap on the new door; each gets
     `DockAppointmentAtRisk` with cause `DOOR_REASSIGNED_OVERLAP`.
  5. Save with the version check and write `DockAppointmentDoorReassigned`
     (`from_door_code`, `to_door_code`), one transaction.
- **Errors:** none returned; a `CANCELLED` or `NO_SHOW` appointment is
  ignored and counted.
- **Events emitted:** `DockAppointmentDoorReassigned` (integration and analytics, service
  ADR 0010: `inbound-receiving` reads it) and, per overlapped appointment,
  `DockAppointmentAtRisk` (analytics only).
- **Idempotency:** inbox; a second `TrailerDocked` for the same door changes
  nothing.

## RecordDoorRelease

- **Actor / trigger:** policy `CompleteOnDoorRelease` on `TrailerUndocked`
  naming an `appointment_id`. No REST route.
- **Inbound adapter:** Kafka consumer of `warehouse.yard-management.events`
  (type `com.warehouse.wms.yard-management.trailer.TrailerUndocked`).
- **Preconditions:** the appointment is `CHECKED_IN`, or `BOOKED` (policy
  `OutOfOrderYardFacts`).
- **Main flow:**
  1. Inbox check on the CloudEvents `id`.
  2. Load the appointment. `CANCELLED` or `NO_SHOW`: ignore and count.
  3. From `BOOKED`, record the arrival as implicit and complete it
     (`BOOKED` to `COMPLETED`); from `CHECKED_IN`, complete it.
  4. Save with the version check and write `DockAppointmentCompleted`
     (`completed_at`), one transaction.
- **Errors:** none returned.
- **Events emitted:** `DockAppointmentCompleted` (analytics only). No
  `DockAppointmentCheckedIn` is raised for an implicit arrival; the adherence report counts it as
  `ON_TIME` and the metric `dock_scheduling_implicit_arrivals_total` counts it.
- **Idempotency:** inbox; an appointment already `COMPLETED` is not completed
  twice. One appointment covers exactly one trailer (decision X3).

## MarkNoShow

- **Actor / trigger:** scheduler (cron), policy `NoShowSweep`.
- **Inbound adapter:** REST `POST /no-show-sweeps`.
- **Preconditions:** none; the sweep selects what qualifies.
- **Main flow:**
  1. Select `BOOKED` appointments with `window_end` plus the site's no-show
     grace before now.
  2. For each, transition `BOOKED` to `NO_SHOW`, save with the version check
     and write `DockAppointmentNoShow`, one transaction per appointment. A
     version conflict leaves the appointment for the next sweep.
  3. Return how many were marked (this pack's reading; the response body is
     not in the model; the answer lists the ids).
- **Errors:** `ErrConcurrentUpdate` per appointment is absorbed by the sweep;
  no other.
- **Events emitted:** `DockAppointmentNoShow`, one per appointment.
- **Idempotency:** `Idempotency-Key`; a rerun marks only what still
  qualifies, so it is idempotent by construction.

## ImportLegacyAppointment

- **Actor / trigger:** policy `LegacyImport` (strangler stage A) on
  `inbound-receiving` `DockAppointmentBooked`, `CheckedIn`, `Cancelled` and `Completed` events; off
  when `DOCK_LEGACY_IMPORT_CONSUMER_GROUP` is unset; removed at stage E.
- **Inbound adapter:** Kafka consumer of `warehouse.inbound-receiving.events`.
- **Preconditions:** the appointment has not been imported yet.
- **Main flow:**
  1. Inbox check on the CloudEvents `id`.
  2. If this legacy appointment was imported, stop (import once).
  3. Create the appointment with provenance `legacy-import` and direction
     `INBOUND`; the door gives the `site_id`.
  4. Save and write `DockAppointmentBooked` with the provenance, one transaction.
- **Errors:** none returned. An import enforces none of window-in-past, hours, closures, overlap or
  known ASN (decision D-2); an unknown door skips the event and counts it (`unknown_door`).
  The importer must be enabled after the facility consumer has caught up.
- **Events emitted:** `DockAppointmentBooked`.
- **Idempotency:** inbox, and one import per legacy appointment.

## DeclareOperatingHours

- **Actor / trigger:** dock planner.
- **Inbound adapter:** REST `PUT /sites/{siteId}/dock-calendar/operating-hours`.
- **Preconditions:** none.
- **Main flow:**
  1. Validate every row: `opens_at < closes_at` (`ErrInvalidOperatingHours`).
  2. Store the hours for the door, or as the site default, with weekday and
     time zone; `PUT` replaces the whole set of rows of the site (assumption A7: a door with rows of
     its own uses only those, a door with none uses the site default rows, no rows at all means open
     24x7; at most one row per door and weekday; `closes_at` may be `24:00`).
  3. Save with the version check and write `DoorOperatingHoursDeclared`
     (`site_id`, `door_code`, `operating_hours`, `version`), one transaction.
- **Errors:** `ErrInvalidOperatingHours`, `ErrConcurrentUpdate`,
  `ErrValidation`, `ErrHoursConflictWithAppointments` (409, lists the ids) when an active appointment
  would fall outside the new hours (decision D-8).
- **Events emitted:** `DoorOperatingHoursDeclared` (analytics only).
- **Idempotency:** `Idempotency-Key`; `PUT` with the same body is a no-op.

## DeclareCalendarSettings

- **Actor / trigger:** dock planner.
- **Inbound adapter:** REST `PUT /sites/{siteId}/dock-calendar/settings`.
- **Preconditions:** none.
- **Main flow:**
  1. Validate `max_window_minutes`, `slot_granularity_minutes`,
     `arrival_tolerance_minutes` and `no_show_grace_minutes` (`ErrValidation`;
     the defaults are 240, 15, 15 and 60; `max_window_minutes` can only lower the 4 h hard cap; the
     window grid is whole minutes since the Unix epoch).
  2. Store the settings and save with the version check.
- **Errors:** `ErrValidation`, `ErrConcurrentUpdate`.
- **Events emitted:** none; the new tolerance reaches `yard-management` on the next `Booked` or
  `Rescheduled` event (`arrival_tolerance_minutes`, decision X1).
- **Idempotency:** `Idempotency-Key`; `PUT` with the same body is a no-op.

## ScheduleDoorClosure

- **Actor / trigger:** dock planner.
- **Inbound adapter:** REST `POST /sites/{siteId}/dock-calendar/closures`.
- **Preconditions:** none on the calendar.
- **Main flow:**
  1. Validate the closure (`door_code`, `from`, `to`, `reason`).
  2. Refuse if it overlaps another closure of the same door
     (`ErrOverlappingClosure`).
  3. Refuse if it covers an active appointment of the door; the refusal lists
     the appointment ids (`ErrClosureConflictsWithAppointments`).
  4. Add the closure with a new `closure_id`; save with the version check and
     write `DoorClosureScheduled`, one transaction.
- **Errors:** `ErrOverlappingClosure`, `ErrClosureConflictsWithAppointments`,
  `ErrConcurrentUpdate`, `ErrValidation`.
- **Events emitted:** `DoorClosureScheduled` (consumed by
  `yard-management`).
- **Idempotency:** `Idempotency-Key`. The appointments check is a read, not
  a lock; a booking that lands between the check and the commit is possible
  (this pack's reading of the model's two separate aggregates).

## LiftDoorClosure

- **Actor / trigger:** dock planner.
- **Inbound adapter:** REST
  `POST /sites/{siteId}/dock-calendar/closures/{closureId}/lifts`.
- **Preconditions:** the closure exists on the site's calendar.
- **Main flow:**
  1. Find the closure by `closure_id` (`ErrNotFound` if absent).
  2. Remove it; save with the version check and write `DoorClosureLifted`,
     one transaction.
- **Errors:** `ErrNotFound`, `ErrConcurrentUpdate`.
- **Events emitted:** `DoorClosureLifted` (consumed by `yard-management`).
- **Idempotency:** `Idempotency-Key`; a replay returns the first response.
