---
id: async-api
title: Async API
sidebar_label: Async API
description: The narrative Kafka integration for Fulfillment Execution — topics published and consumed, the envelope, and the shared fan-out topic two independent downstream consumers both read.
---

# Async API

This page is the narrative companion to the
[generated AsyncAPI reference](/api-reference/async/fulfillment-execution) —
what this context actually does with Kafka, in prose, including the gaps
between the published contract and the live wire format.

## Topics

| Direction | Topic | Event(s) | Adapter |
| --- | --- | --- | --- |
| Consume | `warehouse.work-planning.events` | `WorkReleased` | `internal/adapters/inbound/kafka/consumer.go` |
| Publish | `warehouse.fulfillment.events` | `TaskCompleted`, `TaskCPTMissed`, `PackageManifested` | `internal/adapters/outbound/kafka/publisher.go` |
| Consume (opt-in) | `warehouse.process-path-management.events` | process-path catalogue events | `internal/adapters/outbound/kafkacatalog` — only when `PATH_CATALOGUE_SOURCE=kafka` |

Client library on both sides: `github.com/segmentio/kafka-go` (pure Go, no
cgo). Broker list comes from `KAFKA_BROKERS`, default `localhost:9092` — the
shared platform broker in the `warehouse-infra` kind cluster, exposed on the
host. This repository's own `docker-compose.yml` deliberately defines only
Postgres.

## Consuming: `WorkReleased`

The flat platform envelope shared across the fleet's integrating services:

```json
{
  "event_id": "uuid-v4",
  "event_type": "WorkReleased",
  "occurred_at": "2026-08-21T22:00:00Z",
  "source": "wes-work-planning",
  "data": {
    "path_id": "pick-zone-a",
    "work_unit_id": "wu-8a1f",
    "cpt": "2026-08-23T18:00:00Z",
    "ref": "order-4471",
    "fragile": false,
    "gift_wrap": false
  }
}
```

`fragile` and `gift_wrap` are optional packing hints (default `false`).

The consumer filters on `event_type == "WorkReleased"` and silently ignores
everything else on the topic, then translates at the boundary (the
Anti-Corruption Layer) rather than deserialising into a shared type:

| From `WorkReleased.data` | Becomes | Via |
| --- | --- | --- |
| `path_id` | `task.Type` | process-path catalogue lookup, longest `matchPrefix` wins (case-insensitive); an unknown id is a **hard error**, not a silent `PICK` |
| `work_unit_id` | `shared.OrderRef` | direct |
| `cpt` | `shared.CPT` | RFC 3339 timestamp |
| *(from the matched path)* | `shared.CapabilitySet` | the path definition's `requiredCapabilities` |
| `fragile` / `gift_wrap` | `Task.Fragile` / `Task.GiftWrap` | direct, default `false` |
| `ref` | *(unused)* | decoded but not mapped — `work_unit_id` is the correlation key |

The catalogue comes from `PATH_CATALOGUE_SOURCE`: `file` (default) loads
`PATH_CATALOGUE_FILE` once at boot; `kafka` replays
`warehouse.process-path-management.events` into memory and follows live
changes
([ADR-0017](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0017-process-path-catalogue-as-configuration.md)).
The retired prefix-guessing convention is gone.

The consumer then calls the **existing** `CreateTask` use case — no
parallel code path exists for the Kafka-originated flow. Idempotency:
`ProcessedEvents.MarkProcessed(ctx, event_id)` runs before task creation,
returning `true` only if this call newly recorded the id, so redelivery
(Kafka is at-least-once) produces no duplicate task. A handling error is
logged and the loop continues — there is no dead-letter queue today, a
deliberate simplicity trade at this stage. Consumer group:
`WORK_RELEASED_CONSUMER_GROUP` (default `fulfillment-execution`); a second
process on the shared broker must set a unique value.

## Publishing: `TaskCompleted`

```json
{
  "event_id": "uuid-v4",
  "event_type": "TaskCompleted",
  "occurred_at": "2026-08-22T14:04:00Z",
  "source": "fulfillment-execution",
  "data": {
    "task_id": "task-8a1f",
    "station_id": "station-03",
    "work_unit_id": "wu-8a1f",
    "associate_id": "assoc-42",
    "duration_seconds": 187,
    "task_type": "PICK"
  }
}
```

