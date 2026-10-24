---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: Proposed UML class diagrams of the Delivery Promise domain model, its policies and events, and the hexagonal ports and adapters.
---

# Class Diagram

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

UML class diagrams of the **proposed** Go packages under `internal/domain`.
Type names, value objects, states and commands are the model's; method
signatures, Go field types and package names are this pack's proposal. Fields
are unexported in Go and shown with `-`; exported methods with `+`; a `$` marks
a constructor. Read accessors are omitted.

## 1. Promise aggregate

### 1a. Root, state and repository

```mermaid
classDiagram
    direction TB
    class Promise {
        <<AggregateRoot>>
        -promiseId PromiseID
        -offerId OfferID
        -orderId OrderID
        -groupNo int
        -group ShipmentGroup
        -terms PromiseTerms
        -witness WitnessPath
        -state PromiseState
        -holdExpiresAt time.Time
        -revisions Revision[]
        -judgement Judgement
        -version int
        +Make(offer, group, terms, holdExpiresAt)$ Promise
        +Confirm(orderId, groupNo, now) error
        +FlagAtRisk(reason, at) error
        +Revise(terms, witness, reason, now) error
        +Judge(deliveredAt) error
        +Cancel(reason) error
        +ReleaseExpiredHold(now) error
        +BookID() BookID
    }
    class PromiseState {
        <<Enumeration>>
        PROVISIONAL
        CONFIRMED
        AT_RISK
        KEPT
        BROKEN
        RELEASED
        CANCELLED
    }
    class PromiseRepository {
        <<Repository>>
        +Save(ctx, p, version) error
        +Get(ctx, promiseId) Promise
        +ByOrder(ctx, orderId) Promise[]
        +ByOrderGroup(ctx, orderId, groupNo) Promise
        +UsingDeparture(ctx, departureId) Promise[]
        +ExpiredHolds(ctx, now, limit) Promise[]
    }
    Promise --> PromiseState
    PromiseRepository ..> Promise : persists
```

### 1b. Group and terms

```mermaid
classDiagram
    direction TB
    class Promise {
        <<AggregateRoot>>
    }
    class ShipmentGroup {
        <<ValueObject>>
        lines GroupLine[]
    }
    class GroupLine {
        <<ValueObject>>
        catalogItemId string
        quantity int
    }
    class PromiseTerms {
        <<ValueObject>>
        tier Tier
        shipBy time.Time
        deliverByEarliest time.Time
        deliverByLatest time.Time
        basis Basis
        policyVersion string
    }
    class Tier {
        <<Enumeration>>
        SAME_DAY
        NEXT_DAY
        TWO_DAY
        STANDARD
    }
    class Basis {
        <<Enumeration>>
        SCHEDULED
        NOMINAL
    }
    Promise *-- ShipmentGroup
    Promise *-- PromiseTerms
    ShipmentGroup *-- GroupLine
    PromiseTerms --> Tier
    PromiseTerms --> Basis
```

### 1c. Witness, revisions and judgement

```mermaid
classDiagram
    direction TB
    class Promise {
        <<AggregateRoot>>
    }
    class WitnessPath {
        <<ValueObject>>
        nodeId string
        pickupDepartureId string
        legs string[]
        deliveryWaveId string
    }
    class Revision {
        <<Entity>>
        revisionNo int
        previousTerms PromiseTerms
        reason string
        revisedAt time.Time
    }
    class Judgement {
        <<ValueObject>>
        outcome KEPT or BROKEN
        deliveredAt time.Time
        lateByMinutes int
        cause string
    }
    Promise *-- WitnessPath
    Promise "1" *-- "0..*" Revision
    Promise *-- "0..1" Judgement
```

Derived from: `model.yaml → contexts[delivery-promise].aggregates[Promise]`
(`states`, `value_objects`, `commands`), `.publishes[PromiseConfirmed, PromiseKept, PromiseBroken].data`
(`orderId`, `groupNo`, `deliveredAt`, `lateByMinutes`, `cause`), `.ul`
(`promise.Judgement`, `promise.WitnessPath`, `promise.ShipmentGroup`).

Omitted: the error variables (on
[the aggregate design canvas](/network/contexts/delivery-promise/aggregate-design-canvas)).
The aggregate is split over three diagrams to stay within the page width.
`orderId` and `groupNo` are empty until `Confirm`; `judgement` is empty until
`Judge`. `Revision` is drawn as an entity because `revisionNo` identifies it
inside its promise.

## 2. DeliveryOffer and PromiseBook aggregates

### 2a. DeliveryOffer

