---
id: async-api
title: Async API
sidebar_label: Async API
description: The narrative Kafka integration for Fulfillment Execution — topics published and consumed, the envelope, the RELOCATE work and its additive TaskCompleted fields, and the shared fan-out topic several independent downstream consumers read.
---

# Async API

This page is the narrative companion to the
[generated AsyncAPI reference](/api-reference/async/fulfillment-execution) —
what this context actually does with Kafka, in prose. Every message is a
CloudEvents 1.0 event (structured mode, header
`content-type: application/cloudevents+json; charset=UTF-8`) per the
fleet-wide, mandatory [Event Standard](/strategic-design/event-standard-cloudevents).

## Topics

| Direction | Topic | Event(s) | Adapter |
| --- | --- | --- | --- |
| Consume | `warehouse.work-planning.events` | `WorkReleased` (including `RELOCATE` work, which carries a `relocation` object, ADR-0047) | `internal/adapters/inbound/kafka/consumer.go` |
| Publish | `warehouse.fulfillment.events` | `TaskCompleted` (with additive RELOCATE fields), `TaskCPTMissed`, `PackageManifested`, and the transfer facts | `internal/adapters/outbound/kafka/publisher.go` |
| Publish (internal) | `warehouse.fulfillment.analytics` | ten event types (all but `TaskCPTMissed` and the two Rebin events), consumed only by this service's `cmd/fulfillment-projector` | `internal/adapters/outbound/kafka/analytics_publisher.go` |
| Consume (opt-in) | `warehouse.process-path-management.events` | process-path catalogue events | `internal/adapters/outbound/kafkacatalog` — only when `PATH_CATALOGUE_SOURCE=kafka` |
| Consume (opt-in) | `warehouse.product-master.events` | `ProductClassified` only, into the `product_classification_copy` table read per scanned SKU at seal time for DOT segregation ([ADR-0039](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0039-product-classification-local-copy.md)) | `internal/adapters/inbound/kafka/product_classified_consumer.go`, `internal/adapters/outbound/productclassificationcopy` — only when `PRODUCT_CLASSIFICATION_MODE=kafka`, group `PRODUCT_CLASSIFICATION_CONSUMER_GROUP`; set in the reference deployment. `http` (the former REST lookup to `inventory-storage`) fails the boot |

Client library on both sides: `github.com/segmentio/kafka-go` (pure Go, no
cgo). Broker list comes from `KAFKA_BROKERS`, default `localhost:9092` — the
shared platform broker in the `warehouse-infra` kind cluster, exposed on the
host. This repository's own `docker-compose.yml` deliberately defines only
Postgres.

## Consuming: `WorkReleased`

The CloudEvents 1.0 envelope shared by every service in the fleet:

