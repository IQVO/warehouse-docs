---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: The terms Delivery Promise speaks, each with its proposed code identifier and the term it is most often confused with.
---

# Ubiquitous Language

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

The first table is this context's own language
(`contexts[delivery-promise].ul`). The second lists the neighbour terms this
context reads from its event-fed read models; they keep the neighbour's
meaning and code identifier. The domain-wide glossary is on
[the ubiquitous language page](/network/strategic-design/ubiquitous-language).

## This context's terms

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Delivery Offer** | A quoted delivery window for an item, quantity, destination and tier, valid until it expires. | `offer.DeliveryOffer` | **Promise**: an offer commits nothing and holds no capacity. **Listing** (`offer-availability`): what can be sold from a node, not when it arrives. |
| **Service Tier** | `SAME_DAY`, `NEXT_DAY`, `TWO_DAY` or `STANDARD`. | `promise.Tier` | A **Delivery Wave** window. The tier bounds the calendar days; the wave gives the hours. |
| **Promise** | The network's commitment of a delivery window for one shipment group. | `promise.Promise` | **Fulfillment Assignment** (`order-sourcing`): which node actually ships. A promise names a witness, not an assignment. |
| **Ship-By** | The pickup cutoff at the witness node the package must be ready for. | `promise.PromiseTerms.ShipBy` | **Required Ship-By** (`vendor-connectivity`): the cutoff on a purchase order to the node that was actually assigned. |
| **Deliver-By Window** | `deliverByEarliest`..`deliverByLatest` shown to the customer. | `promise.PromiseTerms` | **DeliveryWindow** of an offer (`earliest`, `latest`): the same shape before it becomes a promise. |
| **Witness Path** | The concrete node, pickup, departures and delivery wave that prove a promise is feasible; `order-sourcing` may choose a different path later. | `promise.WitnessPath` | **Candidate** (`order-sourcing`): a path being optimised for cost. The witness is proof, not a plan. |
| **Promise Basis** | `SCHEDULED` (from real departures and waves) or `NOMINAL` (`STANDARD` tier from nominal lane times). | `promise.Basis` | **Availability Basis** (`offer-availability`): `PHYSICAL` / `THROUGHPUT_CONSTRAINED` / `UNKNOWN`, about quantity, not time. |
| **Promise Book** | Capacity ledger of one node pickup cutoff on the promise side. | `book.PromiseBook` | **Departure capacity** (`linehaul-transportation`): packages booked on a truck. The book counts orders promised against the node's declared share. |
| **Capacity Hold** | A provisional reservation on a promise book released if the order is not placed in time. | `book.Capacity.Provisional` | A confirmed count (`book.Capacity.Confirmed`), which only a placed order creates. |
| **Handicap** | The scorecard-driven delay applied to a node's ship-by. | `promise.ScorecardHandicap` | **Grade** (`node-performance`): the measurement. The handicap is this context's reaction to it. |
| **Re-promise** | Revising a confirmed promise to a later window when its path is no longer feasible. | `promise.Promise.Revise` | **Reassignment** (`order-sourcing`): moving the group to another node without changing the window. |
| **Promise Kept / Broken** | The judgement at delivery against `deliverByLatest`. | `promise.Judgement` | **Delivery Attempt** outcome (`last-mile-delivery`): one try at the door, not the judgement. |
| **Shipment Group** | The lines of an order promised and shipped together from one node. | `promise.ShipmentGroup` | **Load** (`linehaul-transportation`): packages on one departure, from many orders. |

### Names used in this pack that come straight from the model

These are aggregate, value-object, enumeration and policy names rather than
`ul` entries. They are listed so a reader can find them.

| Name | Meaning | Code identifier |
| --- | --- | --- |
| `OfferConstraint` | Why a tier has no offer: `DESTINATION_NOT_SERVED`, `ITEM_QUANTITY_NOT_AVAILABLE`, `DELIVERY_SLA_UNAVAILABLE`, `NODE_CAPACITY_EXHAUSTED`. | `offer.OfferConstraint` |
| `DeliveryWindow` | `{earliest, latest}` of an offer. | `offer.DeliveryWindow` |
| `PromiseTerms` | `{tier, shipBy, deliverByEarliest, deliverByLatest, basis, policyVersion}`. | `promise.PromiseTerms` |
| `Revision` | `{revisionNo, previousTerms, reason, revisedAt}`, one per re-promise. | `promise.Revision` |
| `Capacity` | `{share, provisional, confirmed}` of a book. | `book.Capacity` |
| Hold expiry | `holdExpiresAt`: the instant a provisional promise is released if no order confirmed it. | `promise.Promise` field, published on `PromiseMade` |
| Policy version | `policyVersion`: which version of the promise policies produced the terms. | `promise.PromiseTerms` field |
| `PromisePolicy` | Earliest feasible witness path. | `promise.PromisePolicy` (proposed) |
| `TierOrderDeadline` | Per tier and region, a policy-versioned local order deadline (peak control of new workable demand). | `promise.TierOrderDeadline` (proposed) |
| `ShipmentGrouping` | Prefer one node for the whole cart; split only when no single node covers every line, minimising the number of groups. | `promise.ShipmentGrouping` (proposed) |
| `RepromiseOnRisk` | Recompute and revise when the path breaks. | `promise.RepromiseOnRisk` (proposed) |
| `JudgeOnDelivery` | Judge every promise of the delivered package's group. | `promise.JudgeOnDelivery` (proposed) |

