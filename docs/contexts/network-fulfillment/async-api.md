---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for network-fulfillment — two published topics with no fleet consumer yet, two opt-in consumed topics, the CloudEvents envelope, and the state of each edge today.
---

# Async API

`network-fulfillment` is the anti-corruption layer between the fleet and an
external retail fulfillment network. Its conversation with that network and
with `order-management` is REST (see the [Context Map](/contexts/network-fulfillment/context-map));
Kafka carries its own `NetworkOrder` events out, and two optional caches read
other contexts' topics in.

## Topics

| Topic | Direction | Messages | Status |
| --- | --- | --- | --- |
| `warehouse.network-fulfillment.events` | **Published** (integration topic, this context is the only publisher) | `NetworkOrderReceived`, `NetworkOrderAcknowledged`, `NetworkOrderRejected`, `NetworkOrderShipmentConfirmed`, `AcknowledgementDeadlineAtRisk` | Published when `EVENT_PUBLISHER=kafka`. **No fleet consumer**: no other context's code or AsyncAPI on `develop` references this topic |
| `warehouse.network-fulfillment.analytics` | **Published and consumed** (own analytics stream) | The same occurrences as the integration topic (the spec's analytics channel lists the first four) | Read only by this context's own projector, `cmd/netfulfil-projector` |
| `warehouse.process-path-management.events` | **Consumed** (producer: `process-path-management`) | `ProcessPathCreated`, `ProcessPathUpdated`, `ProcessPathDeactivated`, `CPTScheduleChanged` | **Wired, opt-in** (`CAPABILITY_OFFER_ENABLED=true`, default off) |
| `warehouse.work-planning.events` | **Consumed** (producer: `wes-work-planning`) | `PathCapacityChanged` only; every other type on the topic is ignored | **Wired, opt-in** (`CAPABILITY_OFFER_ENABLED=true`, default off) |

With the default configuration this context consumes nothing from other
contexts. The two consumed topics feed the `CapabilityOffer` recompute (cycle
times, CPT schedule and remaining per-path capacity). The third input,
usable stock, is a REST call to `inventory-storage`, not a Kafka cache.
`fulfillment-execution`'s `PackageManifested` is deliberately **not**
consumed: shipment confirmation is an explicit REST endpoint (ADR 0014).

## The envelope

Every message is CloudEvents 1.0 in structured content mode (Kafka header
`content-type: application/cloudevents+json; charset=UTF-8`), the fleet-wide,
mandatory [Event Standard](/strategic-design/event-standard-cloudevents)
(this context's ADR 0008). Here is `NetworkOrderAcknowledged`, the example
from `apis/asyncapi.yaml`:

```json
{
  "specversion": "1.0",
  "id": "9f1c2b7e-4c3a-4a1d-9f0b-6c2b8a7d1e33",
  "source": "/warehouse/network-fulfillment",
  "type": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderAcknowledged",
  "subject": "po-1",
  "time": "2026-09-23T08:00:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:network-fulfillment:events:NetworkOrderAcknowledged:v1",
  "data": {
    "networkRef": "po-1",
    "siteId": "site-1",
    "localOrderId": "ord-1",
    "receivedAt": "2026-09-23T07:59:00Z",
    "at": "2026-09-23T08:00:00Z"
  }
}
```

The `type` is `com.warehouse.wes.network-fulfillment.networkorder.<EventName>`.
Every event comes from the `NetworkOrder` aggregate, so the entity segment is
always `networkorder`. `subject` and the Kafka message key are both the
`networkRef`, and writers use the hash balancer, so all of one order's events
land on the same partition (ADR 0005). The analytics occurrence keeps the same
`type`, `subject`, `time` and `data`. It gets its own `id` and the dataschema
`urn:warehouse:network-fulfillment:analytics:<EventName>:v1`.

## Publishing

Every event goes to **both** topics through `fanOutPublisher`
(`cmd/netfulfil/main.go`):

- `EVENT_PUBLISHER` unset or not `kafka`: a log-only publisher, so nothing
  reaches Kafka.
- `EVENT_PUBLISHER=kafka` with `DATABASE_URL` set: both occurrences go into
  `outbox_events` in the same Postgres transaction as the aggregate write
  (ADR 0003). An outbox relay claims rows `FOR UPDATE SKIP LOCKED` in id order
  (default every `1s`, `OUTBOX_RELAY_INTERVAL`, batches of 100). Delivery is
  at-least-once, and the encoded bytes are stored, so a redelivery carries the
  same CloudEvents `id`.
- `EVENT_PUBLISHER=kafka` without `DATABASE_URL` (in-memory dev mode): both
  topics are written directly, with no transaction to bind them to.

## Consuming

| Consumer | Topic | Consumer group | Behaviour |
| --- | --- | --- | --- |
| Analytics projector (`internal/adapters/inbound/kafka/analytics_consumer.go`) | `warehouse.network-fulfillment.analytics` | `network-fulfillment-analytics-<host>-<pid>-<ts>`, unique per process, from the first offset | Acts on `NetworkOrderReceived`, `NetworkOrderAcknowledged` and `NetworkOrderRejected`. Other types are committed past |
| Process-path capability cache (`internal/adapters/outbound/processpathcache`) | `warehouse.process-path-management.events` | `network-fulfillment-process-path-capability-cache-<host>-<pid>-<ts>`, full replay from the first offset | Keeps each path's `cycle_time_p95` and the site's CPT schedule in memory. Boot waits for the replay (`WaitReady`, 60s) |
| Path capacity cache (`internal/adapters/outbound/pathcapacitycache`) | `warehouse.work-planning.events` | `network-fulfillment-path-capacity-cache-<host>-<pid>-<ts>`, full replay from the first offset | Keeps remaining units per `(path_id, cutoff_at)`. Boot waits for the replay (`WaitReady`, 60s) |

All three consumers decode the CloudEvent first, dispatch on the **full**
`type` and ignore unknown types. They differ in how they handle failures:

- **Analytics projector.** Dedupes on the CloudEvents `id`
  (`MarkProcessed`). A message that is not a valid CloudEvent, such as a retired
  flat envelope, is dead-lettered at once to
  `warehouse.network-fulfillment.analytics.dlq`, with headers
  `x-dlq-source-topic`, `x-dlq-error` and `x-dlq-failed-at`. It is never retried
  and never parsed as a legacy shape. An infrastructure failure is retried up
  to 3 times per phase (mark-processed, then apply). The phases retry
  separately because the dedupe mark is not committed atomically with the
  projection write. When retries run out, the message is dead-lettered (ADR 0004).
- **The two capability caches.** These are replayable read models with no dedupe
  table. A non-CloudEvents message is logged at WARN and skipped, and a
  handling error is logged and skipped. There is no DLQ on these consumers.

## Machine-generated reference

For the complete generated reference with every payload schema, see the
[AsyncAPI reference](/api-reference/async/network-fulfillment), generated from
[`apis/asyncapi.yaml`](https://github.com/IQVO/network-fulfillment/blob/develop/apis/asyncapi.yaml)
(a copy lives at `apis/network-fulfillment/asyncapi.yaml` in this
repository). See [Domain events](/contexts/network-fulfillment/domain-events)
for each event's payload, producing use case and the known spec-versus-code
discrepancies.
