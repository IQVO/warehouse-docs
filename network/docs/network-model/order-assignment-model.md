---
id: order-assignment-model
title: Order assignment model
sidebar_label: Order assignment model
description: "How order-sourcing keeps each shipment group in a virtual queue, re-optimizes it, releases it to one vendor node as a purchase order, reassigns on refusal and locks on acceptance, continuing the worked example."
---

# Order assignment model

:::info[Proposed design]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml)
→ `contexts[order-sourcing]`, `contexts[vendor-connectivity]`. Owner:
[`order-sourcing`](/network/contexts/order-sourcing) (Core). The published fact
behind it: A large-scale operator assigns items to fulfillment centres and paths after
purchase, possibly differently from the path behind the promise, and the path
can change until the item is picked, then stays locked
.
:::

## Why assignment is not the promise

The promise needs **a** feasible path, now, in milliseconds. Assignment needs
**the best** feasible path, as late as possible, when more is known: other
orders have arrived, a departure has filled, a node's grade has changed. If
one context did both it would either promise slowly or assign early and
wastefully. So the promise carries a **witness path** (proof that the date is
reachable) and `order-sourcing` is free to pick another path, under one hard
constraint: the assigned path must still reach the customer by
`deliverByLatest` (`ErrCandidateBreaksPromise`).

## The assignment lifecycle

```mermaid
stateDiagram-v2
    [*] --> QUEUED: QueueAssignment
    QUEUED --> QUEUED: ReoptimiseAssignment
    QUEUED --> RELEASED: ReleaseToNode
    QUEUED --> RELEASED: ReleaseConsolidated
    RELEASED --> QUEUED: HandleNodeRefusal
    RELEASED --> QUEUED: Requeue
    RELEASED --> LOCKED: LockAssignment
    LOCKED --> SHIPPED: MarkShipped
    SHIPPED --> DELIVERED: MarkDelivered
    QUEUED --> UNSOURCEABLE: ReleaseToNode
    RELEASED --> UNSOURCEABLE: HandleNodeRefusal
    UNSOURCEABLE --> QUEUED: ApplyRevisedPromise
    QUEUED --> CANCELLED: CancelAssignment
    RELEASED --> CANCELLED: CancelAssignment
    DELIVERED --> [*]
    CANCELLED --> [*]
```

Derived from: `model.yaml` → `contexts[order-sourcing].aggregates[FulfillmentAssignment].transitions`.

| State | Can the node change? | Who moves it on |
| --- | --- | --- |
| `QUEUED` | yes, freely | the `VirtualQueue` timer, re-optimization sweeps |
| `RELEASED` | only if the node refuses (reject or expiry); that node is then excluded. A member of a consolidation merge also returns to `QUEUED` when a promise revision dissolves the merge | `vendor-connectivity` events, `delivery-promise` `PromiseRevised` |
| `LOCKED` | **never** | the vendor's acceptance |
| `UNSOURCEABLE` | n/a; waits for a revised promise | `delivery-promise` `PromiseRevised` |

## When to release

`VirtualQueue` sets a release point for each queued group:

```text
releaseAt = bestCandidate.pickup.cutoffAt
          - bestCandidate.node.handlingTime
          - vendorAckBudget                    # time the vendor needs to say yes
SAME_DAY: release immediately
```

Until `releaseAt`, every sweep re-runs `AssignmentCost` over the candidate
nodes that still meet `deliverByLatest`:

```text
effectiveCost = estimatedCostCents                   # planner-declared lane and wave costs
              + crossRegionSurchargeCents            # SourcingPolicy, cross-region candidates only
cheapest      = min(effectiveCost)
budget        = cheapest + floor(cheapest x maxCostDeviationPercent / 100)

order: candidates within the budget with an in-region one first   # only when the percent is above 0
       then effectiveCost                                           # money decides
       then, for a CONSOLIDATED group, the LATER pickup             # the hold
       then legs + crossRegionPenalty                               # prefer in-region
            + scorecardPenalty(grade)                               # prefer reliable nodes
            + bookPressurePenalty(PromiseBookExhausted)             # spread load off full cutoffs
       ties -> the promise's witness node
```

