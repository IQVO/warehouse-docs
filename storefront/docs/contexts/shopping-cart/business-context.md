---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why holding shopper intent is the storefront's Supporting subdomain, the decisions the cart makes, and what it deliberately leaves to pricing, checkout, the experience layer and the network.
---

# Business Context

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

## The problem in plain language

Between "I want this" and "I pay for this" sits the cart. The research
behind this design names cost as the top abandonment reason (see
[Benchmarks](/storefront/research/benchmarks)), and the second doubt a
shopper carries is "when will it arrive, and what does that speed cost?".
The cart has to hold the intent — sometimes for minutes, sometimes for
weeks — without ever letting the visible total lie.

The cart owns the holding, in four pieces:

| It owns | Why here |
| --- | --- |
| The **lines** — one per item, quantities merged (`CartLine`) | A cart is a shopper's statement, not a catalogue copy: the model keeps it minimal (`catalogItemId`, `quantity`), bounded at 100 lines, and checks purchasability against local views (`ErrItemNotPurchasable`). |
| The **destination postal prefix** | The prefix is the input both the delivery quote and the tax band key on; the full ship-to address is PII that lives only in the network's `customer-ordering` (`conventions.no_auth`, `meta.hard_boundary`). |
| The **delivery quote and the selections** — one group per shipment, each offer with its tier, window and expiry; the shopper picks one offer per group | The quote is the set of offers `delivery-promise` returned; a quote holds no capacity. The selection must name an offer of the current quote (`ErrStaleDeliverySelection`), and any line or destination change clears both. |
| The **labelled, non-binding estimate** | Effective prices plus selected tier charges plus tax band, recomputed from pricing's events. The binding total is the checkout session's `PriceQuote` — the cart's number is always labelled as an estimate (gap S2). |

What this context never does: it does not own prices, tier charges or tax
bands ([pricing](/storefront/contexts/pricing)), it does not promise or hold
capacity (the network's
[delivery-promise](/network/contexts/delivery-promise)), it does not run the
purchase saga ([checkout](/storefront/contexts)), and it stores no PII — only
a `shopperId` reference when the shopper is signed in.

## Actors

| Actor | What they do here | Channel |
| --- | --- | --- |
| Shopper (via `storefront-bff`, the experience layer) | Creates a cart, adds lines, sets quantities and the destination, quotes delivery, selects a tier per group, merges a guest cart into their signed-in cart; reads the cart with its readiness and estimate | REST `/carts` writes and `GET /carts/{cartId}`, `GET /carts?shopperId=&state=` |
| `checkout` | Reads the cart (with its `CheckoutReadiness`) when a session opens; its `ErrCartNotCheckoutReady` invariant enforces the same readiness on its side | REST `GET /carts/{cartId}` |
| `checkout` (again) | Closes the cart when the purchase completes | Kafka `retailnetwork.checkout.events`, `CheckoutCompleted` |
| `pricing` | Keeps the cart's views current: effective prices, tier charges, tax bands, withdrawals | Kafka `retailnetwork.pricing.events` |
| `offer-availability` (network) | Reports catalogue items created and discontinued | Kafka `retailnetwork.offer-availability.events` |
| `delivery-promise` (network) | Answers `QuoteDeliveryOffers` for the cart's lines and destination — the only synchronous call out | REST `POST /delivery-offers:quote` |
| Analytics consumers | Follow add-to-cart, quote, abandon and checkout funnels | Kafka `retailnetwork.shopping-cart.analytics` |

The shopper is a synthetic person reached through `storefront-web` and the
BFF (the experience layer keeps cart and shopper ids in a cookie — state,
not authentication); no shopper calls a cart route directly.

## Decisions this context makes

The model lists five business decisions
(`contexts[shopping-cart].business_decisions`):

1. **One line per item; adding an item already in the cart merges
   quantities** (`ErrDuplicateLine` is the invariant behind the merge).
2. **A quote holds no capacity**: it is the set of offers `delivery-promise`
   returned; a selection must name an offer of the current quote
   (`ErrStaleDeliverySelection`).
3. **Any line or destination change clears the quote and the selections.**
   A stale quote is never silently kept.
4. **The estimate is labelled non-binding; the binding total is the checkout
   session's `PriceQuote`** (gap S2 on the
   [Model Gap Register](/storefront/strategic-design/model-gap-register)).
5. **Guest-first**: `shopperId` is optional; sign-in is a synthetic shopper
   lookup by e-mail (D4), after which `MergeInto` unifies the guest cart
   with the shopper's open cart.

It also runs two policies: **AbandonInactive** (an `OPEN` cart with no
change for 30 days is `ABANDONED`) and **CloseOnCheckoutCompleted** (on
`CheckoutCompleted` the cart is `CHECKED_OUT`).

## How it relates to real storefronts

The [benchmarks](/storefront/research/benchmarks) research describes how
large online retailers treat the cart as conversion infrastructure: show the
total cost — item prices, delivery, tax — as early as possible, keep the
cart across sessions, and merge a guest cart on sign-in. This model copies
the shape, not any internal service name:

- **Total cost up front** is the rule the model states in its purpose: the
  estimate exists so the total is visible before checkout, and it is
  labelled because it is not the number the shopper is charged.
- **Quote per shipment group with a tier choice** is where this design is
  specific to the network: the groups and offers come from
  `delivery-promise`'s feasible paths, not from a flat shipping-fee table.
- **Guest-first with merge** follows D4 (no authentication): the cart is the
  only place shopper state is held without an identity, and merging is an
  explicit command with its own invariant (`ErrMergeTarget`).

## Deliberately out of scope

| Out of scope | Where it belongs |
| --- | --- |
| Item prices, tier charges, tax bands | `pricing` (the cart consumes their events; it never calls pricing) |
| Feasible delivery paths, offers, capacity, promises | `delivery-promise` (network); the cart only quotes and holds the result |
| The binding `PriceQuote` and the purchase saga | `pricing` (quote issuing), `checkout` (the saga) |
| The order record, ship-to address, shopper PII | `customer-ordering` (network); the storefront holds `shopperId` / `shipToAddressId` references only |
| Search, browse, the product page's purchasability verdict | `product-discovery` (its `Purchasable` is a four-input verdict; see [Ubiquitous Language](/storefront/contexts/shopping-cart/ubiquitous-language)) |
| Product descriptions, media, categories | [product-content](/storefront/contexts/product-content) |
| Authorization, capture, refund | `customer-payments` |
| Authentication and identity | deferred (D4): the `identity` future context |
| Saved-for-later lists, sharing, promotions on the cart | not in the model; promotions are a later phase (D10) |
| Persisted carts beyond abandonment | the model's size estimate says abandoned carts are purged |

See the [Bounded Context Canvas](/storefront/contexts/shopping-cart/bounded-context-canvas)
for every message and the [Context Map](/storefront/contexts/shopping-cart/context-map)
for every relationship.
