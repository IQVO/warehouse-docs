---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: Process-level EventStorming boards for Delivery Promise - feeding the read models, quoting, promising with a capacity hold, confirming and releasing, re-promising and judging - with hotspots taken from the model's open questions.
---

# EventStorming

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

Process-level EventStorming in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky is a command, aggregate, event, policy or read model of
the model. Events of other contexts appear as orange stickies next to the
pink system that publishes them. Hotspots are real open questions or risks of
the model; each says where it comes from. The domain-wide board is
[the big-picture EventStorming](/network/strategic-design/eventstorming-big-picture).

## Legend

| Sticky | Colour | Meaning here |
| --- | --- | --- |
| Command | blue `#a5d8ff` | a command of `DeliveryOffer`, `Promise` or `PromiseBook` |
| Aggregate | yellow `#ffec99` | `DeliveryOffer`, `Promise`, `PromiseBook` |
| Domain Event | orange `#ffc078` | an event this context publishes, or one it consumes |
| Policy | lilac `#d0bfff` | a policy of the model (`PromisePolicy`, `RepromiseOnRisk`, ...) or a reaction to an event |
| Read Model | green `#b2f2bb` | one of the seven event-fed views |
| External System | pink `#fcc2d7` | another bounded context, the shopper's storefront, or the clock |
| Hotspot | red `#ff8787` | an open question or risk in the model |

## 1. Feeding the read models

### 1a. Topology and availability

```mermaid
flowchart LR
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    NT["node-topology"]:::external
    OA["offer-availability"]:::external
    E1["NodeRegistered<br/>NodeOperationalProfileDeclared<br/>NodeActivated<br/>NodeSuspended<br/>NodeRetired"]:::event
    E2["ServiceAreaAssigned<br/>RegionDefined"]:::event
    E3["LaneOpened<br/>LaneClosed"]:::event
    E4["CatalogItemCreated<br/>CatalogItemDiscontinued<br/>ListingCreated<br/>ListingAvailabilityChanged<br/>ListingSuppressed<br/>ListingRestored"]:::event
    P1["Policy: project into a view,<br/>inbox on CloudEvents id,<br/>monotonic guard"]:::policy
    R1["NodeProfileView"]:::readmodel
    R2["RegionAndServiceAreaView"]:::readmodel
    R3["LaneView"]:::readmodel
    R4["AvailabilityView"]:::readmodel
    NT --> E1
    NT --> E2
    NT --> E3
    OA --> E4
    E1 --> P1
    E2 --> P1
    E3 --> P1
    E4 --> P1
    P1 --> R1
    P1 --> R2
    P1 --> R3
    P1 --> R4
```

### 1b. Departures, waves and scorecards

```mermaid
flowchart TB
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    LH["linehaul-transportation"]:::external
    LM["last-mile-delivery"]:::external
    NP["node-performance"]:::external
    E5["DepartureScheduled<br/>DepartureCapacityChanged<br/>DepartureCancelled"]:::event
    E6["DeliveryWaveScheduled<br/>DeliveryWaveCapacityChanged"]:::event
    E7["NodeScorecardUpdated"]:::event
    P1["Policy: project into a view,<br/>inbox on CloudEvents id,<br/>monotonic guard"]:::policy
    R5["DepartureView"]:::readmodel
    R6["DeliveryWaveView"]:::readmodel
    R7["ScorecardView"]:::readmodel
    H1["Hotspot H1: DeliveryWaveCancelled<br/>is analytics-only, a cancelled<br/>wave stays in DeliveryWaveView"]:::hotspot
    LH --> E5
    LM --> E6
    NP --> E7
    E5 --> P1
    E6 --> P1
    E7 --> P1
    P1 --> R5
    P1 --> R6
    P1 --> R7
    R6 -.- H1
```

Derived from: `model.yaml → contexts[delivery-promise].read_models`, `.consumes`;
`conventions.integration_rules`; H1 from
`contexts[last-mile-delivery].publishes[DeliveryWaveCancelled].consumers`
(`analytics only`).

Omitted: `DepartureCancelled`'s second effect, the re-promise (board 5). Board
1 is split in two, and boards 2 to 6 are drawn top to bottom, to stay within
the page width.

## 2. Quoting a delivery offer

```mermaid
flowchart TB
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    SF["Shopper storefront<br/>or customer-ordering"]:::external
    CK["Clock"]:::external
    C1["QuoteDeliveryOffers"]:::command
    RM["Seven read models<br/>board 1"]:::readmodel
    P1["PromisePolicy<br/>earliest feasible<br/>witness path"]:::policy
    P2["ScorecardHandicap<br/>later shipBy by grade"]:::policy
    P3["TierOrderDeadline<br/>per tier and region"]:::policy
    P4["ShipmentGrouping<br/>fewest groups"]:::policy
    G1["DeliveryOffer<br/>QUOTED"]:::aggregate
    E1["DeliveryOfferQuoted<br/>analytics topic only"]:::event
    C2["ExpireOffers"]:::command
    H2["Hotspot H2: offer is per item,<br/>a promise covers a multi-line group"]:::hotspot
    H3["Hotspot H3: TierOrderDeadline<br/>has no owner, route or event"]:::hotspot
    H4["Hotspot H4: hot path trusts<br/>event-fed views, staleness"]:::hotspot
    SF --> C1
    C1 --> P4
    P4 --> P1
    RM --> P1
    P2 --> P1
    P3 --> P1
    P1 --> G1
    G1 --> E1
    CK --> C2
    C2 --> G1
    G1 -.- H2
    P3 -.- H3
    RM -.- H4
```

