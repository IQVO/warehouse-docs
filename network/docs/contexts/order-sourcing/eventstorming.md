---
id: eventstorming
title: EventStorming (process level)
sidebar_label: EventStorming
description: "Process-level EventStorming boards for Order Sourcing: intake and the virtual queue, release, the node's answer, re-promise and cancellation, shipment and delivery, with hotspots taken from gaps in the model."
---

# EventStorming (process level)

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Uses the ddd-crew [EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky is an element of `model.yaml`. Events from other
contexts are orange stickies next to the pink system that publishes them. The
aggregate sticky is repeated on each board so lines do not cross. Hotspots
are gaps or risks found in the model; each one names where it comes from. The
network-wide board is
[EventStorming big picture](/network/strategic-design/eventstorming-big-picture).

## Legend

| Sticky | Colour | Meaning here |
| --- | --- | --- |
| Command | blue `#a5d8ff` | One of the nine commands of `FulfillmentAssignment` |
| Aggregate | yellow `#ffec99` | `FulfillmentAssignment` |
| Domain Event | orange `#ffc078` | An event this context publishes, or a neighbour event it consumes |
| Policy | lilac `#d0bfff` | A policy from `policies`, or a rule from `business_decisions` / `invariants` |
| Read Model | green `#b2f2bb` | One of the five `read_models` |
| External System | pink `#fcc2d7` | A sibling context (with the neighbour policy that reacts) |
| Hotspot | red `#ff8787` | An open question or risk in the model |
| Actor | white `#ffffff` | A person or this context's own timer |

## 1. Intake and the virtual queue

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 30}}}%%
flowchart TB
    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    classDef actor fill:#ffffff,stroke:#495057,color:#000
    CO["customer-ordering"]:::external
    E0["CustomerOrderPlaced"]:::event
    P0["Policy: one assignment<br/>per shipment group"]:::policy
    C1["QueueAssignment"]:::command
    A1["FulfillmentAssignment"]:::aggregate
    E1["FulfillmentQueued"]:::event
    P1["Policy: VirtualQueue<br/>releaseAt = cutoff - handling<br/>- vendor ack budget"]:::policy
    H10["Hotspot: destination<br/>postal prefix not on<br/>the aggregate"]:::hotspot
    CO --> E0 --> P0 --> C1 --> A1 --> E1
    A1 --> P1
    C1 -.- H10
```

Derived from: model.yaml → `contexts[order-sourcing].consumes[CustomerOrderPlaced]`,
`.aggregates[FulfillmentAssignment]` (`description`, `commands`, `events`),
`.policies[VirtualQueue]`; `contexts[customer-ordering].publishes[CustomerOrderPlaced].data`.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 30}}}%%
flowchart TB
    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    classDef actor fill:#ffffff,stroke:#495057,color:#000
    RM1["NodeProfileView"]:::readmodel
    RM2["NetworkGraphView"]:::readmodel
    RM3["AvailabilityView"]:::readmodel
    RM4["ScorecardView"]:::readmodel
    RM5["PromiseBookPressureView"]:::readmodel
    P2["Policy: AssignmentCost<br/>legs + crossRegion + scorecard<br/>+ bookPressure, ties to witness"]:::policy
    T1["Sweep timer"]:::actor
    PL["Network-ops planner"]:::actor
    C2["ReoptimiseAssignment"]:::command
    A1["FulfillmentAssignment"]:::aggregate
    E2["FulfillmentReassigned"]:::event
    LH["linehaul-transportation<br/>ExpectedVolumeView"]:::external
    H3["Hotspot: cross-region is a<br/>penalty, decision says<br/>only if no other way"]:::hotspot
    H1["Hotspot: promise-book hold<br/>stays on the witness node"]:::hotspot
    RM1 --> P2
    RM2 --> P2
    RM3 --> P2
    RM4 --> P2
    RM5 --> P2
    P2 --> C2
    T1 --> C2
    PL --> C2
    C2 --> A1 --> E2 --> LH
    P2 -.- H3
    E2 -.- H1
```

Derived from: model.yaml → `contexts[order-sourcing].read_models`,
`.policies[AssignmentCost]`, `.business_decisions` (1 and 5),
`.rest` (`POST /assignments/{assignmentId}:reoptimise`),
`.aggregates[FulfillmentAssignment].throughput_estimate` (the sweeps);
`contexts[linehaul-transportation].read_models[ExpectedVolumeView]`;
`contexts[delivery-promise].aggregates[PromiseBook]`.

Omitted: the 29 events that feed the five read models (listed on
[Domain Events](/network/contexts/order-sourcing/domain-events)); a re-optimisation
that keeps the same node, which raises nothing.

