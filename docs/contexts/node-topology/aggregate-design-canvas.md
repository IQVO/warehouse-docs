---
id: aggregate-design-canvas
title: Aggregate Design Canvas
sidebar_label: Aggregate Design Canvas
description: The ddd-crew Aggregate Design Canvas for Node, Lane, ServiceArea and Region, with states, invariants, commands, events and size estimates.
---

# Aggregate Design Canvas

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Following the ddd-crew [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas).
The model gives this context four aggregate roots: **Node**, **Lane**,
**ServiceArea** and **Region**. Each section below is one canvas.

## Node

### 1. Name

`Node` (proposed package `internal/domain/node`), identified by `nodeId`.

### 2. Description

One physical building in the network: its type, operator, region, time zone
and declared operational profile. It holds no child entity. Its value
objects are:

| Value object | Fields |
| --- | --- |
| `OperationalProfile` | `profileRevision`, `timezone`, `operatingHoursByDay`, `holidays[]`, `handlingTime`, `cutoffs[CutoffSlot]`, `throughputCap`, `sortDwell`, `declaredBy` (`VENDOR` or `NETWORK_OPS`), `declaredAt` |
| `CutoffSlot` | `localTime`, `maxOrders` (optional) |
| `ThroughputCap` | `value`, `timeUnit`, `unit` = `ORDER` |
| `NodeCapabilities` | `outbound`, `inbound`, `returns`, `sort`, `lastMile`, `air` |
| `GeoLocation` | `postalCode`, `countryCode`, `lat`, `lon` |
| `VendorRef` | `vendorId`, `vendorNodeCode` |

### 3. State Transitions

```mermaid
stateDiagram-v2
    [*] --> PROPOSED: RegisterNode
    PROPOSED --> ACTIVE: ActivateNode
    ACTIVE --> SUSPENDED: SuspendNode
    SUSPENDED --> ACTIVE: ActivateNode
    ACTIVE --> RETIRED: RetireNode
    SUSPENDED --> RETIRED: RetireNode
    RETIRED --> [*]
    note right of PROPOSED
        DeclareOperationalProfile is accepted in PROPOSED, ACTIVE and SUSPENDED
    end note
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Node].states`,
`.transitions`, `.commands`, `.invariants`.

Omitted: the model lists no transition into `PROPOSED`; it is drawn as the
entry state because it is the only state with no incoming transition and
`RegisterNode` is the only creating command. `DeclareOperationalProfile` does
not change the state, so it is a note rather than an edge; it is refused on a
`RETIRED` node by `ErrNodeRetired`.

### 4. Enforced Invariants

| Invariant | Enforced by |
| --- | --- |
| The operator must be allowed for the node type; parcel nodes are `NETWORK`-operated | `RegisterNode` → `ErrOperatorNotAllowedForNodeType` |
| `vendorNodeCode` is unique per vendor | `RegisterNode` → `ErrVendorNodeCodeTaken` (spans all `Node` aggregates; backed by a unique index, see [Entity Relationship](/contexts/node-topology/entity-relationship)) |
| The profile revision strictly increases | `DeclareOperationalProfile` → `ErrStaleProfileRevision` |
| A `FULFILLMENT_CENTER` profile declares at least one cutoff and a `handlingTime` above zero before activation | `ActivateNode` → `ErrIncompleteOperationalProfile` |
| Cutoffs fall inside the operating hours of their day | `DeclareOperationalProfile` → `ErrCutoffOutsideOperatingHours` |
| `RETIRED` is terminal | `ActivateNode`, `SuspendNode`, `RetireNode`, `DeclareOperationalProfile` → `ErrNodeRetired` |

### 5. Corrective Policies

- **`DefaultCapabilitiesByType`** (this context): node capabilities are
  derived from the node type, never typed by hand. `RegisterNode` sets
  `NodeCapabilities` from `node_types`.
- **`SuppressOnNodeUnavailable`** (`offer-availability`): on `NodeSuspended`
  or `NodeRetired` every listing of the node is suppressed; on
  `NodeActivated` the listings suppressed for that reason are restored.
- **`PickupFromCutoffs`** (`linehaul-transportation`): on
  `NodeOperationalProfileDeclared` the pickup departures for every cutoff of
  the horizon are (re)generated; on `NodeSuspended` or `NodeRetired` future
  pickups are cancelled.
- **`RepromiseOnRisk`** (`delivery-promise`): a cancelled departure on a
  promise's witness path, for example a pickup cancelled after a suspension,
  makes the promise be recomputed and revised.
