---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: The terms of the Vendor API and the purchase-order protocol, their proposed code identifiers, and how each translates into the warehouse-systems fleet's network-fulfillment vocabulary.
---

# Ubiquitous Language

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

The terms this context speaks. Because the Vendor API is a Published
Language, these words are also the words every vendor reads in the
contract. Code identifiers are proposed Go names (`package.Type`).

## This context's terms

From `contexts[vendor-connectivity].ul`, plus the value objects and states
the aggregates name.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Vendor** | An organisation operating fulfillment nodes for the network (the warehouse-systems fleet is vendor `V-WS`). | `vendor.VendorAccount` | **Node Operator** `VENDOR` in node-topology, which is an attribute of a node, not the account |
| **Ack Window** | The vendor's configured time to acknowledge, between 1h and 24h. | `vendor.VendorAccount.AckWindow` (`ackWindowMinutes` on the wire) | **ackBy**, the per-order deadline it feeds |
| **Purchase Order (PO)** | The instruction to one vendor node to ship one shipment group in full by `requiredShipBy`. | `po.PurchaseOrder`, id `poNumber` | **Customer order** (customer-ordering); **Fulfillment Assignment** (order-sourcing), of which a PO is one release |
| **PO Line** | One listing and quantity on a PO, numbered `lineNo`. | `po.PoLine{lineNo, listingId, quantity}` | A catalogue item: the line names a **Listing**, not a `catalogItemId` |
| **Acknowledgement** | The vendor's single, whole-order accept or reject. | `po.AckDecision(ACCEPT\|REJECT){reasonCode}` | A partial answer, which does not exist (`ErrPartialAcknowledgement`) |
| **Reject Reason** | Why a vendor refused a PO: `OUT_OF_STOCK`, `UNKNOWN_LISTING`, `CANNOT_MEET_SHIP_BY`, `DISCONTINUED`. | `po.RejectReason` | The fleet's rejection reasons (see the translation table below) |
| **Ack Window / ackBy** | The deadline for the acknowledgement: `min(issuedAt + ackWindow, requiredShipBy - handlingTime)`. | `po.PurchaseOrder.AckBy` | **requiredShipBy**, which is later |
| **Required Ship-By** | The pickup cutoff the PO must be ready for; the fleet calls it the CPT. | `po.PurchaseOrder.RequiredShipBy` | **deliverByLatest** (delivery-promise), the customer-facing date |
| **Expired** | A PO still `ISSUED` past `ackBy`; never answered late. | `po.StateExpired`, `ExpireUnacknowledgedOrders` | **Rejected**, which is the vendor's own answer |
| **Cancelled** | A PO withdrawn by the network while still `ISSUED`. | `po.StateCancelled`, `CancelPurchaseOrder` | **Rejected** or **Expired** |
| **Submission / Transaction** | An asynchronous vendor write and its outcome, reconciled by `transactionId`. | `submission.Submission` | The PO's own state; a submission is the write, not the order |
| **Submission Kind** | `ACKNOWLEDGEMENT`, `INVENTORY`, `NODE_REGISTRATION`, `NODE_PROFILE`, `SHIPMENT_CONFIRMATION`. | `submission.Kind` | — |
| **Submission Error** | One reason a transaction failed: `code`, `message`, `path`. | `submission.SubmissionError` | An HTTP problem: a synchronous refusal never creates a transaction |
| **notBefore** | `receivedAt + TX_PROCESSING_DELAY`; a submission is never processed earlier. | `submission.Submission.NotBefore` | — |
| **Label** | `labelRef + trackingNumber + carrier`; never the address. | `po.Label` | **Shipping Label** in shipping-and-tracking, the aggregate that also holds the encrypted ship-to snapshot |
| **Vendor API** | The Open Host Service of this context; its JSON schemas are the Published Language. | `apis/vendor-connectivity/openapi.yaml` | The in-org REST of other contexts, which vendors never call |
| **nextToken** | Opaque continuation token of the PO poll. | query parameter `nextToken` | A timestamp watermark (`createdAfter`) |
| **Simulation knobs** | `TX_PROCESSING_DELAY`, `TX_FAILURE_RATE`, `RATE_LIMIT_RPS`, `PO_REDELIVERY_RATE`; all default to well-behaved. | policy `SimulationKnobs` | Production configuration |

## Neighbour terms this context uses

