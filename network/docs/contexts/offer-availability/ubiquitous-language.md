---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: "The terms Offer & Availability speaks, each mapped to the proposed code identifier, plus the neighbour terms it uses."
---

# Ubiquitous Language

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

The terms this context speaks. The first table is the context's own `ul`
list in `model.yaml` (`contexts[offer-availability].ul`), plus the states,
value objects and policies of its aggregates. The second table holds the
neighbour terms this context uses. For the six `ul` terms (Catalog Item,
Listing, Available Quantity, Availability Basis, Inventory Feed, Full Feed)
and for every neighbour term, the code identifier is the one `model.yaml`
gives. For the other rows it is a proposed Go name, following the same
package names. The domain-wide glossary is
[Ubiquitous Language](/network/strategic-design/ubiquitous-language).

## This context's terms

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Catalog Item** | The network's own entry for a product, independent of who ships it: title, dimensions, weight, handling flags. | `catalog.Item` | A **Listing** (the item offered from one node). A vendor's own SKU, which never appears here; vendors refer to the item by `listingId`. |
| **Listing** | A catalogue item offered from one node. One per (`catalogItemId`, `nodeId`). | `listing.Listing` | A **Catalog Item**. A **Delivery Offer** (`delivery-promise`), which is a quote with a delivery window. |
| **Available Quantity** | What a node claims it can ship now for one listing. Never negative. | `listing.Availability.AvailableQty` | Capacity held on a **Promise Book** (`delivery-promise`). The vendor's physical stock, which this context never sees unless the basis is `PHYSICAL`. |
| **Availability Basis** | Why the node gave that number: `PHYSICAL` stock, `THROUGHPUT_CONSTRAINED` by its capacity before the next cutoff, or `UNKNOWN`. Kept as declared, never re-derived. | `listing.Basis` | **Promise Basis** (`SCHEDULED` / `NOMINAL`, `delivery-promise`), which says how a promise was computed. |
| **Availability** | The value object on a listing: `availableQty`, `basis`, `asOf`, `feedId`. | `listing.Availability` | The `AvailabilityView` read models of `delivery-promise` and `order-sourcing`, which are their copies. |
| **asOf** | The instant the vendor's number is true for. Monotonic per listing: an update with `asOf` not after the current one is ignored. | `listing.Availability.AsOf` | The time the feed was applied (`appliedAt`). |
| **Inventory Feed** | One vendor submission of availability for one node, full or partial, applied atomically. | `feed.InventoryFeed` | A **Submission / Transaction** (`vendor-connectivity`), the asynchronous Vendor API write that carries it. |
| **Full Feed** | A feed that is the complete truth for its node; omitted listings become zero. | `feed.InventoryFeed.FullUpdate` | A partial feed (`fullUpdate` false), which changes only the listings it names. |
| **Feed state** | `RECEIVED`, then `APPLIED` or `FAILED`. | `feed.State` | **Submission** states `PROCESSING` / `SUCCESS` / `FAILURE` in `vendor-connectivity`. |
| **Listing state** | `LIVE` (sellable) or `SUPPRESSED` (not sellable, for example because its node is not `ACTIVE`). | `listing.State` | A zero **Available Quantity**: a `LIVE` listing can have zero. |
| **Catalog item state** | `ACTIVE` or `DISCONTINUED`. | `catalog.State` | **Node** status `ACTIVE` (`node-topology`). |
| **Suppression** | Taking a listing out of sale; the event carries a `reason`. | `listing.Listing.Suppress` | Discontinuing a catalogue item. |
| **Suppress on node unavailable** | Policy: on `NodeSuspended` or `NodeRetired` suppress every listing of the node; on `NodeActivated` restore those suppressed for that reason. | `policy.SuppressOnNodeUnavailable` | `node-topology` suspending a node (the cause, not this policy). |
| **Full feed zeroing** | Policy: a full feed sets `availableQty=0` on every listing of the node it omits. | `policy.FullFeedZeroing` | Suppression: a zeroed listing stays `LIVE`. |
| **Node status view** | Local, event-fed copy of each node's status, fed by `node-topology`. | `nodestatus.View` | The **Node** aggregate itself, owned by `node-topology`. |

## Neighbour terms this context uses

| Term | Definition | Code identifier (owner) | Not to be confused with |
| --- | --- | --- | --- |
| **Node** | One physical building of the network, of exactly one node type. | `node.Node` (`node-topology`) | A **Listing**'s `nodeId`, which is only a reference by value. |
| **Node Type** | `FULFILLMENT_CENTER`, `INBOUND_CROSS_DOCK`, `RETURNS_CENTER`, `SORTATION_CENTER`, `DELIVERY_STATION` or `AIR_HUB`. | `node.Type` (`node-topology`) | Node subtype (`SORTABLE`, `XL`, ...). |
| **Node Operator** | Who runs the building: `NETWORK` or a `VENDOR`. | `node.Operator` (`node-topology`) | The vendor organisation (`vendor.VendorAccount`). |
| **Cutoff** | A local time by which a node declares packages are ready to be handed over. | `node.CutoffSlot` (`node-topology`) | The time scope of a `THROUGHPUT_CONSTRAINED` quantity, which the vendor computed against its own next cutoff. |
| **Vendor** | An organisation operating fulfillment nodes for the network (the warehouse-systems fleet is vendor V-WS). | `vendor.VendorAccount` (`vendor-connectivity`) | A **Seller** (`seller-inbound`): an owner of stock, not an operator of nodes. A listing's `ownerRef` names the seller of record. |
| **Submission / Transaction** | An asynchronous vendor write and its outcome, reconciled by `transactionId`. | `submission.Submission` (`vendor-connectivity`) | An **Inventory Feed** (what this context applies). |
| **Vendor API** | The Open Host Service of `vendor-connectivity`; its JSON schemas are the Published Language. | `apis/vendor-connectivity/openapi.yaml` | This context's in-organization API (`apis/offer-availability/openapi.yaml`), which vendors never call. |
| **Delivery Offer** | A quoted delivery window for an item, quantity, destination and tier, valid until it expires. | `offer.DeliveryOffer` (`delivery-promise`) | A **Listing**. |
| **Scorecard** | A node's measured performance over a rolling window, with a grade; one metric is feed freshness. | `scorecard.NodeScorecard` (`node-performance`) | The declared **Availability Basis**. |
| **Declared vs Measured** | What a vendor says against what the network observes. | principle (`node-performance`) | — |

## Fleet translation

Not applicable. This context never talks to the warehouse-systems fleet.
For vendor V-WS the basis originates in the fleet's `network-fulfillment`
`CapabilityOffer` (its `Basis` `PHYSICAL` / `THROUGHPUT_CONSTRAINED`) and
reaches this context only through `vendor-connectivity`. The canonical
translation table is on
[WMS/WES integration](/network/integration/wms-wes-integration).

## Packaging and ownership terms

> **Proposed, [ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments).** This section is the delta that the seller-inbound design adds to this page. Nothing in it is built.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Packaging Hierarchy** | The pack levels of one catalogue item (each, inner pack, case, pallet), each with its own GTIN and a fixed content quantity. Quantities stay in eaches. | `catalog.PackagingHierarchy` | A listing's available quantity. |
| **Pack Level** | One of `EACH`, `INNER`, `CASE`, `PALLET`. A level other than `EACH` knows its child level's GTIN and how many of it it holds. | `catalog.PackLevel` | A node subtype. |
| **Owner Reference** | The opaque `ownerRef` on a listing: the seller of record of the stock. Empty means the vendor's own stock. | `listing.OwnerRef` | The vendor operating the node. |
