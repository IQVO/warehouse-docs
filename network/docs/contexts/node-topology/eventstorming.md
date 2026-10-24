---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: Process-level EventStorming boards for Node Topology, covering node registration and activation, suspension and retirement, and lanes, regions and service areas, with hotspots from open questions in the model.
---

# EventStorming

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Process-level boards in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky comes from the model. Every hotspot is an open
question or a risk the model leaves open, and the table at the end names the
model entry it comes from. The domain-wide board is
[EventStorming big picture](/network/strategic-design/eventstorming-big-picture).

## Legend

| Colour | Sticky | Meaning here |
| --- | --- | --- |
| Blue `#a5d8ff` | Command | A command from the model's `commands` |
| Yellow `#ffec99` | Aggregate | `Node`, `Lane`, `ServiceArea`, `Region` |
| Orange `#ffc078` | Domain Event | An event from the model's `publishes` |
| Lilac `#d0bfff` | Policy | This context's policy or a neighbour's reaction |
| Green `#b2f2bb` | Read Model | A neighbour's event-fed read model |
| Pink `#fcc2d7` | External System | Another bounded context |
| Red `#ff8787` | Hotspot | An open question or risk in the model |
| Pale yellow `#fff9db` | Actor | A person (the network-ops planner) |

## 1. A node is registered, declared and activated

```mermaid
flowchart LR
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    classDef actor fill:#fff9db,stroke:#f08c00,color:#000
    VC["vendor-connectivity"]:::external
    PL["network-ops<br/>planner"]:::actor
    C1["RegisterNode"]:::command
    P1["DefaultCapabilities<br/>ByType"]:::policy
    G1["Node"]:::aggregate
    E1["NodeRegistered"]:::event
    C2["DeclareOperational<br/>Profile"]:::command
    E2["NodeOperational<br/>ProfileDeclared"]:::event
    C3["ActivateNode"]:::command
    E3["NodeActivated"]:::event
    H1["Hotspot H5: regionId<br/>not checked"]:::hotspot
    H2["Hotspot H3: cutoffs<br/>have no day"]:::hotspot
    H3["Hotspot H2: who declares<br/>a network node profile"]:::hotspot
    H7["Hotspot H4: may an ACTIVE<br/>FC drop all cutoffs"]:::hotspot

    VC --> C1
    PL --> C1
    C1 --> P1
    P1 --> G1
    G1 --> E1
    VC --> C2
    C2 --> G1
    G1 --> E2
    PL --> C3
    C3 --> G1
    G1 --> E3
    C1 --- H1
    C2 --- H2
    C2 --- H3
    C2 --- H7
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Node]`,
`.policies`, `.inbound`, `.publishes`.

Omitted: the refusals (`ErrOperatorNotAllowedForNodeType`,
`ErrVendorNodeCodeTaken`, `ErrStaleProfileRevision`,
`ErrCutoffOutsideOperatingHours`, `ErrIncompleteOperationalProfile`), which
raise no event; the downstream reactions, on board 2.

## 2. What the network does with node facts

```mermaid
flowchart LR
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    classDef actor fill:#fff9db,stroke:#f08c00,color:#000
    E2["NodeOperational<br/>ProfileDeclared"]:::event
    E3["NodeActivated"]:::event
    E4["NodeSuspended"]:::event
    E5["NodeRetired"]:::event
    P2["PickupFromCutoffs<br/>linehaul"]:::policy
    P3["SuppressOnNode<br/>Unavailable<br/>offer-availability"]:::policy
    R1["NodeProfileView<br/>delivery-promise,<br/>order-sourcing"]:::readmodel
    R2["NodeStatusView<br/>offer-availability"]:::readmodel
    R3["VendorNodeView<br/>vendor-connectivity"]:::readmodel
    LH["linehaul-<br/>transportation"]:::external
    OA["offer-availability"]:::external

    E2 --> P2
    E4 --> P2
    E5 --> P2
    P2 --> LH
    E3 --> R2
    E4 --> P3
    E5 --> P3
    E3 --> P3
    P3 --> OA
    E2 --> R1
    E3 --> R1
    E4 --> R1
    E5 --> R1
    E3 --> R3
    E4 --> R3
    E5 --> R3
```

Derived from: model.yaml → `contexts[linehaul-transportation].policies[PickupFromCutoffs]`,
`contexts[offer-availability].policies[SuppressOnNodeUnavailable]`,
`.read_models[NodeStatusView]`; `contexts[delivery-promise|order-sourcing].read_models[NodeProfileView]`;
`contexts[vendor-connectivity].read_models[VendorNodeView]`.

Omitted: `NodeRegistered` feeding the same read models (and `StationView` in
`last-mile-delivery`); `node-performance`, which records
`NodeOperationalProfileDeclared` as the declaration it measures against.