Derived from: `model.yaml` → `contexts[order-sourcing].policies[AssignmentCost]`, `[RegionalBudget]`,
`[ConsolidatedHold]`.

Cross-region is a cost, never a filter (gap G26). With no `SourcingPolicy` published the surcharge and
the percent are 0, and the ordering is the one the ordinal penalties alone gave. The split surcharge of
the first contract is not built: this context never splits an order, because each group is assigned on its own.

At `releaseAt` the cheapest candidate is released: `FulfillmentReleasedToNode`.
For a vendor node, `vendor-connectivity` turns it into a purchase order with

```text
ackBy = min(issuedAt + vendor.ackWindow, requiredShipBy - node.handlingTime)
```

so even a vendor with a 24-hour acknowledgement window must answer a
same-evening order in time to still pick and pack it.

## Consolidation at release

A shopper who places two orders to the same address within a few days costs two pickups, two purchase
orders and two packages. When the groups chose the opt-in `CONSOLIDATED` delivery day, `order-sourcing` can
merge them **at release**, never before. The due assignment becomes the **carrier**; compatible QUEUED
assignments become **followers**; the carrier is released once, with the union of the lines, and every
member keeps its own events.

| Rule | What it requires |
| --- | --- |
| c1 identity | not the carrier, QUEUED, the same non-empty consolidation key and destination postal prefix, both tiers `CONSOLIDATED` |
| c2 node | the carrier's solo best node is not excluded by the follower and the merged search returns an option there: a merge never moves the carrier |
| c3 overlap | the merged `eta` lies inside the overlap of the members' delivery windows |
| c4 stock | quantities summed per catalogue item still have ONE covering owner (`OwnerChoice`) |
| c5 caps | the member count is at most `consolidationMaxAssignments` and the union at most the line cap |

Derived from: `model.yaml` → `contexts[order-sourcing].policies[ConsolidationAtRelease]`,
`[ConsolidatedHold]`, `[MergedFanOut]`, `[ConsolidationDissolution]`.

A `CONSOLIDATED` group is held as late as its day allows (it is released at the latest pickup that still reaches the
chosen wave), so a second order has time to find it still QUEUED. Whatever does not fit releases alone. The vendor
sees one purchase order with positional lines; the lock, shipment and delivery of the carrier are applied to every
follower in the same transaction, and each member raises its own `FulfillmentLocked`, `FulfillmentShipped` and
`FulfillmentDelivered`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OS as order-sourcing
    participant VC as vendor-connectivity
    participant DP as delivery-promise
    OS->>OS: ReleaseConsolidated (carrier) and ReleaseAsFollower
    OS->>VC: evt: FulfillmentReleasedToNode (members)
    VC->>VC: one purchase order, positional lines
    alt a promise revision excludes the merged eta
        DP->>OS: evt: PromiseRevised
        OS->>VC: evt: FulfillmentReleaseWithdrawn
        VC->>VC: cancel the ISSUED order of that release
        OS->>OS: Requeue every member, re-search, AssignmentsDeconsolidated
    else the vendor accepts
        VC->>OS: evt: PurchaseOrderAccepted
        OS->>DP: evt: FulfillmentLocked per member
    end
