---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: Process-level EventStorming boards for Vendor Connectivity - issue and acknowledge, transaction outcomes, the clock and cancellation, labels and shipment, onboarding - with hotspots taken from model gaps.
---

# EventStorming

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Process-level boards in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky is a command, aggregate, event, policy or read model
of the model. Hotspots come only from gaps or open questions in the model;
the source of each is in the inventory at the end. The boards read top to
bottom (`flowchart TB`) so each stays inside the page width. The
network-wide board
is on [EventStorming big picture](/network/strategic-design/eventstorming-big-picture).

## Legend

| Sticky | Colour | Meaning |
| --- | --- | --- |
| Command | blue `#a5d8ff` | An intent: a vendor write, a policy's action, a sweep |
| Aggregate | yellow `#ffec99` | `VendorAccount`, `PurchaseOrder`, `Submission` |
| Domain Event | orange `#ffc078` | A published fact of this context, or a consumed fact of a neighbour |
| Policy | lilac `#d0bfff` | "Whenever X, then Y" |
| Read Model | green `#b2f2bb` | `VendorNodeView`, `ListingView`, or a query the vendor reads |
| External System | pink `#fcc2d7` | The vendor (the fleet) or a sibling context |
| Hotspot | red `#ff8787` | A gap or open question in the model |
| Actor | pale yellow `#fff59d` | A person or a timer |

