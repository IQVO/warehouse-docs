---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: Proposed UML class diagrams of the Last-Mile Delivery domain model and its hexagonal ports and adapters.
---

# Class Diagram

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

UML class diagrams of the proposed `internal/domain/**`, plus the hexagonal
ports and adapters. Type names follow the model's `ul` code identifiers
(`wave.DeliveryWave`, `wave.InductPackage`, `route.Route`, `route.Attempt`,
`partner.DeliveryServicePartner`). Fields are unexported in Go and shown with
`-`; exported methods with `+`. Only commands and key queries are shown.

## 1. DeliveryWave aggregate (`internal/domain/wave`)

```mermaid
classDiagram
    direction TB
    class DeliveryWave {
        <<AggregateRoot>>
        -waveId string
        -stationNodeId string
        -serviceDate Date
        -inductCutoffAt time.Time
        -window Window
        -capacity StopCapacity
        -state State
        -version int
        +ScheduleWave(station, date, cutoff, window, stops)$
        +InductPackage(trackingNumber) error
        +CloseInduction() error
        +DispatchWave() error
        +CompleteWave() error
        +CancelWave(reason) error
        +RemainingStops() int
    }
    class Window {
        <<ValueObject>>
        +start time.Time
        +end time.Time
    }
    class StopCapacity {
        <<ValueObject>>
        +stops int
        +assigned int
    }
    class State {
        <<Enumeration>>
        OPEN
        INDUCTION_CLOSED
        DISPATCHED
        COMPLETED
        CANCELLED
    }
    DeliveryWave *-- Window
    DeliveryWave *-- StopCapacity
    DeliveryWave --> State
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[DeliveryWave]`
(`states`, `value_objects`, `commands`, `invariants`).

Omitted: the error variables `ErrInvalidWaveTimes`, `ErrWaveFull`,
`ErrInductionClosed` (see the
[Aggregate Design Canvas](/network/contexts/last-mile-delivery/aggregate-design-canvas))
and read accessors. `version` is the proposed optimistic-concurrency
counter, not a model field.

## 2. DeliveryWave repository and policies

```mermaid
classDiagram
    direction TB
    class DeliveryWaveRepository {
        <<Repository>>
        +Get(ctx, waveId) DeliveryWave
        +Save(ctx, w, events) error
        +ListOpenAfter(ctx, station, instant)
        +ListByStationAndDate(ctx, station, date)
    }
    class InductOnArrival {
        <<Policy>>
        +OnLoadArrived(evt) error
    }
    class RetryNextWave {
        <<Policy>>
        +OnDeliveryAttempted(evt) error
    }
    class DeliveryWave {
        <<AggregateRoot>>
    }
    DeliveryWaveRepository ..> DeliveryWave : persists
    InductOnArrival ..> DeliveryWave : InductPackage
    RetryNextWave ..> DeliveryWave : InductPackage
```

Derived from: model.yaml → `contexts[last-mile-delivery].policies`,
`.rest` (`GET /waves?stationNodeId=&serviceDate=`).

Omitted: the members of `DeliveryWave` (diagram 1). The two list methods
return `DeliveryWave[]`.

## 3. Route aggregate (`internal/domain/route`)

```mermaid
classDiagram
    direction TB
    class Route {
        <<AggregateRoot>>
        -routeId string
        -waveId string
        -dspId string
        -stationNodeId string
        -stops Stop[]
        -attempts Attempt[]
        -state State
        -version int
        +PlanRoute(waveId, partner, stops)$ Route
        +StartRoute() error
        +RecordAttempt(trackingNo, outcome, reason, at) error
        +CompleteRoute() error
        +StopCount() int
    }
    class Stop {
        <<Entity>>
        -stopNo int
        -trackingNumbers string[]
        -outcome Outcome
    }
    class Attempt {
        <<ValueObject>>
        +trackingNumber string
        +outcome Outcome
        +failureReason string
        +at time.Time
    }
    class RouteState {
        <<Enumeration>>
        PLANNED
        OUT_FOR_DELIVERY
        COMPLETED
    }
    class Outcome {
        <<Enumeration>>
        DELIVERED
        FAILED
    }
    Route "1" *-- "1..*" Stop : stops
    Route "1" *-- "0..*" Attempt : attempts
    Route --> RouteState
    Stop --> Outcome
    Attempt --> Outcome
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[Route]`
(`states`, `entities`, `commands`, `invariants`), `.ul` (`route.Attempt`),
`.publishes[DeliveryAttempted].data`.

Omitted: the error variables `ErrRouteOverCapacity`, `ErrRouteNotStarted`,
`ErrAlreadyDelivered`. The Go type for the route state is `route.State`; it
is drawn as `RouteState` so it does not clash with `wave.State` on this
page. `stationNodeId` is copied from the wave at plan time so that
`PackageOutForDelivery` can carry it.

## 4. DeliveryServicePartner aggregate and repositories (`internal/domain/partner`)

