---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: "Every event Shipping & Tracking publishes and consumes: full CloudEvents types, topics, keys, data fields, producing use cases, consumers and idempotency."
---

# Domain Events

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Every event this context publishes and consumes, from
`model.yaml → contexts[shipping-and-tracking].publishes` and `.consumes`, and
the convention in `conventions.cloudevents`. The domain-wide rules are on
[Event standard: CloudEvents](/strategic-design/event-standard-cloudevents).

## Envelope

Every Kafka message is a CloudEvents 1.0 event in structured JSON mode.

| Attribute | Value |
| --- | --- |
| `specversion` | `1.0` |
| `id` | A UUID minted once when the outbox row is written; a relay retry re-sends the same `id` |
| `source` | `/retailnetwork/shipping-and-tracking` |
| `type` | `com.retailnetwork.logistics.shipping-and-tracking.<entity>.<EventName>`, entity `label` or `journey` |
| `subject` | The aggregate root id: `labelRef` for `label` events, `trackingNumber` for `journey` events |
| `time` | The instant the fact happened (for example `deliveredAt`), UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:shipping-and-tracking:events:<EventName>:v1` |
| Kafka topic | `retailnetwork.shipping-and-tracking.events` |
| Kafka key | Same as `subject`, so one journey's events stay in order on one partition |

Every event leaves through the transactional outbox, in the same transaction
as the aggregate change. No event carries a ship-to address or any part of
it.

## Published

| Event | Full `type` | Subject / key | Producing use case | Consumers |
| --- | --- | --- | --- | --- |
| `LabelIssued` | `com.retailnetwork.logistics.shipping-and-tracking.label.LabelIssued` | `labelRef` | `IssueLabel` | `linehaul-transportation`, `customer-ordering` |
| `LabelVoided` | `com.retailnetwork.logistics.shipping-and-tracking.label.LabelVoided` | `labelRef` | `VoidLabel` | analytics only |
| `PackageScanned` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageScanned` | `trackingNumber` | `RecordScan` (every applied scan) | `customer-ordering` |
| `PackageHandedOver` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageHandedOver` | `trackingNumber` | `RecordScan` (`LABELLED -> HANDED_OVER`) | `node-performance` |
| `PackageDelivered` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageDelivered` | `trackingNumber` | `RecordScan` (`OUT_FOR_DELIVERY -> DELIVERED`) | `delivery-promise`, `order-sourcing`, `customer-ordering` |
| `PackageExceptionRaised` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageExceptionRaised` | `trackingNumber` | `RaiseException` (`ExceptionOnSilence`) | `delivery-promise`, `customer-ordering` |
| `PackageReturned` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageReturned` | `trackingNumber` | `ReturnToSender` | analytics only |
| `PackageLost` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageLost` | `trackingNumber` | `DeclareLost` | analytics only |

"Analytics only" is the model's wording: no in-org context consumes the
event. Types in the data tables below are proposed; the field names are the
model's.

### LabelIssued

| Field | Type | Meaning |
| --- | --- | --- |
| `labelRef` | string | Identity of the label |
| `trackingNumber` | string | The package's network-wide unique id |
| `poNumber` | string | The purchase order the package belongs to |
| `assignmentId` | string | The fulfillment assignment behind the purchase order |
| `packageNo` | integer | Package number within the purchase order |
| `tier` | enum `SAME_DAY`, `NEXT_DAY`, `TWO_DAY`, `STANDARD` | Service tier printed on the label |
| `carrier` | string | Carrier printed on the label |

### LabelVoided

| Field | Type | Meaning |
| --- | --- | --- |
| `labelRef` | string | Identity of the label |
| `trackingNumber` | string | Tracking number of the voided label |
| `reason` | string | Why it was voided |

### PackageScanned

| Field | Type | Meaning |
| --- | --- | --- |
| `trackingNumber` | string | The package |
| `scanId` | string | Identity of the applied scan |
| `nodeId` | string | Where the package was observed |
| `scanType` | string | Kind of observation (not enumerated in the model; these pages use the source fact name) |
| `at` | timestamp | When it was observed |
| `state` | enum, the journey states | Journey state after the scan |

### PackageHandedOver

| Field | Type | Meaning |
| --- | --- | --- |
| `trackingNumber` | string | The package |
| `poNumber` | string | The purchase order, so `node-performance` can compare with its `requiredShipBy` |
| `nodeId` | string | The vendor node it left (origin of the pickup departure) |
| `handedOverAt` | timestamp | The handover instant (`HandoverOnFirstScan`) |

### PackageDelivered

| Field | Type | Meaning |
| --- | --- | --- |
| `trackingNumber` | string | The package |
| `assignmentId` | string | The assignment, for `order-sourcing` |
| `orderId` | string | The customer order, for `customer-ordering` and `delivery-promise` |
| `deliveredAt` | timestamp | Time of the successful attempt |

### PackageExceptionRaised

| Field | Type | Meaning |
| --- | --- | --- |
| `trackingNumber` | string | The package |
| `assignmentId` | string | The assignment |
| `orderId` | string | The customer order |
| `reason` | string | Why; the model names `NO_SCAN` |
| `at` | timestamp | When the exception was raised |

### PackageReturned

| Field | Type | Meaning |
| --- | --- | --- |
| `trackingNumber` | string | The package |
| `orderId` | string | The customer order |
| `returnedAt` | timestamp | When the journey ended as `RETURNED` |

### PackageLost

| Field | Type | Meaning |
| --- | --- | --- |
| `trackingNumber` | string | The package |
| `orderId` | string | The customer order |
| `declaredAt` | timestamp | When the package was declared lost |

### Example envelope: PackageDelivered

`PackageDelivered` is the most important event: it closes the journey,
closes the assignment in `order-sourcing` and lets `delivery-promise` judge
the promise. Values are synthetic.

```json
{
  "specversion": "1.0",
  "id": "5b6f2a0e-8d1c-4f7a-9c3e-2a41d7e9b0c4",
  "source": "/retailnetwork/shipping-and-tracking",
  "type": "com.retailnetwork.logistics.shipping-and-tracking.journey.PackageDelivered",
  "subject": "RN1000000042",
  "time": "2026-10-22T17:42:10Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:shipping-and-tracking:events:PackageDelivered:v1",
  "data": {
    "trackingNumber": "RN1000000042",
    "assignmentId": "asg-7f3c21",
    "orderId": "ord-20261021-0091",
    "deliveredAt": "2026-10-22T17:42:10Z"
  }
}
```

## Consumed

| Producer | Full `type` | Topic | Fields used | What this context does |
| --- | --- | --- | --- | --- |
| `vendor-connectivity` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.VendorShipmentConfirmed` | `retailnetwork.vendor-connectivity.events` | `poNumber`, `nodeId`, `trackingNumbers`, `shippedAt` | For each tracking number, `RecordScan` at `nodeId`, time `shippedAt`. Stored on the timeline; it does not move a `LABELLED` journey (handover comes from the pickup scan) |
| `linehaul-transportation` | `com.retailnetwork.logistics.linehaul-transportation.load.LoadDeparted` | `retailnetwork.linehaul-transportation.events` | `originNodeId`, `trackingNumbers`, `departedAt` | For each tracking number, `RecordScan` at `originNodeId`. On a `LABELLED` journey this is the pickup: `HANDED_OVER` and `PackageHandedOver` |
| `linehaul-transportation` | `com.retailnetwork.logistics.linehaul-transportation.load.LoadArrived` | `retailnetwork.linehaul-transportation.events` | `destinationNodeId`, `trackingNumbers`, `arrivedAt` | For each tracking number, `RecordScan` at `destinationNodeId`: `IN_TRANSIT`, or `AT_STATION` at a delivery station |
| `last-mile-delivery` | `com.retailnetwork.logistics.last-mile-delivery.route.PackageOutForDelivery` | `retailnetwork.last-mile-delivery.events` | `trackingNumber`, `stationNodeId`, `at` | `RecordScan` at `stationNodeId`: `OUT_FOR_DELIVERY` |
| `last-mile-delivery` | `com.retailnetwork.logistics.last-mile-delivery.route.DeliveryAttempted` | `retailnetwork.last-mile-delivery.events` | `trackingNumber`, `outcome`, `failureReason`, `at` | `RecordScan`: `DELIVERED` and `PackageDelivered` on `DELIVERED`; back to `AT_STATION` on `FAILED`. The event has no node id; the scan takes the station of the journey's last out-for-delivery scan |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemCreated` | `retailnetwork.offer-availability.events` | all eight fields | Upsert `CatalogDimensionsView` |

Consumers dispatch on the full `type` string, never on a suffix.

### Idempotency

- **Inbox.** Each consumer records the CloudEvents `id` in
  `processed_events` in the same transaction as its last change. A message
  whose `id` is already there is acknowledged and skipped.
- **Per-scan dedupe.** One load event names many tracking numbers and is
  applied as one transaction per journey. The proposed `scanId` is
  `<CloudEvents id>:<trackingNumber>`, so a redelivery after a partial
  failure hits `ErrDuplicateScan` on the journeys already done and applies
  only the rest. `ErrDuplicateScan` and `ErrScanOutOfOrder` are treated as
  success by consumers (no retry).
- **Closed journeys.** `ErrJourneyClosed` on a consumed event is logged and
  acknowledged; a scan after delivery is a producer-side anomaly, not a
  retry case.
- **Unknown tracking number.** A tracking number this context never issued
  is logged, counted and acknowledged (proposed). The model has no
  dead-letter convention for it.
- **Read model.** `CatalogDimensionsView` is an upsert on `catalogItemId`
  and is naturally idempotent.
