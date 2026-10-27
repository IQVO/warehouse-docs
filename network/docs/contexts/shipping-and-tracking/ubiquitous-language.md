---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: "The terms Shipping & Tracking speaks, their proposed code identifiers, and the neighbour terms they must not be confused with."
---

# Ubiquitous Language

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

Every term this context speaks, mapped to the code identifier an
implementation must use. The first table is the context's own `ul` list in
`model.yaml`. The second holds names that appear elsewhere in this context's
model entry (aggregates, states, policies, event data). The third holds the
neighbour terms these pages use, with the neighbour that owns them. The
domain-wide glossary is at
[Ubiquitous Language](/network/strategic-design/ubiquitous-language).

## Terms of this context

Derived from: `model.yaml → contexts[shipping-and-tracking].ul`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Tracking Number** | The network-wide unique id of one package. | `journey.TrackingNumber` | `labelRef` (the label's id) and `poNumber` (the vendor instruction, which may cover several packages) |
| **Shipping Label** | What is printed on the package; the only artefact outside `customer-ordering` that carries the address. | `label.ShippingLabel` | The Vendor API **Label** (`po.Label`), which is only `labelRef + trackingNumber + carrier` and never the address |
| **Package Journey** | The customer-visible timeline of one package. | `journey.PackageJourney` | `customer-ordering`'s `OrderTrackingView`, a read model per order fed by this context's events |
| **Scan** | One observation of a package at a node. | `journey.Scan` | A **Delivery Attempt** (`route.Attempt`), which is a last-mile fact this context turns into a scan |
| **Handover** | The instant a vendor node's package enters the network. | `journey.HandedOver` | `VendorShipmentConfirmed`, the vendor's own statement that it shipped. Handover is the network's observation (`HandoverOnFirstScan`) |

## Other names in this context's model

Derived from: `model.yaml → contexts[shipping-and-tracking].aggregates`,
`.policies`, `.publishes`, `.read_models`. Code identifiers in this table are
proposed (the model names the concept, not the Go identifier).

| Term | Definition | Code identifier (proposed) | Not to be confused with |
| --- | --- | --- | --- |
| **Label Ref** | The identity of one `ShippingLabel`. | `label.LabelRef` | `trackingNumber` |
| **Package No** | The number of a package within one purchase order; `(poNumber, packageNo)` has at most one label. | `label.PackageNo` | `lineNo` of a purchase-order line |
| **Ship-to snapshot** | The encrypted copy of the address taken from `customer-ordering` at issue time, kept only to print the label. Never published, never returned. | `label.ShipToSnapshot` | **Ship-To** (`order.ShipTo`), the source of truth in `customer-ordering` |
| **Carrier** | Who carries the package, as printed on the label and published on `LabelIssued`. | `label.Carrier` | A **Delivery Service Partner** (`partner.DeliveryServicePartner`) in last-mile |
| **Label status** | `ISSUED` or `VOIDED`. | `label.Status` | Journey state |
| **Void** | Cancel an issued label (`VoidLabel`, event `LabelVoided`). | `label.ShippingLabel.Void` | Purchase-order cancellation in `vendor-connectivity` |
| **Journey state** | `LABELLED`, `HANDED_OVER`, `IN_TRANSIT`, `AT_STATION`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RETURNED`, `LOST`. | `journey.State` | Customer order status in `customer-ordering` (`PLACED` ... `DELIVERED`) |
| **Scan type** | The kind of observation a scan records. The model does not enumerate the values; these pages use the name of the source fact. | `journey.ScanType` | `DepartureKind` (`PICKUP`, `LINEHAUL`, `AIR`) in linehaul |
| **Applied scan** | A scan that moved the journey. An out-of-order scan is stored but not applied. | `journey.Scan.Applied` | A duplicate scan, which is refused |
| **Package exception** | A raised problem with a package (`RaiseException`, event `PackageExceptionRaised`). The model names one reason: `NO_SCAN`. | `journey.Exception` | A failed delivery attempt, which only returns the journey to `AT_STATION` |
| **Silence** | No scan within the expected leg time plus a tolerance (`ExceptionOnSilence`). | `journey.ExceptionOnSilence` | Node lateness scored by `node-performance` |
| **Return to sender** | End the journey as `RETURNED` from `AT_STATION`. | `journey.PackageJourney.ReturnToSender` | A customer return (future `customer-returns`) |
| **Lost** | End the journey as `LOST` from `IN_TRANSIT`. | `journey.PackageJourney.DeclareLost` | An exception, which keeps the journey open |
| **Catalog dimensions view** | Local, event-fed copy of catalogue dimensions, weight and handling flags. | `readmodel.CatalogDimensionsView` | The `CatalogItem` aggregate in `offer-availability` |

## Neighbour terms used here

Derived from: `model.yaml → contexts[*].ul` of the named owner.

| Term | Definition (owner's) | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Purchase Order (PO)** (`vendor-connectivity`) | The instruction to one vendor node to ship one shipment group in full by `requiredShipBy`. | `po.PurchaseOrder` | The customer order |
| **Label** (`vendor-connectivity`) | `labelRef + trackingNumber + carrier`; never the address. | `po.Label` | **Shipping Label** (this context), which holds the encrypted address |
| **Required Ship-By** (`vendor-connectivity`) | The pickup cutoff the PO must be ready for. | `po.PurchaseOrder.RequiredShipBy` | Handover, the instant the package actually left |
| **Vendor API** (`vendor-connectivity`) | The Open Host Service of `vendor-connectivity`; its JSON schemas are the Published Language. | `apis/vendor-connectivity/openapi.yaml` | This context's in-org REST API |
| **Ship-To** (`customer-ordering`) | The delivery address; synthetic PII held only in `customer-ordering`. | `order.ShipTo` | Ship-to snapshot |
| **Customer Order** (`customer-ordering`) | What the shopper bought, with a promise per shipment group. | `order.CustomerOrder` | A package (one order can have many) |
| **Load** (`linehaul-transportation`) | The packages consolidated onto one departure. | `load.Load` | A scan (one load event becomes one scan per tracking number) |
| **Pickup Departure** (`linehaul-transportation`) | The departure that collects packages at a vendor node at one of its declared cutoffs. | `departure.KindPickup` | Handover (the scan of that departure) |
| **Route** (`last-mile-delivery`) | One van's ordered stops in one wave. | `route.Route` | A journey |
| **Delivery Attempt** (`last-mile-delivery`) | One try to hand a package over: `DELIVERED` or `FAILED` with a reason. | `route.Attempt` | `DELIVERED` journey state, which is entered only on a successful attempt |
| **Catalog Item** (`offer-availability`) | The network's own entry for a product, independent of who ships it. | `catalog.Item` | A package |
| **Service Tier** (`delivery-promise`) | `SAME_DAY`, `NEXT_DAY`, `TWO_DAY` or `STANDARD`. | `promise.Tier` | Carrier |
| **Promise Kept / Broken** (`delivery-promise`) | The judgement at delivery against `deliverByLatest`. | `promise.Judgement` | `PackageDelivered`, the fact the judgement uses |
| **Fulfillment Assignment** (`order-sourcing`) | The decision of which node and path fulfil one shipment group. | `assignment.FulfillmentAssignment` | A purchase order (one release of an assignment to a vendor node) |
| **Node** (`node-topology`) | One physical building of the network, of exactly one node type. | `node.Node` | A scan location (a scan names a `nodeId`) |
| **On-Time Handover Rate** (`node-performance`) | Share of packages handed over before `requiredShipBy`. | `scorecard.Metrics.OnTimeHandoverRate` | Handover itself, which this context only reports |

This context does not touch the warehouse-systems fleet, so there is no
fleet translation table here. See
[WMS/WES integration](/network/integration/wms-wes-integration) for the one owned by
`vendor-connectivity`.
