---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: The terms Last-Mile Delivery speaks, each mapped to its proposed code identifier, plus the neighbour terms it uses.
---

# Ubiquitous Language

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

The terms this context speaks, each mapped to the identifier an
implementation must use. The network-wide glossary is
[Ubiquitous Language](/network/strategic-design/ubiquitous-language).

## This context's terms

The first six rows are the model's `ul` entries for `last-mile-delivery`. The
rest are aggregate states, value objects and policies of the same context.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Last Mile** | From the delivery station to the customer's door. | (context) `last-mile-delivery` | **Middle Mile** (`linehaul-transportation`): transport between nodes, ending at the station |
| **Delivery Wave** | A station's dispatch slot: induct cutoff, delivery window and stop capacity. | `wave.DeliveryWave` | **Departure** (`linehaul-transportation`): a trip on a lane, counted in packages, not stops |
| **Induction** | Placing an arrived package into a wave. | `wave.InductPackage` | **Load arrival** (`LoadArrived`): the package is at the station but in no wave yet |
| **Route** | One van's ordered stops in one wave. | `route.Route` | **Lane** (`node-topology`): a directed node-to-node connection |
| **Delivery Service Partner (DSP)** | An independent delivery business working for a station. | `partner.DeliveryServicePartner` | **Vendor** (`vendor-connectivity`): operates fulfillment nodes, never stations |
| **Delivery Attempt** | One try to hand a package over: `DELIVERED` or `FAILED` with a reason. | `route.Attempt` | **Delivered** journey state (`shipping-and-tracking`): the customer-visible outcome derived from the attempt |
| **Induct cutoff** | The instant by which a package must be at the station to join a wave. | `DeliveryWave.inductCutoffAt` | **Cutoff** (`node-topology`): a vendor node's handover time for a pickup departure |
| **Delivery window** | When the wave delivers: `windowStart` to `windowEnd`. | `wave.Window{start, end}` | **Deliver-By Window** (`delivery-promise`): what the customer was promised |
| **Stop capacity** | How many stops a wave can take, and how many are assigned. | `wave.StopCapacity{stops, assigned}` | **Van capacity**: the stop limit of one partner's van, enforced on a route |
| **Van capacity** | The maximum stops a partner's van can take on one route; must be greater than zero. | `DeliveryServicePartner` (invariant `ErrInvalidVanCapacity`) | **Stop capacity** of a wave |
| **Stop** | One numbered place on a route with the tracking numbers delivered there and an outcome. | `route.Stop{stopNo, trackingNumbers[], outcome}` | **Scan** (`shipping-and-tracking`): an observation of a package at a node |
| **Service date** | The calendar day a wave belongs to. | `DeliveryWave.serviceDate` | — |
| **Wave states** | `OPEN`, `INDUCTION_CLOSED`, `DISPATCHED`, `COMPLETED`, `CANCELLED`. | `wave.State` | **Departure states** `SCHEDULED`, `CLOSED`, ... |
| **Route states** | `PLANNED`, `OUT_FOR_DELIVERY`, `COMPLETED`. | `route.State` | **Journey state** `OUT_FOR_DELIVERY` in `shipping-and-tracking`, which this context's `PackageOutForDelivery` feeds |
| **Partner states** | `ACTIVE`, `INACTIVE`. | `partner.State` | — |
| **Induct on arrival** | On `LoadArrived` at a delivery station, induct every package into the earliest eligible wave. | policy `InductOnArrival` | — |
| **Retry next wave** | A `FAILED` attempt re-inducts the package into the next wave; three failures return it to sender. | policy `RetryNextWave` | **Return to sender** (`shipping-and-tracking` `ReturnToSender`): the journey transition |

## Neighbour terms used here

| Term | Definition (owner's) | Code identifier | Owner |
| --- | --- | --- | --- |
| **Node** | One physical building of the network, of exactly one node type. | `node.Node` | `node-topology` |
| **Node Type** | `FULFILLMENT_CENTER`, `INBOUND_CROSS_DOCK`, `RETURNS_CENTER`, `SORTATION_CENTER`, `DELIVERY_STATION` or `AIR_HUB`. A station is `DELIVERY_STATION`. | `node.Type` | `node-topology` |
| **Service Area** | The postal prefixes one delivery station serves. | `servicearea.ServiceArea` | `node-topology` |
| **Load** | The packages consolidated onto one departure. | `load.Load` | `linehaul-transportation` |
| **Middle Mile** | Transport between nodes: vendor node to sortation centre, sortation centre to delivery station, air. | (context) | `linehaul-transportation` |
| **Tracking Number** | The network-wide unique id of one package. | `journey.TrackingNumber` | `shipping-and-tracking` |
| **Package Journey** | The customer-visible timeline of one package. | `journey.PackageJourney` | `shipping-and-tracking` |
| **Witness Path** | The concrete node, pickup, departures and delivery wave that prove a promise is feasible. | `promise.WitnessPath` | `delivery-promise` |
| **Promise Basis** | `SCHEDULED` (from real departures and waves) or `NOMINAL`. | `promise.Basis` | `delivery-promise` |

This context does not touch the warehouse-systems fleet, so there is no
fleet translation table. The canonical one is on
[WMS/WES integration](/network/integration/wms-wes-integration).
