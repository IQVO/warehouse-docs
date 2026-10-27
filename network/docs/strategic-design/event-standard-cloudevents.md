---
id: event-standard-cloudevents
title: Event Standard (CloudEvents)
sidebar_label: Event Standard
description: "The CloudEvents 1.0 envelope, naming and topic rules every retail-network event follows, and the full catalogue of event types."
---

# Event Standard (CloudEvents)

:::info[Generated from the model]
This page is generated from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
:::


Every Kafka message in the network is a CloudEvents 1.0 structured JSON
envelope, the same rule the warehouse-systems fleet applies to itself. The
namespace is different on purpose (see
[ADR 0007](/network/adr/0007-cloudevents-namespace)): the two organizations share no
topic, so no consumer can mistake one organization's event for the other's.

| Attribute | Rule |
| --- | --- |
| `specversion` | `1.0` |
| `type` | `com.retailnetwork.<tier>.<context>.<entity>.<EventName>` (`<entity>` is the lower-case name of the aggregate or read-side model that raises the event, exactly the entity field of the published event below. Consumers dispatch on the full type string.) |
| `source` | `/retailnetwork/<context>` |
| `subject` | aggregate root id (also the Kafka partition key) |
| `dataschema` | `urn:retailnetwork:<context>:events:<EventName>:v1` |
| `datacontenttype` | `application/json` |
| `id` | UUID; consumers are idempotent on it (inbox table `processed_events`) |
| `time` | the instant the fact became true, not the publish time |
| Topic | `retailnetwork.<context>.events` (integration), `retailnetwork.<context>.analytics` (analytics) |

Tiers (the `<tier>` segment):

| Tier | Contexts |
| --- | --- |
| `commerce` | `offer-availability`, `delivery-promise`, `customer-ordering`, `order-sourcing` |
| `logistics` | `node-topology`, `linehaul-transportation`, `last-mile-delivery`, `shipping-and-tracking` |
| `partner` | `vendor-connectivity`, `node-performance`, `seller-inbound` |

Integration rules carried by every context:

- Every context owns its database; no shared tables.
- Every published event leaves through a transactional outbox.
- Every consumer is idempotent on the CloudEvents id (inbox table).
- Consumers dispatch on the full type string, never on a suffix.
- Sibling data used in a decision is a local, event-fed read model; the promise hot path makes no synchronous call.
- Synchronous in-organization calls exist only where a caller needs an answer inside a user or vendor request (listed under sync_calls).

## Example envelope

```json
{
  "specversion": "1.0",
  "id": "7b1d3f0e-2c4a-4f7e-9a51-3c2b8e6d1f20",
  "source": "/retailnetwork/order-sourcing",
  "type": "com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReleasedToNode",
  "subject": "asg-01J9Z6Q8K2",
  "time": "2026-10-22T14:05:11Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:order-sourcing:events:FulfillmentReleasedToNode:v1",
  "data": {
    "assignmentId": "asg-01J9Z6Q8K2",
    "releaseNo": 1,
    "orderId": "co-88231",
    "groupNo": 1,
    "nodeId": "N-VWS-AUS3",
    "pickupDepartureId": "dep-AUS3-20261022-1800",
    "requiredShipBy": "2026-10-22T23:00:00Z",
    "promisedDeliverByLatest": "2026-10-23T21:00:00Z",
    "tier": "NEXT_DAY",
    "lines": [{"catalogItemId": "ci-1001", "listingId": "lst-1001-AUS3", "quantity": 2}]
  }
}
```

## Event catalogue

### `node-topology`

