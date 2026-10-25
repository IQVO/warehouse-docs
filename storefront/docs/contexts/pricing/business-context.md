---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why what a shopper pays is the storefront's Core subdomain, the decisions pricing makes, and what it deliberately leaves to the network and to sibling storefront contexts.
---

# Business Context

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

## The problem in plain language

A shopper deciding whether to buy looks at two numbers: the price of the
item and the price of getting it delivered at the speed they picked. The
research behind this design names cost as the top abandonment reason (see
[Benchmarks](/storefront/research/benchmarks)), so the total has to be
visible early, honest, and stable when the shopper finally confirms.

Pricing owns both numbers and the moment they stop moving:

| It owns | Why here |
| --- | --- |
| The **list price** and **sale windows** of each catalogue item (`ItemPrice`) | The effective price feeds search, the product page, the cart estimate and the quote; one writer keeps those views consistent. |
| The **delivery charge per service tier** (`DeliveryChargeSchedule`) | The price of speed is where the network's promise becomes revenue (`business_model`: Revenue). The network owns the promise; the storefront prices it. |
| The **synthetic tax table** (`TaxTable`) | A real tax engine is out of scope (decision D10); a synthetic basis-point table by postal-prefix band keeps every total honest in shape. |
| The **PriceQuote** | A binding, immutable, expiring snapshot of the total a checkout session is confirmed against. It is the answer to gap S2: a price change between cart and checkout is visible before confirm, never silent. |

What this context never does: it does not hold the item master (that is the
network's [offer-availability](/network/contexts/offer-availability)), it
does not decide delivery dates or capacity (the network's
[delivery-promise](/network/contexts/delivery-promise)), and it does not move
money (`customer-payments`).

## Actors

| Actor | What they do here | Channel |
| --- | --- | --- |
| Storefront merchandiser (human) | Sets list prices, schedules and cancels sales, withdraws prices, publishes charge schedules and tax tables | REST `/item-prices`, `/delivery-charge-schedules`, `/tax-tables` |
| `storefront-bff` (experience layer) | Reads the current price of an item, the current charge schedule and the current tax table to render pages | REST `GET /item-prices/{catalogItemId}`, `GET /delivery-charge-schedules/current`, `GET /tax-tables/current` |
| `checkout` | Issues a `PriceQuote` when a session opens; reads it back at confirm | REST `POST /price-quotes`, `GET /price-quotes/{quoteId}` |
| `product-discovery` | Re-reads all prices when its projections are rebuilt (bootstrap only, paged) | REST `GET /item-prices` |
| `product-discovery`, `shopping-cart` | Follow price, schedule and tax changes to keep their views and estimates current | Kafka `retailnetwork.pricing.events` |
| `offer-availability` (network) | Reports catalogue items created and discontinued | Kafka `retailnetwork.offer-availability.events` |

## Decisions this context makes

The model lists four business decisions (`contexts[pricing].business_decisions`):

1. **A sale price is always below the list price; sale windows of one item
   never overlap** (`ErrSaleNotBelowList`, `ErrOverlappingSaleWindow`). The
   effective price is then unambiguous: the lowest active sale price, else
   the list price.
2. **Exactly one delivery charge schedule and one tax table are current; a
   new version supersedes, never edits** (`ErrNonIncreasingVersion`).
   History is kept, so a quote can always name the versions it was computed
   from.
3. **A PriceQuote is binding, immutable and expiring** (policy `QuoteTtl`,
   default 15 minutes). The review page shows the binding total, and a
   changed total is visible before the shopper confirms (gap S2 on the
   [Model Gap Register](/storefront/strategic-design/model-gap-register)).
4. **The item master stays in offer-availability; pricing only references
   `catalogItemId`.** A price can be set only for an item the local
   `CatalogItemView` knows and that is not discontinued
   (`ErrUnknownCatalogItem`).

It also runs three policies: **PublishEffectivePriceOnWindowBoundary** (emit
`ItemPriceChanged` when a sale starts or ends, idempotent per item and
boundary), **WithdrawOnDiscontinue** (withdraw the price of a discontinued
item) and **QuoteTtl** (a quote expires 15 minutes after issue, by time,
immutable otherwise).

## How it relates to real storefronts

The [benchmarks](/storefront/research/benchmarks) research describes how
large online retailers separate the item master from pricing and price
delivery speed as its own product. This model copies the shape, not any
internal service name:

- A **price per delivery tier** is the storefront's differentiator: the
  network promises a date, and this context puts a price on choosing a
  faster one. That is why Pricing is **Core**.
- A **binding quote with an expiry** is standard checkout practice; the
  variant here is that the quote also pins the schedule and tax-table
  versions, so a confirm-time mismatch is always explainable.
- Tax is deliberately **synthetic** (D10): a production shop would buy a tax
  engine, just as it would buy a PSP for `customer-payments`.

## Deliberately out of scope

| Out of scope | Where it belongs |
| --- | --- |
| The item master (title, dimensions, flags) | `offer-availability` (network) |
| Descriptions, media, categories | `product-content` |
| Search, browse, purchasability | `product-discovery` (consumes `ItemPriceChanged`, `ItemPriceWithdrawn`) |
| The non-binding cart estimate | `shopping-cart` (consumes all four catalogue events; the estimate is labelled non-binding) |
| The purchase saga and quote confirm | `checkout` |
| Authorize, capture, refund | `customer-payments` |
| Delivery dates, capacity, promises | `delivery-promise` (network) |
| Coupons and promotions | later phase (D10): `promotions`, a Supporting candidate inside pricing |
| Real tax calculation | a bought tax engine, later phase (D10) |
| Authentication | no auth anywhere (`conventions.no_auth`) |

See the [Bounded Context Canvas](/storefront/contexts/pricing/bounded-context-canvas)
for every message and the [Context Map](/storefront/contexts/pricing/context-map)
for every relationship.
