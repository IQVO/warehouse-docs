---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: "The nine events Seller Inbound publishes and the eight it consumes, with full CloudEvents types, payloads and idempotency rules."
---

# Domain Events

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built ([`IQVO/seller-inbound`](https://github.com/IQVO/seller-inbound), designed by [ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses. Where the model left a choice open, the service's own ADRs 0002 to 0005 record what it does.
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
the shipment is still `RECEIVING`. As built, the six analytics-only events go
to `retailnetwork.seller-inbound.analytics` and the three consumed ones to
`retailnetwork.seller-inbound.events` (service ADR 0002 A11, ADR 0004).

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
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemPackagingDeclared` | Stores the declared levels, GTINs and `unitsPerPack`. |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemPackLevelRetired` | Marks the level retired (`active = false`, `retired_at`); only an active CASE level validates a case carton (`ErrCaseQtyMismatchesGtin`). |

As built (service ADR 0003): one consumer per topic, each under a mandatory
group variable (`NODE_CONSUMER_GROUP`, `CATALOG_CONSUMER_GROUP`,
`RECEIPT_CONSUMER_GROUP`). A transient failure is retried with capped backoff
and then dead-lettered to `<topic>.dlq`; a payload that can never apply is
dead-lettered at once. `CatalogItemCreated` and `CatalogItemDiscontinued` are
not consumed, so a plan line's catalogue item is not checked for being live.