## 2. Release

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 30}}}%%
flowchart TB
    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    classDef actor fill:#ffffff,stroke:#495057,color:#000
    T2["Release timer<br/>at releaseAt"]:::actor
    P3["Policy: SAME_DAY<br/>releases immediately"]:::policy
    C3["ReleaseToNode"]:::command
    A1["FulfillmentAssignment"]:::aggregate
    P4["Policy: eta must meet<br/>deliverByLatest, node<br/>not excluded"]:::policy
    E3["FulfillmentReleasedToNode"]:::event
    E4["FulfillmentUnsourceable"]:::event
    VC["vendor-connectivity<br/>IssueOnRelease"]:::external
    LH["linehaul-transportation<br/>ExpectedVolumeView"]:::external
    DP["delivery-promise<br/>RepromiseOnRisk"]:::external
    CO["customer-ordering<br/>status"]:::external
    H2["Hotspot: no releaseAt<br/>when no candidate is left"]:::hotspot
    T2 --> C3
    P3 --> C3
    C3 --> A1 --> P4
    P4 -->|candidate ok| E3
    P4 -->|none left| E4
    E3 --> VC
    E3 --> LH
    E4 --> DP
    E4 --> CO
    T2 -.- H2
```

Derived from: model.yaml → `contexts[order-sourcing].policies[VirtualQueue]`,
`.aggregates[FulfillmentAssignment].transitions` (`QUEUED → RELEASED`,
`QUEUED → UNSOURCEABLE` by `ReleaseToNode`), `.invariants`
(`ErrCandidateBreaksPromise`, `ErrNodeExcluded`), `.publishes` (consumers);
`contexts[vendor-connectivity].policies[IssueOnRelease]`;
`contexts[delivery-promise].policies[RepromiseOnRisk]`.

Omitted: `ErrReleaseInFlight` (a second release while one is pending), shown
on [Sequence Diagrams](/network/contexts/order-sourcing/sequence-diagrams).

## 3. The node's answer: lock or refusal

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 30}}}%%
flowchart TB
    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    classDef actor fill:#ffffff,stroke:#495057,color:#000
    VC["vendor-connectivity"]:::external
    E5["PurchaseOrderAccepted"]:::event
    P5["Policy: LockOnCommit"]:::policy
    C4["LockAssignment"]:::command
    A1["FulfillmentAssignment"]:::aggregate
    E6["FulfillmentLocked"]:::event
    OUT1["delivery-promise,<br/>customer-ordering,<br/>linehaul BookOnLock"]:::external
    H11["Hotspot: pickup departure<br/>cancelled after the lock"]:::hotspot
    VC --> E5 --> P5 --> C4 --> A1 --> E6 --> OUT1
    E6 -.- H11
```

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 30}}}%%
flowchart TB
    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    classDef actor fill:#ffffff,stroke:#495057,color:#000
    VC["vendor-connectivity"]:::external
    E7["PurchaseOrderRejected"]:::event
    E8["PurchaseOrderExpired"]:::event
    P6["Policy: ReassignOnRefusal<br/>exclude node, re-queue"]:::policy
    C5["HandleNodeRefusal"]:::command
    A1["FulfillmentAssignment"]:::aggregate
    E9["FulfillmentReassigned"]:::event
    E10["FulfillmentUnsourceable"]:::event
    H7["Hotspot: exclusion per<br/>promise revision, but no<br/>revisionNo on the constraint"]:::hotspot
    VC --> E7
    VC --> E8
    E7 --> P6
    E8 --> P6
    P6 --> C5 --> A1
    A1 -->|candidate left| E9
    A1 -->|none left| E10
    P6 -.- H7
```

Derived from: model.yaml → `contexts[order-sourcing].policies[LockOnCommit]`,
`.policies[ReassignOnRefusal]`, `.aggregates[FulfillmentAssignment].transitions`
(`RELEASED → LOCKED`, `RELEASED → QUEUED`, `RELEASED → UNSOURCEABLE`),
`.invariants` (`ErrNodeExcluded`), `.value_objects` (`PromiseConstraint`);
`.consumes[DepartureCancelled]`; `contexts[vendor-connectivity].publishes`;
`contexts[linehaul-transportation].policies[BookOnLock]`.

Omitted: the check that the outcome's `releaseNo` is the pending release
(older outcomes are ignored); `node-performance` also consumes the three
purchase-order events.

## 4. Re-promise and cancellation

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 30}}}%%
flowchart TB
    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    classDef actor fill:#ffffff,stroke:#495057,color:#000
    DP["delivery-promise"]:::external
    E11["PromiseRevised"]:::event
    C6["ApplyRevisedPromise"]:::command
    A1["FulfillmentAssignment<br/>back to QUEUED"]:::aggregate
    H5["Hotspot: no event<br/>for this transition"]:::hotspot
    H9["Hotspot: revision of a<br/>QUEUED, RELEASED or<br/>LOCKED assignment"]:::hotspot
    CO["customer-ordering"]:::external
    E12["CustomerOrderCancelled"]:::event
    P7["Policy: cancel only<br/>before LOCKED"]:::policy
    C7["CancelAssignment"]:::command
    A2["FulfillmentAssignment"]:::aggregate
    E13["FulfillmentCancelled"]:::event
    OUT2["vendor-connectivity<br/>CancelOnSourcingCancel,<br/>linehaul-transportation"]:::external
    H6["Hotspot: UNSOURCEABLE<br/>cannot be cancelled"]:::hotspot
    H4["Hotspot: acceptance lands<br/>after the cancellation"]:::hotspot
    DP --> E11 --> C6 --> A1
    A1 -.- H5
    E11 -.- H9
    CO --> E12 --> P7 --> C7 --> A2 --> E13 --> OUT2
    P7 -.- H6
    E13 -.- H4
```

