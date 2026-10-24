---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: The two events Node Performance publishes and the fifteen it consumes, with full CloudEvents types, payloads and idempotency rules.
---

# Domain Events

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Every event this context publishes (`contexts[node-performance].publishes`)
and consumes (`.consumes`), with the envelope rules of
`conventions.cloudevents` ([event standard](/network/strategic-design/event-standard-cloudevents),
[ADR 0007](/network/adr/0007-cloudevents-namespace)).

## Envelope

| Attribute | Value |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once when the event is written to the outbox; a redelivery carries the same `id` |
| `source` | `/retailnetwork/node-performance` |
| `type` | `com.retailnetwork.partner.node-performance.scorecard.<EventName>` (tier `partner`, entity `scorecard` for both events) |
| `subject` | the aggregate root id, `scorecardId = nodeId + ':' + window` (for example `N-0042:30d`) |
| `time` | the instant the recompute ran (`computedAt` for `NodeScorecardUpdated`) |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:node-performance:events:<EventName>:v1` |
| Kafka topic | `retailnetwork.node-performance.events` |
| Kafka key | the `scorecardId`, same as `subject` |

## Published

### NodeScorecardUpdated

| | |
| --- | --- |
| **Type** | `com.retailnetwork.partner.node-performance.scorecard.NodeScorecardUpdated` |
| **Topic** | `retailnetwork.node-performance.events` |
| **Subject / key** | `scorecardId` (`nodeId:window`) |
| **Produced by** | `Recompute` use case, after the scorecard is saved (outbox row in the same transaction) |
| **Consumers** | `delivery-promise` (`ScorecardView`, `ScorecardHandicap`), `order-sourcing` (`ScorecardView`, `AssignmentCost`) |

| Field | Type | Meaning |
| --- | --- | --- |
| `nodeId` | string | The node, as minted by `node-topology`. |
| `window` | string | `7d` or `30d` (literal proposed; the model says "7-day and 30-day"). |
| `grade` | string | `A`, `B`, `C`, `D`, or `PROVISIONAL` below the observation minimum (the `ul` definition of Grade). |
| `onTimeHandoverRate` | number in `[0,1]` | Share of packages handed over before `requiredShipBy`. |
| `lateAckRate` | number in `[0,1]` | Share of purchase orders acknowledged in the last 10% of the window or expired. |
| `rejectRate` | number in `[0,1]` | From `PurchaseOrderRejected` observations. |
| `expiryRate` | number in `[0,1]` | From `PurchaseOrderExpired` observations. |
| `promiseKeptRate` | number in `[0,1]` | From `PromiseKept` and `PromiseBroken` observations. |
| `feedFreshnessP95Minutes` | number, minutes | p95 feed freshness from `InventoryFeedApplied` observations. |
| `observations` | integer | Observations counted in the window. |
| `computedAt` | RFC 3339 instant | When the recompute ran. |

### NodeThresholdBreached

| | |
| --- | --- |
| **Type** | `com.retailnetwork.partner.node-performance.scorecard.NodeThresholdBreached` |
| **Topic** | `retailnetwork.node-performance.events` |
| **Subject / key** | `scorecardId` |
| **Produced by** | `Recompute` use case, `ThresholdAlert` policy, one event per metric that crossed its threshold downward in this recompute |
| **Consumers** | analytics only (no in-organization consumer) |

| Field | Type | Meaning |
| --- | --- | --- |
| `nodeId` | string | The node. |
| `metric` | string | The `Metrics` field name that crossed, for example `onTimeHandoverRate`. |
| `value` | number | The metric's new value. |
| `threshold` | number | The threshold it crossed. |
| `window` | string | `7d` or `30d`. |

The model does not say whether an "analytics only" event goes to the
`.events` topic or to `retailnetwork.node-performance.analytics`
(`conventions.cloudevents.analytics_topic`). These pages put both
published events on `.events`, because both are in `publishes`; this is
listed as an open question.

### Example envelope

The most important event is `NodeScorecardUpdated`: it is the only output
other contexts act on.

```json
{
  "specversion": "1.0",
  "id": "7d0c6a52-3f7e-4b8e-9a51-2a8f0c1d9e44",
  "source": "/retailnetwork/node-performance",
  "type": "com.retailnetwork.partner.node-performance.scorecard.NodeScorecardUpdated",
  "subject": "N-0042:30d",
  "time": "2026-10-22T14:03:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:node-performance:events:NodeScorecardUpdated:v1",
  "data": {
    "nodeId": "N-0042",
    "window": "30d",
    "grade": "B",
    "onTimeHandoverRate": 0.962,
    "lateAckRate": 0.021,
    "rejectRate": 0.012,
    "expiryRate": 0.004,
    "promiseKeptRate": 0.951,
    "feedFreshnessP95Minutes": 38,
    "observations": 1874,
    "computedAt": "2026-10-22T14:03:00Z"
  }
}
```

The values are illustrative. Grade `B`: on-time `0.962 >= 0.95`,
promise-kept `0.951 >= 0.94`, late ack `0.021 <= 0.03`, and on-time below
the `A` bar of `0.98`.

## Consumed

Every consumer dispatches on the full `type` string and is idempotent on
the CloudEvents `id`: the `processed_events` inbox row and the aggregate
change commit in one transaction. A duplicate `id` is acknowledged and
skipped. If the inbox misses (for example the same fact re-emitted with a
new `id`, which the producers' outboxes rule out), the aggregate's
`ErrDuplicateObservation` stops a second count of the same source event.

| Producer | Full `type` | Fields used | What this context does |
| --- | --- | --- | --- |
| `vendor-connectivity` | `com.retailnetwork.partner.vendor-connectivity.vendoraccount.VendorOnboarded` | none | Nothing the model specifies. The payload (`vendorId`, `name`, `ackWindowMinutes`) has no `nodeId`; the inbox records it. Open question. |
| `vendor-connectivity` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderIssued` | `poNumber`, `nodeId`, `requiredShipBy`, `ackBy`; envelope `time` as the issue instant | `RecordObservation`: a PO was asked of the node. Denominator of the PO rates; source of `requiredShipBy` for later handovers. |
| `vendor-connectivity` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderAccepted` | `poNumber`, `nodeId`, `acceptedAt` | `RecordObservation`: an acknowledgement. Late if `acceptedAt` falls in the last 10% of the ack window. |
| `vendor-connectivity` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderRejected` | `poNumber`, `nodeId`, `reasonCode`, `rejectedAt` | `RecordObservation`: a rejection (reject rate) and an acknowledgement (late-ack check). |
| `vendor-connectivity` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderExpired` | `poNumber`, `nodeId`, `ackBy` | `RecordObservation`: an expiry (expiry rate; always late for the Late Ack Rate). |
| `vendor-connectivity` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.VendorShipmentConfirmed` | `poNumber`, `nodeId`, `trackingNumbers`, `requiredShipBy` | `RecordObservation`: links tracking numbers to the PO's `requiredShipBy`. `shippedAt` is the vendor's own statement and is **not** used for on-time; the handover is. |
| `vendor-connectivity` | `com.retailnetwork.partner.vendor-connectivity.submission.SubmissionProcessed` | none | Nothing the model specifies. The payload (`transactionId`, `vendorId`, `kind`, `status`, `errorCount`) has no `nodeId`, so it cannot reach a node scorecard. Open question. |
| `shipping-and-tracking` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageHandedOver` | `trackingNumber`, `poNumber`, `nodeId`, `handedOverAt` | `RecordObservation`: on time if `handedOverAt` is before the PO's `requiredShipBy`. |
| `delivery-promise` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseKept` | `promiseId`, `nodeId`, `deliveredAt`, `deliverByLatest` | `RecordObservation`: a kept promise for the node. |
| `delivery-promise` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseBroken` | `promiseId`, `nodeId`, `lateByMinutes`, `cause` | `RecordObservation`: a broken promise for the node. Which `cause` values count against the node is open. |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.inventoryfeed.InventoryFeedApplied` | `feedId`, `nodeId`, `appliedAt` | `RecordObservation`: a feed instant for the freshness metric. The sampling rule is open. |
| `vendor-connectivity` | `com.retailnetwork.partner.vendor-connectivity.submission.InboundReceiptSubmitted` | `nodeId`, `shipmentId`, `receivedAt`, `cartons[].status` | `RecordObservation` (informational, proposed in ADR 0009): timeliness is `receivedAt` minus the shipment's `shippedAt` (kept from `InboundShipmentShipped`), accuracy is the share of reported cartons with status `RECEIVED`. Never graded, and not on `NodeScorecardUpdated`. |
| `seller-inbound` | `com.retailnetwork.partner.seller-inbound.inboundshipment.InboundShipmentShipped` | `shipmentId`, `nodeId`, `shippedAt` | `RecordObservation` (informational): stores the shipment's shipped instant for the timeliness metric. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeRegistered` | none | Nothing the model specifies; the inbox records it. A node's scorecards are created by its first observation. Open question. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeOperationalProfileDeclared` | none | Nothing the model specifies. It is the declared side of Declared vs Measured, and by decision it never enters a metric; no read model holds it. Open question. |

Partition order: each producer keys by its own aggregate root id
(`poNumber`, `trackingNumber`, `promiseId`, `feedId`, `nodeId`), so facts
about one node arrive on many partitions in no global order. The
scorecard does not depend on arrival order: a handover that arrives
before its `PurchaseOrderIssued` or `VendorShipmentConfirmed` is kept and
counted when `Recompute` finds its `requiredShipBy`.
