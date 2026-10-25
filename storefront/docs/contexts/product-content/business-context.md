---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why enriching a catalogue item with descriptions, media and categories is a commodity problem with one sharp edge, content that publishes only when complete, and what this context deliberately leaves to others.
---

# Business Context

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model carries the proposed contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

## The problem in plain language

The network already knows the item. `offer-availability` holds the item
master: title, dimensions, weight, handling flags, GTIN. None of that tells
a shopper why they want it. A product page needs a description, the
bullet points under the title, the attribute table (material, size,
capacity), pictures and a place in the category tree the shopper browses.
That is what this context owns.

What it deliberately does **not** own is the item itself. Only
`catalogItemId` crosses the boundary: content is written **for** an item
that exists in the local `CatalogItemView` (fed by `offer-availability`
events), and it never redefines the item. The title a product page shows
comes from the item master, not from here.

| It owns | Why here |
| --- | --- |
| The **sellable content** of one item: description, bullets, attributes, media, primary category, revision | Someone must hold "what the product page says about the item" as one publishable unit, separate from the item master. |
| The **category tree**: one versioned tree, at most four levels deep | Browsing needs a single, stable structure that publishing content can reference by `primaryCategoryId`. |
| The **publish gate**: content goes live only when complete | A half-written page (no description, no lead image, no category) must never reach `product-discovery`. |
| **Retirement on discontinue** | When the network discontinues an item, its published content must come down (`RetireOnDiscontinue`). |

## Actors

| Actor | What they do here | Channel |
| --- | --- | --- |
| Storefront content manager (human) | Creates and revises content, publishes and retires it; creates, moves and renames categories | REST `POST /product-contents`, `POST /product-contents/{catalogItemId}:revise`, `:publish`, `:retire`, `POST /categories`, `POST /categories/{categoryId}:move`, `:rename` |
| `product-discovery` | Reads content and categories to bootstrap its projections (paged snapshot + catch-up) | REST `GET /product-contents`, `GET /product-contents/{catalogItemId}`, `GET /categories` |
| `offer-availability` (network) | Reports items created and discontinued | Kafka `retailnetwork.offer-availability.events` |

The shopper never calls this context directly: the browser reaches only the
storefront edge (`storefront-bff`), and the product page renders from
`product-discovery`'s projections, which are fed by this context's events.

## Decisions this context makes

The model lists three business decisions
(`contexts[product-content].business_decisions`):

1. **Content publishes only when complete.** A publish needs a description,
   exactly one PRIMARY medium and a category (`ErrIncompleteContent`). The
   category must exist in the current tree (`ErrUnknownCategory`), and the
   item must exist in the local `CatalogItemView` (`ErrUnknownCatalogItem`).
2. **Only `catalogItemId` crosses the boundary.** Content never redefines
   the item itself [19]. There is no title field here, no price, no stock.
3. **The category tree is one versioned aggregate, at most four levels
   deep.** The tree never contains a cycle (`ErrCategoryCycle`), siblings
   never share a name (`ErrDuplicateSiblingName`), and a category in use by
   PUBLISHED content is never removed (`ErrCategoryInUse`).

It also runs one policy: **RetireOnDiscontinue** (on
`CatalogItemDiscontinued`, retire the item's PUBLISHED content).

## How it relates to product information management in the real world

Every large shop runs a product information management (PIM) system next to
its item master: the master knows the sellable unit, the PIM knows how to
talk about it. That split is a commodity pattern, and the model says so
plainly: the subdomain verdict is **Generic**, with the rationale "buy a
PIM in production" (see [Benchmarks](/storefront/research/benchmarks) for
the research the design rules rest on). The study builds the context anyway
so that the storefront's event contracts are explicit:

- The publish gate (complete content or nothing) is the one rule worth
  keeping visible, because `product-discovery`'s **Purchasable** rule
  depends on it: an item is purchasable only when its content is PUBLISHED.
- The category tree as a versioned aggregate mirrors how bought PIMs
  version their taxonomies; publishing a tree is an explicit act, not a
  side effect of editing a category.

## Deliberately out of scope

| Out of scope | Where it belongs |
| --- | --- |
| The item itself: title, dimensions, weight, GTIN, discontinuation | `offer-availability` (network item master) |
| Stock and listings | `offer-availability` |
| Prices and sale windows | `pricing` |
| Search, browse and the product page read side | `product-discovery` (fed by this context's events) |
| Media upload and binary storage | out of scope: media are URLs to static assets only |
| Promotions, reviews, recommendations | later phases (`future_contexts`) |
| PII | none here; the storefront stores no PII (`conventions.no_auth`) |
| Anything in the warehouse-systems fleet | the storefront never touches the fleet (`meta.hard_boundary`) |

See the [Bounded Context Canvas](/storefront/contexts/product-content/bounded-context-canvas)
for every message and the [Context Map](/storefront/contexts/product-content/context-map)
for every relationship.
