---
id: event-standard-cloudevents
title: Event Standard (CloudEvents)
sidebar_label: Event Standard
description: "The CloudEvents 1.0 envelope, naming and topic rules every storefront event follows, and the full catalogue of storefront event types."
---

# Event Standard (CloudEvents)

:::info[Generated from the model]
This page is generated from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
:::


Every Kafka message in the storefront is a CloudEvents 1.0 structured JSON
envelope, the same rule the fleet and the network apply. The storefront tier
segment is always `storefront` (`com.retailnetwork.storefront.<context>...`),
distinct from the network's `commerce`, `logistics` and `partner` tiers; the
storefront consumes `retailnetwork.*` topics of the network (in-org, D1) and
never produces or consumes a `warehouse.*` topic.

| Attribute | Rule |
| --- | --- |
| `specversion` | `1.0` |
| `type` | `com.retailnetwork.storefront.<context>.<entity>.<EventName>` |
| `source` | `/retailnetwork/<context>` |
| `subject` | aggregate root id (also the Kafka partition key) |
| `dataschema` | `urn:retailnetwork:<context>:events:<EventName>:v1` |
| `datacontenttype` | `application/json` |
| `id` | UUID; consumers are idempotent on it (inbox table) |
| `time` | the instant the fact became true, not the publish time |
| Topic | `retailnetwork.<context>.events` (integration), `retailnetwork.<context>.analytics` (analytics) |

Tiers (the `<tier>` segment):

| Tier | Contexts |
| --- | --- |
| `storefront` | `product-content`, `pricing`, `product-discovery`, `shopping-cart`, `checkout`, `customer-payments` |

Integration rules carried by every context:

- Every context owns its database; no shared tables.
- Every published event leaves through a transactional outbox.
- Every consumer is idempotent on the CloudEvents id (inbox table).
- Consumers dispatch on the full type string, never on a suffix.
- Sibling data used in a decision is a local, event-fed read model.
- Synchronous calls exist only where a user request needs an answer (listed under sync_calls).
- Analytics-only events go to the .analytics topic only.
- Money is \{amountMinor int64, currency\}; one configured currency (ISO 4217, integer minor units).
- Shared problem types (RFC 9457, application/problem+json, type /problems/\<slug>) are not-found 404, illegal-transition 409, concurrent-update 409, validation-failed 422, plus one kebab-case slug per Err in the model.
- Every write route takes an Idempotency-Key header; a repeated key returns the stored response of the first call.

## Example envelope

```json
{
  "specversion": "1.0",
  "id": "7b1d3f0e-2c4a-4f7e-9a51-3c2b8e6d1f20",
  "source": "/retailnetwork/checkout",
  "type": "com.retailnetwork.storefront.checkout.checkoutsession.CheckoutCompleted",
  "subject": "cs-01J9Z6Q8K2",
  "time": "2026-10-24T14:05:11Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:checkout:events:CheckoutCompleted:v1",
  "data": {
    "sessionId": "cs-01J9Z6Q8K2",
    "orderId": "co-88231",
    "shopperId": "sh-0042",
    "cartId": "cart-01J9YXY2AB",
    "authorizationId": "pa-01J9Z6R0T4",
    "currency": "USD",
    "totalMinor": 12998,
    "groups": [{"groupNo": 1, "tier": "NEXT_DAY", "amountMinor": 12998}],
    "completedAt": "2026-10-24T14:05:11Z"
  }
}
```

## Event catalogue

### `pricing`

Topic `retailnetwork.pricing.events` (analytics-only events on `retailnetwork.pricing.analytics`).

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `ItemPriceChanged` | `com.retailnetwork.storefront.pricing.itemprice.ItemPriceChanged` | `product-discovery`, `shopping-cart` |
| `ItemPriceWithdrawn` | `com.retailnetwork.storefront.pricing.itemprice.ItemPriceWithdrawn` | `product-discovery`, `shopping-cart` |
| `DeliveryChargeScheduleChanged` | `com.retailnetwork.storefront.pricing.deliverychargeschedule.DeliveryChargeScheduleChanged` | `shopping-cart` |
| `TaxTableChanged` | `com.retailnetwork.storefront.pricing.taxtable.TaxTableChanged` | `shopping-cart` |
| `PriceQuoteIssued` | `com.retailnetwork.storefront.pricing.pricequote.PriceQuoteIssued` | analytics only |

