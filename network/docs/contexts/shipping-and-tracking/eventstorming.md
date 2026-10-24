---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: "Process-level EventStorming boards for Shipping & Tracking: label issue, timeline consolidation, and exceptions and terminal outcomes, with hotspots from model gaps."
---

# EventStorming

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Process-level boards in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky comes from `model.yaml`. The hotspots are genuine
gaps or risks in the model; the inventory at the end says where each one
comes from. The domain-wide board is
[EventStorming Big Picture](/network/strategic-design/eventstorming-big-picture).

## Legend

| Colour | Sticky | Meaning |
| --- | --- | --- |
| Blue `#a5d8ff` | Command | An intent this context handles |
| Yellow `#ffec99` | Aggregate | `ShippingLabel` or `PackageJourney` |
| Orange `#ffc078` | Domain Event | A fact, this context's or a neighbour's |
| Lilac `#d0bfff` | Policy | "Whenever X, then Y" |
| Green `#b2f2bb` | Read Model | Data a decision reads |
| Pink `#fcc2d7` | External System | A neighbour context or actor |
| Red `#ff8787` | Hotspot | A gap or risk in the model |

## 1. Label issue

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 30}}}%%
flowchart TB
    VC["vendor-connectivity<br/>vendor asked for a label"]:::external
    C1["IssueLabel<br/>POST /labels"]:::command
    CO["customer-ordering<br/>GetShipTo, restricted"]:::external
    RM1["CatalogDimensionsView"]:::readmodel
    G1["ShippingLabel"]:::aggregate
    E1["LabelIssued"]:::event
    C2["StartJourney"]:::command
    G2["PackageJourney<br/>LABELLED"]:::aggregate
    LH["linehaul-transportation<br/>ExpectedVolumeView"]:::external
    CO2["customer-ordering<br/>OrderTrackingView"]:::external
    H1["Hotspot: request fields,<br/>orderId not in the model"]:::hotspot
    H2["Hotspot: printable label<br/>not modelled"]:::hotspot
    H3["Hotspot: StartJourney<br/>trigger not modelled"]:::hotspot
    VC --> C1
    C1 --> CO
    RM1 --> C1
    C1 --> G1
    G1 --> E1
    C1 --> C2
    C2 --> G2
    E1 --> LH
    E1 --> CO2
    C1 --- H1
    G1 --- H2
    C2 --- H3
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[shipping-and-tracking].aggregates[ShippingLabel]`,
`.aggregates[PackageJourney].commands`, `.sync_calls`, `.read_models`,
`.publishes[LabelIssued]`; `contexts[linehaul-transportation].read_models`,
`contexts[customer-ordering].read_models`.

Omitted: the duplicate-label and ship-to-unavailable branches (see
[Use Cases](/network/contexts/shipping-and-tracking/use-cases)); the outbox write.

### 1b. Label void

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 30}}}%%
flowchart TB
    U["caller not named<br/>in the model"]:::external
    C3["VoidLabel<br/>POST /labels/labelRef:void"]:::command
    G1["ShippingLabel<br/>ISSUED to VOIDED"]:::aggregate
    E2["LabelVoided<br/>analytics only"]:::event
    H4["Hotspot: void caller unnamed,<br/>journey left LABELLED"]:::hotspot
    U --> C3
    C3 --> G1
    G1 --> E2
    C3 --- H4
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[shipping-and-tracking].rest`,
`.aggregates[ShippingLabel].transitions`, `.publishes[LabelVoided]`.

Omitted: nothing else; the model names no reaction to a void.

## 2. Timeline consolidation

### 2a. Handover and the middle mile

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 30}}}%%
flowchart TB
    VC["vendor-connectivity"]:::external
    LH["linehaul-transportation"]:::external
    F1["VendorShipmentConfirmed"]:::event
    F2["LoadDeparted"]:::event
    F3["LoadArrived"]:::event
    P0["Policy: each fact becomes<br/>one scan per tracking number"]:::policy
    C1["RecordScan"]:::command
    G1["PackageJourney"]:::aggregate
    P1["Policy: HandoverOnFirstScan"]:::policy
    E1["PackageScanned"]:::event
    E2["PackageHandedOver"]:::event
    NP["node-performance"]:::external
    CO["customer-ordering"]:::external
    H1["Hotspot: no node types,<br/>station vs sort centre"]:::hotspot
    H3["Hotspot: no departure kind,<br/>VSC effect not modelled"]:::hotspot
    VC --> F1
    LH --> F2
    LH --> F3
    F1 --> P0
    F2 --> P0
    F3 --> P0
    P0 --> C1
    C1 --> G1
    P1 --> G1
    G1 --> E1
    G1 --> E2
    E1 --> CO
    E2 --> NP
    F3 --- H1
    P1 --- H3
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[shipping-and-tracking].consumes`,
`.policies[HandoverOnFirstScan]`, `.aggregates[PackageJourney]`,
`.publishes[PackageScanned, PackageHandedOver]`.

Omitted: the REST route `POST /journeys/{trackingNumber}/scans` (same
command, caller not named); duplicate and out-of-order scans (stored, never
applied, no event). Policy "each fact becomes one scan per tracking number"
is the consumers' translation step, a proposed design element rather than a
model policy.

### 2b. Last mile

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 30}}}%%
flowchart TB
    LM["last-mile-delivery"]:::external
    F4["PackageOutForDelivery"]:::event
    F5["DeliveryAttempted"]:::event
    P0["Policy: each fact becomes<br/>one scan per tracking number"]:::policy
    C1["RecordScan"]:::command
    G1["PackageJourney"]:::aggregate
    E1["PackageScanned"]:::event
    E3["PackageDelivered"]:::event
    DS["delivery-promise,<br/>order-sourcing"]:::external
    CO["customer-ordering"]:::external
    H2["Hotspot: no HANDED_OVER to<br/>AT_STATION, direct injection"]:::hotspot
    LM --> F4
    LM --> F5
    F4 --> P0
    F5 --> P0
    P0 --> C1
    C1 --> G1
    G1 --> E1
    G1 --> E3
    E1 --> CO
    E3 --> DS
    E3 --> CO
    G1 --- H2
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[shipping-and-tracking].consumes`,
`.aggregates[PackageJourney].transitions`, `.publishes[PackageScanned, PackageDelivered]`.

