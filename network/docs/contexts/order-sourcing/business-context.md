---
id: business-context
title: Business Context
sidebar_label: Business Context
description: "Why choosing the node that actually fulfils a shipment group is a separate, late decision from the promise, who takes part in it, and what Order Sourcing deliberately leaves to other contexts."
---

# Business Context

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

## The problem

At checkout, `delivery-promise` tells the shopper a date and proves it with
one **witness path**: a concrete vendor node, its pickup departure, the
linehaul legs and a delivery wave that can carry the package in time. That
proof is made in milliseconds, for one order, with the network as it looked
at that instant.

The witness path is a proof that the promise *can* be kept. It is not a
decision about *how* it will be kept. Between checkout and the moment a node
must start work, the network keeps changing: other orders land on the same
cutoff, a departure fills up or is cancelled, a node's scorecard drops, a
vendor sends a new inventory feed, a cheaper in-region node appears. Sending
every group to its witness node at once would freeze each order's routing at
its worst-informed moment.

**Order Sourcing** owns the later decision. For every shipment group it keeps
a **FulfillmentAssignment** that:

1. waits, re-optimisable, in a **virtual queue** until its release point;
2. at release, sends the group to exactly one node (a purchase order, through
   `vendor-connectivity`);
3. if the node rejects the order or lets it expire, excludes that node and
   tries the next candidate;
4. once the node accepts, **locks** the choice: from then on the node never
   changes;
5. if no node can still meet the promise, hands the group back to
   `delivery-promise` as **UNSOURCEABLE**, instead of letting the promise
   break quietly.

The [order assignment model](/network/network-model/order-assignment-model) walks
through one group end to end with times. This page explains the business
reasons.

## Why late, and why a lock

The release point is computed, not configured (`VirtualQueue` policy):

```
releaseAt = pickup cutoff of the best candidate
          - node handling time
          - vendor ack budget
SAME_DAY: release immediately
```

Releasing later keeps more options open. Releasing too late leaves the vendor
no time to acknowledge before it must start handling. The vendor ack budget is
the time reserved for that acknowledgement. Same-day groups have no slack, so
they skip the queue.

The lock point is the vendor's acceptance (`LockOnCommit` policy). In a
network where the operator picks its own stock, the natural lock point is the
pick. Here the fulfillment centres are operated by vendors, and the network
cannot see their pick. The acceptance is the first moment the vendor commits,
so it is the vendor-node equivalent of "the item is picked"
([ADR 0005](/network/adr/0005-vendor-acceptance-is-the-path-lock)).

## Actors

| Actor | Kind | What they do with this context |
| --- | --- | --- |
| Shopper | Person (synthetic), indirect | Places the order in `customer-ordering`; sees lock, shipment and re-promise only through that context |
| `customer-ordering` | Sibling context | Announces placed and cancelled orders; shows the shopper locked, shipped and unsourceable groups |
| `delivery-promise` | Sibling context (Core) | Supplies the promise constraint; re-promises an unsourceable group; signals exhausted promise books |
| `vendor-connectivity` | Sibling context | Turns a release into a purchase order and reports the vendor's acceptance, rejection, expiry and shipment |
| Vendor node | External organisation, indirect | Accepts or rejects the purchase order through the Vendor API. The warehouse-systems fleet is vendor `V-WS`; its `network-fulfillment` context is the only fleet system that talks to the network |
| `linehaul-transportation` | Sibling context | Supplies departures and their remaining capacity; follows releases, reassignments, locks and cancellations to expect volume and book the pickup |
| Network-ops planner | Person | Lists and inspects assignments; asks for an immediate re-optimisation |
| Timers | Scheduler | Fire the release at `releaseAt` and the re-optimisation sweeps over `QUEUED` assignments |

## Decisions it makes

| Decision | Rule (from `business_decisions` and `policies`) |
| --- | --- |
| Which node and path | The cheapest candidate whose `eta` still meets `deliverByLatest`. `cost = legs + crossRegionPenalty + scorecardPenalty + bookPressurePenalty`; ties go to the witness node (`AssignmentCost`). |
| May it differ from the witness? | Yes. The only hard constraint is that the assigned path still meets `deliverByLatest`. |
| When to release | At `releaseAt` (`VirtualQueue`); at once for `SAME_DAY`. |
| What to send | The whole group to one node: fill-or-kill. A partial answer does not exist. |
| What a refusal means | `PurchaseOrderRejected` or `PurchaseOrderExpired` excludes that node for the current promise revision and re-queues the group (`ReassignOnRefusal`). |
| When the choice is final | On `PurchaseOrderAccepted` (`LockOnCommit`). |
| When to give up | When no candidate meets `deliverByLatest`: `UNSOURCEABLE`, and `delivery-promise` re-promises. |
| Where to look first | In-region nodes. Cross-region only when it is the only way to keep the promise. |

## How this relates to the real fulfillment networks

The model follows the published description of how a large online retailer
separates generating a customer promise from assigning the order to a
fulfillment centre, where the assigned centre and path may differ from the
path that justified the promise and may change until the item is picked. The
sources and quotations are on
public fulfillment-network research; this page
does not restate them.

Two differences are deliberate and come from the model, not from the source:

- The fulfillment nodes are **vendor-operated**
  ([ADR 0004](/network/adr/0004-parcel-nodes-are-network-operated)), so a release is a
  purchase order with an acknowledgement window, close to the vendor
  direct-fulfillment shape mapped on
  the vendor platform API surface map. The lock is the
  acceptance, not the pick.
- Promise and assignment are **two bounded contexts**
  ([ADR 0002](/network/adr/0002-promise-and-assignment-are-separate)), joined by the
  promise constraint on the way in and by `FulfillmentUnsourceable` and
  `PromiseRevised` on the way back.

Order-routing features of commercial order-management products are compared
on benchmarks.

## Deliberately out of scope

| Not here | Where it lives |
| --- | --- |
| Computing the promise, holding promise-book capacity, judging kept or broken | `delivery-promise` |
| The purchase-order protocol: `ackBy`, fill-or-kill acknowledgement, labels, shipment confirmation | `vendor-connectivity` |
| Picking, packing and stock placement inside a vendor node | The vendor (for `V-WS`, the warehouse-systems fleet). Which node a seller's stock goes to is chosen on its inbound plan in `seller-inbound`, not here |
| Booking the package on the pickup departure, building loads | `linehaul-transportation` |
| The tracking timeline, labels and the ship-to address | `shipping-and-tracking`; no PII ever enters this context ([ADR 0006](/network/adr/0006-pii-confinement)) |
| Customer cancellation rules and the customer-facing status | `customer-ordering` |
| Splitting a cart into shipment groups | `delivery-promise` (`ShipmentGrouping`); this context receives groups already formed |
| Returns, payments, notifications | Future contexts `customer-returns`, `payments-and-invoicing`, `customer-notification` |

See the [Bounded Context Canvas](/network/contexts/order-sourcing/bounded-context-canvas)
for every message and the [Context Map](/network/contexts/order-sourcing/context-map)
for every relationship.
