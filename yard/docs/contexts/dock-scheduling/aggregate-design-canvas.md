---
id: aggregate-design-canvas
title: Aggregate Design Canvas
sidebar_label: Aggregate Design Canvas
description: "The ddd-crew Aggregate Design Canvas for DockAppointment and DockCalendar, with states, invariants, commands, events and estimates, plus the context's read models."
---

# Aggregate Design Canvas

:::info[Proposed design]
Derived from [`yard/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml). This context's service is not built yet; identifiers (`Err...` names, REST paths, CloudEvents types) are the names the service will use.
:::

Following the ddd-crew [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas).
The model has two aggregate roots: **DockAppointment** and **DockCalendar**.
Proposed Go packages: `internal/domain/dockappointment` and
`internal/domain/dockcalendar` (from the `ul` code identifiers
`dockappointment.DockAppointment` and `dockcalendar.DockCalendar`), plus
`internal/domain/shared` for `shared.SCAC`.

Four generic errors from `conventions.errors` apply to both aggregates and
are not repeated per invariant: `ErrNotFound` (404, `not-found`),
`ErrIllegalTransition` (409, `illegal-transition`), `ErrConcurrentUpdate`
(409, `concurrent-update`) and `ErrValidation` (422, `validation-failed`).

## DockAppointment

### 1. Name

`DockAppointment` (`dockappointment.DockAppointment`), identified by
`appointmentId`.

### 2. Description

One booked door window for one carrier visit: direction, door, window, and
the ASNs (inbound) or CPT and shipment references (outbound) it covers.
Value objects: `Direction(INBOUND or OUTBOUND)`, `Window` with `start` and
`end` (half-open), `Carrier` with `name` and optional `scac`, `InboundRefs`
with `asn_numbers`, `OutboundRefs` with `cpt_id` and `shipment_refs`,
`ArrivalStatus(EARLY, ON_TIME, LATE)` computed against the window with the
site's arrival tolerance, `Eta` with `eta_at`, `reported_at` and `source`,
and `ExpectedSeal` with the `seal_number` the carrier declares when booking.

### 3. State Transitions

```mermaid
stateDiagram-v2
    [*] --> BOOKED: BookAppointment
    BOOKED --> BOOKED: RescheduleAppointment
    BOOKED --> CHECKED_IN: RecordArrival
    CHECKED_IN --> COMPLETED: RecordDoorRelease
    BOOKED --> COMPLETED: RecordDoorRelease
    BOOKED --> CANCELLED: CancelAppointment
    CHECKED_IN --> CANCELLED: CancelAppointment
    BOOKED --> NO_SHOW: MarkNoShow
    COMPLETED --> [*]
    CANCELLED --> [*]
    NO_SHOW --> [*]
```

Derived from: `model.yaml → contexts[dock-scheduling].aggregates[DockAppointment].states`,
`.transitions`, `.commands`.

Omitted: `ReportEta` and `ReassignDoor` change data, not the state, so they
are not arrows. The creation arrow `[*] --> BOOKED` is `BookAppointment` (and, in
this pack's reading, `ImportLegacyAppointment`); the model lists them as
commands but not as transitions, because a transition needs a from-state. `COMPLETED`,
`CANCELLED` and `NO_SHOW` have no outgoing transition, so they are drawn as
terminal (see gap `DS-G16` for `NO_SHOW`). The arrival that is implicit in
`BOOKED --> COMPLETED` is policy `OutOfOrderYardFacts`.

### 4. Enforced Invariants

| Invariant | Enforced by | Checked against |
| --- | --- | --- |
| Door code is 1 to 64 characters, with no whitespace, control characters or `/` | `ErrInvalidDoorCode` | the value object |
| Carrier name is non-blank and at most 100 characters, `scac` is 2 to 4 upper-case letters when given | `ErrInvalidCarrier` | the value object |
| `end` is after `start` and `end - start` is at most `MaxWindow` (4 h) | `ErrInvalidWindow` | the value object |
| A booked or rescheduled window does not start before now | `ErrWindowInPast` | the clock |
| The door is a known, active Dock slot of the site | `ErrUnknownDoor` | `DoorView` |
| The door's `dockFlow` allows the direction (`Inbound`, `Outbound` or `Both`) | `ErrDoorFlowMismatch` | `DoorView` |
| No overlap with another `BOOKED` or `CHECKED_IN` appointment on the same door | `ErrDoorDoubleBooked` | domain service `DoorSchedule.CheckNoOverlap` under a per-door advisory lock |
| The window is inside the door's operating hours and outside its closures | `ErrDoorUnavailable` | `DockCalendar` |
| `INBOUND` covers at least one ASN, each known and not cancelled in the local ASN copy | `ErrUnknownAsn` | `AsnView` |
| `OUTBOUND` names a `cpt_id` known in the local CPT copy, or at least one `shipment_ref` | `ErrMissingOutboundRef` | `CutoffView` |

Six of the ten reach outside one instance: the door and flow checks read
`DoorView`, the availability check reads the other aggregate, the ASN and CPT
checks read event-fed copies, and the overlap check spans every appointment of
a door. This pack's reading is that the use case loads those inputs and
passes them to the aggregate or to the domain service; the model fixes only
that the overlap check is a domain service under a per-door advisory lock.
`ErrDoorDoubleBooked` is deliberately **not** applied by `ReassignDoor`
(policy `ActualDoorWins`): the physical fact wins, and any later appointment
that now overlaps is flagged instead.

### 5. Corrective Policies

- **`ArrivalFromGate`**: on `VisitCheckedIn` naming an appointment,
  `RecordArrival` with `arrival_status` computed from the window and the
  arrival tolerance; an unknown or terminal appointment is ignored and
  counted.
- **`ActualDoorWins`**: on `TrailerDocked` whose door differs from the booked
  door, `ReassignDoor` without the overlap refusal; any later appointment now
  overlapping on the new door gets `DockAppointmentAtRisk`.
- **`CompleteOnDoorRelease`**: on `TrailerUndocked` naming an appointment,
  `RecordDoorRelease`.
- **`OutOfOrderYardFacts`**: a door release applied to a `BOOKED` appointment
  completes it and records the arrival as implicit (`BOOKED` to `COMPLETED`);
  a late `VisitCheckedIn` for a `COMPLETED` appointment is ignored; any yard
  fact for a `CANCELLED` or `NO_SHOW` appointment is ignored and counted.
- **`NoShowSweep`**: `POST /no-show-sweeps` marks `BOOKED` appointments past
  `window_end` plus the no-show grace as `NO_SHOW` (cron, idempotent).
- **`EtaRisk`**: `ReportEta` with `eta_at` later than `window_start` plus the
  arrival tolerance raises `DockAppointmentAtRisk` once per ETA report.
- **`CancelWhenAllAsnsCancelled`**: on `ASNCancelled`, an `INBOUND` `BOOKED`
  appointment whose ASNs are all cancelled is cancelled with reason
  `ASN_CANCELLED`.
- **`PickupFromCutoffs`** (phase 2): on `CPTScheduleChanged`, keep one
  `OUTBOUND` appointment per cutoff and operating day on a 7-day horizon, on
  the door the site's `PickupDoorRule` names for the `ship_method`, window
  `[cutoff - pickup_lead, cutoff)`. `PickupDoorRule` and `pickup_lead` are not
  defined elsewhere in the model (gap `DS-G04`).
- **`LegacyImport`** (strangler stage A): consume `inbound-receiving`
  `DockAppointment*` events and import each appointment once (provenance
  `legacy-import`, direction `INBOUND`); off when its group env is unset.

### 6. Handled Commands

| Command | Issued by | State change |
| --- | --- | --- |
| `BookAppointment` | Carrier scheduler, REST `POST /appointments` | creates `BOOKED` |
| `RescheduleAppointment` | Carrier scheduler, REST `POST /appointments/{appointmentId}/reschedules` | `BOOKED` to `BOOKED` |
| `CancelAppointment` | Carrier scheduler, REST `POST /appointments/{appointmentId}/cancellations`; policy `CancelWhenAllAsnsCancelled` | `BOOKED` or `CHECKED_IN` to `CANCELLED` |
| `ReportEta` | Carrier scheduler, REST `POST /appointments/{appointmentId}/eta-reports` | none (stores `Eta`) |
| `RecordArrival` | policy `ArrivalFromGate` (no REST route) | `BOOKED` to `CHECKED_IN` |
| `ReassignDoor` | policy `ActualDoorWins` (no REST route) | none (changes the door) |
| `RecordDoorRelease` | policy `CompleteOnDoorRelease` (no REST route) | `CHECKED_IN` or `BOOKED` to `COMPLETED` |
| `MarkNoShow` | Scheduler (cron), REST `POST /no-show-sweeps` | `BOOKED` to `NO_SHOW` |
| `ImportLegacyAppointment` | policy `LegacyImport` (no REST route) | creates the appointment |

### 7. Created Events

| Event | Raised when | Topic | Full CloudEvents type |
| --- | --- | --- | --- |
| `DockAppointmentBooked` | `BookAppointment` succeeds (and, in this pack's reading, `ImportLegacyAppointment`, gap `DS-G08`) | `.events` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentBooked` |
| `DockAppointmentRescheduled` | `RescheduleAppointment` succeeds | `.events` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentRescheduled` |
| `DockAppointmentCancelled` | `CancelAppointment` succeeds | `.events` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentCancelled` |
| `DockAppointmentNoShow` | `MarkNoShow` succeeds | `.events` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentNoShow` |
| `DockAppointmentCheckedIn` | `RecordArrival` succeeds | `.analytics` only | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentCheckedIn` |
| `DockAppointmentDoorReassigned` | `ReassignDoor` succeeds | `.analytics` only | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentDoorReassigned` |
| `DockAppointmentCompleted` | `RecordDoorRelease` succeeds | `.analytics` only | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentCompleted` |
| `DockAppointmentAtRisk` | `ReportEta` under policy `EtaRisk` (cause `LATE_ETA`), or `ReassignDoor` under `ActualDoorWins` for the overlapped appointment (cause `DOOR_REASSIGNED_OVERLAP`) | `.analytics` only | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentAtRisk` |

`.events` is `warehouse.dock-scheduling.events` and `.analytics` is
`warehouse.dock-scheduling.analytics`. Every event except
`DockAppointmentAtRisk` carries the aggregate `version`.

### 8. Throughput

*Estimate* (from the model): **medium** (bookings and ETA reports). Per-door
contention is bounded by the per-door advisory lock; `version` backs the
optimistic-concurrency check (`ErrConcurrentUpdate`).

### 9. Size

*Estimate* (from the model): **doors × appointments per day × horizon (14
days), plus history**. The model uses the 14-day figure only in this
estimate; no invariant bounds how far ahead a booking may be (gap `DS-G21`).

## DockCalendar

### 1. Name

`DockCalendar` (`dockcalendar.DockCalendar`), identified by `siteId`.

### 2. Description

The per-site door calendar settings that every booking is checked against.
Value objects: `OperatingHours` with `door_code` (or the site default),
`weekday`, `opens_at`, `closes_at` and `timezone`; `Closure` with
`closure_id`, `door_code`, `from`, `to` and `reason`; `Settings` with
`max_window_minutes` (240), `slot_granularity_minutes` (15),
`arrival_tolerance_minutes` and `no_show_grace_minutes`.

### 3. State Transitions

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: first calendar command
    ACTIVE --> ACTIVE: any calendar command
    note right of ACTIVE
        The model has one state and no transitions
    end note
```

Derived from: `model.yaml → contexts[dock-scheduling].aggregates[DockCalendar].states`,
`.transitions` (empty), `.commands`.

Omitted: how a calendar comes into being is not in the model (gap
`DS-G07`); the first arrow is this pack's reading. The self-loop is drawn
only to show that commands change the contents, not the state.

### 4. Enforced Invariants

| Invariant | Enforced by |
| --- | --- |
| `opens_at < closes_at` for every operating-hours row | `ErrInvalidOperatingHours` |
| Closures do not overlap on one door | `ErrOverlappingClosure` |
| A closure may not cover an active appointment of that door (the refusal lists the appointment ids) | `ErrClosureConflictsWithAppointments` |

The third reaches into `DockAppointment` (an active appointment is `BOOKED`
or `CHECKED_IN`); the two aggregates are saved in separate transactions, so
this pack's reading is that the use case reads the appointments of the door
and the check is a point-in-time refusal, not a guarantee against a
concurrent booking.

### 5. Corrective Policies

None of the model's policies reacts to the calendar. The model names no
reaction when operating hours change under existing appointments (gap
`DS-G13`) or when a door is decommissioned (gap `DS-G12`).

### 6. Handled Commands

| Command | Issued by |
| --- | --- |
| `DeclareOperatingHours` | Dock planner, REST `PUT /sites/{siteId}/dock-calendar/operating-hours` |
| `DeclareCalendarSettings` | Dock planner, REST `PUT /sites/{siteId}/dock-calendar/settings` |
| `ScheduleDoorClosure` | Dock planner, REST `POST /sites/{siteId}/dock-calendar/closures` |
| `LiftDoorClosure` | Dock planner, REST `POST /sites/{siteId}/dock-calendar/closures/{closureId}/lifts` |

### 7. Created Events

| Event | Raised when | Topic | Full CloudEvents type |
| --- | --- | --- | --- |
| `DoorOperatingHoursDeclared` | `DeclareOperatingHours` succeeds | `.analytics` only | `com.warehouse.wms.dock-scheduling.dockcalendar.DoorOperatingHoursDeclared` |
| `DoorClosureScheduled` | `ScheduleDoorClosure` succeeds | `.events` | `com.warehouse.wms.dock-scheduling.dockcalendar.DoorClosureScheduled` |
| `DoorClosureLifted` | `LiftDoorClosure` succeeds | `.events` | `com.warehouse.wms.dock-scheduling.dockcalendar.DoorClosureLifted` |

`DeclareCalendarSettings` raises no event in the model.

### 8. Throughput

*Estimate* (from the model): **low**. Planner edits only; reads on every
booking.

### 9. Size

*Estimate* (from the model): **one per site**, with its operating-hours rows
and closures.

## Read models

| Read model | Source | Used for | Why it is not an aggregate |
| --- | --- | --- | --- |
| `DoorView` | `facility-layout` `LocationSlotRegistered` (role Dock, `dockFlow`), `LocationSlotDecommissioned`, `ZoneRegistered` (`zoneId` to `siteCode`) | `ErrUnknownDoor`, `ErrDoorFlowMismatch`, the site of a door | A copy of `facility-layout`'s slots; this context changes nothing in it and enforces no rule on it. |
| `AsnView` | `inbound-receiving` `ASNRegistered`, `ASNCancelled` | `ErrUnknownAsn`; policy `CancelWhenAllAsnsCancelled` | A copy of `inbound-receiving`'s ASNs. |
| `CutoffView` | `process-path-management` `CPTScheduleChanged` | `ErrMissingOutboundRef`; policy `PickupFromCutoffs` (phase 2) | A copy of the fleet's CPT schedule. |
| `DoorAvailabilityView` | own `DockAppointment` and `DockCalendar` state | `GetDoorAvailability`: free windows per door | A projection of this context's own aggregates; it decides nothing (booking is checked on the aggregate). |
| `AdherenceReport` | own events on the analytics topic | `GET /reports/schedule-adherence`: on-time, early, late and no-show share per site and carrier | A projection of facts already recorded; it enforces nothing. |

Derived from: `model.yaml → contexts[dock-scheduling].read_models`.
