---
id: eventstorming-big-picture
title: EventStorming Big Picture
sidebar_label: EventStorming Big Picture
description: "The retail network's big-picture EventStorming: the timeline from vendor onboarding to promise judgement, in six phases, with commands, aggregates, policies, read models, external systems and hotspots."
---

# EventStorming Big Picture

Following the ddd-crew
[EventStorming glossary and cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet).
Sticky colours: **Command** blue, **Aggregate** yellow, **Domain Event**
orange, **Policy** lilac, **Read Model** green, **External System** pink,
**Hotspot** red. The timeline runs left to right inside each phase and top to
bottom across phases. Every event is one of the model's published events.

| Sticky | Colour |
| --- | --- |
| Command | blue |
| Aggregate | yellow |
| Domain Event | orange |
| Policy | lilac |
| Read Model | green |
| External System | pink |
| Hotspot | red |

## Phase 1: a vendor node joins the network

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 18, "padding": 4}}}%%
flowchart TB
    classDef cmd fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef agg fill:#ffec99,stroke:#f59f00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef ext fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hot fill:#ff8787,stroke:#c92a2a,color:#000
    X1["warehouse-systems<br/>network-fulfillment"]:::ext --> C1["RegisterNode"]:::cmd --> A1["Node"]:::agg --> E1["NodeRegistered"]:::evt
    X1 --> C2["DeclareOperational<br/>Profile"]:::cmd --> A1 --> E2["NodeOperational<br/>ProfileDeclared"]:::evt
    E2 --> P1["PickupFromCutoffs"]:::pol --> E3["DepartureScheduled"]:::evt
    H1["Declared numbers<br/>may be optimistic"]:::hot -.- E2
```

Derived from: `model.yaml` → `contexts[vendor-connectivity].sync_calls`,
`contexts[node-topology]`, `contexts[linehaul-transportation].policies`.
Hotspot: the reason `node-performance` exists ([ADR 0003](/network/adr/0003-declared-and-measured-capability)).

## Phase 2: what can be sold

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 18, "padding": 4}}}%%
flowchart TB
    classDef cmd fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef agg fill:#ffec99,stroke:#f59f00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef ext fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef rm fill:#b2f2bb,stroke:#2f9e44,color:#000
    X1["vendor inventory<br/>feed"]:::ext --> C1["ApplyInventory<br/>Feed"]:::cmd --> A1["InventoryFeed"]:::agg --> E1["InventoryFeed<br/>Applied"]:::evt
    A1 --> A2["Listing"]:::agg --> E2["ListingAvailability<br/>Changed"]:::evt --> R1["AvailabilityView"]:::rm
    E3["NodeSuspended"]:::evt --> P1["SuppressOnNode<br/>Unavailable"]:::pol --> E4["ListingSuppressed"]:::evt
```

Derived from: `model.yaml` → `contexts[offer-availability]`.

## Phase 3: promise and order

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 18, "padding": 4}}}%%
flowchart TB
    classDef cmd fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef agg fill:#ffec99,stroke:#f59f00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef rm fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef hot fill:#ff8787,stroke:#c92a2a,color:#000
    R1["Departure, Wave,<br/>Availability views"]:::rm --> C1["QuoteDelivery<br/>Offers"]:::cmd --> A1["DeliveryOffer"]:::agg
    A1 --> C2["MakePromise"]:::cmd --> A2["Promise +<br/>PromiseBook"]:::agg --> E1["PromiseMade"]:::evt
    E1 --> C3["PlaceOrder"]:::cmd --> A3["CustomerOrder"]:::agg --> E2["CustomerOrder<br/>Placed"]:::evt
    E2 --> E3["PromiseConfirmed"]:::evt
    H1["Contended book row<br/>at peak"]:::hot -.- A2
