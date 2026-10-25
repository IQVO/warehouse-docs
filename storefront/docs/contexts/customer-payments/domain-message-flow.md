---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: Six Customer Payments scenarios as ddd-crew domain message flows, covering authorize and void at checkout, capture on shipment, parked facts applied on bind, release on cancellation, refund on a lost or returned package, and re-authorization before expiry.
---

# Domain Message Flow

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Six scenarios. Participants are contexts, actors and the external provider.
Every arrow is a message from the model, prefixed `cmd:` (command), `qry:`
(query) or `evt:` (event). A `Note` names a command a context runs on itself.
Kafka is drawn as one participant. Event names are written
`entity.EventName`; the full type is
`com.retailnetwork.<tier>.<producer>.<entity>.<EventName>` (see
[Domain Events](/storefront/contexts/customer-payments/domain-events)). REST
path parameters are written without braces. The storefront-wide flows follow
from the [Context Map](/storefront/strategic-design/context-map).

## 1. Checkout authorizes the payment, or voids it

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant CK as checkout
    participant CP as customer-payments
    participant PSP as payment-provider
    participant K as Kafka analytics
    CK->>CP: cmd: AuthorizePayment<br/>POST /payment-authorizations<br/>key sessionId:auth
    Note over CP: ErrDuplicateAuthorization,<br/>ErrAllocationMismatch
    CP->>PSP: cmd: Authorize<br/>PSP token, total, key
    alt the provider approves
        PSP-->>CP: reply providerAuthorizationId,<br/>expiresAt
        CP->>K: evt: paymentauthorization.PaymentAuthorized
        CP-->>CK: cmd: reply 201 AUTHORIZED<br/>allocations per group
        Note over CK: place the order (pivot)
    else the provider declines
        PSP-->>CP: reply declined
        CP->>K: evt: paymentauthorization.PaymentDeclined
        CP-->>CK: cmd: reply 201 DECLINED<br/>session stays open
    end
    opt the place-order step is definitively rejected
        CK->>CP: cmd: VoidAuthorization<br/>POST /payment-authorizations/<br/>authorizationId:void<br/>key sessionId:void
        CP->>PSP: cmd: Void
        CP-->>CK: cmd: reply 200 VOIDED
    end
```

Derived from: `model.yaml → contexts[customer-payments].inbound` (checkout
cmd rows), `.aggregates[PaymentAuthorization]` (`commands`, `invariants`,
`notes`), `.sync_calls`, `.publishes[PaymentAuthorized, PaymentDeclined]`;
`contexts[checkout].sync_calls` (`AuthorizePayment`, `VoidAuthorization`).

Omitted: the saga around it (the binding `PriceQuote`, the offer pre-check,
the place-order step, the requote path, gap S3: checkout's own pages), the
outbox write and relay (see
[Sequence Diagrams](/storefront/contexts/customer-payments/sequence-diagrams)),
and the provider timeout, which the proposed REST contract answers with a
503 to retry under the same `Idempotency-Key`.

## 2. A shipped group is captured

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OS as order-sourcing
    participant K as Kafka
    participant CP as customer-payments
    participant PSP as payment-provider
    participant AN as Kafka analytics
    OS->>K: evt: assignment.<br/>FulfillmentShipped
    K->>CP: evt: assignment.<br/>FulfillmentShipped
    Note over CP: CaptureOnShipment:<br/>CaptureAllocation,<br/>ErrOverCapture,<br/>ErrCaptureAfterExpiry,<br/>ErrUnknownGroup
    CP->>PSP: cmd: Capture<br/>deterministic key
    PSP-->>CP: reply providerCaptureId
    Note over CP: allocation CAPTURED,<br/>tracking numbers stored,<br/>state moves on
    CP->>AN: evt: paymentauthorization.PaymentCaptured
```

Derived from: `model.yaml → contexts[customer-payments].consumes`
(`FulfillmentShipped`), `.policies[CaptureOnShipment]`,
`.aggregates[PaymentAuthorization]`, `.sync_calls`,
`.publishes[PaymentCaptured]`; `network/model/model.yaml →
contexts[order-sourcing].publishes[FulfillmentShipped]`.

Omitted: the inbox check on the CloudEvents `id`; the case where the order
is not bound yet (scenario 3); the `AUTHORIZED → CAPTURED` path of a
one-group order, which the model's `transitions` do not list (hotspot H3).

## 3. A fulfilment fact arrives before the order is bound

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OS as order-sourcing
    participant CK as checkout
    participant K as Kafka
    participant CP as customer-payments
    participant PSP as payment-provider
    OS->>K: evt: assignment.FulfillmentShipped
    K->>CP: evt: assignment.FulfillmentShipped
    Note over CP: no authorization is bound to<br/>this orderId yet.<br/>park in ParkedFulfillmentFacts
    CK->>K: evt: checkoutsession.CheckoutCompleted<br/>sessionId, orderId, authorizationId
    K->>CP: evt: checkoutsession.CheckoutCompleted
    Note over CP: BindOrderOnCheckoutCompleted:<br/>BindOrder, then apply parked facts
    CP->>PSP: cmd: Capture<br/>for the parked group
    PSP-->>CP: reply providerCaptureId
    Note over CP: PaymentCaptured is published<br/>as in scenario 2
