---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: The terms Customer Ordering speaks, each mapped to its proposed code identifier, plus the neighbour terms it uses and the terms most often confused with them.
---

# Ubiquitous Language

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

The terms this context speaks, each mapped to the identifier a future
implementation must use. The first table is the context's own `ul` list in
`model.yaml`. The second holds the model elements of its aggregates. The
third holds neighbour terms this context uses but does not own; their
definitions come from the owning context's `ul` list. The network-wide
glossary is [Ubiquitous Language](/network/strategic-design/ubiquitous-language).

## Own terms

Derived from: `model.yaml → contexts[customer-ordering].ul`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Shopper** | The (synthetic) customer placing orders. | `shopper.Shopper` | **Vendor** (`vendor-connectivity`): the organisation that operates a fulfillment node. A shopper never meets a vendor. |
| **Customer Order** | What the shopper bought, with a promise per shipment group. | `order.CustomerOrder` | **Purchase Order** (`vendor-connectivity`): the instruction to one vendor node for one shipment group. One customer order can lead to several purchase orders, and a purchase order never names the shopper. |
| **Ship-To** | The delivery address; synthetic PII held only here. | `order.ShipTo` | **Destination postal prefix**: the only part of the address that leaves this context in an event. **Label** (`vendor-connectivity`, `shipping-and-tracking`): what the vendor gets back, `labelRef` + `trackingNumber` + `carrier`, never the address. |
| **Checkout** | The act of turning a cart into a customer order, promising every group. | `order.PlaceOrder` | **Quote**: asking `delivery-promise` for offers. A quote holds no capacity; checkout makes promises, which do. |

## Model elements of this context

Derived from: `model.yaml → contexts[customer-ordering].aggregates[*]` (`value_objects`, `states`, `commands`), `read_models`, `policies`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Order Line** | One catalogue item and quantity of an order, numbered `lineNo`. | `order.OrderLine{lineNo, catalogItemId, quantity}` | **PO line** (`vendor-connectivity` `PoLine`), which names a `listingId`, a node-specific offer. |
| **Group Promise** | The order's copy of one shipment group's promise: `groupNo`, `promiseId`, the deliver-by window and the `lineNos` it covers. | `order.GroupPromise` | **Promise** (`delivery-promise`): the authoritative commitment. This is a snapshot, refreshed by `UpdateGroupPromise` on `PromiseRevised`. |
| **Order status** | The customer-facing state: `PLACED`, `IN_FULFILLMENT`, `PARTIALLY_SHIPPED`, `SHIPPED`, `DELIVERED`, `CANCELLED`. | `order.CustomerOrder` states | **Assignment state** (`order-sourcing`: `QUEUED`, `RELEASED`, `LOCKED` …) and **promise state** (`delivery-promise`). The order status is a summary for the shopper, not a copy of either. |
| **Destination postal prefix** | The part of the ship-to postal code that `delivery-promise` quotes against and that `CustomerOrderPlaced` carries. | `destinationPostalPrefix` | **Service Area** (`node-topology`): the mapping from a postal prefix to a delivery station. This context never resolves it. |
| **Order Tracking View** | The event-fed read model behind `GET /orders/{orderId}/tracking`. | `OrderTrackingView` | **Package Journey** (`shipping-and-tracking`): the authoritative timeline of one package. The view combines journeys, assignments and promises per order. |
| **Checkout Promising** | Policy: for each shipment group call `MakePromise` with the offer the shopper saw; if the offer expired, re-quote and show the new window before placing. | `CheckoutPromising` | **Re-promise** (`delivery-promise`): revising a confirmed promise later. Checkout never revises. |
| **Cancel On Unfulfillable** | Policy: when a group is unsourceable and no revised promise is feasible, cancel the group, and the order if nothing remains. | `CancelOnUnfulfillable` | **Customer cancellation** (`CancelOrder` from `POST /orders/{orderId}:cancel`), which the shopper asks for. |

## Neighbour terms this context uses

