---
id: tier-interactions
title: How the WMS and WES tiers work together
sidebar_label: Tier interactions
description: Inbound, outbound and inter-warehouse transfer flows drawn across the industry tiers, showing which messages cross from the order tier to the WES and WMS contexts and back.
---

# How the WMS and WES tiers work together

The three flows below are drawn with each participant grouped by its
industry category from the [qualification](/wms-wes/qualification). The
messages are the real routes and CloudEvents types on `develop`. Solid arrows
are synchronous REST calls; open arrows (`-)`) are Kafka events. Each flow
shows the happy path; the failure branches are on each context's own
sequence-diagram page.

## Outbound: order to shipped package

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 110, "actorMargin": 14, "messageMargin": 26, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor C as Customer
    box rgb(237,233,254) Above the WMS
    participant OM as order-management
    end
    box rgb(204,251,241) WMS
    participant INV as inventory-storage
    end
    box rgb(219,234,254) WES
    participant WWP as wes-work-planning
    participant FE as fulfillment-execution
    end
    actor S as Station

    C->>OM: POST /orders
    OM->>INV: POST /reservations for the order lines
    INV-->>OM: reservation held
    OM-)WWP: OrderAllocated
    Note over WWP: work unit enters the path pool<br/>released earliest CPT first, within the WIP limit
    WWP-)FE: WorkReleased
    S->>FE: POST /stations/{stationId}/claim-next
    FE-->>S: best-fit PICK task, under lease
    S->>FE: POST /tasks/{id}/complete
    FE-)INV: TaskCompleted, confirms the pick
    FE-)WWP: TaskCompleted, completes the work unit
    Note over FE,S: REBIN, PACK and SLAM tasks follow on their own paths
    FE-)OM: PackageManifested after the SLAM weigh-check
```

The WES decides *when* (wes-work-planning releases) and *where*
(fulfillment-execution hands a task to a station). The WMS keeps the stock
true at both ends: the reservation before release and the pick confirmation
after completion. If a task misses its cutoff, fulfillment-execution
publishes `TaskCPTMissed` and order-management re-promises the order.

## Inbound: advance ship notice to stowed stock

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 110, "actorMargin": 14, "messageMargin": 26, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor V as Supplier or carrier
    box rgb(204,251,241) WMS
    participant INB as inbound-receiving
    participant INV as inventory-storage
    participant FL as facility-layout
    participant PM as product-master
    end
    actor O as Receiving operator

    FL-)INV: Zone and LocationSlot events
    PM-)INV: ProductClassified
    V->>INB: POST /asns
    V->>INB: POST /appointments
    O->>INB: POST /appointments/{appointmentId}/check-in
    O->>INB: POST /receipts
    O->>INB: POST /receipts/{receiptId}/lines
    INB-)INV: ReceiptLineReceived for the good units
    Note over INV: StockReceived
    O->>INV: POST /stock/stow
    Note over INV: zone and handling checks<br/>hazmat placement, DOT segregation
    INV-->>O: stow recorded
    O->>INB: POST /receipts/{receiptId}/close
```

Inbound is entirely WMS. The first two messages are the local copies that
let inventory-storage validate a stow without calling another context. No WES
is involved, because put-away is not released as WES work in this fleet.

## Network transfer: rebalance between two warehouses

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 110, "actorMargin": 14, "messageMargin": 26, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor P as Network planner
    box rgb(237,233,254) Above the WMS
    participant NIP as network-inventory-planning
    end
    box rgb(204,251,241) WMS at both sites
    participant INV as inventory-storage
    end
    box rgb(219,234,254) WES at both sites
    participant WWP as wes-work-planning
    participant FE as fulfillment-execution
    end

    P->>NIP: POST /v1/transfers:approve
    NIP-)INV: TransferAllocationRequested
    INV-)NIP: TransferStockAllocated
    NIP-)WWP: WorkDemandReleased
    WWP-)FE: WorkReleased, transfer work kind
    FE-)NIP: TransferPicked, TransferDispatched
    FE-)NIP: TransferArrived at the destination
    Note over INV: destination receipt<br/>POST /transfers/{transferLineId}/receipt and /stow
    INV-)NIP: TransferReceiptStaged, TransferStockStowed
    Note over NIP: saga complete<br/>TransferStuckDetected if a state dwells too long
```

The network context never moves stock. It asks the WMS to allocate, the WES
to release and dispatch the floor work, and the destination WMS to receive
and stow, and it follows the saga from the facts each one publishes.
