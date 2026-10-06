---
id: async-api
title: Async API — Narrative
sidebar_label: Async API — Narrative
description: The narrative version of inventory-storage's Kafka integration — topic, CloudEvents envelope, published events, consumers, and idempotency notes. See the generated reference for the full contract.
---

# Async API — Narrative

This page is the prose walkthrough of `inventory-storage`'s asynchronous
contract. The authoritative, machine-checked source is
`apis/asyncapi.yaml` (AsyncAPI 2.6.0), Spectral-linted in CI by the
`api-lint` job — everything below is drawn from it. For the full generated
reference (every message schema, in full), see
**[`/api-reference/async/inventory-storage`](/api-reference/async/inventory-storage)**.

## Topic

| | |
| --- | --- |
| **Topic** | `warehouse.inventory.events` |
| **Protocol** | Kafka |
| **Client library** | `github.com/segmentio/kafka-go` |
| **Balancer** | `Hash` on the Kafka key (the reservation id), `AllowAutoTopicCreation: true` — one reservation's events land on one partition, so they stay ordered per reservation (inventory-storage ADR-0021); there is no per-SKU ordering |
| **Broker** | `KAFKA_BROKERS`, default `localhost:9092` (shared broker at `~/warehouse-systems/docker-compose.kafka.yml`) |
| **Selected by** | `EVENT_PUBLISHER=kafka` (default is `log`, so tests and local runs never need a broker). With Postgres, events go through a transactional outbox (`outbox_events`, ADR-0017) drained by a relay in `cmd/inventory` |
| **Direction** | Publish on this topic. (Separately, this service consumes `ZoneRegistered`, `LocationSlotRegistered` and `LocationSlotDecommissioned` from `warehouse.facility.events` into its location-classification cache when `LOCATION_LOOKUP_MODE=kafka`, which the reference deployment sets; invalid messages go to `warehouse.facility.events.dlq` — see [Domain Events](/contexts/inventory-storage/domain-events), inventory-storage ADR-0013.) |
| **Primary consumer** | `wes-work-planning`, projecting into its own `UsableInventoryObserved` read model, keyed by SKU (per `wes-work-planning`, the projection feeds no decision yet) |
| **Default content type** | `application/cloudevents+json` |

There is a second, separate topic, `warehouse.inventory.analytics`, carrying
nine of the eleven domain events for this service's own analytical read model
(the Inventory Flow & Accuracy report). That topic has exactly one
consumer — this service's own `cmd/inventory-projector` — and is not part of
the cross-context integration contract described on this page.

## What events are on the topic

Only **two** of this context's eleven domain events are published on the
integration topic: `StockReserved` and `ReservationRevoked`. The integration
publisher's `Encode` returns nothing for every other event; seven of those
reach only the internal analytics topic, and `LocationRecorded` and
`ProductClassified` stay in-process. This is a
deliberate, small public surface — the internal model can evolve freely
because the wire contract only exposes two events, not all ten messages the
AsyncAPI catalog documents (`ProductClassified` is not in the catalog at
all). See [Domain Events](/contexts/inventory-storage/domain-events) for the
complete catalog and which topic each of the other nine reaches, if any.

## The envelope: CloudEvents 1.0 (mandatory)

Every message is a CloudEvents 1.0 event in structured content mode, per
the fleet-wide, mandatory [Event Standard](/strategic-design/event-standard-cloudevents). Kafka header
`content-type: application/cloudevents+json; charset=UTF-8`; context
attributes carry routing and identity; the business payload lives entirely
under `data`:

```json
{
  "specversion": "1.0",
  "id": "1f7a4c30-9b2d-4e85-a6c1-7d3f0b5e8a94",
  "source": "/warehouse/inventory-storage",
  "type": "com.warehouse.wms.inventory-storage.reservation.StockReserved",
  "subject": "res-1",
  "time": "2026-08-21T22:00:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:inventory-storage:events:StockReserved:v1",
  "data": { "sku": "SKU-1", "quantity": 5, "demand_ref": "order-42" }
}
```

| Attribute | Required | Value |
| --- | --- | --- |
| `specversion` | ✅ | Always `"1.0"` |
| `id` | ✅ | UUID v4 minted once per domain event and persisted with the outbox row (stable across redelivery). `(source, id)` is the deduplication key. |
| `source` | ✅ | Always `/warehouse/inventory-storage` |
| `type` | ✅ | Reverse-DNS event type, pinned per message |
| `subject` | ✅ | The aggregate instance the event is about — a reservation id, a stock unit id, or a bin id |
| `time` | ✅ | RFC 3339 UTC, taken from the injected `Clock` port — the time it occurred *in the domain*, not at publish |
| `datacontenttype` | ✅ | Always `application/json` |
| `dataschema` | ✅ | `urn:warehouse:inventory-storage:events:<EventName>:v1` (integration topic) or `urn:warehouse:inventory-storage:analytics:<EventName>:v1` (analytics topic) |

