---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: Process-level EventStorming boards for Product Discovery, covering the availability feed, the content and price feeds, shopper search, and the ops-run bootstrap rebuild, with hotspots taken only from gaps and risks in the model.
---

# EventStorming

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

Process-level boards in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky comes from `model.yaml`. Events published by a
neighbour are drawn as orange stickies prefixed with the producer. Every
hotspot is a gap or a risk the model itself shows, and its source is given
in the hotspot table. The boards are drawn left to right and kept narrow to
fit the page width.

This context has **no command and no aggregate of its own**, so the
classic command-aggregate-event chain appears here only on the feed side:
a neighbour's event enters, a **projector** (drawn as a policy) folds it
into a read model under a guard, and the verdict the shopper sees
(`purchasable`) is derived — never commanded into a state.

## Legend

| Colour | Sticky | Meaning here |
| --- | --- | --- |
| Pale yellow `#fff59d` | Actor | The shopper (via the BFF) or the storefront operator |
| Yellow `#ffec99` | Read model | `ProductView`, `CategoryView` (this context has no aggregate) |
| Orange `#ffc078` | Domain Event | A neighbour's (`consumes`, prefixed with the producer); none of our own |
| Lilac `#d0bfff` | Policy | The projector with its guard, `PurchasableRule`, `UnavailableNotBuyable` |
| Blue `#a5d8ff` | Query | `SearchProducts`, `GetProduct`, `ListCategories` |
| Green `#b2f2bb` | Search | The `SearchPort` and its index |
| Pink `#fcc2d7` | External System | A sibling or network context |
| Red `#ff8787` | Hotspot | A gap or risk in the model (see the table at the end) |

## 1. The availability feed

```mermaid
flowchart LR
    OA["offer-availability<br/>(network)"]:::external
    E1["OA ListingAvailabilityChanged<br/>availableQty, asOf"]:::event
    P1["Projector<br/>inbox on id, asOf guard"]:::policy
    RM["ProductView<br/>listing quantities"]:::readmodel
    P2["PurchasableRule<br/>item ACTIVE, content PUBLISHED,<br/>price ACTIVE, LIVE listing<br/>with quantity above 0"]:::policy
    RM2["ProductView<br/>inStock, purchasable"]:::readmodel
    H1["H1 suppress or restore carries<br/>only listingId"]:::hotspot
    H4["H4 no cross-key order:<br/>a listing fact may precede<br/>its CatalogItemCreated"]:::hotspot

    OA --> E1 --> P1 --> RM --> P2 --> RM2
    P1 --- H1
    RM --- H4

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef readmodel fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef query fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef search fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[product-discovery].consumes`
(the six `offer-availability` events), `.business_decisions` (4),
`.policies[PurchasableRule]`, `.read_models[ProductView]`.

Omitted: `ListingCreated` (learns the listing-to-item mapping),
`ListingSuppressed`/`ListingRestored` (flip one listing's state, never
count when SUPPRESSED), `CatalogItemCreated`/`CatalogItemDiscontinued`
(title, flags, the ACTIVE input of the rule), and the search index write
that rides along.

## 2. The content and price feeds

```mermaid
flowchart LR
    PC["product-content"]:::external
    E1["PC ProductContentPublished<br/>revision"]:::event
    PR["pricing"]:::external
    E2["PR ItemPriceChanged<br/>effectivePriceMinor, version"]:::event
    P1["Projector<br/>revision and version guards"]:::policy
    RM["ProductView<br/>content, category path,<br/>effective price"]:::readmodel
    S["Search index<br/>tsvector + GIN, trgm"]:::search
    H2["H2 bullets, media, list price<br/>not in declared consume fields"]:::hotspot
    H3["H3 a category rename never<br/>re-indexes categoryPath"]:::hotspot

    PC --> E1 --> P1
    PR --> E2 --> P1
    P1 --> RM --> S
    E1 --- H2
    E2 --- H2
    S --- H3

    classDef readmodel fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef search fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[product-discovery].consumes`
(`ProductContentPublished`, `ProductContentRetired`,
`CategoryTreePublished`, `ItemPriceChanged`, `ItemPriceWithdrawn`),
`.business_decisions` (2, 4).

Omitted: `ProductContentRetired` and `ItemPriceWithdrawn` (the verdict goes
false, the row stays), and the `CategoryView` rebuild
(board 4). The index weights (title A, category names A, attributes B,
description C) are business decision 2.

## 3. Shopper search

