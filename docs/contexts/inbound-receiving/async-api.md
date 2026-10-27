---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for inbound-receiving — one published integration topic with eleven events, the internal analytics stream, the ReceiptLineReceived handover that inventory-storage books, the carton-level facts, three local-copy consumers and the CloudEvents envelope.
---

# Async API

This page is written here from `apis/asyncapi.yaml`, the encoder and the
consumers on `inbound-receiving`'s `develop`, and the consumer code on
`inventory-storage`'s `develop`. The machine-generated reference is at the
bottom. For per-event payloads, producer use cases and consumers, see
[Domain Events](/contexts/inbound-receiving/domain-events).

## Topics

| Topic | Direction | Notes |
| --- | --- | --- |
| `warehouse.inbound-receiving.events` | **Published** | Eleven events from the `Asn`, `DockAppointment` and `Receipt` aggregates (the carton-level `ReceiptCartonReceived` and `CartonDiscrepancyRaised` included), written by the transactional outbox relay. |
| `warehouse.product-master.events` | Consumed | `ProductRegistered`, into the `known_skus` local copy (started only when `PRODUCT_MODE=kafka`, group from `PRODUCT_CONSUMER_GROUP`), and `ProductPackLevelDeclared` / `ProductPackLevelRetired` into the local packaging view (its own consumer, group `packagingConsumerGroup` in `warehouse-infra`). |
| `warehouse.facility.events` | Consumed | Only `LocationSlotRegistered` and `LocationSlotDecommissioned`, into the `dock_doors` local copy. Started only when `DOCK_DOOR_MODE=kafka`, group from `DOCK_DOOR_CONSUMER_GROUP`. |
| `warehouse.inbound-receiving.analytics` | **Published** (internal) | Since ADR 0006, every published event is also written here in the same unit of work, under the same CloudEvents `id`, `type`, `subject` and key, with `dataschema=urn:warehouse:inbound-receiving:analytics:<EventName>:v1`. Its only consumer is this context's own `inbound-projector`; it is not an integration contract. |

## The envelope

Every message is a CloudEvents 1.0 event in structured content mode, Kafka
header `content-type: application/cloudevents+json; charset=UTF-8`
(see the [Event Standard](/strategic-design/event-standard-cloudevents)).

| Attribute | Value |
| --- | --- |
| `source` | `/warehouse/inbound-receiving` |
| `type` | `com.warehouse.wms.inbound-receiving.<entity>.<EventName>`, `<entity>` one of `asn`, `dockappointment`, `receipt` |
| `subject` | the aggregate instance id (ASN number, appointment id or receipt id) |
| `dataschema` | `urn:warehouse:inbound-receiving:events:<EventName>:v1` |
| Kafka key | `asn_number` for `asn.*` and `receipt.*`; `appointment_id` for `dockappointment.*` |

`id` is a UUID minted once per domain event and stored with the outbox row, so a
relay retry republishes the same `id`. A breaking payload change is a new `.v2`
type and dataschema.

## Published types

| Type | Raised by |
| --- | --- |
| `asn.ASNRegistered`, `asn.ASNCancelled` | `RegisterAsn`, `CancelAsn` |
| `dockappointment.DockAppointmentBooked`, `...CheckedIn`, `...Cancelled` | `BookAppointment`, `CheckInAppointment`, `CancelAppointment` |
| `dockappointment.DockAppointmentCompleted` | `CloseReceipt`, for a receipt opened from an appointment |
| `receipt.ReceiptOpened`, `receipt.ReceiptLineReceived`, `receipt.ReceiptClosed` | `OpenReceipt`, `ReceiveLine`, `CloseReceipt` |

`ReceiptClosed` carries `discrepancies[]` (`Short`, `Over`, `Damaged` per line);
`ReceiptLineReceived` is the handover event. Because receipt events are keyed by
`asn_number` and `DockAppointmentCompleted` by `appointment_id`, their relative
order is not guaranteed.

## Publishing: the transactional outbox

Events leave only through the outbox: the aggregate rows and the already-encoded
event rows commit in one Postgres transaction, and the relay (default every 1 s,
100 rows per pass, `FOR UPDATE SKIP LOCKED`, id order, stops at the first
failure) sends them. Delivery is at-least-once with the same `id` on a retry, so
consumers dedupe on it. `EVENT_PUBLISHER=log` (the default) only logs messages.

## Who consumes these events

| Consumer | State | Behaviour |
| --- | --- | --- |
| `inventory-storage` | **Live** (its ADR 0037), started only when `INBOUND_RECEIPT_CONSUMER_GROUP` is set; the reference deployment sets it (`inventory-storage-inbound-receipts`, `warehouse-infra` `helm-values/inventory-storage.yaml`) | Books `condition=Good` quantities through its existing ReceiveStock use case, dedupes on the CloudEvents `id`, logs and counts `Damaged` lines without booking them, commits the offset only after handling. A new group starts at the earliest offset. |
| `inventory-storage` (`ReceiptCartonReceived`) | **Live** (its ADR 0045/0046) on the same consumer and group | Identity only: links the carton's SSCC/LPN to a container; `ReceiptLineReceived` stays the sole quantity authority, and a pending-link table makes the two arrive in either order. |
| `warehouse-planning` | **Live** (its ADR 0017; group `warehouse-planning-inbound-demand` in `warehouse-infra`) | Consumes `DockAppointmentBooked` and `DockAppointmentCancelled` as inbound-labor demand. |
| `exception-management` | **Live** (its ADR 0006) | Consumes `CartonDiscrepancyRaised`: one case per (receipt, SSCC or `-`, kind). |
| `network-fulfillment` | **Live** in `NETWORK_MODE=live`, which `warehouse-infra` sets (its ADR 0028, group `network-fulfillment-inbound-receiving`) | Consumes `ReceiptCartonReceived`, `CartonDiscrepancyRaised` and `ReceiptClosed` to close the seller inbound loop toward the retail network. |

The reference deployment (`warehouse-infra` `develop`) runs `inbound-receiving`
with `EVENT_PUBLISHER=kafka`, `PRODUCT_MODE=kafka` and `DOCK_DOOR_MODE=kafka`
(`helm-values/inbound-receiving.yaml`), so the handover to `inventory-storage`
is live end to end.

## The analytics stream

`warehouse.inbound-receiving.analytics` (DLQ
`warehouse.inbound-receiving.analytics.dlq`) carries the same eleven events,
byte-for-byte the integration payload (`FanoutEncoder`,
`internal/adapters/outbound/kafka/analytics_encoder.go`). `cmd/inbound-projector`
(group `ANALYTICS_CONSUMER_GROUP`, default `inbound-receiving-analytics`)
projects it into a separate analytical database, and `cmd/inbound-reports`
(port 8092) serves `GET /reports/receiving-performance` and
`GET /reports/freshness` from it (ADR 0006). Sibling contexts keep reading
`warehouse.inbound-receiving.events`.

## Consuming: local copies

Both consumers dispatch on the full `type`, ignore every other type, run the
effect and the `processed_events` claim in one transaction, commit the offset
only afterwards and skip (WARN) anything that is not a valid CloudEvent. Both
modes default to `permissive` (no consumer, every SKU and door accepted); a
`kafka` mode with an unset group is a boot error. See
[Upstream contracts](https://iqvo.github.io/inbound-receiving/docs/ecosystem/upstream-contracts)
and the [context map](/contexts/inbound-receiving/context-map).

## Machine-generated reference

The generated AsyncAPI documentation is on the
[API Reference](/api-reference/async/inbound-receiving) page.
