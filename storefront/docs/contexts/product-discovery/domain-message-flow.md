---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: Six Product Discovery scenarios as ddd-crew domain message flows, covering search, the product page, the three feeds folding into ProductView, the category tree, and the ops-run bootstrap rebuild.
---

# Domain Message Flow

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-discovery` service is built on develop ([`IQVO/product-discovery`](https://github.com/IQVO/product-discovery) at `9c2f945`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-discovery#service-and-operations) section lists it.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Six scenarios. Participants are contexts and actors. Every arrow is a
message from the model, prefixed `qry:` (query) or `evt:` (event); no
`cmd:` arrow exists — this context takes no command. A `Note` names a step
a context runs on itself. Kafka is drawn as one participant. Event names
are written `entity.EventName`; the full type is
`com.retailnetwork.<tier>.<producer>.<entity>.<EventName>` (see
[Domain Events](/storefront/contexts/product-discovery/domain-events)). REST
path parameters are written without braces. The storefront-wide
relationships are on the [Context Map](/storefront/strategic-design/context-map).

## 1. Shopper search (a product-type query)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor SH as Shopper (BFF)
    participant PD as product-discovery
    SH->>PD: qry: SearchProducts<br/>GET /products q, filters, sort, after, limit
    Note over PD: tsvector weights title A,<br/>category names A, attributes B,<br/>description C, facets category,<br/>price band, in-stock
    alt full-text search returns too little
        Note over PD: pg_trgm similarity fallback<br/>(trigger not modelled)
    end
    PD-->>SH: qry: reply hits, facets,<br/>categorySuggestions
    Note over PD: a product-type query also<br/>answers with categories (benchmark 6)
```

Derived from: `model.yaml → contexts[product-discovery].rest` (`GET /products`),
`.business_decisions` (2, 3); `apis/product-discovery/openapi.yaml`
(`ProductSearchResult`).

Omitted: the `SearchPort` boundary and its Postgres adapter (see
[Sequence Diagrams](/storefront/contexts/product-discovery/sequence-diagrams)),
and the projection updates behind every hit (scenarios 3-5).

## 2. Product page

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor SH as Shopper (BFF)
    participant PD as product-discovery
    SH->>PD: qry: GetProduct<br/>GET /products/catalogItemId
    alt no row for the item
        PD-->>SH: qry: reply 404 not-found
    else row exists
        Note over PD: one row: title, flags, content,<br/>category path, prices, inStock,<br/>purchasable (PurchasableRule)
        alt purchasable is false
            Note over PD: shown as currently unavailable<br/>(UnavailableNotBuyable, gap S6)
        end
        PD-->>SH: qry: reply 200 ProductView
    end
```

Derived from: `model.yaml → contexts[product-discovery].rest`
(`GET /products/{catalogItemId}`), `.policies`; `apis/product-discovery/openapi.yaml`
(`ProductView`, `Problem`).

Omitted: the delivery dates the BFF loads afterwards from the network's
promise context — a separate call the experience layer makes, not this
context's message.

## 3. The availability feed folds (the hot path)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OA as offer-availability
    participant K as Kafka
    participant PD as product-discovery
    OA->>K: evt: listing.ListingAvailabilityChanged
    K->>PD: evt: listing.ListingAvailabilityChanged
    Note over PD: inbox on CloudEvents id,<br/>then the asOf guard
    alt older asOf than the stored one
        Note over PD: skipped (business decision 4)
    else asOf moves forward
        Note over PD: update quantity, recompute<br/>inStock, then purchasable<br/>(PurchasableRule) in one transaction
    end
```

Derived from: `model.yaml → contexts[product-discovery].consumes`
(`ListingAvailabilityChanged`), `.business_decisions` (4), `.policies`,
`.read_models[ProductView]`.

Omitted: `ListingCreated`, `ListingSuppressed`, `ListingRestored` and the
two `catalogitem.*` events — the same fold with their own fields; and the
search index write, which rides along whenever an indexed column changes
(see [Sequence Diagrams](/storefront/contexts/product-discovery/sequence-diagrams)).

## 4. The content and price feeds fold

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant PC as product-content
    participant PR as pricing
    participant K as Kafka
    participant PD as product-discovery
    PC->>K: evt: productcontent.ProductContentPublished
    K->>PD: evt: productcontent.ProductContentPublished
    Note over PD: revision guard, replace content,<br/>re-index row (weights B, C),<br/>recompute purchasable
    PR->>K: evt: itemprice.ItemPriceChanged
    K->>PD: evt: itemprice.ItemPriceChanged
    Note over PD: version guard, update effective<br/>price, recompute purchasable
```

Derived from: `model.yaml → contexts[product-discovery].consumes`
(`ProductContentPublished`, `ItemPriceChanged`), `.read_models[ProductView]`.

Omitted: `ProductContentRetired` and `ItemPriceWithdrawn` (same shape: the
verdict goes false); the list price and currency the purpose names but the
declared fields do not (a model gap on the
[canvas](/storefront/contexts/product-discovery/bounded-context-canvas)).

## 5. Category tree publication

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant PC as product-content
    participant K as Kafka
    participant PD as product-discovery
    PC->>K: evt: categorytree.CategoryTreePublished
    K->>PD: evt: categorytree.CategoryTreePublished
    Note over PD: version guard, replace CategoryView,<br/>re-derive purchasable counts<br/>from ProductView
    Note over PD: the indexed categoryPath of items<br/>is NOT re-indexed (model gap:<br/>ProductView source lacks this event)
```

Derived from: `model.yaml → contexts[product-discovery].consumes`
(`CategoryTreePublished`), `.read_models[CategoryView]`.

Omitted: the shopper reading `GET /categories` afterwards (scenario 2's
shape). The last note is the gap a rename or move exposes: `CategoryView`
gets the new names, the products' indexed paths keep the old ones until
some other event touches the item.

## 6. Bootstrap rebuild: snapshot + catch-up (ops only)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor OP as Storefront operator (ops)
    participant PD as product-discovery
    participant OA as offer-availability
    participant PR as pricing
    participant PC as product-content
    participant K as Kafka
    OP->>PD: rebuild the projections
    PD->>OA: qry: ListCatalog<br/>GET /catalog (OHS)
    OA-->>PD: qry: reply paged catalogue
    PD->>OA: qry: ListListings<br/>GET /listings (ops-only, in-org)
    OA-->>PD: qry: reply listings
    loop paged
        PD->>PR: qry: ListItemPrices<br/>GET /item-prices
        PR-->>PD: qry: reply page + next
        PD->>PC: qry: ListProductContents<br/>GET /product-contents
        PC-->>PD: qry: reply page + next
    end
    Note over PD: snapshot loaded, guards seeded<br/>(snapshot shapes not modelled)
    K->>PD: evt: catch-up on all three topics<br/>from the recorded offsets
    Note over PD: never on a user request,<br/>guards make the overlap safe
```

Derived from: `model.yaml → contexts[product-discovery].business_decisions`
(5), `.sync_calls`; `conventions.cross_model` (`ops_only_exceptions`).

Omitted: `GetProductContent` and `ListCategories`, which
`product-content`'s inbound row also names from this context but
`sync_calls` does not (a model gap on the
[canvas](/storefront/contexts/product-discovery/bounded-context-canvas)),
and the single-item reads. The ops-only `GET /listings` call is the one
documented in-org exception; everything else rides the network's Open Host
Service.
