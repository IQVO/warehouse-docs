---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for exception-management — one published topic plus its built analytics mirror (seven event types) through the transactional outbox, six consumed sibling topics, the correlation consumer, dead-lettering and the CloudEvents envelope.
---

# Async API

This page is written here from `apis/asyncapi.yaml`, the encoder and relay in
`internal/adapters/outbound/` and the consumers in
`internal/adapters/inbound/kafka/` on `exception-management`'s `develop`. The
machine-generated reference is at the bottom. For per-event payloads and the
raising use cases, see
[Domain Events](/contexts/exception-management/domain-events).

:::caution[Built on develop, not deployed]
`warehouse-infra` `develop` has no entry for this context, so no instance
publishes or consumes any topic below in the reference deployment. Every
consumed type now has a producer on an integration topic (the last four were
promoted on 2026-10-21), but nothing runs. The tables state what the code
does.
:::

## Topics

| Topic | Direction | Notes |
| --- | --- | --- |
| `warehouse.exception-management.events` | **Published** | Seven types from the two aggregates, written by the transactional outbox relay. Key = the case id (the source type for the policy event). |
| `warehouse.exception-management.analytics` | **Published** (own projector) | The same seven occurrences again (same `type`, same `id`, dataschema `...:analytics:...`). Not an integration contract: the only reader is the service's own analytics projector. |
| `warehouse.fulfillment.events` | Consumed | `TaskCPTMissed`, `PackageDiverted`, `WeightDiscrepancyDetected`, group from `FULFILLMENT_EXCEPTIONS_CONSUMER_GROUP`. |
| `warehouse.work-planning.events` | Consumed | Only `BacklogThresholdBreached`, group from `WORK_PLANNING_EXCEPTIONS_CONSUMER_GROUP`. |
| `warehouse.network-fulfillment.events` | Consumed | `AcknowledgementDeadlineAtRisk`, `OrphanedHoldCancelled`, group from `NETWORK_FULFILLMENT_EXCEPTIONS_CONSUMER_GROUP`. |
| `warehouse.order-management.events` | Consumed | Only `OrderRepromised`, group from `ORDER_CORRELATION_CONSUMER_GROUP` — never a case source; it is the correlated fact of the auto-resolve rule. |
| `warehouse.returns-processing.events` | Consumed | Only `UnexpectedReturnReceived`, group from `RETURNS_EXCEPTIONS_CONSUMER_GROUP`. |
| `warehouse.inventory.events` | Consumed | `DiscrepancyDetected`, `ItemUnlocated`, group from `INVENTORY_EXCEPTIONS_CONSUMER_GROUP`. |
| `<consumed topic>.dlq` | Published (dead letters) | One per consumed topic, after a transient failure exhausts its retries, or at once for an undecodable payload of a handled type. |

## The envelope

Every message is a CloudEvents 1.0 event in structured content mode, Kafka
header `content-type: application/cloudevents+json; charset=UTF-8`
(see the [Event Standard](/strategic-design/event-standard-cloudevents)).

| Attribute | Value |
| --- | --- |
| `source` | `/warehouse/exception-management` |
| `type` | `com.warehouse.wes.exception-management.<entity>.<EventName>`, with entity `exceptioncase` or `exceptionpolicy` |
| `subject` | the case id; the source type for the policy event |
| `time` | the domain occurred-at (UTC) |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:warehouse:exception-management:<events\|analytics>:<EventName>:v1` |
| Kafka key | the subject, so one case's history stays ordered on one partition |

`id` is a UUID minted once at encode time and stored with the outbox row, so a
relay retry republishes the same `id` and consumers dedupe on it. A breaking
payload change is a new `.v2` type and dataschema, never a mutation. Optional
W3C trace-context headers carry the trace of the request that wrote the outbox
row; consumers may extract them and must not require them.

## Publishing: the transactional outbox

Events leave only through the outbox: the aggregate row and its
already-encoded events commit in one Postgres transaction, and a relay drains
them to Kafka. Its ADR 0005 pins the relay's shape: delete-on-publish (a
published row is removed, not flagged), an attempt cap (`OUTBOX_MAX_ATTEMPTS`,
default 20; `0` is unlimited) after which a row is excluded until re-armed by
hand, and a per-topic dead-letter topic for rows that can never leave. The
relay interval is `OUTBOX_RELAY_INTERVAL` (default 1s). Delivery is
at-least-once with the same `id` on a retry.

## Consuming: open or touch, dedup, correlation

All six consumers dispatch on the full `type` and ignore every other type on
their topic. The CloudEvents `id` claim (`processed_events`) and the effect
run in one transaction, and the offset (`CommitMessages`) is committed only
afterwards, so a redelivery is a no-op. Anything that is not a valid
CloudEvent is WARN-logged and committed past; a payload that can never apply
is dead-lettered at once with `x-dlq-*` headers; a transient failure retries
with bounded backoff first; a cancelled context during shutdown never
dead-letters. A topic that does not exist yet (its producer ships later)
means retry logs, never unreadiness.

The exception facts open or touch by dedup key (source type, source subject,
site) with the payload frozen on the case. The correlation consumer applies
the auto-resolve rule: `OrderRepromised.order_id` is matched against the
order behind the open case's frozen `order_ref` work unit
(`{order_id}-line-{line_no}`, order-level, line ignored), the window edge is
inclusive (`now `<=` lastSeenAt + within_minutes`), and no match fails soft
(the case stays open). `rule_id` is the derived deterministic form
`<sourceType>-><onType>`.

Integration tests prove the consumers on real Kafka + Postgres
(testcontainers): open/touch under the declared policy, id-dedupe (a replayed
id with a tampered payload is a no-op), unknown-type ignore, flat envelope
committed past, poison dead-lettered with headers, offsets only after durable
effects, and an `OrderRepromised` auto-resolving a `TaskCPTMissed` case end
to end across both topics and groups.

## Machine-generated reference

The generated AsyncAPI documentation is on the
[API Reference](/api-reference/async/exception-management) page.
