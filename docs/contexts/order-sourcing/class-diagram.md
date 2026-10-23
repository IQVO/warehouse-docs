---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: "Proposed UML class diagrams of Order Sourcing: the FulfillmentAssignment aggregate with its value objects and enumerations, the eight domain events, the policies and read models, and the hexagonal ports and adapters."
---

# Class Diagram

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Proposed Go types for `internal/domain`. Fields would be unexported in Go
and are shown with `-`; methods are shown with `+`. Class, field and method
names come from the model's aggregates, value objects, commands, events,
policies and read models; Go types (`time.Time`, `string`) are this page's
proposal.

## 1. FulfillmentAssignment aggregate

The root, its state and its repository first; then its value objects and
enumerations.

```mermaid
classDiagram
    direction TB
    class FulfillmentAssignment {
        <<AggregateRoot>>
        -assignmentId string
        -orderId string
        -groupNo int
        -state AssignmentState
        -assignmentVersion int
        -promise PromiseConstraint
        -lines Line[]
        -candidate Candidate
        -releaseAt time.Time
        -releases Release[]
        -excludedNodes ExcludedNode[]
        -lockedAt time.Time
        -lockReason string
        -trackingNumbers string[]
        -shippedAt time.Time
        -deliveredAt time.Time
        +QueueAssignment(...)$ FulfillmentAssignment
        +ReoptimiseAssignment(best) error
        +ReleaseToNode(best, now) error
        +HandleNodeRefusal(releaseNo, outcome, next) error
        +LockAssignment(releaseNo, at) error
        +MarkShipped(trackingNumbers, at) error
        +MarkDelivered(at) error
        +CancelAssignment(reason) error
        +ApplyRevisedPromise(promise, best) error
    }
    class AssignmentState {
        <<Enumeration>>
        QUEUED
        RELEASED
        LOCKED
        SHIPPED
        DELIVERED
        UNSOURCEABLE
        CANCELLED
    }
    class AssignmentRepository {
        <<Repository>>
        +Get(ctx, assignmentId)
        +FindByOrderGroup(ctx, orderId, groupNo)
        +FindByPromise(ctx, promiseId)
        +ListDueForRelease(ctx, now)
        +ListQueued(ctx)
        +Save(ctx, a, expectedVersion) error
    }
    FulfillmentAssignment --> AssignmentState : state
    AssignmentRepository ..> FulfillmentAssignment : persists
```

```mermaid
classDiagram
    direction LR
    class FulfillmentAssignment {
        <<AggregateRoot>>
    }
    class PromiseConstraint {
        <<ValueObject>>
        promiseId string
        tier Tier
        deliverByLatest time.Time
        witnessNodeId string
    }
    class Candidate {
        <<ValueObject>>
        nodeId string
        pickupDepartureId string
        legs string[]
        deliveryWaveId string
        eta time.Time
        cost float
    }
    class Release {
        <<ValueObject>>
        releaseNo int
        nodeId string
        releasedAt time.Time
        requiredShipBy time.Time
        outcome ReleaseOutcome
        reasonCode string
    }
    class ExcludedNode {
        <<ValueObject>>
        nodeId string
        reason string
    }
    class Line {
        <<ValueObject>>
        catalogItemId string
        listingId string
        quantity int
    }
    class ReleaseOutcome {
        <<Enumeration>>
        ACCEPTED
        REJECTED
        EXPIRED
        PENDING
    }
    class Tier {
        <<Enumeration>>
        SAME_DAY
        NEXT_DAY
        TWO_DAY
        STANDARD
    }
    FulfillmentAssignment *-- PromiseConstraint : promise
    FulfillmentAssignment *-- "1..*" Line : lines
    FulfillmentAssignment *-- "0..1" Candidate : candidate
    FulfillmentAssignment *-- "0..*" Release : releases
    FulfillmentAssignment *-- "0..*" ExcludedNode : excludedNodes
    PromiseConstraint --> Tier
    Release --> ReleaseOutcome
```