Derived from: `model.yaml → contexts[delivery-promise].aggregates[DeliveryOffer]`
(`commands`, `notes`), `.policies`; H2 from `.aggregates[DeliveryOffer].description`
against `.aggregates[Promise].value_objects[ShipmentGroup]` and
`.publishes[PromiseMade].data` (one `offerId`); H3 from `.policies[TierOrderDeadline]`
(no aggregate, route or event carries it); H4 from
`conventions.integration_rules` (the promise hot path makes no synchronous call).

Omitted: the four `OfferConstraint` values returned for a tier with no offer,
and the search steps (on [the use cases page](/network/contexts/delivery-promise/use-cases)
and in [the promise model](/network/network-model/promise-model)).

## 3. Making a promise and holding capacity

```mermaid
flowchart TB
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    CO["customer-ordering<br/>checkout"]:::external
    C1["MakePromise"]:::command
    G0["DeliveryOffer<br/>QUOTED to CONSUMED"]:::aggregate
    G1["Promise<br/>PROVISIONAL"]:::aggregate
    E1["PromiseMade"]:::event
    C2["HoldCapacity"]:::command
    G2["PromiseBook<br/>provisional plus 1"]:::aggregate
    P1["Policy: the hold that<br/>reaches share signals"]:::policy
    E2["PromiseBookExhausted"]:::event
    OS["order-sourcing"]:::external
    H5["Resolved H5: lazy opening,<br/>share formula, clock close"]:::hotspot
    CO --> C1
    C1 --> G0
    C1 --> G1
    G1 --> E1
    C1 --> C2
    C2 --> G2
    G2 --> P1
    P1 --> E2
    E2 --> OS
    G2 -.- H5
```

Derived from: `model.yaml → contexts[delivery-promise].aggregates[Promise]`,
`.aggregates[PromiseBook]`, `.aggregates[DeliveryOffer].transitions`,
`.publishes[PromiseBookExhausted].consumers`; H5
(resolved by G9) from `.aggregates[PromiseBook]` (`OpenBook`, `BookTimes`) and
`.policies[LazyBookOpening, BookShare, CloseBooksAtCutoff]`.

Omitted: the refusals (`ErrOfferNotQuotable`, `ErrPromiseCapacityExhausted`,
`ErrBookClosed`, `ErrGroupSpansNodes`), listed on
[the use cases page](/network/contexts/delivery-promise/use-cases).

## 4. Confirming, releasing and closing

```mermaid
flowchart TB
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    CO["customer-ordering"]:::external
    E0["CustomerOrderPlaced"]:::event
    P0["Policy: confirm every<br/>group's promise"]:::policy
    C1["ConfirmPromise"]:::command
    G1["Promise"]:::aggregate
    E1["PromiseConfirmed"]:::event
    C2["ConfirmCapacity"]:::command
    G2["PromiseBook"]:::aggregate
    CK["Clock"]:::external
    C3["ReleaseExpiredHolds"]:::command
    E3["PromiseReleased"]:::event
    C4["ReleaseCapacity"]:::command
    C5["CloseBook"]:::command
    H6["Hotspot H6: order placed after<br/>the hold expired, no recovery"]:::hotspot
    CO --> E0
    E0 --> P0
    P0 --> C1
    C1 --> G1
    G1 --> E1
    C1 --> C2
    C2 --> G2
    CK --> C3
    C3 --> G1
    G1 --> E3
    C3 --> C4
    C4 --> G2
    CK --> C5
    C5 --> G2
    P0 -.- H6
```

Derived from: `model.yaml → contexts[delivery-promise].aggregates[Promise].transitions`
(`PROVISIONAL → CONFIRMED`, `PROVISIONAL → RELEASED`),
`.aggregates[PromiseBook].commands`, `.consumes[CustomerOrderPlaced]`; H6 from
`.aggregates[Promise].invariants` (`ErrPromiseHoldExpired`) with confirmation
arriving asynchronously by event and no recovery policy in the model.

Omitted: nothing about the trigger. A clock job closes every `OPEN` book at its
`cutoffAt` (`policies[CloseBooksAtCutoff]`); holds are already refused from the
`holdDeadline`, the cutoff minus handling time.

## 5. Re-promising when the path breaks

