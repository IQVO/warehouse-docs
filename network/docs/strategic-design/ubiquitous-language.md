---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: "Every term of the retail-network domain, the context that owns it, and its code identifier; with the translation to the warehouse-systems fleet vocabulary."
---

# Ubiquitous Language

:::info[Generated from the model]
This page is generated from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
:::


Each term belongs to the context that owns its meaning. Where the same word
appears in two contexts with two meanings, both are listed. Code identifiers
are the proposed Go package and type names. Each context's own
[ubiquitous-language page](/network/contexts) adds usage notes.

| Term | Context | Definition | Code identifier |
| --- | --- | --- | --- |
| **Ack Window / ackBy** | `vendor-connectivity` | The deadline for the acknowledgement. | `po.PurchaseOrder.AckBy` |
| **Acknowledgement** | `vendor-connectivity` | The vendor's single, whole-order accept or reject. | `po.AckDecision` |
| **Availability Basis** | `offer-availability` | Why the node gave that number: PHYSICAL stock, THROUGHPUT_CONSTRAINED by its capacity before the next cutoff, or UNKNOWN. | `listing.Basis` |
| **Available Quantity** | `offer-availability` | What a node claims it can ship now for one listing. | `listing.Availability.AvailableQty` |
| **Capacity Hold** | `delivery-promise` | A provisional reservation on a promise book released if the order is not placed in time. | `book.Capacity.Provisional` |
| **Catalog Item** | `offer-availability` | The network's own entry for a product, independent of who ships it. | `catalog.Item` |
| **Checkout** | `customer-ordering` | The act of turning a cart into a customer order, promising every group. | `order.PlaceOrder` |
| **Customer Order** | `customer-ordering` | What the shopper bought, with a promise per shipment group. | `order.CustomerOrder` |
| **Cutoff** | `node-topology` | A local time by which a node declares packages are ready to be handed over; the network schedules one pickup departure per cutoff. | `node.CutoffSlot` |
| **Declared vs Measured** | `node-performance` | What a vendor says (profile) against what the network observes (scorecard). | `(principle)` |
| **Deliver-By Window** | `delivery-promise` | deliverByEarliest..deliverByLatest shown to the customer. | `promise.PromiseTerms` |
| **Delivery Attempt** | `last-mile-delivery` | One try to hand a package over: DELIVERED or FAILED with a reason. | `route.Attempt` |
| **Delivery Offer** | `delivery-promise` | A quoted delivery window for an item, quantity, destination and tier, valid until it expires. | `offer.DeliveryOffer` |
| **Delivery Service Partner (DSP)** | `last-mile-delivery` | An independent delivery business working for a station. | `partner.DeliveryServicePartner` |
| **Delivery Wave** | `last-mile-delivery` | A station's dispatch slot: induct cutoff, delivery window and stop capacity. | `wave.DeliveryWave` |
| **Departure** | `linehaul-transportation` | One scheduled trip on a lane with a cutoff and a capacity. | `departure.Departure` |
| **Fulfillment Assignment** | `order-sourcing` | The decision of which node and path fulfil one shipment group. | `assignment.FulfillmentAssignment` |
| **Full Feed** | `offer-availability` | A feed that is the complete truth for its node; omitted listings become zero. | `feed.InventoryFeed.FullUpdate` |
| **Grade** | `node-performance` | A, B, C or D; PROVISIONAL below the observation minimum. | `scorecard.Grade` |
| **Handicap** | `delivery-promise` | The scorecard-driven delay applied to a node's shipBy. | `promise.ScorecardHandicap` |
| **Handling Time** | `node-topology` | Declared time from order release to a package ready for handover. | `node.OperationalProfile.HandlingTime` |
| **Handover** | `shipping-and-tracking` | The instant a vendor node's package enters the network. | `journey.HandedOver` |
| **Induction** | `last-mile-delivery` | Placing an arrived package into a wave. | `wave.InductPackage` |
| **Inventory Feed** | `offer-availability` | One vendor submission of availability for one node, full or partial. | `feed.InventoryFeed` |
| **Label** | `vendor-connectivity` | labelRef + trackingNumber + carrier; never the address. | `po.Label` |
| **Lane** | `node-topology` | A directed, mode-specific connection between two nodes. | `lane.Lane` |
| **Lane Schedule** | `linehaul-transportation` | The weekly template that generates a lane's departures. | `schedule.LaneSchedule` |
| **Last Mile** | `last-mile-delivery` | From the delivery station to the customer's door. | `(context)` |
| **Late Ack Rate** | `node-performance` | Share of purchase orders acknowledged in the last 10% of the window or expired. | `scorecard.Metrics.LateAckRate` |
| **Listing** | `offer-availability` | A catalogue item offered from one node. | `listing.Listing` |
| **Load** | `linehaul-transportation` | The packages consolidated onto one departure. | `load.Load` |
| **Middle Mile** | `linehaul-transportation` | Transport between nodes: vendor node to sortation centre, sortation centre to delivery station, air. | `(context)` |
| **Node** | `node-topology` | One physical building of the network, of exactly one node type. | `node.Node` |
| **Node Operator** | `node-topology` | Who runs the building: NETWORK or a VENDOR. | `node.Operator` |
| **Node Type** | `node-topology` | FULFILLMENT_CENTER, INBOUND_CROSS_DOCK, RETURNS_CENTER, SORTATION_CENTER, DELIVERY_STATION or AIR_HUB. | `node.Type` |
| **On-Time Handover Rate** | `node-performance` | Share of packages handed over before requiredShipBy. | `scorecard.Metrics.OnTimeHandoverRate` |
| **Operational Profile** | `node-topology` | The node's declared operating hours, cutoffs, handling time, throughput cap and time zone, versioned by profileRevision. | `node.OperationalProfile` |
| **Package Journey** | `shipping-and-tracking` | The customer-visible timeline of one package. | `journey.PackageJourney` |
| **Path Lock** | `order-sourcing` | The point after which an assignment never changes node: the vendor's acceptance. | `assignment.Lock` |
| **Pickup Departure** | `linehaul-transportation` | The departure that collects packages at a vendor node at one of its declared cutoffs. | `departure.KindPickup` |
| **Promise** | `delivery-promise` | The network's commitment of a delivery window for one shipment group. | `promise.Promise` |
| **Promise Basis** | `delivery-promise` | SCHEDULED (from real departures and waves) or NOMINAL (STANDARD tier from nominal lane times). | `promise.Basis` |
| **Promise Book** | `delivery-promise` | Capacity ledger of one node pickup cutoff on the promise side. | `book.PromiseBook` |
| **Promise Kept / Broken** | `delivery-promise` | The judgement at delivery against deliverByLatest. | `promise.Judgement` |
| **Purchase Order (PO)** | `vendor-connectivity` | The instruction to one vendor node to ship one shipment group in full by requiredShipBy. | `po.PurchaseOrder` |
| **Re-promise** | `delivery-promise` | Revising a confirmed promise to a later window when its path is no longer feasible. | `promise.Promise.Revise` |
| **Reassignment** | `order-sourcing` | Moving a group to another node after a refusal, or while still queued. | `assignment.Reassign` |
| **Region** | `node-topology` | A largely self-sufficient partition of the network. | `region.Region` |
| **Release (to node)** | `order-sourcing` | Sending a group to one node; for a vendor node this issues a purchase order. | `assignment.Release` |
| **Required Ship-By** | `vendor-connectivity` | The pickup cutoff the PO must be ready for; the fleet calls it the CPT. | `po.PurchaseOrder.RequiredShipBy` |
| **Route** | `last-mile-delivery` | One van's ordered stops in one wave. | `route.Route` |
| **Scan** | `shipping-and-tracking` | One observation of a package at a node. | `journey.Scan` |
| **Scorecard** | `node-performance` | A node's measured performance over a rolling window, with a grade. | `scorecard.NodeScorecard` |
| **Service Area** | `node-topology` | The postal prefixes one delivery station serves. | `servicearea.ServiceArea` |
| **Service Tier** | `delivery-promise` | SAME_DAY, NEXT_DAY, TWO_DAY or STANDARD. | `promise.Tier` |
| **Ship-By** | `delivery-promise` | The pickup cutoff at the witness node the package must be ready for. | `promise.PromiseTerms.ShipBy` |
| **Ship-To** | `customer-ordering` | The delivery address; synthetic PII held only here. | `order.ShipTo` |
| **Shipment Group** | `delivery-promise` | The lines of an order promised and shipped together from one node. | `promise.ShipmentGroup` |
| **Shipping Label** | `shipping-and-tracking` | What is printed on the package; the only artefact outside customer-ordering that carries the address. | `label.ShippingLabel` |
| **Shopper** | `customer-ordering` | The (synthetic) customer placing orders. | `shopper.Shopper` |
| **Submission / Transaction** | `vendor-connectivity` | An asynchronous vendor write and its outcome, reconciled by transactionId. | `submission.Submission` |
| **Throughput Cap** | `node-topology` | Declared maximum orders per time unit a node accepts. | `node.ThroughputCap` |
| **Tracking Number** | `shipping-and-tracking` | The network-wide unique id of one package. | `journey.TrackingNumber` |
| **Unsourceable** | `order-sourcing` | No node can still meet the promise; the group goes back to delivery-promise. | `assignment.StateUnsourceable` |
| **Vendor** | `vendor-connectivity` | An organisation operating fulfillment nodes for the network (the warehouse-systems fleet is vendor V-WS). | `vendor.VendorAccount` |
| **Vendor API** | `vendor-connectivity` | The Open Host Service of this context; its JSON schemas are the Published Language. | `apis/vendor-connectivity/openapi.yaml` |
| **Virtual Queue** | `order-sourcing` | Where assignments wait, re-optimisable, until their release point. | `assignment.VirtualQueue` |
| **Witness Path** | `delivery-promise` | The concrete node, pickup, departures and delivery wave that prove a promise is feasible; order-sourcing may choose a different path later. | `promise.WitnessPath` |

