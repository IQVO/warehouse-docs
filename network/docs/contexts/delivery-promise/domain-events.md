---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: Every event Delivery Promise publishes and consumes, with full CloudEvents types, topics, data fields, consumers and idempotency rules.
---

# Domain Events

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Every event this context publishes (`contexts[delivery-promise].publishes`) and
consumes (`.consumes`), following
[the CloudEvents standard of this domain](/network/strategic-design/event-standard-cloudevents)
and [ADR 0007](/network/adr/0007-cloudevents-namespace).

## Envelope

| Attribute | Value |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once when the outbox row is written; a redelivery carries the same `id` |
| `source` | `/retailnetwork/delivery-promise` |
| `type` | `com.retailnetwork.commerce.delivery-promise.<entity>.<EventName>`; entity `promise` for the eight promise events, `promisebook` for `PromiseBookExhausted` |
| `subject` | the aggregate root id: `promiseId`, or `bookId` for `PromiseBookExhausted` |
| `time` | the instant the aggregate change was committed, UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:delivery-promise:events:<EventName>:v1` |
| Kafka topic | `retailnetwork.delivery-promise.events` |
| Kafka key | same as `subject`, so all events of one promise (or one book) share a partition and keep their order |

Every event leaves through the transactional outbox (`outbox_events`), written
in the same Postgres transaction as the aggregate change.

## Published

| Event | Full `type` | Subject / key | Producing command (use case) | Consumers |
| --- | --- | --- | --- | --- |
| `PromiseMade` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseMade` | `promiseId` | `MakePromise` | analytics only |
| `PromiseConfirmed` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseConfirmed` | `promiseId` | `ConfirmPromise` (on `CustomerOrderPlaced`) | analytics only |
| `PromiseAtRisk` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseAtRisk` | `promiseId` | `FlagPromiseAtRisk` (`RepromiseOnRisk`) | `customer-ordering` |
| `PromiseRevised` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseRevised` | `promiseId` | `RevisePromise` (`RepromiseOnRisk`) | `customer-ordering`, `order-sourcing` |
| `PromiseKept` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseKept` | `promiseId` | `JudgePromise` (`JudgeOnDelivery`) | `node-performance`, `customer-ordering` |
| `PromiseBroken` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseBroken` | `promiseId` | `JudgePromise` (`JudgeOnDelivery`) | `node-performance`, `customer-ordering` |
| `PromiseReleased` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseReleased` | `promiseId` | `ReleaseExpiredHolds` | analytics only |
| `PromiseCancelled` | `com.retailnetwork.commerce.delivery-promise.promise.PromiseCancelled` | `promiseId` | `CancelPromise` (on `CustomerOrderCancelled`) | analytics only |
| `PromiseBookExhausted` | `com.retailnetwork.commerce.delivery-promise.promisebook.PromiseBookExhausted` | `bookId` | `HoldCapacity` inside `MakePromise` | `order-sourcing` |

### Data fields

Field names are the model's. Types and meanings are this pack's proposal;
timestamps are RFC 3339 UTC strings.

**`PromiseMade`**

| Field | Type | Meaning |
| --- | --- | --- |
| `promiseId` | string | the new promise |
| `offerId` | string | the `DeliveryOffer` it consumed |
| `tier` | enum | `SAME_DAY`, `NEXT_DAY`, `TWO_DAY`, `STANDARD` |
| `nodeId` | string | witness node |
| `pickupDepartureId` | string | witness pickup departure (its book is `nodeId:pickupDepartureId`) |
| `shipBy` | timestamp | pickup cutoff the package must be ready for |
| `deliverByEarliest` | timestamp | window start |
| `deliverByLatest` | timestamp | window end; the judgement line |
| `basis` | enum | `SCHEDULED` or `NOMINAL` |
| `policyVersion` | string | version of the promise policies used |
| `holdExpiresAt` | timestamp | the provisional hold is released after this instant |
| `lines` | array of `{catalogItemId, quantity}` | the shipment group |

