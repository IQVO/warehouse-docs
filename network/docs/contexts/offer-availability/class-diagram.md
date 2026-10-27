---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: "Proposed UML class diagrams of the Offer & Availability domain model and its hexagonal ports and adapters."
---

# Class Diagram

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

UML class diagrams of the **proposed** domain packages, then the hexagonal
ports and adapters in the Go layout the warehouse-systems fleet uses.
Aggregate, state, value object, policy, command and event names come from
`model.yaml`; Go method and field names are proposals. Fields are shown
`-` (unexported), methods `+` (exported); `$` marks a constructor.

## 1. CatalogItem aggregate

```mermaid
classDiagram
    direction TB
    class Item {
        <<AggregateRoot>>
        -catalogItemId CatalogItemId
        -title string
        -lengthMm int
        -widthMm int
        -heightMm int
        -weightG int
        -hazmat bool
        -fragile bool
        -state State
        -version int
        +NewItem(fields)$ Item
        +Discontinue() error
    }
    class State {
        <<Enumeration>>
        ACTIVE
        DISCONTINUED
    }
    class CatalogItemId {
        <<ValueObject>>
        string
    }
    class ItemRepository {
        <<Repository>>
        +Insert(ctx, item) error
        +Update(ctx, item, version) error
        +FindByID(ctx, id) Item
        +List(ctx) Item[]
    }
    Item --> State
    Item --> CatalogItemId : identity
    ItemRepository ..> Item : persists
```

Derived from: `model.yaml → contexts[offer-availability].aggregates[CatalogItem]`,
`.publishes[CatalogItemCreated].data`, `.ul[Catalog Item]` (`catalog.Item`).

Omitted: read accessors. `NewItem` returns `ErrInvalidItemDimensions`
when a dimension or the weight is not positive.

## 2. Listing aggregate

```mermaid
classDiagram
    direction TB
    class Listing {
        <<AggregateRoot>>
        -listingId ListingId
        -catalogItemId CatalogItemId
        -nodeId NodeId
        -state State
        -suppressionReason string
        -availability Availability
        -version int
        +NewListing(itemId, nodeId, active)$ Listing
        +ApplyAvailability(a) error
        +Suppress(reason) error
        +Restore(active) error
    }
    class Availability {
        <<ValueObject>>
        -availableQty int
        -basis Basis
        -asOf time.Time
        -feedId FeedId
    }
    class Basis {
        <<Enumeration>>
        PHYSICAL
        THROUGHPUT_CONSTRAINED
        UNKNOWN
    }
    class State {
        <<Enumeration>>
        LIVE
        SUPPRESSED
    }
    class ListingRepository {
        <<Repository>>
        +Insert(ctx, listing) error
        +Update(ctx, listing, version) error
        +FindByID(ctx, id) Listing
        +ListByNode(ctx, nodeId) Listing[]
        +List(ctx, filter) Listing[]
    }
    Listing *-- Availability
    Availability --> Basis
    Listing --> State
    ListingRepository ..> Listing : persists
```

Derived from: `model.yaml → contexts[offer-availability].aggregates[Listing]`
(`states`, `value_objects`, `invariants`, `commands`), `.ul[Listing]`,
`.ul[Available Quantity]`, `.ul[Availability Basis]`.

Omitted: the `ListingId`, `CatalogItemId`, `NodeId` and `FeedId` value
types (strings). Errors: `ApplyAvailability` returns
`ErrNegativeAvailability` and `ErrStaleAvailability`; `Restore` returns
`ErrNodeNotSellable`; the repository's `Insert` maps the unique-key
violation to `ErrDuplicateListing`. `NewListing` taking `nodeActive` is the
proposed answer to the missing initial state (H3 on
[EventStorming](/network/contexts/offer-availability/eventstorming)).

## 3. InventoryFeed aggregate

```mermaid
classDiagram
    direction TB
    class InventoryFeed {
        <<AggregateRoot>>
        -feedId FeedId
        -nodeId NodeId
        -fullUpdate bool
        -asOf time.Time
        -lines FeedLine[]
        -state State
        -appliedAt time.Time
        +Receive(header, lines)$ InventoryFeed
        +MarkApplied(at) error
        +MarkFailed(cause) error
        +LineCount() int
    }
    class FeedLine {
        <<ValueObject>>
        -listingId ListingId
        -availableQty int
        -basis Basis
    }
    class State {
        <<Enumeration>>
        RECEIVED
        APPLIED
        FAILED
    }
    class FeedRepository {
        <<Repository>>
        +Save(ctx, feed) error
        +FindByID(ctx, id) InventoryFeed
    }
    InventoryFeed *-- FeedLine : lines
    InventoryFeed --> State
    FeedRepository ..> InventoryFeed : persists
```

Derived from: `model.yaml → contexts[offer-availability].aggregates[InventoryFeed]`,
`.publishes[InventoryFeedApplied].data`, `.ul[Inventory Feed]`, `.ul[Full Feed]`.

Omitted: `FeedLine` and the feed-level `asOf` are proposals; the model
names lines in an invariant but gives no line shape. `MarkApplied` returns
`ErrFeedAlreadyApplied` on an `APPLIED` feed; the use case returns
`ErrListingNotOnNode` before `MarkFailed`.

## 3b. Policies and the read model

