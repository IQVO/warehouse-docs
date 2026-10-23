---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: Four Node Topology scenarios as ddd-crew domain message flows, from a vendor node joining the network to a node being suspended.
---

# Domain Message Flow

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Participants are contexts and actors. Every arrow is a message from the
model, prefixed `cmd:` (command), `qry:` (query) or `evt:` (event). Events go
through `retailnetwork.node-topology.events`; the diagrams draw them straight
to the consumer. Full CloudEvents types are
`com.retailnetwork.logistics.node-topology.<entity>.<EventName>` (see
[Domain Events](/contexts/node-topology/domain-events)). Path parameters are
written without braces. The domain-wide flows are on
[Domain Message Flows](/strategic-design/domain-message-flows).

## 1. A vendor node joins the network (happy path)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NF as network-fulfillment<br/>fleet
    participant VC as vendor-<br/>connectivity
    participant NT as node-topology
    actor PL as planner
    participant LH as linehaul-<br/>transportation
    NF->>VC: cmd: RegisterVendorNode<br/>POST /vendor/nodes
    VC-->>NF: cmd: reply 202<br/>transactionId
    VC->>NT: cmd: RegisterNode<br/>POST /nodes, VENDOR
    NT-->>VC: cmd: reply 201<br/>nodeId, PROPOSED
    NT-)LH: evt: NodeRegistered
    NF->>VC: qry: GetTransaction
    VC-->>NF: qry: reply SUCCESS
    NF->>VC: cmd: DeclareNodeProfile<br/>PUT .../profile
    VC->>NT: cmd: DeclareOperational<br/>Profile, PUT
    NT-->>VC: cmd: reply 200<br/>profileRevision
    NT-)LH: evt: NodeOperational<br/>ProfileDeclared
    PL->>NT: cmd: ActivateNode
    NT-->>PL: cmd: reply 200<br/>ACTIVE
    NT-)LH: evt: NodeActivated
    Note over LH: PickupFromCutoffs<br/>one pickup per cutoff
```

Derived from: model.yaml → `contexts[vendor-connectivity].inbound`,
`.rest`, `.sync_calls`; `contexts[node-topology].inbound`, `.publishes`;
`contexts[linehaul-transportation].policies[PickupFromCutoffs]`,
`.business_decisions`.

Omitted: the other consumers of the same events (`NodeRegistered` also goes
to `offer-availability`, `delivery-promise`, `order-sourcing`,
`last-mile-delivery`, `node-performance` and `vendor-connectivity`;
`NodeOperationalProfileDeclared` to `delivery-promise`, `order-sourcing` and
`node-performance`; `NodeActivated` to `offer-availability`,
`delivery-promise`, `order-sourcing` and `vendor-connectivity`); the second
`GetTransaction` poll after the profile declaration; `vendor-connectivity`'s
own `SubmissionProcessed` event; and the lane from the new node to a
sortation centre, which the planner opens as in scenario 3.

## 2. A vendor write refused, and an incomplete node not activated (failure paths)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NF as network-fulfillment<br/>fleet
    participant VC as vendor-<br/>connectivity
    participant NT as node-topology
    actor PL as planner
    NF->>VC: cmd: RegisterVendorNode<br/>SORTATION_CENTER
    VC-->>NF: cmd: reply 202<br/>transactionId
    VC->>NT: cmd: RegisterNode<br/>POST /nodes, VENDOR
    NT-->>VC: cmd: reply 422 operator-<br/>not-allowed-for-node-type
    Note over VC: submission FAILURE<br/>no node, no event
    NF->>VC: qry: GetTransaction
    VC-->>NF: qry: reply FAILURE
    NF->>VC: cmd: DeclareNodeProfile<br/>revision not above current
    VC->>NT: cmd: DeclareOperational<br/>Profile, PUT
    NT-->>VC: cmd: reply 409<br/>stale-profile-revision
    Note over VC: submission FAILURE<br/>old revision stays current
    PL->>NT: cmd: ActivateNode<br/>FC with no cutoff
    NT-->>PL: cmd: reply 409 incomplete-<br/>operational-profile
    Note over NT: stays PROPOSED<br/>no NodeActivated
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Node].invariants`
(`ErrOperatorNotAllowedForNodeType`, `ErrStaleProfileRevision`,
`ErrIncompleteOperationalProfile`); `contexts[vendor-connectivity].aggregates[Submission]`.

