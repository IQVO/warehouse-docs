---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why the purchase saga is the storefront's Supporting subdomain, the decisions checkout makes, and what it deliberately leaves to pricing, payments, the cart, the experience layer and the network.
---

# Business Context

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `checkout` service is built on develop ([`IQVO/checkout`](https://github.com/IQVO/checkout) at `ab4f0e9`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/checkout#service-and-operations) section lists it.
:::

## The problem in plain language

The shopper has a cart with a delivery choice per shipment group. Pressing
"place order" must do three things that live in three different services:
fix the price, hold the money, and ask the network to record the order with a
confirmed promise per shipment group. None of them can be wrapped in one
database transaction, so the storefront runs a **saga** (see the saga
literature in [Benchmarks](/storefront/research/benchmarks)): a sequence of
local steps, each with a defined answer when something goes wrong.

Checkout owns that sequence, in four pieces:

| It owns | Why here |
| --- | --- |
| The **session** (`CheckoutSession`), one per purchase attempt | The saga needs a single record of where the purchase stands, so that a crash, a retry or a double click lands on the same state. It carries the cart id and version, the numbered lines and groups, the `priceQuoteId` and totals, the `authorizationId`, the `orderId` and a failure code. |
| The **step order**: authorize, then place, then events | The money flow decision (D5) puts the authorization before the order, because an authorization is compensatable (void) and an order is the pivot that cannot be undone from here. |
| The **semantic lock** (`PLACING`) | When the place-order answer is unknown (timeout or 503) the session holds a lock: no void and no new attempt, because either could double-charge or orphan an order (`ErrPlacementInDoubt`). |
| The **stored, PII-free placement request** | It lets `ResolveInDoubtPlacements` re-send the same body with the same `Idempotency-Key`, so the network replays its first answer instead of placing twice. |

What this context never does: it does not compute prices, tier charges or tax
(that is [pricing](/storefront/contexts/pricing), which issues the binding
quote), it does not talk to the payment provider (that is `customer-payments`),
it does not promise delivery or hold capacity (the network's
[delivery-promise](/network/contexts/delivery-promise)), and it never stores an
address, a name or an e-mail address. The order record and the ship-to address
live in the network's [customer-ordering](/network/contexts/customer-ordering).

## Actors

| Actor | What they do here | Channel |
| --- | --- | --- |
| Shopper (via `storefront-bff`, the experience layer) | Reviews the binding total, opens a session, confirms it, reads the session to learn whether it completed, needs a requote or failed | REST `POST /checkout-sessions`, `POST /checkout-sessions/{sessionId}:confirm`, `GET /checkout-sessions/{sessionId}` |
| `shopping-cart` | Supplies the cart (with its checkout readiness) at session open; closes the cart when the purchase completes | REST `GET /carts/{cartId}`; Kafka `CheckoutCompleted` |
| `pricing` | Issues the binding, expiring `PriceQuote` the session confirms against | REST `POST /price-quotes` |
| `customer-payments` | Authorizes the quote total with allocations per group; voids on a definitive rejection; binds the order on `CheckoutCompleted` | REST `POST /payment-authorizations`, `:void`; Kafka `CheckoutCompleted` |
| `delivery-promise` (network) | Answers whether each selected offer is still quotable, with margin, before anything is authorized | REST `GET /delivery-offers/{offerId}` |
| `customer-ordering` (network) | Places the order and confirms a promise per group; the place-order step | REST `POST /checkout`, through the Anti-Corruption Layer |
| Analytics consumers | Follow the funnel: opened, declined, requote required, failed | Kafka `retailnetwork.checkout.analytics` |

The shopper is a synthetic person reached through `storefront-web` and the BFF;
no shopper calls a checkout route directly.

## Decisions this context makes

The model lists four business decisions
(`contexts[checkout].business_decisions`):

1. **Money flow (D5)**: authorize before placing the order; capture per
   shipment group on `FulfillmentShipped`; release on `FulfillmentCancelled`;
   refund on `PackageLost` or `PackageReturned`. Checkout owns the first
   step; `customer-payments` owns the rest.
2. **The network's "Checkout" is this saga's place-order step.** The word
   means the act of turning a cart into a customer order in `customer-ordering`
   (`PlaceOrder`). Checkout reaches it through an Anti-Corruption Layer, the
   only place that knows the network's wire names.
3. **A decline keeps the session open for another token while the price quote
   is valid.** A definitive `409` from the network voids the authorization and
   asks for a requote; a `422` is a contract bug: void, `FAILED`, alert.
4. **A `503` or a timeout leaves the session `PLACING`, answers `202`, and
   `ResolveInDoubtPlacements` replays the stored body** with the same
   `Idempotency-Key` until a definitive answer; alert at 20 h, before the
   network's 24 h idempotency window closes.

It also runs one more policy, **ExpireOnQuoteExpiry**: an `OPEN` or `DECLINED`
session expires with its price quote.

## How it relates to real storefronts

The [benchmarks](/storefront/research/benchmarks) research describes how
large online retailers split cart, checkout and payments, and how the saga
literature treats a purchase that crosses services. This model copies the
shape, not any internal service name:

- **Authorize first, compensate by void** is the textbook saga order: the one
  step that can be undone goes before the step that cannot.
- **A pending state as a semantic lock** is the pattern the saga literature
  recommends so that a concurrent command cannot overwrite an unfinished
  saga; here it is `PLACING`.
- **Short checkout** is the shopper-side goal: the review step reuses the
  cart's data and a saved address id, so a returning shopper has few fields.
  The session itself only takes the references (`shopperId`,
  `shipToAddressId`), never the address.

## Deliberately out of scope

| Out of scope | Where it belongs |
| --- | --- |
| Item prices, tier charges, tax bands, the binding quote | `pricing` (checkout asks for a quote and records its id and totals) |
| Talking to the payment provider, card tokens, capture, refund | `customer-payments`, behind its provider port |
| Delivery offers, capacity, promises, the promise confirmation | `delivery-promise` and `customer-ordering` (network) |
| The order record, ship-to address, shopper PII | `customer-ordering` (network); checkout keeps `shopperId` and `shipToAddressId` references only |
| The cart, its lines and its delivery selection | [shopping-cart](/storefront/contexts/shopping-cart) |
| Capture on shipment, release on cancellation, refunds | `customer-payments` (it follows fulfilment facts, not checkout) |
| Sign-in and credentials | deferred (D4): the `identity` future context |
| Order history, tracking, customer cancellation | `customer-ordering` (network) |

See the [Bounded Context Canvas](/storefront/contexts/checkout/bounded-context-canvas)
for every message and the [Context Map](/storefront/contexts/checkout/context-map)
for every relationship.
