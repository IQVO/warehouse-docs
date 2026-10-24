---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: Proposed UML class diagrams of Node Topology's domain model, and the hexagonal ports and adapters view of the proposed Go service.
---

# Class Diagram

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

UML class diagrams of the **proposed** domain model, in the Go hexagonal
layout the warehouse-systems fleet uses. Type names follow the model's `ul`
code identifiers (`node.Node`, `node.OperationalProfile`, `node.CutoffSlot`,
`node.ThroughputCap`, `lane.Lane`, `region.Region`,
`servicearea.ServiceArea`). Fields are unexported (`-`), methods exported
(`+`). Only state-changing methods and key queries are shown.

## 1. Node aggregate: root and operational profile

```mermaid
classDiagram
    direction TB
    class Node {
        <<AggregateRoot>>
        -nodeId NodeID
        -nodeType Type
        -subtype Subtype
        -operator Operator
        -vendorRef VendorRef
        -regionId RegionID
        -timezone string
        -location GeoLocation
        -capabilities NodeCapabilities
        -status Status
        -profile OperationalProfile
        -version int
        +Register(...)$ Node
        +DeclareOperationalProfile(p) error
        +Activate(at) error
        +Suspend(reason, at) error
        +Retire(at) error
        +AcceptsCustomerDemand() bool
    }
    class OperationalProfile {
        <<ValueObject>>
        -profileRevision int
        -timezone string
        -operatingHoursByDay OperatingHours
        -holidays Date[]
        -handlingTime Duration
        -cutoffs CutoffSlot[]
        -throughputCap ThroughputCap
        -sortDwellMinutes int optional
        -declaredBy DeclaredBy
        -declaredAt Time
    }
    class CutoffSlot {
        <<ValueObject>>
        -localTime LocalTime
        -days Weekday[]
        -maxOrders int optional
    }
    class OperatingHours {
        <<ValueObject>>
        -monday DayHours optional
        -tuesday DayHours optional
        -wednesday DayHours optional
        -thursday DayHours optional
        -friday DayHours optional
        -saturday DayHours optional
        -sunday DayHours optional
    }
    class DayHours {
        <<ValueObject>>
        -start LocalTime
        -end LocalTime
    }
    class ThroughputCap {
        <<ValueObject>>
        -value int
        -timeUnit TimeUnit
        -unit ORDER
    }
    class TimeUnit {
        <<Enumeration>>
        HOUR
        DAY
    }
    class DeclaredBy {
        <<Enumeration>>
        VENDOR
        NETWORK_OPS
    }
    class Status {
        <<Enumeration>>
        PROPOSED
        ACTIVE
        SUSPENDED
        RETIRED
    }
    Node *-- OperationalProfile : current revision
    Node --> Status
    OperationalProfile *-- CutoffSlot : 0..*
    OperationalProfile *-- OperatingHours
    OperatingHours *-- DayHours : 0..7
    OperationalProfile *-- ThroughputCap
    ThroughputCap --> TimeUnit
    OperationalProfile --> DeclaredBy
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Node]`
(`value_objects`, `states`, `commands`), `.ul`.

Omitted: the read accessors and the `Err...` variables (on
[Aggregate Design Canvas](/network/contexts/node-topology/aggregate-design-canvas)).
The model shows one `OperationalProfile` per `Node`; the repository keeps
every past revision, which the aggregate never edits. `OperatingHours` is the
map `{monday … sunday: {start, end}}` (`HH:mm`); a missing day is closed.
`CutoffSlot.days` defaults to every operating day. `sortDwellMinutes` is set
only on `SORTATION_CENTER` and `AIR_HUB` nodes. `version` is the optimistic-concurrency counter, not a domain field.

## 2. Node aggregate: identity, capabilities, policy and repository

```mermaid
classDiagram
    direction TB
    class Node {
        <<AggregateRoot>>
        -nodeId NodeID
        -nodeType Type
        -operator Operator
        -vendorRef VendorRef
        -location GeoLocation
        -capabilities NodeCapabilities
    }
    class NodeCapabilities {
        <<ValueObject>>
        -outbound bool
        -inbound bool
        -returns bool
        -sort bool
        -lastMile bool
        -air bool
    }
    class GeoLocation {
        <<ValueObject>>
        -postalCode string
        -countryCode string
        -lat float
        -lon float
    }
    class VendorRef {
        <<ValueObject>>
        -vendorId string
        -vendorNodeCode string
    }
    class Operator {
        <<Enumeration>>
        NETWORK
        VENDOR
    }
    class DefaultCapabilitiesByType {
        <<Policy>>
        +For(t Type) NodeCapabilities
    }
    class NodeRepository {
        <<Repository>>
        +Save(ctx, n, expectedVersion) error
        +FindByID(ctx, id) Node
        +FindByVendorNodeCode(ctx, vendorId, code) Node
        +List(ctx, type, region, status) Node[]
    }
    Node *-- NodeCapabilities
    Node *-- GeoLocation
    Node *-- VendorRef : 0..1
    Node --> Operator
    DefaultCapabilitiesByType ..> NodeCapabilities : derives
    NodeRepository ..> Node : persists
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Node].value_objects`,
`.policies[DefaultCapabilitiesByType]`, `node_types`.