Omitted: `ErrCutoffOutsideOperatingHours`, `ErrUnknownRegion`,
`ErrSubtypeNotAllowed` and `ErrSortDwellNotAllowed` (all 422, same shape as
the first branch), and `ErrVendorNodeCodeTaken` (409, same shape as the stale
revision branch). The same incomplete-profile refusal (`ErrIncompleteOperationalProfile`) also
stops a later revision of an `ACTIVE` fulfillment centre that drops every
cutoff or sets `handlingTime` to zero. Nothing reaches Kafka from this context on any refusal. The problem
`type` slugs are listed on [Use Cases](/contexts/node-topology/use-cases).

## 3. The planner adds a delivery station and its service area

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor PL as planner
    participant NT as node-topology
    participant LH as linehaul-<br/>transportation
    participant LM as last-mile-<br/>delivery
    participant DP as delivery-<br/>promise
    PL->>NT: cmd: RegisterNode<br/>DELIVERY_STATION, NETWORK
    NT-)LM: evt: NodeRegistered
    PL->>NT: cmd: ActivateNode
    NT-)DP: evt: NodeActivated
    PL->>NT: cmd: OpenLane<br/>SC to DS, GROUND
    NT-)LH: evt: LaneOpened
    NT-)DP: evt: LaneOpened
    PL->>NT: cmd: AssignServiceArea<br/>PUT, version n
    NT-)LM: evt: ServiceAreaAssigned
    NT-)DP: evt: ServiceAreaAssigned
    Note over DP: the prefix can be<br/>promised via the station
```

Derived from: model.yaml → `contexts[node-topology].inbound`, `.publishes`,
`.aggregates[Lane|ServiceArea].invariants`; `lane_rules.allowed`;
`contexts[last-mile-delivery].read_models[StationView]`;
`contexts[delivery-promise].read_models`.

Omitted: the replies (201 or 200 with the new state); the other consumers
(`order-sourcing` takes every event shown; `offer-availability`,
`node-performance` and `vendor-connectivity` also take `NodeRegistered`);
`DefineRegion`, which precedes the station when the region is new; the
branches `ErrLaneEndpointNotActive` (opening the lane before activation) and
`ErrNotADeliveryStation` (assigning to a node that is not an `ACTIVE`
station), both 409.

## 4. A node is suspended

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor PL as planner
    participant NT as node-topology
    participant OA as offer-<br/>availability
    participant LH as linehaul-<br/>transportation
    participant DP as delivery-<br/>promise
    participant OS as order-<br/>sourcing
    PL->>NT: cmd: SuspendNode<br/>with reason
    NT-->>PL: cmd: reply 200<br/>SUSPENDED
    NT-)OA: evt: NodeSuspended
    Note over OA: SuppressOnNode<br/>Unavailable
    NT-)LH: evt: NodeSuspended
    Note over LH: PickupFromCutoffs<br/>cancels future pickups
    LH-)DP: evt: Departure<br/>Cancelled
    LH-)OS: evt: Departure<br/>Cancelled
    NT-)DP: evt: NodeSuspended
    Note over DP: RepromiseOnRisk
    NT-)OS: evt: NodeSuspended
```

Derived from: model.yaml → `contexts[node-topology].publishes[NodeSuspended]`;
`contexts[offer-availability].policies[SuppressOnNodeUnavailable]`;
`contexts[linehaul-transportation].policies[PickupFromCutoffs]`,
`.publishes[DepartureCancelled]`;
`contexts[delivery-promise].policies[RepromiseOnRisk]`.

Omitted: `vendor-connectivity` also consumes `NodeSuspended` (its
`VendorNodeView`); the listing events `offer-availability` then publishes
(`ListingSuppressed`); the reactivation path (`ActivateNode` from
`SUSPENDED`, `NodeActivated`, listings restored). The node's lanes stay
`OPEN` and its assigned service areas stay `ASSIGNED`: policy
`SuspendedEndpointsUnusable` closes nothing, and consumers treat them as
unusable while the node is not `ACTIVE`.
