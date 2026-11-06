---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: "Every event Dock Scheduling publishes and consumes, with full CloudEvents types, topics, keys, payload fields, producers and consumers."
---

# Domain Events

:::info[Proposed design]
Derived from [`yard/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml). This context's service is not built yet; identifiers (`Err...` names, REST paths, CloudEvents types) are the names the service will use.
:::

Every event this context publishes and consumes, from
`contexts[dock-scheduling].publishes` and `.consumes`. The envelope follows
`conventions.cloudevents` in the model.

## Envelope

| Attribute | Value |
| --- | --- |
| `specversion` | `1.0` (structured JSON mode) |
| `id` | a UUID minted once, when the event is written to the outbox; a redelivery carries the same `id` |
| `source` | `/warehouse/dock-scheduling` |
| `type` | `com.warehouse.wms.dock-scheduling.<entity>.<EventName>`, entity `dockappointment` or `dockcalendar` |
| `subject` | the aggregate root id: `appointmentId` for `dockappointment` events, `siteId` for `dockcalendar` events |
| `time` | the instant the fact happened, UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:warehouse:dock-scheduling:events:<EventName>:v1` |
| Kafka topic | `warehouse.dock-scheduling.events` for integration events, `warehouse.dock-scheduling.analytics` for events marked `analytics only` |
| Kafka key | the same id as `subject`, so one appointment's (or one site calendar's) events stay in order on one partition |
| Payload case | `snake_case` |
| `version` | in `data` of every event except `DockAppointmentAtRisk`: the aggregate `version` (starts at 1, plus 1 per accepted change); a reader applies only a `version` greater than the stored one |

Every event leaves through the transactional outbox, in the same transaction
as the aggregate change. Events the model marks `analytics only` go **only**
to `warehouse.dock-scheduling.analytics`; integration events go to
`warehouse.dock-scheduling.events` and are mirrored to analytics by the
projector pattern (`conventions.analytics_rule`).

## Published

### Appointment events (key `appointmentId`)

| Event | Full `type` | Topic | `data` fields | Producing command | Consumers |
| --- | --- | --- | --- | --- | --- |
| `DockAppointmentBooked` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentBooked` | `.events` | `appointment_id`, `site_id`, `direction`, `door_code`, `carrier`, `carrier_scac`, `window_start`, `window_end`, `asn_numbers`, `cpt_id`, `shipment_refs`, `expected_seal_number`, `provenance`, `version` | `BookAppointment` (`ImportLegacyAppointment` in this pack's reading) | `yard-management`, `warehouse-planning`, `inbound-receiving` |
| `DockAppointmentRescheduled` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentRescheduled` | `.events` | `appointment_id`, `site_id`, `door_code`, `window_start`, `window_end`, `previous_window_start`, `previous_window_end`, `version` | `RescheduleAppointment` | `yard-management`, `warehouse-planning` |
| `DockAppointmentCancelled` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentCancelled` | `.events` | `appointment_id`, `site_id`, `door_code`, `reason`, `version` | `CancelAppointment` (carrier request, or policy `CancelWhenAllAsnsCancelled`) | `yard-management`, `warehouse-planning`, `inbound-receiving` |
| `DockAppointmentNoShow` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentNoShow` | `.events` | `appointment_id`, `site_id`, `door_code`, `direction`, `carrier_scac`, `window_end`, `version` | `MarkNoShow` (policy `NoShowSweep`) | `yard-management`, `warehouse-planning`, `exception-management` |
| `DockAppointmentCheckedIn` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentCheckedIn` | `.analytics` only | `appointment_id`, `site_id`, `door_code`, `checked_in_at`, `arrival_status`, `visit_id`, `version` | `RecordArrival` (policy `ArrivalFromGate`) | analytics only |
| `DockAppointmentDoorReassigned` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentDoorReassigned` | `.analytics` only | `appointment_id`, `site_id`, `from_door_code`, `to_door_code`, `version` | `ReassignDoor` (policy `ActualDoorWins`) | analytics only |
| `DockAppointmentCompleted` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentCompleted` | `.analytics` only | `appointment_id`, `site_id`, `door_code`, `completed_at`, `version` | `RecordDoorRelease` (policy `CompleteOnDoorRelease`) | analytics only |
| `DockAppointmentAtRisk` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentAtRisk` | `.analytics` only | `appointment_id`, `site_id`, `door_code`, `eta_at`, `window_start`, `window_end`, `cause` | `ReportEta` (policy `EtaRisk`), `ReassignDoor` (policy `ActualDoorWins`) | analytics only |