Derived from: model.yaml → `contexts[order-sourcing].aggregates[FulfillmentAssignment]`
(`root_id`, `states`, `commands`, `value_objects`), `.publishes[*].data` (the
lock, shipment and delivery fields, the `Line` shape of
`FulfillmentReleasedToNode`), `service_tiers` (`Tier`).

Omitted: the full `QueueAssignment` signature (`orderId, groupNo, promise,
lines, best`); the read accessors; the six `Err...` variables (listed on
[Aggregate Design Canvas](/contexts/order-sourcing/aggregate-design-canvas));
`destinationPostalPrefix`, which the candidate search needs but the model
does not place on the aggregate (open question). `Release` is a value object
in the model; its `outcome` changes from `PENDING` once, so an implementation
replaces the element identified by `releaseNo` rather than mutating it.
`Line` is the release's line shape; before release a line has no
`listingId`. The repository finders are this page's proposal, one per
trigger on [Use Cases](/contexts/order-sourcing/use-cases).

## 2. Domain events

```mermaid
classDiagram
    direction LR
    class DomainEvent {
        <<interface>>
        +EventName() string
        +AggregateID() string
        +OccurredAt() time.Time
    }
    class FulfillmentQueued {
        <<DomainEvent>>
        +AssignmentId
        +OrderId
        +GroupNo
        +PromiseId
        +DeliverByLatest
        +Lines
    }
    class FulfillmentReleasedToNode {
        <<DomainEvent>>
        +AssignmentId
        +ReleaseNo
        +OrderId
        +GroupNo
        +NodeId
        +PickupDepartureId
        +RequiredShipBy
        +PromisedDeliverByLatest
        +Tier
        +Lines
    }
    class FulfillmentReassigned {
        <<DomainEvent>>
        +AssignmentId
        +FromNodeId
        +ToNodeId
        +Reason
        +AssignmentVersion
    }
    class FulfillmentLocked {
        <<DomainEvent>>
        +AssignmentId
        +OrderId
        +GroupNo
        +NodeId
        +PickupDepartureId
        +LockedAt
        +LockReason
    }
    class FulfillmentShipped {
        <<DomainEvent>>
        +AssignmentId
        +OrderId
        +GroupNo
        +NodeId
        +TrackingNumbers
        +ShippedAt
    }
    class FulfillmentDelivered {
        <<DomainEvent>>
        +AssignmentId
        +OrderId
        +GroupNo
        +DeliveredAt
    }
    class FulfillmentUnsourceable {
        <<DomainEvent>>
        +AssignmentId
        +OrderId
        +GroupNo
        +PromiseId
        +ExcludedNodes
        +Reason
    }
    class FulfillmentCancelled {
        <<DomainEvent>>
        +AssignmentId
        +OrderId
        +GroupNo
        +Reason
    }
    DomainEvent <|.. FulfillmentQueued
    DomainEvent <|.. FulfillmentReleasedToNode
    DomainEvent <|.. FulfillmentReassigned
    DomainEvent <|.. FulfillmentLocked
    DomainEvent <|.. FulfillmentShipped
    DomainEvent <|.. FulfillmentDelivered
    DomainEvent <|.. FulfillmentUnsourceable
    DomainEvent <|.. FulfillmentCancelled
```

Derived from: model.yaml → `contexts[order-sourcing].publishes` (event names
and `data`).

Omitted: field types (on [Domain Events](/contexts/order-sourcing/domain-events));
JSON tags are the camelCase `data` names. `AggregateID()` returns the
`assignmentId`, which becomes the CloudEvents `subject` and the Kafka key.

## 3. Policies and read models

