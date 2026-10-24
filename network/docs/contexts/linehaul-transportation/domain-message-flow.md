---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: Four Linehaul Transportation scenarios as ddd-crew domain message flows, from a vendor cutoff to a pickup departure, through booking and loads, to a cancelled departure and re-promise.
---

# Domain Message Flow

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Participants are contexts and actors. Every arrow is a message from
`model.yaml`, prefixed `cmd:`, `qry:` or `evt:`. Events are written
`entity.EventName`; the full type is
`com.retailnetwork.<tier>.<producer>.<entity>.<EventName>` (see
[Domain Events](/contexts/linehaul-transportation/domain-events)). Route
parameters are written without braces. The network-wide flows are on
[Domain Message Flows](/strategic-design/domain-message-flows).

## 1. A vendor cutoff becomes a pickup departure

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant VC as vendor-<br/>connectivity
    participant NT as node-<br/>topology
    participant LH as linehaul-<br/>transportation
    participant DP as delivery-<br/>promise
    participant OS as order-<br/>sourcing
    VC->>NT: cmd: DeclareOperationalProfile<br/>PUT /nodes/nodeId/<br/>operational-profile
    NT->>LH: evt: node.NodeOperational-<br/>ProfileDeclared<br/>cutoffs, timezone, hours
    Note over LH: NodeProfileView updated
    NT->>LH: evt: node.NodeActivated
    Note over LH: PickupFromCutoffs<br/>one PICKUP per cutoff<br/>per operating day
    LH->>DP: evt: departure.<br/>DepartureScheduled<br/>kind PICKUP
    LH->>OS: evt: departure.<br/>DepartureScheduled<br/>kind PICKUP
    loop nightly, policy HorizonRoll
        Note over LH: GenerateDepartures<br/>keeps 14 days
        LH->>DP: evt: departure.<br/>DepartureScheduled
        LH->>OS: evt: departure.<br/>DepartureScheduled
    end
```

Derived from: `model.yaml → contexts[vendor-connectivity].sync_calls`,
`contexts[node-topology].publishes`,
`contexts[linehaul-transportation].policies[PickupFromCutoffs, HorizonRoll]`,
`.publishes[DepartureScheduled]`.

Omitted: `node-topology` also sends both events to `delivery-promise` and
`order-sourcing` directly (their `NodeProfileView`). The model fires
`PickupFromCutoffs` on `NodeOperationalProfileDeclared`; it states no
reaction to `NodeActivated`. Since a fulfillment centre declares its
profile before it is activated, this diagram shows the pickup after
activation, which is the business decision ("an `ACTIVE` vendor fulfillment
node"); the trigger is a reported model gap. Linehaul departures from lane
schedules (`DefineLaneSchedule`) follow the same `DepartureScheduled` path.

## 2. Booking on lock and the pickup load

Booking:

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant VC as vendor-<br/>connectivity
    participant OS as order-<br/>sourcing
    participant LH as linehaul-<br/>transportation
    participant DP as delivery-<br/>promise
    OS->>LH: evt: assignment.<br/>FulfillmentReleasedToNode
    Note over LH: ExpectedVolumeView
    VC->>OS: evt: purchaseorder.<br/>PurchaseOrderAccepted
    OS->>LH: evt: assignment.<br/>FulfillmentLocked<br/>pickupDepartureId
    Note over LH: BookOnLock<br/>BookCapacity
    alt within capacity, before cutoffAt
        LH->>DP: evt: departure.<br/>DepartureCapacityChanged
        LH->>OS: evt: departure.<br/>DepartureCapacityChanged
    else ErrDepartureFull or ErrDepartureClosed
        Note over LH: no event<br/>no follow-up in the model
    end
```

The pickup load at the vendor node:

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant ST as shipping-and-<br/>tracking
    participant LH as linehaul-<br/>transportation
    actor OP as Operators
    ST->>LH: evt: label.LabelIssued<br/>trackingNumber, assignmentId
    Note over LH: ExpectedVolumeView
    OP->>LH: cmd: OpenLoad<br/>POST /loads departureId
    OP->>LH: cmd: AddPackage<br/>POST /loads/loadId/packages
    OP->>LH: cmd: CloseLoad<br/>POST /loads/loadId:close
    OP->>LH: cmd: DispatchLoad<br/>POST /loads/loadId:dispatch
    LH->>ST: evt: load.LoadDeparted<br/>trackingNumbers, originNodeId
    Note over ST: HandoverOnFirstScan
