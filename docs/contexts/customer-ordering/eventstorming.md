---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: Process-level EventStorming boards for Customer Ordering, covering checkout, fulfilment progress and tracking, and cancellation, with hotspots taken only from gaps and risks in the model.
---

# EventStorming

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Process-level boards in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky comes from `model.yaml`. Events published by a
neighbour are drawn as orange stickies prefixed with the producer. Every
hotspot is a gap or a risk the model itself shows, and its source is given in
the hotspot table. The big-picture board for the whole network is
[EventStorming big picture](/strategic-design/eventstorming-big-picture).
Boards 1 and 3 are drawn top to bottom and board 2 is split in two, because
left to right they would not fit the page width.

## Legend

| Colour | Sticky | Meaning here |
| --- | --- | --- |
| Pale yellow `#fff59d` | Actor | The shopper (via the storefront, e2e-tests or a future UI) |
| Blue `#a5d8ff` | Command | A command from `aggregates[*].commands` or a sync call from `sync_calls` |
| Yellow `#ffec99` | Aggregate | `CustomerOrder` or `Shopper` |
| Orange `#ffc078` | Domain Event | Ours (`publishes`) or a neighbour's (`consumes`, prefixed with the producer) |
| Lilac `#d0bfff` | Policy | `policies`, or the reaction a command takes to an event |
| Green `#b2f2bb` | Read Model | `OrderTrackingView`, or the restricted ship-to read |
| Pink `#fcc2d7` | External System | A sibling context |
| Red `#ff8787` | Hotspot | A gap or risk in the model (see the table at the end) |

## 1. Checkout and shopper registration

```mermaid
flowchart TB
    SH["Shopper<br/>via storefront"]:::actor
    C0["RegisterShopper<br/>POST /shoppers"]:::command
    G0["Shopper"]:::aggregate
    C1["PlaceOrder<br/>POST /checkout"]:::command
    P1["CheckoutPromising<br/>promise each group from<br/>the offer the shopper saw"]:::policy
    C2["MakePromise<br/>POST /promises"]:::command
    C3["QuoteDeliveryOffers<br/>when the offer expired"]:::command
    DP["delivery-promise"]:::external
    G1["CustomerOrder"]:::aggregate
    E1["CustomerOrderPlaced"]:::event
    OS["order-sourcing<br/>QueueAssignment"]:::external
    DP2["delivery-promise<br/>ConfirmPromise"]:::external
    H1["H1 one offer per item,<br/>one promise per group"]:::hotspot
    H2["H2 hold may expire<br/>before ConfirmPromise"]:::hotspot
    H8["H8 caller of<br/>POST /shoppers not named"]:::hotspot

    SH --> C0 --> G0
    SH --> C1 --> P1
    P1 --> C2 --> DP
    DP -->|offer expired| C3
    C3 --> DP
    DP -->|promise per group| G1
    G1 --> E1
    E1 --> OS
    E1 --> DP2
    C2 --- H1
    E1 --- H2
    C0 --- H8

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[customer-ordering].aggregates[*].commands`,
`.sync_calls`, `.policies[CheckoutPromising]`, `.publishes[CustomerOrderPlaced]`;
`contexts[delivery-promise].aggregates[DeliveryOffer, Promise]`;
`contexts[order-sourcing].aggregates[FulfillmentAssignment].commands`.

Omitted: the invariant checks inside `PlaceOrder` (`ErrLineWithoutPromise`,
`ErrPromiseDestinationMismatch`), the 409 answers from `delivery-promise`
(`ErrOfferNotQuotable`, `ErrPromiseCapacityExhausted`, `ErrBookClosed`), and
the outbox. `Shopper` raises no event, so it has no orange sticky.

## 2. Fulfilment progress and tracking

