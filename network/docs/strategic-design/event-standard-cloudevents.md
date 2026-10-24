---
id: event-standard-cloudevents
title: Event Standard (CloudEvents)
sidebar_label: Event Standard
description: "The CloudEvents 1.0 envelope, naming and topic rules every retail-network event follows, and the full catalogue of event types."
---

# Event Standard (CloudEvents)

:::info[Generated from the model]
This page is generated from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
:::


Every Kafka message in the network is a CloudEvents 1.0 structured JSON
envelope, the same rule the warehouse-systems fleet applies to itself. The
namespace is different on purpose (see
[ADR 0007](/network/adr/0007-cloudevents-namespace)): the two organizations share no
topic, so no consumer can mistake one organization's event for the other's.

| Attribute | Rule |
| --- | --- |
| `specversion` | `1.0` |
| `type` | `com.retailnetwork.<tier>.<context>.<entity>.<EventName>` |
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
| `partner` | `vendor-connectivity`, `node-performance` |

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
| `NodeRegistered` | `com.retailnetwork.logistics.node-topology.node.NodeRegistered` | `offer-availability`, `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `last-mile-delivery`, `node-performance`, `vendor-connectivity` |
| `NodeOperationalProfileDeclared` | `com.retailnetwork.logistics.node-topology.node.NodeOperationalProfileDeclared` | `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `node-performance` |
| `NodeActivated` | `com.retailnetwork.logistics.node-topology.node.NodeActivated` | `offer-availability`, `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `vendor-connectivity` |
| `NodeSuspended` | `com.retailnetwork.logistics.node-topology.node.NodeSuspended` | `offer-availability`, `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `vendor-connectivity` |
| `NodeRetired` | `com.retailnetwork.logistics.node-topology.node.NodeRetired` | `offer-availability`, `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `vendor-connectivity` |
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
| `FulfillmentShipped` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentShipped` | `customer-ordering` |
| `FulfillmentDelivered` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentDelivered` | analytics only |
| `FulfillmentUnsourceable` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentUnsourceable` | `delivery-promise`, `customer-ordering` |
| `FulfillmentCancelled` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentCancelled` | `vendor-connectivity`, `linehaul-transportation` |

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

### `last-mile-delivery`

Topic `retailnetwork.last-mile-delivery.events`.

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `DeliveryWaveScheduled` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveScheduled` | `delivery-promise`, `order-sourcing` |
| `DeliveryWaveCapacityChanged` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveCapacityChanged` | `delivery-promise`, `order-sourcing` |
| `DeliveryWaveCancelled` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveCancelled` | analytics only |
| `RoutePlanned` | `com.retailnetwork.logistics.last-mile-delivery.route.RoutePlanned` | analytics only |
| `PackageOutForDelivery` | `com.retailnetwork.logistics.last-mile-delivery.route.PackageOutForDelivery` | `shipping-and-tracking` |
| `DeliveryAttempted` | `com.retailnetwork.logistics.last-mile-delivery.route.DeliveryAttempted` | `shipping-and-tracking` |

### `shipping-and-tracking`

Topic `retailnetwork.shipping-and-tracking.events`.

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `LabelIssued` | `com.retailnetwork.logistics.shipping-and-tracking.label.LabelIssued` | `linehaul-transportation`, `customer-ordering` |
| `LabelVoided` | `com.retailnetwork.logistics.shipping-and-tracking.label.LabelVoided` | analytics only |
| `PackageScanned` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageScanned` | `customer-ordering` |
| `PackageHandedOver` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageHandedOver` | `node-performance` |
| `PackageDelivered` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageDelivered` | `delivery-promise`, `order-sourcing`, `customer-ordering` |
| `PackageExceptionRaised` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageExceptionRaised` | `delivery-promise`, `customer-ordering` |
| `PackageReturned` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageReturned` | analytics only |
| `PackageLost` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageLost` | analytics only |

### `node-performance`

Topic `retailnetwork.node-performance.events`.

| Event | CloudEvents type | Consumers |
| --- | --- | --- |
| `NodeScorecardUpdated` | `com.retailnetwork.partner.node-performance.scorecard.NodeScorecardUpdated` | `delivery-promise`, `order-sourcing` |
| `NodeThresholdBreached` | `com.retailnetwork.partner.node-performance.scorecard.NodeThresholdBreached` | analytics only |

