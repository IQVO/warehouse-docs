---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: "Proposed UML class diagrams of the Shipping & Tracking domain (ShippingLabel, PackageJourney, events, policies) and its hexagonal ports and adapters."
---

# Class Diagram

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Proposed UML class diagrams for `internal/domain/**`, plus the hexagonal
ports and adapters. Names of aggregates, entities, states, commands, events
and errors come from the model. Field types and helper value objects are
proposed. Fields are unexported in Go and shown with `-`; exported methods
with `+`. Only state-changing methods and key queries are shown.

## 1. ShippingLabel aggregate

```mermaid
classDiagram
    direction TB
    class ShippingLabel {
        <<AggregateRoot>>
        -labelRef LabelRef
        -trackingNumber TrackingNumber
        -poNumber string
        -packageNo int
        -assignmentId string
        -orderId string
        -tier ServiceTier
        -carrier Carrier
        -shipTo ShipToSnapshot
        -status LabelStatus
        -issuedAt time.Time
        -voidReason string
        +IssueLabel(cmd, shipTo, trackingNumber, now)$ ShippingLabel
        +VoidLabel(reason, now) error
    }
    class LabelRef {
        <<ValueObject>>
        string
    }
    class TrackingNumber {
        <<ValueObject>>
        string
    }
    class Carrier {
        <<ValueObject>>
        string
    }
    class ShipToSnapshot {
        <<ValueObject>>
        -ciphertext bytes
        -keyId string
    }
    class LabelStatus {
        <<Enumeration>>
        ISSUED
        VOIDED
    }
    class ServiceTier {
        <<Enumeration>>
        SAME_DAY
        NEXT_DAY
        TWO_DAY
        STANDARD
    }
    class LabelRepository {
        <<Repository>>
        +Save(ctx, label) error
        +FindByRef(ctx, labelRef) ShippingLabel
        +FindByPackage(ctx, poNumber, packageNo) ShippingLabel
    }
    ShippingLabel --> LabelRef : identity
    ShippingLabel --> TrackingNumber
    ShippingLabel --> Carrier
    ShippingLabel *-- ShipToSnapshot : encrypted
    ShippingLabel --> LabelStatus
    ShippingLabel --> ServiceTier
    LabelRepository ..> ShippingLabel : persists
```

Derived from: `model.yaml → contexts[shipping-and-tracking].aggregates[ShippingLabel]`,
`.publishes[LabelIssued, LabelVoided].data`, `.ul`; `ServiceTier` from
`service_tiers`.

Omitted: read accessors; the errors `ErrLabelAlreadyIssued` and
`ErrTrackingNumberTaken` (listed on the
[Aggregate Design Canvas](/network/contexts/shipping-and-tracking/aggregate-design-canvas)).
`ShipToSnapshot` exposes no plaintext accessor in the domain; decryption
happens only in the (unmodelled) print path. `orderId` is an assumed field
(see the canvas open questions).

## 2. PackageJourney aggregate

```mermaid
classDiagram
    direction TB
    class PackageJourney {
        <<AggregateRoot>>
        -trackingNumber TrackingNumber
        -labelRef LabelRef
        -poNumber string
        -assignmentId string
        -orderId string
        -state JourneyState
        -scans Scan[]
        -lastAppliedAt time.Time
        -lastExceptionAt time.Time nullable
        -version int
        +StartJourney(label)$ PackageJourney
        +RecordScan(scan) error
        +RaiseException(reason, now) error
        +ReturnToSender(now) error
        +DeclareLost(now) error
        +IsClosed() bool
    }
    class Scan {
        <<Entity>>
        -scanId string
        -nodeId string
        -scanType ScanType
        -at time.Time
        -applied bool
    }
    class ScanType {
        <<ValueObject>>
        string, source fact name
    }
    class JourneyState {
        <<Enumeration>>
        LABELLED
        HANDED_OVER
        IN_TRANSIT
        AT_STATION
        OUT_FOR_DELIVERY
        DELIVERED
        RETURNED
        LOST
    }
    class TrackingNumber {
        <<ValueObject>>
        string
    }
    class JourneyRepository {
        <<Repository>>
        +Save(ctx, journey, expectedVersion) error
        +FindByTrackingNumber(ctx, trackingNumber) PackageJourney
        +ListSilent(ctx, now) PackageJourney[]
    }
    class HandoverOnFirstScan {
        <<Policy>>
        +IsHandover(journey, scan) bool
    }
    class ExceptionOnSilence {
        <<Policy>>
        +IsSilent(journey, now) bool
    }
    PackageJourney "1" *-- "0..*" Scan : scans
    PackageJourney --> JourneyState
    PackageJourney --> TrackingNumber : identity
    Scan --> ScanType
    JourneyRepository ..> PackageJourney : persists
    HandoverOnFirstScan ..> PackageJourney
    ExceptionOnSilence ..> PackageJourney
```

Derived from: `model.yaml → contexts[shipping-and-tracking].aggregates[PackageJourney]`
(states, entities `Scan`, commands), `.policies`, `.publishes[*].data`.

Omitted: the errors `ErrScanOutOfOrder`, `ErrDuplicateScan`,
`ErrJourneyClosed`; read accessors. `ExceptionOnSilence.IsSilent` needs an
expected leg time the model does not provide. `ScanType` values are not
enumerated in the model.

## 3. Domain events

Split in three diagrams to stay readable: the label events, the journey
milestones, and the journey's other events. Every class implements the same
`DomainEvent` interface (`EventName`, `Subject`, `OccurredAt`).

