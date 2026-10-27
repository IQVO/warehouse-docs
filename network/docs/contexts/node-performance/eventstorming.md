---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: Process-level EventStorming boards for Node Performance, from observed facts to a published grade, with hotspots taken from the model's open gaps.
---

# EventStorming

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

Process-level boards in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky comes from `model.yaml`. Every hotspot is a gap or
risk in the model, and the table at the end says where each comes from.
The network-wide board is
[EventStorming big picture](/network/strategic-design/eventstorming-big-picture).

## Legend

| Sticky | Colour | Meaning here |
| --- | --- | --- |
| Command | blue `#a5d8ff` | `RecordObservation`, `Recompute` |
| Aggregate | yellow `#ffec99` | `NodeScorecard` |
| Domain Event | orange `#ffc078` | an event this context publishes or consumes |
| Policy | lilac `#d0bfff` | a rule from `policies` or `business_decisions` (own or a neighbour's) |
| Read Model | green `#b2f2bb` | data read to decide or to answer a query |
| External System | pink `#fcc2d7` | another bounded context |
| Hotspot | red `#ff8787` | an open question or risk in the model |

```mermaid
flowchart LR
    C["Command"]:::command
    G["Aggregate"]:::aggregate
    E["Domain Event"]:::event
    P["Policy"]:::policy
    R["Read Model"]:::readmodel
    X["External System"]:::external
    H["Hotspot"]:::hotspot
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

## 1. Purchase-order facts become observations

```mermaid
flowchart LR
    VC["vendor-connectivity"]:::external
    E1["PurchaseOrderIssued"]:::event
    E2["PurchaseOrderAccepted"]:::event
    E3["PurchaseOrderRejected"]:::event
    E4["PurchaseOrderExpired"]:::event
    E5["VendorShipmentConfirmed"]:::event
    P1["Policy: count each<br/>source event once"]:::policy
    C1["RecordObservation"]:::command
    G1["NodeScorecard<br/>7d and 30d"]:::aggregate
    H1["Hotspot: no issuedAt<br/>on PurchaseOrderIssued"]:::hotspot
    H2["Hotspot: last 10% of<br/>which window?"]:::hotspot
    VC --> E1 & E2 & E3 & E4 & E5
    E1 & E2 & E3 & E4 & E5 --> C1
    C1 --> G1
    P1 --- C1
    E1 --- H1
    E2 --- H2
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: model.yaml → contexts[node-performance].consumes,
.aggregates[NodeScorecard].commands, .invariants (`ErrDuplicateObservation`),
.ul[Late Ack Rate]; contexts[vendor-connectivity].publishes.

Omitted: the inbox write and the transaction. `VendorShipmentConfirmed`
feeds no rate by itself; it links `trackingNumbers` to `requiredShipBy`.

## 2. Handover, promise and feed facts become observations

```mermaid
flowchart LR
    ST["shipping-and-tracking"]:::external
    DP["delivery-promise"]:::external
    OA["offer-availability"]:::external
    E1["PackageHandedOver"]:::event
    E2["PromiseKept"]:::event
    E3["PromiseBroken"]:::event
    E4["InventoryFeedApplied"]:::event
    P0["Policy: HandoverOnFirstScan<br/>shipping-and-tracking"]:::policy
    P1["Policy: count each<br/>source event once"]:::policy
    C1["RecordObservation"]:::command
    G1["NodeScorecard<br/>7d and 30d"]:::aggregate
    H1["Hotspot: which cause<br/>counts against the node?"]:::hotspot
    H2["Hotspot: freshness<br/>sampling undefined"]:::hotspot
    ST --> E1
    ST --- P0
    DP --> E2 & E3
    OA --> E4
    E1 & E2 & E3 & E4 --> C1
    C1 --> G1
    G1 --- P1
    E3 --- H1
    E4 --- H2
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: model.yaml → contexts[node-performance].consumes;
contexts[shipping-and-tracking].policies[HandoverOnFirstScan], .publishes;
contexts[delivery-promise].publishes; contexts[offer-availability].publishes.

Omitted: the `poNumber` join from a handover to its `requiredShipBy`,
which happens at recompute time.

## 3. Facts the model gives no use

```mermaid
flowchart LR
    NT["node-topology"]:::external
    VC["vendor-connectivity"]:::external
    E1["NodeRegistered"]:::event
    E2["NodeOperationalProfileDeclared"]:::event
    E3["VendorOnboarded"]:::event
    E4["SubmissionProcessed"]:::event
    P1["Policy: observed facts only,<br/>never the declaration"]:::policy
    H1["Hotspot: consumed, but no<br/>command, metric or read model"]:::hotspot
    H2["Hotspot: no nodeId<br/>in the payload"]:::hotspot
    NT --> E1 & E2
    VC --> E3 & E4
    E2 --> P1
    E1 & P1 --> H1
    E3 & E4 --> H2
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: model.yaml → contexts[node-performance].consumes,
.read_models (empty), .business_decisions; contexts[node-topology].publishes;
contexts[vendor-connectivity].publishes.

## 4. Recompute and grade

```mermaid
flowchart LR
    P0["Policy: recompute<br/>batched per minute"]:::policy
    C1["Recompute"]:::command
    G1["NodeScorecard"]:::aggregate
    P1["Policy: Grading<br/>A, B, C or D"]:::policy
    P2["Policy: below minimum<br/>stays PROVISIONAL"]:::policy
    P3["Policy: ThresholdAlert"]:::policy
    E1["NodeScorecardUpdated"]:::event
    E2["NodeThresholdBreached"]:::event
    H1["Hotspot: minObservations<br/>has no value"]:::hotspot
    H2["Hotspot: thresholds and<br/>downward undefined"]:::hotspot
    P0 --> C1 --> G1
    G1 --> P1 & P2
    P1 & P2 --> E1
    G1 --> P3 --> E2
    P2 --- H1
    P3 --- H2
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: model.yaml → contexts[node-performance].aggregates[NodeScorecard]
(.commands, .transitions, .events, .throughput_estimate), .policies,
.business_decisions.

## 5. Where the grade is used

```mermaid
flowchart LR
    E1["NodeScorecardUpdated"]:::event
    DP["delivery-promise"]:::external
    OS["order-sourcing"]:::external
    R1["ScorecardView<br/>delivery-promise"]:::readmodel
    R2["ScorecardView<br/>order-sourcing"]:::readmodel
    P1["Policy: ScorecardHandicap"]:::policy
    P2["Policy: AssignmentCost<br/>scorecardPenalty"]:::policy
    R3["Scorecard query<br/>GET /scorecards/nodeId"]:::readmodel
    VC["vendor-connectivity<br/>Vendor API"]:::external
    H1["Hotspot: which window<br/>drives the handicap?"]:::hotspot
    H2["Hotspot: no PROVISIONAL<br/>rule in the handicap"]:::hotspot
    H3["Hotspot: no named caller<br/>of GET /scorecards?grade="]:::hotspot
    E1 --> DP --> R1 --> P1
    E1 --> OS --> R2 --> P2
    VC --> R3
    P1 --- H1
    P1 --- H2
    R3 --- H3
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: model.yaml → contexts[delivery-promise].read_models[ScorecardView],
.policies[ScorecardHandicap]; contexts[order-sourcing].read_models[ScorecardView],
.policies[AssignmentCost]; contexts[vendor-connectivity].sync_calls;
contexts[node-performance].rest.

Omitted: `NodeThresholdBreached` goes to analytics only. "Scorecard query"
is not a declared read model: it reads the `NodeScorecard` table directly
(`read_models` is empty).

## Sticky inventory

| Sticky | Kind | Model evidence |
| --- | --- | --- |
| `RecordObservation`, `Recompute` | Command | `aggregates[NodeScorecard].commands` |
| `NodeScorecard` | Aggregate | `aggregates[NodeScorecard]` |
| `NodeScorecardUpdated`, `NodeThresholdBreached` | Domain Event (published) | `publishes` |
| Thirteen consumed events | Domain Event (consumed) | `consumes` |
| Count each source event once | Policy | invariant `ErrDuplicateObservation` |
| Grading | Policy | `policies[Grading]` |
| ThresholdAlert | Policy | `policies[ThresholdAlert]` |
| Below minimum stays PROVISIONAL | Policy | `business_decisions[1]`, invariant `ErrInsufficientObservations` |
| Observed facts only, never the declaration | Policy | `business_decisions[0]` |
| Recompute batched per minute | Policy | `aggregates[NodeScorecard].throughput_estimate` |
| HandoverOnFirstScan | Policy (neighbour) | `contexts[shipping-and-tracking].policies` |
| ScorecardHandicap, AssignmentCost | Policy (neighbour) | `contexts[delivery-promise].policies`, `contexts[order-sourcing].policies` |
| ScorecardView (two) | Read Model (neighbour) | `read_models` of `delivery-promise` and `order-sourcing` |
| Scorecard query | Read Model (aggregate read) | `rest` |
| Six neighbour contexts | External System | `inbound`, `publishes[].consumers`, `sync_calls` of `vendor-connectivity` |

## Hotspots and where they come from

| Hotspot | Source in the model |
| --- | --- |
| No `issuedAt` on `PurchaseOrderIssued` | `contexts[vendor-connectivity].publishes[PurchaseOrderIssued].data` lacks it; Late Ack Rate needs the start of the ack window. These pages read the CloudEvents `time`. |
| "Last 10% of the window": which window? | `ul[Late Ack Rate]`: "window" could be the ack window or the scorecard window. |
| Which `PromiseBroken` cause counts against the node? | `publishes[PromiseBroken].data` has `cause`; no rule in `node-performance` uses it. |
| Feed freshness sampling undefined | `Metrics.feedFreshnessP95Minutes` has no definition; `InventoryFeedApplied` has `appliedAt` but no `asOf`. |
| Consumed, but no command, metric or read model | `consumes` lists `NodeRegistered`, `NodeOperationalProfileDeclared`, `VendorOnboarded`, `SubmissionProcessed`; `read_models: []`; `commands` has only `RecordObservation` and `Recompute`. |
| No `nodeId` in the payload | `publishes[VendorOnboarded].data`, `publishes[SubmissionProcessed].data` in `vendor-connectivity`. |
| `minObservations` has no value | invariant `ErrInsufficientObservations`. |
| Thresholds and "downward" undefined | `policies[ThresholdAlert]`: no per-metric threshold; four metrics are worse when higher. |
| Which window drives the handicap? | `delivery-promise` and `order-sourcing` read `NodeScorecardUpdated` for both windows; neither policy names one. |
| No `PROVISIONAL` rule in the handicap | `contexts[delivery-promise].policies[ScorecardHandicap]` covers `A`-`D` and "no scorecard yet". |
| No named caller of `GET /scorecards?grade=` | `rest` lists it; no `inbound` row names a caller. |