```mermaid
classDiagram
    direction TB
    class DeliveryOffer {
        <<AggregateRoot>>
        -offerId OfferID
        -destinationPostalPrefix string
        -lines GroupLine[]
        -tier Tier
        -window DeliveryWindow
        -witness WitnessPath
        -state OfferState
        -quotedAt time.Time
        -expiresAt time.Time
        +Quote(request, candidate, ttl, now)$ DeliveryOffer
        +Consume(now) error
        +Expire(now) error
    }
    class DeliveryWindow {
        <<ValueObject>>
        earliest time.Time
        latest time.Time
    }
    class OfferState {
        <<Enumeration>>
        QUOTED
        EXPIRED
        CONSUMED
    }
    class OfferConstraint {
        <<Enumeration>>
        DESTINATION_NOT_SERVED
        ITEM_QUANTITY_NOT_AVAILABLE
        DELIVERY_SLA_UNAVAILABLE
        NODE_CAPACITY_EXHAUSTED
    }
    class OfferRepository {
        <<Repository>>
        +SaveAll(ctx, offers) error
        +Get(ctx, offerId) DeliveryOffer
        +ExpireDue(ctx, now, limit) int
    }
    DeliveryOffer *-- DeliveryWindow
    DeliveryOffer --> OfferState
    DeliveryOffer ..> OfferConstraint : when no offer
    OfferRepository ..> DeliveryOffer : persists
```

### 2b. PromiseBook

```mermaid
classDiagram
    direction TB
    class PromiseBook {
        <<AggregateRoot>>
        -bookId BookID
        -nodeId string
        -pickupDepartureId string
        -cutoffAt time.Time
        -holdDeadline time.Time
        -capacity Capacity
        -state BookState
        -version int
        +Open(nodeId, departureId, cutoffAt, holdDeadline, share)$ PromiseBook
        +Hold(now) exhausted bool
        +Confirm() error
        +Release(kind) error
        +Close(now) error
        +Room() int
    }
    class Capacity {
        <<ValueObject>>
        share int
        provisional int
        confirmed int
    }
    class BookState {
        <<Enumeration>>
        OPEN
        CLOSED
    }
    class BookRepository {
        <<Repository>>
        +Save(ctx, b, version) error
        +Get(ctx, bookId) PromiseBook
        +ByNodeAndDate(ctx, nodeId, date) PromiseBook[]
        +DueToClose(ctx, now, limit) PromiseBook[]
    }
    PromiseBook *-- Capacity
    PromiseBook --> BookState
    BookRepository ..> PromiseBook : persists
```

Derived from: `model.yaml → contexts[delivery-promise].aggregates[DeliveryOffer]`,
`.aggregates[PromiseBook]` (`root_id`, `value_objects`, `states`, `commands`,
`invariants`).

Omitted: `GroupLine`, `Tier` and `WitnessPath`, shared with diagram 1.
`destinationPostalPrefix`, `quotedAt` and `expiresAt` on the offer come from its
description and invariant. `lines` on the offer is this pack's reading for a
multi-line group (open question 1 on
[the canvas page](/network/contexts/delivery-promise/bounded-context-canvas)).
`cutoffAt` and `holdDeadline` on the book are the model's `BookTimes`:
`ErrBookClosed` needs the instant "pickup cutoff minus handling time", which the
book must know. `Open` is the constructor behind the model's `OpenBook` command
(policy `LazyBookOpening`).
`Hold` reports whether the book became exhausted, so the use case can raise
`PromiseBookExhausted`.

## 3. Policies and the network snapshot

### 3a. The search policies

```mermaid
classDiagram
    direction LR
    class PromisePolicy {
        <<Policy>>
        +Search(snapshot, request, now) Candidate[]
        +Best(candidates, tier) Candidate
    }
    class ScorecardHandicap {
        <<Policy>>
        +Apply(readyAt, node, grade) time.Time
    }
    class TierOrderDeadline {
        <<Policy>>
        +Open(tier, regionId, now) bool
        +Version() string
    }
    class ShipmentGrouping {
        <<Policy>>
        +Group(lines, nodes) ShipmentGroup[]
    }
    PromisePolicy ..> ScorecardHandicap
    PromisePolicy ..> TierOrderDeadline
    PromisePolicy ..> ShipmentGrouping
```

### 3b. Re-promise, judgement and the snapshot port

```mermaid
classDiagram
    direction TB
    class RepromiseOnRisk {
        <<Policy>>
        +Recompute(snapshot, promise, excluded, now) Candidate
    }
    class JudgeOnDelivery {
        <<Policy>>
        +Outcome(promise, deliveredAt) Judgement
    }
    class PromisePolicy {
        <<Policy>>
    }
    class NetworkSnapshot {
        <<Repository>>
        +ServiceArea(prefix) ServiceArea
        +CandidateNodes(lines) NodeProfile[]
        +PickupDepartures(nodeId, from) Departure[]
        +DeparturesFrom(nodeId, from) Departure[]
        +Waves(stationId, from) Wave[]
        +Grade(nodeId) Grade
        +NominalTransit(origin, destination) int
    }
    class Candidate {
        <<ValueObject>>
        witness WitnessPath
        window DeliveryWindow
        shipBy time.Time
        basis Basis
        inRegion bool
        legs int
    }
    RepromiseOnRisk ..> PromisePolicy
    PromisePolicy ..> Candidate : produces
    PromisePolicy ..> NetworkSnapshot : reads
```

Derived from: `model.yaml → contexts[delivery-promise].policies`, `.read_models`,
`.ul` (`promise.ScorecardHandicap`). All six policies live in package
`internal/domain/promise`.