## Node types

| Node type | Operator | Capabilities | Meaning |
| --- | --- | --- | --- |
| `FULFILLMENT_CENTER` | VENDOR | OUTBOUND | Stores sellable inventory, picks, packs and hands packages to the network at a pickup departure. |
| `INBOUND_CROSS_DOCK` | VENDOR | INBOUND | Receives bulk inbound and pushes it into fulfillment centres. Never a ship-from node for customer orders. |
| `RETURNS_CENTER` | VENDOR | RETURNS | The return location a customer return is routed to. |
| `SORTATION_CENTER` | NETWORK | SORT | Sorts packages by final destination and consolidates them onto outbound loads. |
| `DELIVERY_STATION` | NETWORK | LAST_MILE | Receives sorted packages and dispatches them on delivery routes inside its service area. |
| `AIR_HUB` | NETWORK | SORT, AIR | Gateway between the ground network and air lanes. |

## Service tiers

| Tier | Max calendar days | May use nominal lane times |
| --- | --- | --- |
| `SAME_DAY` | 0 | no |
| `NEXT_DAY` | 1 | no |
| `TWO_DAY` | 2 | no |
| `STANDARD` | 7 | yes (basis NOMINAL) |

## Translation to the warehouse-systems fleet

The two organizations deliberately use different words. The translation
happens in exactly one place: the fleet's `network-fulfillment`
Anti-Corruption Layer (its `internal/adapters/outbound/network/` package
today, renamed `outbound/retailnetwork/` by its ADR 0009). Fleet terms below
are read from `IQVO/network-fulfillment`, `IQVO/order-management` and
`IQVO/facility-layout` on `origin/develop`.

