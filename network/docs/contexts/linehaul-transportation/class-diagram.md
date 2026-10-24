---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: Proposed UML class diagrams of the Linehaul Transportation domain (Departure, LaneSchedule, Load, events, policies) and its hexagonal ports and adapters.
---

# Class Diagram

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

UML class diagrams of the **proposed** `internal/domain/**` packages
(`departure`, `schedule`, `load`), then the hexagonal ports and adapters in
the Go layout the fleet uses. Type and field names come from `model.yaml`;
method names are the model's commands. Fields are shown `-` (unexported),
methods `+`.

## 1. Departure aggregate

```mermaid
classDiagram
    direction TB
    class Departure {
        <<AggregateRoot>>
        -departureId string
        -laneId string
        -kind DepartureKind
        -originNodeId string
        -destinationNodeId string
        -times Times
        -capacity Capacity
        -state DepartureState
        -version int
        +ScheduleDeparture(lane, kind, times, packages)$ Departure
        +BookCapacity(now) error
        +ReleaseCapacity() error
        +CloseDeparture() error
        +RecordDeparture(at) error
        +RecordArrival(at) error
        +CancelDeparture(reason, at) error
        +Remaining() int
    }
    class DepartureKind {
        <<Enumeration>>
        PICKUP
        LINEHAUL
        AIR
    }
    class DepartureState {
        <<Enumeration>>
        SCHEDULED
        CLOSED
        DEPARTED
        ARRIVED
        CANCELLED
    }
    class Times {
        <<ValueObject>>
        cutoffAt time
        departsAt time
        arrivesAt time
    }
    class Capacity {
        <<ValueObject>>
        packages int
        booked int
    }
    class DepartureRepository {
        <<Repository>>
        +Get(departureId) Departure
        +Save(departure, events) error
        +List(origin, destination, from, to) Departure[]
    }
    Departure --> DepartureKind
    Departure --> DepartureState
    Departure *-- Times
    Departure *-- Capacity
    DepartureRepository ..> Departure : persists
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Departure]`
(`value_objects`, `states`, `commands`), `.publishes[DepartureScheduled].data`.

Omitted: the error variables (`ErrInvalidDepartureTimes`, `ErrDepartureFull`,
`ErrLaneClosed`, `ErrDepartureClosed`; see
[Aggregate Design Canvas](/network/contexts/linehaul-transportation/aggregate-design-canvas)),
read accessors, and `version` handling (proposed optimistic concurrency, not
in the model). `ScheduleDeparture` is drawn as a constructor; the
`ErrLaneClosed` check needs the lane status from `LaneView`, passed in by the
use case.

## 2. LaneSchedule and Load aggregates

```mermaid
classDiagram
    direction TB
    class LaneSchedule {
        <<AggregateRoot>>
        -laneId string
        -slots Slot[]
        -state ScheduleState
        +DefineLaneSchedule(laneId, slots)$ LaneSchedule
        +RetireLaneSchedule() error
        +GenerateDepartures(horizonDays) DepartureSpec[]
    }
    class Slot {
        <<ValueObject>>
        proposed shape
        mirrors Times and Capacity
    }
    class ScheduleState {
        <<Enumeration>>
        ACTIVE
        RETIRED
    }
    class Load {
        <<AggregateRoot>>
        -loadId string
        -departureId string
        -originNodeId string
        -destinationNodeId string
        -capacityPackages int
        -trackingNumbers string[]
        -state LoadState
        -version int
        +OpenLoad(departure)$ Load
        +AddPackage(trackingNumber) error
        +CloseLoad() error
        +DispatchLoad(at) error
        +ReceiveLoad(at) error
    }
    class LoadState {
        <<Enumeration>>
        OPEN
        CLOSED
        DEPARTED
        ARRIVED
    }
    class LaneScheduleRepository {
        <<Repository>>
        +Get(laneId) LaneSchedule
        +Save(schedule) error
        +ListActive() LaneSchedule[]
    }
    class LoadRepository {
        <<Repository>>
        +Get(loadId) Load
        +Save(load, events) error
        +IsOnOpenLoad(trackingNumber) bool
    }
    LaneSchedule *-- Slot
    LaneSchedule --> ScheduleState
    Load --> LoadState
    LaneScheduleRepository ..> LaneSchedule : persists
    LoadRepository ..> Load : persists
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[LaneSchedule, Load]`,
`.publishes[LoadDeparted, LoadArrived].data`.

Omitted: `ErrOverlappingSlots`, `ErrPackageAlreadyLoaded`,
`ErrLoadOverCapacity`. The model lists no fields for `LaneSchedule` or its
slots; `Slot` is a proposed value object. `capacityPackages`,
`originNodeId` and `destinationNodeId` on `Load` are a snapshot copied from
the departure at `OpenLoad`, so that `ErrLoadOverCapacity` and the
`LoadDeparted` / `LoadArrived` payloads need no cross-aggregate read.
`IsOnOpenLoad` backs `ErrPackageAlreadyLoaded`, an invariant that spans
loads.