```mermaid
classDiagram
    direction LR
    class FullFeedZeroing {
        <<Policy>>
        +Omitted(feed, listings) Listing[]
    }
    class SuppressOnNodeUnavailable {
        <<Policy>>
        +OnNodeSuspended(nodeId) Command[]
        +OnNodeRetired(nodeId) Command[]
        +OnNodeActivated(nodeId) Command[]
    }
    class NodeStatusView {
        <<ReadModel>>
        -nodeId NodeId
        -nodeType string
        -operator string
        -vendorId string
        -status string
        +IsActive(nodeId) bool
    }
    FullFeedZeroing ..> InventoryFeed : reads
    SuppressOnNodeUnavailable ..> NodeStatusView : reads
    class InventoryFeed {
        <<AggregateRoot>>
    }
```

Derived from: `model.yaml → contexts[offer-availability].policies`,
`.read_models[NodeStatusView]`; `contexts[node-topology].publishes[NodeRegistered].data`.

Omitted: the commands each policy method returns are `SuppressListing`
and `RestoreListing`. `<<ReadModel>>` is not one of
the canvas stereotypes; it marks the local view.

## 4. Domain events

```mermaid
classDiagram
    direction LR
    class CatalogItemCreated {
        <<DomainEvent>>
        +CatalogItemID string
        +Title string
        +LengthMm int
        +WidthMm int
        +HeightMm int
        +WeightG int
        +Hazmat bool
        +Fragile bool
    }
    class CatalogItemDiscontinued {
        <<DomainEvent>>
        +CatalogItemID string
    }
    class ListingCreated {
        <<DomainEvent>>
        +ListingID string
        +CatalogItemID string
        +NodeID string
    }
    class ListingAvailabilityChanged {
        <<DomainEvent>>
        +ListingID string
        +CatalogItemID string
        +NodeID string
        +AvailableQty int
        +Basis string
        +AsOf time.Time
        +FeedID string
    }
    class ListingSuppressed {
        <<DomainEvent>>
        +ListingID string
        +NodeID string
        +Reason string
    }
    class ListingRestored {
        <<DomainEvent>>
        +ListingID string
        +NodeID string
    }
    class InventoryFeedApplied {
        <<DomainEvent>>
        +FeedID string
        +NodeID string
        +FullUpdate bool
        +LineCount int
        +AppliedAt time.Time
    }
```

Derived from: `model.yaml → contexts[offer-availability].publishes[*].data`.

Omitted: the shared `EventName()` / `OccurredAt()` interface and the
CloudEvents envelope, built by the outbound Kafka adapter.

## 5. Hexagonal ports and adapters

Driving side: inbound adapters, use cases, domain.

```mermaid
flowchart TB
    subgraph IN["internal/adapters/inbound"]
        direction LR
        HTTP["http<br/>REST routes"]
        KC["kafka<br/>node-topology consumer"]
    end
    subgraph APP["internal/application/usecases"]
        direction LR
        UC1["CreateCatalogItem<br/>DiscontinueItem"]
        UC3["CreateListing"]
        UC4["ApplyInventoryFeed<br/>ApplyAvailability"]
        UC5["SuppressListing<br/>RestoreListing"]
    end
    subgraph DOM["internal/domain"]
        direction LR
        D1["catalog.Item"]
        D2["listing.Listing"]
        D3["feed.InventoryFeed"]
        D4["policy"]
    end
    HTTP --> UC1
    HTTP --> UC3
    HTTP --> UC4
    KC --> UC5
    APP --> DOM
```

Derived from: `model.yaml → contexts[offer-availability].inbound`,
`.rest`, `.consumes`, `.aggregates`, `.policies`.

Driven side: ports and outbound adapters.

```mermaid
flowchart TB
    APP["internal/application/usecases"]
    subgraph PORTS["internal/application/ports"]
        direction LR
        P1["ItemRepository<br/>ListingRepository<br/>FeedRepository"]
        P4["NodeStatusView"]
        P5["EventOutbox<br/>Inbox"]
        P7["UnitOfWork<br/>Clock"]
    end
    subgraph OUT["internal/adapters/outbound"]
        direction LR
        A1["postgres<br/>repositories, view,<br/>outbox, inbox, UoW"]
        A2["kafka<br/>outbox relay +<br/>CloudEvents publisher"]
    end
    HTTPR["inbound http<br/>reads"]
    APP --> PORTS
    HTTPR -. reads .-> P1
    P1 --- A1
    P4 --- A1
    P5 --- A1
    P7 --- A1
    A1 --> A2
```


Derived from: `model.yaml → contexts[offer-availability].inbound`,
`.rest`, `.consumes`, `.aggregates`, `.policies`, `.read_models`;
`conventions.integration_rules` (own database, transactional outbox,
idempotent consumer).

Proposed packages: `internal/adapters/inbound/{http,kafka}`,
`internal/application/usecases`, `internal/application/ports`,
`internal/domain/{catalog,listing,feed,policy}` and
`internal/adapters/outbound/{postgres,kafka}`.

Omitted: `cmd/` composition roots and configuration. `Clock` has no
adapter package (a system clock in the composition root). The Kafka
consumer also writes `NodeStatusView` through its port inside the same
unit of work as the listing changes. Reads go from the HTTP adapter to the
repositories directly; they are not use cases.