```mermaid
flowchart LR
    SH["Shopper<br/>(storefront-bff)"]:::actor
    Q1["SearchProducts<br/>GET /products"]:::query
    S["SearchPort<br/>PostgreSQL FTS + pg_trgm<br/>(D9, adapter-swap later)"]:::search
    RM["ProductView rows"]:::readmodel
    P1["Product-type queries also<br/>return category suggestions<br/>(benchmark 6)"]:::policy
    H5["H5 no named policy, rule or<br/>thresholds for product-type<br/>detection"]:::hotspot
    H6["H6 price-band facet edges<br/>and the trgm fallback<br/>trigger are unspecified"]:::hotspot

    SH --> Q1 --> S --> RM
    Q1 --- P1
    P1 --- H5
    S --- H6

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef readmodel fill:#ffec99,stroke:#e67700,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef query fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef search fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[product-discovery].inbound` (the BFF
query row), `.rest`, `.business_decisions` (2, 3), `.ul[Product-Type
Query]`.

Omitted: `GetProduct` and `ListCategories` (the same store reads without
the search path), the facets' counts (a group-by over the same rows), and
every write path — there is none: no command sticky can exist in this
context.

## 4. Category tree and the bootstrap rebuild

```mermaid
flowchart LR
    PC["product-content"]:::external
    E1["PC CategoryTreePublished<br/>version, whole tree"]:::event
    P1["Projector<br/>version guard"]:::policy
    RM["CategoryView<br/>tree + purchasable counts"]:::readmodel
    OP["Storefront operator<br/>(ops)"]:::actor
    B1["Rebuild: snapshot + catch-up<br/>GET /catalog, GET /listings<br/>(ops-only), GET /item-prices,<br/>GET /product-contents, then events"]:::policy
    H7["H7 snapshot response shapes<br/>not modelled: guard seeding<br/>unspecified"]:::hotspot
    H8["H8 sync_calls lists<br/>ListProductContents only;<br/>product-content inbound also names<br/>GetProductContent, ListCategories"]:::hotspot

    PC --> E1 --> P1 --> RM
    OP --> B1 --> RM
    B1 --- H7
    B1 --- H8

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef readmodel fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[product-discovery].consumes`
(`CategoryTreePublished`), `.read_models[CategoryView]`,
`.business_decisions` (5), `.sync_calls`;
`contexts[product-content].inbound`.

Omitted: the catch-up consumption itself (board 1 and 2's projectors, from
the recorded offsets) and the rebuild of the search index, which the
snapshot seeds in the same pass. The `GET /listings` read is in-org and
ops-only — never on a user request (the documented exception in
`conventions.cross_model`).

## Hotspots

| # | Hotspot | Where it comes from in the model |
| --- | --- | --- |
| H1 | `ListingSuppressed` and `ListingRestored` declare only `listingId` as needed, so the projector must keep the listing-to-item mapping learned from `ListingCreated`; the mapping is a read-side fact the model names nowhere. | `contexts[product-discovery].consumes` vs `.read_models[ProductView]` |
| H2 | The `ProductView` purpose and the proposed API render bullets, media and the list price, but the declared `consumes` fields name neither `bullets`/`media` (on `ProductContentPublished`) nor `listPriceMinor`/`currency` (on `ItemPriceChanged`). | `.purpose`, `apis/product-discovery/openapi.yaml` vs `.consumes` |
| H3 | `read_models[ProductView].source` does not list `CategoryTreePublished`, yet the row carries `categoryPath` and the index weights category names (A): a rename or move never re-indexes existing rows. | `.read_models` vs `.business_decisions` (2) |
| H4 | `catalogitem.*` events are keyed by `catalogItemId` and `listing.*` by `listingId`, so Kafka promises no cross-key order; the guards are per source, not cross-source. The projector must tolerate a listing fact before its `CatalogItemCreated`. | `conventions.cloudevents` (subject is the key); `.business_decisions` (4) |
| H5 | The product-type-query rule (decision 3, UL term with code `(search policy)`) has no named policy — `policies` lists only `PurchasableRule` and `UnavailableNotBuyable` — and no detection rule or thresholds. | `.business_decisions`, `.ul` vs `.policies` |
| H6 | The price-band facet edges and the `pg_trgm` fallback trigger ("when full-text search returns too little" is this pack's reading) are unspecified. | `.business_decisions` (2) |
| H7 | The bootstrap snapshot reads (`ListCatalog`, `ListListings`, `ListItemPrices`, `ListProductContents`) declare no response fields in either model, so how the catch-up guards are seeded from the snapshot is unspecified. | `.business_decisions` (5), `.sync_calls` vs both models |
| H8 | `sync_calls` names `ListProductContents` only, while `contexts[product-content].inbound` also names `GetProductContent` and `ListCategories` from `product-discovery`. | `.sync_calls` vs `contexts[product-content].inbound` |
