---
id: message-flows
title: WCS message flows
sidebar_label: Message flows
description: The four WCS flows end to end - goods-to-person picking, putaway into the AS/RS, replenishment and outbound transport - with the failure path and the capacity loop, as commands, events and queries between contexts. The WCS contexts are built (plans WCS-02 through WCS-06).
---

{/* drift-allow-file: strategic design page, not a spec mirror - the built contexts' authoritative contracts are each repository's apis/openapi.yaml and apis/asyncapi.yaml on develop */}

# WCS message flows

This page is ddd-crew's
[Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling)
for the four flows in scope. Steps marked *(existing)* run in the fleet today;
the WCS contexts they cross are built as well (plans WCS-02 through WCS-06).

## Flow 1: goods-to-person picking

```mermaid
sequenceDiagram
    autonumber
    participant INV as inventory-storage
    participant WWP as wes-work-planning
    participant FE as fulfillment-execution
    participant MFC as material-flow-control
    participant ASRS as asrs-control
    participant AMR as amr-fleet-control
    INV-->>WWP: allocation (via order-management) names container C in the AS/RS location
    WWP->>FE: release work, bounded by SubsystemCapacityChanged
    FE->>MFC: POST /transport-requests (C, AS/RS to station S, PICK)
    MFC-->>FE: 202 TransportAccepted
    MFC->>ASRS: retrieve C to output port P
    ASRS-->>MFC: ContainerPresentedAtPort
    MFC->>AMR: leg P to S
    AMR-->>MFC: LegCompleted
    MFC-->>FE: ContainerArrivedAtStation (StationQueue order)
    Note over FE: task AwaitingContainer becomes claimable
    FE-->>INV: TaskCompleted (existing), contents of C decremented
    FE->>MFC: POST /transport-requests (C, S to AS/RS, RETURN)
    MFC->>AMR: leg S to input port
    MFC->>ASRS: store C
    ASRS-->>MFC: ContainerStored (new rack position, no ledger change)
    MFC-->>FE: TransportCompleted
```

1. *(existing)* `order-management` allocates; `inventory-storage` answers with
   the location and now also the container, which sits in the AS/RS logical
   location.
2. *(existing)* `wes-work-planning` releases the work. **New:** it bounds
   goods-to-person release by the latest `SubsystemCapacityChanged`.
3. `fulfillment-execution` creates the pick task in a new state,
   **AwaitingContainer**, and requests the transport.
4. `material-flow-control` plans two legs: an AS/RS retrieve to an output port,
   then an AMR leg to the station.
5. On `ContainerArrivedAtStation` the task becomes claimable. The picker picks;
   `TaskCompleted` updates the ledger *(existing)*.
6. `fulfillment-execution` requests the return. The new rack position is chosen
   by `asrs-control` and never reaches the ledger.

## Flow 2: putaway into the AS/RS

```mermaid
sequenceDiagram
    autonumber
    participant IR as inbound-receiving
    participant INV as inventory-storage
    participant FE as fulfillment-execution
    participant MFC as material-flow-control
    participant AMR as amr-fleet-control
    participant ASRS as asrs-control
    IR-->>INV: receipt staged (existing)
    Note over INV: decant fills container C, contents recorded
    FE->>MFC: POST /transport-requests (C, decant station to AS/RS, PUTAWAY)
    MFC->>AMR: leg decant to input port
    AMR-->>MFC: LegCompleted
    MFC->>ASRS: store C
    ASRS-->>MFC: ContainerStored
    MFC-->>FE: TransportCompleted
    FE-->>INV: TaskCompleted, stow into the AS/RS location (existing seam)
```

## Flow 3: replenishment

```mermaid
sequenceDiagram
    autonumber
    participant PFR as pick-face-replenishment
    participant WWP as wes-work-planning
    participant FE as fulfillment-execution
    participant MFC as material-flow-control
    participant INV as inventory-storage
    PFR-->>WWP: replenishment request (existing)
    WWP->>FE: REPLENISH work unit (existing)
    FE->>MFC: POST /transport-requests (C, AS/RS to forward handoff, REPLENISH)
    Note over MFC: retrieve, then AMR leg
    MFC-->>FE: TransportCompleted
    Note over FE: operator moves units from C into the pick face
    FE-->>INV: TaskCompleted with RELOCATE fields (existing)
    FE->>MFC: POST /transport-requests (C, forward handoff to AS/RS, RETURN)
```

## Flow 4: outbound transport to pack and dock

```mermaid
sequenceDiagram
    autonumber
    participant FE as fulfillment-execution
    participant MFC as material-flow-control
    participant AMR as amr-fleet-control
    Note over FE: picking filled order tote O at the station
    FE->>MFC: POST /transport-requests (O, station to pack station or dock, OUTBOUND)
    MFC->>AMR: one leg
    AMR-->>MFC: LegCompleted
    MFC-->>FE: TransportCompleted
    Note over FE: pack task becomes claimable (existing pack flow)
```

## The failure path

| Situation | Who handles it | Outcome |
| --- | --- | --- |
| Container unknown or mismatched at a handoff (the no-read case) | `material-flow-control` | `ContainerSentToClarification`; the container goes to a clarification point; `exception-management` opens a case; the transport ends `Failed` with `CLARIFICATION`. |
| Robot blocked or deadlocked | `amr-fleet-control` re-routes; if it cannot, `LegFailed` | `material-flow-control` retries with another robot up to a limit, then `TransportFailed` with `SUBSYSTEM_FAULT`. |
| Shuttle or lift fault | `asrs-control` holds the unit (`EquipmentStateChanged` to Held) | `material-flow-control` re-plans through another aisle if the container is reachable; otherwise the request fails and the capacity drop reaches the WES. |
| Station buffer full | `material-flow-control` | The next leg waits upstream; no arrival is dropped. A persistent backlog lowers the capacity reported to the WES. |
| `TransportFailed` received | `fulfillment-execution` | The task returns to pending or is re-allocated under its existing retry and exception rules. The WES never retries a physical move itself. |

## The capacity loop

```mermaid
flowchart LR
    AMR["amr-fleet-control"] -->|"FleetCapacityChanged"| MFC["material-flow-control"]
    ASRS["asrs-control"] -->|"AsrsCapacityChanged"| MFC
    MFC -->|"SubsystemCapacityChanged"| WWP["wes-work-planning"]
    WWP -->|"release bounded by capacity"| FE["fulfillment-execution"]
```

`material-flow-control` aggregates the subsystems' capacity facts, with station
queue depth, into one `SubsystemCapacityChanged` per subsystem and station.
`wes-work-planning` consumes it through an ACL as a release constraint. Release
then reacts to the utilisation of the automation, Interact Analysis's first WES
criterion: "dynamically release orders to the warehouse based on the utilization
status of the automation equipment" (see the
[fleet industry reference](/wms-wes/industry-reference)).