| Term | Definition | Code identifier (owner) | Not to be confused with |
| --- | --- | --- | --- |
| **Node** | One physical building of the network, of exactly one node type. | `node.Node` (node-topology) | A vendor's own site id |
| **Node Type** | `FULFILLMENT_CENTER`, `INBOUND_CROSS_DOCK`, `RETURNS_CENTER`, `SORTATION_CENTER`, `DELIVERY_STATION` or `AIR_HUB`. A vendor registers only the first three. | `node.Type` (node-topology) | The fleet's `siteRole` |
| **Operational Profile** | The node's declared operating hours, cutoffs, handling time, throughput cap and time zone, versioned by `profileRevision`. | `node.OperationalProfile` (node-topology) | The **Scorecard**, which is measured |
| **Handling Time** | Declared time from order release to a package ready for handover. | `node.OperationalProfile.HandlingTime` (node-topology) | — |
| **Cutoff** | A local time by which a node declares packages ready; one pickup departure per cutoff. | `node.CutoffSlot` (node-topology) | **requiredShipBy**, which is one concrete cutoff instant |
| **Listing** | A catalogue item offered from one node. | `listing.Listing` (offer-availability) | **Catalog Item** |
| **Inventory Feed** | One vendor submission of availability for one node, full or partial. | `feed.InventoryFeed` (offer-availability) | The `INVENTORY` **Submission**, which is the vendor-facing write that carries it |
| **Availability Basis** | `PHYSICAL`, `THROUGHPUT_CONSTRAINED` or `UNKNOWN`. | `listing.Basis` (offer-availability) | — |
| **Release (to node)** | Sending a group to one node; for a vendor node this issues a PO. | `assignment.Release` (order-sourcing) | — |
| **Path Lock** | The point after which an assignment never changes node: the vendor's acceptance. | `assignment.Lock` (order-sourcing) | — |
| **Tracking Number** | The network-wide unique id of one package. | `journey.TrackingNumber` (shipping-and-tracking) | `labelRef` |
| **Scorecard** | A node's measured performance over a rolling window, with a grade. | `scorecard.NodeScorecard` (node-performance) | The **Operational Profile** |
| **Declared vs Measured** | What a vendor says (profile) against what the network observes (scorecard). | (principle) | — |

## Fleet translation

The fleet's `network-fulfillment` is Conformist to this Published Language
and translates it in its Anti-Corruption Layer. Fleet terms below are the
fleet's code as of `IQVO/network-fulfillment` `develop`: the
`NetworkGateway` port and the stub-only adapter at
`internal/adapters/outbound/network/` (ADR 0009 renames it to
`outbound/retailnetwork/`). The canonical, domain-wide table is on
[Ubiquitous Language](/network/strategic-design/ubiquitous-language); this page
repeats its rows and adds the protocol detail this context owns. How the
seam works end to end is on [WMS/WES integration](/network/integration/wms-wes-integration);
the changes the fleet needs are on [Fleet changes](/network/integration/fleet-changes).

### Concepts and operations

