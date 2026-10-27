---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: Four Node Performance scenarios as commands, events and queries between contexts, using only messages from model.yaml.
---

# Domain Message Flow

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Participants are contexts and actors. Every arrow is a message from the
model, prefixed `cmd:` (command), `evt:` (event) or `qry:` (query). Event
arrows go from the producer straight to the consumer; Kafka is implied.
Full CloudEvents types are on [Domain Events](/network/contexts/node-performance/domain-events).
The network-wide flows are on
[Domain message flows](/network/strategic-design/domain-message-flows).

## 1. A good node is graded and the grade reaches the promise

### 1a. Facts arrive

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OA as offer-<br/>availability
    participant VC as vendor-<br/>connectivity
    participant ST as shipping-and-<br/>tracking
    participant DP as delivery-promise
    participant NP as node-performance
    OA->>NP: evt: InventoryFeedApplied
    VC->>NP: evt: PurchaseOrderIssued<br/>requiredShipBy, ackBy
    VC->>NP: evt: PurchaseOrderAccepted<br/>well before ackBy
    VC->>NP: evt: VendorShipmentConfirmed<br/>trackingNumbers
    ST->>NP: evt: PackageHandedOver<br/>before requiredShipBy
    DP->>NP: evt: PromiseKept
    Note over NP: one RecordObservation<br/>per fact, 7d and 30d
```

### 1b. The grade is published

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NP as node-performance
    participant DP as delivery-promise
    participant OS as order-sourcing
    Note over NP: Recompute per minute<br/>enough observations<br/>Grading gives A
    NP->>DP: evt: NodeScorecardUpdated grade A
    NP->>OS: evt: NodeScorecardUpdated grade A
    Note over DP: ScorecardHandicap A<br/>adds nothing to shipBy
    Note over OS: AssignmentCost<br/>no scorecardPenalty
```

Derived from: model.yaml → contexts[node-performance].consumes,
.publishes, .policies[Grading]; contexts[delivery-promise].policies[ScorecardHandicap];
contexts[order-sourcing].policies[AssignmentCost].

Omitted: what causes each fact (`order-sourcing`'s
`FulfillmentReleasedToNode`, the vendor's calls on the Vendor API, the
label and the delivery that lead to `PromiseKept`); the other consumers of
each event (`order-sourcing` also consumes the purchase-order events).
Both windows publish their own `NodeScorecardUpdated`; one is drawn. The
size of `scorecardPenalty` per grade is not in the model.

## 2. A node degrades and is handicapped, not suspended

The most important failure path.

### 2a. Bad facts arrive

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant VC as vendor-connectivity
    participant ST as shipping-and-tracking
    participant DP as delivery-promise
    participant NP as node-performance
    VC->>NP: evt: PurchaseOrderIssued
    VC->>NP: evt: PurchaseOrderExpired
    VC->>NP: evt: PurchaseOrderIssued
    VC->>NP: evt: PurchaseOrderRejected<br/>CANNOT_MEET_SHIP_BY
    VC->>NP: evt: PurchaseOrderIssued
    VC->>NP: evt: PurchaseOrderAccepted<br/>in last 10% of ack window
    ST->>NP: evt: PackageHandedOver<br/>after requiredShipBy
    DP->>NP: evt: PromiseBroken<br/>lateByMinutes, cause
```

### 2b. The grade drops and neighbours react

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NP as node-performance
    participant AN as analytics
    participant DP as delivery-promise
    participant OS as order-sourcing
    Note over NP: Recompute<br/>on-time, kept fall<br/>late ack rises
    NP->>AN: evt: NodeThresholdBreached<br/>onTimeHandoverRate
    NP->>DP: evt: NodeScorecardUpdated grade D
    NP->>OS: evt: NodeScorecardUpdated grade D
    Note over DP: ScorecardHandicap D<br/>two cutoffs later
    Note over OS: AssignmentCost<br/>scorecardPenalty
    Note over NP: no command to<br/>node-topology, node<br/>stays ACTIVE
```

Derived from: model.yaml → contexts[node-performance].consumes,
.policies[Grading, ThresholdAlert], .business_decisions;
contexts[vendor-connectivity].aggregates[PurchaseOrder].value_objects
(RejectReason); contexts[delivery-promise].policies[ScorecardHandicap];
contexts[order-sourcing].policies[AssignmentCost].

Omitted: `order-sourcing`'s own reaction to the rejection and the expiry
(`ReassignOnRefusal`), which happens whatever the grade is. A single bad
day rarely moves a 30-day grade; the diagram compresses many facts into a
few. The threshold values for `NodeThresholdBreached` are not in the model.

## 3. A new node stays provisional

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NT as node-topology
    participant VC as vendor-connectivity
    participant NP as node-performance
    participant DP as delivery-promise
    NT->>NP: evt: NodeRegistered
    NT->>NP: evt: NodeOperationalProfileDeclared
    Note over NP: no metric reads<br/>the declaration
    VC->>NP: evt: PurchaseOrderIssued
    VC->>NP: evt: PurchaseOrderAccepted
    Note over NP: first RecordObservation<br/>creates 7d and 30d
    Note over NP: Recompute, below<br/>minObservations
    NP->>DP: evt: NodeScorecardUpdated<br/>grade PROVISIONAL
    Note over DP: ScorecardHandicap has<br/>no PROVISIONAL rule
```

Derived from: model.yaml → contexts[node-performance].business_decisions
(PROVISIONAL, not A), .aggregates[NodeScorecard].invariants
(`ErrInsufficientObservations`), .ul[Grade];
contexts[delivery-promise].policies[ScorecardHandicap].

Omitted: `order-sourcing` receives the same event. The last note is a
model gap, not a behaviour: how `delivery-promise` treats `PROVISIONAL` is
open.

## 4. A vendor reads its node's scorecard

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NF as network-fulfillment<br/>vendor V-WS
    participant VC as vendor-connectivity
    participant NP as node-performance
    NF->>VC: qry: GET /vendor/nodes/<br/>nodeId/scorecard
    Note over VC: node owned by vendor<br/>ErrNodeNotOwnedByVendor
    VC->>NP: qry: GetScorecard<br/>GET /scorecards/nodeId
    NP-->>VC: qry: reply 7d and 30d
    VC-->>NF: qry: reply in the<br/>Vendor API language
```

Derived from: model.yaml → contexts[vendor-connectivity].inbound (qry
GetScorecard), .sync_calls (GET /scorecards/nodeId),
.aggregates[VendorAccount].invariants; contexts[node-performance].inbound,
.rest; meta.hard_boundary.

Omitted: the `404` branch for a node with no scorecard yet (see
[Use Cases](/network/contexts/node-performance/use-cases)); the Vendor API's rate
limit (`429`). Path parameters are written without braces.
`network-fulfillment` belongs to the warehouse-systems fleet; this is the
only path by which the fleet sees a grade.
