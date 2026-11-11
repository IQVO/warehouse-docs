---
id: event-standard-cloudevents
title: Event Standard (CloudEvents)
sidebar_label: Event Standard
description: "The CloudEvents type, source, topic and key convention for the yard contexts, and the full catalogue of published events."
---

# Event Standard (CloudEvents)

:::info[Generated from the model]
This page is generated from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/yard/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
:::

Spec: CloudEvents 1.0, structured JSON, mandatory on every Kafka message (fleet rule).

| Field | Rule |
| --- | --- |
| type | com.warehouse.\<subdomain>.\<context>.\<entity>.\<EventName> |
| subdomain | wms for both contexts (decision D2, as built) |
| entity_rule | `<entity>` is the lower-case aggregate that raises the event, no separators (dockappointment, dockcalendar, carrier, yardvisit, trailer, yardmove, yardcheck). |
| source | /warehouse/\<context> |
| dataschema | urn:warehouse:\<context>:events:\<EventName>:v1 on the integration topic, urn:warehouse:\<context>:analytics:\<EventName>:v1 on the analytics twin |
| subject | aggregate root id (also the Kafka partition key) |
| topic | warehouse.\<context>.events |
| analytics_topic | warehouse.\<context>.analytics |
| payload_case | snake_case (inbound-receiving precedent) |
| version_field | every event carries the aggregate `version` (starts 1, +1 per accepted change); readers apply only version > stored |

Site key: `site_id` on every yard event is facility-layout's `siteCode`. A door or spot is mapped to its site through LocationSlotRegistered.zoneId and ZoneRegistered\{zoneId, siteCode\}; never by parsing a location code.

Events marked `analytics only` go ONLY to warehouse.\<context>.analytics; integration events go to warehouse.\<context>.events and, as a twin with the same id, type, key and data, to warehouse.\<context>.analytics (one outbox row, up to two messages).

## `dock-scheduling` published events

