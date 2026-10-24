---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: Proposed UML class diagrams of Vendor Connectivity's aggregates, value objects, events, policies and read models, and its hexagonal ports-and-adapters layout.
---

# Class Diagram

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

UML class diagrams of the **proposed** Go packages `internal/domain/vendor`,
`internal/domain/po` and `internal/domain/submission`. Type names come from
the model's `ul` codes, aggregates and value objects; method names are the
model's commands. Fields are shown `-` (unexported), methods `+`.

## 1. VendorAccount

```mermaid
classDiagram
    direction TB
    class VendorAccount {
        <<AggregateRoot>>
        -vendorId VendorId
        -name string
        -ackWindow AckWindow
        -state VendorState
        -version int
        +Onboard(vendorId, name, ackWindow)$ VendorAccount
        +Suspend() error
        +Reinstate() error
        +AckWindow() AckWindow
    }
    class VendorId {
        <<ValueObject>>
        string
    }
    class AckWindow {
        <<ValueObject>>
        minutes int
        between 60 and 1440
    }
    class VendorState {
        <<Enumeration>>
        ACTIVE
        SUSPENDED
    }
    class VendorAccountRepo {
        <<Repository>>
        +Save(ctx, v) error
        +FindById(ctx, vendorId) VendorAccount
    }
    VendorAccount --> VendorId : identity
    VendorAccount --> AckWindow
    VendorAccount --> VendorState
    VendorAccountRepo ..> VendorAccount : persists
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[VendorAccount]`,
`.ul[Vendor]`.

Omitted: the errors (`ErrAckWindowOutOfRange` from `Onboard`,
`ErrNodeNotOwnedByVendor` checked by use cases against `VendorNodeView`);
read accessors; rate limits, which the model names on the account but
does not shape.

## 2. PurchaseOrder

```mermaid
classDiagram
    direction TB
    class PurchaseOrder {
        <<AggregateRoot>>
        -poNumber PoNumber
        -vendorId VendorId
        -nodeId NodeId
        -assignmentId string
        -releaseNo int
        -issuedAt time.Time
        -requiredShipBy time.Time
        -ackBy time.Time
        -lines PoLine[]
        -state PoState
        -ack AckDecision nullable
        -labels Label[]
        -trackingNumbers string[]
        -shippedAt time.Time nullable
        -version int
        +Issue(release, ackWindow, handlingTime)$ PurchaseOrder
        +SubmitAcknowledgement(decision, lines, txId) error
        +ApplyAcknowledgementOutcome(status) error
        +RequestLabel() error
        +AddLabels(labels) error
        +SubmitShipmentConfirmation(trackings, at, txId) error
        +ApplyShipmentOutcome(status) error
        +Expire(now) error
        +Cancel(reason) error
    }
    class PoLine {
        <<ValueObject>>
        lineNo int
        listingId string
        quantity int
    }
    class AckDecision {
        <<ValueObject>>
        decision ACCEPT or REJECT
        reasonCode RejectReason
    }
    class Label {
        <<ValueObject>>
        labelRef string
        trackingNumber string
        carrier string
    }
    class RejectReason {
        <<Enumeration>>
        OUT_OF_STOCK
        UNKNOWN_LISTING
        CANNOT_MEET_SHIP_BY
        DISCONTINUED
    }
    class PoState {
        <<Enumeration>>
        ISSUED
        ACK_PROCESSING
        ACCEPTED
        REJECTED
        EXPIRED
        SHIPMENT_PROCESSING
        SHIPPED
        CANCELLED
    }
    class PurchaseOrderRepo {
        <<Repository>>
        +Save(ctx, po) error
        +FindByNumber(ctx, poNumber) PurchaseOrder
        +FindOpenByAssignment(ctx, assignmentId) PurchaseOrder
        +ListIssuedPastAckBy(ctx, now) PurchaseOrder[]
        +Poll(ctx, filter, nextToken) Page
    }
    PurchaseOrder "1" *-- "1..*" PoLine : lines
    PurchaseOrder "1" *-- "0..1" AckDecision : ack
    PurchaseOrder "1" *-- "0..*" Label : labels
    PurchaseOrder --> PoState
    AckDecision --> RejectReason
    PurchaseOrderRepo ..> PurchaseOrder : persists
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[PurchaseOrder]`
(`value_objects`, `states`, `commands`), `.publishes` (fields carried by
the events), `.policies`.