## Neighbour terms this context uses

| Term | Definition (owner's) | Code identifier | Owner | Not to be confused with |
| --- | --- | --- | --- | --- |
| **Node** | One physical building of the network, of exactly one node type. | `node.Node` | `node-topology` | The witness node: the one node a promise names. |
| **Node Type** | `FULFILLMENT_CENTER`, `INBOUND_CROSS_DOCK`, `RETURNS_CENTER`, `SORTATION_CENTER`, `DELIVERY_STATION` or `AIR_HUB`. | `node.Type` | `node-topology` | Node subtype (`SUB_SAME_DAY`, `MICRO`, ...), which gates `SAME_DAY`. |
| **Operational Profile** | The node's declared operating hours, cutoffs, handling time, throughput cap and time zone, versioned by `profileRevision`. | `node.OperationalProfile` | `node-topology` | The scorecard: declared vs measured. |
| **Cutoff** | A local time by which a node declares packages are ready to be handed over; the network schedules one pickup departure per cutoff. | `node.CutoffSlot` | `node-topology` | **Ship-By**: one concrete cutoff instant chosen for one promise. |
| **Handling Time** | Declared time from order release to a package ready for handover. | `node.OperationalProfile.HandlingTime` | `node-topology` | The handicap, which is added on top of it. |
| **Throughput Cap** | Declared maximum orders per time unit a node accepts. | `node.ThroughputCap` | `node-topology` | A book's `share`, which this context derives per cutoff. |
| **Lane** | A directed, mode-specific connection between two nodes. | `lane.Lane` | `node-topology` | **Departure**: one scheduled trip on a lane. |
| **Region** | A largely self-sufficient partition of the network. | `region.Region` | `node-topology` | Service area. |
| **Service Area** | The postal prefixes one delivery station serves. | `servicearea.ServiceArea` | `node-topology` | Destination postal prefix: the key this context looks up in it. |
| **Catalog Item** | The network's own entry for a product, independent of who ships it. | `catalog.Item` | `offer-availability` | Listing. |
| **Listing** | A catalogue item offered from one node. | `listing.Listing` | `offer-availability` | Delivery Offer. |
| **Available Quantity** | What a node claims it can ship now for one listing. | `listing.Availability.AvailableQty` | `offer-availability` | Book capacity: orders, not units. |
| **Availability Basis** | `PHYSICAL`, `THROUGHPUT_CONSTRAINED` or `UNKNOWN`. | `listing.Basis` | `offer-availability` | Promise Basis. |
| **Departure** | One scheduled trip on a lane with a cutoff and a capacity. | `departure.Departure` | `linehaul-transportation` | Lane. |
| **Pickup Departure** | The departure that collects packages at a vendor node at one of its declared cutoffs. | `departure.KindPickup` | `linehaul-transportation` | The book: a book is keyed by `nodeId` and the pickup departure's id. |
| **Delivery Wave** | A station's dispatch slot: induct cutoff, delivery window and stop capacity. | `wave.DeliveryWave` | `last-mile-delivery` | Deliver-By Window: the wave's window becomes the promise window. |
| **Scorecard** | A node's measured performance over a rolling window, with a grade. | `scorecard.NodeScorecard` | `node-performance` | Handicap. |
| **Grade** | `A`, `B`, `C` or `D`; `PROVISIONAL` below the observation minimum. | `scorecard.Grade` | `node-performance` | — |
| **Customer Order** | What the shopper bought, with a promise per shipment group. | `order.CustomerOrder` | `customer-ordering` | Promise. |
| **Checkout** | The act of turning a cart into a customer order, promising every group. | `order.PlaceOrder` | `customer-ordering` | `MakePromise`, which checkout calls once per group. |
| **Fulfillment Assignment** | The decision of which node and path fulfil one shipment group. | `assignment.FulfillmentAssignment` | `order-sourcing` | Witness Path. |
| **Path Lock** | The point after which an assignment never changes node: the vendor's acceptance. | `assignment.Lock` | `order-sourcing` | Promise confirmation, which happens at order placement. |
| **Unsourceable** | No node can still meet the promise; the group goes back to `delivery-promise`. | `assignment.StateUnsourceable` | `order-sourcing` | `PromiseBroken`, which only judgement raises. |
| **Package Journey** | The customer-visible timeline of one package. | `journey.PackageJourney` | `shipping-and-tracking` | — |
| **Tracking Number** | The network-wide unique id of one package. | `journey.TrackingNumber` | `shipping-and-tracking` | — |

## Fleet translation

None. This context never touches the warehouse-systems fleet: it consumes no
`warehouse.*` topic, calls no fleet service, and is not reached by the Vendor
API. The fleet's own words (CPT, process path) meet the network only in
`vendor-connectivity` and `node-topology`; see
[the WMS/WES integration page](/network/integration/wms-wes-integration) for the
canonical translation table.