```mermaid
flowchart LR
    A["Actor"]:::actor
    C["Command"]:::command
    G["Aggregate"]:::aggregate
    E["Domain Event"]:::event
    P["Policy"]:::policy
    R["Read Model"]:::readmodel
    X["External System"]:::external
    H["Hotspot"]:::hotspot
    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: the ddd-crew EventStorming notation; colours fixed by this site.

## 1. Issue and acknowledge

```mermaid
flowchart TB
    OS["order-sourcing"]:::external
    E0["FulfillmentReleasedToNode"]:::event
    P1["Policy: IssueOnRelease<br/>VENDOR node only,<br/>idempotent on<br/>assignmentId + releaseNo"]:::policy
    R1["VendorNodeView"]:::readmodel
    C1["IssuePurchaseOrder"]:::command
    G1["PurchaseOrder"]:::aggregate
    E1["PurchaseOrderIssued"]:::event
    H1["Hotspot H1: ackBy needs<br/>handlingTime, no source"]:::hotspot
    V["Vendor system<br/>network-fulfillment"]:::external
    R2["Purchase orders<br/>poll with nextToken"]:::readmodel
    C2["SubmitAcknowledgement<br/>whole order"]:::command
    C3["ReceiveSubmission<br/>ACKNOWLEDGEMENT"]:::command
    G2["Submission<br/>PROCESSING"]:::aggregate
    OS --> E0 --> P1
    R1 --> P1
    P1 --> C1 --> G1 --> E1
    C1 -.- H1
    G1 --> R2 --> V
    V --> C2 --> G1
    C2 --> C3 --> G2
    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[vendor-connectivity].policies[IssueOnRelease]`,
`.aggregates[PurchaseOrder]`, `.aggregates[Submission]`, `.read_models`,
`.business_decisions`.

Omitted: the synchronous refusals at receipt (`ErrPartialAcknowledgement`,
`ErrAlreadyAcknowledged`, `ErrAckWindowClosed`, `ErrNodeNotOwnedByVendor`),
shown on [Use Cases](/network/contexts/vendor-connectivity/use-cases); the
`PO_REDELIVERY_RATE` re-delivery on poll.

## 2. Transaction outcomes

```mermaid
flowchart TB
    T["Submission processor<br/>after notBefore"]:::actor
    P0["Policy: SimulationKnobs<br/>TX_PROCESSING_DELAY,<br/>TX_FAILURE_RATE"]:::policy
    C1["ProcessSubmission"]:::command
    G1["Submission"]:::aggregate
    E1["SubmissionProcessed"]:::event
    G2["PurchaseOrder"]:::aggregate
    E2["PurchaseOrderAccepted"]:::event
    E3["PurchaseOrderRejected"]:::event
    E4["VendorShipmentConfirmed"]:::event
    OS["order-sourcing"]:::external
    NP["node-performance"]:::external
    ST["shipping-and-tracking"]:::external
    T --> C1
    P0 --> C1
    C1 --> G1 --> E1 --> NP
    C1 --> G2
    G2 -->|ACCEPT| E2
    G2 -->|REJECT| E3
    G2 -->|shipment| E4
    G2 -.->|FAILURE: back to<br/>ISSUED or ACCEPTED| G2
    E2 --> OS
    E3 --> OS
    E4 --> OS
    E4 --> ST
    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[Submission]`,
`.aggregates[PurchaseOrder].transitions`, `.policies[SimulationKnobs]`,
`.publishes`.

Omitted: node-performance also consumes `PurchaseOrderAccepted`,
`PurchaseOrderRejected` and `VendorShipmentConfirmed`; the relay kinds
(`INVENTORY`, `NODE_REGISTRATION`, `NODE_PROFILE`) are on board 5.

## 3. The clock and cancellation

```mermaid
flowchart TB
    T["Expiry sweep timer"]:::actor
    P1["Policy: ExpireUnacknowledged<br/>ISSUED past ackBy"]:::policy
    C1["ExpireUnacknowledgedOrders"]:::command
    G1["PurchaseOrder"]:::aggregate
    E1["PurchaseOrderExpired"]:::event
    OS1["order-sourcing<br/>ReassignOnRefusal"]:::external
    OS2["order-sourcing"]:::external
    E0["FulfillmentCancelled"]:::event
    P2["Policy: CancelOnSourcingCancel<br/>only while ISSUED"]:::policy
    C2["CancelPurchaseOrder"]:::command
    E2["PurchaseOrderCancelled"]:::event
    A["analytics only"]:::external
    H2["Hotspot H2: cancel after<br/>acknowledgement is refused,<br/>nobody is told"]:::hotspot
    T --> P1 --> C1 --> G1
    G1 --> E1 --> OS1
    OS2 --> E0 --> P2 --> C2 --> G1
    G1 --> E2 --> A
    C2 -.- H2
    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[vendor-connectivity].policies[ExpireUnacknowledged]`,
`.policies[CancelOnSourcingCancel]`, `.aggregates[PurchaseOrder].invariants`
(`ErrCancelAfterAcknowledgement`); `contexts[order-sourcing].aggregates[FulfillmentAssignment].transitions`
(`RELEASED` to `CANCELLED`).

Omitted: node-performance also consumes `PurchaseOrderExpired`.

## 4. Labels and shipment

```mermaid
flowchart TB
    V["Vendor system<br/>network-fulfillment"]:::external
    C1["RequestLabel"]:::command
    G1["PurchaseOrder<br/>ACCEPTED"]:::aggregate
    ST["shipping-and-tracking<br/>IssueLabel"]:::external
    H3["Hotspot H3: label is<br/>synchronous, every other<br/>write is 202"]:::hotspot
    C2["SubmitShipmentConfirmation<br/>a label per package"]:::command
    C3["ReceiveSubmission<br/>SHIPMENT_CONFIRMATION"]:::command
    G2["Submission"]:::aggregate
    C4["ProcessSubmission"]:::command
    E1["VendorShipmentConfirmed"]:::event
    X["order-sourcing,<br/>shipping-and-tracking,<br/>node-performance"]:::external
    V --> C1 --> G1
    C1 --> ST
    C1 -.- H3
    V --> C2 --> G1
    C2 --> C3 --> G2 --> C4 --> G1
    G1 --> E1 --> X
    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[PurchaseOrder]`
(`RequestLabel`, `SubmitShipmentConfirmation`, `ErrLabelBeforeAcceptance`,
`ErrConfirmWithoutLabel`), `.sync_calls[shipping-and-tracking]`,
`.aggregates[Submission].value_objects` (`SubmissionKind`),
`.business_decisions`.

Omitted: `LabelIssued`, which shipping-and-tracking publishes and this
context does not consume.

## 5. Onboarding, nodes and inventory

```mermaid
flowchart TB
    PM["Network partner<br/>manager"]:::actor
    C1["OnboardVendor"]:::command
    G1["VendorAccount"]:::aggregate
    E1["VendorOnboarded"]:::event
    H4["Hotspot H4: SuspendVendor,<br/>ReinstateVendor have no<br/>route, event or effect"]:::hotspot
    V["Vendor system<br/>network-fulfillment"]:::external
    C2["ReceiveSubmission<br/>NODE_REGISTRATION,<br/>NODE_PROFILE, INVENTORY"]:::command
    G2["Submission"]:::aggregate
    C3["ProcessSubmission"]:::command
    NT["node-topology<br/>RegisterNode,<br/>DeclareOperationalProfile"]:::external
    OA["offer-availability<br/>ApplyInventoryFeed"]:::external
    E2["NodeRegistered, NodeActivated,<br/>NodeSuspended, NodeRetired"]:::event
    E3["ListingCreated"]:::event
    R1["VendorNodeView"]:::readmodel
    R2["ListingView"]:::readmodel
    H5["Hotspot H5: vendor never<br/>learns its nodeId"]:::hotspot
    H6["Hotspot H6: caller identity<br/>without auth"]:::hotspot
    PM --> C1 --> G1 --> E1
    C1 -.- H4
    V --> C2 --> G2 --> C3
    C3 --> NT
    C3 --> OA
    NT --> E2 --> R1
    OA --> E3 --> R2
    G2 -.- H5
    V -.- H6
    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1c7ed6,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[VendorAccount]`,
`.aggregates[Submission]`, `.sync_calls`, `.read_models`, `.consumes`;
`meta`/`conventions.no_auth`.

Omitted: `VendorOnboarded` goes to node-performance; `SubmissionProcessed`
goes out for every processed write (board 2).

## Sticky inventory

| Sticky | Kind | Model source |
| --- | --- | --- |
| Vendor system (network-fulfillment) | External System | `inbound` rows from `network-fulfillment`; `external[network-fulfillment]` |
| order-sourcing, node-topology, offer-availability, shipping-and-tracking, node-performance | External System | `inbound`, `sync_calls`, `publishes[*].consumers` |
| Network partner manager, expiry sweep timer, submission processor | Actor | `inbound` (partner managers); `policies[ExpireUnacknowledged]`; `Submission` invariant `ErrSubmissionNotDue` |
| `OnboardVendor`, `IssuePurchaseOrder`, `SubmitAcknowledgement`, `RequestLabel`, `SubmitShipmentConfirmation`, `ExpireUnacknowledgedOrders`, `CancelPurchaseOrder`, `ReceiveSubmission`, `ProcessSubmission` | Command | `aggregates[*].commands` |
| `VendorAccount`, `PurchaseOrder`, `Submission` | Aggregate | `aggregates` |
| `VendorOnboarded`, `PurchaseOrderIssued`, `PurchaseOrderAccepted`, `PurchaseOrderRejected`, `PurchaseOrderExpired`, `PurchaseOrderCancelled`, `VendorShipmentConfirmed`, `SubmissionProcessed` | Domain Event (published) | `publishes` |
| `FulfillmentReleasedToNode`, `FulfillmentCancelled`, `NodeRegistered`, `NodeActivated`, `NodeSuspended`, `NodeRetired`, `ListingCreated` | Domain Event (consumed) | `consumes` |
| `IssueOnRelease`, `CancelOnSourcingCancel`, `ExpireUnacknowledged`, `SimulationKnobs` | Policy | `policies` |
| `VendorNodeView`, `ListingView`, purchase-order poll | Read Model | `read_models`; `rest` `GET /vendor/purchase-orders` |
| H1: `ackBy` needs `handlingTime`, no source | Hotspot | `business_decisions` (`ackBy = min(...)`) vs `consumes` (no `NodeOperationalProfileDeclared`) and `read_models` (`VendorNodeView` sources) |
| H2: cancel after acknowledgement is refused and nobody is told | Hotspot | `invariants` (`ErrCancelAfterAcknowledgement`) vs order-sourcing `transitions` (`RELEASED` to `CANCELLED`); no event or message covers the refusal |
| H3: label is synchronous | Hotspot | `business_decisions` ("every vendor write returns 202") vs `SubmissionKind` (no label kind) and `sync_calls` (`IssueLabel`) |
| H4: vendor suspension has no route, event or effect | Hotspot | `aggregates[VendorAccount].commands` vs `rest`, `publishes`, `invariants` |
| H5: vendor never learns its `nodeId` | Hotspot | `aggregates[Submission]` (status and errors only) vs `rest` (`GET /vendor/nodes/{nodeId}` needs it) |
| H6: caller identity without auth | Hotspot | `conventions.no_auth` vs invariant `ErrNodeNotOwnedByVendor` and the `rest` query parameters (no vendor id on reads) |