```mermaid
flowchart LR
    E1["OS FulfillmentLocked"]:::event
    E2["OS FulfillmentShipped"]:::event
    E3["ST PackageDelivered"]:::event
    E4["DP PromiseRevised"]:::event
    C1["MarkInFulfillment"]:::command
    C2["MarkGroupShipped"]:::command
    C3["MarkGroupDelivered"]:::command
    C4["UpdateGroupPromise"]:::command
    P1["Policy: status moves<br/>forward only"]:::policy
    G1["CustomerOrder"]:::aggregate
    H4["H4 group delivered while<br/>order PARTIALLY_SHIPPED"]:::hotspot
    H5["H5 GroupPromise lacks<br/>per-group progress fields"]:::hotspot

    E1 --> C1 --> P1
    E2 --> C2 --> P1
    E3 --> C3 --> P1
    E4 --> C4 --> G1
    P1 --> G1
    C3 --- H4
    G1 --- H5

    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

The tracking side of the same events, and the one PII read:

```mermaid
flowchart LR
    ST["shipping-and-tracking"]:::external
    E1["OS FulfillmentLocked,<br/>FulfillmentShipped"]:::event
    E5["ST LabelIssued, PackageScanned,<br/>PackageDelivered,<br/>PackageExceptionRaised"]:::event
    E6["DP PromiseAtRisk, PromiseRevised,<br/>PromiseKept, PromiseBroken"]:::event
    RM1["OrderTrackingView<br/>GET tracking"]:::readmodel
    RM2["Ship-to read<br/>GET ship-to, restricted"]:::readmodel
    H3["H3 restricted route,<br/>but no auth"]:::hotspot

    E1 --> RM1
    E5 --> RM1
    E6 --> RM1
    ST -->|label printing| RM2
    RM2 --- H3

    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[customer-ordering].consumes`,
`.aggregates[CustomerOrder].commands`, `.invariants` (`ErrStatusRegression`),
`.read_models[OrderTrackingView]`, `.inbound` (`GetShipTo`, `GetTracking`).

The prefixes OS, ST and DP name the producer (`order-sourcing`,
`shipping-and-tracking`, `delivery-promise`). Omitted: the inbox, and the
shopper's `GetOrder`. The pairing of each event with a command is this
pack's reading. The model lists both sides but not the pairs.

## 3. Cancellation

```mermaid
flowchart TB
    SH["Shopper<br/>via storefront"]:::actor
    OS["order-sourcing"]:::external
    C1["CancelOrder<br/>POST orders:cancel"]:::command
    E0["OS FulfillmentUnsourceable"]:::event
    P1["CancelOnUnfulfillable<br/>no revised promise feasible:<br/>cancel the group"]:::policy
    P2["Policy: cancel only while<br/>no group is locked"]:::policy
    G1["CustomerOrder"]:::aggregate
    E1["CustomerOrderCancelled"]:::event
    DP["delivery-promise<br/>CancelPromise"]:::external
    OS2["order-sourcing<br/>CancelAssignment"]:::external
    H6["H6 no event says<br/>re-promise not feasible"]:::hotspot
    H7["H7 cancel wording, and<br/>IN_FULFILLMENT to CANCELLED"]:::hotspot
    H9["H9 no UNSOURCEABLE to<br/>CANCELLED in order-sourcing"]:::hotspot
    H10["H10 lock not yet seen<br/>when the cancel is accepted"]:::hotspot

    SH --> C1
    OS --> E0 --> P1
    P1 --> C1
    C1 --> P2 --> G1
    G1 --> E1
    E1 --> DP
    E1 --> OS2
    P1 --- H6
    P2 --- H7
    OS2 --- H9
    G1 --- H10

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[customer-ordering].business_decisions`,
`.aggregates[CustomerOrder].invariants` (`ErrCancelAfterLock`),
`.transitions`, `.policies[CancelOnUnfulfillable]`,
`.publishes[CustomerOrderCancelled]`; `contexts[order-sourcing].aggregates[FulfillmentAssignment].transitions`;
`contexts[delivery-promise].policies[RepromiseOnRisk]`.

Omitted: the 409 answer to a refused cancellation (`cancel-after-lock`), the
re-promise branch (`PromiseRevised` → `UpdateGroupPromise`, board 2), and
returns after the lock (future `customer-returns`).

## Hotspots

| # | Hotspot | Where it comes from in the model |
| --- | --- | --- |
| H1 | A `DeliveryOffer` is quoted for one catalogue item and quantity, but a `Promise` covers a multi-line shipment group and names one `offerId`. The model does not say how a group of several lines maps to one offer. | `contexts[delivery-promise].aggregates[DeliveryOffer].description` vs `.aggregates[Promise]` and `publishes[PromiseMade].data` |
| H2 | `delivery-promise` confirms the promise only when it consumes `CustomerOrderPlaced`. If that happens after `holdExpiresAt`, `ConfirmPromise` fails (`ErrPromiseHoldExpired`) and the promise is `RELEASED`. `PromiseReleased` goes to analytics only, so this context never learns that a placed order has no promise. | `contexts[delivery-promise].aggregates[Promise].invariants`, `.transitions` (`ReleaseExpiredHolds`), `publishes[PromiseReleased].consumers` |
| H3 | `GET /orders/{orderId}/ship-to` is "in-org, restricted", but the network has no authentication. | `contexts[customer-ordering].inbound`; `conventions.no_auth` |
| H4 | There is no transition for a group delivered while the order is `PARTIALLY_SHIPPED`, and no partially-delivered status. | `contexts[customer-ordering].aggregates[CustomerOrder].transitions` |
| H5 | `GroupPromise` has no field for a group's lock, shipment, delivery or cancellation. `ErrCancelAfterLock` and the `PARTIALLY_SHIPPED`/`SHIPPED` choice need one. It also lacks `tier`, `witnessNodeId` and `shipBy`, which `CustomerOrderPlaced` publishes. | `aggregates[CustomerOrder].value_objects`, `.invariants`, `publishes[CustomerOrderPlaced].data` |
| H6 | `CancelOnUnfulfillable` waits for "no revised promise is feasible", but no event says so. `delivery-promise` reports an infeasible re-promise only as `PromiseBroken` at judgement, which needs a delivery. | `policies[CancelOnUnfulfillable]`; `contexts[delivery-promise].policies[RepromiseOnRisk]` |
| H7 | The business decision allows cancel "until every shipment group is locked". The invariant allows it only "while no group is locked". If `IN_FULFILLMENT` starts at the first lock, `IN_FULFILLMENT → CANCELLED` can never pass `ErrCancelAfterLock`. | `business_decisions`, `aggregates[CustomerOrder].invariants`, `.transitions` |
| H8 | `POST /shoppers` (`RegisterShopper`) is in `rest`, but no `inbound` row names its caller. | `contexts[customer-ordering].rest` vs `.inbound` |
| H9 | `order-sourcing` consumes `CustomerOrderCancelled`, but `FulfillmentAssignment` can be cancelled only from `QUEUED` or `RELEASED`, not from `UNSOURCEABLE`. That is the state of the group `CancelOnUnfulfillable` cancels. | `contexts[order-sourcing].aggregates[FulfillmentAssignment].transitions` |
| H10 | This context learns of a lock only from `FulfillmentLocked`. A cancel accepted between the vendor's acceptance and that event passes `ErrCancelAfterLock` here. `order-sourcing` then refuses `CancelAssignment` with its own `ErrCancelAfterLock`, and the model has no compensation. | `contexts[customer-ordering].aggregates[CustomerOrder].invariants`; `contexts[order-sourcing].aggregates[FulfillmentAssignment].invariants`, `policies[LockOnCommit]` |