### Calendar events (key `siteId`)

| Event | Full `type` | Topic | `data` fields | Producing command | Consumers |
| --- | --- | --- | --- | --- | --- |
| `DoorClosureScheduled` | `com.warehouse.wms.dock-scheduling.dockcalendar.DoorClosureScheduled` | `.events` | `site_id`, `closure_id`, `door_code`, `from`, `to`, `reason`, `version` | `ScheduleDoorClosure` | `yard-management` |
| `DoorClosureLifted` | `com.warehouse.wms.dock-scheduling.dockcalendar.DoorClosureLifted` | `.events` | `site_id`, `closure_id`, `door_code`, `version` | `LiftDoorClosure` | `yard-management` |
| `DoorOperatingHoursDeclared` | `com.warehouse.wms.dock-scheduling.dockcalendar.DoorOperatingHoursDeclared` | `.analytics` only | `site_id`, `door_code`, `operating_hours`, `version` | `DeclareOperatingHours` | analytics only |

`.events` is `warehouse.dock-scheduling.events` and `.analytics` is
`warehouse.dock-scheduling.analytics`.

Enumerations used in the payloads: `direction` is `INBOUND` or `OUTBOUND`;
`arrival_status` is `EARLY`, `ON_TIME` or `LATE`; `reason` of
`DockAppointmentCancelled` is a `CancellationReason` (`CARRIER_REQUEST`,
`SITE_REQUEST`, `ASN_CANCELLED`, `TURNED_AWAY`); `cause` of
`DockAppointmentAtRisk` is an `AtRiskCause` (`LATE_ETA`,
`DOOR_REASSIGNED_OVERLAP`).

"Analytics only" means the model names no in-org consumer. No context may
depend on those events for a decision without a model change. Commands that
raise no event: `ReportEta` (unless the ETA is late), `DeclareCalendarSettings`.

### Example: a no-show

`DockAppointmentNoShow` is one of the events with three consumers. Ids
and times are illustrative; the `data` fields are exactly those in the model.

```json
{
  "specversion": "1.0",
  "id": "6f1d2c4e-8a1b-4e8f-9b4a-2d5c7e9f1a30",
  "source": "/warehouse/dock-scheduling",
  "type": "com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentNoShow",
  "subject": "appt-0001",
  "time": "2026-11-06T14:40:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:dock-scheduling:events:DockAppointmentNoShow:v1",
  "data": {
    "appointment_id": "appt-0001",
    "site_id": "SITE-A",
    "door_code": "D07",
    "direction": "INBOUND",
    "carrier_scac": "ABCD",
    "window_end": "2026-11-06T14:00:00Z",
    "version": 2
  }
}
```

## Consumed

Every consumer is idempotent on the CloudEvents `id` (a row in an inbox table
written in the same transaction as the effect) and dispatches on the full
`type` string, never on a suffix (`conventions.integration_rules`). The model
prints the full `type` for none of these producers; for `yard-management` it
follows the convention
`com.warehouse.wms.yard-management.<entity>.<EventName>` (entity `yardvisit`
or `trailer`). The other full types are read from each producer's AsyncAPI
(gap `DS-G18`). The last column is a proposal: the model requires only the
inbox.

