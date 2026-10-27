---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: Proposed UML class diagrams of Checkout's domain model, events and policies, and the hexagonal ports-and-adapters layout a Go implementation would use, with the Anti-Corruption Layer as one outbound adapter.
---

# Class Diagram

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `checkout` service is built on develop ([`IQVO/checkout`](https://github.com/IQVO/checkout) at `ab4f0e9`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/checkout#service-and-operations) section lists it.
:::

UML class diagrams of the **proposed** `internal/domain/**` packages, plus
the hexagonal ports and adapters. Type names come from the model's code
identifiers (`checkoutsession.CheckoutSession`, `ports.OrderPlacer`,
`checkoutsession.CheckoutSession.RecordPlacementInDoubt`, `checkoutsession.RequotedOffer`,
`checkoutsession.Group.AmountMinor`) and value objects. Fields are unexported in Go
and shown with `-`; methods are shown with `+`.

## 1. The CheckoutSession aggregate

```mermaid
classDiagram
    direction TB
    class CheckoutSession {
        <<AggregateRoot>>
        -sessionId string
        -cartId string
        -cartVersion int
        -shopperId string
        -shipToAddressId string
        -lines SessionLine[]
        -groups SessionGroup[]
        -priceQuoteId string
        -currency string
        -totalMinor int64
        -quoteExpiresAt time.Time
        -authorizationId string nullable
        -placementRequest bytes nullable
        -orderId string nullable
        -requotedOffers RequotedOffer[]
        -failureCode string nullable
        -status SessionStatus
        -version int
        +OpenSession(cart, quote, at)$ CheckoutSession
        +ConfirmSession(at) error
        +RecordAuthorization(authorizationId, totalMinor, request) error
        +RecordDecline(reason, at) error
        +RecordPlacementInDoubt(at) error
        +RecordPlaced(orderId, at) error
        +RecordRequoteRequired(offers, at) error
        +RecordFailure(code, at) error
        +ExpireSession(at) error
    }
    class SessionLine {
        <<ValueObject>>
        -lineNo int
        -catalogItemId string
        -quantity int
    }
    class SessionGroup {
        <<ValueObject>>
        -groupNo int
        -offerId string
        -tier Tier
        -lineNos int[]
        -amountMinor int64
    }
    class RequotedOffer {
        <<ValueObject>>
        -offerId string
        -groupNo int
        -tier Tier
        -deliverByEarliest time.Time
        -deliverByLatest time.Time
        -expiresAt time.Time
    }
    CheckoutSession *-- "1..*" SessionLine : lines
    CheckoutSession *-- "1..*" SessionGroup : groups
    CheckoutSession *-- "0..*" RequotedOffer : requotedOffers
```

Derived from: `model.yaml → contexts[checkout].aggregates[CheckoutSession]`
(`description`, `states`, `transitions`, `value_objects`, `commands`,
`invariants`); `storefront/apis/checkout/openapi.yaml` for the field names
the model's description lists in prose (`quoteExpiresAt`, `totalMinor`,
`amountMinor`).

`SessionStatus` is the string enumeration of the eight states `OPEN`,
`AUTHORIZING`, `DECLINED`, `PLACING`, `REQUOTE_REQUIRED`, `COMPLETED`,
`EXPIRED` and `FAILED`.

Omitted: the `Err...` variables (`ErrCartNotCheckoutReady`,
`ErrPriceQuoteExpired`, `ErrSessionClosed`, `ErrAuthorizationMismatch`,
`ErrPlacementInDoubt`; listed on the
[Aggregate Design Canvas](/storefront/contexts/checkout/aggregate-design-canvas)).
`placementRequest` is the stored, PII-free body the model describes but does
not name as a type (hotspot H9 on
[EventStorming](/storefront/contexts/checkout/eventstorming)); it is shown as
bytes because it is replayed byte for byte. `Tier` (`SAME_DAY`, `NEXT_DAY`, `TWO_DAY`, `STANDARD`) is the network
`delivery-promise` vocabulary, re-declared locally as a string enumeration: there is no shared kernel.
The method signatures are proposed; the model names the commands, not their
parameters.

## 2. Events and policies

```mermaid
classDiagram
    direction TB
    class CheckoutOpened {
        <<DomainEvent>>
        +sessionId string
        +cartId string
        +shopperId string
        +totalMinor int64
        +openedAt time.Time
    }
    class CheckoutDeclined {
        <<DomainEvent>>
        +sessionId string
        +reason string
        +at time.Time
    }
    class CheckoutFailed {
        <<DomainEvent>>
        +sessionId string
        +code string
        +at time.Time
    }
```

```mermaid
classDiagram
    direction TB
    class CheckoutCompleted {
        <<DomainEvent>>
        +sessionId string
        +orderId string
        +shopperId string
        +cartId string
        +authorizationId string
        +currency string
        +totalMinor int64
        +groups GroupAmount[]
        +completedAt time.Time
    }
    class GroupAmount {
        <<ValueObject>>
        +groupNo int
        +tier Tier
        +amountMinor int64
    }
    class CheckoutRequoteRequired {
        <<DomainEvent>>
        +sessionId string
        +requotedOffers RequotedOffer[]
        +at time.Time
    }
    CheckoutCompleted *-- "1..*" GroupAmount : groups
```

```mermaid
classDiagram
    direction TB
    class ResolveInDoubtPlacements {
        <<Policy>>
        re-send the stored body with the
        same Idempotency-Key with backoff
        until a definitive answer, alert at 20 h
    }
    class ExpireOnQuoteExpiry {
        <<Policy>>
        an OPEN or DECLINED session
        expires with its price quote
    }
    class CheckoutCompleted {
        <<DomainEvent>>
    }
    class CheckoutRequoteRequired {
        <<DomainEvent>>
    }
    class CheckoutFailed {
        <<DomainEvent>>
    }
    ResolveInDoubtPlacements ..> CheckoutCompleted : may lead to
    ResolveInDoubtPlacements ..> CheckoutRequoteRequired : may lead to
    ResolveInDoubtPlacements ..> CheckoutFailed : may lead to
```

Derived from: `model.yaml → contexts[checkout].publishes`, `.policies`.

Omitted: the CloudEvents envelope (built in the Kafka adapter).
`ExpireOnQuoteExpiry` leads to `ExpireSession`, which raises no event
(hotspot H7), so it has no arrow here. `GroupAmount` is the
`groups(groupNo, tier, amountMinor)` entry of `CheckoutCompleted`.

## 3. Hexagonal ports and adapters

```mermaid
flowchart TB
    subgraph IN["internal/adapters/inbound"]
        HTTP["http<br/>BFF writes and polling reads"]
        SCH["scheduler<br/>ExpireSession,<br/>ResolveInDoubtPlacements"]
    end
    APP["<b>internal/application/usecases</b><br/>OpenSession, ConfirmSession<br/>RecordAuthorization, RecordDecline<br/>RecordPlacementInDoubt, RecordPlaced<br/>RecordRequoteRequired, RecordFailure<br/>ExpireSession<br/>ResolveInDoubtPlacements"]
    DOM["<b>internal/domain</b><br/>checkoutsession.CheckoutSession<br/>checkoutsession.SessionLine, checkoutsession.SessionGroup<br/>checkoutsession.RequotedOffer"]
    PORTS["<b>internal/application/ports</b><br/>SessionRepository<br/>CartReader, OfferChecker, QuoteIssuer<br/>PaymentAuthorizer, OrderPlacer<br/>Outbox, IdempotencyStore<br/>UnitOfWork, Clock"]
    subgraph OUT["internal/adapters/outbound"]
        A1["postgres<br/>repository, outbox,<br/>idempotency store, UoW"]
        A2["kafka<br/>outbox relay"]
        A3["shoppingcart, deliverypromise,<br/>pricing, customerpayments<br/>REST clients"]
        A4["customerordering<br/>the Anti-Corruption Layer<br/>POST /checkout"]
    end
    HTTP --> APP
    SCH --> APP
    HTTP -. reads .-> PORTS
    APP --> DOM
    APP --> PORTS
    PORTS --- A1
    PORTS --- A3
    PORTS --- A4
    A1 -. outbox rows .-> A2

    classDef outblue fill:#e7f5ff,stroke:#1c7ed6,color:#000
    classDef acl fill:#ffe3e3,stroke:#c92a2a,color:#000
    class A3 outblue
    class A4 acl
```

Derived from: `model.yaml → contexts[checkout].aggregates`, `.inbound`,
`.sync_calls`, `.policies`; `conventions.integration_rules` (outbox,
Idempotency-Key); the fleet's Go hexagonal layout. `consumes` is empty, so
there is **no inbound Kafka consumer** and no inbox. `sync_calls` holds six
rows, so there are **five outbound REST clients**: four plain clients and
the `customerordering` adapter, which the model names as the Anti-Corruption
Layer (`internal/adapters/outbound/customerordering`) and the only place that
knows the network's wire names.

Omitted: the composition root (`cmd/checkout`), metrics and tracing. The
port names (`CartReader`, `OfferChecker`, `QuoteIssuer`, `PaymentAuthorizer`,
`OrderPlacer`) and the four plain adapter packages follow the fleet
convention and are not named in the model; only `customerordering` is. The
scheduler is an inbound adapter: time triggers `ExpireSession` and
`ResolveInDoubtPlacements`. The read route (`GetSession`) reads the repository
through its port without a use case.