| Network term (this context) | warehouse-systems term (network-fulfillment) | Note |
| --- | --- | --- |
| Vendor API | `ports.NetworkGateway` | The port is the fleet's ACL boundary |
| Vendor `V-WS` | the fleet | One vendor among many |
| Purchase Order, `poNumber` | `NetworkOrder`, `NetworkRef` | Opaque to the fleet, never parsed |
| `lineNo` | `NetworkLineRef` | Unique within one PO |
| `listingId` | `NetworkProductId`, translated to `SKU` by `ProductTranslation` | A listing is per node; the SKU is the fleet's |
| Node (`nodeId`) | Site (`siteCode`) | Mapping persisted in `network-fulfillment`, never a string convention |
| `vendorNodeCode` | `siteCode` | What the fleet sends when it registers a node |
| Node type `FULFILLMENT_CENTER` + subtype | `siteRole` (facility-layout ADR 0037) | Per the model's `fleet_site_role_mapping`; see [Node model](/network/network-model/node-model) |
| Cutoff / pickup departure | CPT (`CPTSchedule`, process-path-management ADR 0010) | The fleet's CPT is the network's pickup cutoff at that node |
| Handling Time | `cycleTimeP95` of the eligible path | Declared from the fleet's own number |
| Throughput Cap / cutoff `maxOrders` | remaining path capacity (`PathCapacityChanged`) | — |
| Listing availability + basis | `CapabilityOffer{advertisedQuantity, basis}` | `PHYSICAL` / `THROUGHPUT_CONSTRAINED` exist on both sides |
| `requiredShipBy` | `requiredShipBy` (the CPT `cutoffAt`), checked by order-management `FeasibleBy` | Same instant; the fleet passes it to order-management |
| Label (`labelRef`, `trackingNumber`, `carrier`) | `LabelResult` | No address on either side of the seam |
| Promise / deliver-by window | none | The fleet never sees the delivery promise; it sees only `requiredShipBy` |
| `ackBy` | `acknowledgeBy` | The fleet fixes `receivedAt + 24h`; the network's `ackBy` can be earlier, so the fleet must read it from the PO |
| `GET /vendor/purchase-orders` with `nextToken` | `PollDemand` | The fleet polls "since watermark" |
| `POST /vendor/acknowledgements` | `SubmitAcknowledgement(accepted)` | Fill-or-kill on both sides; the fleet's port has no reason-code argument today |
| `POST /vendor/inventory` | `SubmitAvailability` | Carries the fleet's `CapabilityOffer` quantity and `Basis` |
| `PUT /vendor/nodes/{nodeId}/profile` | `DeclareCapability` | A documented no-op in the fleet today |
| `POST /vendor/shipping-labels` | `RequestLabel` | Returns `labelRef`, `trackingNumber`, `carrier` (`LabelResult`) |
| `POST /vendor/shipment-confirmations` | `SubmitShipmentConfirmation` | — |
| `GET /vendor/transactions/{transactionId}` | `SubmissionStatus` | The network keys by `transactionId`; the fleet's port keys by `NetworkRef`, so the ACL must keep the mapping |
| `POST /vendor/nodes` | no port method today | A fleet change |
| `GET /vendor/nodes/{nodeId}/scorecard` | no port method today | — |

### States and outcomes

| Network term | warehouse-systems term | Note |
| --- | --- | --- |
| PO `ISSUED` | `NetworkOrder` `NEW` | — |
| PO `ACK_PROCESSING` | `SUBMITTED` | A commitment in flight on both sides |
| PO `ACCEPTED` | `ACKNOWLEDGED` | The path lock on the network side |
| PO `REJECTED` | `REJECTED` | — |
| PO `EXPIRED` | `REJECTED` with `ACKNOWLEDGEMENT_DEADLINE_MISSED` | The fleet refuses locally and sends nothing |
| PO `SHIPMENT_PROCESSING`, `SHIPPED` | `CONFIRMED` | The fleet has no in-flight shipment state |
| PO `CANCELLED` | no fleet state | See the open questions on the [canvas](/network/contexts/vendor-connectivity/bounded-context-canvas) |
| Submission `PROCESSING` / `SUCCESS` / `FAILURE` | `SubmissionStatus` `PENDING` / `SUCCESS` / `FAILURE` | — |

### Reason codes

| Network `RejectReason` | warehouse-systems rejection reason | Note |
| --- | --- | --- |
| `CANNOT_MEET_SHIP_BY` | `INFEASIBLE_DEADLINE` | order-management's "not feasible" verdict |
| `UNKNOWN_LISTING` | `UNTRANSLATABLE_SKU` | No `ProductTranslation` entry for the listing |
| `OUT_OF_STOCK` | none today | The fleet has no separate stock-out reason |
| `DISCONTINUED` | none today | — |
| no reason code: the PO goes `EXPIRED` | `ACKNOWLEDGEMENT_DEADLINE_MISSED` | Nothing is sent after `ackBy` |
| no reason code: the transaction ends `FAILURE` | `SUBMISSION_FAILED` | The PO returns to `ISSUED` on the network side and expires at `ackBy` unless acknowledged again |

## Inbound terms

> **Proposed, [ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments).** This section is the delta that the seller-inbound design adds to this page. Nothing in it is built.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Inbound Receipt** | A vendor's carton-level report of what arrived for one inbound shipment: per SSCC a status, the eaches received per GTIN and any compliance codes. | `submission.InboundReceipt` | A purchase-order acknowledgement, which answers an order the network sent. |
| **ownerRef** (on the Vendor API) | The seller of record of the cartons: the `sellerId` of `seller-inbound` (carried on the poll as `sellerId`, kept by the vendor as its own `ownerRef`), opaque to the vendor. | `InboundShipmentView.sellerId` | The vendor. |
