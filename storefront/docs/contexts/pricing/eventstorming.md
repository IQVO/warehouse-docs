---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: Process-level EventStorming boards for Pricing, covering price management, quote issuing for checkout, and the catalogue feed, with hotspots taken only from gaps and risks in the model.
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
in the hotspot table. Boards are drawn left to right; each stays within the
page width.

## Legend

| Colour | Sticky | Meaning here |
| --- | --- | --- |
| Pale yellow `#fff59d` | Actor | The storefront merchandiser, or `checkout` acting for a shopper |
| Blue `#a5d8ff` | Command | A command from `aggregates[*].commands` |
| Yellow `#ffec99` | Aggregate | `ItemPrice`, `DeliveryChargeSchedule`, `TaxTable`, `PriceQuote` |
| Orange `#ffc078` | Domain Event | Ours (`publishes`) or a neighbour's (`consumes`, prefixed with the producer) |
| Lilac `#d0bfff` | Policy | `policies`, or the reaction a command takes to an event |
| Green `#b2f2bb` | Read Model | `CatalogItemView`, or a read route |
| Pink `#fcc2d7` | External System | A sibling context (`offer-availability`, `checkout`, `product-discovery`, `shopping-cart`) |
| Red `#ff8787` | Hotspot | A gap or risk in the model (see the table at the end) |

## 1. Price management by the merchandiser

```mermaid
flowchart LR
    M["Storefront<br/>merchandiser"]:::actor
    C0["SetListPrice<br/>POST /item-prices"]:::command
    C1["ScheduleSale<br/>POST .../sales"]:::command
    C2["CancelSale<br/>POST .../sales/saleId:cancel"]:::command
    C3["WithdrawPrice"]:::command
    RM0["CatalogItemView"]:::readmodel
    G1["ItemPrice"]:::aggregate
    E1["ItemPriceChanged"]:::event
    E2["ItemPriceWithdrawn"]:::event
    PD["product-discovery"]:::external
    SC["shopping-cart"]:::external
    H1["H1 no WithdrawPrice<br/>route named"]:::hotspot
    H2["H2 CancelSale has no<br/>event of its own"]:::hotspot

    M --> C0
    M --> C1
    M --> C2
    M --> C3
    C0 --> RM0
    RM0 -->|known, not discontinued| G1
    C0 --> G1
    C1 --> G1
    C2 --> G1
    C3 --> G1
    G1 --> E1
    G1 --> E2
    E1 --> PD
    E1 --> SC
    E2 --> PD
    E2 --> SC
    C3 --- H1
    C2 --- H2

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[pricing].inbound` (merchandiser row),
`.aggregates[ItemPrice]` (`commands`, `invariants`), `.publishes`,
`.read_models[CatalogItemView]`.

Omitted: the invariant errors (`ErrNegativeAmount`, `ErrCurrencyMismatch`,
`ErrSaleNotBelowList`, `ErrOverlappingSaleWindow`, `ErrUnknownCatalogItem`),
the outbox, and the sale-boundary policy (board 2). The same board shape
covers `PublishChargeSchedule` and `PublishTaxTable` on
`DeliveryChargeSchedule` and `TaxTable`, emitting
`DeliveryChargeScheduleChanged` and `TaxTableChanged` to `shopping-cart`.

## 2. Time-driven price movement

```mermaid
flowchart LR
    T(["Clock"]):::actor
    P1["PublishEffectivePriceOnWindowBoundary<br/>sale starts or ends"]:::policy
    P2["QuoteTtl<br/>expires 15 min after issue"]:::policy
    G1["ItemPrice"]:::aggregate
    G4["PriceQuote"]:::aggregate
    C4["ExpireQuote"]:::command
    E1["ItemPriceChanged"]:::event
    PD["product-discovery"]:::external
    SC["shopping-cart"]:::external
    CK["checkout<br/>ExpireOnQuoteExpiry"]:::external
    H3["H3 ExpireQuote<br/>publishes nothing"]:::hotspot

    T --> P1
    P1 --> G1
    G1 --> E1
    E1 --> PD
    E1 --> SC
    T --> P2
    P2 --> C4
    C4 --> G4
    G4 -.->|no event| CK
    C4 --- H3

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[pricing].policies`,
`.aggregates[PriceQuote].transitions`; `contexts[checkout].policies[ExpireOnQuoteExpiry]`.

Omitted: the scheduler mechanics. `PublishEffectivePriceOnWindowBoundary`
is idempotent per item and boundary, so a redelivered tick is safe. The
dashed arrow to `checkout` is not a message: checkout mirrors the TTL
locally, which is exactly hotspot H3.