| Producer | Event and topic | `data` fields listed in `consumes` | What this context does with it | Idempotency beyond the inbox (proposed) |
| --- | --- | --- | --- | --- |
| `yard-management` | `VisitCheckedIn`, `warehouse.yard-management.events` | not listed | Policy `ArrivalFromGate`: when it names an `appointment_id`, `RecordArrival` with `arrival_status` | An appointment already `CHECKED_IN` is left unchanged; unknown and terminal ones are ignored and counted |
| `yard-management` | `TrailerDocked`, `warehouse.yard-management.events` | not listed | Policy `ActualDoorWins`: if the door differs from the booked door, `ReassignDoor` | Same door: no change |
| `yard-management` | `TrailerUndocked`, `warehouse.yard-management.events` | not listed | Policy `CompleteOnDoorRelease`: when it names an `appointment_id`, `RecordDoorRelease`; `OutOfOrderYardFacts` covers a `BOOKED` appointment | A `COMPLETED` appointment is not completed twice |
| `facility-layout` | `LocationSlotRegistered`, `warehouse.facility.events` | `locationCode`, `zoneId`, `role`, `dockFlow` | Upserts a Dock slot (role Dock) with its `dockFlow` into `DoorView` | Upsert on `locationCode` |
| `facility-layout` | `LocationSlotDecommissioned`, `warehouse.facility.events` | not listed | Marks the door inactive in `DoorView` (`ErrUnknownDoor` for new bookings); no reaction on existing appointments is named (gap `DS-G12`) | Status overwrite |
| `facility-layout` | `ZoneRegistered`, `warehouse.facility.events` | `zoneId`, `siteCode` | Maps `zoneId` to `siteCode`, which gives every door its `site_id` | Upsert on `zoneId` |
| `inbound-receiving` | `ASNRegistered`, `warehouse.inbound-receiving.events` | `asn_number`, `expected_arrival`, `lines` | Inserts the ASN into `AsnView` | Upsert on `asn_number` |
| `inbound-receiving` | `ASNCancelled`, `warehouse.inbound-receiving.events` | `asn_number` | Marks the ASN cancelled in `AsnView`; policy `CancelWhenAllAsnsCancelled` cancels an `INBOUND` `BOOKED` appointment whose ASNs are all cancelled, reason `ASN_CANCELLED` | A cancelled appointment is skipped |
| `process-path-management` | `CPTScheduleChanged`, `warehouse.process-path-management.events` | `site_id`, `timezone`, `cutoffs` | Stores the schedule in `CutoffView`; phase 2: policy `PickupFromCutoffs` keeps `OUTBOUND` appointments | Latest event per site wins (gap `DS-G05`) |
| `inbound-receiving` (stage A to D) | `DockAppointmentBooked`, `warehouse.inbound-receiving.events` | not listed | Policy `LegacyImport`: `ImportLegacyAppointment`, once per appointment (provenance `legacy-import`, direction `INBOUND`) | One import per legacy appointment (gap `DS-G08`) |
| `inbound-receiving` (stage A to D) | `DockAppointmentCheckedIn`, `warehouse.inbound-receiving.events` | not listed | Listed for the import; the model states no effect (gap `DS-G08`) | not stated |
| `inbound-receiving` (stage A to D) | `DockAppointmentCancelled`, `warehouse.inbound-receiving.events` | not listed | Listed for the import; the model states no effect (gap `DS-G08`) | not stated |
| `inbound-receiving` (stage A to D) | `DockAppointmentCompleted`, `warehouse.inbound-receiving.events` | not listed | Listed for the import; the model states no effect (gap `DS-G08`) | not stated |

Derived from: `model.yaml → contexts[dock-scheduling].consumes`, `.policies`,
`.read_models`, and the `data` of the producers' events in
`contexts[yard-management].publishes`.

The consumed `data` of `yard-management` events, as the model prints them:
`VisitCheckedIn` carries `visit_id`, `site_id`, `carrier`, `carrier_scac`,
`purpose`, `appointment_id`, `trailers`, `arrived_at`, `version`;
`TrailerDocked` carries `trailer_id`, `site_id`, `door_code`,
`appointment_id`, `asn_numbers`, `visit_id`, `docked_at`, `version`;
`TrailerUndocked` carries `trailer_id`, `site_id`, `door_code`,
`appointment_id`, `undocked_at`, `version`.

## Notes and gaps

- The consumed types of `facility-layout`, `inbound-receiving` and
  `process-path-management` are not printed in the model, and the fields of
  `LocationSlotDecommissioned` and of the legacy events are not listed
  (`DS-G18`).
- `yard-management` is told about `DockAppointmentBooked`, `Rescheduled`,
  `Cancelled` and `NoShow`, but not about the arrival tolerance that its
  policy `DirectOnCheckIn` uses (`DS-G01`).
- `VisitRejected` is published by `yard-management` for
  `exception-management` only; this context does not consume it
  (`DS-G02`).
- `DockAppointmentAtRisk` has no `version`, and nothing on the integration
  topic or in a REST read tells a client which appointments are at risk
  (`DS-G11`).
- `inbound-receiving` gets `Booked` and `Cancelled` only, though the model's
  `fleet_changes` says its local copy of appointments validates
  `Receipt.Open(appointment_id)` (`DS-G14`).