The domain event carries only `TaskId` and `StationId`; the Kafka publisher
enriches the wire payload at publish time via repository lookups —
`work_unit_id` from `TaskRepo.FindById(...).OrderRef()`, `associate_id` from
`StationRepo.FindById(...).Occupant()`, and `duration_seconds` computed
from the same `Task`'s `ClaimedAt()`, and `task_type` read straight off the
loaded `Task`
([ADR-0023](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0023-task-type-on-wire.md)). Message key is the task id, so all
events for one task land on the same partition and preserve order.
`associate_id` is omitted when the station has no checked-in occupant;
`duration_seconds` is `0` when `ClaimedAt()` is `nil` (a pre-migration
task) — both degrade gracefully rather than failing the publish.

## Publishing: `TaskCPTMissed` and `PackageManifested`

Added by
[ADR-0025](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0025-cpt-missed-sweep-and-package-manifested.md)
as this service's half of order-management's promise feedback loop. Same
topic, same flat envelope, same publisher:

| `event_type` | `data` | Raised when |
| --- | --- | --- |
| `TaskCPTMissed` | `task_id`, `order_ref`, `task_type`, `cpt` | `POST /tasks/sweep-cpt-misses` finds a task still open (Pending or Claimed) at or past its CPT; re-fires every pass while overdue. Nothing inside this service schedules the sweep. |
| `PackageManifested` | `package_id`, `order_ref` | SLAM passes, alongside `LabelApplied` |

Every field comes straight off the domain event — no repository enrichment.
`order-management`'s `RepromiseOrder` consumer keys on `order_ref`.
`PackageManifested` is also the evidence for the on-time-to-CPT KPI on this
service's throughput analytics data product
([ADR-0026](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0026-on-time-to-cpt-kpi.md)).

With `EVENT_PUBLISHER=kafka` and a `DATABASE_URL`, all three published
events go through the transactional outbox — written in the same
transaction as the aggregate, relayed by an in-process relay to both the
integration and analytics topics
([ADR-0020](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0020-transactional-outbox.md)).

## A shared fan-out topic, three independent consumers

`warehouse.fulfillment.events` is published to **once**, but read by
**three different bounded contexts**, each subscribing independently and
each filtering by `event_type`:

```mermaid
flowchart LR
    FE["fulfillment-execution<br/>publishes once"] ==> T[("warehouse.fulfillment.events<br/>TaskCompleted · TaskCPTMissed · PackageManifested")]
    T ==>|"filters event_type == TaskCompleted<br/>reads work_unit_id"| WP["wes-work-planning<br/>RecordCompletion(workUnitId)"]
    T ==>|"filters event_type == TaskCompleted<br/>reads associate_id, duration_seconds"| LP["labor-performance<br/>scores actual-vs-standard"]
    T ==>|"filters TaskCPTMissed / PackageManifested<br/>reads order_ref"| OM["order-management<br/>RepromiseOrder"]
```

- **`wes-work-planning`** consumes it to close the drum-buffer-rope feedback
  loop: Execution → Orchestration. It reads `work_unit_id` and calls its
  own `RecordCompletion(workUnitId)`.
- **`labor-performance`** consumes the *same* event from the *same* topic,
  independently, as a pure Conformist downstream reader with zero write
  access back to this service. It reads `associate_id` and
  `duration_seconds` to score actual-vs-standard task performance.
- **`order-management`** consumes `TaskCPTMissed` and `PackageManifested`
  to re-promise orders whose work missed, or made, its CPT.

This is a deliberate choice, not an accident: `labor-performance` could
instead poll a new `GET /tasks/{id}/completion-details`-style endpoint, but
that would duplicate the completion signal across two mechanisms that could
disagree, and would add a new synchronous inbound dependency onto this
service's completion path. Enriching the one existing event both consumers
already have to read keeps the coupling one-way and event-driven — this
service publishes what it knows, once, at the moment it knows it, and each
downstream reader takes only the fields it needs.

## CloudEvents target contract vs. the live wire format

:::warning[Contract vs. current wire format]
`apis/asyncapi.yaml` specifies the CloudEvents 1.0 structured envelope
(`specversion` / `id` / `source` / `type` / `subject` / `time` /
`datacontenttype` / `data`) on channel
`warehouse.fulfillment-execution.events`, with `type` following:

```
com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>
```

e.g. `com.warehouse.wes.fulfillment-execution.task.TaskCompleted`.

The Kafka publisher in `internal/adapters/outbound/kafka/publisher.go`
today writes the **older flat platform envelope** shown above to topic
**`warehouse.fulfillment.events`** — and that is what `wes-work-planning`,
`labor-performance` and `order-management` actually read. The AsyncAPI
document describes the target contract; the code has not migrated to it
yet. Both the channel name and the envelope shape differ. This is stated
plainly rather than papered over.
:::

## See also

For the exact generated schema, message examples, and channel bindings,
see the [Generated API Reference](/api-reference/async/fulfillment-execution),
built directly from this context's own `apis/asyncapi.yaml`.
