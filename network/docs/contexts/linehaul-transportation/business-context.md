---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why the retail network needs its own middle-mile context that turns static lanes and vendor cutoffs into scheduled, capacity-bounded departures and loads.
---

# Business Context

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

## The problem in plain language

A package leaves a vendor's fulfillment centre, is trucked to a sortation
centre, is sorted by destination, rides another truck (or a plane through an
air hub) and arrives at the delivery station that serves the customer's
postal area. Everything between the vendor's dock and the delivery station is
the **middle mile**.

`node-topology` knows the shape of that network: which nodes exist and which
**lanes** connect them, with a nominal transit time. A lane is static. It
does not say *when* a truck leaves, *how many* packages it can carry, or
whether tomorrow's 18:00 trip is still running. A promise for a fast tier
cannot rest on a nominal number (`delivery-promise` forbids it, see
[ADR 0008](/network/adr/0008-capacity-held-at-promise-time)). It needs concrete trips
with a cutoff, a departure, an arrival and remaining room.

This context supplies those trips. It turns lanes into **scheduled
departures**, keeps each departure's capacity honest (`booked <= capacity`),
and builds **loads**: the packages physically consolidated onto one
departure at its origin node.

## The pickup departure: where a vendor's cutoff becomes real

A vendor declares, in its node's operational profile, the local times by
which packages are ready (its **cutoffs**). A declaration alone moves
nothing. The network has to send a truck. Policy `PickupFromCutoffs` makes
that link: on `NodeOperationalProfileDeclared` it generates one **PICKUP**
departure for every cutoff of the 14-day horizon, and on `NodeSuspended` or
`NodeRetired` it cancels the future ones. The business decision behind it:
every declared cutoff of an `ACTIVE` vendor fulfillment node gets one pickup
departure per operating day.

The pickup departure is what `delivery-promise` puts on a witness path, and
its cutoff is the `shipBy` the promise records. `order-sourcing` releases a
shipment group against it (`pickupDepartureId`), and the vendor sees it as
the `requiredShipBy` of its purchase order. So this context is the place
where a declared capability becomes a scheduled, bookable fact.

## Actors

| Actor | Kind | What they do here |
| --- | --- | --- |
| Network-ops planner | Person | Defines a lane's weekly schedule (`DefineLaneSchedule`), retires it, cancels a departure (`CancelDeparture`) |
| Sort-centre and station operators | Person / scanner | Open a load on a departure, add packages by tracking number, close, dispatch and receive it |
| `node-topology` | Sibling context (upstream) | Publishes nodes, operational profiles (cutoffs) and lanes |
| `order-sourcing` | Sibling context (upstream and downstream) | Releases, reassigns, locks and cancels assignments; reads departures to choose a path |
| `shipping-and-tracking` | Sibling context (upstream and downstream) | Publishes `LabelIssued` (expected packages); consumes `LoadDeparted` and `LoadArrived` for the package timeline |
| `delivery-promise` | Sibling context (downstream) | Reads departures and their capacity to build witness paths; re-promises on `DepartureCancelled` |
| `last-mile-delivery` | Sibling context (downstream) | Inducts packages into delivery waves on `LoadArrived` |
| Scheduler (internal) | Timer | Runs `GenerateDepartures` nightly to keep the 14-day horizon (policy `HorizonRoll`) |

## Decisions this context makes

From `contexts[linehaul-transportation].business_decisions`:

1. Every declared cutoff of an `ACTIVE` vendor fulfillment node gets one
   pickup departure per operating day.
2. A departure's booked packages never exceed its capacity
   (`ErrDepartureFull`).
3. A package is on at most one open load at a time
   (`ErrPackageAlreadyLoaded`).
4. A cancelled departure is announced before its cutoff wherever possible,
   so promises can be revised.

It does **not** decide which node or path fulfils a shipment group (that is
`order-sourcing`), what date the customer is told (`delivery-promise`), or
which delivery wave a package joins (`last-mile-delivery`).

## How it relates to the real fulfillment networks

The model is shaped after the public picture of a large retail network's
middle mile: vendor and fulfillment-centre pickups feeding sortation
centres, a sort-and-consolidate step, and delivery stations that run the
last mile. The facts, with citations, are on
public fulfillment-network research. How a vendor
learns its ship-by and hands packages over through a Direct-Fulfillment-like
API is mapped on the vendor platform API surface map. This
page restates none of those facts. The names here (departure, load, lane
schedule) are this model's own and make no claim about any real company's
internal systems.

## Deliberately out of scope

- **The lane itself.** Opening and closing lanes, node types and the allowed
  type pairs belong to `node-topology`. This context only reacts to
  `LaneOpened` and `LaneClosed`.
- **Carrier procurement, trailer and driver management, freight cost and
  settlement.** None appears in the model. Payments and invoicing are a named
  future context (`payments-and-invoicing`, Generic).
- **Package-level tracking for customers.** The customer timeline is
  `shipping-and-tracking`'s `PackageJourney`; this context only reports load
  movements.
- **Delivery waves and routes.** `last-mile-delivery` owns everything after a
  load arrives at a delivery station.
- **Anything inside a vendor's building.** Picking, packing and the vendor's
  own carrier cutoffs belong to the vendor. The warehouse-systems fleet is
  vendor V-WS and never talks to this context: the only channel between the
  two organizations is the Vendor API (see
  [WMS/WES integration](/network/integration/wms-wes-integration)).
- **Inventory placement** (which node should hold which item). Named as a
  future context (`inventory-placement`) and out of scope.
