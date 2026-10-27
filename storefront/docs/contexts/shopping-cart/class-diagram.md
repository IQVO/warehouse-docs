---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: UML class diagrams of Shopping Cart's domain model, events and policies, and the hexagonal ports-and-adapters layout, as the model designs them, with the as-built Go packages.
---

# Class Diagram

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `shopping-cart` service is built on develop ([`IQVO/shopping-cart`](https://github.com/IQVO/shopping-cart) at `95bc5bc`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/shopping-cart#service-and-operations) section lists it.
:::

UML class diagrams of the `internal/domain/**` packages as the model designs them, plus
the hexagonal ports and adapters. Type names come from the model's code
identifiers (`cart.Cart`, `cart.DeliveryQuote`, `cart.QuotedOffer`,
`cart.Selection`, `estimate.Estimate`, `cart.CheckoutReadiness`) and
value objects. Fields are unexported in Go and shown with `-`; methods are
shown with `+`.

**As built** (`IQVO/shopping-cart` develop `95bc5bc`): the domain packages are `internal/domain/cart`, `internal/domain/estimate`. Exported types per package: `cart`: `ID`, `State`, `Line`, `Cart`, `CheckoutReadiness`, `CartLineAdded`, `CartDeliveryQuoted`, `CartAbandoned`, `CartCheckedOut`, `Tier`, `QuotedOffer`, `QuoteGroup`, `TierUnavailable`, `DeliveryQuote`, `Selection`, `Snapshot`; `estimate`: `TierCharge`, `Schedule`, `TaxBand`, `TaxTable`, `Group`, `Input`, `Estimate`. Application packages: `internal/application/idempotency`, `internal/application/outbox`, `internal/application/ports`, `internal/application/readmodel`, `internal/application/usecases`, `internal/application/views`; adapters: `internal/adapters/inbound/http`, `internal/adapters/inbound/kafka`, `internal/adapters/inbound/requestlog`, `internal/adapters/inbound/scheduler`, `internal/adapters/outbound/clock`, `internal/adapters/outbound/deliverypromise`, `internal/adapters/outbound/ids`, `internal/adapters/outbound/kafka`, `internal/adapters/outbound/memory`, `internal/adapters/outbound/outbox`, `internal/adapters/outbound/postgres`, `internal/adapters/outbound/repocontract`, `internal/adapters/outbound/telemetry`. Where a type name below differs (the UML keeps the design names), the [Ubiquitous Language](/storefront/contexts/shopping-cart/ubiquitous-language) page carries the built identifier.

## 1. The Cart aggregate and its held quote

```mermaid
classDiagram
    direction TB
    class Cart {
        <<AggregateRoot>>
        -cartId string
        -shopperId string nullable
        -destinationPostalPrefix string
        -lines CartLine[]
        -quote DeliveryQuote nullable
        -selections DeliverySelection[]
        -status CartStatus
        -version int
        -lastChangedAt time.Time
        +CreateCart(shopperId string, at time.Time)$ Cart
        +AddLine(catalogItemId, quantity, at) error
        +SetLineQuantity(catalogItemId, quantity, at) error
        +RemoveLine(catalogItemId, at) error
        +SetDestination(prefix, at) error
        +QuoteDelivery(quote DeliveryQuote, at) error
        +SelectDelivery(groupNo, offerId, at) error
        +MergeInto(target Cart, at) error
        +AbandonInactive(at) error
        +CloseOnCheckoutCompleted(sessionId, at) error
        +CheckoutReadiness(now) CheckoutReadiness
    }
    class CartStatus {
        <<Enumeration>>
        OPEN
        CHECKED_OUT
        ABANDONED
        MERGED
    }
    class CartLine {
        <<ValueObject>>
        -catalogItemId string
        -quantity int
    }
    class DeliveryQuote {
        <<ValueObject>>
        -quotedAt time.Time
        -destinationPostalPrefix string
        -groups QuoteGroup[]
    }
    class QuoteGroup {
        <<ValueObject>>
        -groupNo int
        -lines CartLine[]
        -offers QuotedOffer[]
        -unavailableTiers Tier[]
    }
    class QuotedOffer {
        <<ValueObject>>
        -offerId string
        -groupNo int
        -tier Tier
        -deliverByEarliest time.Time
        -deliverByLatest time.Time
        -expiresAt time.Time
    }
    class DeliverySelection {
        <<ValueObject>>
        -groupNo int
        -offerId string
    }
    class Tier {
        <<Enumeration>>
        SAME_DAY
        NEXT_DAY
        TWO_DAY
        STANDARD
    }
    Cart --> CartStatus : status
    Cart *-- "0..100" CartLine : lines
    Cart *-- "0..1" DeliveryQuote : quote
    Cart *-- "0..*" DeliverySelection : selections
    DeliveryQuote *-- "1..*" QuoteGroup : groups
    QuoteGroup *-- "1..*" QuotedOffer : offers
    QuoteGroup --> Tier : unavailableTiers
    QuotedOffer --> Tier : tier
```

Derived from: `model.yaml → contexts[shopping-cart].aggregates[Cart]`
(`description`, `states`, `transitions`, `value_objects`, `commands`,
`invariants`).

Omitted: the `Err...` variables (`ErrDuplicateLine`,
`ErrQuantityOutOfRange`, `ErrTooManyLines`, `ErrItemNotPurchasable`,
`ErrNoDestination`, `ErrStaleDeliverySelection`, `ErrCartClosed`,
`ErrMergeTarget`; listed on the
[Aggregate Design Canvas](/storefront/contexts/shopping-cart/aggregate-design-canvas))
and the quote clearing, which every mutating line or destination method
performs (business decision 3). `Tier` is the network
`delivery-promise` vocabulary, re-declared locally: there is no shared
kernel.

## 2. Read models, events and policies

```mermaid
classDiagram
    direction TB
    class PurchasabilityView {
        <<ReadModel>>
        -items map catalogItemId to purchasable
        +IsPurchasable(catalogItemId) bool
    }
    class EstimateView {
        <<ReadModel>>
        -effectivePrices map
        -scheduleVersion int
        -tierCharges map
        -taxTableVersion int
        -taxBands TaxBand[]
        +Estimate(cart, now) Estimate
    }
    class Estimate {
        <<ValueObject>>
        +linesMinor int64
        +deliveryMinor int64
        +taxMinor int64
        +totalMinor int64
        +currency string
        +nonBinding bool
    }
    class CheckoutReadiness {
        <<ValueObject>>
        +ready bool
        +unselectedGroups int[]
        +expiredOffers offerId[]
    }
    EstimateView ..> Estimate : derives
    class CartLineAdded {
        <<DomainEvent>>
        +cartId string
        +catalogItemId string
        +quantity int
        +at time.Time
    }
    class CartDeliveryQuoted {
        <<DomainEvent>>
        +cartId string
        +destinationPostalPrefix string
        +groupCount int
        +at time.Time
    }
    class CartAbandoned {
        <<DomainEvent>>
        +cartId string
        +lastChangedAt time.Time
    }
    class CartCheckedOut {
        <<DomainEvent>>
        +cartId string
        +checkoutSessionId string
        +at time.Time
    }
```

```mermaid
classDiagram
    direction TB
    class AbandonInactive {
        <<Policy>>
        an OPEN cart with no change
        for 30 days is ABANDONED
    }
    class CloseOnCheckoutCompleted {
        <<Policy>>
        on CheckoutCompleted
        the cart is CHECKED_OUT
    }
    class CartAbandoned {
        <<DomainEvent>>
    }
    class CartCheckedOut {
        <<DomainEvent>>
    }
    AbandonInactive ..> CartAbandoned : leads to
    CloseOnCheckoutCompleted ..> CartCheckedOut : leads to
```

Derived from: `model.yaml → contexts[shopping-cart].read_models`,
`.publishes`, `.policies`, `.ul` (`estimate.Estimate`, `cart.CheckoutReadiness`).

Omitted: the CloudEvents envelope (built in the Kafka adapter) and the
`CheckoutReadiness` derivation, which lives on `Cart` (every group
selected, no offer expired). `Estimate.nonBinding` is the label business
decision 4 requires; the binding total is the checkout session's
`PriceQuote`.

## 3. Hexagonal ports and adapters

```mermaid
flowchart TB
    subgraph IN["internal/adapters/inbound"]
        HTTP["http<br/>BFF writes and reads,<br/>checkout GetCart read"]
        KC["kafka<br/>consumers: offer-availability,<br/>pricing, checkout"]
        SCH["scheduler<br/>abandon sweep"]
    end
    APP["<b>internal/application/usecases</b><br/>CreateCart, AddLine, SetLineQuantity<br/>RemoveLine, SetDestination<br/>QuoteDelivery, SelectDelivery, MergeInto<br/>AbandonInactive, CloseOnCheckoutCompleted<br/>ProjectPurchasabilityView<br/>ProjectEstimateView"]
    DOM["<b>internal/domain</b><br/>cart.Cart<br/>cart.DeliveryQuote, cart.QuotedOffer<br/>cart.Selection<br/>estimate.Estimate, cart.CheckoutReadiness"]
    PORTS["<b>internal/application/ports</b><br/>CartRepository<br/>PurchasabilityStore, EstimateStore<br/>QuoteOffers (delivery-promise)<br/>Outbox, Inbox<br/>IdempotencyStore<br/>UnitOfWork, Clock"]
    subgraph OUT["internal/adapters/outbound"]
        A1["postgres<br/>repository, views, outbox, inbox,<br/>idempotency store, UoW"]
        A2["kafka<br/>outbox relay"]
        A3["deliverypromise<br/>REST POST /delivery-offers:quote<br/>(the one outbound client)"]
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

Derived from: `model.yaml → contexts[shopping-cart].aggregates`, `.inbound`,
`.sync_calls`, `.read_models`, `.policies`;
`conventions.integration_rules` (outbox, inbox, Idempotency-Key); the
fleet's Go hexagonal layout. `sync_calls` holds exactly one row, so the
**only outbound REST client** is the `deliverypromise` adapter behind the
`QuoteOffers` port.

Omitted: the composition root (`cmd/shopping-cart`), metrics and tracing.
The scheduler is an inbound adapter: time triggers `AbandonInactive`. The
read routes (`GetCart`, `ListCarts`) read the repository and views through
their ports without a use case.