## 3. Quote issuing for checkout

```mermaid
flowchart LR
    CK["checkout<br/>session opened"]:::external
    C5["IssuePriceQuote<br/>POST /price-quotes"]:::command
    G1["ItemPrice<br/>effective prices"]:::aggregate
    G2["DeliveryChargeSchedule<br/>current"]:::aggregate
    G3["TaxTable<br/>current"]:::aggregate
    G4["PriceQuote"]:::aggregate
    E3["PriceQuoteIssued<br/>analytics only"]:::event
    AN(["analytics"]):::actor
    RM1["GetPriceQuote<br/>GET /price-quotes/quoteId"]:::readmodel
    H4["H4 request fields<br/>not in the model"]:::hotspot
    H5["H5 S2: price moves<br/>between cart and checkout"]:::hotspot

    CK --> C5
    C5 --> G1
    C5 --> G2
    C5 --> G3
    G1 --> G4
    G2 --> G4
    G3 --> G4
    G4 --> E3
    E3 --> AN
    CK --> RM1
    RM1 --> G4
    C5 --- H4
    G4 --- H5

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[pricing].inbound` (checkout rows),
`.aggregates[PriceQuote]` (`commands`, `invariants`, `description`),
`.publishes[PriceQuoteIssued]`; `contexts[checkout].sync_calls`.

Omitted: the error branch (`ErrItemNotPriced`, `ErrEmptyQuote`,
`ErrCurrencyMismatch` → 422) and the outbox. The quote pins the versions of
every input, so H5 is resolved at confirm by comparison, not by blocking
price changes.

## 4. The catalogue feed

```mermaid
flowchart LR
    OA["offer-availability<br/>(network)"]:::external
    E4["OA CatalogItemCreated"]:::event
    E5["OA CatalogItemDiscontinued"]:::event
    RM0["CatalogItemView"]:::readmodel
    P3["WithdrawOnDiscontinue"]:::policy
    C3["WithdrawPrice"]:::command
    G1["ItemPrice"]:::aggregate
    E2["ItemPriceWithdrawn"]:::event
    PD["product-discovery"]:::external
    SC["shopping-cart"]:::external
    H6["H6 create lags:<br/>SetListPrice too early"]:::hotspot

    OA --> E4
    OA --> E5
    E4 --> RM0
    E5 --> RM0
    E5 --> P3
    P3 --> C3
    C3 --> G1
    G1 --> E2
    E2 --> PD
    E2 --> SC
    E4 --- H6

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[pricing].consumes`, `.read_models`,
`.policies[WithdrawOnDiscontinue]`, `.publishes[ItemPriceWithdrawn]`;
`network/model/model.yaml → contexts[offer-availability].publishes`.

Omitted: the inbox. `CatalogItemCreated` and `CatalogItemDiscontinued`
share the `catalogItemId` Kafka key upstream, so the view sees them in
order per item.

## Hotspots

| # | Hotspot | Where it comes from in the model |
| --- | --- | --- |
| H1 | `rest` names no obvious `WithdrawPrice` route (no `:withdraw` action), although the command and the `ACTIVE → WITHDRAWN` transition exist. | `contexts[pricing].rest` vs `.aggregates[ItemPrice].commands` |
| H2 | `CancelSale` has no event of its own; these pages read it as republishing `ItemPriceChanged` with the effective price back at list. | `aggregates[ItemPrice].commands` vs `publishes` |
| H3 | `ExpireQuote` transitions `ISSUED → EXPIRED` but publishes no event, so `checkout` must mirror the TTL with its own `ExpireOnQuoteExpiry` policy instead of consuming a fact. | `aggregates[PriceQuote].events` (only `PriceQuoteIssued`); `contexts[checkout].policies` |
| H4 | `IssuePriceQuote`'s request fields are not in the model; `PriceQuoteIssued` carries `cartId`, and the quote's description names lines, groups and versions, so the request obviously carries them, but nothing says so. | `inbound` (checkout cmd row), `publishes[PriceQuoteIssued].data`, `aggregates[PriceQuote].description` |
| H5 | A price can move between the cart's non-binding estimate and checkout. Resolved by design: the binding `PriceQuote` pins versions and the review page shows the binding total; tracked as gap S2. | `business_decisions` (PriceQuote bullet); [Model Gap Register](/storefront/strategic-design/model-gap-register) S2 |
| H6 | `SetListPrice` before `CatalogItemCreated` is consumed fails `ErrUnknownCatalogItem`; the merchandiser retries. The model names no pending state for "item announced, not yet visible". | `aggregates[ItemPrice].invariants`, `.read_models[CatalogItemView]` |
