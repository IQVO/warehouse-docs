---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: Every CloudEvents type Product Content publishes and consumes, with topics, keys, payload fields, consumers, idempotency and one complete example envelope.
---

# Domain Events

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-content` service is built on develop ([`IQVO/product-content`](https://github.com/IQVO/product-content) at `2f09dc0`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-content#service-and-operations) section lists it.
:::

Every event this context publishes and consumes, from
`contexts[product-content].publishes` and `.consumes`, with the producer's
entry for each consumed event. The storefront-wide rules are on
[Event standard: CloudEvents](/storefront/strategic-design/event-standard-cloudevents).

## Envelope

Every Kafka message is a **CloudEvents 1.0 event in structured JSON mode**
(`conventions.cloudevents`):

| Attribute | Value for this context |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once when the event is written to the outbox; a redelivery carries the same `id` |
| `source` | `/retailnetwork/product-content` |
| `type` | `com.retailnetwork.storefront.product-content.<entity>.<EventName>` (tier `storefront`, entity `productcontent` or `categorytree`) |
| `subject` | the aggregate root id: the `catalogItemId` for content events, the `categoryTreeId` for tree events |
| `time` | the instant the fact happened, UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:product-content:events:<EventName>:v1` |
| Kafka topic | `retailnetwork.product-content.events` |
| Kafka key | the subject, so one item's content events stay on one partition and in order |

## Published

Every event is written to `outbox_events` in the same transaction as the
aggregate save, and a relay publishes it. **No published event carries a
title, a price, stock or PII**: only content, category data and references.
The model lists no analytics-only event for this context, so the
`retailnetwork.product-content.analytics` topic receives nothing.