## 3. Events, policies and read models

```mermaid
classDiagram
    direction LR
    class DepartureScheduled {
        <<DomainEvent>>
        departureId, laneId, kind
        originNodeId, destinationNodeId
        cutoffAt, departsAt, arrivesAt
        capacityPackages
    }
    class DepartureCapacityChanged {
        <<DomainEvent>>
        departureId, capacityPackages
        bookedPackages, remainingPackages
    }
    class DepartureCancelled {
        <<DomainEvent>>
        departureId, reason, cancelledAt
    }
    class DepartureDeparted {
        <<DomainEvent>>
        departureId, departedAt
    }
    class DepartureArrived {
        <<DomainEvent>>
        departureId, arrivedAt
    }
    class LoadClosed {
        <<DomainEvent>>
        loadId, departureId, packageCount
    }
    class LoadDeparted {
        <<DomainEvent>>
        loadId, departureId, originNodeId
        trackingNumbers, departedAt
    }
    class LoadArrived {
        <<DomainEvent>>
        loadId, departureId, destinationNodeId
        trackingNumbers, arrivedAt
    }
    class PickupFromCutoffs {
        <<Policy>>
        +OnProfileDeclared()
        +OnNodeSuspendedOrRetired()
    }
    class BookOnLock {
        <<Policy>>
        +OnLocked()
        +OnCancelledOrReassigned()
    }
    class HorizonRoll {
        <<Policy>>
        +Nightly()
    }
    PickupFromCutoffs ..> DepartureScheduled : via ScheduleDeparture
    PickupFromCutoffs ..> DepartureCancelled : via CancelDeparture
    BookOnLock ..> DepartureCapacityChanged : via Book or Release
    HorizonRoll ..> DepartureScheduled : via GenerateDepartures
```

Derived from: `model.yaml → contexts[linehaul-transportation].publishes`,
`.policies`.

Omitted: the CloudEvents envelope (see
[Domain Events](/network/contexts/linehaul-transportation/domain-events)); the
three read models `NodeProfileView`, `LaneView` and `ExpectedVolumeView`
(projections, shown in the ports view below). `DepartureDeparted`,
`DepartureArrived`, `LoadClosed`, `LoadDeparted` and `LoadArrived` are
raised directly by their commands, not by a policy.

## 4. Hexagonal ports and adapters

```mermaid
flowchart TB
    subgraph IN["internal/adapters/inbound"]
        HTTP["http"]
        KAF["kafka"]
        TMR["scheduler"]
    end
    subgraph APP["internal/application/usecases"]
        UC1["Departure use cases<br/>Schedule, Book, Release,<br/>Close, Record, Cancel"]
        UC2["LaneSchedule use cases<br/>Define, Retire, Generate"]
        UC3["Load use cases<br/>Open, AddPackage, Close,<br/>Dispatch, Receive"]
        PRJ["read-model projectors"]
    end
    subgraph DOM["internal/domain"]
        D1["departure"]
        D2["schedule"]
        D3["load"]
    end
    subgraph PORTS["internal/application/ports"]
        P1["Departure, LaneSchedule,<br/>Load repositories"]
        P2["ReadModelStore"]
        P3["EventPublisher outbox"]
        P4["Inbox, UnitOfWork, Clock"]
    end
    subgraph OUT["internal/adapters/outbound"]
        PG["postgres"]
        KP["kafka relay"]
    end
    HTTP --> UC1
    HTTP --> UC2
    HTTP --> UC3
    KAF --> UC1
    KAF --> PRJ
    TMR --> UC2
    UC1 --> D1
    UC2 --> D2
    UC3 --> D3
    D1 ~~~ P1
    D2 ~~~ P2
    D3 ~~~ P3
    APP -.-> PORTS
    P1 --- PG
    P2 --- PG
    P3 --- PG
    P4 --- PG
    PG --> KP
```

Derived from: `model.yaml → contexts[linehaul-transportation].inbound`,
`.consumes`, `.read_models`, `.policies`, `conventions.integration_rules`
(own database, transactional outbox, idempotent consumers).

All paths are under `internal/` (`internal/adapters/inbound/{http,kafka}`,
`internal/application/usecases`, `internal/domain`,
`internal/application/ports`, `internal/adapters/outbound/{postgres,kafka}`).
The dashed arrow means every use case calls ports only: the repository of
its aggregate, the event publisher (outbox), the inbox and the unit of
work. `http` drives the planner and operator commands, `kafka` drives the
policies (`PickupFromCutoffs`, `BookOnLock`) and the projectors, the
scheduler drives `GenerateDepartures`.

Omitted: the HTTP read path (`GET /departures`, `GET /departures/{departureId}`
read `DepartureRepository` directly); `Clock` has no adapter package. The
`scheduler` inbound adapter is proposed; the fleet's Go layout names only
`http` and `kafka`. There are no outbound HTTP clients: `sync_calls` is
empty.
