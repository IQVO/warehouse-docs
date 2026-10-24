---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: "Every CloudEvents type Order Sourcing publishes (eight, entity assignment) with topic, key, data fields, producing command and consumers, and every event it consumes with what it does and how it stays idempotent."
---

# Domain Events

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

The network's envelope rules are on
[Event standard (CloudEvents)](/strategic-design/event-standard-cloudevents)
and [ADR 0007](/adr/0007-cloudevents-namespace).

## Envelope

Every Kafka message is a CloudEvents 1.0 event in structured JSON mode.

| Attribute | Value for this context |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once per event and stored in the outbox row, so a re-delivery carries the same `id` |
| `source` | `/retailnetwork/order-sourcing` |
| `type` | `com.retailnetwork.commerce.order-sourcing.assignment.<EventName>` (tier `commerce`, entity `assignment` for every event) |
| `subject` | the `assignmentId` |
| `time` | when the transition happened, UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:order-sourcing:events:<EventName>:v1` |
| Kafka topic | `retailnetwork.order-sourcing.events` |
| Kafka key | the `assignmentId`, so one assignment's events stay in order on one partition |

Every event leaves through the transactional outbox, written in the same
transaction as the aggregate. The conventions also define an analytics topic,
`retailnetwork.order-sourcing.analytics`; no entry of this context names it,
so "analytics only" below means "published on the events topic with no
domain consumer".

## Published

| Event | Full `type` | Producing command | Consumers |
| --- | --- | --- | --- |
| `FulfillmentQueued` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentQueued` | `QueueAssignment` | analytics only |
| `FulfillmentReleasedToNode` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReleasedToNode` | `ReleaseToNode` | `vendor-connectivity`, `linehaul-transportation` |
| `FulfillmentReassigned` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReassigned` | `ReoptimiseAssignment`, `HandleNodeRefusal` (node changed) | `linehaul-transportation` |
| `FulfillmentLocked` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentLocked` | `LockAssignment` | `delivery-promise`, `customer-ordering`, `linehaul-transportation` |
| `FulfillmentShipped` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentShipped` | `MarkShipped` | `customer-ordering` |
| `FulfillmentDelivered` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentDelivered` | `MarkDelivered` | analytics only |
| `FulfillmentUnsourceable` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentUnsourceable` | `ReleaseToNode`, `HandleNodeRefusal` (no candidate left) | `delivery-promise`, `customer-ordering` |
| `FulfillmentCancelled` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentCancelled` | `CancelAssignment` | `vendor-connectivity`, `linehaul-transportation` |

The field lists below are the model's `publishes[*].data`, in order. Types
are the proposed JSON types; the model gives names only.

### FulfillmentQueued

| Field | Type | Meaning |
| --- | --- | --- |
| `assignmentId` | string | The new assignment |
| `orderId` | string | The customer order |
| `groupNo` | integer | The shipment group within the order |
| `promiseId` | string | The promise this assignment must keep |
| `deliverByLatest` | date-time | The binding deadline |
| `lines` | array | The group's lines as received in `CustomerOrderPlaced` (`lineNo`, `catalogItemId`, `quantity`); no `listingId` yet, because no node is chosen |

### FulfillmentReleasedToNode

| Field | Type | Meaning |
| --- | --- | --- |
| `assignmentId` | string | The assignment |
| `releaseNo` | integer | 1 for the first release, +1 for each later one; with `assignmentId` it is the purchase order's idempotency key |
| `orderId` | string | The customer order |
| `groupNo` | integer | The shipment group |
| `nodeId` | string | The vendor node released to |
| `pickupDepartureId` | string | The pickup departure the group must make |
| `requiredShipBy` | date-time | That departure's cutoff at this node |
| `promisedDeliverByLatest` | date-time | The promise's `deliverByLatest` |
| `tier` | string | `SAME_DAY`, `NEXT_DAY`, `TWO_DAY` or `STANDARD` |
| `lines` | array of `{catalogItemId, listingId, quantity}` | The whole group (fill-or-kill); `listingId` is this node's listing |

No ship-to data: the release carries no PII
([ADR 0006](/adr/0006-pii-confinement)).

### FulfillmentReassigned

| Field | Type | Meaning |
| --- | --- | --- |
| `assignmentId` | string | The assignment |
| `fromNodeId` | string | The node it leaves (the refusing node, or the previous best candidate) |
| `toNodeId` | string | The new candidate node |
| `reason` | string | Why it moved; values are not enumerated in the model |
| `assignmentVersion` | integer | The version after the change, so consumers can drop stale copies |

### FulfillmentLocked

| Field | Type | Meaning |
| --- | --- | --- |
| `assignmentId` | string | The assignment |
| `orderId` | string | The customer order |
| `groupNo` | integer | The shipment group |
| `nodeId` | string | The node that accepted |
| `pickupDepartureId` | string | The pickup departure the package will make |
| `lockedAt` | date-time | When the acceptance was applied |
| `lockReason` | string | Why it locked; the only trigger the model names is `PurchaseOrderAccepted` |

### FulfillmentShipped

| Field | Type | Meaning |
| --- | --- | --- |
| `assignmentId` | string | The assignment |
| `orderId` | string | The customer order |
| `groupNo` | integer | The shipment group |
| `nodeId` | string | The shipping node |
| `trackingNumbers` | array of string | One per package |
| `shippedAt` | date-time | From `VendorShipmentConfirmed` |

### FulfillmentDelivered

| Field | Type | Meaning |
| --- | --- | --- |
| `assignmentId` | string | The assignment |
| `orderId` | string | The customer order |
| `groupNo` | integer | The shipment group |
| `deliveredAt` | date-time | From `PackageDelivered` |

### FulfillmentUnsourceable

| Field | Type | Meaning |
| --- | --- | --- |
| `assignmentId` | string | The assignment |
| `orderId` | string | The customer order |
| `groupNo` | integer | The shipment group |
| `promiseId` | string | The promise to revise |
| `excludedNodes` | array of `{nodeId, reason}` | Every node that refused, so the re-promise can avoid them |
| `reason` | string | Why no candidate is left; values are not enumerated in the model |

### FulfillmentCancelled

| Field | Type | Meaning |
| --- | --- | --- |
| `assignmentId` | string | The assignment |
| `orderId` | string | The customer order |
| `groupNo` | integer | The shipment group |
| `reason` | string | From `CustomerOrderCancelled.reason` |

### Example envelope

The most important event: the release that becomes a purchase order.

```json
{
  "specversion": "1.0",
  "id": "0c9f7a52-6a1e-4b8e-9d3f-2f6b1f0e8a41",
  "source": "/retailnetwork/order-sourcing",
  "type": "com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReleasedToNode",
  "subject": "asg-7f3c2d10",
  "time": "2026-10-22T14:05:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:order-sourcing:events:FulfillmentReleasedToNode:v1",
  "data": {
    "assignmentId": "asg-7f3c2d10",
    "releaseNo": 1,
    "orderId": "ord-51a0c9",
    "groupNo": 1,
    "nodeId": "node-fc-ws-sor-01",
    "pickupDepartureId": "dep-pk-20261022-1800-fc-ws-sor-01",
    "requiredShipBy": "2026-10-22T21:00:00Z",
    "promisedDeliverByLatest": "2026-10-24T23:00:00Z",
    "tier": "TWO_DAY",
    "lines": [
      {"catalogItemId": "cat-000123", "listingId": "lst-000123-fc-ws-sor-01", "quantity": 2},
      {"catalogItemId": "cat-000987", "listingId": "lst-000987-fc-ws-sor-01", "quantity": 1}
    ]
  }
}
```

The identifiers are illustrative; the model fixes no id format.

## Consumed

Every consumer is idempotent on the CloudEvents `id` through the inbox table
`processed_events`, written in the same transaction as the change it causes,
and dispatches on the **full** `type` string, never on a suffix. Domain-level
idempotency comes on top, per row below.

### Events that drive the aggregate

| Producer | Event | Full `type` | Fields used | What this context does | Domain idempotency |
| --- | --- | --- | --- | --- | --- |
| `customer-ordering` | `CustomerOrderPlaced` | `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderPlaced` | `orderId`, `destinationPostalPrefix`, `groups(groupNo, promiseId, tier, witnessNodeId, deliverByLatest, lines(lineNo, catalogItemId, quantity))` | `QueueAssignment` per group; `SAME_DAY` groups go straight to `ReleaseToNode` | one assignment per (`orderId`, `groupNo`); a repeat finds it and does nothing |
| `customer-ordering` | `CustomerOrderCancelled` | `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderCancelled` | `orderId`, `groupNos`, `reason` | `CancelAssignment` for each listed group | an already `CANCELLED` assignment is left as is |
| `delivery-promise` | `PromiseRevised` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseRevised` | `promiseId`, `revisionNo`, `deliverByLatest`, `nodeId` (new witness) | `ApplyRevisedPromise` on the `UNSOURCEABLE` assignment of that promise | applied only from `UNSOURCEABLE`; a lower or equal `revisionNo` than the last applied is ignored |
| `vendor-connectivity` | `PurchaseOrderAccepted` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderAccepted` | `assignmentId`, `releaseNo`, `nodeId`, `acceptedAt` | `LockAssignment` (`LockOnCommit`) | only if `releaseNo` is the current `PENDING` release; a repeat on a `LOCKED` assignment is a no-op |
| `vendor-connectivity` | `PurchaseOrderRejected` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderRejected` | `assignmentId`, `releaseNo`, `nodeId`, `reasonCode`, `rejectedAt` | `HandleNodeRefusal` with outcome `REJECTED` (`ReassignOnRefusal`) | only for the current `PENDING` release; an older `releaseNo` is ignored |
| `vendor-connectivity` | `PurchaseOrderExpired` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderExpired` | `assignmentId`, `releaseNo`, `nodeId`, `ackBy` | `HandleNodeRefusal` with outcome `EXPIRED` | as above |
| `vendor-connectivity` | `VendorShipmentConfirmed` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.VendorShipmentConfirmed` | `assignmentId`, `nodeId`, `trackingNumbers`, `shippedAt` | `MarkShipped` | a repeat on a `SHIPPED` assignment is a no-op |
| `shipping-and-tracking` | `PackageDelivered` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageDelivered` | `assignmentId`, `trackingNumber`, `deliveredAt` | `MarkDelivered` | a repeat on a `DELIVERED` assignment is a no-op; multi-package rule is an open question |

### Events that feed read models

| Producer | Events (full `type`) | Read model | Idempotency |
| --- | --- | --- | --- |
| `delivery-promise` | `com.retailnetwork.commerce.delivery-promise.promisebook.PromiseBookExhausted` | `PromiseBookPressureView` (`bookId`, `nodeId`, `pickupDepartureId`, `share`) | upsert by `bookId` |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeRegistered`, `com.retailnetwork.logistics.node-topology.node.NodeOperationalProfileDeclared`, `com.retailnetwork.logistics.node-topology.node.NodeActivated`, `com.retailnetwork.logistics.node-topology.node.NodeSuspended`, `com.retailnetwork.logistics.node-topology.node.NodeRetired` | `NodeProfileView` | upsert by `nodeId`; a profile with a lower `profileRevision` is ignored |
| `node-topology` | `com.retailnetwork.logistics.node-topology.lane.LaneOpened`, `com.retailnetwork.logistics.node-topology.lane.LaneClosed`, `com.retailnetwork.logistics.node-topology.servicearea.ServiceAreaAssigned`, `com.retailnetwork.logistics.node-topology.region.RegionDefined` | `NetworkGraphView` | upsert by `laneId`, `postalPrefix` (newer `assignmentVersion` wins), `regionId` |
| `linehaul-transportation` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureScheduled`, `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureCapacityChanged`, `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureCancelled` | `NetworkGraphView` | upsert by `departureId` |
| `last-mile-delivery` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveScheduled`, `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveCapacityChanged` | `NetworkGraphView` | upsert by `waveId` |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.listing.ListingCreated`, `com.retailnetwork.commerce.offer-availability.listing.ListingAvailabilityChanged`, `com.retailnetwork.commerce.offer-availability.listing.ListingSuppressed`, `com.retailnetwork.commerce.offer-availability.listing.ListingRestored`, `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemDiscontinued` | `AvailabilityView` | upsert by `listingId` / `catalogItemId`; an availability with an older `asOf` is ignored |
| `node-performance` | `com.retailnetwork.partner.node-performance.scorecard.NodeScorecardUpdated` | `ScorecardView` | upsert by (`nodeId`, `window`); an older `computedAt` is ignored |

A read-model change does not itself move an assignment. Queued assignments
pick it up at the next re-optimisation sweep (`ReoptimiseAssignment`).

Derived from: model.yaml → `contexts[order-sourcing].publishes`,
`.consumes`, `.read_models`, `.policies`; the producers' `publishes[*].data`;
`conventions.cloudevents`, `conventions.integration_rules`.