Topic `retailnetwork.node-topology.events`.

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `NodeRegistered` | `com.retailnetwork.logistics.node-topology.node.NodeRegistered` | `offer-availability`, `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `last-mile-delivery`, `node-performance`, `vendor-connectivity`, `seller-inbound` |
| `NodeOperationalProfileDeclared` | `com.retailnetwork.logistics.node-topology.node.NodeOperationalProfileDeclared` | `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `node-performance`, `vendor-connectivity`, `seller-inbound` |
| `NodeActivated` | `com.retailnetwork.logistics.node-topology.node.NodeActivated` | `offer-availability`, `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `vendor-connectivity`, `seller-inbound` |
| `NodeSuspended` | `com.retailnetwork.logistics.node-topology.node.NodeSuspended` | `offer-availability`, `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `vendor-connectivity`, `seller-inbound` |
| `NodeRetired` | `com.retailnetwork.logistics.node-topology.node.NodeRetired` | `offer-availability`, `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `vendor-connectivity`, `seller-inbound` |
| `LaneOpened` | `com.retailnetwork.logistics.node-topology.lane.LaneOpened` | `linehaul-transportation`, `delivery-promise`, `order-sourcing` |
| `LaneClosed` | `com.retailnetwork.logistics.node-topology.lane.LaneClosed` | `linehaul-transportation`, `delivery-promise`, `order-sourcing` |
| `ServiceAreaAssigned` | `com.retailnetwork.logistics.node-topology.servicearea.ServiceAreaAssigned` | `delivery-promise`, `order-sourcing`, `last-mile-delivery` |
| `RegionDefined` | `com.retailnetwork.logistics.node-topology.region.RegionDefined` | `delivery-promise`, `order-sourcing` |

### `offer-availability`

Topic `retailnetwork.offer-availability.events`.

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `CatalogItemCreated` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemCreated` | `delivery-promise`, `shipping-and-tracking` |
| `CatalogItemDiscontinued` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemDiscontinued` | `delivery-promise`, `order-sourcing` |
| `CatalogItemPackagingDeclared` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemPackagingDeclared` | `seller-inbound`, `vendor-connectivity` |
| `CatalogItemPackLevelRetired` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemPackLevelRetired` | `seller-inbound`, `vendor-connectivity` |
| `ListingCreated` | `com.retailnetwork.commerce.offer-availability.listing.ListingCreated` | `delivery-promise`, `order-sourcing`, `vendor-connectivity` |
| `ListingAvailabilityChanged` | `com.retailnetwork.commerce.offer-availability.listing.ListingAvailabilityChanged` | `delivery-promise`, `order-sourcing` |
| `ListingSuppressed` | `com.retailnetwork.commerce.offer-availability.listing.ListingSuppressed` | `delivery-promise`, `order-sourcing` |
| `ListingRestored` | `com.retailnetwork.commerce.offer-availability.listing.ListingRestored` | `delivery-promise`, `order-sourcing` |
| `InventoryFeedApplied` | `com.retailnetwork.commerce.offer-availability.inventoryfeed.InventoryFeedApplied` | `node-performance` |

### `delivery-promise`

Topic `retailnetwork.delivery-promise.events`.

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `PromiseMade` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseMade` | analytics only |
| `PromiseConfirmed` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseConfirmed` | analytics only |
| `PromiseAtRisk` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseAtRisk` | `customer-ordering` |
| `PromiseRevised` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseRevised` | `customer-ordering`, `order-sourcing` |
| `PromiseKept` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseKept` | `node-performance`, `customer-ordering` |
| `PromiseBroken` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseBroken` | `node-performance`, `customer-ordering` |
| `PromiseReleased` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseReleased` | analytics only |
| `PromiseCancelled` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseCancelled` | analytics only |
| `PromiseBookExhausted` | `com.retailnetwork.commerce.delivery-promise.promisebook.PromiseBookExhausted` | `order-sourcing` |
| `PromiseUnkeepable` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseUnkeepable` | `customer-ordering` |
| `DeliveryOfferQuoted` | `com.retailnetwork.commerce.delivery-promise.deliveryoffer.DeliveryOfferQuoted` | analytics only |
| `PromisePolicyPublished` | `com.retailnetwork.commerce.delivery-promise.promisepolicy.PromisePolicyPublished` | analytics only |

### `customer-ordering`

Topic `retailnetwork.customer-ordering.events`.

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `CustomerOrderPlaced` | `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderPlaced` | `order-sourcing`, `delivery-promise` |
| `CustomerOrderCancelled` | `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderCancelled` | `order-sourcing`, `delivery-promise` |

### `order-sourcing`

Topic `retailnetwork.order-sourcing.events`.

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `FulfillmentQueued` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentQueued` | analytics only |
| `FulfillmentReleasedToNode` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReleasedToNode` | `vendor-connectivity`, `linehaul-transportation` |
| `FulfillmentReassigned` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReassigned` | `linehaul-transportation` |
| `FulfillmentLocked` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentLocked` | `delivery-promise`, `customer-ordering`, `linehaul-transportation` |
| `FulfillmentShipped` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentShipped` | `customer-ordering`, `delivery-promise` |
| `FulfillmentDelivered` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentDelivered` | analytics only |
| `FulfillmentUnsourceable` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentUnsourceable` | `delivery-promise`, `customer-ordering` |
| `FulfillmentCancelled` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentCancelled` | `vendor-connectivity`, `linehaul-transportation`, `customer-ordering` |
| `FulfillmentCancelRefused` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentCancelRefused` | `customer-ordering` |
| `FulfillmentConstraintRevised` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentConstraintRevised` | analytics only |

