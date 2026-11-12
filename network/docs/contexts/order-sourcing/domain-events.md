---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: "Every CloudEvents type Order Sourcing publishes (fifteen: entity assignment, and entity policy for the sourcing policy) with topic, key, data fields, producing command and consumers, and every event it consumes with what it does and how it stays idempotent."
---

# Domain Events

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

The network's envelope rules are on
[Event standard (CloudEvents)](/network/strategic-design/event-standard-cloudevents)
and [ADR 0007](/network/adr/0007-cloudevents-namespace).

## Envelope

Every Kafka message is a CloudEvents 1.0 event in structured JSON mode.

| Attribute | Value for this context |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once per event and stored in the outbox row, so a re-delivery carries the same `id` |
| `source` | `/retailnetwork/order-sourcing` |
| `type` | `com.retailnetwork.commerce.order-sourcing.assignment.<EventName>` (tier `commerce`; entity `assignment` for every event except `SourcingPolicyPublished`, whose entity is `policy`) |
| `subject` | the `assignmentId` |
| `time` | when the transition happened, UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:order-sourcing:events:<EventName>:v1` (stream segment `analytics` for an analytics-only event) |
| Kafka topic | `retailnetwork.order-sourcing.events`; `retailnetwork.order-sourcing.analytics` for an analytics-only event |
| Kafka key | the `assignmentId`, so one assignment's events stay in order on one partition |

Every event leaves through the transactional outbox, written in the same
transaction as the aggregate. An event marked "analytics only" below goes
ONLY to `retailnetwork.order-sourcing.analytics` (never to the events topic)
and has no domain consumer; a sibling cannot consume it. The three consolidation
events and the policy event were added by wave 2.

## Published

| Event | Full `type` | Producing command | Consumers |
| --- | --- | --- | --- |
| `FulfillmentQueued` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentQueued` | `QueueAssignment` | analytics only |
| `FulfillmentReleasedToNode` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReleasedToNode` | `ReleaseToNode` | `vendor-connectivity`, `linehaul-transportation`, `seller-inbound` |
| `FulfillmentReleaseWithdrawn` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReleaseWithdrawn` | `Requeue` (a merge dissolved by a promise revision) | `vendor-connectivity` |
| `FulfillmentReassigned` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReassigned` | `ReoptimiseAssignment`, `HandleNodeRefusal` (node changed), `Requeue` (node changed) | `linehaul-transportation` |
| `FulfillmentLocked` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentLocked` | `LockAssignment` | `delivery-promise`, `customer-ordering`, `linehaul-transportation` |
| `FulfillmentShipped` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentShipped` | `MarkShipped` | `customer-ordering` |
| `FulfillmentDelivered` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentDelivered` | `MarkDelivered` | analytics only |
| `FulfillmentUnsourceable` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentUnsourceable` | `ReleaseToNode`, `HandleNodeRefusal` (no candidate left) | `delivery-promise`, `customer-ordering` |
| `FulfillmentCancelled` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentCancelled` | `CancelAssignment` | `vendor-connectivity`, `linehaul-transportation`, `customer-ordering`, `seller-inbound` |
| `FulfillmentCancelRefused` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentCancelRefused` | `RefuseCancel` | `customer-ordering` |
| `FulfillmentSourcingDecided` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentSourcingDecided` | `ReleaseToNode` | analytics only (read by this context's own projector, service ADR 0013) |
| `AssignmentsConsolidated` | `com.retailnetwork.commerce.order-sourcing.assignment.AssignmentsConsolidated` | `ReleaseConsolidated` | analytics only |
| `AssignmentsDeconsolidated` | `com.retailnetwork.commerce.order-sourcing.assignment.AssignmentsDeconsolidated` | `HandleNodeRefusal` (a merged carrier refused), `Requeue` | analytics only |
| `SourcingPolicyPublished` | `com.retailnetwork.commerce.order-sourcing.policy.SourcingPolicyPublished` | `PublishSourcingPolicy` | analytics only |

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
| `tier` | string | `SAME_DAY`, `NEXT_DAY`, `TWO_DAY` or `STANDARD`: the FULFILMENT CLASS. A `CONSOLIDATED` group is released as `STANDARD`, so the fifth tier never reaches the vendor or linehaul |
| `estimatedCostCents` | integer | Optional; omitted when the estimate is incomplete (service ADR 0011) |
| `policyVersion` | integer | Optional; the sourcing policy version the search read, present only when version 1 or more was in force (service ADR 0014) |
| `effectiveCostCents` | integer | Optional; the estimate plus the cross-region surcharge, present only when the surcharge changed the cost (service ADR 0014) |
| `lines` | array of `{catalogItemId, listingId, quantity, ownerRef?, assignmentId?}` | The whole group (fill-or-kill); `listingId` is this node's listing; `ownerRef` is the owner OwnerChoice picked, omitted when operator-owned (service ADR 0012). For a merged release the union of the members' lines in member order, each line naming its own `assignmentId` |
| `members` | array of `{assignmentId, orderId, groupNo, promiseId}` | Optional; present only on a merged release: the carrier first, then ascending `assignmentId`. Absent means a single-group release (service ADR 0015) |

No ship-to data: the release carries no PII
([ADR 0006](/network/adr/0006-pii-confinement)).

### FulfillmentReassigned

| Field | Type | Meaning |
| --- | --- | --- |
| `assignmentId` | string | The assignment |
| `fromNodeId` | string | The node it leaves (the refusing node, or the previous best candidate) |
| `toNodeId` | string | The new candidate node |
| `reason` | string | Why it moved: `REOPTIMISED`, `RELEASE_RECHECK`, `PURCHASE_ORDER_REJECTED`, `PURCHASE_ORDER_EXPIRED`, `PROMISE_REVISED` or `CONSOLIDATION_WITHDRAWN` (a member of a dissolved merge, re-searched, landed on another node) |
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
| `consolidatedInto` | string | Optional; the carrier a FOLLOWER of a merged release locks with. Omitted unless the assignment is a follower (service ADR 0015) |
| `mergedAssignmentIds` | array of string | Optional; every merged assignment id, carrier included, ascending. Omitted when the assignment is not merged. A merge has one `FulfillmentLocked` per member |

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

### FulfillmentCancelRefused

| Field | Type | Meaning |
| --- | --- | --- |
| `assignmentId` | string | The assignment |
| `orderId` | string | The customer order |
| `groupNo` | integer | The shipment group |
| `reason` | string | `CANCEL_AFTER_LOCK` (the cancel arrived after the lock) or `CANCEL_WHILE_MERGED` (the group is a member of a live merge that has not locked yet; the cancel can be retried) |

### FulfillmentReleaseWithdrawn

Subject and key: the carrier's `assignmentId`. Raised when a promise revision dissolves a merged release; `vendor-connectivity` cancels the issued purchase order of that `releaseNo`.

| Field | Type | Meaning |
| --- | --- | --- |
| `assignmentId` | string | The carrier |
| `releaseNo` | integer | The withdrawn release |
| `orderId` | string | The carrier's order |
| `groupNo` | integer | The carrier's group |
| `reason` | string | `PROMISE_REVISED` only: a cancel of a merged member is refused, not withdrawn |
| `withdrawnAt` | date-time | When the release was taken back |

### AssignmentsConsolidated

Analytics only. Raised when a release carries followers.

| Field | Type | Meaning |
| --- | --- | --- |
| `carrierAssignmentId` | string | The carrier |
| `releaseNo` | integer | The merged release |
| `nodeId` | string | The node released to |
| `memberCount` | integer | Carrier plus followers |
| `units` | integer | The sum of every member's line quantities |
| `members` | array | `assignmentId`, `orderId`, `groupNo`, `promiseId`, `units` per member |
| `consolidatedAt` | date-time | When the merge was released |

### AssignmentsDeconsolidated

Analytics only. Raised when a merge ends before the lock.

| Field | Type | Meaning |
| --- | --- | --- |
| `carrierAssignmentId` | string | The carrier |
| `releaseNo` | integer | The dissolved release |
| `reason` | string | `PROMISE_REVISED`, `PURCHASE_ORDER_REJECTED` or `PURCHASE_ORDER_EXPIRED` |
| `triggerAssignmentId` | string | Optional; the member whose promise revision broke the merged delivery; omitted for a purchase order refusal |
| `memberAssignmentIds` | array of string | Every member |
| `deconsolidatedAt` | date-time | When the merge was dissolved |

### SourcingPolicyPublished

Analytics only. Subject and Kafka key `policy`, entity `policy`. Raised in the same transaction as the save of version n + 1.

| Field | Type | Meaning |
| --- | --- | --- |
| `version` | integer | The published version |
| `crossRegionSurchargeCents` | integer | 0 to 100000 |
| `maxCostDeviationPercent` | integer | 0 to 200 |
| `consolidationMaxAssignments` | integer | Optional; 0 to 10, 0 and 1 mean consolidation is off |
| `publishedAt` | date-time | When it was published |

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
| `customer-ordering` | `CustomerOrderPlaced` | `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderPlaced` | `orderId`, `destinationPostalPrefix`, optional `consolidationKey`, `groups(groupNo, promiseId, tier (five values, `CONSOLIDATED` included), witnessNodeId, optional deliverByEarliest, deliverByLatest, lines(lineNo, catalogItemId, quantity))` | `QueueAssignment` per group; `SAME_DAY` groups go straight to `ReleaseToNode` | one assignment per (`orderId`, `groupNo`); a repeat finds it and does nothing |
| `customer-ordering` | `CustomerOrderCancelled` | `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderCancelled` | `orderId`, `groupNos`, `reason` | `CancelAssignment` for each listed group | an already `CANCELLED` assignment is left as is |
| `delivery-promise` | `PromiseRevised` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseRevised` | `promiseId`, `revisionNo`, optional `deliverByEarliest`, `deliverByLatest`, `nodeId` (new witness) | `ApplyRevisedPromise` on the `UNSOURCEABLE` assignment of that promise | applied from `UNSOURCEABLE`; also from `RELEASED`, where a revised window that excludes the merged `eta` dissolves a consolidation merge (`PROMISE_REVISED`); a lower or equal `revisionNo` than the last applied is ignored |
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
