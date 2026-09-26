---
id: async-api
title: Async API
sidebar_label: Async API
description: One integration topic out, two opt-in sibling topics in — the Kafka integrations of workforce-management, narrative form.
---

# Async API

One integration topic out (plus an internal analytics topic). Two sibling
topics in, both opt-in and both feeding in-memory caches only. The
synchronous calls this context makes (`fulfillment-execution`'s installed
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
| **Consumer** | `wes-work-planning`, into its `LaborPlanObserved` read model, keyed by `path_id` |

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
does consume two *other* sibling topics and does make one fail-loud
synchronous read at commit time — see below and the
[Bounded Context Canvas](./bounded-context-canvas) — but neither involves
`wes-work-planning`.)

## Selecting the publisher

The Kafka publisher is off by default. Both publishers implement the same
`ports.EventPublisher` interface, so nothing above the adapter layer knows
the difference.

| Variable | Default | Meaning |
| --- | --- | --- |
| `EVENT_PUBLISHER` | `log` | `log` (in-memory/log publisher) or `kafka` |
| `KAFKA_BROKERS` | `localhost:9092` | comma-separated broker list, used when `EVENT_PUBLISHER=kafka` |

The default keeps local runs and the whole test suite free of any broker
dependency.

With `EVENT_PUBLISHER=kafka`, delivery goes through a **transactional
outbox** ([ADR 0016](https://github.com/claudioed/workforce-management/blob/develop/docs/docs/adr/0016-transactional-outbox.md)):
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

## The envelope on the wire today

The shipped Kafka adapter writes the **flat cross-service envelope** every
`warehouse-systems` service shares, exactly as specified in this repo's own
`INTEGRATION.md`:

```json
{
  "event_id": "uuid-v4",
  "event_type": "ShiftPlanCommitted",
  "occurred_at": "2026-08-21T22:00:00Z",
  "source": "workforce-management",
  "data": {
    "building_id": "bldg-1",
    "shift_id": "shift-1",
    "path_id": "pack",
    "planned_heads": 3,
    "planned_rate": 30,
    "planned_hours": 24
  }
}
```

`event_id` is a UUID v4 generated at publish time; `source` is always this
service's own name; `occurred_at` is RFC 3339 UTC.

:::caution[The documented catalog and the wire format differ today]
`apis/asyncapi.yaml` documents this channel's **target** contract as a
CloudEvents 1.0 structured-mode envelope — `specversion`/`id`/`source`/
`type`/`subject`/`time`/`datacontenttype` at the top level, with a
reverse-DNS `type` convention:

```
com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>
```

So a committed shift plan's CloudEvents form would be:

```json
{
  "specversion": "1.0",
  "id": "9f1c2b7e-4c3a-4a1d-9f0b-6c2b8a7d1e33",
  "source": "/warehouse/workforce-management",
  "type": "com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted",
  "subject": "BLD1/SHIFT1",
  "time": "2026-08-21T22:00:00Z",
  "datacontenttype": "application/json",
  "data": {
    "building_id": "BLD1",
    "shift_id": "SHIFT1",
    "path_id": "pack",
    "planned_heads": 3,
    "planned_rate": 50,
    "planned_hours": 24
  }
}
```

The shipped adapter still writes the **flat envelope** shown above, because
that is what `wes-work-planning`'s consumer parses today. The `data`
payloads are identical between the two forms — only the surrounding context
attributes differ. This divergence is documented explicitly rather than
papered over; the migration path is to emit CloudEvents alongside the flat
envelope, move the consumer onto `type`-based routing, then drop the flat
shape. It has not been scheduled.
:::

## Consuming this channel

- **Route on `type`** (once on CloudEvents) or `event_type` (on the current
  flat envelope). Do not switch on `subject`/`source` or on payload shape.
- **Tolerate unknown types.** The catalog will grow — see
  [Domain Events](./domain-events) for the nine events currently cataloged
  but not forwarded to this integration topic.
- **Expect N messages per commit** for `ShiftPlanCommitted`, one per path
  line.
- **Assume at-least-once delivery.** Kafka redelivers; consumers must be
  idempotent. `event_id` (or `id`, once on CloudEvents) is the
  deduplication key — `wes-work-planning` uses exactly this, backed by a
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

Two sibling topics, both **opt-in**, both used only to build an in-memory
cache that `cmd/workforce` rebuilds from the earliest offset on every
start:

| Topic | Events | Adapter | Selected by | Feeds |
| --- | --- | --- | --- | --- |
| `warehouse.process-path-management.events` | `ProcessPathCreated`/`Updated`/`Deactivated` | `internal/adapters/outbound/kafkacatalog` | `PATH_CATALOGUE_SOURCE=kafka` (default `file`) | Path-id validation on propose, commit, assign and staffing-gap ([ADR 0013](https://github.com/claudioed/workforce-management/blob/develop/docs/docs/adr/0013-process-path-catalogue-validation.md)) |
| `warehouse.labor-performance.events` | `TaskPerformanceRecorded` (incl. the nullable `idle_seconds_before`) | `internal/adapters/outbound/laborperformancecache` | `LABOR_PERFORMANCE_MODE=kafka-cache` (default `permissive`) | Measured rates for `ProposePathPlan` ([ADR 0019](https://github.com/claudioed/workforce-management/blob/develop/docs/docs/adr/0019-labor-performance-cache-consumer.md)); observed idle share for `GetStaffingGap` and the `ProposePathPlan` trim ([ADR 0020](https://github.com/claudioed/workforce-management/blob/develop/docs/docs/adr/0020-idle-share-staffing-signal.md)) |

Both consumers use a **per-process-unique consumer group** (prefix + host +
PID + timestamp), so every process replays the full history, and each waits
up to 60s for the replay to catch up before serving traffic. Both require
`KAFKA_BROKERS`; the `warehouse-infra` kind cluster turns both on. Neither
writes to Postgres, so there is no `processed_events` table on the OLTP
side — the only dedupe table (`analytics_processed_events`) belongs to the
analytics projector, which consumes this service's own analytics topic
under the fixed group `workforce-analytics`.

## Generated reference

For the machine-generated AsyncAPI documentation — the complete ten-event
reference catalog rendered from the real `apis/asyncapi.yaml`, Spectral-linted
in CI — see [workforce-management's Generated API Reference](/api-reference/async/workforce-management).
