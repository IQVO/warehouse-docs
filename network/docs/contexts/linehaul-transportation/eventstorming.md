---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: Process-level EventStorming boards for Linehaul Transportation (departure generation, booking, loads, cancellation), with hotspots taken from the model's genuine gaps.
---

# EventStorming

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Process-level EventStorming in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky comes from `model.yaml`. Hotspots are genuine open
questions or risks in the model; the source of each is in the
[hotspot table](#hotspots). The network-wide board is on
[EventStorming big picture](/network/strategic-design/eventstorming-big-picture).

## Legend

| Colour | Sticky | Hex |
| --- | --- | --- |
| Blue | Command | `#a5d8ff` |
| Yellow | Aggregate | `#ffec99` |
| Orange | Domain Event | `#ffc078` |
| Lilac | Policy | `#d0bfff` |
| Green | Read Model | `#b2f2bb` |
| Pink | External System (a sibling context or an actor) | `#fcc2d7` |
| Red | Hotspot | `#ff8787` |

## 1. Departures from lanes and vendor cutoffs

```mermaid
flowchart TB
    classDef cmd fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef agg fill:#ffec99,stroke:#f08c00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef rm fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef ext fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hot fill:#ff8787,stroke:#c92a2a,color:#000
    NT["node-topology"]:::ext
    E0["NodeOperational-<br/>ProfileDeclared<br/>NodeActivated<br/>LaneOpened"]:::evt
    RM1["NodeProfileView<br/>LaneView"]:::rm
    P1["PickupFromCutoffs"]:::pol
    PLN["Network-ops planner"]:::ext
    C0["DefineLaneSchedule"]:::cmd
    A0["LaneSchedule"]:::agg
    P2["HorizonRoll<br/>nightly"]:::pol
    C1["GenerateDepartures"]:::cmd
    C2["ScheduleDeparture"]:::cmd
    A1["Departure"]:::agg
    E1["DepartureScheduled"]:::evt
    H1["H1 pickups wait for<br/>activation?"]:::hot
    H2["H2 pickup capacity<br/>and destination?"]:::hot
    NT --> E0 --> RM1
    E0 --> P1 --> C2
    PLN --> C0 --> A0
    P2 --> C1 --> A0
    C1 --> C2 --> A1 --> E1
    P1 --- H1
    C2 --- H2
```

Derived from: `model.yaml → contexts[linehaul-transportation].policies[PickupFromCutoffs, HorizonRoll]`,
`.aggregates[LaneSchedule, Departure]`, `.read_models`, `.inbound`.

Omitted: `ErrLaneClosed`, `ErrInvalidDepartureTimes` and `ErrOverlappingSlots`
refusals; consumers of `DepartureScheduled` (board 4).

## 2. Booking on lock

```mermaid
flowchart TB
    classDef cmd fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef agg fill:#ffec99,stroke:#f08c00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef rm fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef ext fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hot fill:#ff8787,stroke:#c92a2a,color:#000
    OS["order-sourcing"]:::ext
    E0["FulfillmentReleased-<br/>ToNode"]:::evt
    E1["FulfillmentLocked"]:::evt
    E2["FulfillmentReassigned<br/>FulfillmentCancelled"]:::evt
    ST["shipping-and-tracking"]:::ext
    E3["LabelIssued"]:::evt
    RM["ExpectedVolumeView"]:::rm
    P1["BookOnLock"]:::pol
    C1["BookCapacity"]:::cmd
    C2["ReleaseCapacity"]:::cmd
    A1["Departure"]:::agg
    E4["DepartureCapacity-<br/>Changed"]:::evt
    H3["H3 full at lock<br/>time?"]:::hot
    H4["H4 release never<br/>finds a booking"]:::hot
    OS --> E0 --> RM
    OS --> E1 --> P1 --> C1 --> A1
    OS --> E2 --> P1
    P1 --> C2 --> A1
    ST --> E3 --> RM
    A1 --> E4
    C1 --- H3
    C2 --- H4
```

Derived from: `model.yaml → contexts[linehaul-transportation].policies[BookOnLock]`,
`.read_models[ExpectedVolumeView]`, `.aggregates[Departure]`;
`contexts[order-sourcing].aggregates[FulfillmentAssignment].invariants`.

Omitted: `ErrDepartureClosed` (a lock after `cutoffAt`).

## 3. Loads

```mermaid
flowchart TB
    classDef cmd fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef agg fill:#ffec99,stroke:#f08c00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef ext fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hot fill:#ff8787,stroke:#c92a2a,color:#000
    OPS["Sort-centre and<br/>station operators"]:::ext
    C1["OpenLoad<br/>AddPackage"]:::cmd
    C2["CloseLoad"]:::cmd
    C3["DispatchLoad"]:::cmd
    C4["ReceiveLoad"]:::cmd
    A1["Load"]:::agg
    E1["LoadClosed"]:::evt
    E2["LoadDeparted"]:::evt
    E3["LoadArrived"]:::evt
    ST["shipping-and-tracking"]:::ext
    LM["last-mile-delivery"]:::ext
    P1["InductOnArrival"]:::pol
    H5["H5 who records<br/>departure and arrival?"]:::hot
    OPS --> C1 --> A1
    OPS --> C2 --> A1
    OPS --> C3 --> A1
    OPS --> C4 --> A1
    A1 --> E1
    A1 --> E2 --> ST
    A1 --> E3 --> ST
    E3 --> LM --> P1
    C3 --- H5
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Load]`,
`.publishes`, `contexts[last-mile-delivery].policies[InductOnArrival]`.

Omitted: the refusals `ErrPackageAlreadyLoaded` and `ErrLoadOverCapacity`.
`InductOnArrival` is `last-mile-delivery`'s policy, drawn for context.

## 4. Cancellation and its consumers

```mermaid
flowchart TB
    classDef cmd fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef agg fill:#ffec99,stroke:#f08c00,color:#000
    classDef evt fill:#ffc078,stroke:#e8590c,color:#000
    classDef pol fill:#d0bfff,stroke:#7048e8,color:#000
    classDef ext fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hot fill:#ff8787,stroke:#c92a2a,color:#000
    PLN["Network-ops planner"]:::ext
    NT["node-topology"]:::ext
    E0["NodeSuspended<br/>NodeRetired"]:::evt
    P1["PickupFromCutoffs"]:::pol
    C1["CancelDeparture"]:::cmd
    A1["Departure"]:::agg
    E1["DepartureCancelled"]:::evt
    E2["DepartureScheduled<br/>DepartureCapacityChanged"]:::evt
    DP["delivery-promise"]:::ext
    OS["order-sourcing"]:::ext
    P2["RepromiseOnRisk"]:::pol
    H6["H6 capacity cut<br/>has no command"]:::hot
    H7["H7 booked packages<br/>on a cancelled trip?"]:::hot
    PLN --> C1
    NT --> E0 --> P1 --> C1 --> A1 --> E1
    E1 --> DP --> P2
    E1 --> OS
    A1 --> E2
    E2 --> DP
    E2 --> OS
    E2 --- H6
    E1 --- H7
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Departure]`,
`.policies[PickupFromCutoffs]`, `.publishes`,
`contexts[delivery-promise].policies[RepromiseOnRisk]`.

Omitted: `RepromiseOnRisk`'s outputs (`PromiseRevised`), shown in
[Domain Message Flow](/network/contexts/linehaul-transportation/domain-message-flow).

## Hotspots

| # | Hotspot | Where it comes from in the model |
| --- | --- | --- |
| H1 | Pickups are generated on `NodeOperationalProfileDeclared`, but the business decision limits them to `ACTIVE` nodes and a profile is declared before activation (`ErrIncompleteOperationalProfile` in `node-topology`). `NodeActivated` is consumed with no stated reaction. | `contexts[linehaul-transportation].policies[PickupFromCutoffs]` vs `.business_decisions[0]`; `contexts[node-topology].aggregates[Node].invariants` |
| H2 | Resolved (G9): a `PICKUP` departure's lane is the node's default outbound lane (policy `DefaultOutboundLane`) and its `capacityPackages` is `capacityOrders x packagesPerOrder` (policy `PickupCapacity`); `node-topology` declares neither. | `aggregates[Departure].value_objects` (`Capacity{packages, booked}`), `aggregates[LaneSchedule].description` ("or the node cutoffs for a pickup lane"); `lane_rules.allowed` |
| H3 | `BookOnLock` runs after the vendor accepted; if the pickup is full (`ErrDepartureFull`) or closed (`ErrDepartureClosed`) the model names no follow-up. | `policies[BookOnLock]`, `aggregates[Departure].invariants` |
| H4 | `FulfillmentReassigned` and `FulfillmentCancelled` happen only before `LOCKED`, so `ReleaseCapacity` never finds a booking made on lock. | `policies[BookOnLock]`; `contexts[order-sourcing].aggregates[FulfillmentAssignment].transitions`, `ErrAssignmentLocked`, `ErrCancelAfterLock` |
| H5 | No actor, policy or route triggers `CloseDeparture`, `RecordDeparture` or `RecordArrival`; their link to `DispatchLoad` / `ReceiveLoad` is not stated. | `aggregates[Departure].commands` vs `.inbound` and `.rest` |
| H6 | `DepartureCapacityChanged` carries `capacityPackages`, yet no command changes capacity (only `booked`). | `publishes[DepartureCapacityChanged].data`, `aggregates[Departure].commands` |
| H7 | What happens to bookings and loads on a cancelled departure (re-book onto the next one?) is not modelled; only `delivery-promise` reacts. | `aggregates[Departure].transitions`, `policies` |
