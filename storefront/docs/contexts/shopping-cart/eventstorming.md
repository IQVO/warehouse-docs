---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: Process-level EventStorming boards for Shopping Cart, covering cart building, the delivery quote and selection, the estimate views, and the cart lifecycle policies, with hotspots taken only from gaps and risks in the model.
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
| Pale yellow `#fff59d` | Actor | The shopper (through the BFF), the clock |
| Blue `#a5d8ff` | Command | A command from `aggregates[Cart].commands` |
| Yellow `#ffec99` | Aggregate | The `Cart` aggregate and its held quote |
| Orange `#ffc078` | Domain Event | Ours (`publishes`) or a neighbour's (`consumes`, prefixed with the producer) |
| Lilac `#d0bfff` | Policy | `policies`, or the reaction a command takes to an event |
| Green `#b2f2bb` | Read Model | `PurchasabilityView`, `EstimateView`, `CheckoutReadiness`, a read route |
| Pink `#fcc2d7` | External System | A sibling context or the network (`pricing`, `offer-availability`, `delivery-promise`, `checkout`, analytics) |
| Red `#ff8787` | Hotspot | A gap or risk in the model (see the table at the end) |

## 1. Cart building

```mermaid
flowchart LR
    S["Shopper<br/>via storefront-bff"]:::actor
    C0["CreateCart<br/>POST /carts"]:::command
    C1["AddLine<br/>POST /carts/cartId/lines"]:::command
    C2["SetLineQuantity<br/>POST ...:set-quantity"]:::command
    C3["RemoveLine<br/>POST ...:remove"]:::command
    C4["MergeInto<br/>POST /carts/cartId:merge-into"]:::command
    RM0["PurchasabilityView"]:::readmodel
    G1["Cart"]:::aggregate
    E1["CartLineAdded"]:::event
    AN(["analytics"]):::actor
    H1["H1 only AddLine<br/>publishes an event"]:::hotspot
    H2["H2 ErrDuplicateLine<br/>names the merge rule"]:::hotspot

    S --> C0
    S --> C1
    S --> C2
    S --> C3
    S --> C4
    C1 --> RM0
    RM0 -->|purchasable| G1
    C0 --> G1
    C1 --> G1
    C2 --> G1
    C3 --> G1
    C4 --> G1
    G1 --> E1
    E1 --> AN
    C2 --- H1
    C3 --- H1
    C4 --- H1
    C1 --- H2

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[shopping-cart].inbound` (BFF cmd row),
`.aggregates[Cart].commands` + `.invariants`, `.publishes[CartLineAdded]`,
`.read_models[PurchasabilityView]`.

Omitted: the invariant errors on the add path
(`ErrQuantityOutOfRange`, `ErrTooManyLines`, `ErrItemNotPurchasable`,
`ErrCartClosed` on a closed cart, `ErrMergeTarget` on a bad merge target)
and the outbox. Every mutating command on this board also clears the quote
and the selections (business decision 3; board 2).

## 2. Destination, quote and selection

```mermaid
flowchart LR
    S["Shopper<br/>via storefront-bff"]:::actor
    C5["SetDestination<br/>POST ...:set-destination"]:::command
    C6["QuoteDelivery<br/>POST ...:quote-delivery"]:::command
    C7["SelectDelivery<br/>POST ...:select-delivery"]:::command
    DP["delivery-promise<br/>(network)"]:::external
    Q["Delivery Quote<br/>groups, QuotedOffers,<br/>unavailable tiers"]:::aggregate
    G1["Cart"]:::aggregate
    E2["CartDeliveryQuoted"]:::event
    RM1["CheckoutReadiness<br/>every group selected,<br/>no offer expired"]:::readmodel
    AN(["analytics"]):::actor
    H6["H6 estimate before<br/>a destination exists"]:::hotspot

    S --> C5
    S --> C6
    S --> C7
    C6 -->|qry QuoteDeliveryOffers<br/>POST /delivery-offers:quote| DP
    DP -->|groups with offers,<br/>windows, expiries| Q
    C6 -->|ErrNoDestination<br/>without a prefix| G1
    Q --> G1
    C7 -->|selections groupNo to offerId,<br/>ErrStaleDeliverySelection| G1
    G1 --> E2
    E2 --> AN
    G1 --> RM1
    C6 --- H6

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[shopping-cart].sync_calls`,
`.aggregates[Cart]` (`QuotedOffer`, `DeliverySelection` value objects,
`ErrNoDestination`, `ErrStaleDeliverySelection`),
`.publishes[CartDeliveryQuoted]`, `.read_models[CheckoutReadiness]`;
`network/model/model.yaml → contexts[delivery-promise].inbound`.

Omitted: the estimate arithmetic (board 3) and the offer expiry clock
(readiness compares `expiresAt`; no event announces an expiry). A quote
holds no capacity: the offers are `delivery-promise` facts frozen at quote
time, and capacity is held only when checkout places the order.

## 3. The estimate and the views