| retail-network term | warehouse-systems term | Note |
| --- | --- | --- |
| Vendor V-WS | the fleet | one vendor among many |
| Node (`nodeId`) | Site (`siteCode`) | mapping persisted in `network-fulfillment`, never a string convention |
| `vendorNodeCode` | `siteCode` | what the fleet sends when it registers a node |
| Node type `FULFILLMENT_CENTER` + subtype | `siteRole` (facility-layout ADR 0037) | see [Node model](/network/network-model/node-model) |
| Cutoff / pickup departure | CPT (`CPTSchedule`, process-path-management ADR 0010) | the fleet's CPT **is** the network's pickup cutoff at that node |
| Handling Time | `cycleTimeP95` of the eligible path | declared from the fleet's own number |
| Throughput Cap / cutoff `maxOrders` | remaining path capacity (`PathCapacityChanged`) | |
| Listing availability + basis | `CapabilityOffer{advertisedQuantity, basis}` | `PHYSICAL` / `THROUGHPUT_CONSTRAINED` exist on both sides |
| Purchase Order (`poNumber`) | `NetworkOrder` (`NetworkRef`) | |
| Required Ship-By | `requiredShipBy`, checked by OM `FeasibleBy` | |
| Acknowledgement accept / reject | `SubmitAcknowledgement(accepted)` | fill-or-kill on both sides |
| `CANNOT_MEET_SHIP_BY` | `INFEASIBLE_DEADLINE` | reject reason |
| `UNKNOWN_LISTING` | `UNTRANSLATABLE_SKU` | reject reason |
| Purchase order `EXPIRED` | `ACKNOWLEDGEMENT_DEADLINE_MISSED` | |
| Transaction (`transactionId`) | `SubmissionStatus` | pending until reconciled |
| Label (`labelRef`, `trackingNumber`) | `LabelResult` | no address on either side of the seam |
| Promise / deliver-by window | (none) | the fleet never sees the delivery promise; it sees only `requiredShipBy` |

