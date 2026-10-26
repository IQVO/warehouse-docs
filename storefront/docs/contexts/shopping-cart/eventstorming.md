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
    C4b["AcceptRequotedOffers<br/>POST /carts/cartId/delivery/requoted<br/>OPEN to OPEN, no delivery-promise call"]:::command
    RM0["PurchasabilityView"]:::readmodel
    G1["Cart"]:::aggregate
    E1["CartLineAdded"]:::event
    AN(["analytics"]):::actor

    S --> C0
    S --> C1
    S --> C2
    S --> C3
    S --> C4
    S --> C4b
    C1 --> RM0
    RM0 -->|purchasable| G1
    C0 --> G1
    C1 --> G1
    C2 --> G1
    C3 --> G1
    C4 --> G1
    C4b --> G1
    G1 --> E1
    E1 -->|only AddLine publishes, by design| AN

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
and the outbox. Adding an existing item merges quantities into the one
line; nothing is rejected as a duplicate. Only `AddLine` publishes, by
design: analytics needs add, quote, abandon and checkout. Every mutating
command on this board except `AcceptRequotedOffers` also clears the quote
and the selections (business decision 3; board 2).
`AcceptRequotedOffers {offers[]}` writes the selected delivery from the
supplied set without calling `delivery-promise`; checkout re-verifies the
offers through its pre-authorize check.

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
    ES["Estimate without a destination<br/>item subtotal only,<br/>estimateComplete=false"]:::readmodel

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
    C5 --> ES

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
```

Derived from: `model.yaml → contexts[shopping-cart].sync_calls`,
`.aggregates[Cart]` (`QuotedOffer`, `DeliverySelection` value objects,
`ErrNoDestination`, `ErrStaleDeliverySelection`),
`.publishes[CartDeliveryQuoted]`, `.read_models[CheckoutReadiness]`;
`network/model/model.yaml → contexts[delivery-promise].inbound`.

Before a destination is set the estimate shows the item subtotal only with
`estimateComplete=false`; the delivery charge and tax appear once a
destination exists. Omitted: the estimate arithmetic (board 3) and the offer expiry clock
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

    PR --> E3
    PR --> E4
    OA --> E5
    E3 --> RM0
    E5 --> RM0
    E3 --> RM2
    E4 --> RM2
    RM2 --> RM3
    RM0 -->|ErrItemNotPurchasable<br/>on AddLine| CK

    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
```

Derived from: `model.yaml → contexts[shopping-cart].consumes`,
`.read_models[PurchasabilityView, EstimateView]`;
`contexts[product-discovery].ul[Purchasable]`. The cart is lenient by
design: it accepts any catalogued, priced item, and checkout's binding
quote is the gate.

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
    P3["PurgeAbandonedCarts<br/>idle 30 days, deleted, no event"]:::policy

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
    G1 --> P3
    T --> P3

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
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
| H1 | **Resolved in the model-fix (by design):** only `AddLine` publishes an event, because analytics needs add, quote, abandon and checkout. Removals, quantity changes, destination changes, selections and merges raise nothing. No new events. | `business_decisions`; `aggregates[Cart].commands` vs `publishes` |
| H2 | **Resolved in the model-fix:** `ErrDuplicateLine` is removed. Adding an existing item merges quantities into its line; nothing is ever rejected with it. The REST wording and this pack are corrected. | `aggregates[Cart].invariants`, `storefront/apis/shopping-cart/openapi.yaml` (`addCartLine`) |
| H3 | **Resolved in the model-fix (by design):** `PurchasabilityView` is lenient. The cart accepts any catalogued, priced item; `product-discovery`'s stricter `Purchasable` is not mirrored and checkout's binding quote is the gate. Stated in the cart and discovery context-map relationship. | `business_decisions`; `read_models[PurchasabilityView]` |
| H4 | **Resolved in the model-fix (by design):** no cart consumer. All four events are analytics-only; checkout reads the cart synchronously (`GET /carts/{cartId}`). | `publishes`; `business_decisions` |
| H5 | **Resolved in the model-fix:** the policy `PurgeAbandonedCarts` (scheduled) deletes carts idle for 30 days and raises no event. | `policies[PurgeAbandonedCarts]` |
| H6 | **Resolved in the model-fix:** with no destination the estimate shows the item subtotal only with `estimateComplete=false`; the delivery charge and tax appear once a destination is set. | `business_decisions`; `aggregates[Cart].notes`; `apis/shopping-cart/openapi.yaml` (`Estimate`) |
