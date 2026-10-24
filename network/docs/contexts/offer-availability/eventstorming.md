---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: "Process-level EventStorming boards for Offer & Availability: catalogue set-up, feed application and node-driven suppression, with the hotspots the model leaves open."
---

# EventStorming

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Process-level boards (`flowchart LR`, or `TB` where LR would be too wide) in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky is a command, aggregate, event, policy, read model
or neighbour from `model.yaml`. Every hotspot is a genuine gap or risk in
the model; the table at the end says where each one comes from. The
domain-wide board is
[EventStorming Big Picture](/network/strategic-design/eventstorming-big-picture).

## Legend

| Sticky | Colour | Meaning |
| --- | --- | --- |
| Command | blue `#a5d8ff` | An intention, named as in the model's `commands` |
| Aggregate | yellow `#ffec99` | The aggregate root that decides |
| Domain Event | orange `#ffc078` | A fact from the model's `publishes` (or a consumed one) |
| Policy | lilac `#d0bfff` | "Whenever X, then Y", from the model's `policies` |
| Read Model | green `#b2f2bb` | A local, event-fed view from `read_models` |
| External System | pink `#fcc2d7` | A neighbouring context or the fleet |
| Hotspot | red `#ff8787` | An open question or risk in the model |
| Actor | pale orange `#fff4e6` | A person (not in the brief's palette; used only for humans) |

## 1. Catalogue and listing set-up

```mermaid
flowchart LR
    MER["Network<br/>merchandising"]:::actor
    C1["CreateCatalogItem"]:::command
    C2["DiscontinueItem"]:::command
    C3["CreateListing"]:::command
    A1["CatalogItem"]:::aggregate
    A2["Listing"]:::aggregate
    E1["CatalogItemCreated"]:::event
    E2["CatalogItemDiscontinued"]:::event
    E3["ListingCreated"]:::event
    X1["delivery-promise<br/>shipping-and-tracking"]:::external
    X2["delivery-promise<br/>order-sourcing"]:::external
    X3["delivery-promise<br/>order-sourcing<br/>vendor-connectivity"]:::external
    H3["H3: starting state and<br/>availability of a new listing"]:::hotspot
    H4["H4: effect of discontinuing<br/>on the item's listings"]:::hotspot

    MER --> C1 --> A1 --> E1 --> X1
    MER --> C2 --> A1
    A1 --> E2 --> X2
    MER --> C3 --> A2 --> E3 --> X3
    A2 -.- H3
    E2 -.- H4

    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    classDef actor fill:#fff4e6,stroke:#e8590c,color:#000
```

Derived from: `model.yaml → contexts[offer-availability].aggregates[CatalogItem]`,
`.aggregates[Listing]`, `.inbound`, `.publishes`.

Omitted: the `ErrInvalidItemDimensions` and `ErrDuplicateListing` refusals
(see [Use Cases](/network/contexts/offer-availability/use-cases)) and the
storefront's `BrowseCatalog` query, which changes nothing.

## 2. Inventory feed application

```mermaid
flowchart TB
    VC["vendor-connectivity<br/>POST /inventory-feeds"]:::external
    C1["ApplyInventoryFeed"]:::command
    A1["InventoryFeed"]:::aggregate
    P1["Policy FullFeedZeroing:<br/>omitted listings of the<br/>node get availableQty 0"]:::policy
    C2["ApplyAvailability<br/>per line and per<br/>zeroed listing"]:::command
    A2["Listing"]:::aggregate
    E1["ListingAvailabilityChanged"]:::event
    E2["InventoryFeedApplied"]:::event
    X1["delivery-promise<br/>order-sourcing"]:::external
    X2["node-performance"]:::external
    H1["H1: node-level stale feed<br/>has no Err and no state"]:::hotspot
    H2["H2: one atomic apply<br/>across many listings"]:::hotspot
    H5["H5: basis and asOf<br/>of a zeroed listing"]:::hotspot

    VC --> C1 --> A1
    A1 --> P1 --> C2
    A1 --> C2 --> A2 --> E1 --> X1
    A1 --> E2 --> X2
    C1 -.- H1
    A1 -.- H2
    P1 -.- H5

    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[offer-availability].aggregates[InventoryFeed]`,
`.aggregates[Listing]`, `.policies[FullFeedZeroing]`, `.business_decisions`,
`.publishes`; `contexts[vendor-connectivity].sync_calls`.

Omitted: the `FAILED` outcome (`ErrListingNotOnNode`,
`ErrNegativeAvailability`), which raises no event; the stale-line skip
(`ErrStaleAvailability`), which raises no `ListingAvailabilityChanged`;
the vendor's own Vendor API submission upstream of `vendor-connectivity`.

## 3. Node-driven suppression

```mermaid
flowchart TB
    NT["node-topology"]:::external
    E0["NodeRegistered<br/>NodeActivated<br/>NodeSuspended<br/>NodeRetired"]:::event
    R1["NodeStatusView"]:::readmodel
    P1["Policy SuppressOnNodeUnavailable:<br/>suspended or retired: suppress all,<br/>activated: restore those<br/>suppressed for that reason"]:::policy
    C1["SuppressListing"]:::command
    C2["RestoreListing"]:::command
    A1["Listing"]:::aggregate
    E1["ListingSuppressed"]:::event
    E2["ListingRestored"]:::event
    X1["delivery-promise<br/>order-sourcing"]:::external
    H6["H6: no vocabulary for<br/>the suppression reason"]:::hotspot

    NT --> E0 --> R1
    E0 --> P1
    P1 --> C1 --> A1
    P1 --> C2 --> A1
    R1 --> C2
    A1 --> E1 --> X1
    A1 --> E2 --> X1
    E1 -.- H6

    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[offer-availability].policies[SuppressOnNodeUnavailable]`,
`.read_models[NodeStatusView]`, `.aggregates[Listing]`, `.consumes`,
`.publishes`; `contexts[node-topology].publishes`.

Omitted: `NodeRegistered` only inserts the node into `NodeStatusView`; it
triggers no command. `RestoreListing` reads `NodeStatusView` because it is
refused with `ErrNodeNotSellable` on a node that is not `ACTIVE`.

## Hotspots and where they come from

| Hotspot | What is open | Where it comes from in `model.yaml` |
| --- | --- | --- |
| H1 | "A feed older than the last applied feed for that node is ignored" has no invariant, no `Err...` identifier and no `InventoryFeed` state for an ignored feed. Only the per-listing `ErrStaleAvailability` exists. | `contexts[offer-availability].business_decisions[1]` against `.aggregates[InventoryFeed].invariants` and `.states` |
| H2 | A full feed for a busy node writes every listing of that node in one atomic apply, while the listing throughput is "high: one update per feed line; bursty". Transaction size and lock time are a risk. | `.aggregates[InventoryFeed].description` ("applied atomically"), `.aggregates[Listing].throughput_estimate` |
| H3 | No initial state for `Listing`: a listing created on a non-`ACTIVE` node should be `SUPPRESSED` by the invariant, but `CreateListing` has no rule, and there is no `Availability` before the first feed. | `.aggregates[Listing].states`, `.transitions`, `.invariants[ErrNodeNotSellable]` |
| H4 | Whether `DiscontinueItem` suppresses the item's listings, or refuses later listings and feed lines for it. | `.aggregates[CatalogItem]`; no policy or invariant names it |
| H5 | `FullFeedZeroing` sets `availableQty=0`, but the vendor declared no `basis` and no `asOf` for an omitted listing; "the basis is kept, never re-derived" does not say what a zero carries. | `.policies[FullFeedZeroing]`, `.business_decisions[3]`, `.aggregates[Listing].value_objects` |
| H6 | `ListingSuppressed` carries `reason`, and the policy restores "those suppressed for that reason", but no reason vocabulary is modelled. | `.publishes[ListingSuppressed].data`, `.policies[SuppressOnNodeUnavailable]` |