```

Derived from: `model.yaml` → `contexts[order-sourcing].policies`, `contexts[vendor-connectivity].policies[CancelOnReleaseWithdrawn]`.

A cancel of a merged member is refused while the merge is live and not yet locked (reason `CANCEL_WHILE_MERGED`): the
merge stays intact and the cancel can be retried after the lock or after the merge is dissolved. A refusal or expiry of the
carrier's purchase order re-searches every member on its own. The one known residual is a vendor acknowledgement that crosses
the withdraw by a message hop; `order-sourcing` ignores the stale acceptance and the vendor holds an order for the old union.

## Lock, refusal, and the unsourceable case

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OS as order-sourcing
    participant VC as vendor-connectivity
    participant NF as network-fulfillment (vendor)
    participant DP as delivery-promise
    OS->>VC: evt: FulfillmentReleasedToNode (node A)
    VC->>VC: IssuePurchaseOrder, ackBy
    NF->>VC: qry: GET /vendor/purchase-orders
    alt vendor accepts in full
        NF->>VC: cmd: POST /vendor/acknowledgements ACCEPT
        VC->>OS: evt: PurchaseOrderAccepted
        OS->>OS: LockAssignment
        OS->>DP: evt: FulfillmentLocked
    else vendor rejects or ackBy passes
        VC->>OS: evt: PurchaseOrderRejected or PurchaseOrderExpired
        OS->>OS: HandleNodeRefusal, exclude node A
        alt another node still meets deliverByLatest
            OS->>VC: evt: FulfillmentReleasedToNode (node B)
        else no node can
            OS->>DP: evt: FulfillmentUnsourceable
            DP->>OS: evt: PromiseRevised
            OS->>OS: ApplyRevisedPromise, back to QUEUED
        end
    end
```

Derived from: `model.yaml` → `contexts[order-sourcing].policies`,
`contexts[vendor-connectivity].policies`, `contexts[delivery-promise].policies[RepromiseOnRisk]`.

**Why acceptance is the lock.** In the reference operator's buildings the published lock
point is "picked". The network cannot see inside a vendor's building, and a
vendor that accepted fill-or-kill has committed stock and floor work (the
fleet's `network-fulfillment` releases the held `order-management` order only
after a reconciled acceptance). Reassigning after acceptance would leave a
vendor picking an order nobody wants. So acceptance is the vendor-node
equivalent of "picked"
([ADR 0005](/network/adr/0005-vendor-acceptance-is-the-path-lock)).

## Worked example, continued

From [Promise model](/network/network-model/promise-model): the order was placed at
14:10 with a `NEXT_DAY` promise, witness `N-VWS-AUS3`, `shipBy` 18:00 CDT,
`deliverByLatest` Fri 21:00.

| Time (CDT) | What happens | Context |
| --- | --- | --- |
| 14:10 | `CustomerOrderPlaced` → `QueueAssignment`; candidates AUS3 (Fri) and DFW7 (Mon, breaks the promise: excluded) | order-sourcing |
| 15:55 | `releaseAt` = 18:00 − 95 min − 30 min ack budget. Re-optimize: AUS3 still cheapest. `ReleaseToNode` | order-sourcing |
| 15:55 | `PurchaseOrderIssued` `po-55120`, `requiredShipBy` 18:00, `ackBy` = min(15:55 + 24 h, 18:00 − 95 min) = **16:25** | vendor-connectivity |
| 15:56 | fleet `network-fulfillment` polls, raises a held `order-management` order, `FeasibleBy(18:00)` = true, posts ACCEPT, gets `transactionId` | warehouse-systems |
| 16:01 | transaction SUCCESS → `PurchaseOrderAccepted` → `LockAssignment` → `FulfillmentLocked`; linehaul books one package on `dep-AUS3-1800` | network |
| 16:02 | fleet reconciles the transaction and releases the order to the floor (WES, pick, pack, SLAM) | warehouse-systems |
| 17:20 | fleet requests a label, then confirms shipment with the tracking number | warehouse-systems → vendor-connectivity |
| 18:00 | pickup departs; first scan = `PackageHandedOver` (on time) | linehaul, shipping-and-tracking |
| Fri 11:42 | `DeliveryAttempted` DELIVERED → `PackageDelivered` → `PromiseKept` | last-mile, tracking, promise |

The fleet-side rows are what the fleet's `network-fulfillment` does today
against its stub, plus the changes listed on
[Fleet changes](/network/integration/fleet-changes).
