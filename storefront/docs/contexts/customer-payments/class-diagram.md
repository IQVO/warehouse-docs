---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: Proposed UML class diagrams of Customer Payments' domain model, events and policies, and the hexagonal ports-and-adapters layout with the payment provider Anti-Corruption Layer a Go implementation would use.
---

# Class Diagram

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

UML class diagrams of the **proposed** `internal/domain/**` packages, plus
the hexagonal ports and adapters. Type names come from the model's code
identifiers (`authorization.PaymentAuthorization`,
`authorization.Allocation`, `refund.Refund`) and value objects. Fields are
unexported in Go and shown with `-`; methods are shown with `+`.

## 1. The PaymentAuthorization aggregate and its allocations

```mermaid
classDiagram
    direction TB
    class PaymentAuthorization {
        <<AggregateRoot>>
        -authorizationId string
        -checkoutSessionId string
        -orderId string nullable
        -currency string
        -totalMinor int64
        -allocations Allocation[]
        -providerRef ProviderRef
        -expiresAt time.Time
        -status AuthorizationStatus
        -version int
        +AuthorizePayment(sessionId, total, allocations, at)$ PaymentAuthorization
        +CaptureAllocation(groupNo, at) error
        +ReleaseAllocation(groupNo, reason, at) error
        +VoidAuthorization(at) error
        +ExpireAuthorization(at) error
        +ReauthorizePayment(at) error
        +BindOrder(orderId) error
    }
    class AuthorizationStatus {
        <<Enumeration>>
        AUTHORIZED
        PARTIALLY_CAPTURED
        CAPTURED
        VOIDED
        EXPIRED
        DECLINED
    }
    class Allocation {
        <<ValueObject>>
        -groupNo int
        -amountMinor int64
        -state AllocationState
    }
    class AllocationState {
        <<Enumeration>>
        PENDING
        CAPTURED
        RELEASED
    }
    class ProviderRef {
        <<ValueObject>>
        -providerAuthorizationId string
        -providerCaptureIds string[]
    }
    PaymentAuthorization --> AuthorizationStatus : status
    PaymentAuthorization *-- "1..*" Allocation : allocations
    PaymentAuthorization *-- "1" ProviderRef : providerRef
    Allocation --> AllocationState : state
```

Derived from: `model.yaml → contexts[customer-payments].aggregates[PaymentAuthorization]`
(`description`, `states`, `transitions`, `value_objects`, `commands`,
`invariants`, `notes`).

Omitted: the `Err...` variables (`ErrDuplicateAuthorization`,
`ErrAllocationMismatch`, `ErrOverCapture`, `ErrCaptureAfterExpiry`,
`ErrUnknownGroup`; listed on the
[Aggregate Design Canvas](/storefront/contexts/customer-payments/aggregate-design-canvas))
and the tracking numbers the model says `CaptureOnShipment` stores against
the group, which have no field in the model's value objects (hotspot H6).
`ErrDuplicateAuthorization` is enforced by a unique key on
`checkoutSessionId` in the repository, not by a method of the aggregate. The
PSP token is an argument of the provider port; no field of the aggregate
holds card data.

## 2. The Refund aggregate

```mermaid
classDiagram
    direction TB
    class Refund {
        <<AggregateRoot>>
        -refundId string
        -orderId string
        -amountMinor int64
        -reason RefundReason
        -status RefundStatus
        -version int
        +RequestRefund(orderId, amountMinor, reason, at)$ Refund
        +RecordRefundOutcome(result, at) error
    }
    class RefundReason {
        <<Enumeration>>
        LOST
        RETURNED_TO_SENDER
        MANUAL
    }
    class RefundStatus {
        <<Enumeration>>
        REQUESTED
        SUCCEEDED
        FAILED
    }
    Refund --> RefundReason : reason
    Refund --> RefundStatus : status
```

Derived from: `model.yaml → contexts[customer-payments].aggregates[Refund]`
(`description`, `states`, `transitions`, `value_objects`, `commands`,
`invariants`).

Omitted: `ErrOverRefund`, enforced against the order's captured total, which
spans the authorization's allocations and the order's earlier refunds; the
model does not say which aggregate or domain service holds that sum
(hotspot H12).

## 3. Read model, events and policies

```mermaid
classDiagram
    direction TB
    class ParkedFulfillmentFacts {
        <<ReadModel>>
        -facts map orderId to fact[]
        +Park(orderId, fact)
        +Take(orderId) fact[]
    }
    class PaymentAuthorized {
        <<DomainEvent>>
        +authorizationId string
        +checkoutSessionId string
        +currency string
        +totalMinor int64
        +allocations groupNo, amountMinor
        +expiresAt time.Time
    }
    class PaymentCaptured {
        <<DomainEvent>>
        +authorizationId string
        +orderId string
        +groupNo int
        +amountMinor int64
    }
    class PaymentReleased {
        <<DomainEvent>>
        +authorizationId string
        +orderId string
        +groupNo int
        +amountMinor int64
        +reason string
    }
    class PaymentAuthorizationExpired {
        <<DomainEvent>>
        +authorizationId string
        +orderId string
        +expiredAt time.Time
    }
    class PaymentDeclined {
        <<DomainEvent>>
        +checkoutSessionId string
        +reason string
        +at time.Time
    }
    class RefundIssued {
        <<DomainEvent>>
        +refundId string
        +orderId string
        +amountMinor int64
        +reason string
    }
    class RefundFailed {
        <<DomainEvent>>
        +refundId string
        +orderId string
        +code string
    }
```

