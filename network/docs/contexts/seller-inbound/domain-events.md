---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: "The nine events Seller Inbound publishes and the ten it consumes, with full CloudEvents types, payloads and idempotency rules."
---

# Domain Events

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet, and unlike the other ten contexts it has no reference service: it is design only ([ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)). Identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Every event this context publishes (`contexts[seller-inbound].publishes`) and
consumes (`.consumes`), with the envelope rules of `conventions.cloudevents`
([event standard](/network/strategic-design/event-standard-cloudevents),
[ADR 0007](/network/adr/0007-cloudevents-namespace)).

## Envelope

| Attribute | Value |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once when the event is written to the outbox |
| `source` | `/retailnetwork/seller-inbound` |
| `type` | `com.retailnetwork.partner.seller-inbound.<entity>.<EventName>` (tier `partner`; entity `selleraccount`, `inboundplan` or `inboundshipment`) |
| `subject` | the aggregate root id: `sellerId`, `planId` or `shipmentId` |
| `time` | the instant the fact became true |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:seller-inbound:events:<EventName>:v1` |
| Kafka topic | `retailnetwork.seller-inbound.events` (integration), `retailnetwork.seller-inbound.analytics` (analytics-only events) |
| Kafka key | the `subject` |

Quantities are eaches. `sellerId` here is `ownerRef` on the Vendor API.

## Published

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `SellerOnboarded` | `com.retailnetwork.partner.seller-inbound.seller.SellerOnboarded` | analytics only |
| `SellerSuspended` | `com.retailnetwork.partner.seller-inbound.seller.SellerSuspended` | analytics only |
| `SellerReinstated` | `com.retailnetwork.partner.seller-inbound.seller.SellerReinstated` | analytics only |
| `InboundPlanConfirmed` | `com.retailnetwork.partner.seller-inbound.inboundplan.InboundPlanConfirmed` | analytics only |
| `InboundShipmentLabelled` | `com.retailnetwork.partner.seller-inbound.inboundshipment.InboundShipmentLabelled` | `vendor-connectivity` |
| `InboundShipmentShipped` | `com.retailnetwork.partner.seller-inbound.inboundshipment.InboundShipmentShipped` | `vendor-connectivity`, `node-performance` |
| `InboundShipmentReceived` | `com.retailnetwork.partner.seller-inbound.inboundshipment.InboundShipmentReceived` | `vendor-connectivity` |
| `InboundDiscrepancyRecorded` | `com.retailnetwork.partner.seller-inbound.inboundshipment.InboundDiscrepancyRecorded` | analytics only |
| `SellerComplianceViolationRecorded` | `com.retailnetwork.partner.seller-inbound.seller.SellerComplianceViolationRecorded` | analytics only |

### Payloads

| Event | Fields (from the model) |
| --- | --- |
| `SellerOnboarded` | `sellerId`, `name`, `onboardedAt` |
| `SellerSuspended` | `sellerId`, `suspendedAt`, `reason` |
| `SellerReinstated` | `sellerId`, `reinstatedAt` |
| `InboundPlanConfirmed` | `planId`, `sellerId`, `destinationNodeId`, `packingOption`, `lines` (`catalogItemId`, `gtin`, `qtyEaches`), `confirmedAt` |
| `InboundShipmentLabelled` | `shipmentId`, `planId`, `sellerId`, `nodeId`, `cartons` (`sscc`, `parentSscc`, `kind`, `contents` (`catalogItemId`, `gtin`, `qtyEaches`, `lot`, `expiry`), `grossWeightG`, `dimsMm`), `labelledAt` |
| `InboundShipmentShipped` | `shipmentId`, `planId`, `sellerId`, `nodeId`, `shippedAt` |
| `InboundShipmentReceived` | `shipmentId`, `sellerId`, `nodeId`, `status`, `cartons` (`sscc`, `status`), `receivedAt` |
| `InboundDiscrepancyRecorded` | `shipmentId`, `sellerId`, `nodeId`, `sscc` (optional), `kind`, `expected` (optional), `actual` (optional), `recordedAt` |
| `SellerComplianceViolationRecorded` | `sellerId`, `shipmentId` (optional), `code`, `recordedAt` |

Value sets: `status` of the shipment is `CLOSED` or
`CLOSED_WITH_DISCREPANCY`; the carton `status` is `RECEIVED`, `MISSING`,
`UNEXPECTED` or `DAMAGED`. `kind` of a discrepancy is passed through
unchanged from the vendor's receipt (the receiving fleet's carton discrepancy
kind strings); this context does not own a closed vocabulary for it and
branches on none of its values. `InboundShipmentReceived` is
published once, when the shipment closes. `InboundDiscrepancyRecorded` is
published for each discrepancy as receipts are processed, including while
the shipment is still `RECEIVING`. Whether the analytics-only events go to
the `.analytics` topic follows `conventions.analytics_rule`.

### Example envelope

`InboundShipmentLabelled` carries the carton manifest and
`InboundShipmentShipped` marks it shippable to the vendor; both feed
`InboundShipmentView` in `vendor-connectivity`. The values are illustrative.

```json
{
  "specversion": "1.0",
  "id": "3f1a7c52-9d0e-4b6a-8c21-5e7f0a9b1c33",
  "source": "/retailnetwork/seller-inbound",
  "type": "com.retailnetwork.partner.seller-inbound.inboundshipment.InboundShipmentLabelled",
  "subject": "ish-01J9Z7K3M4",
  "time": "2026-10-23T13:10:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:seller-inbound:events:InboundShipmentLabelled:v1",
  "data": {
    "shipmentId": "ish-01J9Z7K3M4",
    "planId": "ipl-01J9Z7H8Q2",
    "sellerId": "seller-acme",
    "nodeId": "N-VWS-AUS3",
    "cartons": [
      {
        "sscc": "000123450000000010",
        "kind": "HOMOGENEOUS_CASE",
        "contents": [
          {"catalogItemId": "ci-1001", "gtin": "00012345678905", "qtyEaches": 12, "lot": "L2209", "expiry": "2028-09-30"}
        ],
        "grossWeightG": 7200,
        "dimsMm": {"l": 400, "w": 300, "h": 250}
      }
    ],
    "labelledAt": "2026-10-23T13:10:00Z"
  }
}
```

The SSCC and GTIN above are made up for illustration (the company prefix is
not assigned to anyone). Both carry a valid mod-10 check digit, so they pass
the validation the model requires.

## Consumed

Every consumer dispatches on the full `type` string and is idempotent on the
CloudEvents `id` (`processed_events` inbox).

| Producer | Full `type` | What this context does |
| --- | --- | --- |
| `vendor-connectivity` | `com.retailnetwork.partner.vendor-connectivity.inboundreceipt.InboundReceiptSubmitted` | `RecordInboundReceipt` on the named shipment (`ReceiveOnVendorReceipt`). |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeRegistered` | Creates the node in `NodeInboundView`. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeOperationalProfileDeclared` | Updates `inbound` limits in `NodeInboundView`. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeActivated` | Marks the node receivable. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeSuspended` | Marks the node not receivable. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeRetired` | Marks the node retired. |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemCreated` | Adds the item and its each GTIN to `CatalogPackagingView`. |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemDiscontinued` | Marks the item not plannable. |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemPackagingDeclared` | Stores the declared levels, GTINs and `unitsPerPack`. |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemPackLevelRetired` | End-dates the level; in-flight shipments keep validating against what was active when they were labelled. |
