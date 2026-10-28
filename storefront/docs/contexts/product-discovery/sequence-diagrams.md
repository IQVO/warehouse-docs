---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: UML sequence diagrams for every Product Discovery use case — the three read routes, the projector folds with their guards, and the ops-run bootstrap rebuild — adapter to store, with error, duplicate and out-of-order branches.
---

# Sequence Diagrams

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-discovery` service is built on develop ([`IQVO/product-discovery`](https://github.com/IQVO/product-discovery) at `9c2f945`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-discovery#service-and-operations) section lists it.
:::

One UML sequence diagram per use case on
[Use Cases](/storefront/contexts/product-discovery/use-cases). Participant
names are the packages and ports the model designs, from the
[Class Diagram](/storefront/contexts/product-discovery/class-diagram):

- `http` and `kafka` are the inbound adapters; `ops` is the rebuild job.
- The use case is in `internal/application/usecases`; `Projector` is the
  `FoldEvent` service.
- `SearchPort` is the search boundary (D9); `Postgres` stands for the
  projections, the search index and the inbox, sharing one transaction
  through `UnitOfWork`.

**No outbox relay appears in any diagram: this context publishes nothing**
(`publishes: []`), so there is no producer side to draw. Every fold is one
short transaction; every read is lock-free. Full CloudEvents types are on
[Domain Events](/storefront/contexts/product-discovery/domain-events).

## 1. SearchProducts (REST GET /products)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as SearchProducts
    participant SP as SearchPort
    participant DB as Postgres
    H->>UC: Execute(q, filters, sort, after, limit)
    alt invalid sort, negative price, limit outside 1 to 100
        UC-->>H: 422 validation-failed
    else valid
        UC->>SP: Search(query)
        SP->>DB: tsvector match, GIN index,<br/>weights A A B C
        alt full-text search returns too little
            SP->>DB: pg_trgm similarity retry<br/>(trigger not modelled)
        end
        DB-->>SP: rows
        SP->>UC: hits
        UC->>DB: facet counts over the same rows<br/>category, price band, in-stock
        Note over UC: product-type query: add<br/>categorySuggestions (benchmark 6)
        UC-->>H: 200 hits, facets, suggestions, next
    end
```

Derived from: `model.yaml → contexts[product-discovery].rest`,
`.business_decisions` (2, 3); `apis/product-discovery/openapi.yaml`.

Omitted: pagination mechanics (keyset on `after`).

## 2. GetProduct (REST GET /products/catalogItemId)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as GetProduct
    participant DB as Postgres
    H->>UC: Execute(catalogItemId)
    UC->>DB: load product_views row
    alt no row
        UC-->>H: 404 not-found
    else row exists
        Note over UC: one row: title, flags, content,<br/>category path, prices, inStock,<br/>purchasable (PurchasableRule)
        alt purchasable is false
            Note over UC: rendered as currently unavailable<br/>(UnavailableNotBuyable, gap S6)
        end
        UC-->>H: 200 ProductView
    end
```

Derived from: `model.yaml → contexts[product-discovery].rest`,
`.policies`.

Omitted: the delivery dates the BFF fetches next from the network — not
this context's message.

## 3. ListCategories (REST GET /categories)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as ListCategories
    participant DB as Postgres
    H->>UC: Execute()
    UC->>DB: load category_views<br/>current tree_version
    DB-->>UC: categories with purchasable_count
    UC-->>H: 200 version, categories
    Note over UC: counts are derived from product_views<br/>(CategoryView source)
```

Derived from: `model.yaml → contexts[product-discovery].rest`,
`.read_models[CategoryView]`.

## 4. FoldEvent: ListingAvailabilityChanged (the hot path)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant K as kafka
    participant P as Projector
    participant DB as Postgres
    K->>P: evt listing.ListingAvailabilityChanged<br/>listingId, catalogItemId, availableQty, asOf
    P->>DB: BEGIN, look up CloudEvents id<br/>in processed_events
    alt id already processed
        P->>DB: COMMIT, acknowledge
    else new id
        P->>DB: load listing_rows.as_of_applied
        alt asOf not newer
            Note over P: stale redelivery: record id,<br/>skip the effect (decision 4)
            P->>DB: COMMIT, acknowledge
        else asOf newer
            P->>DB: update listing row, recompute in_stock<br/>over LIVE rows, apply PurchasableRule
            P->>DB: insert processed_events id, COMMIT
            Note over P: indexed columns only: title,<br/>category names, attributes, description<br/>- price and stock are filters, not index text
        end
    end
