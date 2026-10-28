---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: The eleven CloudEvents types Product Discovery consumes (it publishes none), with topics, keys, payload fields, guards, idempotency and one complete example envelope.
---

# Domain Events

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-discovery` service is built on develop ([`IQVO/product-discovery`](https://github.com/IQVO/product-discovery) at `9c2f945`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-discovery#service-and-operations) section lists it.
:::

Every event this context consumes, from `contexts[product-discovery].consumes`
and `.inbound`, with the producer's `publishes` entry for each. This context
**publishes nothing** (`publishes: []`): no `retailnetwork.product-discovery.events`
topic is ever written, and the `.analytics` topic of the tier convention is
never written either. The storefront-wide rules are on
[Event standard: CloudEvents](/storefront/strategic-design/event-standard-cloudevents).

## Envelope

Every consumed Kafka message is a **CloudEvents 1.0 event in structured
JSON mode** (`conventions.cloudevents`), minted and enveloped by its
producer:

| Attribute | Value (per producer) |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once by the producer; a redelivery carries the same `id` — this context's inbox key |
| `source` | `/retailnetwork/offer-availability`, `/retailnetwork/product-content` or `/retailnetwork/pricing` |
| `type` | `com.retailnetwork.<tier>.<producer>.<entity>.<EventName>` — tier `commerce` for `offer-availability`, tier `storefront` for the two siblings |
| `subject` | the producer's aggregate root id (also the Kafka partition key) |
| `time` | the instant the fact happened, UTC |
| `dataschema` | `urn:retailnetwork:<producer>:events:<EventName>:v1` |
| Kafka topics | `retailnetwork.offer-availability.events`, `retailnetwork.product-content.events`, `retailnetwork.pricing.events` |

**Consumption rules** (`conventions.integration_rules`): idempotent on the
CloudEvents `id` — the id is inserted into `processed_events` in the same
transaction as the projection effect, and a duplicate is acknowledged
without effect; dispatch on the **full type string**, never on a suffix.
Consumer group names come from mandatory environment variables (`OFFER_AVAILABILITY_CONSUMER_GROUP`, `PRICING_CONSUMER_GROUP`, `PRODUCT_CONTENT_CONSUMER_GROUP`; the service refuses to start without them); the names the design suggests: `product-discovery.offer-availability`,
`product-discovery.product-content`, `product-discovery.pricing`.

**Ordering rules.** Within one producer, events keyed by the same root id
arrive in order. Across roots and across producers nothing is promised, so
business decision 4 adds **per-source monotonic guards on top of the
inbox**: listing `asOf`, content `revision`, price `version`. A
late-arriving older fact is skipped, even across a rebalance or a replay —
and a fact for an item whose `CatalogItemCreated` has not landed yet simply
creates a partial row that fills in (no invariant can be violated; there
are no invariants).

## Published

None. `publishes: []` is the design: a read side with no events out is the
standard CQRS shape, and it keeps every write path free of a dependency on
this context (see the [Context Map](/storefront/contexts/product-discovery/context-map)).
The canvas open questions record the one cost: search analytics (query
terms, zero-result and fallback rates) have no event to ride on.

## Consumed

### From offer-availability (`retailnetwork.offer-availability.events`, Conformist)

| Event | Full type | Fields used | What this context does |
| --- | --- | --- | --- |
| `CatalogItemCreated` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemCreated` | `catalogItemId`, `title`, `hazmat`, `fragile` | Creates (or fills in) the `ProductView` row: title and flags. Dimensions, weight and GTIN are dropped — the item master owns them. `purchasable` recomputed (item ACTIVE). |
| `CatalogItemDiscontinued` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemDiscontinued` | `catalogItemId` | Marks the item DISCONTINUED: `purchasable` goes false (`PurchasableRule` requires an ACTIVE item). The row stays — the page still renders, as currently unavailable. |
| `ListingCreated` | `com.retailnetwork.commerce.offer-availability.listing.ListingCreated` | `listingId`, `catalogItemId`, `nodeId` | Learns the listing-to-item mapping; a LIVE listing with quantity above 0 feeds `inStock`. |
| `ListingAvailabilityChanged` | `com.retailnetwork.commerce.offer-availability.listing.ListingAvailabilityChanged` | `listingId`, `catalogItemId`, `availableQty`, `asOf` | Updates the listing's quantity, guarded by `asOf`; `inStock` and then `purchasable` recomputed. `basis`, `feedId` and `ownerRef` are dropped. |
| `ListingSuppressed` | `com.retailnetwork.commerce.offer-availability.listing.ListingSuppressed` | `listingId` | Marks that listing SUPPRESSED; suppressed listings never count toward `inStock`. The item-to-listing mapping comes from the stored `ListingCreated` row (the event itself carries no `catalogItemId`). The network's `reason` is dropped. |
| `ListingRestored` | `com.retailnetwork.commerce.offer-availability.listing.ListingRestored` | `listingId` | Marks the listing LIVE again; `inStock` recomputed. |

### From product-content (`retailnetwork.product-content.events`, Conformist)

| Event | Full type | Fields used | What this context does |
| --- | --- | --- | --- |
| `ProductContentPublished` | `com.retailnetwork.storefront.product-content.productcontent.ProductContentPublished` | `catalogItemId`, `revision`, `description`, `attributes`, `primaryCategoryId` | Replaces the item's content on the `ProductView`, guarded by `revision` (an older revision is skipped), then re-indexes the search row (weights: attributes B, description C). `purchasable` recomputed (content PUBLISHED). |
| `ProductContentRetired` | `com.retailnetwork.storefront.product-content.productcontent.ProductContentRetired` | `catalogItemId` | The item's content is no longer PUBLISHED: `purchasable` goes false; the page shows the item without sellable content. |
| `CategoryTreePublished` | `com.retailnetwork.storefront.product-content.categorytree.CategoryTreePublished` | `version`, `categories` | Replaces the `CategoryView` tree for that version, guarded by `version`; purchasable counts are re-derived from `ProductView`. |

### From pricing (`retailnetwork.pricing.events`, Conformist)

| Event | Full type | Fields used | What this context does |
| --- | --- | --- | --- |
| `ItemPriceChanged` | `com.retailnetwork.storefront.pricing.itemprice.ItemPriceChanged` | `catalogItemId`, `effectivePriceMinor`, `version` | Updates the effective price, guarded by `version`. `purchasable` recomputed (price ACTIVE). |
| `ItemPriceWithdrawn` | `com.retailnetwork.storefront.pricing.itemprice.ItemPriceWithdrawn` | `catalogItemId` | The price is WITHDRAWN: `purchasable` goes false (the rule requires an ACTIVE price). |

**Two payload notes (model gaps, also on the
[canvas](/storefront/contexts/product-discovery/bounded-context-canvas) open
questions).** The `ProductView` purpose and the API render the
product page with **bullets, media and the list price**, yet the declared
`consumes` fields name neither `bullets`/`media` (on
`ProductContentPublished`) nor `listPriceMinor`/`currency` (on
`ItemPriceChanged`); and `CategoryTreePublished` feeds `CategoryView` only,
so a category rename never re-indexes the `categoryPath` the search weights
at A. These pages copy the fields the purpose names and flag the
declaration gap.

## Example envelope

The event the purchasable verdict turns on, `ListingAvailabilityChanged`,
one listing dropping to zero (all ids synthetic, all values illustrative):

```json
{
  "specversion": "1.0",
  "id": "9a1c7b52-3d84-4f0e-8b7a-2c5d9e0f1a3b",
  "source": "/retailnetwork/offer-availability",
  "type": "com.retailnetwork.commerce.offer-availability.listing.ListingAvailabilityChanged",
  "subject": "lst-40987",
  "time": "2026-10-25T09:41:07Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:offer-availability:events:ListingAvailabilityChanged:v1",
  "data": {
    "listingId": "lst-40987",
    "catalogItemId": "cat-100234",
    "nodeId": "node-msp-14",
    "availableQty": 0,
    "basis": "PHYSICAL",
    "asOf": "2026-10-25T09:41:05Z",
    "feedId": "feed-88213"
  }
}
```

This context reads four fields of `data`, inserts the `id` into
`processed_events`, applies the `asOf` guard, and — if the item's last LIVE
listing just went to zero — flips `inStock` and `purchasable` to false in
the same transaction. No PII anywhere: a listing event carries quantities,
never a name or address (`conventions.no_auth`, `meta.hard_boundary`).