| Term | Definition (owner's) | Code identifier (owner) | Not to be confused with |
| --- | --- | --- | --- |
| **Delivery Offer** | A quoted delivery window for an item, quantity, destination and tier, valid until it expires. | `offer.DeliveryOffer` (`delivery-promise`) | **Promise**: an offer holds no capacity and expires; checkout consumes it into a promise. |
| **Promise** | The network's commitment of a delivery window for one shipment group. | `promise.Promise` (`delivery-promise`) | **Group Promise**, this context's snapshot of it. |
| **Shipment Group** | The lines of an order promised and shipped together from one node. | `promise.ShipmentGroup` (`delivery-promise`) | **Package**: a group can ship as several packages (several tracking numbers). |
| **Service Tier** | `SAME_DAY`, `NEXT_DAY`, `TWO_DAY` or `STANDARD`. | `promise.Tier` (`delivery-promise`) | Carrier service levels; the label carries the tier, not a carrier product. |
| **Ship-By** | The pickup cutoff at the witness node the package must be ready for. | `promise.PromiseTerms.ShipBy` (`delivery-promise`) | **Deliver-By Window**, which is what the shopper sees. |
| **Deliver-By Window** | `deliverByEarliest..deliverByLatest` shown to the customer. | `promise.PromiseTerms` (`delivery-promise`) | Ship-By. |
| **Witness Path** | The concrete node, pickup, departures and delivery wave that prove a promise is feasible; `order-sourcing` may choose a different path later. | `promise.WitnessPath` (`delivery-promise`) | The node that actually ships: `CustomerOrderPlaced` carries `witnessNodeId`, but the shipping node is the one in `FulfillmentLocked`. |
| **Capacity Hold** | A provisional reservation on a promise book released if the order is not placed in time. | `book.Capacity.Provisional` (`delivery-promise`) | A placed order: the hold becomes confirmed only when `delivery-promise` consumes `CustomerOrderPlaced`. |
| **Re-promise** | Revising a confirmed promise to a later window when its path is no longer feasible. | `promise.Promise.Revise` (`delivery-promise`) | A new checkout. |
| **Promise Kept / Broken** | The judgement at delivery against `deliverByLatest`. | `promise.Judgement` (`delivery-promise`) | Delivered: an order is `DELIVERED` on `PackageDelivered`; kept or broken is a separate verdict. |
| **Fulfillment Assignment** | The decision of which node and path fulfil one shipment group. | `assignment.FulfillmentAssignment` (`order-sourcing`) | The customer order; one assignment per group. |
| **Path Lock** | The point after which an assignment never changes node: the vendor's acceptance. | `assignment.Lock` (`order-sourcing`) | Order placement. The lock is what ends customer cancellation here. |
| **Unsourceable** | No node can still meet the promise; the group goes back to `delivery-promise`. | `assignment.StateUnsourceable` (`order-sourcing`) | Cancelled: an unsourceable group can be re-promised and re-queued. |
| **Tracking Number** | The network-wide unique id of one package. | `journey.TrackingNumber` (`shipping-and-tracking`) | `orderId` or `promiseId`. |
| **Shipping Label** | What is printed on the package; the only artefact outside customer-ordering that carries the address. | `label.ShippingLabel` (`shipping-and-tracking`) | The Ship-To value object it is printed from. |
| **Package Journey** | The customer-visible timeline of one package. | `journey.PackageJourney` (`shipping-and-tracking`) | Order Tracking View. |
| **Scan** | One observation of a package at a node. | `journey.Scan` (`shipping-and-tracking`) | A status change of the order. |
| **Catalog Item** | The network's own entry for a product, independent of who ships it. | `catalog.Item` (`offer-availability`) | **Listing**, a catalogue item offered from one node. Order lines name catalogue items only. |

## Fleet translation

None. Customer Ordering never touches the warehouse-systems fleet. Only
`vendor-connectivity` and `node-topology` do; see
[WMS/WES integration](/network/integration/wms-wes-integration).
