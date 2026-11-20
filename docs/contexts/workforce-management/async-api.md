---
id: async-api
title: Async API
sidebar_label: Async API
description: One integration topic out, two opt-in sibling topics in — the Kafka integrations of workforce-management, narrative form.
---

# Async API

One integration topic out (plus an internal analytics topic). Three sibling
topics in: two opt-in ones feeding in-memory caches, and
`warehouse-planning`'s labour plan, which is always on and kept in Postgres.
The synchronous calls this context makes (`fulfillment-execution`'s installed
capacity, and optionally `labor-performance` over HTTP) are covered on the
[Bounded Context Canvas](./bounded-context-canvas).

## What is published

| | |
| --- | --- |
| **Topic** | `warehouse.workforce.events` |
| **Protocol** | Kafka, via `github.com/segmentio/kafka-go` |
| **Event** | `ShiftPlanCommitted` — and only this one, today |
| **Trigger** | a successful `CommitShiftPlan` |
| **Fan-out** | one message per `PathPlan` line |
| **Adapter** | `internal/adapters/outbound/kafka/publisher.go` |
| **Consumers** | `wes-work-planning`, into its `LaborPlanObserved` read model, a pure projection keyed by `path_id`; `warehouse-planning`, as a `LABOR` capacity constraint per path line (group `warehouse-planning-labor-capacity`) and as the committed heads its `LabourPlanDriftDetected` compares with the labour plan (its ADR 0023). All live |

## Why asynchronous, and why one-way

`wes-work-planning` needs to know what labor was actually committed per path
in order to flow-balance. That fact is owned here — the question was only
how to get it there. Either synchronous direction is wrong: if Work Planning
called this service, a Core context would gain a runtime dependency on a
Supporting one, and a labor-service outage would become a planning outage.
If this service called Work Planning, a Supporting context would need a
client, retries, and knowledge of the consumer's availability — and would
gain a reason to fail a `CommitShiftPlan` that already succeeded in its own
domain. Publishing to Kafka and forgetting avoids both: nothing in this
edge needs a client, a retry, or knowledge of the consumer. (This context
does consume three *other* sibling topics and does make one fail-loud
synchronous read at commit time — see below and the
[Bounded Context Canvas](./bounded-context-canvas) — but none involves
`wes-work-planning`.)

## The publisher

The Kafka publisher is the only one: `EVENT_PUBLISHER` is `kafka` by default
and `log` is rejected at boot
([ADR 0038](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0038-postgres-and-kafka-are-the-only-runtime.md)).

| Variable | Default | Meaning |
| --- | --- | --- |
| `EVENT_PUBLISHER` | `kafka` | the only accepted value |
| `KAFKA_BROKERS` | `localhost:9092` | comma-separated broker list |