- **Demand only while `ACTIVE`** (business decision 2): `delivery-promise`
  and `order-sourcing` read node status from their own `NodeProfileView`, so
  a node that is not `ACTIVE` stops being a witness or a candidate without
  any call to this context.

### 6. Handled Commands

| Command | Inbound route | Issued by |
| --- | --- | --- |
| `RegisterNode` | `POST /nodes` | `vendor-connectivity` (vendor node), network-ops planner (network node) |
| `DeclareOperationalProfile` | `PUT /nodes/{nodeId}/operational-profile` | `vendor-connectivity` |
| `ActivateNode` | `POST /nodes/{nodeId}:activate` | network-ops planner |
| `SuspendNode` | `POST /nodes/{nodeId}:suspend` | network-ops planner |
| `RetireNode` | `POST /nodes/{nodeId}:retire` | network-ops planner |

### 7. Created Events

| Event | Raised when | Full CloudEvents type |
| --- | --- | --- |
| `NodeRegistered` | `RegisterNode` is saved (state `PROPOSED`) | `com.retailnetwork.logistics.node-topology.node.NodeRegistered` |
| `NodeOperationalProfileDeclared` | a new profile revision is saved | `com.retailnetwork.logistics.node-topology.node.NodeOperationalProfileDeclared` |
| `NodeActivated` | `ActivateNode` is saved (from `PROPOSED` or `SUSPENDED`) | `com.retailnetwork.logistics.node-topology.node.NodeActivated` |
| `NodeSuspended` | `SuspendNode` is saved | `com.retailnetwork.logistics.node-topology.node.NodeSuspended` |
| `NodeRetired` | `RetireNode` is saved | `com.retailnetwork.logistics.node-topology.node.NodeRetired` |

### 8. Throughput

*Estimate* (model): low, tens of writes per day. Contention on one node is
practically nil: a vendor's profile declaration and a planner's state change
can race, which an optimistic-concurrency version check resolves.

### 9. Size

*Estimate* (model): one row plus one profile row per revision; about 10^3
nodes. Events per node over its life: one `NodeRegistered`, one
`NodeOperationalProfileDeclared` per revision, and a handful of
activations, suspensions and one retirement.

## Lane

### 1. Name

`Lane` (proposed package `internal/domain/lane`), identified by `laneId`.

### 2. Description

A directed, mode-specific connection between two nodes with a nominal
transit time. Its scheduled departures belong to `linehaul-transportation`.
Value objects: `NominalTransit{minutes}` and `LaneMode` (`GROUND` or `AIR`).

### 3. State Transitions

```mermaid
stateDiagram-v2
    [*] --> OPEN: OpenLane
    OPEN --> CLOSED: CloseLane
    CLOSED --> [*]
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Lane].states`,
`.transitions`, `.commands`.

Omitted: nothing. There is no reopen; a new lane is opened instead.

### 4. Enforced Invariants

| Invariant | Enforced by |
| --- | --- |
| Origin and destination differ | `OpenLane` → `ErrLaneLoop` |
| (origin type, destination type) is an allowed pair (model `lane_rules.allowed`) | `OpenLane` → `ErrLaneTypePairNotAllowed` |
| Both ends are `ACTIVE` when opening | `OpenLane` → `ErrLaneEndpointNotActive` (reads both `Node` aggregates) |
| At most one `OPEN` lane per (origin, destination, mode) | `OpenLane` → `ErrDuplicateLane` (spans `Lane` aggregates; backed by a partial unique index) |

### 5. Corrective Policies

- None in this context. Consumers react: `linehaul-transportation` refuses to
  schedule on a closed lane (`ErrLaneClosed`, its own invariant) and keeps a
  `LaneView`; `delivery-promise` and `order-sourcing` keep `LaneView` and
  `NetworkGraphView`.
- The model has no policy that closes the lanes of a suspended or retired
  node (an open question on the
  [Bounded Context Canvas](/contexts/node-topology/bounded-context-canvas)).

### 6. Handled Commands

| Command | Inbound route | Issued by |
| --- | --- | --- |
| `OpenLane` | `POST /lanes` | network-ops planner |
| `CloseLane` | `POST /lanes/{laneId}:close` | network-ops planner |

### 7. Created Events

| Event | Raised when | Full CloudEvents type |
| --- | --- | --- |
| `LaneOpened` | `OpenLane` is saved | `com.retailnetwork.logistics.node-topology.lane.LaneOpened` |
| `LaneClosed` | `CloseLane` is saved | `com.retailnetwork.logistics.node-topology.lane.LaneClosed` |