```mermaid
classDiagram
    direction TB
    class DeliveryServicePartner {
        <<AggregateRoot>>
        -dspId string
        -stationNodeId string
        -vanCapacity int
        -state PartnerState
        +ContractPartner(station, vanCapacity)$
        +VanCapacity() int
    }
    class PartnerState {
        <<Enumeration>>
        ACTIVE
        INACTIVE
    }
    class PartnerRepository {
        <<Repository>>
        +Get(ctx, dspId) DeliveryServicePartner
        +Save(ctx, p) error
    }
    class RouteRepository {
        <<Repository>>
        +Get(ctx, routeId) Route
        +Save(ctx, r, events) error
    }
    class Route {
        <<AggregateRoot>>
    }
    DeliveryServicePartner --> PartnerState
    PartnerRepository ..> DeliveryServicePartner : persists
    RouteRepository ..> Route : persists
    Route ..> DeliveryServicePartner : reads van capacity at plan
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[DeliveryServicePartner]`,
`.aggregates[Route].invariants` (`ErrRouteOverCapacity`).

Omitted: `ErrInvalidVanCapacity`. The partner fields `stationNodeId` and
`vanCapacity` come from the model's description ("contracted to a station,
with its vans") and invariant ("van capacity > 0"); the model gives no field
list. `Route` refers to a partner by `dspId` only; the dotted arrow is a
read at `PlanRoute`, not a held reference.

## 5. Domain events

```mermaid
classDiagram
    direction TB
    class DeliveryWaveScheduled {
        <<DomainEvent>>
        +waveId
        +stationNodeId
        +serviceDate
        +inductCutoffAt
        +windowStart
        +windowEnd
        +stopCapacity
    }
    class DeliveryWaveCapacityChanged {
        <<DomainEvent>>
        +waveId
        +stopCapacity
        +assignedStops
        +remainingStops
    }
    class DeliveryWaveCancelled {
        <<DomainEvent>>
        +waveId
        +reason
    }
```

Derived from: model.yaml → `contexts[last-mile-delivery].publishes[DeliveryWaveScheduled, DeliveryWaveCapacityChanged, DeliveryWaveCancelled].data`.

```mermaid
classDiagram
    direction TB
    class RoutePlanned {
        <<DomainEvent>>
        +routeId
        +waveId
        +dspId
        +stopCount
    }
    class PackageOutForDelivery {
        <<DomainEvent>>
        +routeId
        +trackingNumber
        +stationNodeId
        +at
    }
    class DeliveryAttempted {
        <<DomainEvent>>
        +routeId
        +trackingNumber
        +outcome
        +failureReason
        +at
    }
```

Derived from: model.yaml → `contexts[last-mile-delivery].publishes[*].data`.

Omitted: field types (on [Domain Events](/network/contexts/last-mile-delivery/domain-events))
and the CloudEvents envelope, which the outbound Kafka adapter adds.

## 6. Hexagonal ports and adapters

Driving side: inbound adapters, use cases and the domain packages they
change.

```mermaid
flowchart LR
    subgraph IN["inbound adapters"]
        HTTP["http<br/>REST routes"]
        KC["kafka<br/>LoadArrived,<br/>NodeRegistered,<br/>ServiceAreaAssigned"]
    end
    subgraph APP["usecases"]
        UW["ScheduleWave<br/>InductPackage<br/>CloseInduction<br/>DispatchWave<br/>CompleteWave<br/>CancelWave"]
        UR["PlanRoute<br/>StartRoute<br/>RecordAttempt<br/>CompleteRoute"]
        UP["ContractPartner"]
    end
    subgraph DOM["domain"]
        DW["wave"]
        DR["route"]
        DPN["partner"]
    end
    HTTP --> UW
    HTTP --> UR
    HTTP --> UP
    KC --> UW
    UW --> DW
    UR --> DR
    UR -.-> DPN
    UP --> DPN
```

Derived from: model.yaml → `contexts[last-mile-delivery].rest`, `.consumes`, `.aggregates[*].commands`.

Driven side: the ports the use cases call and the adapters behind them.

```mermaid
flowchart LR
    APP["usecases"]
    subgraph PORTS["ports"]
        P1["DeliveryWaveRepository<br/>RouteRepository<br/>PartnerRepository"]
        P2["StationView<br/>InboundPackagesView"]
        P3["Outbox, Inbox,<br/>IdempotencyStore"]
        P4["UnitOfWork, Clock"]
    end
    subgraph OUT["outbound adapters"]
        PG["postgres"]
        KP["kafka<br/>outbox relay"]
    end
    APP --> P1
    APP --> P2
    APP --> P3
    APP --> P4
    P1 --- PG
    P2 --- PG
    P3 --- PG
    P4 --- PG
    P3 --- KP
```

Derived from: model.yaml → `contexts[last-mile-delivery].rest`, `.consumes`,
`.aggregates[*].commands`, `.read_models`, `conventions.integration_rules`.

Subgraph names are shortened: `internal/adapters/inbound/{http,kafka}`,
`internal/application/usecases`, `internal/domain/{wave,route,partner}`,
`internal/application/ports`, `internal/adapters/outbound/{postgres,kafka}`.
The dotted edge from the route use cases to `partner` is the read of a
partner's van capacity at `PlanRoute`. Omitted: `Clock` needs no adapter package; the composition root
(`cmd/last-mile-delivery`) that wires the adapters; and the internal handler
that runs `RetryNextWave` after a `FAILED` attempt commits (it calls
`InductPackage`). The Kafka consumer also writes the two read models through
the `StationView` and `InboundPackagesView` ports. The package names are
proposed.