Delivery goes through a **transactional outbox**
([ADR 0016](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0016-transactional-outbox.md)):
the use case writes the already-encoded messages for both the integration
topic and the analytics topic (`warehouse.workforce.analytics`, all ten
events, consumed only by this service's own `cmd/workforce-projector`) into
`outbox_events` in the same Postgres transaction as the aggregate. A relay
goroutine drains that table onto Kafka every `OUTBOX_RELAY_INTERVAL`
(default `1s`). Store and topics cannot diverge; delivery is
at-least-once, per-key ordered.

## The fan-out

A `ShiftPlan` has multiple `PathPlan` lines. `CommitShiftPlan` with three
path lines publishes **three** Kafka messages, one per line, each carrying
that single line's `planned_heads`/`planned_rate`/`planned_hours` alongside
the plan's `building_id` and `shift_id`. This matches how the consumer keys
its read model — `LaborPlanObserved` is one row per path. Consumers must
expect N messages per commit and must not assume a message carries the
whole plan. The domain event carries only the `ShiftPlan`'s identity
(`buildingId`, `shiftId`); the adapter loads the committed plan through
`ShiftPlanRepo` to expand it, keeping fan-out an integration concern — the
domain has no opinion about message granularity.

## The envelope: CloudEvents 1.0 (mandatory)

Every message is a CloudEvents 1.0 event in structured content mode, per
the fleet-wide, mandatory [Event Standard](/strategic-design/event-standard-cloudevents), with Kafka header
`content-type: application/cloudevents+json; charset=UTF-8` and the
reverse-DNS `type` convention:

```
com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>
```

A committed shift plan's path line on the wire:

```json
{
  "specversion": "1.0",
  "id": "9f1c2b7e-4c3a-4a1d-9f0b-6c2b8a7d1e33",
  "source": "/warehouse/workforce-management",
  "type": "com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted",
  "subject": "WH1/SHIFT1",
  "time": "2026-08-21T22:00:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:workforce-management:events:ShiftPlanCommitted:v1",
  "data": {
    "site_code": "WH1",
    "building_id": "WH1",
    "shift_id": "SHIFT1",
    "path_id": "pack",
    "planned_heads": 3,
    "planned_rate": 50,
    "planned_hours": 24
  }
}
```

`id` is a UUID v4 minted once per domain event and persisted with the
outbox row (stable across redelivery); `time` is the domain occurred-at,
RFC 3339 UTC. `site_code` is the canonical Site code; `building_id` carries
the same value as a deprecated alias
([ADR 0035](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0035-sitecode-converges-building-id.md)).
The envelope is the only one in the fleet (no flat envelope, no dual-write,
no envelope toggle).

## Consuming this channel

- **Route on the full `type`** string. Do not switch on `subject`/`source`
  or on payload shape. Reject (skip, never parse) anything that is not a
  valid CloudEvent.
- **Tolerate unknown types.** The catalog will grow — see
  [Domain Events](./domain-events) for the nine events currently cataloged
  but not forwarded to this integration topic.
- **Expect N messages per commit** for `ShiftPlanCommitted`, one per path
  line.
- **Assume at-least-once delivery.** Kafka redelivers; consumers must be
  idempotent. The CloudEvents `id` is the deduplication key — `wes-work-planning`
  and `warehouse-planning` both use exactly this, each backed by its own
  `processed_events` table keyed by event id.

## What is deliberately not published

`LaborAssigned`, `LaborReassigned`, and `PathUnderstaffed` stay in-process.
Publishing individual assignment moves would let a downstream context
reconstruct a per-associate location feed — exactly the picture the
[path boundary](./business-context) exists to withhold. If a real downstream
need appears, the right answer is a read-model endpoint with a defined
shape, not a firehose of moves. The remaining `AssociateShift` events are
in-process for the simpler reason that nobody has asked: no sibling consumes
roster or break events today.

## What is consumed

Three sibling topics. Two are **opt-in** and used only to build an in-memory
cache that `cmd/workforce` rebuilds from the earliest offset on every
start:

| Topic | Events | Adapter | Selected by | Feeds |
| --- | --- | --- | --- | --- |
| `warehouse.process-path-management.events` | `ProcessPathCreated`/`Updated`/`Deactivated` | `internal/adapters/outbound/kafkacatalog` | `PATH_CATALOGUE_SOURCE=kafka` (default `file`) | Path-id validation on propose, commit, assign and staffing-gap ([ADR 0013](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0013-process-path-catalogue-validation.md)) |
| `warehouse.labor-performance.events` | `TaskPerformanceRecorded` (incl. the nullable `idle_seconds_before`) | `internal/adapters/outbound/laborperformancecache` | `LABOR_PERFORMANCE_MODE=kafka-cache` (default `permissive`) | Measured rates for `ProposePathPlan` ([ADR 0019](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0019-labor-performance-cache-consumer.md)); observed idle share for `GetStaffingGap` and the `ProposePathPlan` trim ([ADR 0020](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0020-idle-share-staffing-signal.md)) |

Both use a **per-process-unique consumer group** (prefix + host +
PID + timestamp), so every process replays the full history, and each waits
up to 60s for the replay to catch up before serving traffic. Both require
`KAFKA_BROKERS`; the `warehouse-infra` kind cluster turns both on. Neither
writes to Postgres.

### `warehouse.warehouse-planning.events` — `LabourPlanCommitted`, from `warehouse-planning`

The third consumer is **always on** (Kafka is part of the runtime,
[ADR 0038](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0038-postgres-and-kafka-are-the-only-runtime.md))
and keeps state in Postgres
([ADR 0043](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0043-propose-heads-from-the-published-labour-plan.md)).
It acts only on
`com.warehouse.wes.warehouse-planning.labourplan.LabourPlanCommitted`,
published by `warehouse-planning` per site, shift and path, and keeps
`labour_requirements`: one row per `(site_code, shift_id, path_id)` with
`planned_heads`, `rate_units_per_hour`, `hours`, `heads_source` and
`version`. A message is applied only when its `version` is greater than the
stored one; the wire `site_id` (a facility-layout site code) is stored as
`site_code`. The CloudEvents `id` claim and the upsert commit in one unit of
work. Other types on the topic are ignored.

- **Group.** The stable, shared `LABOUR_PLAN_CONSUMER_GROUP` (required;
  the chart's `labourPlan.consumerGroup` defaults to
  `workforce-management-labour-plans`). Only `cmd/workforce` consumes;
  `cmd/mcp` and `cmd/a2a` read the copy.
- **What it feeds.** `ProposePathPlan` takes `proposedHeads` from the copy
  when the request omits `charge` and names a `shiftId` (`rateSource`
  `labour-plan`; no row answers `404 labour-plan-not-found`). The staffing-gap
  lines and the committed shift-plan lines gain an optional `requiredHeads`.
  A request that sends `charge` still behaves as before, deprecated.
- **What it does not do.** `CommitShiftPlan` never refuses a line that
  differs from the requirement: committing fewer heads than required is a
  supply decision, and `warehouse-planning` surfaces the difference as
  `LabourPlanDriftDetected`.

Besides the analytics projector's `analytics_processed_events` (it consumes
this service's own analytics topic under the fixed group
`workforce-analytics`), this consumer keeps its own claim on the CloudEvents
`id` in Postgres.

## Generated reference

For the machine-generated AsyncAPI documentation — the complete ten-event
reference catalog rendered from the real `apis/asyncapi.yaml`, Spectral-linted
in CI — see [workforce-management's Generated API Reference](/api-reference/async/workforce-management).