### `vendor-connectivity`

Topic `retailnetwork.vendor-connectivity.events`.

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `VendorOnboarded` | `com.retailnetwork.partner.vendor-connectivity.vendoraccount.VendorOnboarded` | `node-performance` |
| `PurchaseOrderIssued` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderIssued` | `node-performance` |
| `PurchaseOrderAccepted` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderAccepted` | `order-sourcing`, `node-performance` |
| `PurchaseOrderRejected` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderRejected` | `order-sourcing`, `node-performance` |
| `PurchaseOrderExpired` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderExpired` | `order-sourcing`, `node-performance` |
| `PurchaseOrderCancelled` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderCancelled` | analytics only |
| `VendorShipmentConfirmed` | `com.retailnetwork.partner.vendor-connectivity.purchaseorder.VendorShipmentConfirmed` | `order-sourcing`, `shipping-and-tracking`, `node-performance` |
| `SubmissionProcessed` | `com.retailnetwork.partner.vendor-connectivity.submission.SubmissionProcessed` | `node-performance` |
| `InboundReceiptSubmitted` | `com.retailnetwork.partner.vendor-connectivity.inboundreceipt.InboundReceiptSubmitted` | `seller-inbound`, `node-performance` |
| `VendorSuspended` | `com.retailnetwork.partner.vendor-connectivity.vendoraccount.VendorSuspended` | analytics only |
| `VendorReinstated` | `com.retailnetwork.partner.vendor-connectivity.vendoraccount.VendorReinstated` | analytics only |

### `linehaul-transportation`

Topic `retailnetwork.linehaul-transportation.events`.

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `DepartureScheduled` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureScheduled` | `delivery-promise`, `order-sourcing` |
| `DepartureCapacityChanged` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureCapacityChanged` | `delivery-promise`, `order-sourcing` |
| `DepartureCancelled` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureCancelled` | `delivery-promise`, `order-sourcing` |
| `DepartureDeparted` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureDeparted` | analytics only |
| `DepartureArrived` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureArrived` | analytics only |
| `LoadClosed` | `com.retailnetwork.logistics.linehaul-transportation.load.LoadClosed` | analytics only |
| `LoadDeparted` | `com.retailnetwork.logistics.linehaul-transportation.load.LoadDeparted` | `shipping-and-tracking` |
| `LoadArrived` | `com.retailnetwork.logistics.linehaul-transportation.load.LoadArrived` | `shipping-and-tracking`, `last-mile-delivery` |
| `BookingMoved` | `com.retailnetwork.logistics.linehaul-transportation.departure.BookingMoved` | `delivery-promise`, `order-sourcing` |
| `BookingFailed` | `com.retailnetwork.logistics.linehaul-transportation.departure.BookingFailed` | `delivery-promise`, `order-sourcing` |

### `last-mile-delivery`