Omitted: the fields already shown in diagram 1; the enumerations `Type`
(six node types) and `Subtype` (seven fulfillment-centre subtypes), listed on
[Ubiquitous Language](/network/contexts/node-topology/ubiquitous-language).
`VendorRef` is absent on a `NETWORK` node.

## 3. Lane aggregate

```mermaid
classDiagram
    direction TB
    class Lane {
        <<AggregateRoot>>
        -laneId LaneID
        -originNodeId NodeID
        -destinationNodeId NodeID
        -mode LaneMode
        -nominalTransit NominalTransit
        -status LaneStatus
        -closedAt Time
        -version int
        +Open(origin, destination, mode, transit)$ Lane
        +Close(at) error
    }
    class NominalTransit {
        <<ValueObject>>
        -minutes int
    }
    class LaneMode {
        <<Enumeration>>
        GROUND
        AIR
    }
    class LaneStatus {
        <<Enumeration>>
        OPEN
        CLOSED
    }
    class LaneRepository {
        <<Repository>>
        +Save(ctx, l, expectedVersion) error
        +FindByID(ctx, id) Lane
        +List(ctx, origin, destination) Lane[]
    }
    Lane *-- NominalTransit
    Lane --> LaneMode
    Lane --> LaneStatus
    LaneRepository ..> Lane : persists
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Lane]`.

Omitted: `originNodeId` and `destinationNodeId` are ids, not associations
to `Node`. The lane type-pair rule is a domain function over `node_types` and
`lane_rules`, not a class.

## 4. ServiceArea and Region aggregates

```mermaid
classDiagram
    direction TB
    class ServiceArea {
        <<AggregateRoot>>
        -postalPrefix PostalPrefix
        -deliveryStationNodeId NodeID
        -regionId RegionID
        -assignmentVersion int
        +Assign(station, version) error
    }
    class Region {
        <<AggregateRoot>>
        -regionId RegionID
        -code string
        -name string
        +Define(code, name)$ Region
    }
    class ServiceAreaRepository {
        <<Repository>>
        +Save(ctx, a, expectedVersion) error
        +FindByPrefix(ctx, prefix) ServiceArea
    }
    class RegionRepository {
        <<Repository>>
        +Save(ctx, r) error
        +FindByCode(ctx, code) Region
    }
    ServiceAreaRepository ..> ServiceArea : persists
    RegionRepository ..> Region : persists
```

Derived from: model.yaml → `contexts[node-topology].aggregates[ServiceArea|Region]`.

Omitted: `deliveryStationNodeId` and `regionId` are ids, not associations:
each aggregate is loaded and saved on its own. `ServiceArea` and `Region`
have a single state each (`ASSIGNED`, `DEFINED`; `ServiceArea` has one
transition, `ASSIGNED` to `ASSIGNED` on `AssignServiceArea`), so no status
enumeration is drawn.

## 5. Domain events