### 8. Throughput

*Estimate* (model): low.

### 9. Size

*Estimate* (model): about 10^4 lanes. Two events per lane over its life.

## ServiceArea

### 1. Name

`ServiceArea` (proposed package `internal/domain/servicearea`), identified by
`postalPrefix`.

### 2. Description

Which delivery station (and therefore which region) serves a postal prefix,
versioned by `assignmentVersion`.

### 3. State Transitions

```mermaid
stateDiagram-v2
    [*] --> ASSIGNED: AssignServiceArea
    ASSIGNED --> ASSIGNED: AssignServiceArea, next version
```

Derived from: model.yaml → `contexts[node-topology].aggregates[ServiceArea].states`,
`.commands`, `.invariants`.

Omitted: the model lists no transitions for `ServiceArea`. The self-loop is
drawn because the assignment is versioned (`ErrStaleAssignmentVersion`), so a
prefix can be reassigned to another station under a higher version. There is
no unassign.

### 4. Enforced Invariants

| Invariant | Enforced by |
| --- | --- |
| The assigned node is an `ACTIVE` `DELIVERY_STATION` | `AssignServiceArea` → `ErrNotADeliveryStation` (reads the `Node` aggregate) |
| The assignment version strictly increases | `AssignServiceArea` → `ErrStaleAssignmentVersion` |

### 5. Corrective Policies

- None in this context. The region of the prefix is taken from the station's
  `regionId` at assignment time and published in `ServiceAreaAssigned`.
- Consumers react: `delivery-promise` (`RegionAndServiceAreaView`),
  `order-sourcing` (`NetworkGraphView`), `last-mile-delivery`
  (`StationView`).

### 6. Handled Commands

| Command | Inbound route | Issued by |
| --- | --- | --- |
| `AssignServiceArea` | `PUT /service-areas/{postalPrefix}` | network-ops planner |

### 7. Created Events

| Event | Raised when | Full CloudEvents type |
| --- | --- | --- |
| `ServiceAreaAssigned` | each saved assignment version | `com.retailnetwork.logistics.node-topology.servicearea.ServiceAreaAssigned` |

### 8. Throughput

*Estimate* (model): low; bulk at network redesign.

### 9. Size

*Estimate* (model): about 10^4 prefixes. One event per assignment version.

## Region

### 1. Name

`Region` (proposed package `internal/domain/region`), identified by
`regionId`.

### 2. Description

A largely self-sufficient partition of the network. Nodes and service areas
belong to exactly one region. A region has a `code` and a `name`.

### 3. State Transitions

```mermaid
stateDiagram-v2
    [*] --> DEFINED: DefineRegion
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Region].states`,
`.commands`.

Omitted: nothing. The model has no rename and no removal.

### 4. Enforced Invariants

| Invariant | Enforced by |
| --- | --- |
| The region code is unique | `DefineRegion` → `ErrRegionCodeTaken` (spans `Region` aggregates; backed by a unique index) |

### 5. Corrective Policies

None.

### 6. Handled Commands

| Command | Inbound route | Issued by |
| --- | --- | --- |
| `DefineRegion` | `POST /regions` | network-ops planner |

### 7. Created Events

| Event | Raised when | Full CloudEvents type |
| --- | --- | --- |
| `RegionDefined` | `DefineRegion` is saved | `com.retailnetwork.logistics.node-topology.region.RegionDefined` |

### 8. Throughput

*Estimate* (model): rare.

### 9. Size

*Estimate* (model): single digits (eight in the reference network). One
event per region.

## Read models

The model gives this context **no read model** (`read_models: []`). The four
query routes (`GET /nodes/{nodeId}`, `GET /nodes?type=&region=&status=`,
`GET /lanes?origin=&destination=`, `GET /service-areas/{postalPrefix}`) read
the aggregates' own tables directly. That is enough here because:

- the write rate is low, so the query load never contends with writes;
- each query is a lookup or a filter on one aggregate type, never a join of
  facts from several contexts;
- the neighbours that need these facts on a hot path keep their own
  event-fed read models (`NodeProfileView`, `LaneView`,
  `RegionAndServiceAreaView`, `NetworkGraphView`, `NodeStatusView`,
  `VendorNodeView`, `StationView`), so this context is never on that path.

The three uniqueness rules that span aggregates (`ErrVendorNodeCodeTaken`,
`ErrDuplicateLane`, `ErrRegionCodeTaken`) are enforced by unique indexes in
the same database, not by a read model and not by a bigger aggregate.
