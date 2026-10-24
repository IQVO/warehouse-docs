---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: Every CloudEvents type Last-Mile Delivery publishes and consumes, with topic, key, payload fields, producers and consumers.
---

# Domain Events

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Every event this context publishes and consumes, from
`contexts[last-mile-delivery].publishes` and `.consumes` and the
network-wide `conventions.cloudevents`
([event standard](/strategic-design/event-standard-cloudevents),
[ADR 0007](/adr/0007-cloudevents-namespace)).

## Envelope

| Attribute | Value |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once per event and stored in the outbox row, so a relay retry carries the same `id` |
| `source` | `/retailnetwork/last-mile-delivery` |
| `type` | `com.retailnetwork.logistics.last-mile-delivery.<entity>.<EventName>`; `<entity>` is `wave` or `route` |
| `subject` | the aggregate root id: `waveId` for `wave` events, `routeId` for `route` events |
| `time` | the instant the fact happened, UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:last-mile-delivery:events:<EventName>:v1` |
| Kafka topic | `retailnetwork.last-mile-delivery.events` |
| Kafka key | the same aggregate root id as `subject`, so one wave's (or one route's) events stay ordered on one partition |

Every event is written to `outbox_events` in the same transaction as the
aggregate and drained by a relay (model `integration_rules`).

## Published

| Event | Full `type` | Subject / key | Producing command (use case) | Consumers |
| --- | --- | --- | --- | --- |
| `DeliveryWaveScheduled` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveScheduled` | `waveId` | `ScheduleWave` | `delivery-promise`, `order-sourcing` |
| `DeliveryWaveCapacityChanged` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveCapacityChanged` | `waveId` | `InductPackage` (policies `InductOnArrival`, `RetryNextWave`) | `delivery-promise`, `order-sourcing` |
| `DeliveryWaveCancelled` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveCancelled` | `waveId` | `CancelWave` | analytics only |
| `RoutePlanned` | `com.retailnetwork.logistics.last-mile-delivery.route.RoutePlanned` | `routeId` | `PlanRoute` | analytics only |
| `PackageOutForDelivery` | `com.retailnetwork.logistics.last-mile-delivery.route.PackageOutForDelivery` | `routeId` | `StartRoute` (one per tracking number) | `shipping-and-tracking` |
| `DeliveryAttempted` | `com.retailnetwork.logistics.last-mile-delivery.route.DeliveryAttempted` | `routeId` | `RecordAttempt` | `shipping-and-tracking` |

"Analytics only" is the model's consumer value. No context consumes those two
events. The model names an analytics topic convention
(`retailnetwork.last-mile-delivery.analytics`), but it does not say whether
these events go there instead of the integration topic, or as well.

### DeliveryWaveScheduled

| Field | Type (proposed) | Meaning |
| --- | --- | --- |
| `waveId` | string | the wave |
| `stationNodeId` | string | the delivery station (`node-topology` `nodeId`) |
| `serviceDate` | date | the station's local service date |
| `inductCutoffAt` | date-time | last instant a package can join the wave |
| `windowStart` | date-time | delivery window start |
| `windowEnd` | date-time | delivery window end |
| `stopCapacity` | integer | stops the wave can take |

### DeliveryWaveCapacityChanged

| Field | Type (proposed) | Meaning |
| --- | --- | --- |
| `waveId` | string | the wave |
| `stopCapacity` | integer | stops the wave can take |
| `assignedStops` | integer | stops already assigned |
| `remainingStops` | integer | `stopCapacity - assignedStops` |

Consumers apply it as a full snapshot, not a delta, so the latest event by
`time` wins and a duplicate does no harm.

### DeliveryWaveCancelled

| Field | Type (proposed) | Meaning |
| --- | --- | --- |
| `waveId` | string | the wave |
| `reason` | string | free text from the canceller |

### RoutePlanned

| Field | Type (proposed) | Meaning |
| --- | --- | --- |
| `routeId` | string | the route |
| `waveId` | string | the wave it serves |
| `dspId` | string | the delivery service partner |
| `stopCount` | integer | number of stops, at most the van capacity |

### PackageOutForDelivery

| Field | Type (proposed) | Meaning |
| --- | --- | --- |
| `routeId` | string | the route |
| `trackingNumber` | string | the package |
| `stationNodeId` | string | the station it left |
| `at` | date-time | when the route started |

### DeliveryAttempted

| Field | Type (proposed) | Meaning |
| --- | --- | --- |
| `routeId` | string | the route |
| `trackingNumber` | string | the package |
| `outcome` | `DELIVERED` \| `FAILED` | the attempt result |
| `failureReason` | string, null when `DELIVERED` | why it failed; the model gives no vocabulary |
| `at` | date-time | when the attempt happened |

No published event carries an address, a name or any other PII
([ADR 0006](/adr/0006-pii-confinement)).

### Example envelope

`DeliveryWaveScheduled` is the most important event of this context: it is
the fact the promise's last leg rests on.

```json
{
  "specversion": "1.0",
  "id": "5b1f0f8e-4c1e-4b8e-9a51-2f3c0d9e7a14",
  "source": "/retailnetwork/last-mile-delivery",
  "type": "com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveScheduled",
  "subject": "wave-DS-ATL1-2026-10-23-W1",
  "time": "2026-10-22T14:05:11Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:last-mile-delivery:events:DeliveryWaveScheduled:v1",
  "data": {
    "waveId": "wave-DS-ATL1-2026-10-23-W1",
    "stationNodeId": "node-DS-ATL1",
    "serviceDate": "2026-10-23",
    "inductCutoffAt": "2026-10-23T09:30:00Z",
    "windowStart": "2026-10-23T12:00:00Z",
    "windowEnd": "2026-10-23T20:00:00Z",
    "stopCapacity": 2400
  }
}
```

The identifiers and numbers are illustrative. They are not taken from any
real network.

## Consumed

| Producer | Full `type` | Topic | What this context does with it | Idempotency |
| --- | --- | --- | --- | --- |
| `linehaul-transportation` | `com.retailnetwork.logistics.linehaul-transportation.load.LoadArrived` | `retailnetwork.linehaul-transportation.events` | Uses `loadId`, `departureId`, `destinationNodeId`, `trackingNumbers`, `arrivedAt`. If `destinationNodeId` is a delivery station in `StationView`, records the arrivals in `InboundPackagesView` and runs `InductOnArrival`: one `InductPackage` per tracking number into the earliest eligible wave. Loads arriving at any other node are ignored. | Inbox on the CloudEvents `id` (`processed_events`), in the same transaction as the view write. Each `InductPackage` is also a no-op for a tracking number already inducted into an open wave. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeRegistered` | `retailnetwork.node-topology.events` | Uses `nodeId`, `nodeType`, `regionId`, `timezone`. Keeps `DELIVERY_STATION` nodes in `StationView`; the time zone fixes a station's service date. Other node types are ignored. | Inbox on the CloudEvents `id`; upsert on `nodeId`. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.servicearea.ServiceAreaAssigned` | `retailnetwork.node-topology.events` | Uses `postalPrefix`, `deliveryStationNodeId`, `regionId`, `assignmentVersion`. Keeps the prefixes each station serves in `StationView`. | Inbox on the CloudEvents `id`; applied only if `assignmentVersion` is higher than the stored one. |

Consumers dispatch on the full `type` string, never on a suffix (model
`integration_rules`). Any other type on those topics is acknowledged and
ignored.