Omitted: a failed attempt (back to `AT_STATION`, `PackageScanned` only).

## 3. Exceptions and terminal outcomes

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 30}}}%%
flowchart TB
    T["Silence sweep timer"]:::external
    P1["Policy: ExceptionOnSilence<br/>no scan in leg time + tolerance"]:::policy
    C1["RaiseException"]:::command
    G1["PackageJourney"]:::aggregate
    E1["PackageExceptionRaised<br/>NO_SCAN"]:::event
    DP["delivery-promise<br/>RepromiseOnRisk"]:::external
    CO["customer-ordering"]:::external
    LM["last-mile-delivery<br/>RetryNextWave"]:::external
    C2["ReturnToSender"]:::command
    C3["DeclareLost"]:::command
    E2["PackageReturned"]:::event
    E3["PackageLost"]:::event
    H1["Hotspot: expected leg time<br/>and tolerance not available"]:::hotspot
    H2["Hotspot: no trigger for<br/>ReturnToSender or DeclareLost"]:::hotspot
    T --> P1
    P1 --> C1
    C1 --> G1
    G1 --> E1
    E1 --> DP
    E1 --> CO
    C2 --> G1
    C3 --> G1
    G1 --> E2
    G1 --> E3
    P1 --- H1
    LM -.- H2
    H2 -.- C2
    H2 -.- C3
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[shipping-and-tracking].policies[ExceptionOnSilence]`,
`.aggregates[PackageJourney].commands`, `.publishes[PackageExceptionRaised, PackageReturned, PackageLost]`;
`contexts[delivery-promise].policies[RepromiseOnRisk]`;
`contexts[last-mile-delivery].policies[RetryNextWave]`.

Omitted: `ErrJourneyClosed` on a closed journey; the analytics sink for
`PackageReturned` and `PackageLost` (no in-org consumer).

## Sticky inventory

| Sticky | Kind | Model source |
| --- | --- | --- |
| `IssueLabel`, `VoidLabel` | Command | `aggregates[ShippingLabel].commands` |
| `StartJourney`, `RecordScan`, `RaiseException`, `ReturnToSender`, `DeclareLost` | Command | `aggregates[PackageJourney].commands` |
| `ShippingLabel`, `PackageJourney` | Aggregate | `aggregates` |
| `LabelIssued`, `LabelVoided`, `PackageScanned`, `PackageHandedOver`, `PackageDelivered`, `PackageExceptionRaised`, `PackageReturned`, `PackageLost` | Domain Event (own) | `publishes` |
| `VendorShipmentConfirmed`, `LoadDeparted`, `LoadArrived`, `PackageOutForDelivery`, `DeliveryAttempted` | Domain Event (neighbour) | `consumes` |
| `HandoverOnFirstScan`, `ExceptionOnSilence` | Policy | `policies` |
| `RepromiseOnRisk`, `RetryNextWave` | Policy (neighbour, on pink stickies) | `delivery-promise`, `last-mile-delivery` `policies` |
| `CatalogDimensionsView` | Read Model | `read_models` |
| `vendor-connectivity`, `customer-ordering`, `linehaul-transportation`, `last-mile-delivery`, `delivery-promise`, `order-sourcing`, `node-performance` | External System | `inbound`, `publishes[].consumers`, `sync_calls` |

## Hotspots and where they come from

| Hotspot | Board | Source in `model.yaml` |
| --- | --- | --- |
| Request fields of `IssueLabel`; no `orderId` reaches this context by event | 1 | `sync_calls[GetShipTo]` needs `orderId`; `publishes[PackageDelivered].data` has `orderId`; `publishes[LabelIssued].data` and `vendor-connectivity` `publishes[PurchaseOrderIssued].data` have none |
| Printable label not modelled | 1 | `vendor-connectivity` `po.Label` is `labelRef + trackingNumber + carrier`; no route here renders a label |
| `StartJourney` has no trigger | 1 | `aggregates[PackageJourney].commands` lists it; no policy, route or event starts it |
| `VoidLabel` caller and journey effect | 1b | `rest` has `POST /labels/{labelRef}:void`; no `inbound` row; `PackageJourney` has no exit from `LABELLED` |
| No node types | 2a | `IN_TRANSIT -> AT_STATION` transition; `consumes` has no `node-topology` event |
| No `HANDED_OVER -> AT_STATION` | 2b | `lane_rules.allowed` has `FULFILLMENT_CENTER -> DELIVERY_STATION`; `PackageJourney.transitions` has no such edge |
| No departure kind; `VendorShipmentConfirmed` effect | 2a | `policies[HandoverOnFirstScan]` says "PICKUP-load"; `linehaul-transportation` `publishes[LoadDeparted].data` has no kind; no `LABELLED -> LABELLED` edge |
| Expected leg time and tolerance | 3 | `policies[ExceptionOnSilence]`; `consumes` has no departure, lane or wave event |
| No trigger for `ReturnToSender`, `DeclareLost` | 3 | `aggregates[PackageJourney].commands`; `last-mile-delivery` `policies[RetryNextWave]` publishes no event |