There is no flat envelope and no envelope toggle; consumers reject (skip,
never parse) any message that is not a valid CloudEvent.

## The `type` convention

The platform-wide convention:

```text
com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>
```

All lowercase except the final PascalCase event name. For this context,
`<subdomain>` is `wms` (Warehouse Management System, a Core subdomain);
`<bounded-context>` is `inventory-storage`; `<entity>` is the aggregate that
raises the event — `stock`, `reservation`, or `bin`. Each concrete message
pins `type` to a single enum value, so consumers can discriminate safely and
a typo fails validation instead of producing a silently-unrouted message.

## ReservationRevoked's enrichment, on the wire

The domain event `ReservationRevoked` carries only a `reservationId` — the
aggregate has no reason to repeat data the reservation already holds. But the
integration contract promises `{sku, quantity, demand_ref}`, because the
downstream projection is keyed by SKU and cannot afford a lookup. The Kafka
adapter bridges that gap by re-reading the reservation through
`ReservationRepo` at publish time, so the shape on the wire is identical to
`StockReserved`'s:

```json
{
  "specversion": "1.0",
  "id": "4b9e2f61-7c3a-4d08-85e2-1a6f9c0d3b72",
  "source": "/warehouse/inventory-storage",
  "type": "com.warehouse.wms.inventory-storage.reservation.ReservationRevoked",
  "subject": "res-1",
  "time": "2026-08-21T22:10:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:inventory-storage:events:ReservationRevoked:v1",
  "data": { "sku": "SKU-1", "quantity": 5, "demand_ref": "order-42" }
}
```

The use case saves the reservation before publishing, so this lookup always
succeeds in practice; the `ErrReservationNotFound` guard exists but is not an
expected path.

## Who consumes it

**`wes-work-planning`** is the one live consumer. It projects both events
into `UsableInventoryObserved`, a read model keyed by SKU: `StockReserved`
decrements the observed usable count, `ReservationRevoked` increments it
back. Because the two events are exact inverses, the downstream projection
stays trivially simple — one decrement, one increment.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant I as inventory-storage
    participant K as Kafka<br/>warehouse.inventory.events
    participant W as wes-work-planning

    C->>I: POST /reservations {sku, quantity, demandRef}
    I->>I: sum usable across StockUnits<br/>reserve first-fit, record Allocations
    I->>K: StockReserved {sku, quantity, demand_ref}
    K->>W: consume
    W->>W: dedupe on CloudEvents id (processed_events)
    W->>W: UsableInventoryObserved[sku] -= quantity

    Note over C,I: the physical pick fails
    C->>I: DELETE /reservations/{id}
    I->>I: Revoke() — release quantity back to each StockUnit
    I->>K: ReservationRevoked {sku, quantity, demand_ref}
    K->>W: consume
    W->>W: UsableInventoryObserved[sku] += quantity
```

## Idempotency and consumer-group notes

- **At-least-once delivery is every consumer's problem.** `wes-work-planning`
  deduplicates with a `processed_events` table keyed by the CloudEvents
  `id`, so a redelivery does not
  double-decrement or double-increment its usable count.
- **Ordering is per reservation, not per SKU.** The `Hash` balancer keys on
  the reservation id, so different reservations for the same SKU can land on
  different partitions. Acceptable for an increment/decrement projection,
  which tolerates reordering of independent events — but it is why the REST
  read remains authoritative.
- **Tolerate unknown `type` values.** The catalog grows as more
  of it is wired to the outbound adapter; a consumer that fails closed on an
  unrecognised type will break the first time that happens.
- **The authoritative answer is always the REST read.** The event stream is
  a convenience projection for keeping a cheap local view warm, not a
  substitute for `GET /inventory/{sku}/usable` when correctness matters.
- **A broker outage does not fail the request.** With Postgres and
  `EVENT_PUBLISHER=kafka`, the use case inserts the encoded events into
  `outbox_events` in the same transaction as the aggregate write (ADR-0017),
  and the relay delivers them at-least-once later. The CloudEvents `id` is
  persisted with the outbox row, so a redelivery carries the same `id`.
  Only the in-memory, no-database mode publishes straight to Kafka.

## Building another consumer

1. Read `apis/asyncapi.yaml`, not this page — it is the linted contract.
2. Only two events are on the integration topic; the document's other
   messages reach only the internal analytics topic, and each says which
   topics it reaches in its own description.
3. Deduplicate on the event id; do not assume ordering.
4. Treat the event stream as a projection — call `GET
   /inventory/{sku}/usable` for the authoritative answer.

## Full reference

The complete, generated AsyncAPI HTML — every message schema, in full, built
directly from `apis/asyncapi.yaml` — is at
**[`/api-reference/async/inventory-storage`](/api-reference/async/inventory-storage)**.