Omitted: the errors (`ErrPartialAcknowledgement`, `ErrAlreadyAcknowledged`,
`ErrAckWindowClosed`, `ErrLabelBeforeAcceptance`, `ErrConfirmWithoutLabel`,
`ErrCancelAfterAcknowledgement`); `VendorId` and `NodeId` value types.
`ApplyAcknowledgementOutcome` and `ApplyShipmentOutcome` are the
`ProcessSubmission` transitions of the model, split by kind; `RequestLabel`
is the state check and `AddLabels` stores what shipping-and-tracking
returned. `poNumber` is derived from `assignmentId + releaseNo`.

## 3. Submission

```mermaid
classDiagram
    direction TB
    class Submission {
        <<AggregateRoot>>
        -transactionId TransactionId
        -vendorId VendorId
        -kind SubmissionKind
        -status SubmissionStatus
        -payload json
        -poNumber PoNumber nullable
        -nodeId NodeId nullable
        -idempotencyKey string
        -receivedAt time.Time
        -notBefore time.Time
        -processedAt time.Time nullable
        -errors SubmissionError[]
        -version int
        +Receive(vendorId, kind, payload, now, delay)$ Submission
        +Process(now, status, errors) error
        +Due(now) bool
    }
    class TransactionId {
        <<ValueObject>>
        string
    }
    class SubmissionKind {
        <<Enumeration>>
        ACKNOWLEDGEMENT
        INVENTORY
        NODE_REGISTRATION
        NODE_PROFILE
        SHIPMENT_CONFIRMATION
    }
    class SubmissionStatus {
        <<Enumeration>>
        PROCESSING
        SUCCESS
        FAILURE
    }
    class SubmissionError {
        <<ValueObject>>
        code string
        message string
        path string
    }
    class SubmissionRepo {
        <<Repository>>
        +Save(ctx, s) error
        +FindById(ctx, transactionId) Submission
        +FindByIdempotencyKey(ctx, vendorId, key) Submission
        +ListDue(ctx, now, limit) Submission[]
    }
    Submission --> TransactionId : identity
    Submission --> SubmissionKind
    Submission --> SubmissionStatus
    Submission "1" *-- "0..*" SubmissionError : errors
    SubmissionRepo ..> Submission : persists
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[Submission]`.

Omitted: the errors (`ErrSubmissionAlreadyProcessed` from `Process`,
`ErrSubmissionNotDue` when `now` is before `notBefore`). `poNumber` and
`nodeId` are by-value links, not references.

## 4. Domain events

Purchase-order acknowledgement events:

```mermaid
classDiagram
    direction TB
    class PurchaseOrderIssued {
        <<DomainEvent>>
        poNumber
        vendorId
        nodeId
        assignmentId
        releaseNo
        requiredShipBy
        ackBy
        lines
    }
    class PurchaseOrderAccepted {
        <<DomainEvent>>
        poNumber
        assignmentId
        releaseNo
        nodeId
        acceptedAt
        transactionId
    }
    class PurchaseOrderRejected {
        <<DomainEvent>>
        poNumber
        assignmentId
        releaseNo
        nodeId
        reasonCode
        rejectedAt
    }
    class PurchaseOrderExpired {
        <<DomainEvent>>
        poNumber
        assignmentId
        releaseNo
        nodeId
        ackBy
    }
```

Derived from: `model.yaml → contexts[vendor-connectivity].publishes[*].data` (the four acknowledgement-outcome events).

Account, cancellation, shipment and submission events:

```mermaid
classDiagram
    direction TB
    class VendorOnboarded {
        <<DomainEvent>>
        vendorId
        name
        ackWindowMinutes
    }
    class PurchaseOrderCancelled {
        <<DomainEvent>>
        poNumber
        assignmentId
        reason
    }
    class VendorShipmentConfirmed {
        <<DomainEvent>>
        poNumber
        assignmentId
        nodeId
        trackingNumbers
        shippedAt
        requiredShipBy
    }
    class SubmissionProcessed {
        <<DomainEvent>>
        transactionId
        vendorId
        kind
        status
        errorCount
    }
```

Derived from: `model.yaml → contexts[vendor-connectivity].publishes[*].data`.