```mermaid
classDiagram
    direction TB
    class DomainEvent {
        <<interface>>
        +EventName() string
        +Subject() string
        +OccurredAt() time.Time
    }
    class LabelIssued {
        <<DomainEvent>>
        +LabelRef
        +TrackingNumber
        +PoNumber
        +AssignmentId
        +PackageNo
        +Tier
        +Carrier
    }
    class LabelVoided {
        <<DomainEvent>>
        +LabelRef
        +TrackingNumber
        +Reason
    }
    DomainEvent <|.. LabelIssued
    DomainEvent <|.. LabelVoided
```

Derived from: `model.yaml → contexts[shipping-and-tracking].publishes[LabelIssued, LabelVoided]`.

```mermaid
classDiagram
    direction TB
    class DomainEvent {
        <<interface>>
    }
    class PackageScanned {
        <<DomainEvent>>
        +TrackingNumber
        +ScanId
        +NodeId
        +ScanType
        +At
        +State
    }
    class PackageHandedOver {
        <<DomainEvent>>
        +TrackingNumber
        +PoNumber
        +NodeId
        +HandedOverAt
    }
    class PackageDelivered {
        <<DomainEvent>>
        +TrackingNumber
        +AssignmentId
        +OrderId
        +DeliveredAt
    }
    DomainEvent <|.. PackageScanned
    DomainEvent <|.. PackageHandedOver
    DomainEvent <|.. PackageDelivered
```

Derived from: `model.yaml → contexts[shipping-and-tracking].publishes[PackageScanned, PackageHandedOver, PackageDelivered]`.

```mermaid
classDiagram
    direction TB
    class DomainEvent {
        <<interface>>
    }
    class PackageExceptionRaised {
        <<DomainEvent>>
        +TrackingNumber
        +AssignmentId
        +OrderId
        +Reason
        +At
    }
    class PackageReturned {
        <<DomainEvent>>
        +TrackingNumber
        +OrderId
        +ReturnedAt
    }
    class PackageLost {
        <<DomainEvent>>
        +TrackingNumber
        +OrderId
        +DeclaredAt
    }
    DomainEvent <|.. PackageExceptionRaised
    DomainEvent <|.. PackageReturned
    DomainEvent <|.. PackageLost
```

Derived from: `model.yaml → contexts[shipping-and-tracking].publishes`.

Omitted: field types (on [Domain Events](/network/contexts/shipping-and-tracking/domain-events))
and JSON tags (camelCase on the wire). No event has an address field.

## 4. Hexagonal ports and adapters

Proposed Go layout, the one the fleet uses:

| Layer | Proposed packages |
| --- | --- |
| Domain | `internal/domain/label`, `internal/domain/journey` |
| Use cases | `internal/application/usecases` (`IssueLabel`, `VoidLabel`, `RecordScan`, `RaiseException`, `ReturnToSender`, `DeclareLost`; `StartJourney` runs inside `IssueLabel`) |
| Ports | `internal/application/ports` |
| Inbound adapters | `internal/adapters/inbound/http` (labels, journeys), `internal/adapters/inbound/kafka` (five scan consumers, catalog consumer) |
| Outbound adapters | `internal/adapters/outbound/postgres` (repositories, outbox, inbox, read model), `internal/adapters/outbound/kafka` (outbox relay publisher), `internal/adapters/outbound/customerordering` (the `GetShipTo` client) |

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 36}}}%%
flowchart TB
    subgraph IN["internal/adapters/inbound"]
        HTTP["http<br/>labels, journeys"]
        KC["kafka<br/>scan and catalog<br/>consumers"]
        SCH["scheduler<br/>silence sweep"]
    end
    subgraph UC["internal/application/usecases"]
        U1["IssueLabel + StartJourney<br/>VoidLabel"]
        U2["RecordScan<br/>RaiseException<br/>ReturnToSender, DeclareLost"]
    end
    subgraph DOM["internal/domain"]
        D1["label.ShippingLabel<br/>journey.PackageJourney"]
    end
    subgraph PORTS["internal/application/ports"]
        P1["LabelRepository<br/>JourneyRepository<br/>CatalogDimensionsView<br/>Outbox, Inbox, UnitOfWork"]
        P2["ShipToReader"]
        P3["ShipToCipher<br/>TrackingNumberGenerator<br/>Clock"]
    end
    subgraph OUT["internal/adapters/outbound"]
        A1["postgres<br/>repos, outbox,<br/>inbox, rm"]
        A2["customerordering<br/>GET ship-to client"]
        A3["kafka<br/>outbox relay"]
    end
    HTTP --> U1
    HTTP --> U2
    KC --> U2
    SCH --> U2
    U1 --> D1
    U2 --> D1
    U1 --> P1
    U1 --> P2
    U1 --> P3
    U2 --> P1
    P1 --- A1
    P2 --- A2
    A1 --> A3
```

Derived from: `model.yaml → contexts[shipping-and-tracking].aggregates`,
`.rest`, `.consumes`, `.sync_calls`, `.read_models`, `.policies`;
`conventions.integration_rules` (outbox, inbox).

Omitted: `ShipToCipher` (an envelope-encryption adapter; key management is
not modelled), `TrackingNumberGenerator` and `Clock` adapters, which are
small and have no package of their own. `ReturnToSender` and `DeclareLost`
have no inbound adapter because the model names no trigger. The
`customerordering` client package is added to the fleet's two outbound
packages because this context makes one synchronous call.