```mermaid
classDiagram
    direction LR
    class VirtualQueue {
        <<Policy>>
        +ReleaseAt(best, profile, tier)
    }
    class AssignmentCost {
        <<Policy>>
        +Cost(c, views) float
        +Best(cands, witness)
    }
    class ReassignOnRefusal {
        <<Policy>>
        +OnRejected(evt)
        +OnExpired(evt)
    }
    class LockOnCommit {
        <<Policy>>
        +OnAccepted(evt)
    }
    class NodeProfileView {
        <<ReadModel>>
        +Profile(nodeId)
    }
    class NetworkGraphView {
        <<ReadModel>>
        +Paths(nodeId, destination)
    }
    class AvailabilityView {
        <<ReadModel>>
        +Listing(catalogItemId, nodeId)
    }
    class ScorecardView {
        <<ReadModel>>
        +Grade(nodeId)
    }
    class PromiseBookPressureView {
        <<ReadModel>>
        +Exhausted(bookId) bool
    }
    VirtualQueue ..> NodeProfileView : handling
    AssignmentCost ..> NetworkGraphView : legs
    AssignmentCost ..> ScorecardView : penalty
    AssignmentCost ..> PromiseBookPressureView : penalty
    AssignmentCost ..> AvailabilityView : in full
```

Derived from: model.yaml → `contexts[order-sourcing].policies`,
`.read_models`.

Omitted: the penalty weights and the vendor ack budget, which the model does
not set. `ReassignOnRefusal` and `LockOnCommit` are event reactions that call
`HandleNodeRefusal` and `LockAssignment`; they live in the application layer
as the Kafka handlers. `<<ReadModel>>` is an extra stereotype for the
projections, which are not domain classes.

## 4. Hexagonal ports and adapters

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 30}}}%%
flowchart TB
    subgraph IN["internal/adapters/inbound"]
        HTTP["http<br/>GET /assignments<br/>GET /assignments/id<br/>POST /assignments/id:reoptimise"]
        KC["kafka<br/>one consumer per topic,<br/>dispatch on full type"]
        SCHED["cmd/order-sourcing<br/>release timer, sweeps"]
    end
    subgraph APP["internal/application/usecases"]
        UC["QueueAssignment, ReoptimiseAssignment, ReleaseToNode,<br/>HandleNodeRefusal, LockAssignment, CancelAssignment,<br/>MarkShipped, MarkDelivered, ApplyRevisedPromise,<br/>read-model projectors"]
    end
    subgraph DOM["internal/domain"]
        D["assignment: FulfillmentAssignment, value objects,<br/>errors, events<br/>sourcing: VirtualQueue, AssignmentCost,<br/>candidate search"]
    end
    subgraph PORTS["internal/application/ports"]
        P["AssignmentRepository, NetworkViews,<br/>EventPublisher, Inbox, UnitOfWork, Clock"]
    end
    subgraph OUT["internal/adapters/outbound"]
        PG["postgres<br/>assignment repo, rm_ tables,<br/>outbox_events, processed_events"]
        KO["kafka<br/>outbox relay to<br/>retailnetwork.order-sourcing.events"]
    end
    HTTP --> UC
    HTTP -. reads .-> P
    KC --> UC
    SCHED --> UC
    UC --> D
    UC --> P
    P --- PG
    P --- KO
```

Derived from: model.yaml → `contexts[order-sourcing].rest`, `.consumes`,
`.read_models`, `.policies`, `.sync_calls` (empty: no outbound client port);
`conventions.integration_rules` (outbox, inbox, own database, dispatch on the
full type).

Proposed packages: `internal/domain/assignment`,
`internal/domain/sourcing`, `internal/application/usecases`,
`internal/application/ports`, `internal/adapters/inbound/http`,
`internal/adapters/inbound/kafka`, `internal/adapters/outbound/postgres`,
`internal/adapters/outbound/kafka`. `NetworkViews` is the port over the five
read models.

Omitted: `Clock` has no adapter package (a system clock in `cmd/`). There is
no outbound HTTP client: the model allows no synchronous call from this
context. Path parameters are written `id` inside the diagram.
