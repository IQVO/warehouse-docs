---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: Proposed UML class diagrams of Customer Ordering's domain model, events and policies, and the hexagonal ports-and-adapters layout a Go implementation would use.
---

# Class Diagram

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

UML class diagrams of the **proposed** `internal/domain/**` packages, plus
the hexagonal ports and adapters. Type names come from the model's code
identifiers (`order.CustomerOrder`, `order.ShipTo`, `shopper.Shopper`) and
value objects. Fields are unexported in Go and shown with `-`; methods are
shown with `+`. A member marked `*` is not in the model's value object; it
carries an event field the aggregate must keep (see the
[Aggregate Design Canvas](/network/contexts/customer-ordering/aggregate-design-canvas)).

## 1. CustomerOrder aggregate

```mermaid
classDiagram
    direction TB
    class CustomerOrder {
        <<AggregateRoot>>
        -orderId string
        -shopperId string
        -status OrderStatus
        -shipTo ShipTo
        -lines OrderLine[]
        -groups GroupPromise[]
        -placedAt time.Time
        -cancelledAt time.Time nullable
        -version int
        +PlaceOrder(shopperId, shipTo, lines, groups, at)$ CustomerOrder
        +MarkInFulfillment(groupNo, assignmentId, lockedAt) error
        +MarkGroupShipped(groupNo, trackingNumbers, shippedAt) error
        +MarkGroupDelivered(groupNo, deliveredAt) error
        +CancelOrder(groupNos, reason, cancelledAt) error
        +UpdateGroupPromise(groupNo, window, shipBy, revisionNo) error
        +DestinationPostalPrefix() string
    }
    class OrderStatus {
        <<Enumeration>>
        PLACED
        IN_FULFILLMENT
        PARTIALLY_SHIPPED
        SHIPPED
        DELIVERED
        CANCELLED
    }
    class ShipTo {
        <<ValueObject>>
        -name string
        -line1 string
        -line2 string
        -city string
        -region string
        -postalCode string
        -countryCode string
        -phone string
    }
    class OrderLine {
        <<ValueObject>>
        -lineNo int
        -catalogItemId string
        -quantity int
    }
    class GroupPromise {
        <<ValueObject>>
        -groupNo int
        -promiseId string
        -deliverByEarliest time.Time
        -deliverByLatest time.Time
        -lineNos int[]
        -tier Tier *
        -witnessNodeId string *
        -shipBy time.Time *
        -assignmentId string *
        -lockedAt time.Time *
        -trackingNumbers string[] *
        -shippedAt time.Time *
        -deliveredAt time.Time *
    }
    class Tier {
        <<Enumeration>>
        SAME_DAY
        NEXT_DAY
        TWO_DAY
        STANDARD
    }
    class CustomerOrderRepository {
        <<Repository>>
        +Get(ctx, orderId) CustomerOrder
        +Insert(ctx, o) error
        +Update(ctx, o, expectedVersion) error
    }
    CustomerOrder --> OrderStatus : status
    CustomerOrder *-- "1" ShipTo : shipTo, PII
    CustomerOrder *-- "1..*" OrderLine : lines
    CustomerOrder *-- "1..*" GroupPromise : groups
    GroupPromise --> Tier
    CustomerOrderRepository ..> CustomerOrder : persists
```

Derived from: `model.yaml → contexts[customer-ordering].aggregates[CustomerOrder]`
(`states`, `value_objects`, `commands`, `invariants`); `.publishes[*].data`
and `.consumes` for the `*` members; `contexts[delivery-promise].ul`
(`promise.Tier`).

Omitted: read accessors, the `Err...` variables (`ErrLineWithoutPromise`,
`ErrPromiseDestinationMismatch`, `ErrCancelAfterLock`,
`ErrStatusRegression`; listed on the Aggregate Design Canvas), the last
applied `revisionNo` per group, and the `cancelledAt` and reason of a single
cancelled group. `Tier` is `delivery-promise`'s vocabulary, re-declared
locally: there is no shared kernel.

## 2. Shopper aggregate

```mermaid
classDiagram
    direction TB
    class Shopper {
        <<AggregateRoot>>
        -shopperId string
        -email string
        -savedAddresses ShipTo[]
        -status ShopperStatus
        +RegisterShopper(email, savedAddresses)$ Shopper
    }
    class ShopperStatus {
        <<Enumeration>>
        ACTIVE
    }
    class ShipTo {
        <<ValueObject>>
        PII, synthetic
    }
    class ShopperRepository {
        <<Repository>>
        +Insert(ctx, s) error
        +Get(ctx, shopperId) Shopper
    }
    Shopper --> ShopperStatus
    Shopper *-- "0..*" ShipTo : savedAddresses
    ShopperRepository ..> Shopper : persists
```

