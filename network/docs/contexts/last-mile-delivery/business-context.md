---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why the last mile of the retail network is its own bounded context, who acts in it, which decisions it makes and what it deliberately leaves to its neighbours.
---

# Business Context

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

## The business problem

A promise is only as good as its last leg. `delivery-promise` quotes a
delivery date only when it can show a **witness path**: a node cutoff, the
scheduled departures, and a **delivery wave** at the destination station
(`WitnessPath{nodeId, pickupDepartureId, legs[departureId], deliveryWaveId}`).
`order-sourcing` chooses the real path the same way
(`Candidate{..., deliveryWaveId, ...}`). Both need to know, ahead of time and
without a call, three things about every station:

- when a package must be at the station to make a given wave (the **induct
  cutoff**);
- when that wave delivers (the **delivery window**);
- how many more stops the wave can take (its **stop capacity**).

Last-Mile Delivery is the context that owns those facts and keeps them true.
It also does the work behind them. It inducts arriving packages into waves,
plans van routes for delivery service partners, and records what happened at
each door.

The model states the context's purpose as:

> Runs each delivery station: publishes delivery waves (induct cutoff,
> delivery window, stop capacity) that the promise relies on, plans routes for
> delivery service partners, and records every delivery attempt.

## Actors

| Actor | Kind (model `external`) | What they do here |
| --- | --- | --- |
| Station planner | person | Schedules waves, closes induction, plans routes and dispatches waves (REST `/waves`, `/routes`) |
| Delivery service partner driver app | external organisation (driver app) | Starts a route and records each delivery attempt (REST `/routes/{routeId}:start`, `/routes/{routeId}/attempts`) |
| `linehaul-transportation` | sibling context | Tells the station that a load has arrived, with its tracking numbers (`LoadArrived`) |
| `node-topology` | sibling context | Tells the station which nodes exist and which postal prefixes it serves (`NodeRegistered`, `ServiceAreaAssigned`) |
| `delivery-promise`, `order-sourcing` | sibling contexts | Read the published waves to quote and source on them |
| `shipping-and-tracking` | sibling context | Turns out-for-delivery and attempt facts into the customer-visible timeline |

## Decisions this context makes

The model's `business_decisions`:

1. **A package joins the earliest wave** whose induct cutoff it arrived
   before and that has stop capacity left (policy `InductOnArrival`,
   invariants `ErrInductionClosed`, `ErrWaveFull`).
2. **A route never exceeds its van's stop capacity** (`ErrRouteOverCapacity`).
3. **A package is delivered at most once**; a failed attempt returns it to
   the station for the next wave (`ErrAlreadyDelivered`, policy
   `RetryNextWave`; after three failures the package is returned to sender).

Two more rules follow from the aggregates: a wave's times are ordered
(`inductCutoffAt < windowStart < windowEnd`, `ErrInvalidWaveTimes`), and an
attempt is recorded only on a route that is out for delivery
(`ErrRouteNotStarted`).

## Why it is its own context

- **Different clock, different capacity unit.** The middle mile counts
  packages on departures. The last mile counts **stops** in waves and in
  vans. Mixing them would put two capacity rules in one model.
- **Different collaborators.** DSPs are independent businesses with their
  own vans and drivers. Contracting them and keeping each route within a
  van's capacity is a station concern.
- **The promise needs a stable, published fact.** Wave capacity is consumed
  by two Core contexts as an event-fed read model. A context that owns waves
  can publish them as a Published Language, and it can change how it plans
  routes without touching the promise.

## Relation to the real fulfillment networks

The network is modelled on a large-scale logistics network with
network-operated delivery stations and independent delivery partners. The
facts behind that, with citations, are on
public fulfillment-network research. The vendor platform API
surface that a vendor sees, and which never exposes the last mile, is mapped on
the vendor platform API surface map. This page does not restate
either. The model makes no claim about any real company's internal service
names.

## Deliberately out of scope

| Out of scope | Where it lives |
| --- | --- |
| Ship-to addresses and any other PII | `customer-ordering` and `shipping-and-tracking` only ([ADR 0006](/network/adr/0006-pii-confinement)) |
| The customer-visible timeline, `PackageDelivered`, returns to sender as a journey state | `shipping-and-tracking` (`PackageJourney`) |
| Which delivery station serves a postal prefix | `node-topology` (`ServiceArea`) |
| Middle-mile departures and loads | `linehaul-transportation` |
| Quoting, holding and judging promises | `delivery-promise` |
| Customer returns routing to a returns centre | future context `customer-returns` |
| Customer notifications on delivery | future context `customer-notification` |
| Anything in the warehouse-systems fleet | No edge. A delivery station is network-operated; the fleet's facility-layout `DELIVERY_STATION` row is a reference mirror only (model `fleet_site_role_mapping`). The only seam between the organisations is the [Vendor API](/network/integration/vendor-api), which this context does not touch |