```json
{
  "specversion": "1.0",
  "id": "uuid-v4",
  "source": "/warehouse/wes-work-planning",
  "type": "com.warehouse.wes.work-planning.workunit.WorkReleased",
  "subject": "wu-8a1f",
  "time": "2026-08-21T22:00:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:wes-work-planning:events:WorkReleased:v1",
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

The consumer validates the CloudEvent, filters on the full
`type == "com.warehouse.wes.work-planning.workunit.WorkReleased"` and
silently ignores every other type on the topic (a message that is not a
valid CloudEvent is a poison message: never retried, never parsed as a
legacy shape, dead-lettered), then translates at the boundary (the
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
([ADR-0017](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0017-process-path-catalogue-as-configuration.md)).
The retired prefix-guessing convention is gone.

The consumer then calls the **existing** `CreateTask` use case — no
parallel code path exists for the Kafka-originated flow. Idempotency:
`ProcessedEvents.MarkProcessed(ctx, id)` (the CloudEvents `id`) runs before task creation,
returning `true` only if this call newly recorded the id, so redelivery
(Kafka is at-least-once) produces no duplicate task. A handling error is
retried in process (3 attempts in total, exponential backoff); after that,
or immediately for a non-CloudEvent, the raw message is dead-lettered to
`warehouse.work-planning.events.dlq` with `x-dlq-*` headers when
`EVENT_PUBLISHER=kafka` wires the DLQ writer, and the loop continues. Consumer group:
`WORK_RELEASED_CONSUMER_GROUP` (default `fulfillment-execution`); a second
process on the shared broker must set a unique value.

### `WorkReleased` for a slot-plan move: the `relocation` object

Work that `wes-work-planning` releases on the `RELOCATE` path (one work unit
per move of an approved slot plan, its ADR-0040) is an ordinary `WorkReleased`
v1 with one more optional, nested object
([ADR-0047](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0047-relocate-tasks-execute-slot-plan-moves.md)):

```json
{
  "path_id": "RELOCATE",
  "work_unit_id": "plan-7-move-3",
  "cpt": "2026-10-15T12:00:00Z",
  "ref": "plan-7",
  "relocation": {
    "plan_id": "plan-7",
    "move_seq": 3,
    "kind": "Assign",
    "sku": "SKU-1",
    "to_bin": "WH1-FWD-A01-01-01-A"
  }
}
```

| `relocation` field | Required | Meaning |
| --- | --- | --- |
| `plan_id` | yes | the slot plan id |
| `move_seq` | yes (an absent value is rejected, not read as 0) | the move's 0-based position in `SlotPlanApproved.moves` |
| `kind` | yes | `Relocate`, `Assign` or `Vacate`, exact case |
| `sku` | yes | the SKU to move |
| `from_bin` | `Relocate` and `Vacate` | omitted for an `Assign`: the operator scans the source |
| `to_bin` | `Relocate` and `Assign` | omitted for a `Vacate`: the operator scans the reserve destination |

The consumer turns it into a `RELOCATE` task (type `RELOCATE`, capability
`relocate` from the catalogue, never created through `POST /tasks`) carrying
the planned move, shown on the task read model and the MCP
`find_claimable_work` tool. The object is validated: a missing `move_seq`, an
unknown `kind`, a bin the kind requires but lacks, equal bins, a blank
`plan_id` or `sku`, `RELOCATE`-path work without the object, or the object on
any other path is dead-lettered to `warehouse.work-planning.events.dlq` and no
task is created. `ref` (the plan id) is not stored.

## Publishing: `TaskCompleted`

```json
{
  "specversion": "1.0",
  "id": "uuid-v4",
  "source": "/warehouse/fulfillment-execution",
  "type": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
  "subject": "task-8a1f",
  "time": "2026-08-22T14:04:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:fulfillment-execution:events:TaskCompleted:v1",
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
([ADR-0023](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0023-task-type-on-wire.md)). Message key is the task id, so all
events for one task land on the same partition and preserve order.
`associate_id` is omitted when the station has no checked-in occupant;
`duration_seconds` is `0` when `ClaimedAt()` is `nil` (a pre-migration
task) — both degrade gracefully rather than failing the publish.

Two groups of optional, additive fields keep the event at v1:

- `order_ref` and `line_no` (ADR-0040, ADR-0041): the order and order line a
  `PICK` belongs to, so `inventory-storage` can confirm exactly that line's
  reservation. They are omitted when unknown.
- **RELOCATE only** (ADR-0047): when a `RELOCATE` task completes, `data` also
  carries `sku`, `from_bin`, `to_bin`, `quantity` and `relocation_ref`. The
  operator confirms the quantity (the whole on-hand count of the SKU at the
  source bin in v1) and scans the open side of an `Assign` (source) or a
  `Vacate` (destination), so these are what actually moved, not just what was
  planned. `relocation_ref` is `<plan_id>:<move_seq>`, copied from
  `WorkReleased.data.relocation`. Every other task type omits all five.

```json
{
  "specversion": "1.0",
  "id": "uuid-v4",
  "source": "/warehouse/fulfillment-execution",
  "type": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
  "subject": "task-rel-1",
  "time": "2026-10-15T09:30:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:fulfillment-execution:events:TaskCompleted:v1",
  "data": {
    "task_id": "task-rel-1",
    "station_id": "station-07",
    "work_unit_id": "plan-7-move-3",
    "task_type": "RELOCATE",
    "sku": "SKU-1",
    "from_bin": "WH1-STOR-AMB-A07-03-02-B",
    "to_bin": "WH1-FWD-A01-01-01-A",
    "quantity": 12,
    "relocation_ref": "plan-7:3"
  }
}
```

Completing a `RELOCATE` task takes those inputs on `POST /tasks/{id}/complete`
(`quantity`, `fromBin`, `toBin`) and the MCP `complete_task` tool; without
them the completion is refused with a `422` (`relocation-confirmation-required`,
`invalid-relocation-confirmation`, or `not-relocation-task` for a task of
another type). `inventory-storage` applies the event as a stock move and raises
`StockRelocated` (its ADR-0039); `wes-work-planning` reads `work_unit_id` as
for any task, which also releases the moves of the same plan that waited on
this one.

## Publishing: `TaskCPTMissed` and `PackageManifested`

Added by
[ADR-0025](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0025-cpt-missed-sweep-and-package-manifested.md)
as this service's half of order-management's promise feedback loop. Same
topic, same CloudEvents envelope, same publisher:

| `type` | `data` | Raised when |
| --- | --- | --- |
| `com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed` | `task_id`, `order_ref`, `task_type`, `cpt` | `POST /tasks/sweep-cpt-misses` finds a task still open (Pending or Claimed) at or past its CPT; re-fires every pass while overdue. Nothing inside this service schedules the sweep. |
| `com.warehouse.wes.fulfillment-execution.package.PackageManifested` | `package_id`, `order_ref` | SLAM passes, alongside `LabelApplied` |

Every field comes straight off the domain event — no repository enrichment.
`order-management`'s `RepromiseOrder` consumer keys on `order_ref`.
`PackageManifested` is also the evidence for the on-time-to-CPT KPI on this
service's throughput analytics data product
([ADR-0026](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0026-on-time-to-cpt-kpi.md)).

With `EVENT_PUBLISHER=kafka` and a `DATABASE_URL`, all three published
events go through the transactional outbox — written in the same
transaction as the aggregate, relayed by an in-process relay to both the
integration and analytics topics
([ADR-0020](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0020-transactional-outbox.md)).

## A shared fan-out topic, four independent consumers

`warehouse.fulfillment.events` is published to **once**, but read by
**four different bounded contexts**, each subscribing independently and
each filtering by the full CloudEvents `type`:

```mermaid
flowchart LR
    FE["fulfillment-execution<br/>publishes once"] ==> T[("warehouse.fulfillment.events<br/>TaskCompleted · TaskCPTMissed · PackageManifested")]
    T ==>|"filters type …task.TaskCompleted<br/>reads work_unit_id"| WP["wes-work-planning<br/>RecordCompletion(workUnitId)"]
    T ==>|"filters type …task.TaskCompleted<br/>reads associate_id, duration_seconds"| LP["labor-performance<br/>scores actual-vs-standard"]
    T ==>|"filters TaskCPTMissed / PackageManifested<br/>reads order_ref"| OM["order-management<br/>RepromiseOrder"]
    T ==>|"filters type …task.TaskCompleted<br/>PICK confirms a reservation, RELOCATE moves stock"| IS["inventory-storage<br/>confirm-pick, RelocateStock"]
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
- **`inventory-storage`** consumes `TaskCompleted` (opt-in,
  `TASK_COMPLETED_CONSUMER_MODE=kafka`, set in the reference deployment). For a
  `PICK` it reads `order_ref` and `line_no` to confirm the picked line's
  reservation (its ADR-0035 and ADR-0036). For a `RELOCATE` task it reads
  `sku`, `from_bin`, `to_bin`, `quantity` and `relocation_ref` and moves the
  stock between the two bins (its ADR-0039).

This is a deliberate choice, not an accident: `labor-performance` could
instead poll a new `GET /tasks/{id}/completion-details`-style endpoint, but
that would duplicate the completion signal across two mechanisms that could
disagree, and would add a new synchronous inbound dependency onto this
service's completion path. Enriching the one existing event both consumers
already have to read keeps the coupling one-way and event-driven — this
service publishes what it knows, once, at the moment it knows it, and each
downstream reader takes only the fields it needs.

## The `type` convention

```
com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>
```

e.g. `com.warehouse.wes.fulfillment-execution.task.TaskCompleted`, on topic
`warehouse.fulfillment.events`. The same `type` names the occurrence on the
analytics topic `warehouse.fulfillment.analytics`; `dataschema`
(`urn:warehouse:fulfillment-execution:<events|analytics>:<EventName>:v1`)
names the payload shape. The publisher emits only CloudEvents and every
consumer accepts only CloudEvents; there is no other envelope
([ADR-0032](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0032-cloudevents-mandatory-envelope.md)).

## See also

For the exact generated schema, message examples, and channel bindings,
see the [Generated API Reference](/api-reference/async/fulfillment-execution),
built directly from this context's own `apis/asyncapi.yaml`.
