---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: Four Customer Ordering scenarios as ddd-crew domain message flows, covering checkout, an expired offer at checkout, fulfilment to delivery, and cancellation.
---

# Domain Message Flow

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Four scenarios. Participants are contexts and actors. Every arrow is a
message from the model, prefixed `cmd:` (command), `qry:` (query) or `evt:`
(event). A `Note` names a command a context runs on itself. Kafka is drawn
as one participant. Event names are written `entity.EventName`; the full
type is `com.retailnetwork.<tier>.<producer>.<entity>.<EventName>` (see
[Domain Events](/network/contexts/customer-ordering/domain-events)). REST path
parameters are written without braces. The network-wide flows are on
[Domain Message Flows](/network/strategic-design/domain-message-flows).

## 1. Checkout: every group promised, order placed

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor SH as Shopper
    participant CO as customer-ordering
    participant DP as delivery-promise
    participant K as Kafka
    participant OS as order-sourcing
    SH->>CO: cmd: PlaceOrder<br/>POST /checkout
    loop each shipment group
        CO->>DP: cmd: MakePromise<br/>POST /promises offerId
        DP-->>CO: cmd: reply promiseId,<br/>tier, shipBy, window
    end
    Note over CO: PlaceOrder<br/>status PLACED
    CO->>K: evt: customerorder.<br/>CustomerOrderPlaced
    CO-->>SH: cmd: reply 201<br/>orderId, windows
    K->>DP: evt: customerorder.<br/>CustomerOrderPlaced
    Note over DP: ConfirmPromise<br/>per group
    K->>OS: evt: customerorder.<br/>CustomerOrderPlaced
    Note over OS: QueueAssignment<br/>per group
```

Derived from: `model.yaml → contexts[customer-ordering].inbound` (`POST /checkout`),
`.sync_calls` (`MakePromise`), `.policies[CheckoutPromising]`,
`.publishes[CustomerOrderPlaced]`; `contexts[delivery-promise].aggregates[Promise].transitions`;
`contexts[order-sourcing].aggregates[FulfillmentAssignment].commands`.

Omitted: the outbox write and relay (the event leaves after the commit; see
[Sequence Diagrams](/network/contexts/customer-ordering/sequence-diagrams)); the
events `delivery-promise` and `order-sourcing` raise in reaction
(`PromiseConfirmed` and `FulfillmentQueued`, both analytics-only). The shopper
saw the offers earlier, by querying `delivery-promise` directly; that query is
not this context's message.

## 2. Checkout fails: an offer expired (failure path)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor SH as Shopper
    participant CO as customer-ordering
    participant DP as delivery-promise
    participant K as Kafka
    SH->>CO: cmd: PlaceOrder<br/>POST /checkout, groups 1 and 2
    CO->>DP: cmd: MakePromise<br/>group 1 offerId
    DP-->>CO: cmd: reply promiseId,<br/>PROVISIONAL
    CO->>DP: cmd: MakePromise<br/>group 2 offerId
    DP-->>CO: cmd: reply 409<br/>ErrOfferNotQuotable
    CO->>DP: qry: QuoteDeliveryOffers<br/>POST /delivery-offers:quote
    DP-->>CO: qry: reply new offers<br/>with their windows
    CO-->>SH: cmd: reply 409<br/>offer-not-quotable, new offers
    Note over CO: no order saved,<br/>nothing published
    SH->>CO: cmd: PlaceOrder again<br/>group 2 with the new offer
    CO->>DP: cmd: MakePromise group 1<br/>same Idempotency-Key
    CO->>DP: cmd: MakePromise group 2<br/>new offerId
    CO->>K: evt: customerorder.<br/>CustomerOrderPlaced
    CO-->>SH: cmd: reply 201 orderId
```

Derived from: `model.yaml → contexts[customer-ordering].policies[CheckoutPromising]`,
`.sync_calls`; `contexts[delivery-promise].aggregates[DeliveryOffer].invariants`
(`ErrOfferNotQuotable`), `.aggregates[Promise].transitions`
(`ReleaseExpiredHolds`).

Omitted: the replies to the second checkout's two `MakePromise` calls. Also
omitted is the abandoned case. If the shopper never retries, group 1's promise
stays `PROVISIONAL` until `delivery-promise` releases it at `holdExpiresAt`
(`ReleaseExpiredHolds`, `PromiseReleased` to analytics only). This context
sends nothing for it. The same 409 shape is used for
`ErrPromiseCapacityExhausted` and `ErrBookClosed`. Reusing group 1's promise
relies on the proposed `Idempotency-Key` that this context derives from the
`offerId` when it calls `POST /promises`.

