---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: Every CloudEvents type Last-Mile Delivery publishes and consumes, with topic, key, payload fields, producers and consumers.
---

# Domain Events

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

Every event this context publishes and consumes, from
`contexts[last-mile-delivery].publishes` and `.consumes` and the
network-wide `conventions.cloudevents`
([event standard](/network/strategic-design/event-standard-cloudevents),
[ADR 0007](/network/adr/0007-cloudevents-namespace)).

## Envelope

| Attribute | Value |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once per event and stored in the outbox row, so a relay retry carries the same `id` |
| `source` | `/retailnetwork/last-mile-delivery` |
| `type` | `com.retailnetwork.logistics.last-mile-delivery.<entity>.<EventName>`; `<entity>` is `wave`, `route`, `packageattempthistory` or `deliverypointprofile` |
| `subject` | the aggregate root id: `waveId` for `wave` events, `routeId` for `route` events, the `trackingNumber` for `packageattempthistory` events, the `stopKey` for `deliverypointprofile` events |
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
| `WaveCostDeclared` | `com.retailnetwork.logistics.last-mile-delivery.wave.WaveCostDeclared` | `waveId` | `DeclareCost` | `order-sourcing` |
| `DeliveryWaveCapacityChanged` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveCapacityChanged` | `waveId` | `InductPackage` (policies `InductOnArrival`, `RetryNextWave`) | `delivery-promise`, `order-sourcing` |
| `DeliveryWaveCancelled` | `com.retailnetwork.logistics.last-mile-delivery.wave.DeliveryWaveCancelled` | `waveId` | `CancelWave` | analytics only |
| `RoutePlanned` | `com.retailnetwork.logistics.last-mile-delivery.route.RoutePlanned` | `routeId` | `PlanRoute` | analytics only |
| `PackageOutForDelivery` | `com.retailnetwork.logistics.last-mile-delivery.route.PackageOutForDelivery` | `routeId` | `StartRoute` (one per tracking number) | `shipping-and-tracking` |
| `StopEtaWindowAssigned` | `com.retailnetwork.logistics.last-mile-delivery.route.StopEtaWindowAssigned` | `routeId` | `StartRoute` (one per stop, after every `PackageOutForDelivery`) | `shipping-and-tracking` |
| `DeliveryAttempted` | `com.retailnetwork.logistics.last-mile-delivery.route.DeliveryAttempted` | `routeId` | `RecordAttempt` | `shipping-and-tracking` |
| `PackageInductionDeferred` | `com.retailnetwork.logistics.last-mile-delivery.packageattempthistory.PackageInductionDeferred` | `trackingNumber` | `InductPackage` (`RetryNextWave`, no eligible wave) | `delivery-promise` |
| `PackageReturnInitiated` | `com.retailnetwork.logistics.last-mile-delivery.packageattempthistory.PackageReturnInitiated` | `trackingNumber` | `InductPackage` (`RetryNextWave`, three failures) | `shipping-and-tracking` |
| `DeliveryPointFlagged` | `com.retailnetwork.logistics.last-mile-delivery.deliverypointprofile.DeliveryPointFlagged` | `stopKey` | `RecordAttempt` (the `DeliveryPointProfile` of the stop, inside the same unit of work) | `shipping-and-tracking` |

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

### WaveCostDeclared

| Field | Type (proposed) | Meaning |
| --- | --- | --- |
| `waveId` | string | the wave |
| `costPerStopCents` | integer | the planner's declared marginal cost of one stop, integer cents (0 to 10000000; 0 is a legal declared zero) |
| `declaredAt` | date-time | when the planner declared it |

Raised by `DeclareCost` while the wave still runs; a later declaration
overwrites the earlier one. `order-sourcing` sums it into its
money-denominated cost.

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

### StopEtaWindowAssigned

| Field | Type (proposed) | Meaning |
| --- | --- | --- |
| `routeId` | string | the route |
| `stopNo` | integer, minimum 1 | the 1-based stop number; a route may hold two stops with one `stopKey` |
| `stopKey` | string | the opaque stop key; `pkg:<trackingNumber>` when the package has no label data |
| `trackingNumbers` | array of string, at least 1 | the packages of the stop, in stop order |
| `etaStart` | date-time | window start |
| `etaEnd` | date-time | window end, after `etaStart`; the window is at most two hours wide |

Raised by `StartRoute` in the same transaction, after every
`PackageOutForDelivery`, one per stop in stop order, under the same Kafka key
(the `routeId`), so the two stay ordered on one partition. The CloudEvents
`time` is the route start instant (the assignment time). The stops are spread
linearly over what is left of the wave's delivery window — a deterministic
spread, not a prediction (ADR 0013): no event is raised when less than 30
minutes of the wave window is left at the start instant, an ETA is never
retracted and never re-raised for the same start, and a re-inducted package
gets a new one from its next `StartRoute`. A window may fall after the
promised delivery window; it is published as computed. The analytics read
side keeps one row per package (`stop_eta_windows`) and the
`GET /reports/eta-window` report measures the share of deliveries inside the
window.

### DeliveryAttempted

| Field | Type (proposed) | Meaning |
| --- | --- | --- |
| `routeId` | string | the route |
| `trackingNumber` | string | the package |
| `outcome` | `DELIVERED` \| `FAILED` | the attempt result |
| `outcomeDetail` | `NOT_HOME` \| `ACCESS_PROBLEM` \| `OTHER` \| `SAFE_PLACE_USED`, optional | the driver-reported category (ADR 0014): `FAILED` carries `NOT_HOME`, `ACCESS_PROBLEM` or `OTHER`, `DELIVERED` carries `SAFE_PLACE_USED`; omitted means not reported (a legacy client) |
| `failureReason` | string, null when `DELIVERED` | why it failed; the model gives no vocabulary |
| `at` | date-time | when the attempt happened |

### PackageInductionDeferred

| Field | Type (proposed) | Meaning |
| --- | --- | --- |
| `trackingNumber` | string | the package |
| `assignmentId` | string, optional | from `LabelIssued`; omitted only when no label data was received |

Raised when no open wave of the station with stop capacity accepts the
package; `delivery-promise` treats it as a risk.

### PackageReturnInitiated

| Field | Type (proposed) | Meaning |
| --- | --- | --- |
| `trackingNumber` | string | the package |

Raised by the third failed attempt; the package is not re-inducted.

### DeliveryPointFlagged

| Field | Type (proposed) | Meaning |
| --- | --- | --- |
| `stopKey` | string | the opaque keyed hash of the address; never an address |
| `reason` | `NOT_HOME` \| `ACCESS_PROBLEM` | `ACCESS_PROBLEM` when any open strike has it, else `NOT_HOME` |
| `failures` | integer, 2 to 5 | strikes open at that moment |
| `trackingNumbers` | array of string, 1 to 5 | only the packages newly affected by this event |
| `flaggedAt` | date-time | the attempt instant that triggered the event |

Raised by the `DeliveryPointProfile` of the stop, inside `RecordAttempt`'s
unit of work (ADR 0014), after two counted failed attempts (`NOT_HOME` or
`ACCESS_PROBLEM`) inside a 60-day window, one strike per route visit. There
is no "cleared" event: a delivered attempt ends the episode inside the
profile, and consumers end their own view of the flag when the package ends.
The feature is dormant until the driver client reports `outcomeDetail`: until
then no strike is counted and no event is raised.

No published event carries an address, a name or any other PII
([ADR 0006](/network/adr/0006-pii-confinement)).

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
| `linehaul-transportation` | `com.retailnetwork.logistics.linehaul-transportation.load.LoadArrived` | `retailnetwork.linehaul-transportation.events` | Uses `loadId`, `departureId`, `destinationNodeId`, `trackingNumbers`, `arrivedAt`. Also uses `nodeType`. If `nodeType` is `DELIVERY_STATION` (when it is absent, if `destinationNodeId` is a delivery station in `StationView`), records the arrivals in `InboundPackagesView` and runs `InductOnArrival`: one `InductPackage` per tracking number into the earliest eligible wave. Loads arriving at any other node are ignored. | Inbox on the CloudEvents `id` (`processed_events`), in the same transaction as the view write. Each `InductPackage` is also a no-op for a tracking number already inducted into an open wave. |
| `shipping-and-tracking` | `com.retailnetwork.logistics.shipping-and-tracking.label.LabelIssued` | `retailnetwork.shipping-and-tracking.events` | Uses `trackingNumber`, `assignmentId`, `stopKey`, `destinationPostalPrefix`. Keeps them in `PackageStopView`; `InductOnArrival` groups packages into stops by `stopKey`, and wave capacity counts distinct stop keys. A package without a label row is its own stop. | Inbox on the CloudEvents `id`; upsert on `trackingNumber`. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeRegistered` | `retailnetwork.node-topology.events` | Uses `nodeId`, `nodeType`, `regionId`, `timezone`. Keeps `DELIVERY_STATION` nodes in `StationView`; the time zone fixes a station's service date. Other node types are ignored. | Inbox on the CloudEvents `id`; upsert on `nodeId`. |
| `node-topology` | `com.retailnetwork.logistics.node-topology.servicearea.ServiceAreaAssigned` | `retailnetwork.node-topology.events` | Uses `postalPrefix`, `deliveryStationNodeId`, `regionId`, `assignmentVersion`. Keeps the prefixes each station serves in `StationView`. | Inbox on the CloudEvents `id`; applied only if `assignmentVersion` is higher than the stored one. |

Consumers dispatch on the full `type` string, never on a suffix (model
`integration_rules`). Any other type on those topics is acknowledged and
ignored.
