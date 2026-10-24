---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: Every event Vendor Connectivity publishes and consumes, with full CloudEvents types, topics, keys, payload fields, producers, consumers and idempotency.
---

# Domain Events

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

These are **in-organization** events. Vendors never see them; vendors see
the Vendor API's Published Language
(`apis/vendor-connectivity/openapi.yaml`). The convention is on
[Event standard: CloudEvents](/network/strategic-design/event-standard-cloudevents)
and [ADR 0007](/network/adr/0007-cloudevents-namespace).

## Envelope

| Attribute | Value |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once per event and stored in the outbox row, so a redelivery carries the same `id` |
| `source` | `/retailnetwork/vendor-connectivity` |
| `type` | `com.retailnetwork.partner.vendor-connectivity.<entity>.<EventName>`; entity is `vendoraccount`, `purchaseorder` or `submission` |
| `subject` | the aggregate root id: `vendorId`, `poNumber` or `transactionId` |
| `time` | the instant of the fact, UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:vendor-connectivity:events:<EventName>:v1` |
| Topic | `retailnetwork.vendor-connectivity.events` |
| Kafka key | same as `subject`, so one purchase order's events stay in order on one partition |

## Published

Every event leaves through the transactional outbox, in the same
transaction as the aggregate change.

### VendorOnboarded

| | |
| --- | --- |
| Type | `com.retailnetwork.partner.vendor-connectivity.vendoraccount.VendorOnboarded` |
| Subject / key | `vendorId` |
| Produced by | `OnboardVendor` (REST `POST /vendors`) |
| Consumers | node-performance |

| Field | Type | Meaning |
| --- | --- | --- |
| `vendorId` | string | The vendor account id, for example `V-WS` |
| `name` | string | The vendor's name |
| `ackWindowMinutes` | integer | The vendor's ack window, 60 to 1440 |

### PurchaseOrderIssued

| | |
| --- | --- |
| Type | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderIssued` |
| Subject / key | `poNumber` |
| Produced by | `IssuePurchaseOrder` (policy `IssueOnRelease`) |
| Consumers | node-performance |

| Field | Type | Meaning |
| --- | --- | --- |
| `poNumber` | string | The purchase order |
| `vendorId` | string | The vendor that operates the node |
| `nodeId` | string | The vendor node |
| `assignmentId` | string | order-sourcing's assignment |
| `releaseNo` | integer | The release of that assignment |
| `requiredShipBy` | date-time | The pickup cutoff to be ready for |
| `ackBy` | date-time | `min(issuedAt + ackWindow, requiredShipBy - handlingTime)` |
| `lines` | array of `{lineNo, listingId, quantity}` | The `PoLine`s |

### PurchaseOrderAccepted

| | |
| --- | --- |
| Type | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderAccepted` |
| Subject / key | `poNumber` |
| Produced by | `ProcessSubmission` (acknowledgement `ACCEPT`, transaction `SUCCESS`) |
| Consumers | order-sourcing (`LockOnCommit`), node-performance |

| Field | Type | Meaning |
| --- | --- | --- |
| `poNumber` | string | The purchase order |
| `assignmentId` | string | order-sourcing's assignment |
| `releaseNo` | integer | The release |
| `nodeId` | string | The vendor node |
| `acceptedAt` | date-time | When the acceptance took effect |
| `transactionId` | string | The acknowledgement submission |

### PurchaseOrderRejected

| | |
| --- | --- |
| Type | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderRejected` |
| Subject / key | `poNumber` |
| Produced by | `ProcessSubmission` (acknowledgement `REJECT`, transaction `SUCCESS`) |
| Consumers | order-sourcing (`ReassignOnRefusal`), node-performance |

| Field | Type | Meaning |
| --- | --- | --- |
| `poNumber` | string | The purchase order |
| `assignmentId` | string | order-sourcing's assignment |
| `releaseNo` | integer | The release |
| `nodeId` | string | The vendor node |
| `reasonCode` | enum | `OUT_OF_STOCK`, `UNKNOWN_LISTING`, `CANNOT_MEET_SHIP_BY`, `DISCONTINUED` |
| `rejectedAt` | date-time | When the rejection took effect |

### PurchaseOrderExpired

| | |
| --- | --- |
| Type | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderExpired` |
| Subject / key | `poNumber` |
| Produced by | `ExpireUnacknowledgedOrders` (policy `ExpireUnacknowledged`) |
| Consumers | order-sourcing (`ReassignOnRefusal`), node-performance |

| Field | Type | Meaning |
| --- | --- | --- |
| `poNumber` | string | The purchase order |
| `assignmentId` | string | order-sourcing's assignment |
| `releaseNo` | integer | The release |
| `nodeId` | string | The vendor node |
| `ackBy` | date-time | The deadline that passed |

### PurchaseOrderCancelled

| | |
| --- | --- |
| Type | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderCancelled` |
| Subject / key | `poNumber` |
| Produced by | `CancelPurchaseOrder` (policy `CancelOnSourcingCancel`) |
| Consumers | analytics only (no context consumer) |

