---
id: domain-message-flows
title: Domain Message Flows
sidebar_label: Domain Message Flows
description: "Six end-to-end scenarios across the retail-network contexts and the warehouse-systems vendor, drawn with the ddd-crew Domain Message Flow notation."
---

# Domain Message Flows

Following the ddd-crew
[Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling)
notation: each arrow is one message, prefixed `cmd:` (command), `evt:`
(event) or `qry:` (query). Only messages from the model appear. Each context's
own page adds its internal flows.

## 1. A vendor node is registered and declares its profile

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NF as network-fulfillment
    participant VC as vendor-connectivity
    participant NT as node-topology
    participant LH as linehaul
    participant DP as delivery-promise
    NF->>VC: cmd: RegisterVendorNode
    VC->>NT: cmd: RegisterNode
    NT-->>LH: evt: NodeRegistered
    NF->>VC: cmd: DeclareNodeProfile
    VC->>NT: cmd: DeclareOperationalProfile
    NT-->>LH: evt: NodeOperationalProfileDeclared
    NT-->>DP: evt: NodeOperationalProfileDeclared
    NT-->>LH: evt: NodeActivated
    LH-->>DP: evt: DepartureScheduled (PICKUP per cutoff)
```

## 2. Availability reaches the promise

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NF as network-fulfillment
    participant VC as vendor-connectivity
    participant OA as offer-availability
    participant DP as delivery-promise
    participant OS as order-sourcing
    NF->>VC: cmd: SubmitInventory (full feed)
    VC->>OA: cmd: ApplyInventoryFeed
    OA-->>DP: evt: ListingAvailabilityChanged
    OA-->>OS: evt: ListingAvailabilityChanged
    NF->>VC: qry: GetTransaction
```

## 3. Quote, checkout, promise

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor Shopper
    participant CO as customer-ordering
    participant DP as delivery-promise
    participant OS as order-sourcing
    Shopper->>DP: qry: QuoteDeliveryOffers
    Shopper->>CO: cmd: PlaceOrder
    CO->>DP: cmd: MakePromise (per group)
    DP-->>CO: promise PROVISIONAL, hold placed
    CO-->>DP: evt: CustomerOrderPlaced
    CO-->>OS: evt: CustomerOrderPlaced
    DP->>DP: ConfirmPromise
```

## 4. Release, commit, lock

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OS as order-sourcing
    participant VC as vendor-connectivity
    participant NF as network-fulfillment
    participant LH as linehaul
    participant DP as delivery-promise
    OS-->>VC: evt: FulfillmentReleasedToNode
    OS-->>LH: evt: FulfillmentReleasedToNode
    NF->>VC: qry: PollPurchaseOrders
    NF->>VC: cmd: SubmitAcknowledgement ACCEPT
    VC-->>OS: evt: PurchaseOrderAccepted
    OS-->>LH: evt: FulfillmentLocked
    OS-->>DP: evt: FulfillmentLocked
```

## 5. Refusal and re-promise

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NF as network-fulfillment
    participant VC as vendor-connectivity
    participant OS as order-sourcing
    participant DP as delivery-promise
    participant CO as customer-ordering
    NF->>VC: cmd: SubmitAcknowledgement REJECT
    VC-->>OS: evt: PurchaseOrderRejected
    OS->>OS: HandleNodeRefusal, no node meets deliverByLatest
    OS-->>DP: evt: FulfillmentUnsourceable
    OS-->>CO: evt: FulfillmentUnsourceable
    DP-->>OS: evt: PromiseRevised
    DP-->>CO: evt: PromiseRevised
    OS-->>VC: evt: FulfillmentReleasedToNode (next node)
```

## 6. Ship, move, deliver, judge

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NF as network-fulfillment
    participant VC as vendor-connectivity
    participant ST as shipping-and-tracking
    participant LH as linehaul
    participant LM as last-mile
    participant DP as delivery-promise
    NF->>VC: cmd: RequestLabel
    VC->>ST: cmd: IssueLabel
    NF->>VC: cmd: SubmitShipmentConfirmation
    VC-->>ST: evt: VendorShipmentConfirmed
    LH-->>ST: evt: LoadDeparted
    LH-->>LM: evt: LoadArrived
    LM-->>ST: evt: DeliveryAttempted DELIVERED
    ST-->>DP: evt: PackageDelivered
    DP->>DP: JudgePromise KEPT
```

Derived from (all six): `model.yaml` → `contexts[*].publishes[*].consumers`,
`contexts[*].sync_calls`, `contexts[vendor-connectivity].inbound`. Omitted:
analytics-only events, idempotency and retries (on each context's
sequence-diagrams page), and `node-performance`, which observes flows 4 to 6
(`PurchaseOrderAccepted`, `PackageHandedOver`, `PromiseKept`).