```mermaid
flowchart TB
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    OS["order-sourcing"]:::external
    ST["shipping-and-tracking"]:::external
    LH["linehaul-transportation"]:::external
    E1["FulfillmentUnsourceable"]:::event
    E2["PackageExceptionRaised"]:::event
    E3["DepartureCancelled<br/>on the witness path"]:::event
    P1["RepromiseOnRisk"]:::policy
    C1["FlagPromiseAtRisk"]:::command
    G1["Promise<br/>AT_RISK"]:::aggregate
    E4["PromiseAtRisk"]:::event
    RM["Read models"]:::readmodel
    C2["RevisePromise<br/>never earlier"]:::command
    G2["Promise<br/>CONFIRMED"]:::aggregate
    E5["PromiseRevised"]:::event
    CO["customer-ordering"]:::external
    OS2["order-sourcing"]:::external
    H7["Hotspot H7: hold moved to<br/>the new book? not stated"]:::hotspot
    OS --> E1
    ST --> E2
    LH --> E3
    E1 --> P1
    E2 --> P1
    E3 --> P1
    P1 --> C1
    C1 --> G1
    G1 --> E4
    E4 --> CO
    RM --> P1
    P1 --> C2
    C2 --> G2
    G2 --> E5
    E5 --> CO
    E5 --> OS2
    C2 -.- H7
```

Derived from: `model.yaml → contexts[delivery-promise].policies[RepromiseOnRisk]`,
`.aggregates[Promise].transitions`, `.publishes[PromiseAtRisk, PromiseRevised].consumers`;
H7 from `.aggregates[PromiseBook].commands` (no rule ties `RevisePromise` to
`HoldCapacity` / `ReleaseCapacity`).

Omitted: `CONFIRMED → CONFIRMED: RevisePromise` (a revision without passing
through `AT_RISK`, which the model allows but no policy uses); the case where
nothing is feasible even at `STANDARD` (the promise stays `AT_RISK`, board 6).

## 6. Judging and cancelling

```mermaid
flowchart TB
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    OS["order-sourcing"]:::external
    ST["shipping-and-tracking"]:::external
    CO["customer-ordering"]:::external
    E0["FulfillmentLocked"]:::event
    E1["PackageDelivered"]:::event
    P1["JudgeOnDelivery"]:::policy
    C1["JudgePromise"]:::command
    G1["Promise<br/>KEPT or BROKEN"]:::aggregate
    E2["PromiseKept<br/>PromiseBroken"]:::event
    NP["node-performance"]:::external
    E3["CustomerOrderCancelled"]:::event
    P2["Policy: cancel the<br/>groups' promises"]:::policy
    C2["CancelPromise"]:::command
    G2["Promise<br/>CANCELLED"]:::aggregate
    E4["PromiseCancelled"]:::event
    H8["Hotspot H8: what FulfillmentLocked<br/>is for, how a package finds its promise"]:::hotspot
    H9["Hotspot H9: a lost package's<br/>promise is never judged"]:::hotspot
    OS --> E0
    ST --> E1
    E1 --> P1
    P1 --> C1
    C1 --> G1
    G1 --> E2
    E2 --> NP
    E2 --> CO
    CO --> E3
    E3 --> P2
    P2 --> C2
    C2 --> G2
    G2 --> E4
    E0 -.- H8
    P1 -.- H9
```

Derived from: `model.yaml → contexts[delivery-promise].policies[JudgeOnDelivery]`,
`.publishes[PromiseKept, PromiseBroken, PromiseCancelled]`, `.consumes`; H8 from
`.consumes[FulfillmentLocked]` with no policy or read model using it, and
`contexts[shipping-and-tracking].publishes[PackageDelivered].data` (no
`promiseId`, no `groupNo`); H9 from
`contexts[shipping-and-tracking].publishes[PackageLost, PackageReturned].consumers`
(`analytics only`).

Omitted: the capacity release on cancellation (`ReleaseCapacity`, board 4). The
cancellation policy sticky is this pack's reading: the model consumes
`CustomerOrderCancelled` and has `CancelPromise`, but names no policy joining
them.

## Hotspot inventory

| Id | Hotspot | Where it comes from in the model | Board |
| --- | --- | --- | --- |
| H1 | A cancelled delivery wave is invisible to this context | `DeliveryWaveCancelled` consumers: analytics only | 1 |
| H2 | An offer is per item; a promise covers a multi-line group with one `offerId` | `DeliveryOffer.description` vs `ShipmentGroup`, `PromiseMade.data` | 2 |
| H3 | `TierOrderDeadline` has no owner, route or event | `policies[TierOrderDeadline]` | 2 |
| H4 | The hot path is only as fresh as its slowest topic | `conventions.integration_rules` | 2 |
| H5 | Resolved (G9): the first hold opens the book (`OpenBook`), `share` has a formula, a clock job closes the book at `cutoffAt` | `aggregates[PromiseBook]`, `policies[LazyBookOpening, BookShare, CloseBooksAtCutoff]` | 3 |
| H6 | A `CustomerOrderPlaced` that arrives after hold expiry | `ErrPromiseHoldExpired`, asynchronous `ConfirmPromise` | 4 |
| H7 | Capacity on revision is unspecified | `aggregates[PromiseBook].commands`, `policies[RepromiseOnRisk]` | 5 |
| H8 | `FulfillmentLocked` has no stated use; packages carry no `promiseId` | `consumes[FulfillmentLocked]`, `PackageDelivered.data` | 6 |
| H9 | A lost or returned package's promise is never judged | `PackageLost`, `PackageReturned` consumers | 6 |