### `product-content`

Topic `retailnetwork.product-content.events` (analytics-only events on `retailnetwork.product-content.analytics`).

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `ProductContentPublished` | `com.retailnetwork.storefront.product-content.productcontent.ProductContentPublished` | `product-discovery` |
| `ProductContentRetired` | `com.retailnetwork.storefront.product-content.productcontent.ProductContentRetired` | `product-discovery` |
| `CategoryTreePublished` | `com.retailnetwork.storefront.product-content.categorytree.CategoryTreePublished` | `product-discovery` |

### `shopping-cart`

Topic `retailnetwork.shopping-cart.events` (analytics-only events on `retailnetwork.shopping-cart.analytics`).

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `CartLineAdded` | `com.retailnetwork.storefront.shopping-cart.cart.CartLineAdded` | analytics only |
| `CartDeliveryQuoted` | `com.retailnetwork.storefront.shopping-cart.cart.CartDeliveryQuoted` | analytics only |
| `CartAbandoned` | `com.retailnetwork.storefront.shopping-cart.cart.CartAbandoned` | analytics only |
| `CartCheckedOut` | `com.retailnetwork.storefront.shopping-cart.cart.CartCheckedOut` | analytics only |

### `checkout`

Topic `retailnetwork.checkout.events` (analytics-only events on `retailnetwork.checkout.analytics`).

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `CheckoutCompleted` | `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutCompleted` | `shopping-cart`, `customer-payments` |
| `CheckoutOpened` | `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutOpened` | analytics only |
| `CheckoutDeclined` | `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutDeclined` | analytics only |
| `CheckoutRequoteRequired` | `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutRequoteRequired` | analytics only |
| `CheckoutFailed` | `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutFailed` | analytics only |

### `customer-payments`

Topic `retailnetwork.customer-payments.events` (analytics-only events on `retailnetwork.customer-payments.analytics`).

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `PaymentAuthorized` | `com.retailnetwork.storefront.customer-payments.paymentauthorization.PaymentAuthorized` | analytics only |
| `PaymentCaptured` | `com.retailnetwork.storefront.customer-payments.paymentauthorization.PaymentCaptured` | analytics only |
| `PaymentReleased` | `com.retailnetwork.storefront.customer-payments.paymentauthorization.PaymentReleased` | analytics only |
| `PaymentAuthorizationExpired` | `com.retailnetwork.storefront.customer-payments.paymentauthorization.PaymentAuthorizationExpired` | analytics only |
| `RefundIssued` | `com.retailnetwork.storefront.customer-payments.refund.RefundIssued` | analytics only |
| `RefundFailed` | `com.retailnetwork.storefront.customer-payments.refund.RefundFailed` | analytics only |
| `PaymentDeclined` | `com.retailnetwork.storefront.customer-payments.paymentauthorization.PaymentDeclined` | analytics only |

## Consumed network events

The storefront conforms to these network event types (produced on the
network's `commerce` and `logistics` tiers; see the network
[Event Standard](/network/strategic-design/event-standard-cloudevents) for the
full network catalogue):

| Consumer | Event | Producer |
| --- | --- | --- |
| `pricing` | `CatalogItemCreated` | `offer-availability` |
| `pricing` | `CatalogItemDiscontinued` | `offer-availability` |
| `product-content` | `CatalogItemCreated` | `offer-availability` |
| `product-content` | `CatalogItemDiscontinued` | `offer-availability` |
| `product-discovery` | `CatalogItemCreated` | `offer-availability` |
| `product-discovery` | `CatalogItemDiscontinued` | `offer-availability` |
| `product-discovery` | `ListingCreated` | `offer-availability` |
| `product-discovery` | `ListingAvailabilityChanged` | `offer-availability` |
| `product-discovery` | `ListingSuppressed` | `offer-availability` |
| `product-discovery` | `ListingRestored` | `offer-availability` |
| `shopping-cart` | `CatalogItemCreated` | `offer-availability` |
| `shopping-cart` | `CatalogItemDiscontinued` | `offer-availability` |
| `customer-payments` | `FulfillmentShipped` | `order-sourcing` |
| `customer-payments` | `FulfillmentCancelled` | `order-sourcing` |
| `customer-payments` | `PackageLost` | `shipping-and-tracking` |
| `customer-payments` | `PackageReturned` | `shipping-and-tracking` |