Omitted: the read-model row types (`NodeProfile`, `ServiceArea`, `Departure`,
`Wave`, `Grade`), which mirror the consumed events' fields. `NetworkSnapshot` is
a read-only port over the seven read models (stereotyped `Repository` because
it is a query port); it has no write method. `Candidate` is a proposed internal
value object of the search.

## 4. Domain events

```mermaid
classDiagram
    direction LR
    class PromiseMade {
        <<DomainEvent>>
        promiseId, offerId, tier, nodeId
        pickupDepartureId, shipBy
        deliverByEarliest, deliverByLatest
        basis, policyVersion, holdExpiresAt, lines
    }
    class PromiseConfirmed {
        <<DomainEvent>>
        promiseId, orderId, groupNo
    }
    class PromiseAtRisk {
        <<DomainEvent>>
        promiseId, orderId, reason, detectedAt
    }
    class PromiseRevised {
        <<DomainEvent>>
        promiseId, orderId, revisionNo
        previousDeliverByLatest
        deliverByEarliest, deliverByLatest
        shipBy, nodeId, reason
    }
    class PromiseKept {
        <<DomainEvent>>
        promiseId, orderId, nodeId
        deliveredAt, deliverByLatest
    }
    class PromiseBroken {
        <<DomainEvent>>
        promiseId, orderId, nodeId
        deliveredAt, deliverByLatest
        lateByMinutes, cause
    }
    class PromiseReleased {
        <<DomainEvent>>
        promiseId, reason
    }
    class PromiseCancelled {
        <<DomainEvent>>
        promiseId, orderId, reason
    }
    class PromiseBookExhausted {
        <<DomainEvent>>
        bookId, nodeId, pickupDepartureId, share
    }
    class Promise {
        <<AggregateRoot>>
    }
    class PromiseBook {
        <<AggregateRoot>>
    }
    Promise ..> PromiseMade
    Promise ..> PromiseConfirmed
    Promise ..> PromiseAtRisk
    Promise ..> PromiseRevised
    Promise ..> PromiseKept
    Promise ..> PromiseBroken
    Promise ..> PromiseReleased
    Promise ..> PromiseCancelled
    PromiseBook ..> PromiseBookExhausted
```

Derived from: `model.yaml → contexts[delivery-promise].publishes[*].data`.

Omitted: Go field types (on [the domain events page](/network/contexts/delivery-promise/domain-events)).
`DeliveryOffer` raises no integration event.

## 5. Hexagonal ports and adapters

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 36}}}%%
flowchart TB
    subgraph IN["internal/adapters/inbound"]
        HTTP["http<br/>POST /delivery-offers:quote<br/>GET /delivery-offers/offerId<br/>POST /promises, GET /promises<br/>GET /promise-books"]
        KC["kafka<br/>promise-lifecycle consumer<br/>7 read-model projectors"]
        SCH["scheduler<br/>ExpireOffers, ReleaseExpiredHolds,<br/>CloseBook"]
    end
    subgraph APP["internal/application"]
        UC["usecases<br/>QuoteDeliveryOffers, MakePromise,<br/>ConfirmPromise, CancelPromise,<br/>FlagPromiseAtRisk, RevisePromise,<br/>JudgePromise, ReleaseExpiredHolds,<br/>ExpireOffers, CloseBook"]
        PORTS["ports<br/>OfferRepository, PromiseRepository,<br/>BookRepository, NetworkSnapshot,<br/>ReadModelWriter, Inbox, Outbox,<br/>UnitOfWork, Clock"]
    end
    subgraph DOM["internal/domain"]
        D1["offer"]
        D2["promise<br/>aggregate and policies"]
        D3["book"]
    end
    subgraph OUT["internal/adapters/outbound"]
        PG["postgres<br/>repositories, rm_ tables,<br/>processed_events, outbox_events"]
        KP["kafka<br/>outbox relay to<br/>retailnetwork.delivery-promise.events<br/>and .analytics"]
    end
    HTTP --> UC
    KC --> UC
    KC --> PORTS
    SCH --> UC
    UC --> DOM
    UC --> PORTS
    PG -.->|implements| PORTS
    KP -.->|reads outbox_events| PG
```

Derived from: `model.yaml → contexts[delivery-promise].rest`, `.consumes`,
`.read_models`, `.aggregates[*].commands`; `conventions.integration_rules`
(outbox, inbox); the fleet's Go hexagonal layout.

Omitted: `cmd/` wiring and configuration. Proposed packages:
`internal/domain/offer`, `internal/domain/promise` (the aggregate, and the six
policies and `Candidate`, matching the model's code identifiers such as
`promise.ScorecardHandicap`), `internal/domain/book`;
`internal/application/usecases`, `internal/application/ports`;
`internal/adapters/inbound/http`, `internal/adapters/inbound/kafka`,
`internal/adapters/inbound/scheduler`; `internal/adapters/outbound/postgres`,
`internal/adapters/outbound/kafka`. There is **no** outbound HTTP client
package: the context makes no synchronous call. Dependencies point inward;
`internal/domain` imports nothing from `application` or `adapters`.
