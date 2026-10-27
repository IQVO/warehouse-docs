---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: Every CloudEvents type Customer Ordering publishes and consumes, with topics, keys, payload fields, consumers, idempotency and one complete example envelope.
---

# Domain Events

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

Every event this context publishes and consumes, from
`contexts[customer-ordering].publishes` and `.consumes`, with the producer's
entry for each consumed event. The network-wide rules are on
[Event standard: CloudEvents](/network/strategic-design/event-standard-cloudevents)
and [ADR 0007](/network/adr/0007-cloudevents-namespace).

## Envelope

Every Kafka message is a **CloudEvents 1.0 event in structured JSON mode**
(`conventions.cloudevents`):

| Attribute | Value for this context |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once when the event is written to the outbox; a redelivery carries the same `id` |
| `source` | `/retailnetwork/customer-ordering` |
| `type` | `com.retailnetwork.commerce.customer-ordering.customerorder.<EventName>` (tier `commerce`, entity `customerorder`) |
| `subject` | the `orderId` (the aggregate root id) |
| `time` | the instant the fact happened (`placedAt`, `cancelledAt`), UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:customer-ordering:events:<EventName>:v1` |
| Kafka topic | `retailnetwork.customer-ordering.events` |
| Kafka key | the `orderId`, so one order's events stay on one partition and in order |

## Published

Both events are written to `outbox_events` in the same transaction as the
`CustomerOrder` save, and a relay publishes them. **No published event carries
ship-to PII.** `CustomerOrderPlaced` carries `destinationPostalPrefix` only
([ADR 0006](/network/adr/0006-pii-confinement)).

### CustomerOrderPlaced

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderPlaced` |
| Topic | `retailnetwork.customer-ordering.events` |
| Subject / key | `orderId` |
| Dataschema | `urn:retailnetwork:customer-ordering:events:CustomerOrderPlaced:v1` |
| Producing command / use case | `PlaceOrder` (REST `POST /checkout`) |
| Consumers | `order-sourcing` (queues one assignment per group, `QueueAssignment`), `delivery-promise` (confirms each group's provisional promise, `ConfirmPromise`) |

| Field | Type | Meaning |
| --- | --- | --- |
| `orderId` | string | The customer order. |
| `shopperId` | string | The shopper who placed it. An id, not PII. |
| `destinationPostalPrefix` | string | The ship-to's postal prefix, the one every promise was quoted for. |
| `placedAt` | timestamp | When the order was placed. |
| `groups[]` | array | One entry per shipment group. |
| `groups[].groupNo` | integer | Group number inside the order. |
| `groups[].promiseId` | string | The `delivery-promise` promise for this group (still `PROVISIONAL` when published). |
| `groups[].tier` | enum | `SAME_DAY`, `NEXT_DAY`, `TWO_DAY` or `STANDARD`. |
| `groups[].witnessNodeId` | string | The node of the promise's witness path. `order-sourcing` may choose another node. |
| `groups[].shipBy` | timestamp | The pickup cutoff the promise assumed. |
| `groups[].deliverByEarliest` | timestamp | Start of the window shown to the shopper. |
| `groups[].deliverByLatest` | timestamp | End of the window; the hard constraint for `order-sourcing`. |
| `groups[].lines[]` | array | The lines of this group. |
| `groups[].lines[].lineNo` | integer | Line number inside the order. |
| `groups[].lines[].catalogItemId` | string | The catalogue item. |
| `groups[].lines[].quantity` | integer | Units ordered. |

**Why the per-group snapshot.** `order-sourcing` needs each group's
`promiseId`, `tier`, `deliverByLatest` and `witnessNodeId` to build its
`PromiseConstraint`. Carrying them here means it can queue the assignment
from this one event. Otherwise it would have to wait for and correlate a
second event from `delivery-promise`, and `PromiseMade` and
`PromiseConfirmed` are analytics-only anyway.

### CustomerOrderCancelled

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderCancelled` |
| Topic | `retailnetwork.customer-ordering.events` |
| Subject / key | `orderId` |
| Dataschema | `urn:retailnetwork:customer-ordering:events:CustomerOrderCancelled:v1` |
| Producing command / use case | `CancelOrder`: from the shopper (REST `POST /orders/{orderId}:cancel`) or from the `CancelOnUnfulfillable` policy |
| Consumers | `order-sourcing` (`CancelAssignment` for each listed group), `delivery-promise` (`CancelPromise` for each listed group) |

| Field | Type | Meaning |
| --- | --- | --- |
| `orderId` | string | The customer order. |
| `reason` | string | Why it was cancelled: the shopper's request, or an unfulfillable group. The model defines no code list (open question). |
| `cancelledAt` | timestamp | When the cancellation was recorded. |
| `groupNos` | integer[] | The shipment groups cancelled. A customer cancellation lists every group. |

## Consumed

Every consumer is idempotent on the CloudEvents `id`: the id is inserted into
`processed_events` in the same transaction as the effect, and a duplicate is
acknowledged without effect. Consumers dispatch on the **full type string**,
never on a suffix. Proposed consumer groups: `customer-ordering.order-sourcing`,
`customer-ordering.delivery-promise`, `customer-ordering.shipping-and-tracking`.

### From order-sourcing (`retailnetwork.order-sourcing.events`, Conformist)

| Event | Full type | Fields used | What this context does |
| --- | --- | --- | --- |
| `FulfillmentLocked` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentLocked` | `assignmentId`, `orderId`, `groupNo`, `nodeId`, `lockedAt` | `MarkInFulfillment`: records the group as locked (which ends customer cancellation, `ErrCancelAfterLock`) and moves `PLACED → IN_FULFILLMENT`. Links `assignmentId` to the group. Updates `OrderTrackingView`. |
| `FulfillmentShipped` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentShipped` | `assignmentId`, `orderId`, `groupNo`, `trackingNumbers`, `shippedAt` | `MarkGroupShipped`: `PARTIALLY_SHIPPED` or `SHIPPED`. Records the group's tracking numbers. Updates `OrderTrackingView`. |
| `FulfillmentUnsourceable` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentUnsourceable` | `orderId`, `groupNo`, `promiseId`, `reason` | `CancelOnUnfulfillable`: notes the group as waiting for a re-promise. `delivery-promise` consumes the same event and re-promises. If no revised promise is feasible, the policy cancels the group (`CancelOrder`). The model has no event for "not feasible" (open question). |

### From delivery-promise (`retailnetwork.delivery-promise.events`, Customer/Supplier)

| Event | Full type | Fields used | What this context does |
| --- | --- | --- | --- |
| `PromiseAtRisk` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseAtRisk` | `promiseId`, `orderId`, `reason`, `detectedAt` | Marks the group at risk in `OrderTrackingView`. No command. |
| `PromiseRevised` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseRevised` | `promiseId`, `orderId`, `revisionNo`, `deliverByEarliest`, `deliverByLatest`, `shipBy`, `reason` | `UpdateGroupPromise`: replaces the group's window (found by `promiseId`); a `revisionNo` not above the last applied is skipped. Updates `OrderTrackingView`. |
| `PromiseKept` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseKept` | `promiseId`, `orderId`, `deliveredAt`, `deliverByLatest` | Shows the verdict in `OrderTrackingView`. No command. |
| `PromiseBroken` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseBroken` | `promiseId`, `orderId`, `deliveredAt`, `deliverByLatest`, `lateByMinutes`, `cause` | Shows the verdict in `OrderTrackingView`. No command. |

### From shipping-and-tracking (`retailnetwork.shipping-and-tracking.events`, Conformist)

| Event | Full type | Fields used | What this context does |
| --- | --- | --- | --- |
| `LabelIssued` | `com.retailnetwork.logistics.shipping-and-tracking.label.LabelIssued` | `trackingNumber`, `assignmentId`, `packageNo`, `tier`, `carrier` | Adds the package to `OrderTrackingView`, linked to the group through `assignmentId`. No command. |
| `PackageScanned` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageScanned` | `trackingNumber`, `nodeId`, `scanType`, `at`, `state` | Advances the package line in `OrderTrackingView` (linked by `trackingNumber`). No command. |
| `PackageDelivered` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageDelivered` | `trackingNumber`, `assignmentId`, `orderId`, `deliveredAt` | `MarkGroupDelivered` once every tracking number of the group is delivered; the order becomes `DELIVERED` when every group is. Updates `OrderTrackingView`. |
| `PackageExceptionRaised` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageExceptionRaised` | `trackingNumber`, `orderId`, `reason`, `at` | Shows the exception in `OrderTrackingView`. No command. |

**Ordering.** Producers key by their own root id (`assignmentId`,
`promiseId`, `trackingNumber`), so there is no order guarantee across groups
or across topics. A message that would move the status backwards raises
`ErrStatusRegression` inside the aggregate. The consumer records it in the
inbox, logs it and acknowledges it. A message that names an unknown
`orderId` (for example, it arrived before the checkout commit was visible) is
retried with backoff, then dead-lettered for an operator. The model names
no dead-letter topic.

## Example envelope

The most important event, `CustomerOrderPlaced`, for a one-group
`NEXT_DAY` order (all ids synthetic):

```json
{
  "specversion": "1.0",
  "id": "4c1f7f0e-2d55-4c1a-9a7e-3f2b8e9d6a10",
  "source": "/retailnetwork/customer-ordering",
  "type": "com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderPlaced",
  "subject": "ord-20261022-000123",
  "time": "2026-10-22T14:03:11Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:customer-ordering:events:CustomerOrderPlaced:v1",
  "data": {
    "orderId": "ord-20261022-000123",
    "shopperId": "shp-000042",
    "destinationPostalPrefix": "01310",
    "placedAt": "2026-10-22T14:03:11Z",
    "groups": [
      {
        "groupNo": 1,
        "promiseId": "prm-8e21b7",
        "tier": "NEXT_DAY",
        "witnessNodeId": "node-fc-sp-01",
        "shipBy": "2026-10-22T21:00:00Z",
        "deliverByEarliest": "2026-10-23T12:00:00Z",
        "deliverByLatest": "2026-10-23T22:00:00Z",
        "lines": [
          {"lineNo": 1, "catalogItemId": "cat-100234", "quantity": 2},
          {"lineNo": 2, "catalogItemId": "cat-100877", "quantity": 1}
        ]
      }
    ]
  }
}
```

There is no address, name or phone anywhere in the envelope. The proposed
analytics topic `retailnetwork.customer-ordering.analytics` exists by
convention, but the model lists no analytics event for this context.