```mermaid
classDiagram
    direction LR
    class BindOrderOnCheckoutCompleted {
        <<Policy>>
        bind orderId, then apply
        parked facts
    }
    class CaptureOnShipment {
        <<Policy>>
        capture the group's allocation,
        store the tracking number
    }
    class ReleaseOnCancellation {
        <<Policy>>
        release the group's allocation
    }
    class RefundOnLostPackage {
        <<Policy>>
        refund the group, reason LOST
    }
    class RefundOnReturnToSender {
        <<Policy>>
        refund the group,
        reason RETURNED_TO_SENDER
    }
    class ReauthorizeBeforeExpiry {
        <<Policy>>
        re-authorize 24 h
        before expiresAt
    }
    class VoidUnboundAuthorizations {
        <<Policy>>
        void if no CheckoutCompleted
        after 24 h
    }
    class PaymentCaptured {
        <<DomainEvent>>
    }
    class PaymentReleased {
        <<DomainEvent>>
    }
    class RefundIssued {
        <<DomainEvent>>
    }
    CaptureOnShipment ..> PaymentCaptured : leads to
    ReleaseOnCancellation ..> PaymentReleased : leads to
    RefundOnLostPackage ..> RefundIssued : leads to
    RefundOnReturnToSender ..> RefundIssued : leads to
```

Derived from: `model.yaml → contexts[customer-payments].read_models`,
`.publishes`, `.policies`, `.ul`.

Omitted: the CloudEvents envelope (built in the Kafka adapter); the
`RefundFailed`, `PaymentAuthorized`, `PaymentDeclined` and
`PaymentAuthorizationExpired` links, which come from commands rather than
policies; and the two policies that end in a command without an event
(`BindOrderOnCheckoutCompleted`, `ReauthorizeBeforeExpiry`,
`VoidUnboundAuthorizations`, hotspot H1). The fact shape inside
`ParkedFulfillmentFacts` is the consumed event's fields.

## 4. Hexagonal ports and adapters

```mermaid
flowchart TB
    subgraph IN["internal/adapters/inbound"]
        HTTP["http<br/>checkout writes and reads,<br/>ops refunds and reads"]
        KC["kafka<br/>consumers: checkout,<br/>order-sourcing,<br/>shipping-and-tracking"]
        SCH["scheduler<br/>reauthorize, void unbound"]
    end
    APP["<b>internal/application/usecases</b><br/>AuthorizePayment, VoidAuthorization<br/>CaptureAllocation, ReleaseAllocation<br/>BindOrder, ReauthorizePayment<br/>ExpireAuthorization<br/>RequestRefund, RecordRefundOutcome"]
    DOM["<b>internal/domain</b><br/>authorization.PaymentAuthorization<br/>authorization.Allocation, ProviderRef<br/>refund.Refund"]
    PORTS["<b>internal/application/ports</b><br/>AuthorizationRepository<br/>RefundRepository<br/>ParkedFactsStore<br/>PaymentProvider (ACL)<br/>Outbox, Inbox<br/>IdempotencyStore<br/>UnitOfWork, Clock"]
    subgraph OUT["internal/adapters/outbound"]
        A1["postgres<br/>repositories, parked facts, outbox,<br/>inbox, idempotency store, UoW"]
        A2["kafka<br/>outbox relay"]
        A3["paymentprovider<br/>ACL adapter: Authorize, Capture,<br/>Void, Refund, Reauthorize<br/>(calls the simulator)"]
    end
    HTTP --> APP
    KC --> APP
    SCH --> APP
    HTTP -. reads .-> PORTS
    APP --> DOM
    APP --> PORTS
    PORTS --- A1
    PORTS --- A3
    A1 -. outbox rows .-> A2

    classDef outblue fill:#e7f5ff,stroke:#1c7ed6,color:#000
    class A3 outblue
```

Derived from: `model.yaml → contexts[customer-payments].aggregates`,
`.inbound`, `.sync_calls`, `.read_models`, `.policies`;
`conventions.integration_rules` (outbox, inbox, Idempotency-Key); the
fleet's Go hexagonal layout. `sync_calls` holds exactly one row, so the
**only outbound client** is the `paymentprovider` adapter behind the
`PaymentProvider` port.

**The Anti-Corruption Layer.** The `PaymentProvider` port is the five verbs
of the model: `Authorize`, `Capture`, `Void`, `Refund`, `Reauthorize`. It
speaks the domain's language (a PSP token, an `Allocation`, an amount in
minor units, a key deterministic per (operation, `authorizationId`,
`groupNo`)) and returns domain results (an approval with a `ProviderRef`
and `expiresAt`, a decline `reason`, a failure `code`). Everything the
provider names differently stays in the adapter; the payment-provider
simulator is its stand-in, and a real provider replaces only this package.
The port never receives a card number.

Omitted: the composition root (`cmd/customer-payments`), metrics and
tracing. The scheduler is an inbound adapter: time triggers
`ReauthorizePayment` and `VoidAuthorization`. The read routes
(`GetAuthorization`, `ListAuthorizations`, `ListRefunds`) read the
repositories through their ports without a use case.