Derived from: model.yaml → `contexts[order-sourcing].aggregates[FulfillmentAssignment].transitions`
(`UNSOURCEABLE → QUEUED`, `QUEUED/RELEASED → CANCELLED`), `.events`,
`.invariants` (`ErrCancelAfterLock`); `contexts[delivery-promise].policies[RepromiseOnRisk]`;
`contexts[customer-ordering].policies[CancelOnUnfulfillable]`;
`contexts[vendor-connectivity].policies[CancelOnSourcingCancel]`,
`.aggregates[PurchaseOrder].invariants` (`ErrCancelAfterAcknowledgement`).

## 5. Shipment and delivery

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 30}}}%%
flowchart TB
    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    classDef actor fill:#ffffff,stroke:#495057,color:#000
    VC["vendor-connectivity"]:::external
    E14["VendorShipmentConfirmed"]:::event
    C8["MarkShipped"]:::command
    A1["FulfillmentAssignment"]:::aggregate
    E15["FulfillmentShipped"]:::event
    CO["customer-ordering"]:::external
    ST["shipping-and-tracking"]:::external
    E16["PackageDelivered"]:::event
    C9["MarkDelivered"]:::command
    A2["FulfillmentAssignment"]:::aggregate
    E17["FulfillmentDelivered<br/>analytics only"]:::event
    H8["Hotspot: several packages,<br/>first or last delivery"]:::hotspot
    VC --> E14 --> C8 --> A1 --> E15 --> CO
    ST --> E16 --> C9 --> A2 --> E17
    E16 -.- H8
```

Derived from: model.yaml → `contexts[order-sourcing].consumes`
(`VendorShipmentConfirmed`, `PackageDelivered`), `.aggregates[FulfillmentAssignment].transitions`
(`LOCKED → SHIPPED`, `SHIPPED → DELIVERED`), `.publishes` (`FulfillmentShipped`,
`FulfillmentDelivered`); `contexts[shipping-and-tracking].publishes[PackageDelivered].data`.

## Hotspot inventory

| Hotspot | Board | Where it comes from in the model |
| --- | --- | --- |
| H1 Promise-book hold stays on the witness node | 1 | `business_decisions[0]` (the assigned node may differ from the witness) against `delivery-promise` `PromiseBook` (capacity held on the witness cutoff); no policy moves the hold, and `delivery-promise` names no use for `FulfillmentLocked` |
| H2 No `releaseAt` when no candidate is left | 2 | `policies[VirtualQueue]` derives `releaseAt` from the best candidate; `QUEUED → UNSOURCEABLE` happens only by `ReleaseToNode` |
| H3 Cross-region as penalty vs rule | 1 | `business_decisions[4]` ("only when it is the only way") against `policies[AssignmentCost]` (`crossRegionPenalty`) |
| H4 Acceptance after cancellation (known residual, G12) | 4 | `CancelAssignment` from `RELEASED` against `vendor-connectivity` `ErrCancelAfterAcknowledgement` (cancel only while `ISSUED`); an acceptance that arrives after the cancel is only logged (`policies[AcceptanceAfterCancelOnlyLogged]`) |
| H5 `ApplyRevisedPromise` raises no event | 4 | `aggregates[FulfillmentAssignment].events` has none for `UNSOURCEABLE → QUEUED` |
| H6 `UNSOURCEABLE` can be cancelled (resolved) | 4 | `transitions` now has `UNSOURCEABLE → CANCELLED`, so `customer-ordering` `CancelOnUnfulfillable` has a target |
| H7 Exclusion per promise revision without `revisionNo` | 3 | `invariants` (`ErrNodeExcluded`, "same promise revision") against `value_objects` (`PromiseConstraint` has no revision) |
| H8 Multi-package delivery | 5 | `FulfillmentShipped.trackingNumbers` (several) against `PackageDelivered` (one `trackingNumber`) |
| H9 Revision of an assignment that is not `UNSOURCEABLE` | 4 | `delivery-promise` `RepromiseOnRisk` also fires on cancelled departures and package exceptions; the only transition is from `UNSOURCEABLE` |
| H10 Destination not on the aggregate | 1 | candidate search needs the destination's delivery station (`NetworkGraphView` has `ServiceAreaAssigned`); `PromiseConstraint` and the aggregate description omit `destinationPostalPrefix` |
| H11 Pickup departure cancelled after the lock | 3 | `invariants` ("no change of node after LOCKED") is silent on the departure; `consumes[DepartureCancelled]` has no transition for a locked assignment |
