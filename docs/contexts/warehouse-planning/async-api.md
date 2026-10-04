---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for warehouse-planning — one published topic, two consumed topics, the CloudEvents envelope, and the state of each edge today.
---

# Async API

## Topics

| Topic | Direction | Messages | Status |
| --- | --- | --- | --- |
| `warehouse.warehouse-planning.events` | **Published** (this context is the exclusive publisher) | `CapacityPlanCreated`, `CapacityPlanPublished`, `CapacityShortageDetected`, `BottleneckDetected` | Live publisher; **no live consumer** — `order-management` is planned / in progress |
| `warehouse.workforce.events` | **Consumed** (producer: `workforce-management`) | `ShiftPlanCommitted` | **Live** |
| `warehouse.facility.events` | **Consumed** (producer: `facility-layout`) | `LocationSlotRegistered`, `LocationSlotDecommissioned` | **Live** |

There is no analytics topic (`warehouse.warehouse-planning.analytics`) yet.
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
in one unit of work. A relay in `cmd/api` drains the table (default every
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

Station capacity is composed at **read time** from the tally and an
operator-declared `StationStandard` (ADR 0002); registered windows are
resolved by **coverage** (ADR 0003).

Consumer rules: decode and validate the CloudEvent, dispatch on the **full**
`type`, ignore unknown types, dedupe on the CloudEvents `id`. Each message is
handled in one unit of work — the `processed_events` claim and the effect
commit or roll back together — and the offset is committed only after
success; transient failures retry the same message with capped exponential
backoff (200ms doubling to 5s). Deterministic problems (not a CloudEvent,
unknown type, malformed payload) are skipped and committed past; there is no
DLQ yet. Consumer group ids come from env vars
(`LABOR_CAPACITY_CONSUMER_GROUP`, `STORAGE_CAPACITY_CONSUMER_GROUP`), never a
string literal.

## Machine-generated reference

For the complete generated reference with every payload schema, see the
[AsyncAPI reference](/api-reference/async/warehouse-planning), generated from
[`apis/asyncapi.yaml`](https://github.com/IQVO/warehouse-planning/blob/develop/apis/asyncapi.yaml)
(a verbatim copy lives at `apis/warehouse-planning/asyncapi.yaml` in this
repository). See [Domain Events](./domain-events) for what each event means
and who consumes it.