```

Derived from: `model.yaml → contexts[customer-payments].read_models[ParkedFulfillmentFacts]`,
`.policies[BindOrderOnCheckoutCompleted]`, `.business_decisions`,
`.consumes`; `contexts[checkout].publishes[CheckoutCompleted]`; gap S4 on
the [Model Gap Register](/storefront/strategic-design/model-gap-register).

Omitted: the other three parked fact kinds (`FulfillmentCancelled`,
`PackageLost`, `PackageReturned`), which are parked and applied the same way;
and a fact for an order that never binds, which the model leaves without an
expiry (hotspot H10).

## 4. A cancelled group is released

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OS as order-sourcing
    participant K as Kafka
    participant CP as customer-payments
    participant AN as Kafka analytics
    OS->>K: evt: assignment.FulfillmentCancelled<br/>orderId, groupNo, reason
    K->>CP: evt: assignment.FulfillmentCancelled
    Note over CP: ReleaseOnCancellation:<br/>ReleaseAllocation for the group,<br/>ErrUnknownGroup.<br/>allocation RELEASED
    CP->>AN: evt: paymentauthorization.PaymentReleased<br/>amountMinor, reason
```

Derived from: `model.yaml → contexts[customer-payments].consumes`
(`FulfillmentCancelled`), `.policies[ReleaseOnCancellation]`,
`.publishes[PaymentReleased]`.

Omitted: the provider call. The provider port has no partial release verb,
so the model names no provider message for this flow (hotspot H4). Also
omitted: the order becoming `CANCELLED` in the network, and a refused cancel
(`FulfillmentCancelRefused`), which this context does not consume: the group
then ships and is captured through scenario 2.

## 5. A lost or returned package is refunded

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant ST as shipping-and-tracking
    participant K as Kafka
    participant CP as customer-payments
    participant PSP as payment-provider
    participant AN as Kafka analytics
    ST->>K: evt: journey.PackageLost<br/>or PackageReturned
    K->>CP: evt: journey.PackageLost<br/>or PackageReturned
    Note over CP: RefundOnLostPackage or<br/>RefundOnReturnToSender:<br/>RequestRefund, ErrOverRefund.<br/>Refund REQUESTED
    CP->>PSP: cmd: Refund<br/>deterministic key
    alt the provider refunds
        PSP-->>CP: reply refunded
        Note over CP: RecordRefundOutcome:<br/>REQUESTED to SUCCEEDED
        CP->>AN: evt: refund.RefundIssued
    else the provider fails
        PSP-->>CP: reply failure code
        Note over CP: RecordRefundOutcome:<br/>REQUESTED to FAILED
        CP->>AN: evt: refund.RefundFailed
    end
```

Derived from: `model.yaml → contexts[customer-payments].consumes`
(`PackageLost`, `PackageReturned`), `.policies[RefundOnLostPackage,
RefundOnReturnToSender]`, `.aggregates[Refund]`, `.sync_calls`,
`.publishes[RefundIssued, RefundFailed]`.

Omitted: the manual route (`POST /refunds` by storefront ops, reason
`MANUAL`), which runs the same refund steps; and how the tracking number
maps back to the group (stored on capture, hotspot H6).

## 6. An authorization is re-authorized before it expires

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant CP as customer-payments
    participant PSP as payment-provider
    participant AN as Kafka analytics
    Note over CP: clock: 24 h before expiresAt,<br/>allocations still PENDING.<br/>ReauthorizeBeforeExpiry
    CP->>PSP: cmd: Reauthorize<br/>uncaptured allocations, key
    PSP-->>CP: reply new provider reference
    Note over CP: ReauthorizePayment.<br/>no event, no state change<br/>in the model (hotspot H1)
    opt no reauthorization succeeded and expiresAt passes
        Note over CP: ExpireAuthorization,<br/>trigger not named (hotspot H2)
        CP->>AN: evt: paymentauthorization.PaymentAuthorizationExpired
    end
```

Derived from: `model.yaml → contexts[customer-payments].policies[ReauthorizeBeforeExpiry]`,
`.aggregates[PaymentAuthorization]` (`commands`, `transitions`),
`.sync_calls`, `.publishes[PaymentAuthorizationExpired]`.

Omitted: `VoidUnboundAuthorizations`, the other clock policy (no
`CheckoutCompleted` after 24 h: void). The `opt` block shows where the model
allows an expiry; it does not say what runs `ExpireAuthorization` or what
happens when the provider declines the reauthorization.
