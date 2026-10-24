---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: "Every event Offer & Availability publishes and consumes, with full CloudEvents types, topics, keys, data fields and consumers."
---

# Domain Events

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Every event this context publishes and consumes, from
`contexts[offer-availability].publishes` and `.consumes`, with the envelope
rules of `conventions.cloudevents`. The event standard is
[CloudEvents](/network/strategic-design/event-standard-cloudevents); the namespace
decision is [ADR 0007](/network/adr/0007-cloudevents-namespace).

## Envelope

| Attribute | Value |
| --- | --- |
| `specversion` | `1.0` (structured JSON, mandatory on every Kafka message) |
| `id` | a UUID minted once, when the event is written to `outbox_events`; a redelivery carries the same `id` |
| `source` | `/retailnetwork/offer-availability` |
| `type` | `com.retailnetwork.commerce.offer-availability.<entity>.<EventName>`; `<entity>` is `catalogitem`, `listing` or `inventoryfeed` |
| `subject` | the aggregate root id: `catalogItemId`, `listingId` or `feedId` |
| `time` | the instant the aggregate change committed, UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:offer-availability:events:<EventName>:v1` |
| Topic | `retailnetwork.offer-availability.events` |
| Kafka key | the same aggregate root id as `subject`, so one aggregate's events share a partition |

Every event leaves through a transactional outbox written in the same
transaction as the aggregate change (`conventions.integration_rules`).

## Published

| Event | Full `type` | Subject / key | Producing command (use case) | Consumers |
| --- | --- | --- | --- | --- |
| `CatalogItemCreated` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemCreated` | `catalogItemId` | `CreateCatalogItem` | `delivery-promise`, `shipping-and-tracking`, `seller-inbound` |
| `CatalogItemDiscontinued` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemDiscontinued` | `catalogItemId` | `DiscontinueItem` | `delivery-promise`, `order-sourcing`, `seller-inbound` |
| `CatalogItemPackagingDeclared` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemPackagingDeclared` | `catalogItemId` | `DeclarePackaging` | `seller-inbound`, `vendor-connectivity` |
| `CatalogItemPackLevelRetired` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemPackLevelRetired` | `catalogItemId` | `RetirePackLevel` | `seller-inbound`, `vendor-connectivity` |
| `ListingCreated` | `com.retailnetwork.commerce.offer-availability.listing.ListingCreated` | `listingId` | `CreateListing` | `delivery-promise`, `order-sourcing`, `vendor-connectivity` |
| `ListingAvailabilityChanged` | `com.retailnetwork.commerce.offer-availability.listing.ListingAvailabilityChanged` | `listingId` | `ApplyAvailability` (inside `ApplyInventoryFeed`, including `FullFeedZeroing`) | `delivery-promise`, `order-sourcing` |
| `ListingSuppressed` | `com.retailnetwork.commerce.offer-availability.listing.ListingSuppressed` | `listingId` | `SuppressListing` (policy `SuppressOnNodeUnavailable`) | `delivery-promise`, `order-sourcing` |
| `ListingRestored` | `com.retailnetwork.commerce.offer-availability.listing.ListingRestored` | `listingId` | `RestoreListing` (policy `SuppressOnNodeUnavailable`) | `delivery-promise`, `order-sourcing` |
| `InventoryFeedApplied` | `com.retailnetwork.commerce.offer-availability.inventoryfeed.InventoryFeedApplied` | `feedId` | `ApplyInventoryFeed` (feed reaches `APPLIED`) | `node-performance` |

### Data fields

The field lists are the model's `data` arrays. Types are the proposed JSON
types.

**`CatalogItemCreated`**

| Field | Type | Meaning |
| --- | --- | --- |
| `catalogItemId` | string | The item's id (also `subject`). |
| `title` | string | Display title. |
| `lengthMm` | integer | Length in millimetres, > 0. |
| `widthMm` | integer | Width in millimetres, > 0. |
| `heightMm` | integer | Height in millimetres, > 0. |
| `weightG` | integer | Weight in grams, > 0. |
| `hazmat` | boolean | Hazardous-material handling flag. |
| `fragile` | boolean | Fragile handling flag. |
| `gtin` | string, optional | Proposed ([ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)): the each-level GTIN, 14 digits. Additive. |

**`CatalogItemDiscontinued`**

| Field | Type | Meaning |
| --- | --- | --- |
| `catalogItemId` | string | The discontinued item. |

**`ListingCreated`**

| Field | Type | Meaning |
| --- | --- | --- |
| `listingId` | string | The listing's id (also `subject`). |
| `catalogItemId` | string | The item offered. |
| `nodeId` | string | The node it is offered from. |

**`ListingAvailabilityChanged`**

| Field | Type | Meaning |
| --- | --- | --- |
| `listingId` | string | The listing (also `subject`). |
| `catalogItemId` | string | The item, so consumers need no join. |
| `nodeId` | string | The node, so consumers need no join. |
| `availableQty` | integer | The node's claimed quantity, >= 0. |
| `basis` | string | `PHYSICAL`, `THROUGHPUT_CONSTRAINED` or `UNKNOWN`, as the vendor declared it. |
| `asOf` | string (date-time) | The instant the number is true for; strictly increasing per listing. |
| `feedId` | string | The feed that carried the number. |

**`ListingSuppressed`**

| Field | Type | Meaning |
| --- | --- | --- |
| `listingId` | string | The listing (also `subject`). |
| `nodeId` | string | Its node. |
| `reason` | string | Why it was suppressed. The model gives no vocabulary; the only modelled trigger is `SuppressOnNodeUnavailable` (node suspended or retired). |

**`ListingRestored`**

| Field | Type | Meaning |
| --- | --- | --- |
| `listingId` | string | The listing (also `subject`). |
| `nodeId` | string | Its node. |

**`InventoryFeedApplied`**

| Field | Type | Meaning |
| --- | --- | --- |
| `feedId` | string | The feed (also `subject`). |
| `nodeId` | string | The node the feed is for. |
| `fullUpdate` | boolean | True for a full feed. |
| `lineCount` | integer | Lines in the feed as received. |
| `appliedAt` | string (date-time) | When the feed reached `APPLIED`. |

### Example envelope

`ListingAvailabilityChanged` is the event the promise and sourcing read
models depend on most:

```json
{
  "specversion": "1.0",
  "id": "5b0f8a52-3c1e-4d7a-9f4e-2a6d1c9e7b31",
  "source": "/retailnetwork/offer-availability",
  "type": "com.retailnetwork.commerce.offer-availability.listing.ListingAvailabilityChanged",
  "subject": "LST-000184",
  "time": "2026-10-22T14:05:12Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:offer-availability:events:ListingAvailabilityChanged:v1",
  "data": {
    "listingId": "LST-000184",
    "catalogItemId": "CI-004512",
    "nodeId": "NODE-VWS-FC01",
    "availableQty": 120,
    "basis": "THROUGHPUT_CONSTRAINED",
    "asOf": "2026-10-22T14:00:00Z",
    "feedId": "FEED-20261022-0007"
  }
}
```

The identifiers are synthetic examples; the model fixes no id format.

## Consumed

All four come from `node-topology` on `retailnetwork.node-topology.events`
(tier `logistics`, entity `node`). Proposed consumer group:
`offer-availability-node-status`.

| Event | Full `type` | Fields used | What this context does |
| --- | --- | --- | --- |
| `NodeRegistered` | `com.retailnetwork.logistics.node-topology.node.NodeRegistered` | `nodeId`, `nodeType`, `operator`, `vendorId` | Inserts the node into `NodeStatusView` with status `PROPOSED` (the first state of `node-topology`'s `Node`). |
| `NodeActivated` | `com.retailnetwork.logistics.node-topology.node.NodeActivated` | `nodeId`, `activatedAt` | Sets the node `ACTIVE` in `NodeStatusView`; then, per `SuppressOnNodeUnavailable`, `RestoreListing` on every listing of the node suppressed for node unavailability. |
| `NodeSuspended` | `com.retailnetwork.logistics.node-topology.node.NodeSuspended` | `nodeId`, `reason`, `suspendedAt` | Sets the node `SUSPENDED`; then `SuppressListing` on every `LIVE` listing of the node. |
| `NodeRetired` | `com.retailnetwork.logistics.node-topology.node.NodeRetired` | `nodeId`, `retiredAt` | Sets the node `RETIRED`; then `SuppressListing` on every `LIVE` listing of the node. |

`NodeRegistered` also carries `subtype`, `vendorNodeCode`, `regionId`,
`timezone`, `postalCode` and `countryCode`; this context does not use them.

### Idempotency and ordering

- **Inbox.** Each consumed CloudEvents `id` is recorded in
  `processed_events` in the same transaction as the view update, the
  listing changes and their outbox rows. A redelivered `id` is skipped
  (`conventions.integration_rules`: "Every consumer is idempotent on the
  CloudEvents id").
- **Dispatch on the full type string**, never on a suffix.
- **Order per node.** `node-topology` keys by `nodeId`, so one node's
  events arrive in order on one partition.
- **Replays are safe.** Suppressing a `SUPPRESSED` listing or restoring a
  `LIVE` one is a no-op that raises no event (proposed).

## Packaging and owner fields

> **Proposed, [ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments).** This section is the delta that the seller-inbound design adds to this page. Nothing in it is built.

**`CatalogItemPackagingDeclared`** (entity `catalogitem`, subject `catalogItemId`)

| Field | Type | Meaning |
| --- | --- | --- |
| `catalogItemId` | string | The item. |
| `levels` | array | One entry per declared level: `level` (`EACH`, `INNER`, `CASE`, `PALLET`), `gtin` (14 digits), `childGtin` (the next lower level's GTIN, absent for `EACH`), `qtyOfChild` (at least 2 above `EACH`), `unitsPerPack` (direct factor to eaches), `isOrderable`, `isDespatchUnit`, `effectiveFrom`. |
| `version` | integer | Version of the item's hierarchy. |

**`CatalogItemPackLevelRetired`** (same entity and subject)

| Field | Type | Meaning |
| --- | --- | --- |
| `catalogItemId`, `level`, `gtin` | string | The level that ends. |
| `effectiveTo` | date | The old level is end-dated, not deleted, so shipments in flight still validate. |
| `reason` | string | Why. |
| `version` | integer | Version of the hierarchy. |

**`ListingCreated`** and **`ListingAvailabilityChanged`** gain an optional
`ownerRef` (the seller of record; absent means the vendor's own stock). Both
are additive, so the `:v1` data schema stays `v1`; no existing consumer reads
the field.

Quantities everywhere stay in eaches.
