---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why finding the right purchasable item fast is a Supporting subdomain today and a Core candidate at scale, the decisions product discovery makes, and what it deliberately leaves to its three feed owners.
---

# Business Context

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-discovery` service is built on develop ([`IQVO/product-discovery`](https://github.com/IQVO/product-discovery) at `9c2f945`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-discovery#service-and-operations) section lists it.
:::

## The problem in plain language

A shopper rarely arrives knowing the exact item id. They type a few words,
misspell one of them, browse a category, filter by price and stock, and
expect the right purchasable item on the first screen. The research behind
this design names mediocre search UX a top failure class — nearly half of
desktop and more than half of mobile sites search badly (benchmark [6] on
[Benchmarks](/storefront/research/benchmarks)) — and product-type queries
("running shoes", not a brand-model string) are the named weak spot.

Product Discovery owns that moment:

| It owns | Why here |
| --- | --- |
| The **ProductView** — one row per catalogue item: title, flags, content, category path, list and effective price, `inStock`, `purchasable` | Every search hit and product page renders from one projection, so search, browse and the page never disagree about what an item is or whether it can be bought. |
| The **CategoryView** — the browsable tree plus purchasable counts | Browsing is the other half of discovery; counts come from `ProductView`, so a category never advertises items it cannot sell. |
| **Search** — PostgreSQL full-text search over title (A), category names (A), attributes (B), description (C) with `pg_trgm` typo fallback (D9) | The storefront's differentiator is *what is purchasable now*, not ranking science; the engine itself is generic, so it sits behind a port. |
| The **Purchasable verdict** — `PurchasableRule` and `UnavailableNotBuyable` | Three upstreams each own one input (item, content, price, live listings); only this context joins them into the single answer a shopper sees. |

What this context never does: it owns no item master (the network's
[offer-availability](/network/contexts/offer-availability)), no content or
categories ([product-content](/storefront/contexts/product-content)), no
prices ([pricing](/storefront/contexts/pricing)), it publishes no events,
and it never serves a write route.

## Actors

| Actor | What they do here | Channel |
| --- | --- | --- |
| Shopper, via `storefront-bff` (experience layer) | Searches (`SearchProducts`), opens a product page (`GetProduct`), browses categories (`ListCategories`) | REST `GET /products`, `GET /products/{catalogItemId}`, `GET /categories` |
| `offer-availability` (network) | Reports catalogue items created/discontinued and every listing change (created, availability, suppressed, restored) | Kafka `retailnetwork.offer-availability.events` |
| `product-content` | Reports content published/retired and every category-tree publication | Kafka `retailnetwork.product-content.events` |
| `pricing` | Reports effective-price changes and price withdrawals | Kafka `retailnetwork.pricing.events` |
| Storefront operator (ops) | Rebuilds the projections: paged snapshot reads, then catch-up from the topics | REST `GET /catalog` (OHS), `GET /listings` (ops-only, in-org), `GET /item-prices`, `GET /product-contents` |

No human has a write route here: the merchandiser writes prices in
[pricing](/storefront/contexts/pricing), the content manager writes content
in [product-content](/storefront/contexts/product-content), and this
context only ever reflects their facts.

## Decisions this context makes

The model lists five business decisions
(`contexts[product-discovery].business_decisions`):

1. **No aggregate in v1 — projections only.** The context's own ADR 0002
   will say so plainly. There is no state machine to get wrong; a wrong
   projection is rebuilt, not corrected by hand.
2. **Search ranks title (A), category names (A), attributes (B),
   description (C)** in a `tsvector` with a GIN index; `pg_trgm` similarity
   is the typo fallback; facets are category, price band and in-stock.
3. **Product-type queries also return category suggestions** (benchmark
   [6]): a search for a kind of product answers with categories to browse,
   not only items.
4. **Out-of-order safety comes from per-source monotonic guards** — listing
   `asOf`, content `revision`, price `version` — on top of the
   CloudEvents-id inbox. A late-arriving older fact never overwrites a
   newer one, even across a rebalance or a replay.
5. **Bootstrap is snapshot + catch-up**: paged OHS reads of the network
   catalogue and the storefront's own pricing and content, then events.
   Listing availability has no storefront OHS read, so the rebuild uses
   `GET /listings` as an in-org read on an ops-only path, **never on a user
   request** (the one documented exception in
   `conventions.cross_model.ops_only_exceptions`).

It also runs two policies: **PurchasableRule** (`purchasable` = item ACTIVE
in the item master, content PUBLISHED, price ACTIVE, and at least one LIVE
listing with quantity above 0) and **UnavailableNotBuyable** (an item with
no live listing is shown as currently unavailable; out-of-stock purchase is
impossible in this network — gap S6 on the
[Model Gap Register](/storefront/strategic-design/model-gap-register), a
recorded future idea).

## How it relates to real storefronts

Large online retailers buy or heavily tune a dedicated search engine and
treat discovery as a Core capability with its own teams. This design copies
the shape, deliberately not the spend:

- **The engine is generic; the projection is not.** What makes this
  storefront's search useful is the `purchasable` join — three upstream
  facts in one row — and that is this context's own work. Hence Supporting,
  "Core candidate at scale" in the
  [Subdomain Classification](/storefront/strategic-design/subdomain-classification).
- **PostgreSQL first (D9).** Full-text search plus `pg_trgm` covers the
  benchmark's failure classes without a second system to operate, and the
  `SearchPort` keeps a dedicated engine a later adapter swap, not a
  rewrite.
- **A read side with no events out** is the standard CQRS shape: the
  storefront's other surfaces (cart, checkout) re-derive what they need
  from the same upstream feeds, so nothing here becomes a dependency of a
  write path.

## Deliberately out of scope

| Out of scope | Where it belongs |
| --- | --- |
| The item master (title, dimensions, flags) | `offer-availability` (network) |
| Descriptions, media, attributes, the category tree itself | `product-content` |
| List prices, sale windows, the effective price | `pricing` |
| Listing availability as a fact | `offer-availability`; this context only projects it |
| Out-of-stock purchase (buy now, ship later) | impossible in this network (gap S6, future idea) |
| Recommendations, reviews, sponsored placement | later phase (`reviews-recommendations`, promotions) |
| Personalization, session-level ranking | not in the model; the ranking weights are fixed by decision 2 |
| A dedicated search engine | later adapter swap behind the `SearchPort` (D9) |
| Analytics of what was searched | nothing is published, not even analytics (see the [canvas](/storefront/contexts/product-discovery/bounded-context-canvas) open questions) |
| Authentication | no auth anywhere (`conventions.no_auth`) |

See the [Bounded Context Canvas](/storefront/contexts/product-discovery/bounded-context-canvas)
for every message and the [Context Map](/storefront/contexts/product-discovery/context-map)
for every relationship.
