---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: "Key Shipping & Tracking scenarios as ddd-crew domain message flows: label issue, handover to delivery, and the failed-attempt and silence path."
---

# Domain Message Flow

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Participants are contexts and actors. Every arrow is a message from
`model.yaml`, prefixed `cmd:`, `qry:` or `evt:`. Events are written
`<entity>.<EventName>`; the full type is
`com.retailnetwork.<tier>.<producer>.<entity>.<EventName>` (see
[Domain Events](/network/contexts/shipping-and-tracking/domain-events)). Kafka is not
drawn: an event arrow goes straight from producer to consumer. Path
parameters are written without braces. The domain-wide flows are on
[Domain Message Flows](/network/strategic-design/domain-message-flows).

## 1. A label is issued

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NF as network-<br/>fulfillment, fleet
    participant VC as vendor-<br/>connectivity
    participant ST as shipping-<br/>and-tracking
    participant CO as customer-<br/>ordering
    participant LH as linehaul-<br/>transportation
    NF->>VC: cmd: RequestLabel<br/>POST /vendor<br/>/shipping-labels
    VC->>ST: cmd: IssueLabel<br/>POST /labels
    ST->>CO: qry: GetShipTo GET<br/>/orders/orderId<br/>/ship-to
    CO-->>ST: qry: reply ship-to
    Note over ST: label ISSUED, encrypted<br/>snapshot, journey LABELLED
    ST-->>VC: cmd: reply labelRef,<br/>trackingNumber, carrier
    ST->>LH: evt: label.LabelIssued
    ST->>CO: evt: label.LabelIssued
```

Derived from: `model.yaml → contexts[vendor-connectivity].inbound`
(`RequestLabel`) and `.sync_calls` (`IssueLabel`);
`contexts[shipping-and-tracking].sync_calls` (`GetShipTo`), `.publishes`
(`LabelIssued`).

The `IssueLabel` request carries `poNumber`, `packageNo`, `assignmentId`,
`orderId` and `tier` (assumed; the model does not list its fields).

Omitted: how `vendor-connectivity` answers the vendor (its own pages; never
with the address); the failure branches (ship-to unavailable, duplicate
`(poNumber, packageNo)`), shown in
[Sequence Diagrams](/network/contexts/shipping-and-tracking/sequence-diagrams); how the vendor
gets a printable label, which the model does not say.

## 2. Handover and the middle mile

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant VC as vendor-<br/>connectivity
    participant LH as linehaul-<br/>transportation
    participant ST as shipping-<br/>and-tracking
    participant NP as node-<br/>performance
    participant CO as customer-<br/>ordering
    VC->>ST: evt: purchaseorder.<br/>VendorShipmentConfirmed
    Note over ST: vendor scan stored,<br/>stays LABELLED
    LH->>ST: evt: load.LoadDeparted<br/>at the vendor node
    Note over ST: first departure of a<br/>LABELLED journey = handover
    ST->>NP: evt: journey.<br/>PackageHandedOver
    ST->>CO: evt: journey.PackageScanned<br/>HANDED_OVER
    LH->>ST: evt: load.LoadArrived<br/>at a sortation centre
    ST->>CO: evt: journey.PackageScanned<br/>IN_TRANSIT
    LH->>ST: evt: load.LoadDeparted<br/>from the sortation centre
    ST->>CO: evt: journey.PackageScanned<br/>IN_TRANSIT
    LH->>ST: evt: load.LoadArrived<br/>at the delivery station
    ST->>CO: evt: journey.PackageScanned<br/>AT_STATION
```

Derived from: `model.yaml → contexts[shipping-and-tracking].consumes`,
`.policies[HandoverOnFirstScan]`, `.aggregates[PackageJourney].transitions`,
`.publishes`.

Omitted: `VendorShipmentConfirmed` also goes to `order-sourcing` and
`node-performance`, and `LoadArrived` also to `last-mile-delivery` (their
pages). Telling a delivery station from a sortation centre needs node types
this context does not consume (a model gap, see the
[canvas open questions](/network/contexts/shipping-and-tracking/bounded-context-canvas)).
A direct-injection lane from the vendor node to the station has no
`HANDED_OVER -> AT_STATION` edge in the model.

## 3. Out for delivery and delivered

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant LM as last-mile-<br/>delivery
    participant ST as shipping-<br/>and-tracking
    participant DP as delivery-<br/>promise
    participant OS as order-<br/>sourcing
    participant CO as customer-<br/>ordering
    LM->>ST: evt: route.<br/>PackageOutForDelivery
    ST->>CO: evt: journey.PackageScanned<br/>OUT_FOR_DELIVERY
    LM->>ST: evt: route.DeliveryAttempted<br/>outcome DELIVERED
    Note over ST: journey DELIVERED, terminal
    ST->>CO: evt: journey.PackageScanned<br/>DELIVERED
    ST->>DP: evt: journey.<br/>PackageDelivered
    ST->>OS: evt: journey.<br/>PackageDelivered
    ST->>CO: evt: journey.<br/>PackageDelivered
    Note over DP: JudgeOnDelivery<br/>against deliverByLatest
    DP->>CO: evt: promise.PromiseKept<br/>or promise.PromiseBroken
```

Derived from: `model.yaml → contexts[shipping-and-tracking].consumes`,
`.publishes[PackageDelivered]`; `contexts[delivery-promise].policies[JudgeOnDelivery]`,
`.publishes[PromiseKept, PromiseBroken]`.

Omitted: `PromiseKept` and `PromiseBroken` also go to `node-performance`;
`order-sourcing` raises `FulfillmentDelivered` (analytics only).

## 4. Failed attempt, then silence

The most important failure path: a package that stops moving must reach
`delivery-promise` before the promise date passes.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant LH as linehaul-<br/>transportation
    participant LM as last-mile-<br/>delivery
    participant ST as shipping-<br/>and-tracking
    participant DP as delivery-<br/>promise
    participant CO as customer-<br/>ordering
    LM->>ST: evt: route.DeliveryAttempted<br/>outcome FAILED
    Note over ST: back to AT_STATION
    ST->>CO: evt: journey.PackageScanned<br/>AT_STATION
    opt a late scan arrives
        LH->>ST: evt: load.LoadArrived<br/>older arrivedAt
        Note over ST: ErrScanOutOfOrder<br/>stored, not applied
    end
    Note over ST: no scan in leg<br/>time plus tolerance
    ST->>ST: cmd: RaiseException<br/>NO_SCAN
    ST->>DP: evt: journey.<br/>PackageExceptionRaised
    ST->>CO: evt: journey.<br/>PackageExceptionRaised
    Note over DP: RepromiseOnRisk
    DP->>CO: evt: promise.PromiseRevised
```

Derived from: `model.yaml → contexts[shipping-and-tracking].policies[ExceptionOnSilence]`,
`.aggregates[PackageJourney].invariants`, `.publishes[PackageExceptionRaised]`;
`contexts[delivery-promise].policies[RepromiseOnRisk]`,
`.publishes[PromiseRevised]`; `contexts[last-mile-delivery].policies[RetryNextWave]`.

Omitted: the next wave's `PackageOutForDelivery` (as in scenario 3);
`PromiseRevised` also goes to `order-sourcing`. If nothing is feasible even at
`STANDARD`, `delivery-promise` reports `PromiseBroken` at judgement time. After
three failed attempts `last-mile-delivery` returns the package to sender, but
no event tells this context, so `ReturnToSender` is not drawn.
