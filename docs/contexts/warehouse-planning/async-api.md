---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for warehouse-planning — one published integration topic, its own analytics topic, three consumed topics, the CloudEvents envelope, and the state of each edge today.
---

# Async API

## Topics

| Topic | Direction | Messages | Status |
| --- | --- | --- | --- |
| `warehouse.warehouse-planning.events` | **Published** (this context is the exclusive publisher) | `CapacityPlanCreated`, `CapacityPlanPublished`, `CapacityShortageDetected`, `BottleneckDetected`, `ProcessCapacityRegistered`, `ProcessCapacityChanged` | **Live**. `order-management` consumes `CapacityPlanCreated`, `CapacityPlanPublished` and `CapacityShortageDetected` into a local read model (opt-in via `PLANNED_CAPACITY_CONSUMER_GROUP`, OM ADR 0031, set in the reference deployment); `BottleneckDetected` and the two `processcapacity` types have no consumer |
| `warehouse.workforce.events` | **Consumed** (producer: `workforce-management`) | `ShiftPlanCommitted` | **Live** |
| `warehouse.facility.events` | **Consumed** (producer: `facility-layout`) | `LocationSlotRegistered`, `LocationSlotDecommissioned` | **Live** |
| `warehouse.order-management.events` | **Consumed** (producer: `order-management`) | `OrderAllocated`, `OrderPartiallyAllocated` (every other type, `OrderRepromised` included, is ignored) | **Live**. Opt-in via `DEMAND_CONSUMER_GROUP` (ADR 0004; unset = no consumer), set in the reference deployment |
| `warehouse.inbound-receiving.events` | **Consumed** (producer: `inbound-receiving`) | `DockAppointmentBooked`, `DockAppointmentCancelled` (every other type is ignored) | **Live**. ADR 0017 Part A; group `warehouse-planning-inbound-demand` pinned in `warehouse-infra` `develop` |
| `warehouse.fulfillment.events` | **Consumed** (producer: `fulfillment-execution`) | `TaskCompleted` (every other type is ignored) | **Live**. ADR 0017 Part B (observed capacity); group `warehouse-planning-observed-capacity` pinned in `warehouse-infra` `develop` |
| `warehouse.warehouse-planning.analytics` | **Published** and consumed only by this context's own `planning-projector` (ADR 0005) | the four capacity-plan events only (the `processcapacity` types are integration-stream only), same `type` and `id`, `dataschema=urn:warehouse:warehouse-planning:analytics:<EventName>:v1`; `CapacityPlanPublished` adds `binding_constraint` | **Live** (internal, not an integration contract) |

`process-path-management`'s topic is deliberately **not** consumed (ADR 0001
Addendum).

## The envelope

Every message is CloudEvents 1.0 in structured content mode (Kafka header
`content-type: application/cloudevents+json; charset=UTF-8`) — the fleet-wide,
mandatory [Event Standard](/strategic-design/event-standard-cloudevents). Here
is `CapacityShortageDetected`:

```json
{
  "specversion": "1.0",
  "id": "3b2a1c0d-9e8f-4d7c-b6a5-4f3e2d1c0b9a",
  "source": "/warehouse/warehouse-planning",
  "type": "com.warehouse.wes.warehouse-planning.capacityplan.CapacityShortageDetected",
  "subject": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
  "time": "2026-10-04T21:45:10Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:warehouse-planning:events:CapacityShortageDetected:v1",
  "data": {
    "plan_id": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
    "warehouse_id": "WH-1",
    "location": "PATH-ZONE-A",
    "path_id": "pick-rebin-pack",
    "window_start": "2026-10-05T08:00:00Z",
    "window_end": "2026-10-05T16:00:00Z",
    "assigned_demand": 12000,
    "capacity_over_window": 8000,
    "shortage": 4000,
    "bottleneck_step": "REBIN"
  }
}
```

The `type` is `com.warehouse.wes.warehouse-planning.<entity>.<EventName>`; the
entity segment is `capacityplan` (the aggregate, lowercase, no separators).
`subject` and the Kafka message key are the capacity plan id. Quantities are
orders; `path_capacity` is orders per hour; times are RFC 3339 UTC.

## Publishing: the transactional outbox