```

Derived from: `model.yaml` → `contexts[delivery-promise]`, `contexts[customer-ordering]`.
Hotspot: `PromiseBook` throughput estimate "high and contended"
([ADR 0008](/network/adr/0008-capacity-held-at-promise-time)).

## Phase 4: assign and commit

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 18, "padding": 4}}}%%
flowchart TB
    classDef cmd fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef agg fill:#ffec99,stroke:#f59f00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef ext fill:#fcc2d7,stroke:#c2255c,color:#000
    E0["CustomerOrder<br/>Placed"]:::evt --> P1["VirtualQueue"]:::pol --> C1["ReleaseToNode"]:::cmd --> A1["Fulfillment<br/>Assignment"]:::agg --> E1["FulfillmentReleased<br/>ToNode"]:::evt
    E1 --> P2["IssueOnRelease"]:::pol --> A2["PurchaseOrder"]:::agg
    X1["network-fulfillment"]:::ext --> C2["Submit<br/>Acknowledgement"]:::cmd --> A2 --> E2["PurchaseOrder<br/>Accepted"]:::evt
    E2 --> P3["LockOnCommit"]:::pol --> E3["FulfillmentLocked"]:::evt
```

Derived from: `model.yaml` → `contexts[order-sourcing]`, `contexts[vendor-connectivity]`.

## Phase 5: move and deliver

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 18, "padding": 4}}}%%
flowchart TB
    classDef cmd fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef agg fill:#ffec99,stroke:#f59f00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef ext fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hot fill:#ff8787,stroke:#c92a2a,color:#000
    X1["network-fulfillment"]:::ext --> C1["RequestLabel"]:::cmd --> A1["ShippingLabel"]:::agg --> E1["LabelIssued"]:::evt
    X1 --> C2["SubmitShipment<br/>Confirmation"]:::cmd --> E2["VendorShipment<br/>Confirmed"]:::evt
    E3["LoadDeparted"]:::evt --> E4["PackageHandedOver"]:::evt
    E5["LoadArrived"]:::evt --> P1["InductOnArrival"]:::pol --> E6["PackageOutFor<br/>Delivery"]:::evt --> E7["DeliveryAttempted"]:::evt --> E8["PackageDelivered"]:::evt
    H1["Fleet has no automatic<br/>package-ready trigger"]:::hot -.- C2
```

Derived from: `model.yaml` → `contexts[shipping-and-tracking]`,
`contexts[linehaul-transportation]`, `contexts[last-mile-delivery]`.
Hotspot: [Fleet changes](/network/integration/fleet-changes) row 8.

## Phase 6: judge and measure

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 18, "padding": 4}}}%%
flowchart TB
    classDef cmd fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef agg fill:#ffec99,stroke:#f59f00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef rm fill:#b2f2bb,stroke:#2f9e44,color:#000
    E1["PackageDelivered"]:::evt --> P1["JudgeOnDelivery"]:::pol --> C1["JudgePromise"]:::cmd --> A1["Promise"]:::agg --> E2["PromiseKept or<br/>PromiseBroken"]:::evt
    E2 --> C2["RecordObservation"]:::cmd --> A2["NodeScorecard"]:::agg --> E3["NodeScorecard<br/>Updated"]:::evt
    E3 --> R1["ScorecardView"]:::rm --> P2["ScorecardHandicap"]:::pol
```

Derived from: `model.yaml` → `contexts[delivery-promise].policies`,
`contexts[node-performance]`. The handicap closes the loop back to phase 3.

## Hotspots

| Hotspot | Where it comes from | Owner of the answer |
| --- | --- | --- |
| Declared numbers may be optimistic | the declared half of ADR 0003 | `node-performance` + `ScorecardHandicap` |
| Contended promise book row at peak | `PromiseBook` throughput estimate | `delivery-promise` implementation (optimistic concurrency, sharding per cutoff) |
| The fleet has no automatic package-ready trigger | `network-fulfillment` ADR 0014; no `OrderManifested` on `origin/develop` | the fleet ([Fleet changes](/network/integration/fleet-changes)) |
| A cancelled departure after lock | `DepartureCancelled` consumed by the promise | `delivery-promise` re-promise policy |