```mermaid
classDiagram
    direction LR
    class DomainEvent {
        <<interface>>
        +EventName() string
        +AggregateID() string
        +OccurredAt() Time
    }
    class NodeRegistered {
        <<DomainEvent>>
        nodeId, nodeType, subtype, operator
        vendorId, vendorNodeCode, regionId
        timezone, postalCode, countryCode
    }
    class NodeOperationalProfileDeclared {
        <<DomainEvent>>
        nodeId, profileRevision, timezone
        operatingHoursByDay, holidays
        handlingTimeMinutes, cutoffs
        throughputCap, sortDwellMinutes, declaredBy
    }
    class NodeActivated {
        <<DomainEvent>>
        nodeId, activatedAt
    }
    class NodeSuspended {
        <<DomainEvent>>
        nodeId, reason, suspendedAt
    }
    class NodeRetired {
        <<DomainEvent>>
        nodeId, retiredAt
    }
    class LaneOpened {
        <<DomainEvent>>
        laneId, originNodeId, destinationNodeId
        mode, nominalTransitMinutes
    }
    class LaneClosed {
        <<DomainEvent>>
        laneId, closedAt
    }
    class ServiceAreaAssigned {
        <<DomainEvent>>
        postalPrefix, deliveryStationNodeId
        regionId, assignmentVersion
    }
    class RegionDefined {
        <<DomainEvent>>
        regionId, code, name
    }
    DomainEvent <|.. NodeRegistered
    DomainEvent <|.. NodeOperationalProfileDeclared
    DomainEvent <|.. NodeActivated
    DomainEvent <|.. NodeSuspended
    DomainEvent <|.. NodeRetired
    DomainEvent <|.. LaneOpened
    DomainEvent <|.. LaneClosed
    DomainEvent <|.. ServiceAreaAssigned
    DomainEvent <|.. RegionDefined
```

Derived from: model.yaml → `contexts[node-topology].publishes[*].data`.

Omitted: field types (on [Domain Events](/network/contexts/node-topology/domain-events)).
`AggregateID()` is the CloudEvents `subject` and the Kafka key.

## 6. Hexagonal ports and adapters

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 20, "rankSpacing": 40}}}%%
flowchart TB
    subgraph IN["inbound adapters"]
        HTTP["inbound/http<br/>REST routes"]
        KIN["inbound/kafka<br/>none: no topic"]
    end
    subgraph APP["application/usecases"]
        UN["RegisterNode, DeclareOperationalProfile,<br/>ActivateNode, SuspendNode, RetireNode,<br/>OpenLane, CloseLane,<br/>AssignServiceArea, DefineRegion"]
    end
    subgraph DOM["domain"]
        D1["node, lane,<br/>servicearea, region"]
    end
    subgraph PORTS["application/ports"]
        P1["NodeRepository<br/>LaneRepository<br/>ServiceAreaRepository<br/>RegionRepository"]
        P2["EventPublisher"]
        P3["UnitOfWork, Clock<br/>IdempotencyStore"]
    end
    subgraph OUT["outbound adapters"]
        A1["outbound/postgres<br/>repositories, UoW,<br/>outbox, idempotency"]
        A2["outbound/kafka<br/>outbox relay"]
    end
    HTTP --> UN
    HTTP -. reads .-> P1
    APP --> DOM
    APP --> PORTS
    P1 --- A1
    P3 --- A1
    P2 --- A1
    A1 --> A2
```

Derived from: model.yaml → `contexts[node-topology].aggregates[*].commands`,
`.rest`, `.consumes` (empty), `conventions.integration_rules` (outbox).

Proposed packages, under `internal/`:

| Package | Contents |
| --- | --- |
| `internal/domain/node` | `Node`, `OperationalProfile`, `CutoffSlot`, `ThroughputCap`, `NodeCapabilities`, `GeoLocation`, `VendorRef`, `Type`, `Subtype`, `Operator`, `Status`, `DefaultCapabilitiesByType`, the nine `Err...` of `Node` |
| `internal/domain/lane` | `Lane`, `NominalTransit`, `LaneMode`, the allowed type pairs, the four `Err...` of `Lane` |
| `internal/domain/servicearea` | `ServiceArea`, `ErrNotADeliveryStation`, `ErrStaleAssignmentVersion`, `ErrUnknownRegion` |
| `internal/domain/region` | `Region`, `ErrRegionCodeTaken` |
| `internal/application/usecases` | the nine command use cases |
| `internal/application/ports` | the four repositories, `EventPublisher`, `UnitOfWork`, `Clock`, `IdempotencyStore` |
| `internal/adapters/inbound/http` | the thirteen REST routes, problem+json mapping (the shared `not-found`, `illegal-transition`, `concurrent-update` and `validation-failed` problems), `Idempotency-Key` handling |
| `internal/adapters/inbound/kafka` | empty: the context consumes no topic |
| `internal/adapters/outbound/postgres` | repositories, unit of work, outbox writer, idempotency store, migrations |
| `internal/adapters/outbound/kafka` | outbox relay to `retailnetwork.node-topology.events`, CloudEvents encoder |

Omitted from the diagram: the composition root (`cmd/`), health and metrics
routes, and the use cases' read of a second aggregate (`OpenLane` and
`AssignServiceArea` read `Node` through `NodeRepository`). The HTTP adapter
reads repositories directly for the four `GET` routes, because every read is
a lookup on one aggregate type.
