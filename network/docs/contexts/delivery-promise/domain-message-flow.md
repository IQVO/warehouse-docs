---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: Four Delivery Promise scenarios as ddd-crew domain message flows - quote to kept promise, re-promise after a cancelled departure, an unsourceable group, and a full or expired hold.
---

# Domain Message Flow

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Four business scenarios. Participants are bounded contexts and actors. Every
arrow is a message from the model, prefixed `cmd:` (command), `qry:` (query) or
`evt:` (event). Events travel over Kafka through each producer's outbox; the
diagrams draw them straight from producer to consumer. Event names are short;
full CloudEvents types are on [the domain events page](/network/contexts/delivery-promise/domain-events).
A self-arrow on `delivery-promise` marks an event the model publishes with no
consuming context (analytics only).
The domain-wide flows are on [the domain message flows page](/network/strategic-design/domain-message-flows).

## 1. Quote, promise, confirm, keep (happy path)

### 1a. Quote and checkout

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor SH as Shopper
    participant CO as customer-ordering
    participant DP as delivery-promise
    participant OS as order-sourcing
    SH->>DP: qry: POST /delivery-offers:quote<br/>QuoteDeliveryOffers
    DP-->>SH: qry: reply offers per tier
    SH->>CO: cmd: POST /checkout<br/>PlaceOrder
    CO->>DP: cmd: POST /promises<br/>MakePromise per group
    Note over DP: offer CONSUMED<br/>promise PROVISIONAL<br/>hold on the book
    DP-->>CO: cmd: reply 201<br/>holdExpiresAt
    DP-)DP: evt: PromiseMade
    CO->>DP: evt: CustomerOrderPlaced
    Note over DP: ConfirmPromise<br/>ConfirmCapacity
    DP-)DP: evt: PromiseConfirmed
    CO->>OS: evt: CustomerOrderPlaced
```

### 1b. Judged at delivery

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OS as order-<br/>sourcing
    participant ST as shipping-and-<br/>tracking
    participant DP as delivery-<br/>promise
    participant CO as customer-<br/>ordering
    participant NP as node-<br/>performance
    OS->>DP: evt: FulfillmentLocked
    ST->>DP: evt: PackageDelivered
    Note over DP: JudgeOnDelivery<br/>deliveredAt on time
    DP->>CO: evt: PromiseKept
    DP->>NP: evt: PromiseKept
```

Derived from: `model.yaml → contexts[delivery-promise].inbound`, `.publishes`,
`.policies[JudgeOnDelivery]`; `contexts[customer-ordering].sync_calls`,
`.policies[CheckoutPromising]`, `.inbound[POST /checkout]`.

Omitted: the read-model feeds that make the quote possible (board 1 of
[the EventStorming page](/network/contexts/delivery-promise/eventstorming)); a checkout
re-quote when the offer expired (`CheckoutPromising`); everything
`order-sourcing`, `vendor-connectivity` and the logistics contexts do between
the order and the delivery. What this context does with `FulfillmentLocked` is
not stated by the model (open question on
[the canvas page](/network/contexts/delivery-promise/bounded-context-canvas)). The
scenario is split in two to stay within the page width.

## 2. A cancelled departure breaks the witness path (main failure path)

### 2a. At risk, then revised

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant LH as linehaul-transportation
    participant DP as delivery-promise
    participant CO as customer-ordering
    participant OS as order-sourcing
    LH->>DP: evt: DepartureCancelled
    Note over DP: DepartureView updated<br/>promises using it found
    DP->>CO: evt: PromiseAtRisk
    Note over DP: RepromiseOnRisk<br/>recomputes
    alt a later feasible path exists
        DP->>CO: evt: PromiseRevised
        DP->>OS: evt: PromiseRevised
        Note over CO: UpdateGroupPromise
    else nothing feasible, even at STANDARD
        Note over DP: stays AT_RISK, see 2b
    end