```

Derived from: `model.yaml → contexts[product-discovery].consumes`
(`ListingAvailabilityChanged`), `.business_decisions` (4),
`.policies[PurchasableRule]`.

Omitted: `ListingCreated`, `ListingSuppressed`, `ListingRestored` (same
transaction; suppress and restore look the item up through the stored
`listing_rows` mapping, because the events carry only `listingId` —
hotspot H1) and the two `catalogitem.*` folds (title, flags, the ACTIVE
input).

## 5. FoldEvent: ProductContentPublished and ItemPriceChanged

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant K as kafka
    participant P as Projector
    participant DB as Postgres
    K->>P: evt productcontent.ProductContentPublished<br/>revision, description, attributes, primaryCategoryId
    P->>DB: BEGIN, inbox check
    alt revision not above content_revision_applied
        Note over P: skip (decision 4)
    else newer revision
        P->>DB: replace content, category path,<br/>content_published true
        P->>DB: refresh search row<br/>(weights B and C changed)
        P->>DB: insert processed_events id, COMMIT
    end
    K->>P: evt itemprice.ItemPriceChanged<br/>effectivePriceMinor, version
    Note over P: same shape: version guard,<br/>price columns, PurchasableRule<br/>(list price not a declared field, hotspot H2)
```

Derived from: `model.yaml → contexts[product-discovery].consumes`
(`ProductContentPublished`, `ItemPriceChanged`).

Omitted: `ProductContentRetired` and `ItemPriceWithdrawn` (the verdict
goes false, the row stays).

## 6. FoldEvent: CategoryTreePublished

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant K as kafka
    participant P as Projector
    participant DB as Postgres
    K->>P: evt categorytree.CategoryTreePublished<br/>version, categories
    P->>DB: BEGIN, inbox check
    alt version not above the stored tree_version
        Note over P: skip (decision 4)
    else newer version
        P->>DB: replace category_views wholesale
        P->>DB: recompute purchasable_count<br/>from product_views
        P->>DB: insert processed_events id, COMMIT
        Note over P: product_views.category_path is NOT<br/>touched: a rename never re-indexes<br/>items (hotspot H3)
    end
```

Derived from: `model.yaml → contexts[product-discovery].consumes`
(`CategoryTreePublished`), `.read_models[CategoryView]`.

## 7. RebuildProjections (ops, never a user request)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OP as ops
    participant R as RebuildProjections
    participant OA as offer-availability
    participant PR as pricing
    participant PC as product-content
    participant K as kafka
    participant DB as Postgres
    OP->>R: rebuild
    R->>OA: qry ListCatalog GET /catalog (OHS)
    OA-->>R: paged catalogue
    R->>OA: qry ListListings GET /listings<br/>(ops-only, in-org)
    OA-->>R: listings
    loop paged
        R->>PR: qry ListItemPrices GET /item-prices
        PR-->>R: page + next
        R->>PC: qry ListProductContents GET /product-contents
        PC-->>R: page + next
    end
    R->>DB: write snapshot rows,<br/>seed the guards (shapes not modelled, H7)
    R->>K: consume all three topics<br/>from the recorded offsets
    Note over R,DB: catch-up folds run the guards,<br/>the overlap with the snapshot is safe
    R-->>OP: rebuild report
```

Derived from: `model.yaml → contexts[product-discovery].business_decisions`
(5), `.sync_calls`; `conventions.cross_model` (`ops_only_exceptions`,
`forbidden_routes`).

Omitted: the search index rebuild (a bulk re-index in the same pass) and
per-page retries. The `GET /listings` arrow is the single documented
in-org exception; every other read rides the network's Open Host Service,
and none of the four is ever reachable from a shopper request.
