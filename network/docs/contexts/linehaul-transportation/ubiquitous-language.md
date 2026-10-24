---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: The terms Linehaul Transportation speaks (departure, pickup departure, load, lane schedule, middle mile) and the neighbour terms it uses, each with its proposed code identifier.
---

# Ubiquitous Language

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

The network-wide glossary is on
[Ubiquitous Language](/network/strategic-design/ubiquitous-language). Code
identifiers are the proposed Go names; `(context)` marks a term that names
the context itself rather than a type.

## This context's terms

From `contexts[linehaul-transportation].ul`, plus the value objects and
states of its aggregates.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Middle Mile** | Transport between nodes: vendor node to sortation centre, sortation centre to delivery station, air. | `(context)` | **Last Mile** (`last-mile-delivery`: delivery station to the customer's door) |
| **Departure** | One scheduled trip on a lane with a cutoff and a capacity. | `departure.Departure` | **Lane** (`node-topology`: the static connection a departure runs on) |
| **Pickup Departure** | The departure that collects packages at a vendor node at one of its declared cutoffs. | `departure.KindPickup` | **Cutoff** (the vendor's declared local time; the pickup departure is the network's trip generated from it) |
| **Departure Kind** | `PICKUP`, `LINEHAUL` or `AIR`. | `DepartureKind(PICKUP\|LINEHAUL\|AIR)` | **Lane Mode** (`GROUND\|AIR`, a property of the lane, not of one trip) |
| **Departure Times** | `cutoffAt`, `departsAt`, `arrivesAt`; `cutoffAt <= departsAt < arrivesAt`. | `Times{cutoffAt, departsAt, arrivesAt}` | **Nominal Transit** (the lane's planning figure in minutes) |
| **Capacity** | Packages a departure can carry, and how many are booked. Remaining = capacity − booked. | `Capacity{packages, booked}` | **Throughput Cap** (a node's declared orders per time unit) and **Promise Book** capacity (`delivery-promise`'s order ledger per pickup cutoff) |
| **Booking** | Counting one package against a departure's capacity. Done on `FulfillmentLocked` (policy `BookOnLock`). | `BookCapacity`, `ReleaseCapacity` | **Capacity Hold** (`delivery-promise`'s provisional reservation at promise time) |
| **Departure Cutoff** | The instant after which no booking is accepted on a departure (`ErrDepartureClosed`). | `Times.cutoffAt` | **Delivery Wave induct cutoff** (`last-mile-delivery`) |
| **Load** | The packages consolidated onto one departure. | `load.Load` | **Departure** (the trip and its capacity; a load is what is physically put on it) |
| **Lane Schedule** | The weekly template that generates a lane's departures. | `schedule.LaneSchedule` | **Departure** (one concrete trip generated from a template slot) |
| **Horizon** | The 14 days of departures kept ahead by the nightly roll (policy `HorizonRoll`). | `GenerateDepartures` | **Operating day** of a node (from its declared operating hours) |
| **Expected volume** | Which assignments and labelled packages are heading for which pickup departure. | read model `ExpectedVolumeView` | **Booked** (only locked assignments are booked) |

## Neighbour terms used here

| Term | Definition (owner) | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Node** | One physical building of the network, of exactly one node type (`node-topology`). | `node.Node` | **Node Operator** (who runs it: `NETWORK` or a `VENDOR`) |
| **Node Type** | `FULFILLMENT_CENTER`, `INBOUND_CROSS_DOCK`, `RETURNS_CENTER`, `SORTATION_CENTER`, `DELIVERY_STATION` or `AIR_HUB` (`node-topology`). | `node.Type` | **Departure Kind** |
| **Operational Profile** | The node's declared operating hours, cutoffs, handling time, throughput cap and time zone, versioned by `profileRevision` (`node-topology`). | `node.OperationalProfile` | **Scorecard** (`node-performance`: measured, not declared) |
| **Cutoff** | A local time by which a node declares packages are ready to be handed over; the network schedules one pickup departure per cutoff (`node-topology`). | `node.CutoffSlot` | **Departure Cutoff** (`cutoffAt` of any departure) |
| **Lane** | A directed, mode-specific connection between two nodes (`node-topology`). | `lane.Lane` | **Lane Schedule** |
| **Fulfillment Assignment** | The decision of which node and path fulfil one shipment group (`order-sourcing`). | `assignment.FulfillmentAssignment` | **Load** |
| **Path Lock** | The point after which an assignment never changes node: the vendor's acceptance (`order-sourcing`). | `assignment.Lock` | **Booking** (which follows the lock) |
| **Ship-By** | The pickup cutoff at the witness node the package must be ready for (`delivery-promise`). | `promise.PromiseTerms.ShipBy` | **Required Ship-By** (the same instant on the purchase order, `vendor-connectivity`) |
| **Witness Path** | The concrete node, pickup, departures and delivery wave that prove a promise is feasible (`delivery-promise`). | `promise.WitnessPath` | **Candidate** (`order-sourcing`'s possibly different path) |
| **Re-promise** | Revising a confirmed promise to a later window when its path is no longer feasible (`delivery-promise`). | `promise.Promise.Revise` | **Departure cancellation** (the fact that triggers it) |
| **Tracking Number** | The network-wide unique id of one package (`shipping-and-tracking`). | `journey.TrackingNumber` | `loadId` |
| **Shipping Label** | What is printed on the package; the only artefact outside `customer-ordering` that carries the address (`shipping-and-tracking`). This context sees only `LabelIssued` without any address. | `label.ShippingLabel` | **Load** |
| **Delivery Wave** | A station's dispatch slot: induct cutoff, delivery window and stop capacity (`last-mile-delivery`). | `wave.DeliveryWave` | **Departure** |
| **Induction** | Placing an arrived package into a wave (`last-mile-delivery`). | `wave.InductPackage` | `ReceiveLoad` (the arrival this context records) |

No fleet translation table: this context does not touch the
warehouse-systems fleet. The fleet calls the cutoff a vendor must meet the
CPT; that translation lives with `vendor-connectivity` and
[WMS/WES integration](/network/integration/wms-wes-integration).