### ProductContentPublished

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.product-content.productcontent.ProductContentPublished` |
| Topic | `retailnetwork.product-content.events` |
| Subject / key | `catalogItemId` |
| Dataschema | `urn:retailnetwork:product-content:events:ProductContentPublished:v1` |
| Producing command / use case | `PublishContent` (REST `POST /product-contents/{catalogItemId}:publish`) |
| Consumers | `product-discovery` (folds the content into `ProductView`, guarded by `revision`) |

| Field | Type | Meaning |
| --- | --- | --- |
| `catalogItemId` | string | The catalogue item this content belongs to. |
| `revision` | integer | The published shape's number; `product-discovery` applies it only above the last applied revision (its per-source monotonic guard). |
| `description` | string | The product-page prose. |
| `bullets` | string[] | The bullet list under the title; at most 10. |
| `attributes` | array | The attribute table: `name`, `value`, optional `unit`; at most 50. |
| `media` | array | The pictures: `mediaId`, `url`, `altText`, `role` PRIMARY or GALLERY; at most 12, exactly one PRIMARY. |
| `primaryCategoryId` | string | The item's place in the published category tree. |

**Why the full content.** `product-discovery` renders the product page from
its own `ProductView` and never calls this context on a shopper request, so
the event carries everything the page needs. The `revision` lets the
consumer drop an out-of-order redelivery.

### ProductContentRetired

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.product-content.productcontent.ProductContentRetired` |
| Topic | `retailnetwork.product-content.events` |
| Subject / key | `catalogItemId` |
| Dataschema | `urn:retailnetwork:product-content:events:ProductContentRetired:v1` |
| Producing command / use case | `RetireContent`: from the content manager (REST `POST /product-contents/{catalogItemId}:retire`) or from the `RetireOnDiscontinue` policy |
| Consumers | `product-discovery` (the item's content is no longer PUBLISHED, so the item stops being purchasable) |

| Field | Type | Meaning |
| --- | --- | --- |
| `catalogItemId` | string | The catalogue item whose content is retired. |
| `revision` | integer | The revision that was retired; the consumer's monotonic guard still applies. |

### CategoryTreePublished

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.product-content.categorytree.CategoryTreePublished` |
| Topic | `retailnetwork.product-content.events` |
| Subject / key | `categoryTreeId` |
| Dataschema | `urn:retailnetwork:product-content:events:CategoryTreePublished:v1` |
| Producing command / use case | `PublishCategoryTree` (no `inbound` row and no REST route name its trigger; see the [canvas](/storefront/contexts/product-content/bounded-context-canvas) open questions) |
| Consumers | `product-discovery` (rebuilds `CategoryView` for the version, guarded by `version`) |

| Field | Type | Meaning |
| --- | --- | --- |
| `version` | integer | The tree version; `product-discovery` applies it only above the last applied version. |
| `categories` | array | The whole tree: one entry per category with `categoryId`, `parentId`, `name` and `path`. |

**Why the whole tree.** The model declares the payload as
`categories(categoryId, parentId, name, path)` under one `version`, so the
consumer replaces its tree in one step instead of replaying edits. At
roughly 10^3 categories (`size_estimate`) the message stays small.

## Consumed

The consumer is idempotent on the CloudEvents `id`: the id is inserted into
`processed_events` in the same transaction as the effect, and a duplicate is
acknowledged without effect. It dispatches on the **full type string**,
never on a suffix. Consumer group names come from mandatory environment variables (`OFFER_AVAILABILITY_CONSUMER_GROUP`; the service refuses to start without them); the names the design suggests:
`product-content.offer-availability`.

### From offer-availability (`retailnetwork.offer-availability.events`, Conformist)

| Event | Full type | Fields used | What this context does |
| --- | --- | --- | --- |
| `CatalogItemCreated` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemCreated` | `catalogItemId` | Projects the item into `CatalogItemView`, so `CreateProductContent` can pass `ErrUnknownCatalogItem`. The event's other fields (title, dimensions, GTIN, flags) are dropped: the item master owns them. |
| `CatalogItemDiscontinued` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemDiscontinued` | `catalogItemId` | Marks the item discontinued in `CatalogItemView`, then the `RetireOnDiscontinue` policy runs `RetireContent` on the item's PUBLISHED content, publishing `ProductContentRetired`. A DRAFT is left alone (the model is silent; see the canvas open questions). |

**Ordering.** The producer keys by `catalogItemId`, so the two events of one
item arrive in order. Content events of one item are keyed the same way
here, so `product-discovery` sees `ProductContentPublished` and
`ProductContentRetired` of one item in order; the `revision` guard covers
anything Kafka cannot. An event for an item whose `CatalogItemCreated` has
not been consumed yet is impossible to reject by invariant — the view is
simply behind; consumption order on one key prevents it for the same item.

## Example envelope

The most important event, `ProductContentPublished`, for revision 2 of an
item (all ids synthetic, all values illustrative):

```json
{
  "specversion": "1.0",
  "id": "7d2e9c41-5f6b-4a3e-9c2d-1e8f0a5b6c7d",
  "source": "/retailnetwork/product-content",
  "type": "com.retailnetwork.storefront.product-content.productcontent.ProductContentPublished",
  "subject": "cat-100234",
  "time": "2026-10-22T14:03:11Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:product-content:events:ProductContentPublished:v1",
  "data": {
    "catalogItemId": "cat-100234",
    "revision": 2,
    "description": "A 2-litre insulated steel bottle that keeps drinks cold for a day.",
    "bullets": [
      "Double-wall vacuum insulation",
      "Fits a standard bottle cage",
      "Dishwasher-safe cap"
    ],
    "attributes": [
      {"name": "capacity", "value": "2", "unit": "l"},
      {"name": "material", "value": "stainless steel"}
    ],
    "media": [
      {"mediaId": "med-01", "url": "https://static.example.invalid/cat-100234/main.jpg", "altText": "Steel bottle, side view", "role": "PRIMARY"},
      {"mediaId": "med-02", "url": "https://static.example.invalid/cat-100234/cap.jpg", "altText": "Cap detail", "role": "GALLERY"}
    ],
    "primaryCategoryId": "cat-bottles"
  }
}
```

There is no title (the item master's), no price (`pricing`), no stock
(`offer-availability`) and no PII anywhere in the envelope.