Omitted: types (on [Domain Events](/network/contexts/vendor-connectivity/domain-events))
and the CloudEvents envelope.

## 5. Policies and read models

```mermaid
classDiagram
    direction LR
    class IssueOnRelease {
        <<Policy>>
        on FulfillmentReleasedToNode
        VENDOR node only
        poNumber from assignmentId and releaseNo
    }
    class CancelOnSourcingCancel {
        <<Policy>>
        on FulfillmentCancelled
        cancel the ISSUED purchase order
    }
    class ExpireUnacknowledged {
        <<Policy>>
        sweep ISSUED past ackBy
    }
    class SimulationKnobs {
        <<Policy>>
        TX_PROCESSING_DELAY
        TX_FAILURE_RATE
        RATE_LIMIT_RPS
        PO_REDELIVERY_RATE
    }
    class VendorNodeView {
        <<ReadModel>>
        nodeId
        vendorId
        vendorNodeCode
        nodeType
        operator
        status
    }
    class ListingView {
        <<ReadModel>>
        listingId
        catalogItemId
        nodeId
    }
    IssueOnRelease ..> VendorNodeView : reads
    IssueOnRelease ..> PurchaseOrder : IssuePurchaseOrder
    CancelOnSourcingCancel ..> PurchaseOrder : CancelPurchaseOrder
    ExpireUnacknowledged ..> PurchaseOrder : ExpireUnacknowledgedOrders
    SimulationKnobs ..> Submission : notBefore and failures
    class PurchaseOrder {
        <<AggregateRoot>>
    }
    class Submission {
        <<AggregateRoot>>
    }
```

Derived from: `model.yaml → contexts[vendor-connectivity].policies`,
`.read_models`, and the `NodeRegistered` / `ListingCreated` fields in
`contexts[node-topology].publishes` and `contexts[offer-availability].publishes`.

Omitted: `RATE_LIMIT_RPS` acts in the HTTP adapter, not on an aggregate.
`<<ReadModel>>` is an extra stereotype for the two local views.

## 6. Hexagonal ports and adapters

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 36, "padding": 6}}}%%
flowchart TB
    IN["<b>internal/adapters/inbound</b><br/>http: Vendor API /vendor/..., POST /vendors,<br/>rate limiter, Idempotency-Key<br/>kafka: order-sourcing, node-topology,<br/>offer-availability consumers<br/>cmd tickers: expiry sweep, submission processor"]
    APP["<b>internal/application/usecases</b><br/>OnboardVendor, SuspendVendor, ReinstateVendor<br/>IssuePurchaseOrder, CancelPurchaseOrder,<br/>ExpireUnacknowledgedOrders<br/>SubmitAcknowledgement, RequestLabel,<br/>SubmitShipmentConfirmation<br/>ReceiveSubmission, ProcessSubmission"]
    DOM["<b>internal/domain</b><br/>vendor.VendorAccount<br/>po.PurchaseOrder<br/>submission.Submission"]
    PORTS["<b>internal/application/ports</b><br/>VendorAccountRepo, PurchaseOrderRepo,<br/>SubmissionRepo<br/>VendorNodeView, ListingView<br/>NodeRegistry, InventoryFeeds,<br/>LabelIssuer, Scorecards<br/>EventPublisher, UnitOfWork, Clock"]
    PG["<b>internal/adapters/outbound/postgres</b><br/>repositories, rm_ tables,<br/>outbox_events, processed_events"]
    KO["<b>internal/adapters/outbound/kafka</b><br/>outbox relay to<br/>retailnetwork.vendor-connectivity.events"]
    HC["<b>internal/adapters/outbound/http</b><br/>node-topology, offer-availability,<br/>shipping-and-tracking, node-performance"]
    IN --> APP
    APP --> DOM
    APP --> PORTS
    PORTS --- PG
    PORTS --- HC
    PG --> KO
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates`,
`.read_models`, `.sync_calls`, `.rest`, `conventions.integration_rules`
(outbox, inbox); the fleet's Go hexagonal layout.

Omitted: the read-only HTTP handlers (`GET /vendor/...`) that read the
repositories and read models directly; `GetScorecard`, which the HTTP
adapter relays through the `Scorecards` port; `cmd/` wiring. Port names
other than the repositories and read models are proposed.