```mermaid
flowchart LR
    PR["pricing"]:::external
    OA["offer-availability<br/>(network)"]:::external
    E3["PR ItemPriceChanged,<br/>ItemPriceWithdrawn"]:::event
    E4["PR DeliveryChargeScheduleChanged,<br/>TaxTableChanged"]:::event
    E5["OA CatalogItemCreated,<br/>CatalogItemDiscontinued"]:::event
    RM0["PurchasabilityView"]:::readmodel
    RM2["EstimateView<br/>effective prices, tier<br/>charges, tax bands"]:::readmodel
    RM3["Estimate<br/>labelled, non-binding"]:::readmodel
    CK["checkout"]:::external
    H3["H3 purchasability narrower<br/>than discovery's verdict"]:::hotspot

    PR --> E3
    PR --> E4
    OA --> E5
    E3 --> RM0
    E5 --> RM0
    E3 --> RM2
    E4 --> RM2
    RM2 --> RM3
    RM0 -->|ErrItemNotPurchasable<br/>on AddLine| CK
    RM0 --- H3

    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[shopping-cart].consumes`,
`.read_models[PurchasabilityView, EstimateView]`;
`contexts[product-discovery].ul[Purchasable]` (the comparison behind H3).

Omitted: `CheckoutReadiness` (derived from the cart itself, board 2) and
the inbox. No pricing or catalogue event touches the `Cart` aggregate: a
price move never clears a quote — it moves the estimate, which is why the
estimate can be labelled non-binding (gap S2, answered by the binding
`PriceQuote` at checkout).

## 4. Cart lifecycle

```mermaid
flowchart LR
    T(["Clock"]):::actor
    CK["checkout"]:::external
    E6["CK CheckoutCompleted"]:::event
    P1["AbandonInactive<br/>no change for 30 days"]:::policy
    P2["CloseOnCheckoutCompleted"]:::policy
    C8["AbandonInactive"]:::command
    C9["CloseOnCheckoutCompleted"]:::command
    G1["Cart<br/>OPEN terminal states"]:::aggregate
    E7["CartAbandoned"]:::event
    E8["CartCheckedOut"]:::event
    AN(["analytics"]):::actor
    H4["H4 the .events topic<br/>carries nothing"]:::hotspot
    H5["H5 purge of abandoned<br/>carts is unnamed"]:::hotspot

    T --> P1
    P1 --> C8
    E6 --> P2
    P2 --> C9
    C8 --> G1
    C9 --> G1
    CK --> E6
    G1 --> E7
    G1 --> E8
    E7 --> AN
    E8 --> AN
    E7 --- H4
    E8 --- H4
    C8 --- H5

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[shopping-cart].policies`,
`.aggregates[Cart]` (`states`, `transitions`, `ErrCartClosed`),
`.publishes`, `.size_estimate`; `contexts[checkout].publishes[CheckoutCompleted]`.

Omitted: `MergeInto` (board 1) and the inbox. `CHECKED_OUT`, `ABANDONED`
and `MERGED` are terminal: `ErrCartClosed` rejects every later change. A
`CheckoutCompleted` for a cart that is not `OPEN` has no transition in the
model — in practice the race needs a session to outlive 30 idle days.

## Hotspots

| # | Hotspot | Where it comes from in the model |
| --- | --- | --- |
| H1 | Only `AddLine` publishes an event. `SetLineQuantity`, `RemoveLine`, `SetDestination`, `SelectDelivery`, `MergeInto` and `CreateCart` raise nothing, so analytics sees adds, quotes, abandons and checkouts but never a removal or a merge. | `aggregates[Cart].commands` vs `publishes` |
| H2 | `ErrDuplicateLine` names a rule whose stated behaviour is a merge ("adding an existing item merges quantities"); the REST contract reads it as "the invariant behind the merge". No input in the model is ever rejected with it. | `aggregates[Cart].invariants`, `storefront/apis/shopping-cart/openapi.yaml` (`addCartLine`) |
| H3 | `PurchasabilityView` is fed by catalogue and price events only; `product-discovery`'s `Purchasable` also requires content `PUBLISHED` and a `LIVE` listing with stock. The cart can accept an item discovery would refuse; the gap surfaces later at checkout's quote. | `read_models[PurchasabilityView]` vs `contexts[product-discovery].ul[Purchasable]` |
| H4 | All four published events are analytics-only, so `retailnetwork.shopping-cart.events` carries nothing and no sibling or network context consumes a cart fact; checkout reads the cart synchronously instead. | `publishes` rows ("analytics only"); `conventions.integration_rules` |
| H5 | The size estimate says "abandoned carts purged", but no command or policy names the purge, its retention or its visible effect. | `aggregates[Cart].size_estimate` vs `.commands`, `.policies` |
| H6 | The estimate is defined as effective prices plus selected tier charges plus tax band; with no destination there is no quote, no charge and no band, and the model does not say what the estimate shows before a destination is set. | `purpose`, `business_decisions` (estimate bullet), `invariants[ErrNoDestination]` |
