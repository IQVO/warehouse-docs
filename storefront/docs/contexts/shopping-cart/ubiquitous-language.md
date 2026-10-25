---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: The terms Shopping Cart speaks, each mapped to its proposed code identifier, plus the neighbour terms it uses and the terms most often confused with them.
---

# Ubiquitous Language

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

The terms this context speaks, each mapped to the identifier a future
implementation must use. The first table is the context's own `ul` list in
`model.yaml`. The second holds the model elements of its aggregate. The
third holds neighbour terms this context uses but does not own; their
definitions come from the owning context's `ul` list. The storefront-wide
glossary is [Ubiquitous Language](/storefront/strategic-design/ubiquitous-language).

## Own terms

Derived from: `model.yaml → contexts[shopping-cart].ul`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Cart** | One shopper's held intent: lines, destination, delivery quote and selections. | `cart.Cart` | The network's customer order (`customer-ordering`): a cart is intent, not a transaction. |
| **Delivery Quote (cart)** | The offers `delivery-promise` returned for the cart's lines and destination, held by the cart; a quote holds no capacity. | `cart.DeliveryQuote` | The network's **DeliveryOffer** (one offer). |
| **Delivery Selection** | The offer the shopper picked per shipment group. | `cart.DeliverySelection` | The network's **Promise**: selecting an offer holds nothing; capacity is held only when checkout places the order. |
| **Estimate** | The labelled, non-binding total in the cart: effective prices plus selected tier charges plus tax band. | `cart.Estimate` | The binding **PriceQuote** of a checkout session. |
| **Checkout Readiness** | Every group selected and no offer expired. | `cart.CheckoutReadiness` | A checkout session's own state: readiness is a fact about the cart that checkout enforces at session open (`ErrCartNotCheckoutReady`). |

## Model elements of this context

Derived from: `model.yaml → contexts[shopping-cart].aggregates[Cart]`
(`value_objects`, `states`, `commands`), `read_models`, `policies`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Cart Line** | One item with a quantity; the only line shape the cart stores. | `cart.CartLine{catalogItemId, quantity}` | A checkout session's numbered line (`session.SessionLine`): the session numbers lines 1..n when it opens (gap S1). |
| **Quoted Offer** | One offer held by the quote: `offerId`, `groupNo`, `tier`, delivery window and expiry. | `cart.QuotedOffer` | The network's `DeliveryOffer` aggregate, which owns the witness path behind the window. |
| **Shipment Group (cart)** | One group of the quote: the lines that ship together, its offers, and the tiers that were unavailable. | `cart.QuoteGroup` | The network's shipment group (`ShipmentGroup` in `delivery-promise`'s `Promise`): the cart mirrors the grouping the quote returned. |
| **Destination Postal Prefix** | The prefix the destination resolves to; the input both the quote and the tax band key on. | `cart.destinationPostalPrefix` | A ship-to address: PII that lives only in the network's `customer-ordering`. |
| **Cart states** | `OPEN`, `CHECKED_OUT`, `ABANDONED`, `MERGED`. | `cart.CartStatus` | The checkout session's states: a `CHECKED_OUT` cart is the effect of a completed session, not a session state. |
| **Purchasability View** | The local, event-fed verdict of whether an item may sit in a cart. | `PurchasabilityView` | `product-discovery`'s **Purchasable** (see below): four inputs, not two. |
| **Estimate View** | The local, event-fed prices, tier charges and tax bands the estimate is computed from. | `EstimateView` | A stored total: the estimate is derived at read time and labelled. |
| **Abandon Inactive** | Policy: an `OPEN` cart with no change for 30 days is `ABANDONED`. | `AbandonInactive` | Deletion: the model says abandoned carts are purged, a physical cleanup the model names no command for. |

## Neighbour terms this context uses

| Term | Definition (owner's) | Code identifier (owner) | Not to be confused with |
| --- | --- | --- | --- |
| **DeliveryOffer** | A short-lived quote for (item, quantity, destination prefix, tier) with a delivery window, the witness path that proves it, and an expiry. | `offer.DeliveryOffer` (`delivery-promise`, [network](/network/contexts/delivery-promise)) | The cart's **Delivery Quote**: the set of such offers returned for the whole cart, held by the cart. |
| **Service Tier** | `SAME_DAY`, `NEXT_DAY`, `TWO_DAY` or `STANDARD`. | `promise.Tier` (`delivery-promise`, [network](/network/contexts/delivery-promise)) | The delivery **charge** (`pricing`'s `TierCharge`): the tier is the promise's vocabulary; `QuotedOffer` re-declares the enum locally. |
| **Effective Price** | The lowest active sale price, else the list price. | `itemprice.ItemPrice.EffectivePrice` (`pricing`) | The **Estimate**: effective prices are one of the estimate's three inputs. |
| **Price Quote** | A binding, immutable, expiring price snapshot for one checkout. | `quote.PriceQuote` (`pricing`) | The cart's **Estimate** (non-binding); the cart's own UL marks this as the term not to confuse. |
| **Checkout Session** | The purchase transaction from review to placed order. | `session.CheckoutSession` (`checkout`) | The **cart**: the session reads the cart at open and closes it on completion; the cart never knows a session exists until `CheckoutCompleted`. |
| **Purchasable** | Item ACTIVE in the item master, content PUBLISHED, price ACTIVE, and at least one LIVE listing with quantity greater than 0. | `productview.Purchasable` (`product-discovery`) | The cart's **PurchasabilityView**, which is fed by catalogue and price events only (see the [canvas](/storefront/contexts/shopping-cart/bounded-context-canvas) open questions). |
| **Catalog Item** | The network's own entry for a product, independent of who ships it. | `catalog.Item` (`offer-availability`, [network](/network/contexts/offer-availability)) | A cart line: the line references `catalogItemId` and adds the shopper's quantity. |

## Fleet translation

None. The cart never touches the warehouse-systems fleet and never produces
or consumes a `warehouse.*` topic (`meta.hard_boundary`).