## 3. Suspension and retirement

```mermaid
flowchart LR
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    classDef actor fill:#fff9db,stroke:#f08c00,color:#000
    PL["network-ops<br/>planner"]:::actor
    C4["SuspendNode"]:::command
    C5["RetireNode"]:::command
    C3["ActivateNode"]:::command
    G1["Node"]:::aggregate
    E4["NodeSuspended"]:::event
    E5["NodeRetired"]:::event
    E3["NodeActivated"]:::event
    H4["Hotspot H1: lanes of the<br/>node stay OPEN"]:::hotspot
    H5["Hotspot H1: prefixes of a<br/>retired station stay ASSIGNED"]:::hotspot
    H6["Hotspot H6: illegal transition<br/>has no Err name"]:::hotspot

    PL --> C4
    PL --> C5
    PL --> C3
    C4 --> G1
    C5 --> G1
    C3 --> G1
    G1 --> E4
    G1 --> E5
    G1 --> E3
    E4 --- H4
    E5 --- H5
    C4 --- H6
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Node].transitions`,
`.invariants`; `.aggregates[Lane]`, `.aggregates[ServiceArea]`, `.policies`.

Omitted: `ErrNodeRetired` (any command on a `RETIRED` node); the reasons a
planner suspends (the model leaves them free text; `node-performance` never
suspends a node).

## 4. Lanes, regions and service areas

```mermaid
flowchart LR
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
    classDef actor fill:#fff9db,stroke:#f08c00,color:#000
    PL["network-ops<br/>planner"]:::actor
    C6["DefineRegion"]:::command
    G4["Region"]:::aggregate
    E8["RegionDefined"]:::event
    C7["OpenLane"]:::command
    C8["CloseLane"]:::command
    G2["Lane"]:::aggregate
    E6["LaneOpened"]:::event
    E7["LaneClosed"]:::event
    C9["AssignService<br/>Area"]:::command
    G3["ServiceArea"]:::aggregate
    E9["ServiceArea<br/>Assigned"]:::event
    N1["Node, read for<br/>ACTIVE and type"]:::aggregate
    R4["LaneView,<br/>NetworkGraphView,<br/>RegionAndService<br/>AreaView, StationView"]:::readmodel

    PL --> C6
    C6 --> G4
    G4 --> E8
    PL --> C7
    PL --> C8
    C7 --> N1
    C7 --> G2
    C8 --> G2
    G2 --> E6
    G2 --> E7
    PL --> C9
    C9 --> N1
    C9 --> G3
    G3 --> E9
    E6 --> R4
    E7 --> R4
    E8 --> R4
    E9 --> R4
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Lane|ServiceArea|Region]`,
`lane_rules`; the read models of `delivery-promise`, `order-sourcing`,
`linehaul-transportation` and `last-mile-delivery`.

Omitted: the refusals (`ErrLaneLoop`, `ErrLaneTypePairNotAllowed`,
`ErrLaneEndpointNotActive`, `ErrDuplicateLane`, `ErrNotADeliveryStation`,
`ErrStaleAssignmentVersion`, `ErrRegionCodeTaken`). The `Node` sticky here
is read, not changed: the lane and service-area use cases load it to check
their invariants.

## Hotspots

| Id | Hotspot | Where it comes from in the model |
| --- | --- | --- |
| H1 | Lanes of a suspended or retired node stay `OPEN`, and the prefixes of a retired delivery station stay `ASSIGNED`. No policy closes or reassigns them. | `contexts[node-topology].policies` holds only `DefaultCapabilitiesByType`; `Lane` closes only by `CloseLane`; `ErrLaneEndpointNotActive` and `ErrNotADeliveryStation` are checked only when opening or assigning. |
| H2 | Who declares a network node's profile? `declaredBy` allows `NETWORK_OPS`, but no inbound row gives the planner `DeclareOperationalProfile`. | `aggregates[Node].value_objects` (`declaredBy(VENDOR or NETWORK_OPS)`) against `inbound`. |
| H3 | A cutoff has no day of week, yet it must fall "inside the operating hours of its day". | `CutoffSlot{localTime, maxOrders?}` against `ErrCutoffOutsideOperatingHours`. |
| H4 | May a later profile revision of an `ACTIVE` fulfillment centre drop every cutoff? The completeness rule says "before activation". | `ErrIncompleteOperationalProfile`. |
| H5 | No invariant makes a node's or a service area's `regionId` name a defined region. | `aggregates[Region].description` ("nodes and service areas belong to exactly one region") with no matching invariant. |
| H6 | Illegal transitions (for example `SuspendNode` on `PROPOSED`) and unknown ids have no named error. | `aggregates[Node].transitions` and `invariants` (only `ErrNodeRetired` covers a refused transition). |