## 3. Fulfilment to delivery, with a re-promise

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OS as order-sourcing
    participant ST as shipping-and-tracking
    participant CO as customer-ordering
    participant DP as delivery-promise
    actor SH as Shopper
    OS->>CO: evt: assignment.<br/>FulfillmentLocked
    Note over CO: MarkInFulfillment
    ST->>CO: qry: GetShipTo GET<br/>/orders/orderId/ship-to
    CO-->>ST: qry: reply ShipTo
    ST->>CO: evt: label.LabelIssued
    OS->>CO: evt: assignment.<br/>FulfillmentShipped
    Note over CO: MarkGroupShipped
    ST->>CO: evt: journey.<br/>PackageScanned
    opt the path is no longer feasible
        DP->>CO: evt: promise.<br/>PromiseAtRisk
        DP->>CO: evt: promise.<br/>PromiseRevised
        Note over CO: UpdateGroupPromise
    end
    ST->>CO: evt: journey.<br/>PackageDelivered
    Note over CO: MarkGroupDelivered
    DP->>CO: evt: promise.PromiseKept<br/>or PromiseBroken
    SH->>CO: qry: GetTracking GET<br/>/orders/orderId/tracking
    CO-->>SH: qry: reply<br/>OrderTrackingView
```

Derived from: `model.yaml → contexts[customer-ordering].consumes`,
`.inbound` (`GetShipTo`, `GetTracking`), `.aggregates[CustomerOrder].transitions`,
`.read_models[OrderTrackingView]`; `contexts[shipping-and-tracking].sync_calls`.

Omitted: Kafka between producer and consumer; the vendor side that leads to
the label (`vendor-connectivity` asks `shipping-and-tracking` for it after the
purchase order is accepted); `PackageExceptionRaised`, which only updates the
tracking view; more than one group or package. The event-to-command pairing
is this pack's reading of the model (see the
[canvas](/network/contexts/customer-ordering/bounded-context-canvas) open questions).

## 4. Cancellation, by the shopper or by an unfulfillable group

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor SH as Shopper
    participant CO as customer-ordering
    participant K as Kafka
    participant DP as delivery-promise
    participant OS as order-sourcing
    SH->>CO: cmd: CancelOrder POST<br/>/orders/orderId:cancel
    alt no group is locked
        CO->>K: evt: customerorder.<br/>CustomerOrderCancelled
        CO-->>SH: cmd: reply 200<br/>CANCELLED
        K->>DP: evt: customerorder.<br/>CustomerOrderCancelled
        Note over DP: CancelPromise
        K->>OS: evt: customerorder.<br/>CustomerOrderCancelled
        Note over OS: CancelAssignment
    else a group is locked
        CO-->>SH: cmd: reply 409<br/>ErrCancelAfterLock
    end
```

Then the policy-driven variant, when a group cannot be sourced:

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OS as order-sourcing
    participant CO as customer-ordering
    participant DP as delivery-promise
    participant K as Kafka
    OS->>CO: evt: assignment.<br/>FulfillmentUnsourceable
    OS->>DP: evt: assignment.<br/>FulfillmentUnsourceable
    alt re-promised
        DP->>CO: evt: promise.<br/>PromiseRevised
        Note over CO: UpdateGroupPromise
    else nothing feasible
        Note over CO: CancelOnUnfulfillable,<br/>no model event for this
        CO->>K: evt: customerorder.<br/>CustomerOrderCancelled
    end
```

Derived from: `model.yaml → contexts[customer-ordering].inbound` (`POST /orders/{orderId}:cancel`), `.aggregates[CustomerOrder].invariants`
(`ErrCancelAfterLock`), `.policies[CancelOnUnfulfillable]`,
`.publishes[CustomerOrderCancelled]`; `contexts[delivery-promise].policies[RepromiseOnRisk]`;
`contexts[order-sourcing].consumes`.

Omitted: Kafka between `order-sourcing` and the two consumers of
`FulfillmentUnsourceable`. `order-sourcing` re-queues the group on
`PromiseRevised` (`ApplyRevisedPromise`). Two consequences of the model are
listed as open questions. First, `order-sourcing` has no transition from
`UNSOURCEABLE` to `CANCELLED`, so a cancellation of an unsourceable group has
no target transition there. Second, "no revised promise is feasible" has no
event.