Derived from: `model.yaml → contexts[customer-ordering].aggregates[Shopper]`.

Omitted: `ErrShopperExists`. The model names the email uniqueness rule and
"saved addresses", but no further fields.

## 3. Domain events and policies

```mermaid
classDiagram
    direction TB
    class CustomerOrderPlaced {
        <<DomainEvent>>
        +orderId string
        +shopperId string
        +destinationPostalPrefix string
        +placedAt time.Time
        +groups PlacedGroup[]
    }
    class PlacedGroup {
        <<ValueObject>>
        +groupNo int
        +promiseId string
        +tier Tier
        +witnessNodeId string
        +shipBy time.Time
        +deliverByEarliest time.Time
        +deliverByLatest time.Time
        +lines OrderLine[]
    }
    class CustomerOrderCancelled {
        <<DomainEvent>>
        +orderId string
        +reason string
        +cancelledAt time.Time
        +groupNos int[]
    }
    CustomerOrderPlaced *-- "1..*" PlacedGroup : groups
```

```mermaid
classDiagram
    direction TB
    class CheckoutPromising {
        <<Policy>>
        promise each group from the offer seen
        re-quote if the offer expired
    }
    class CancelOnUnfulfillable {
        <<Policy>>
        unsourceable and no revised promise
        then cancel the group
    }
    class PromiseGateway {
        <<interface>>
        +MakePromise(ctx, offerId, key) PromiseTerms
        +QuoteDeliveryOffers(ctx, lines, prefix) Offer[]
    }
    class CustomerOrderPlaced {
        <<DomainEvent>>
    }
    class CustomerOrderCancelled {
        <<DomainEvent>>
    }
    CheckoutPromising ..> PromiseGateway : uses
    CheckoutPromising ..> CustomerOrderPlaced : leads to
    CancelOnUnfulfillable ..> CustomerOrderCancelled : leads to
```

Derived from: `model.yaml → contexts[customer-ordering].publishes`,
`.policies`, `.sync_calls`. The second diagram repeats the two events as
bare boxes to show which policy leads to which.

Omitted: the CloudEvents envelope (built in the Kafka adapter). `PlacedGroup`,
`PromiseTerms` and `Offer` are proposed Go type names for the payload shapes
the model gives; they are not new messages. The events hold no `ShipTo`.

## 4. Hexagonal ports and adapters

```mermaid
flowchart TB
    subgraph IN["internal/adapters/inbound"]
        HTTP["http<br/>storefront routes,<br/>restricted ship-to route"]
        KC["kafka<br/>consumers: order-sourcing,<br/>delivery-promise,<br/>shipping-and-tracking"]
    end
    APP["<b>internal/application/usecases</b><br/>PlaceOrder<br/>CancelOrder<br/>RegisterShopper<br/>MarkInFulfillment<br/>MarkGroupShipped<br/>MarkGroupDelivered<br/>UpdateGroupPromise<br/>ProjectOrderTracking"]
    DOM["<b>internal/domain</b><br/>order.CustomerOrder<br/>shopper.Shopper"]
    PORTS["<b>internal/application/ports</b><br/>CustomerOrderRepository<br/>ShopperRepository<br/>PromiseGateway<br/>Outbox, Inbox<br/>OrderTrackingStore<br/>IdempotencyStore<br/>UnitOfWork, Clock"]
    subgraph OUT["internal/adapters/outbound"]
        A1["postgres<br/>repositories, outbox, inbox,<br/>tracking and idempotency<br/>stores, UoW"]
        A2["kafka<br/>outbox relay"]
        A3["deliverypromise<br/>REST client"]
    end
    HTTP --> APP
    KC --> APP
    HTTP -. reads .-> PORTS
    APP --> DOM
    APP --> PORTS
    PORTS --- A1
    PORTS --- A3
    A1 -. outbox rows .-> A2
```

Derived from: `model.yaml → contexts[customer-ordering].aggregates`,
`.inbound`, `.sync_calls`, `.read_models`; `conventions.integration_rules`
(outbox, inbox); the fleet's Go hexagonal layout.

Omitted: the composition root (`cmd/customer-ordering`), metrics and tracing.
`ProjectOrderTracking` is the projector that writes `OrderTrackingView`. It is
not a command of the model and changes no aggregate. The read routes
(`GetOrder`, `GetTracking`, `GetShipTo`) read the stores through their ports
without a use case. The `deliverypromise` package sits beside the `postgres`
and `kafka` adapters, because checkout's synchronous calls need an outbound
REST client.
