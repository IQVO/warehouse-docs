---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: Every CloudEvents type Shopping Cart publishes and consumes, with topics, keys, payload fields, consumers, idempotency and one complete example envelope.
---

# Domain Events

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `shopping-cart` service is built on develop ([`IQVO/shopping-cart`](https://github.com/IQVO/shopping-cart) at `95bc5bc`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/shopping-cart#service-and-operations) section lists it.
:::

Every event this context publishes and consumes, from
`contexts[shopping-cart].publishes` and `.consumes`, with the producer's
entry for each consumed event. The domain-wide rules are on
[Event standard: CloudEvents](/storefront/strategic-design/event-standard-cloudevents).

## Envelope

Every Kafka message is a **CloudEvents 1.0 event in structured JSON mode**
(`conventions.cloudevents`):

| Attribute | Value for this context |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once when the event is written to the outbox; a redelivery carries the same `id` |
| `source` | `/retailnetwork/shopping-cart` |
| `type` | `com.retailnetwork.storefront.shopping-cart.cart.<EventName>` (tier `storefront`, entity `cart` from the `publishes` rows) |
| `subject` | the aggregate root id (`cartId`) |
| `time` | the instant the fact happened, UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:shopping-cart:events:<EventName>:v1` |
| Kafka topic | `retailnetwork.shopping-cart.analytics` — **every** published event is analytics-only, so by `conventions.integration_rules` the `.events` topic carries nothing from this context |
| Kafka key | `cartId`, so one cart's events stay on one partition and in order |

## Published

Every event is written to `outbox_events` in the same transaction as the
aggregate save, and a relay publishes it. All four events name their
consumers as "analytics only": they go to the `.analytics` topic and no
storefront or network context subscribes to a cart fact
([Context Map](/storefront/contexts/shopping-cart/context-map)).

### CartLineAdded

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.shopping-cart.cart.CartLineAdded` |
| Topic | `retailnetwork.shopping-cart.analytics` |
| Subject / key | `cartId` |
| Dataschema | `urn:retailnetwork:shopping-cart:events:CartLineAdded:v1` |
| Producing command / use case | `AddLine` (adding an item already in the cart merges quantities; the event carries the merged line) |
| Consumers | analytics only |

| Field | Type | Meaning |
| --- | --- | --- |
| `cartId` | string | The cart the line was added to. |
| `catalogItemId` | string | The item added. |
| `quantity` | integer | The line's quantity after the merge. |
| `at` | timestamp | When the add happened. |

### CartDeliveryQuoted

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.shopping-cart.cart.CartDeliveryQuoted` |
| Topic | `retailnetwork.shopping-cart.analytics` |
| Subject / key | `cartId` |
| Dataschema | `urn:retailnetwork:shopping-cart:events:CartDeliveryQuoted:v1` |
| Producing command / use case | `QuoteDelivery` (after the synchronous `QuoteDeliveryOffers` call to `delivery-promise`) |
| Consumers | analytics only |

| Field | Type | Meaning |
| --- | --- | --- |
| `cartId` | string | The cart quoted. |
| `destinationPostalPrefix` | string | The prefix the quote was computed for. |
| `groupCount` | integer | How many shipment groups the quote holds. |
| `at` | timestamp | When the quote was taken. |

### CartAbandoned

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.shopping-cart.cart.CartAbandoned` |
| Topic | `retailnetwork.shopping-cart.analytics` |
| Subject / key | `cartId` |
| Dataschema | `urn:retailnetwork:shopping-cart:events:CartAbandoned:v1` |
| Producing command / use case | `AbandonInactive` policy (an `OPEN` cart with no change for 30 days) |
| Consumers | analytics only |

| Field | Type | Meaning |
| --- | --- | --- |
| `cartId` | string | The cart abandoned. |
| `lastChangedAt` | timestamp | The cart's last change; the fact the 30-day rule fired on. |

### CartCheckedOut

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.shopping-cart.cart.CartCheckedOut` |
| Topic | `retailnetwork.shopping-cart.analytics` |
| Subject / key | `cartId` |
| Dataschema | `urn:retailnetwork:shopping-cart:events:CartCheckedOut:v1` |
| Producing command / use case | `CloseOnCheckoutCompleted` policy on `checkout`'s `CheckoutCompleted` |
| Consumers | analytics only |

| Field | Type | Meaning |
| --- | --- | --- |
| `cartId` | string | The cart closed. |
| `checkoutSessionId` | string | The session whose completion closed it. |
| `at` | timestamp | When the cart was closed. |

## Consumed

Every consumer is idempotent on the CloudEvents `id`: the id is inserted
into `processed_events` in the same transaction as the effect, and a
duplicate is acknowledged without effect. Consumers dispatch on the **full
type string**, never on a suffix. Proposed consumer groups:
`shopping-cart.offer-availability`, `shopping-cart.pricing`,
`shopping-cart.checkout`.

### From offer-availability (`retailnetwork.offer-availability.events`, Conformist)

| Event | Full type | Fields used | What this context does |
| --- | --- | --- | --- |
| `CatalogItemCreated` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemCreated` | `catalogItemId` | Marks the item known in `PurchasabilityView`, so `AddLine` can pass `ErrItemNotPurchasable`. |
| `CatalogItemDiscontinued` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemDiscontinued` | `catalogItemId` | Marks the item discontinued in `PurchasabilityView`; later `AddLine` attempts fail `ErrItemNotPurchasable`. Existing lines stay (the model clears lines for no event). |

### From pricing (`retailnetwork.pricing.events`, Customer/Supplier)

| Event | Full type | Fields used | What this context does |
| --- | --- | --- | --- |
| `ItemPriceChanged` | `com.retailnetwork.storefront.pricing.itemprice.ItemPriceChanged` | `catalogItemId`, `effectivePriceMinor` | Refreshes the effective price in `PurchasabilityView` and `EstimateView`; the estimate moves, the cart lines and quote do not. |
| `ItemPriceWithdrawn` | `com.retailnetwork.storefront.pricing.itemprice.ItemPriceWithdrawn` | `catalogItemId` | Marks the item unpriced in `PurchasabilityView` (not purchasable); `EstimateView` can no longer price that line. |
| `DeliveryChargeScheduleChanged` | `com.retailnetwork.storefront.pricing.deliverychargeschedule.DeliveryChargeScheduleChanged` | `version`, `tiers` | Stores the new current tier charges in `EstimateView` (with the free-over thresholds). |
| `TaxTableChanged` | `com.retailnetwork.storefront.pricing.taxtable.TaxTableChanged` | `version`, `bands` | Stores the new current bands in `EstimateView`; the destination prefix selects the band. |

### From checkout (`retailnetwork.checkout.events`, Customer/Supplier)

| Event | Full type | Fields used | What this context does |
| --- | --- | --- | --- |
| `CheckoutCompleted` | `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutCompleted` | `cartId`, `sessionId` | Runs `CloseOnCheckoutCompleted`: `OPEN → CHECKED_OUT`, publishing `CartCheckedOut` (analytics). |

**Ordering.** Pricing keys item events by `catalogItemId`, so per-item
price order holds; the schedule and table events are versioned, and the
cart stores the version it applied. `CheckoutCompleted` is keyed by
`sessionId` upstream — not by `cartId` — so the cart must not assume
per-cart ordering from the partition: the inbox on the CloudEvents `id`
makes a redelivery safe, and the only ordering that matters (quote before
selection before checkout) is enforced inside the cart, not by the topic.
A `CheckoutCompleted` for a cart that is not `OPEN` has no transition in
the model: in practice the session outlives at most minutes while
abandonment needs 30 idle days, and `ErrCartClosed` guards the terminal
states (see the
[Aggregate Design Canvas](/storefront/contexts/shopping-cart/aggregate-design-canvas)).

None of the pricing or catalogue events touches the `Cart` aggregate
itself: the quote and selections are cleared by **line or destination
changes only** (business decision 3) — a price move never clears a quote;
it moves the labelled estimate and the purchasability verdict.

## Example envelope

`CartDeliveryQuoted`, the event every funnel measures (all ids synthetic):

```json
{
  "specversion": "1.0",
  "id": "3e9a71c4-8b2d-4f57-9c1e-6a0b2d8e4f77",
  "source": "/retailnetwork/shopping-cart",
  "type": "com.retailnetwork.storefront.shopping-cart.cart.CartDeliveryQuoted",
  "subject": "cart-4f8b1c",
  "time": "2026-10-24T09:12:41Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:shopping-cart:events:CartDeliveryQuoted:v1",
  "data": {
    "cartId": "cart-4f8b1c",
    "destinationPostalPrefix": "01310",
    "groupCount": 2,
    "at": "2026-10-24T09:12:41Z"
  }
}
```

No shopper reference appears in any cart event: the events carry the cart
id and item ids only, and the optional `shopperId` never leaves the
aggregate (`conventions.no_auth` — the storefront stores no PII).