```

### 2b. Nothing feasible: judged broken

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant ST as shipping-and-tracking
    participant DP as delivery-promise
    participant CO as customer-ordering
    participant NP as node-performance
    Note over DP: promise AT_RISK,<br/>no feasible revision
    ST->>DP: evt: PackageDelivered
    Note over DP: JudgeOnDelivery<br/>deliveredAt late
    DP->>CO: evt: PromiseBroken<br/>lateByMinutes, cause
    DP->>NP: evt: PromiseBroken
```

Derived from: `model.yaml → contexts[delivery-promise].policies[RepromiseOnRisk]`,
`.policies[JudgeOnDelivery]`, `.publishes[PromiseAtRisk, PromiseRevised, PromiseBroken]`;
`contexts[linehaul-transportation].business_decisions` (cancel announced before
the cutoff); `contexts[customer-ordering].aggregates[CustomerOrder].commands`.

Omitted: the case where the departure belongs to the assigned path but not to
the witness path (the model only triggers on the witness path); a promise that
is still `PROVISIONAL` (it is not re-promised; its hold expires or is
confirmed first). An `AT_RISK` promise whose package arrives on time is judged
`KEPT`. `RevisePromise` keeps `deliverByLatest` equal or later
(`ErrRevisionMovesEarlier`).

## 3. Order sourcing cannot meet the promise

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OS as order-sourcing
    participant DP as delivery-promise
    participant CO as customer-ordering
    OS->>DP: evt: FulfillmentUnsourceable<br/>promiseId, excludedNodes
    DP->>CO: evt: PromiseAtRisk
    Note over DP: RepromiseOnRisk recomputes
    alt revised window found
        DP->>CO: evt: PromiseRevised
        DP->>OS: evt: PromiseRevised
        Note over OS: ApplyRevisedPromise<br/>UNSOURCEABLE to QUEUED
    else no revised promise is feasible
        Note over CO: CancelOnUnfulfillable
        CO->>DP: evt: CustomerOrderCancelled<br/>groupNos
        Note over DP: CancelPromise<br/>capacity released
        DP-)DP: evt: PromiseCancelled
        CO->>OS: evt: CustomerOrderCancelled
    end
```

Derived from: `model.yaml → contexts[order-sourcing].business_decisions`
("sourcing never breaks a promise silently"), `.policies[ReassignOnRefusal]`,
`.aggregates[FulfillmentAssignment].transitions`;
`contexts[delivery-promise].policies[RepromiseOnRisk]`;
`contexts[customer-ordering].policies[CancelOnUnfulfillable]`.

Omitted: why the group became unsourceable (purchase-order rejections and
expiries on the vendor side). Excluding `excludedNodes` from the recompute is
this pack's reading of the event's fields; the model does not say it.

## 4. A full pickup cutoff, and a hold nobody confirmed

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant CO as customer-ordering
    participant DP as delivery-promise
    participant OS as order-sourcing
    CO->>DP: cmd: POST /promises<br/>MakePromise
    alt book has room
        Note over DP: HoldCapacity reaches share
        DP-->>CO: cmd: reply 201 PROVISIONAL
        DP->>OS: evt: PromiseBookExhausted
        Note over OS: AssignmentCost adds<br/>book pressure
    else book already full
        DP-->>CO: cmd: reply 409<br/>promise-capacity-exhausted
        CO->>DP: qry: POST /delivery-offers:quote<br/>QuoteDeliveryOffers
        DP-->>CO: qry: reply new offers
    end
    Note over CO: shopper abandons checkout
    Note over DP: ReleaseExpiredHolds<br/>after holdExpiresAt
    DP-)DP: evt: PromiseReleased
```

Derived from: `model.yaml → contexts[delivery-promise].aggregates[PromiseBook].invariants`,
`.publishes[PromiseBookExhausted, PromiseReleased]`,
`.aggregates[Promise].transitions[PROVISIONAL, RELEASED]`;
`contexts[customer-ordering].policies[CheckoutPromising]`;
`contexts[order-sourcing].policies[AssignmentCost]`.

Omitted: the `ErrBookClosed` branch (the cutoff minus handling time has passed;
same reply shape, `409 book-closed`). The re-quote after a refusal is
`customer-ordering`'s `CheckoutPromising` policy applied to a refused promise as
well as to an expired offer, which the model states only for the expired offer.