| Field | Type | Meaning |
| --- | --- | --- |
| `poNumber` | string | The purchase order |
| `assignmentId` | string | order-sourcing's assignment |
| `reason` | string | The reason carried by `FulfillmentCancelled` |

### VendorShipmentConfirmed

| | |
| --- | --- |
| Type | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.VendorShipmentConfirmed` |
| Subject / key | `poNumber` |
| Produced by | `ProcessSubmission` (shipment confirmation, transaction `SUCCESS`) |
| Consumers | order-sourcing, shipping-and-tracking, node-performance |

| Field | Type | Meaning |
| --- | --- | --- |
| `poNumber` | string | The purchase order |
| `assignmentId` | string | order-sourcing's assignment |
| `nodeId` | string | The vendor node |
| `trackingNumbers` | array of string | One per package, each with a label |
| `shippedAt` | date-time | When the vendor says it shipped |
| `requiredShipBy` | date-time | The cutoff it was due for, so consumers can judge lateness without a lookup |

### SubmissionProcessed

| | |
| --- | --- |
| Type | `com.retailnetwork.partner.vendor-connectivity.submission.SubmissionProcessed` |
| Subject / key | `transactionId` |
| Produced by | `ProcessSubmission` (any kind, any outcome) |
| Consumers | node-performance (feed freshness, failure rates) |

| Field | Type | Meaning |
| --- | --- | --- |
| `transactionId` | string | The submission |
| `vendorId` | string | The vendor that wrote |
| `kind` | enum | `ACKNOWLEDGEMENT`, `INVENTORY`, `NODE_REGISTRATION`, `NODE_PROFILE`, `SHIPMENT_CONFIRMATION` |
| `status` | enum | `SUCCESS` or `FAILURE` |
| `errorCount` | integer | Number of `SubmissionError`s |

No event carries a ship-to address, name or phone.

## Example envelope

`PurchaseOrderAccepted` is the most important event: it is the path lock
([ADR 0005](/network/adr/0005-vendor-acceptance-is-the-path-lock)).

```json
{
  "specversion": "1.0",
  "id": "9b2f4c1e-6a7d-4e0b-8f31-2c5d7a9e1b44",
  "source": "/retailnetwork/vendor-connectivity",
  "type": "com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderAccepted",
  "subject": "PO-7f3c",
  "time": "2026-10-22T13:05:41Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:vendor-connectivity:events:PurchaseOrderAccepted:v1",
  "data": {
    "poNumber": "PO-7f3c",
    "assignmentId": "asg-41d2",
    "releaseNo": 1,
    "nodeId": "node-ws-gru1",
    "acceptedAt": "2026-10-22T13:05:41Z",
    "transactionId": "tx-01J9Z6K4M2"
  }
}
```

## Consumed

Every consumer is idempotent on the CloudEvents `id` (the
`processed_events` inbox, written in the same transaction as the effect)
and dispatches on the full `type` string.

| Producer | Full type | What this context does | Idempotency beyond the inbox |
| --- | --- | --- | --- |
| order-sourcing | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReleasedToNode` | Policy `IssueOnRelease`: if `nodeId` is a `VENDOR` node in `VendorNodeView`, `IssuePurchaseOrder` with `requiredShipBy` and `lines` (`listingId`, `quantity`); ignores `orderId`, `tier` and `promisedDeliverByLatest` | `poNumber` is derived from `assignmentId + releaseNo`; a second release event with the same pair finds the order and does nothing |
| order-sourcing | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentCancelled` | Policy `CancelOnSourcingCancel`: `CancelPurchaseOrder` on the `ISSUED` order of that assignment | A `CANCELLED` order is left as is; a non-`ISSUED` one is refused (`ErrCancelAfterAcknowledgement`) and logged |
| node-topology | `com.retailnetwork.logistics.node-topology.node.NodeRegistered` | Upsert `VendorNodeView` (`nodeId`, `vendorId`, `vendorNodeCode`, `nodeType`, `operator`, status `PROPOSED`) | Upsert by `nodeId` |
| node-topology | `com.retailnetwork.logistics.node-topology.node.NodeActivated` | Set status `ACTIVE` in `VendorNodeView` | Last write by event time wins |
| node-topology | `com.retailnetwork.logistics.node-topology.node.NodeSuspended` | Set status `SUSPENDED` | Last write by event time wins |
| node-topology | `com.retailnetwork.logistics.node-topology.node.NodeRetired` | Set status `RETIRED` | Terminal |
| offer-availability | `com.retailnetwork.commerce.offer-availability.listing.ListingCreated` | Insert into `ListingView` (`listingId`, `catalogItemId`, `nodeId`) | Insert-if-absent by `listingId` |

Not consumed, though a reader might expect it:
`com.retailnetwork.logistics.node-topology.node.NodeOperationalProfileDeclared`.
The `ackBy` rule needs the node's handling time, and the model gives this
context no source for it. This is listed as an open question on the
[canvas](/network/contexts/vendor-connectivity/bounded-context-canvas).