```

Derived from: `model.yaml → contexts[order-sourcing].publishes`,
`contexts[vendor-connectivity].publishes[PurchaseOrderAccepted]`,
`contexts[shipping-and-tracking].publishes[LabelIssued]`,
`contexts[linehaul-transportation].policies[BookOnLock]`,
`.aggregates[Load].commands`, `.publishes`.

Omitted: `LoadClosed` (analytics only); the vendor's label request and
shipment confirmation through `vendor-connectivity`. The model's operators
are "sort-centre and station operators"; who builds a `PICKUP` load at a
vendor node is not stated, so `OP` here stands for whoever scans the pickup.

## 3. Consolidated at a sortation centre, arrived at a delivery station

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor SC as Sort-centre<br/>operator
    actor DS as Station<br/>operator
    participant LH as linehaul-<br/>transportation
    participant ST as shipping-and-<br/>tracking
    participant LM as last-mile-<br/>delivery
    SC->>LH: cmd: OpenLoad<br/>POST /loads departureId
    loop each scanned package
        SC->>LH: cmd: AddPackage trackingNumber
        alt package already on an open load
            LH-->>SC: cmd: reply 409<br/>package-already-loaded
        else load at departure capacity
            LH-->>SC: cmd: reply 409<br/>load-over-capacity
        end
    end
    SC->>LH: cmd: CloseLoad
    SC->>LH: cmd: DispatchLoad
    LH->>ST: evt: load.LoadDeparted
    DS->>LH: cmd: ReceiveLoad<br/>POST /loads/<br/>loadId:receive
    LH->>ST: evt: load.LoadArrived
    LH->>LM: evt: load.LoadArrived<br/>destinationNodeId,<br/>trackingNumbers
    Note over LM: InductOnArrival<br/>earliest eligible wave
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Load]`,
`.publishes[LoadDeparted, LoadArrived]`,
`contexts[last-mile-delivery].policies[InductOnArrival]`.

Omitted: the success replies of each command (`200` with the load);
`LoadClosed` (analytics only). The model does not say whether
`DispatchLoad` and `ReceiveLoad` also drive `RecordDeparture` and
`RecordArrival` on the departure, so `DepartureDeparted` and
`DepartureArrived` are not drawn.

## 4. Failure path: a departure is cancelled and promises are revised

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor PL as Network-ops<br/>planner
    participant NT as node-<br/>topology
    participant LH as linehaul-<br/>transportation
    participant DP as delivery-<br/>promise
    participant OS as order-<br/>sourcing
    participant CO as customer-<br/>ordering
    alt planner cancels one departure
        PL->>LH: cmd: CancelDeparture<br/>POST /departures/<br/>departureId:cancel
    else vendor node suspended
        NT->>LH: evt: node.NodeSuspended
        Note over LH: PickupFromCutoffs<br/>cancels future pickups
    end
    alt departure still SCHEDULED
        LH->>DP: evt: departure.<br/>DepartureCancelled
        LH->>OS: evt: departure.<br/>DepartureCancelled
        Note over DP: RepromiseOnRisk<br/>RevisePromise
        DP->>OS: evt: promise.<br/>PromiseRevised
        DP->>CO: evt: promise.<br/>PromiseRevised
    else already CLOSED, DEPARTED or ARRIVED
        LH-->>PL: cmd: reply 409<br/>no event
    end
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Departure].transitions`
(`SCHEDULED → CANCELLED` only), `.policies[PickupFromCutoffs]`,
`.business_decisions`, `contexts[delivery-promise].policies[RepromiseOnRisk]`,
`.publishes[PromiseRevised]`.

Omitted: if nothing is feasible even at `STANDARD`, `delivery-promise`
reports `PromiseBroken` at judgement time, much later. `order-sourcing`
updates its `NetworkGraphView` and may re-optimise queued assignments; the
model names no message for that. The 409 reply has no `Err...` identifier in
the model (illegal transition), a reported gap.
