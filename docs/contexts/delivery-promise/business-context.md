---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why a delivery date shown before purchase is a domain problem, who asks for it, what the context decides, and what it deliberately leaves to its neighbours.
---

# Business Context

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

## The business problem

A shopper decides whether to buy partly on one line of text: *"Arrives
Thursday."* A retailer that shows an early date sells more. A retailer that
shows an early date and then misses it loses the customer's trust and pays for
the failure. The problem this context solves is to show the **earliest date the
network can actually keep**, and to keep it.

Three things make that hard in this network:

1. **The network does not own the buildings that ship.** Fulfillment centres
   are operated by vendors. A vendor declares its operating hours, cutoffs and
   handling time (owned by `node-topology`), and the network measures how well
   it keeps them (owned by `node-performance`). The promise must use both, and
   trust neither blindly.
2. **The date depends on a chain of capacities owned elsewhere.** A package
   leaves a node at a pickup departure, rides scheduled middle-mile departures
   (`linehaul-transportation`) and joins a delivery wave at a delivery station
   (`last-mile-delivery`). Each has a cutoff and a finite capacity. A date
   that ignores any link is a guess.
3. **Promising is not assigning.** The node that proves a date is feasible
   now (the **witness**) need not be the node that ships. `order-sourcing`
   decides that later, as late as the promise allows
   ([ADR 0002](/adr/0002-promise-and-assignment-are-separate)). The promise
   only has to be *true*; the assignment has to be *cheap* and still true.

The context therefore makes a promise **true by construction**: a delivery
offer exists only if a concrete witness path with remaining capacity exists
right now, and a promise reserves capacity on the witness node's pickup cutoff
before the shopper pays ([ADR 0008](/adr/0008-capacity-held-at-promise-time)).

## Actors

| Actor | What they want from this context | Channel |
| --- | --- | --- |
| Shopper, through the storefront | A delivery date per tier on a product page or in the cart | `POST /delivery-offers:quote` (Open Host) |
| `customer-ordering` (checkout) | Offers for the cart, then one promise per shipment group, then updates when a promise changes | `POST /delivery-offers:quote`, `POST /promises`; Kafka `PromiseAtRisk`, `PromiseRevised`, `PromiseKept`, `PromiseBroken` |
| `order-sourcing` | Revised constraints when a promise moves, and a signal when a pickup cutoff is full | Kafka `PromiseRevised`, `PromiseBookExhausted` |
| `node-performance` | The kept / broken judgement per node, to grade it | Kafka `PromiseKept`, `PromiseBroken` |
| The network's own clock | Expired offers and expired holds cleaned up, books closed at their cutoff | internal sweeps (`ExpireOffers`, `ReleaseExpiredHolds`, `CloseBook`) |

Network-ops planners, vendors and delivery partners never talk to this context
directly. Their decisions reach it as events from the contexts they do talk to.

## What it decides

- **Whether a tier can be offered at all.** No feasible path means no offer at
  that tier, with the constraint that blocked it: `DESTINATION_NOT_SERVED`,
  `ITEM_QUANTITY_NOT_AVAILABLE`, `DELIVERY_SLA_UNAVAILABLE` or
  `NODE_CAPACITY_EXHAUSTED`.
- **The window.** The earliest feasible path wins: earliest delivery-wave
  window end, then in-region, then fewer legs, then the better scorecard grade.
  The window shown is the window of the delivery wave that path ends in.
- **How much to trust a node.** A node's ship-by is pushed later by its
  scorecard grade (the **handicap**), never silently dropped.
- **How a cart splits.** One node for the whole cart if possible; otherwise
  the fewest shipment groups, one promise each.
- **When a fast tier is honest.** `SAME_DAY`, `NEXT_DAY` and `TWO_DAY` are
  quoted only from scheduled departures and waves. Only `STANDARD` may fall
  back to nominal lane times, and the promise then records basis `NOMINAL`.
- **How much demand a pickup cutoff can take.** Provisional plus confirmed
  holds never exceed the node's share of that cutoff.
- **Whether the promise was kept.** Kept means delivered on or before
  `deliverByLatest`.

The search itself is described step by step in the
[Use Cases](/contexts/delivery-promise/use-cases) page, and worked through with
numbers in [the promise model](/network-model/promise-model).

## How this relates to the operator-scale reality

The shape of this context follows public descriptions of how a large retail
network promises delivery: a date computed from the network's real schedules
and capacity, regional fulfillment and delivery stations, scorecards that
penalise vendors who ship late, and fast tiers that are constrained at peak.
The facts, with citations, are on
[the large-operator logistics network research page](/research/large-operator-logistics-network).
What a vendor can and cannot declare through a public API, and how promise and
acknowledgement windows appear there, is mapped on
[the marketplace API surface map](/research/marketplace-api-surface-map). Other retailers and
order-management products used as benchmarks are on
[the benchmarks page](/research/benchmarks).

None of this pack claims anything about a real company's internal services.
`DeliveryOffer`, `Promise`, `PromiseBook`, the witness path and the handicap
are this proposed model's names.

## Deliberately out of scope

| Out of scope | Who owns it instead |
| --- | --- |
| Choosing the node that actually ships, and moving it until the vendor accepts | `order-sourcing` (path lock on acceptance, [ADR 0005](/adr/0005-vendor-acceptance-is-the-path-lock)) |
| Registering nodes, lanes, service areas and regions | `node-topology` |
| Scheduling departures and booking packages onto them | `linehaul-transportation` |
| Delivery waves, routes and delivery attempts | `last-mile-delivery` |
| Grading nodes | `node-performance` (this context only applies the grade) |
| Listings and available quantities | `offer-availability` |
| The shopper, the ship-to address and the order | `customer-ordering` (PII stays there, [ADR 0006](/adr/0006-pii-confinement)) |
| Notifying the customer of a revised date | `customer-ordering` today; a future `customer-notification` context |
| Deciding which node should hold which item before demand | future `inventory-placement` context |
| Anything inside a vendor's building | the vendor (the warehouse-systems fleet is one vendor, reached only through the [Vendor API](/integration/vendor-api)) |

This context never calls a warehouse-systems service and never reads a
`warehouse.*` topic. It never sees an address: it promises to a **destination
postal prefix**.