Topic `retailnetwork.last-mile-delivery.events`.

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `DeliveryWaveScheduled` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveScheduled` | `delivery-promise`, `order-sourcing` |
| `DeliveryWaveCapacityChanged` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveCapacityChanged` | `delivery-promise`, `order-sourcing` |
| `DeliveryWaveCancelled` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveCancelled` | `delivery-promise`, `order-sourcing` |
| `RoutePlanned` | `com.retailnetwork.logistics.last-mile-delivery.route.RoutePlanned` | analytics only |
| `PackageOutForDelivery` | `com.retailnetwork.logistics.last-mile-delivery.route.PackageOutForDelivery` | `shipping-and-tracking` |
| `DeliveryAttempted` | `com.retailnetwork.logistics.last-mile-delivery.route.DeliveryAttempted` | `shipping-and-tracking` |
| `PackageInductionDeferred` | `com.retailnetwork.logistics.last-mile-delivery.packageattempthistory.PackageInductionDeferred` | `delivery-promise` |
| `PackageReturnInitiated` | `com.retailnetwork.logistics.last-mile-delivery.packageattempthistory.PackageReturnInitiated` | `shipping-and-tracking` |

### `shipping-and-tracking`

Topic `retailnetwork.shipping-and-tracking.events`.

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `LabelIssued` | `com.retailnetwork.logistics.shipping-and-tracking.label.LabelIssued` | `linehaul-transportation`, `customer-ordering`, `last-mile-delivery` |
| `LabelVoided` | `com.retailnetwork.logistics.shipping-and-tracking.label.LabelVoided` | `customer-ordering`, `linehaul-transportation` |
| `PackageScanned` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageScanned` | `customer-ordering` |
| `PackageHandedOver` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageHandedOver` | `node-performance` |
| `PackageDelivered` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageDelivered` | `delivery-promise`, `order-sourcing`, `customer-ordering` |
| `PackageExceptionRaised` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageExceptionRaised` | `delivery-promise`, `customer-ordering` |
| `PackageReturned` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageReturned` | `delivery-promise`, `customer-ordering` |
| `PackageLost` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageLost` | `delivery-promise`, `customer-ordering` |

### `node-performance`

Topic `retailnetwork.node-performance.events`.

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `NodeScorecardUpdated` | `com.retailnetwork.partner.node-performance.scorecard.NodeScorecardUpdated` | `delivery-promise`, `order-sourcing` |
| `NodeThresholdBreached` | `com.retailnetwork.partner.node-performance.scorecard.NodeThresholdBreached` | analytics only |

### `seller-inbound`

Topic `retailnetwork.seller-inbound.events`.

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

## Reason vocabularies

Closed vocabularies of reason-like fields (`reason`, `cause`, `kind`, `outcome`), one block per owning context, from `contexts[*].reasons` in the model. A value is listed only when the spec or the domain code of the built service has it. Fields that carry free text are not listed. A consumer line names a consumer that branches on a value; consumers that only store the text are not listed.

### Reasons of `offer-availability`

**`ListingSuppressionReason`**: Why a listing is SUPPRESSED.

Appears in: `ListingSuppressed.reason`, REST `SuppressionReason`, REST `Listing.suppressionReason`.

| Value | Meaning |
| --- | --- |
| `NODE_NOT_SELLABLE` | The listing's node is not ACTIVE; the listing is restored when the node activates. |
| `DISCONTINUED` | The catalogue item is discontinued; final, the listing is never restored. |

### Reasons of `delivery-promise`

**`PromiseBrokenCause`**: Why a judged promise is BROKEN (ADR 0002 A18).

Appears in: `PromiseBroken.cause`, REST `Judgement.cause`.

| Value | Meaning |
| --- | --- |
| `LATE` | The group was delivered after deliverByLatest; PromiseBroken carries deliveredAt and lateByMinutes. |
| `LOST` | A package of the group was declared lost (PackageLost) before delivery; there is no deliveredAt. |
| `RETURNED` | A package of the group was returned (PackageReturned) before delivery; there is no deliveredAt. |

Branched on by `node-performance` (`LATE`): Only LATE counts against the node (node-performance ADR 0002 A8); LOST and RETURNED are network and shopper causes and record no observation.

**`PromiseAtRiskReason`**: Why a promise went AT_RISK. The revision that follows (PromiseRevised) and PromiseUnkeepable carry the same value.

Appears in: `PromiseAtRisk.reason`, `PromiseRevised.reason`, `PromiseUnkeepable.reason`, REST `Promise.atRiskReason`, REST `Revision.reason`.

| Value | Meaning |
| --- | --- |
| `NODE_UNSOURCEABLE` | order-sourcing published FulfillmentUnsourceable for the promise's group. |
| `PACKAGE_EXCEPTION` | shipping-and-tracking published PackageExceptionRaised for a package of the group. |
| `INDUCTION_DEFERRED` | last-mile-delivery published PackageInductionDeferred for a package of the group. |
| `DEPARTURE_CANCELLED` | A departure on the promise's witness path was cancelled (DepartureCancelled). |
| `WAVE_CANCELLED` | The delivery wave on the promise's witness path was cancelled (DeliveryWaveCancelled). |
| `BOOKING_FAILED` | linehaul-transportation could not book the group's package on any departure (BookingFailed). |
| `BOOKING_MOVED` | The group's package was rebooked on another departure (BookingMoved). |

**`PromiseReleaseReason`**: Why a PROVISIONAL promise was RELEASED.

Appears in: `PromiseReleased.reason`, REST `Promise.releaseReason`.

| Value | Meaning |
| --- | --- |
| `HOLD_EXPIRED` | The capacity hold expired before the order was placed (ReleaseExpiredHolds). |

**`OfferConstraint`**: Why a requested tier has no offer.

Appears in: REST `OfferConstraint`.

| Value | Meaning |
| --- | --- |
| `DESTINATION_NOT_SERVED` | No delivery station serves the destination postal prefix. |
| `ITEM_QUANTITY_NOT_AVAILABLE` | No set of nodes can cover every requested line and quantity. |
| `PAST_ORDER_DEADLINE` | The tier's order deadline in the destination region has passed. |
| `DELIVERY_SLA_UNAVAILABLE` | No feasible path (cutoff, departures, delivery wave) reaches the destination inside the tier. |
| `NODE_CAPACITY_EXHAUSTED` | A feasible path exists, but its pickup cutoff has no remaining capacity. |

### Reasons of `order-sourcing`

**`FulfillmentReassignedReason`**: Why the candidate node of an assignment changed (ADR 0004; the model had left the vocabulary open).

Appears in: `FulfillmentReassigned.reason`.

| Value | Meaning |
| --- | --- |
| `REOPTIMISED` | Re-optimisation of a QUEUED assignment found a different best candidate. |
| `RELEASE_RECHECK` | The re-check against fresh read models at release time chose a different node. |
| `PURCHASE_ORDER_REJECTED` | The node rejected the purchase order; the next candidate takes over. |
| `PURCHASE_ORDER_EXPIRED` | The node did not acknowledge the purchase order in time; the next candidate takes over. |
| `PROMISE_REVISED` | A revised promise (PromiseRevised) changed the constraint and a QUEUED assignment moved to a new candidate. |

**`FulfillmentLockReason`**: Why an assignment locked its path.

Appears in: `FulfillmentLocked.lockReason`, REST `Assignment.lockReason`.

| Value | Meaning |
| --- | --- |
| `PURCHASE_ORDER_ACCEPTED` | The node accepted the purchase order; vendor acceptance is the path lock (docs ADR 0005). |

**`FulfillmentUnsourceableReason`**: Why an assignment became UNSOURCEABLE.

Appears in: `FulfillmentUnsourceable.reason`.

| Value | Meaning |
| --- | --- |
| `NO_CANDIDATE` | The candidate set is empty under the promise constraint and the node exclusions. |
| `NODE_REFUSED` | The last candidate refused (rejected or expired) and no other candidate is left. |

**`ExcludedNodeReason`**: Why a node is excluded from an assignment. A rejection is written REJECTED followed by a colon and the vendor's reason code when there is one.

Appears in: `FulfillmentUnsourceable.excludedNodes`, REST `ExcludedNode.reason`.

| Value | Meaning |
| --- | --- |
| `REJECTED` | The node rejected the purchase order; the text continues with the vendor's reasonCode (see the vendor-connectivity RejectReason vocabulary). |
| `EXPIRED` | The node did not acknowledge the purchase order before its deadline. |

**`FulfillmentCancelRefusedReason`**: Why a cancel request was refused.

Appears in: `FulfillmentCancelRefused.reason`.

| Value | Meaning |
| --- | --- |
| `CANCEL_AFTER_LOCK` | The cancel request arrived after the assignment locked; the vendor ships and the shopper's path is a return. |

**`ReleaseOutcome`**: What the node answered to a release.

Appears in: REST `ReleaseOutcome`, REST `Release.outcome`.

| Value | Meaning |
| --- | --- |
| `PENDING` | Released and not yet answered. |
| `ACCEPTED` | The node accepted; the assignment locks. |
| `REJECTED` | The node rejected; Release.reasonCode holds the vendor's code. |
| `EXPIRED` | The node did not answer before its deadline. |

### Reasons of `vendor-connectivity`

**`RejectReason`**: Why a vendor node rejected a purchase order. Required when the decision is REJECT.

Appears in: `PurchaseOrderRejected.reasonCode`, REST `RejectReason`, REST `Acknowledgement.reasonCode`.

| Value | Meaning |
| --- | --- |
| `OUT_OF_STOCK` | The node cannot cover the ordered quantity. |
| `UNKNOWN_LISTING` | The node does not know the ordered listing. |
| `CANNOT_MEET_SHIP_BY` | The node cannot hand the package over by the required ship-by instant. |
| `DISCONTINUED` | The item is discontinued at the node. |

### Reasons of `linehaul-transportation`

**`BookingFailedReason`**: Why a package could not be booked on a departure (ADR 0002 A14); the value is the reason of the first failure.

Appears in: `BookingFailed.reason`.

| Value | Meaning |
| --- | --- |
| `DEPARTURE_UNKNOWN` | The departure named by the lock is not known to the service. |
| `DEPARTURE_CANCELLED` | The departure is CANCELLED. |
| `DEPARTURE_CLOSED` | The departure is no longer SCHEDULED, or its cutoff has passed. |
| `DEPARTURE_FULL` | The departure has no remaining capacity. |

### Reasons of `last-mile-delivery`

**`DeliveryAttemptOutcome`**: The result of one delivery attempt of one package. A FAILED attempt carries a failureReason of free text, which is not listed here.

Appears in: `DeliveryAttempted.outcome`, REST `Outcome`, REST `Attempt.outcome`.

| Value | Meaning |
| --- | --- |
| `DELIVERED` | The package was handed over. |
| `FAILED` | The package was not handed over; failureReason is required. |

Branched on by `shipping-and-tracking` (`DELIVERED`, `FAILED`): DELIVERED becomes a DELIVERED scan; any other outcome becomes a DELIVERY_FAILED scan.

### Reasons of `shipping-and-tracking`

**`PackageExceptionReason`**: Why a package exception was raised (ADR 0002 A30: the only reason; a failed delivery attempt is not an exception).

Appears in: `PackageExceptionRaised.reason`.

| Value | Meaning |
| --- | --- |
| `NO_SCAN` | No applied scan inside the silence window of the journey's leg (ExceptionOnSilence); raised once per silence. |

### Reasons of `node-performance`

**`ObservationKind`**: The measured outcomes a scorecard counts, stored per node and keyed by the CloudEvents id of the source event (ADR 0002 A2).

Appears in: stored by `NodeScorecard`.

| Value | Meaning |
| --- | --- |
| `ACK_ACCEPTED` | The node accepted a purchase order (PurchaseOrderAccepted). |
| `ACK_REJECTED` | The node rejected a purchase order (PurchaseOrderRejected). |
| `ACK_EXPIRED` | The node did not acknowledge a purchase order in time (PurchaseOrderExpired). |
| `HANDOVER` | A package entered the network (PackageHandedOver); on time when not after requiredShipBy. |
| `PROMISE_KEPT` | A promise on the node was kept (PromiseKept). |
| `PROMISE_BROKEN` | A promise on the node was broken for a node-attributable cause (PromiseBroken, see PromiseBrokenCause). |
| `FEED_APPLIED` | An inventory feed of the node was applied (InventoryFeedApplied); the gaps between feeds give the freshness metric. |

### Reasons of `seller-inbound`

**`InboundShipmentStatus`**: How a shipment closed after the vendor's carton-level receipt.

Appears in: `InboundShipmentReceived.status`.

| Value | Meaning |
| --- | --- |
| `CLOSED` | Every carton has a final status and nothing differs from the manifest. |
| `CLOSED_WITH_DISCREPANCY` | At least one carton or quantity differs from the manifest; each difference is also published as InboundDiscrepancyRecorded. |

**`CartonReceiptStatus`**: The vendor's per-carton receipt status, reported on the receipt and carried on the shipment's closing event.

Appears in: `InboundShipmentReceived.cartons(sscc, status)`.

| Value | Meaning |
| --- | --- |
| `RECEIVED` | The carton was received. |
| `MISSING` | A manifest carton was not received. |
| `UNEXPECTED` | A carton was received that the manifest does not list. |
| `DAMAGED` | A carton was received damaged. |

**`ComplianceTier`**: The informational tier of a seller's compliance scorecard: the worst of three signals over the window (seller-inbound ADR 0005 A3). Nothing acts on it.

Appears in: REST `SellerScorecard.complianceTier`.

| Value | Meaning |
| --- | --- |
| `GOOD` | No signal reaches WATCH, or nothing was observed in the window. |
| `WATCH` | Receipt accuracy below 0.98, or at least 0.5 discrepancies per shipment, or at least one compliance violation. |
| `AT_RISK` | Receipt accuracy below 0.90, or at least 2.0 discrepancies per shipment, or at least five compliance violations. |

Contexts that own no closed reason vocabulary (their reason fields, if any, are free text): `node-topology`, `customer-ordering`.