| Event | CloudEvents type | Stream | Data | Consumers |
| --- | --- | --- | --- | --- |
| `DockAppointmentBooked` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentBooked` | integration + analytics | `appointment_id`, `site_id`, `direction`, `door_code`, `carrier`, `carrier_scac`, `window_start`, `window_end`, `asn_numbers`, `cpt_id`, `shipment_refs`, `expected_seal_number`, `arrival_tolerance_minutes`, `provenance`, `version`, `x12_status`, `cbv_biz_step`, `read_point_gln` | yard-management, warehouse-planning, inbound-receiving, outbound-shipping |
| `DockAppointmentRescheduled` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentRescheduled` | integration + analytics | `appointment_id`, `site_id`, `door_code`, `previous_door_code`, `window_start`, `window_end`, `previous_window_start`, `previous_window_end`, `arrival_tolerance_minutes`, `version`, `x12_status`, `cbv_biz_step`, `read_point_gln` | yard-management, warehouse-planning, inbound-receiving |
| `DockAppointmentCancelled` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentCancelled` | integration + analytics | `appointment_id`, `site_id`, `door_code`, `reason`, `version`, `x12_status`, `cbv_biz_step`, `read_point_gln` | yard-management, warehouse-planning, inbound-receiving |
| `DockAppointmentNoShow` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentNoShow` | integration + analytics | `appointment_id`, `site_id`, `door_code`, `direction`, `carrier_scac`, `window_end`, `version`, `x12_status`, `cbv_biz_step`, `read_point_gln` | yard-management, warehouse-planning, exception-management |
| `DockAppointmentCheckedIn` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentCheckedIn` | analytics only | `appointment_id`, `site_id`, `door_code`, `checked_in_at`, `arrival_status`, `visit_id`, `version`, `x12_status`, `cbv_biz_step`, `read_point_gln` | analytics only |
| `DockAppointmentDoorReassigned` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentDoorReassigned` | integration + analytics | `appointment_id`, `site_id`, `from_door_code`, `to_door_code`, `version`, `x12_status`, `cbv_biz_step`, `read_point_gln` | inbound-receiving |
| `DockAppointmentCompleted` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentCompleted` | analytics only | `appointment_id`, `site_id`, `door_code`, `completed_at`, `version`, `x12_status`, `cbv_biz_step`, `read_point_gln` | analytics only |
| `DockAppointmentAtRisk` | `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentAtRisk` | analytics only | `appointment_id`, `site_id`, `door_code`, `eta_at`, `window_start`, `window_end`, `cause`, `x12_status`, `cbv_biz_step`, `read_point_gln` | analytics only |
| `DoorClosureScheduled` | `com.warehouse.wms.dock-scheduling.dockcalendar.DoorClosureScheduled` | integration + analytics | `site_id`, `closure_id`, `door_code`, `from`, `to`, `reason`, `version`, `read_point_gln` | yard-management |
| `DoorClosureLifted` | `com.warehouse.wms.dock-scheduling.dockcalendar.DoorClosureLifted` | integration + analytics | `site_id`, `closure_id`, `door_code`, `version`, `read_point_gln` | yard-management |
| `DoorOperatingHoursDeclared` | `com.warehouse.wms.dock-scheduling.dockcalendar.DoorOperatingHoursDeclared` | analytics only | `site_id`, `door_code`, `operating_hours`, `version` | analytics only |
| `CarrierRegistered` | `com.warehouse.wms.dock-scheduling.carrier.CarrierRegistered` | integration + analytics | `scac`, `name`, `usdot`, `mc`, `status`, `reason`, `suspended_at`, `version`, `initiated_by` | none yet |
| `CarrierSuspended` | `com.warehouse.wms.dock-scheduling.carrier.CarrierSuspended` | integration + analytics | `scac`, `reason`, `suspended_at`, `version`, `initiated_by` | none yet |
| `CarrierReinstated` | `com.warehouse.wms.dock-scheduling.carrier.CarrierReinstated` | integration + analytics | `scac`, `reinstated_at`, `version`, `initiated_by` | none yet |

## `yard-management` published events

| Event | CloudEvents type | Stream | Data | Consumers |
| --- | --- | --- | --- | --- |
| `VisitCheckedIn` | `com.warehouse.wms.yard-management.yardvisit.VisitCheckedIn` | integration + analytics | `visit_id`, `site_id`, `carrier`, `carrier_scac`, `purpose`, `appointment_id`, `trailers`, `arrived_at`, `version` | dock-scheduling, inbound-receiving |
| `VisitRejected` | `com.warehouse.wms.yard-management.yardvisit.VisitRejected` | integration + analytics | `visit_id`, `site_id`, `carrier_scac`, `appointment_id`, `reason`, `rejected_at` | dock-scheduling, exception-management |
| `VisitCheckedOut` | `com.warehouse.wms.yard-management.yardvisit.VisitCheckedOut` | analytics only | `visit_id`, `site_id`, `trailers_out`, `departed_at`, `on_site_minutes`, `version` | analytics only |
| `TrailerDocked` | `com.warehouse.wms.yard-management.trailer.TrailerDocked` | integration + analytics | `trailer_id`, `site_id`, `door_code`, `appointment_id`, `asn_numbers`, `visit_id`, `docked_at`, `version`, `seal_state`, `seal_class`, `hazmat_class`, `un_number`, `requires_temperature_control` | dock-scheduling, outbound-shipping |
| `TrailerUndocked` | `com.warehouse.wms.yard-management.trailer.TrailerUndocked` | integration + analytics | `trailer_id`, `site_id`, `door_code`, `appointment_id`, `undocked_at`, `version` | dock-scheduling |
| `TrailerParked` | `com.warehouse.wms.yard-management.trailer.TrailerParked` | analytics only | `trailer_id`, `site_id`, `spot_code`, `version` | analytics only |
| `DoorWorkStarted` | `com.warehouse.wms.yard-management.trailer.DoorWorkStarted` | analytics only | `trailer_id`, `site_id`, `door_code`, `appointment_id`, `started_at`, `version` | analytics only |
| `DoorWorkCompleted` | `com.warehouse.wms.yard-management.trailer.DoorWorkCompleted` | integration + analytics | `trailer_id`, `site_id`, `door_code`, `appointment_id`, `completed_at`, `load_state`, `version` | outbound-shipping |
| `TrailerDeparted` | `com.warehouse.wms.yard-management.trailer.TrailerDeparted` | integration + analytics | `trailer_id`, `site_id`, `visit_id`, `departed_at`, `dwell_minutes`, `load_state`, `seal_number`, `version`, `seal_state`, `seal_class` | outbound-shipping |
| `TrailerSecured` | `com.warehouse.wms.yard-management.trailer.TrailerSecured` | integration + analytics | `trailer_id`, `site_id`, `door_code`, `method`, `secured_at`, `version` | none yet |
| `TrailerSecuringReleased` | `com.warehouse.wms.yard-management.trailer.TrailerSecuringReleased` | integration + analytics | `trailer_id`, `site_id`, `door_code`, `released_at`, `version` | none yet |
| `SealExceptionRaised` | `com.warehouse.wms.yard-management.trailer.SealExceptionRaised` | integration + analytics | `trailer_id`, `site_id`, `appointment_id`, `expected_seal_number`, `found_seal_number`, `raised_at` | exception-management |
| `TrailerDwellExceeded` | `com.warehouse.wms.yard-management.trailer.TrailerDwellExceeded` | integration + analytics | `trailer_id`, `site_id`, `kind`, `dwell_minutes`, `threshold_minutes`, `location_code` | exception-management |
| `TrailerHeld` | `com.warehouse.wms.yard-management.trailer.TrailerHeld` | analytics only | `trailer_id`, `site_id`, `reason`, `version` | analytics only |
| `TrailerHoldReleased` | `com.warehouse.wms.yard-management.trailer.TrailerHoldReleased` | analytics only | `trailer_id`, `site_id`, `version` | analytics only |
| `YardMoveRequested` | `com.warehouse.wms.yard-management.yardmove.YardMoveRequested` | analytics only | `move_id`, `site_id`, `trailer_id`, `appointment_id`, `performer`, `from_location`, `to_location`, `reason`, `due_by`, `version` | analytics only |
| `YardMoveClaimed` | `com.warehouse.wms.yard-management.yardmove.YardMoveClaimed` | analytics only | `move_id`, `site_id`, `hostler_ref`, `claimed_at`, `version` | analytics only |
| `YardMoveLeaseExpired` | `com.warehouse.wms.yard-management.yardmove.YardMoveLeaseExpired` | analytics only | `move_id`, `site_id`, `hostler_ref`, `version` | analytics only |
| `YardMoveCompleted` | `com.warehouse.wms.yard-management.yardmove.YardMoveCompleted` | analytics only | `move_id`, `site_id`, `trailer_id`, `performer`, `hostler_ref`, `from_location`, `to_location`, `actual_location`, `reason`, `completed_at`, `duration_seconds`, `version` | analytics only |
| `YardMoveCancelled` | `com.warehouse.wms.yard-management.yardmove.YardMoveCancelled` | analytics only | `move_id`, `site_id`, `reason`, `version` | analytics only |
| `YardCheckClosed` | `com.warehouse.wms.yard-management.yardcheck.YardCheckClosed` | integration + analytics | `yard_check_id`, `site_id`, `closed_at`, `discrepancies` | exception-management |