There is no dual write. `CreateCapacityPlan` and `PublishCapacityPlan` each
save the plan and insert the already-encoded CloudEvents into `outbox_events`
in one unit of work: two rows per event, one for the integration topic and one
for the analytics topic. A relay in `cmd/api` drains the table (default every
`1s`, claiming rows `FOR UPDATE SKIP LOCKED`, sending one at a time in id
order, stopping at the first failure) — delivery is at-least-once and the
CloudEvents `id` is stable across redelivery. `EVENT_PUBLISHER=kafka|log`
selects the sink (default `log`, which marks rows published without reaching
Kafka). Kafka is dialled lazily by the relay's first send, never at boot.

## Consuming

| Consumed `type` | What it does |
| --- | --- |
| `com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted` | One message per `PathPlan` line becomes a `LABOR` constraint on the ProcessCapacity of process type = upper-case(`path_id`), location = `building_id`, rate = `planned_heads * planned_rate` (registered as `UNIT/HOUR`), window `[event time, event time + planned_hours)` |
| `com.warehouse.wms.facility-layout.locationslot.LocationSlotRegistered` | Tallied per `(zoneId, locationType)` as storage positions (role `Storage`), or per zone + activity as stations (role `WorkCenter`); registers **no** ProcessCapacity |
| `com.warehouse.wms.facility-layout.locationslot.LocationSlotDecommissioned` | Decrements the same tally |
| `com.warehouse.wes.order-management.order.OrderAllocated` | Upserts one row of the local expected-demand read model (`order_demand`, one row per order id): promise cutoff = `promise_date`, site = the configured `DEMAND_SITE_ID` (the event carries none); last writer wins per order on the CloudEvents `time`. Demand is counted in orders |
| `com.warehouse.wes.order-management.order.OrderPartiallyAllocated` | Same effect as `OrderAllocated` |
| `com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentBooked` | Upserts one row of `inbound_appointments` (door window, ASN count), site = `DEMAND_SITE_ID`; its labour is `minutes_per_appointment + minutes_per_asn x ASNs` from the declared `InboundLabourStandard`, composed at read time (ADR 0017) |
| `com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentCancelled` | Flips the row to `CANCELLED`; last writer wins on the event `time`, `Cancelled` wins a tie, a cancel that arrives first is stored as a tombstone |
| `com.warehouse.wes.fulfillment-execution.task.TaskCompleted` | Adds the completion to `observed_capacity`, one row per `(location, process_type, minute)` with `process_type` = upper-cased `task_type` (the process step) and location = `DEMAND_SITE_ID`; a `TaskCompleted` without `task_type` is dead-lettered. `GET /capacity-plans/{id}/variance` compares it with the plan's bottleneck step only when the caller supplies `tasks_per_order` (ADR 0017 Part B) |

Station capacity is composed at **read time** from the tally and an
operator-declared `StationStandard` (ADR 0002); registered windows are
resolved by **coverage** (ADR 0003).

Consumer rules: decode and validate the CloudEvent, dispatch on the **full**
`type`, ignore unknown types, dedupe on the CloudEvents `id`. Each message is
handled in one unit of work — the `processed_events` claim and the effect
commit or roll back together — and the offset is committed only after
success; transient failures retry the same message with capped exponential
backoff (200ms doubling to 5s), up to 5 attempts, after which the raw message
is dead-lettered to `<topic>.dlq` with `x-dlq-*` headers. Deterministic
problems (not a CloudEvent, unknown type, malformed payload) are skipped and
committed past, never retried or dead-lettered. Consumer group ids come from
env vars (`LABOR_CAPACITY_CONSUMER_GROUP`, `STORAGE_CAPACITY_CONSUMER_GROUP`,
`DEMAND_CONSUMER_GROUP`, `INBOUND_DEMAND_CONSUMER_GROUP`,
`OBSERVED_CAPACITY_CONSUMER_GROUP`; the chart requires the last two),
never a string literal. The analytics projector
(group `ANALYTICS_CONSUMER_GROUP`) never dead-letters a transient failure; it
dead-letters a known type with an unusable payload to
`warehouse.warehouse-planning.analytics.dlq`.

## Machine-generated reference

For the complete generated reference with every payload schema, see the
[AsyncAPI reference](/api-reference/async/warehouse-planning), generated from
[`apis/asyncapi.yaml`](https://github.com/IQVO/warehouse-planning/blob/develop/apis/asyncapi.yaml)
(a verbatim copy lives at `apis/warehouse-planning/asyncapi.yaml` in this
repository). See [Domain Events](./domain-events) for what each event means
and who consumes it.