**`PromiseConfirmed`**: `promiseId`; `orderId` (the placed customer order);
`groupNo` (the group's number in that order).

**`PromiseAtRisk`**: `promiseId`; `orderId`; `reason` (string, what put it at
risk: unsourceable, package exception or cancelled departure; the model gives no
vocabulary); `detectedAt` (timestamp).

**`PromiseRevised`**

| Field | Type | Meaning |
| --- | --- | --- |
| `promiseId` | string | the revised promise |
| `orderId` | string | its customer order |
| `revisionNo` | integer | 1 for the first revision, then +1 |
| `previousDeliverByLatest` | timestamp | window end before this revision |
| `deliverByEarliest` | timestamp | new window start |
| `deliverByLatest` | timestamp | new window end, never earlier than `previousDeliverByLatest` (`ErrRevisionMovesEarlier`) |
| `shipBy` | timestamp | new ship-by at the new witness node |
| `nodeId` | string | new witness node |
| `reason` | string | why the promise was revised |

**`PromiseKept`**: `promiseId`; `orderId`; `nodeId` (the node judged);
`deliveredAt` (timestamp); `deliverByLatest` (timestamp).

**`PromiseBroken`**: as `PromiseKept`, plus `lateByMinutes` (integer,
`deliveredAt - deliverByLatest` in minutes) and `cause` (string; the model
gives no vocabulary).

**`PromiseReleased`**: `promiseId`; `reason` (string, for example the hold
expired).

**`PromiseCancelled`**: `promiseId`; `orderId`; `reason` (string, copied from
`CustomerOrderCancelled.reason`).

**`PromiseBookExhausted`**: `bookId` (`nodeId:pickupDepartureId`); `nodeId`;
`pickupDepartureId`; `share` (integer, the capacity just reached).

### Analytics topic

The model names one analytics-only message, `DeliveryOfferQuoted`, published on
`retailnetwork.delivery-promise.analytics` for every quote. It is not in the
model's `publishes` list and has no data fields, so this pack prints no type or
schema for it (open question on
[the canvas page](/network/contexts/delivery-promise/bounded-context-canvas)).

### Example envelope: `PromiseRevised`

`PromiseRevised` is the event with the most consequence: the customer sees a new
date, and `order-sourcing` gets a new constraint.

```json
{
  "specversion": "1.0",
  "id": "6f1d2c4a-9b7e-4f3a-a0c5-2e8d91b47c13",
  "source": "/retailnetwork/delivery-promise",
  "type": "com.retailnetwork.commerce.delivery-promise.promise.PromiseRevised",
  "subject": "prm-01JC9X4T7QK2M8V5R3N6B1D0EA",
  "time": "2026-11-24T15:42:07.318Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:delivery-promise:events:PromiseRevised:v1",
  "data": {
    "promiseId": "prm-01JC9X4T7QK2M8V5R3N6B1D0EA",
    "orderId": "ord-01JC9X3ZP6W0H4F2K8S5T7Y9QB",
    "revisionNo": 1,
    "previousDeliverByLatest": "2026-11-25T21:00:00Z",
    "deliverByEarliest": "2026-11-26T14:00:00Z",
    "deliverByLatest": "2026-11-26T21:00:00Z",
    "shipBy": "2026-11-25T02:00:00Z",
    "nodeId": "node-fc-sp-07",
    "reason": "departure on the witness path cancelled"
  }
}
```

The identifiers and values are illustrative.

## Consumed

Every consumer is idempotent on the CloudEvents `id`: the id is inserted into
`processed_events` (the inbox) in the **same transaction** as the read-model or
aggregate write; a duplicate `id` commits nothing. Consumers dispatch on the
**full** `type` string. On top of the inbox, each read model keeps a monotonic
guard where the producer gives one, so an out-of-order delivery never moves a
row backwards.

| Producer | Full `type` | Fields used | What this context does | Extra idempotency / ordering guard |
| --- | --- | --- | --- | --- |
| `customer-ordering` | `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderPlaced` | `orderId`, `groups[].groupNo`, `groups[].promiseId` | `ConfirmPromise` for each group's promise (with `ConfirmCapacity`) | a `CONFIRMED` promise with the same `orderId` and `groupNo` is a no-op |
| `customer-ordering` | `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderCancelled` | `orderId`, `groupNos`, `reason` | `CancelPromise` for the promises of those groups, releasing confirmed capacity (this pack's reading; no policy named) | a `CANCELLED` promise is a no-op |
| `order-sourcing` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentUnsourceable` | `promiseId`, `orderId`, `groupNo`, `excludedNodes`, `reason` | `RepromiseOnRisk`: `FlagPromiseAtRisk`, recompute (excluding `excludedNodes`, this pack's reading), `RevisePromise` | an `AT_RISK` promise is not flagged twice |
| `order-sourcing` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentLocked` | `assignmentId`, `orderId`, `groupNo`, `nodeId`, `pickupDepartureId` | The model names no use. This pack records the `assignmentId` against the group's promise, so that `PackageDelivered` and `PackageExceptionRaised` can find it (open question) | last write wins; a lock happens once per assignment |
| `shipping-and-tracking` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageDelivered` | `assignmentId`, `orderId`, `deliveredAt` | `JudgeOnDelivery`: `JudgePromise` for the group's promise | a judged promise is terminal (`ErrPromiseClosed` is swallowed as a duplicate) |
| `shipping-and-tracking` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageExceptionRaised` | `assignmentId`, `orderId`, `reason`, `at` | `RepromiseOnRisk` for the group's promise | as above |
| `linehaul-transportation` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureScheduled` | `departureId`, `laneId`, `kind`, `originNodeId`, `destinationNodeId`, `cutoffAt`, `departsAt`, `arrivesAt`, `capacityPackages` | upsert `DepartureView` | insert-if-absent on `departureId` |
| `linehaul-transportation` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureCapacityChanged` | `departureId`, `capacityPackages`, `bookedPackages`, `remainingPackages` | update `DepartureView` remaining capacity | applied only if the CloudEvents `time` is newer than the row's |
| `linehaul-transportation` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureCancelled` | `departureId`, `reason`, `cancelledAt` | mark cancelled in `DepartureView`; `RepromiseOnRisk` for every open promise whose witness path uses the departure | a cancelled row stays cancelled |
| `last-mile-delivery` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveScheduled` | `waveId`, `stationNodeId`, `serviceDate`, `inductCutoffAt`, `windowStart`, `windowEnd`, `stopCapacity` | upsert `DeliveryWaveView` | insert-if-absent on `waveId` |
| `last-mile-delivery` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveCapacityChanged` | `waveId`, `stopCapacity`, `assignedStops`, `remainingStops` | update `DeliveryWaveView` | newer `time` wins |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeRegistered` | `nodeId`, `nodeType`, `subtype`, `operator`, `regionId`, `timezone`, `postalCode`, `countryCode` | insert `NodeProfileView` | insert-if-absent |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeOperationalProfileDeclared` | `nodeId`, `profileRevision`, `timezone`, `operatingHoursByDay`, `holidays`, `handlingTimeMinutes`, `cutoffs`, `throughputCap`, `sortDwellMinutes` | update the profile in `NodeProfileView` | applied only if `profileRevision` is higher |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeActivated` | `nodeId`, `activatedAt` | status `ACTIVE`: the node becomes a candidate | newer `time` wins |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeSuspended` | `nodeId`, `reason`, `suspendedAt` | status `SUSPENDED`: no new offers from it (open promises are re-promised when `linehaul-transportation` cancels its pickups) | newer `time` wins |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeRetired` | `nodeId`, `retiredAt` | status `RETIRED` (terminal) | terminal |
| `node-topology` | `com.retailnetwork.logistics.node-topology.lane.LaneOpened` | `laneId`, `originNodeId`, `destinationNodeId`, `mode`, `nominalTransitMinutes` | insert `LaneView` | insert-if-absent |
| `node-topology` | `com.retailnetwork.logistics.node-topology.lane.LaneClosed` | `laneId`, `closedAt` | close the lane in `LaneView` | terminal |
| `node-topology` | `com.retailnetwork.logistics.node-topology.servicearea.ServiceAreaAssigned` | `postalPrefix`, `deliveryStationNodeId`, `regionId`, `assignmentVersion` | upsert `RegionAndServiceAreaView` | applied only if `assignmentVersion` is higher |
| `node-topology` | `com.retailnetwork.logistics.node-topology.region.RegionDefined` | `regionId`, `code`, `name` | insert into `RegionAndServiceAreaView` | insert-if-absent |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemCreated` | `catalogItemId` | insert the item into `AvailabilityView` | insert-if-absent |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemDiscontinued` | `catalogItemId` | the item is no longer quotable | terminal |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.listing.ListingCreated` | `listingId`, `catalogItemId`, `nodeId` | insert the listing into `AvailabilityView` | insert-if-absent |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.listing.ListingAvailabilityChanged` | `listingId`, `availableQty`, `basis`, `asOf` | update quantity and basis | applied only if `asOf` is newer (the producer's own rule) |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.listing.ListingSuppressed` | `listingId`, `nodeId`, `reason` | the listing is not a candidate | newer `time` wins |
| `offer-availability` | `com.retailnetwork.commerce.offer-availability.listing.ListingRestored` | `listingId`, `nodeId` | the listing is a candidate again | newer `time` wins |
| `node-performance` | `com.retailnetwork.partner.node-performance.scorecard.NodeScorecardUpdated` | `nodeId`, `window`, `grade`, `observations`, `computedAt` | upsert `ScorecardView` per `(nodeId, window)` | applied only if `computedAt` is newer |

Consumer groups (proposed): one group per projector, named
`delivery-promise-<read-model>` (for example `delivery-promise-departure-view`),
plus `delivery-promise-promise-lifecycle` for the five events that drive a use
case (`CustomerOrderPlaced`, `CustomerOrderCancelled`, `FulfillmentUnsourceable`,
`PackageDelivered`, `PackageExceptionRaised`) and `DepartureCancelled`'s
re-promise reaction.

A message that is not a valid CloudEvent, or whose `type` is unknown, is logged
and set aside so that it never blocks the partition. The model names no
dead-letter topic; choosing one is an implementation decision.

Omitted: the per-field JSON schemas (they belong in the AsyncAPI document, not
yet written), and the fields this context receives but ignores (for example
`shopperId` on `CustomerOrderPlaced`, `vendorId` on `NodeRegistered`).
