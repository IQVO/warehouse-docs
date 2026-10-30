---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: The terms Product Discovery speaks, each mapped to its code identifier on develop, plus the neighbour terms it projects and the terms most often confused with them.
---

# Ubiquitous Language

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-discovery` service is built on develop ([`IQVO/product-discovery`](https://github.com/IQVO/product-discovery) at `9c2f945`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-discovery#service-and-operations) section lists it.
:::

The terms this context speaks, each mapped to the identifier a future
implementation must use. The first table is the context's own `ul` list in
`model.yaml`. The second holds the model elements of its read side. The
third holds neighbour terms this context projects but does not own; their
definitions come from the owning context's `ul` list. The storefront-wide
glossary is [Ubiquitous Language](/storefront/strategic-design/ubiquitous-language).

## Own terms

Derived from: `model.yaml → contexts[product-discovery].ul`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Purchasable** | Item ACTIVE in the item master, content PUBLISHED, price ACTIVE, and at least one LIVE listing with quantity above 0. | `productview.Purchasable` | The network's **sellable listing** (one node only): purchasable is an item-level verdict this context derives. |
| **Product View** | The projection one product page or search hit renders from. | `productview.View` | The catalogue item itself (`offer-availability`) or its content (`product-content`). |
| **Category View** | The browsable tree with purchasable counts per category. | `categoryview.View` | The **Category Tree** aggregate in `product-content`, which owns the tree; this view adds counts. |
| **In Stock** | At least one LIVE listing with `availableQty` above 0 for the item. | `productview.InStock` | **Purchasable**: stock is one of the four inputs; an in-stock item can still be unpurchasable (no price, no content). |
| **Product-Type Query** | A search for a kind of product; the answer includes category suggestions. | `(search policy)` | A navigational query (a category name) or an item-specific query (brand + model). |

## Model elements of this context

Derived from: `model.yaml → contexts[product-discovery].read_models`,
`.policies`, `.rest`, `.business_decisions`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Projection** | An event-fed local copy, rebuildable from its sources; this context is projections only (no aggregate in v1, its ADR 0002). | `usecases.Consumer` (as built: `internal/application/usecases/consume*.go` folding into `productview.View`) | An aggregate: nothing here enforces an invariant or raises an `Err...`. |
| **Purchasable Rule** | Policy: the four-input verdict above, recomputed on every relevant event. | `PurchasableRule` | A domain invariant; it derives display state, it rejects nothing. |
| **Unavailable, Not Buyable** | Policy: no LIVE listing with quantity above 0 means shown as currently unavailable; out-of-stock purchase is impossible (gap S6). | `UnavailableNotBuyable` | A backorder or "ship later" promise, which this network cannot make. |
| **Monotonic Guard** | Per-source ordering guard on top of the CloudEvents-id inbox: listing `asOf`, content `revision`, price `version`. An older fact is skipped. | `productview.Stale` (as built: the `Apply*` folds of `productview.View` answer `Stale` when the per-source guard skips a fact) | The inbox: the inbox deduplicates by id; the guard orders by source sequence. |
| **Search Port** | The port search sits behind (D9): PostgreSQL full-text search + `pg_trgm` today, a dedicated engine later as an adapter swap. | `ports.SearchPort` | A ranking service of its own; the weights are fixed by business decision 2. |
| **Typo Fallback** | `pg_trgm` similarity match when full-text search returns too little. | `search.SimilarityThreshold` (as built: `pg_trgm` similarity in the Postgres search adapter) | Synonym or stem expansion, which the model does not name. |
| **Facet** | A filter axis with counts: category, price band, in-stock. | `search.Facet` | Free-form filters; the three axes are fixed by business decision 2. |
| **Snapshot + Catch-up** | The rebuild: paged reads of every source, then events from a recorded offset. | `usecases.Rebuilder` (`cmd/rebuild`) | A user-request read; the rebuild never serves a shopper request. |

## Neighbour terms this context projects

| Term | Definition (owner's) | Code identifier (owner) | Not to be confused with |
| --- | --- | --- | --- |
| **Catalog Item** | The network's own entry for a product, independent of who ships it. | `catalog.Item` (`offer-availability`, [network](/network/contexts/offer-availability)) | **Product View**: the projection of that item plus three other sources. |
| **Listing** | A catalogue item offered from one node. | `listing.Listing` (`offer-availability`, [network](/network/contexts/offer-availability)) | **In Stock**: stock asks whether at least one listing is LIVE with quantity above 0. |
| **Available Quantity** | What a node claims it can ship now for one listing. | `listing.Availability.AvailableQty` (`offer-availability`) | A promise of capacity; the network's promise context owns that. |
| **LIVE / SUPPRESSED** | A listing's two states; suppressed listings never count. | `listing.Listing` states (`offer-availability`) | The item's own states (`ACTIVE` / `DISCONTINUED`). |
| **Effective Price** | The lowest active sale price, else the list price. | `itemprice.ItemPrice.EffectivePrice` (`pricing`) | What this context stores: the projection copies `effectivePriceMinor` and the price `version`. |
| **Product Content** | Description, bullets, attributes and media of one catalogue item. | `content.ProductContent` (`product-content`) | The search document: the projection flattens content into the indexed row. |
| **Revision** | One published shape of an item's content; publishing bumps it. | `content.ProductContent.Revision` (`product-content`) | The monotonic guard name on this side of the boundary. |
| **Category Tree** | The single, versioned tree of categories, at most four levels deep. | `category.Tree` (`product-content`) | **Category View**: the tree plus purchasable counts, derived here. |

## Fleet translation

None. Product discovery never touches the warehouse-systems fleet, never
produces or consumes a `warehouse.*` topic (`meta.hard_boundary`), and its
one network route outside the Open Host Service (`GET /listings`) is the
documented ops-only exception for the projection rebuild.
