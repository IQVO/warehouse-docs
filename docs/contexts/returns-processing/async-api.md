---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for returns-processing — the integration topic (seven event types) and its analytics mirror through the transactional outbox, three consumed sibling topics feeding local copies, dead-lettering and the CloudEvents envelope.
---

# Async API

This page is written here from `apis/asyncapi.yaml`, the encoder and relay in
`internal/adapters/outbound/` and the consumers in
`internal/adapters/inbound/kafka/` on `returns-processing`'s `develop`. The
machine-generated reference is at the bottom. For per-event payloads and the
producing use cases, see
[Domain Events](/contexts/returns-processing/domain-events).

:::info[Built on develop, wired in warehouse-infra develop]
`warehouse-infra` `develop` registers this context (`terraform/apps.yaml`
entry `returns-processing`, `helm-values/returns-processing.yaml`): the API
pod with its outbox relay and all three consumer groups, the analytics
projector and reports, the read-only MCP server and the console remote.
Every consumed type has a live producer, and both consumers of this
context's own types are wired too (`inventory-storage` ADR 0044,
`exception-management` ADR 0003). The kind cluster itself was not checked
for this page. The tables state what the code does.
:::

## Topics

| Topic | Direction | Notes |
| --- | --- | --- |
| `warehouse.returns-processing.events` | **Published** | Seven types from the three aggregates, written by the transactional outbox relay. Key = the event's subject. `ReturnLineStaged` is the only type that asks a sibling to do something (inventory-storage books it as a staged receipt line); `UnexpectedReturnReceived` is what exception-management turns into a problem-solve case. |
| `warehouse.returns-processing.analytics` | **Published** (internal data product) | The same seven facts as `<EventName>Analytics` messages (ADR 0007), fanned out by the same outbox relay. Read only by this context's own `returns-projector`, the single writer of the separate analytics database behind `returns-reports`. |
| `warehouse.product-master.events` | Consumed | Only `ProductClassified` (key = the SKU), group from the required `PRODUCT_CLASSIFICATION_CONSUMER_GROUP`. Applied only when `version` is newer than the stored one. |
| `warehouse.order-management.events` | Consumed | Only `OrderAllocated` and `OrderPartiallyAllocated` (key = the order id), group from `ORDER_LINES_CONSUMER_GROUP`. The lines carry NO quantity; v1 caps the authorized quantity by the policy's `max_units_per_line`. |
| `warehouse.fulfillment.events` | Consumed | Only `PackageManifested` (key = the package id), group from `MANIFEST_CONSUMER_GROUP`. `order_ref` (a WES work unit id `{order_id}-line-{line_no}`) is reversed into the (order, line) key. |
| `<consumed topic>.dlq` | Published (dead letters) | One per consumed topic, after a transient failure exhausts its retries, or at once for an undecodable payload of a handled type. |

The analytics mirror `warehouse.returns-processing.analytics` is built
(ADR 0007, which fills the slot ADR 0004 reserved): `cmd/returns-projector`
projects it into a separate analytics database and `cmd/returns-reports`
serves read-only reports over it. No sibling consumes the analytics topic.

## The envelope

Every message is a CloudEvents 1.0 event in structured content mode, Kafka
header `content-type: application/cloudevents+json; charset=UTF-8`
(see the [Event Standard](/strategic-design/event-standard-cloudevents)).

| Attribute | Value |
| --- | --- |
| `source` | `/warehouse/returns-processing` |
| `type` | `com.warehouse.wms.returns-processing.<entity>.<EventName>`, with entity `returnauthorization`, `returnreceipt` or `disposition` |
| `subject` | rmaId, receiptId or dispositionId, per the raising aggregate |
| `time` | the domain occurred-at (UTC) |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:warehouse:returns-processing:events:<EventName>:v1` |
| Kafka key | the subject, so one aggregate's events stay ordered on one partition |

`id` is a UUID minted once at encode time and stored with the outbox row, so a
relay retry republishes the same `id` and consumers dedupe on it. A breaking
payload change is a new `.v2` type and dataschema, never a mutation. Optional
W3C trace-context headers carry the trace of the request that wrote the outbox
row; consumers may extract them and must not require them.

## Publishing: the transactional outbox

Events leave only through the outbox: the aggregate rows and their
already-encoded event rows commit in one Postgres transaction, and the relay
sends them to Kafka afterwards, so the effect and its facts are atomic and
delivery is at-least-once with a stable `id`. The shipped binary has no
in-memory runtime: `DATABASE_URL` and `KAFKA_BROKERS` are mandatory, and a
missing one is a boot error.

## Consuming: local copies

All three consumers dispatch on the full `type`, ignore every other type on
their topic, and dedupe on the CloudEvents `id`: the claim
(`processed_events`) and the effect run in one transaction, and the offset is
committed only afterwards, so a redelivery is a no-op. Anything that is not a
valid CloudEvent is logged at WARN and committed past — never retried, never
dead-lettered. A payload of a handled type that can never apply (undecodable
`data`, a blank required field) is deterministic poison and dead-lettered at
once; a transient failure retries the same message with bounded backoff before
dead-lettering. A context cancelled during shutdown never dead-letters: the
offset stays uncommitted and the message is redelivered after restart.

Integration tests prove all three on real Kafka + Postgres (testcontainers):
classifications apply/dedupe/version-gate, allocations carry every line under
one claim, manifests reverse `order_ref` (`ord-7c9e-line-3` ->
(`ord-7c9e`, 3)), and a package-id collision lands verbatim on the DLQ while
the message behind it still applies.

## Who consumes these events

- `inventory-storage` (ADR 0044): only `ReturnLineStaged`, group
  `RETURN_LINE_CONSUMER_GROUP`, into the same staged-receipt seam as an
  inbound receipt line. Every other type on the topic is ignored.
- `exception-management` (ADR 0003): only `UnexpectedReturnReceived`, group
  `RETURNS_EXCEPTIONS_CONSUMER_GROUP`, one problem-solve case per receipt line.

Both consumer groups are set in `warehouse-infra` `develop`
(`returnLineConsumerGroup` in `helm-values/inventory-storage.yaml`,
`returnsExceptionsConsumerGroup` in `helm-values/exception-management.yaml`),
so both edges are live by the fleet's status rule. See the fleet
[Context Map](/strategic-design/context-map) (edges K53 and K54).

## Machine-generated reference

The generated AsyncAPI documentation is on the
[API Reference](/api-reference/async/returns-processing) page.
