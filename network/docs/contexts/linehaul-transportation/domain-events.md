---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: Every event Linehaul Transportation publishes and consumes, with full CloudEvents types, topics, keys, payload fields, producers and consumers.
---

# Domain Events

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

Every event this context publishes and consumes, from
`contexts[linehaul-transportation].publishes` and `.consumes`. The
envelope follows the network's
[CloudEvents standard](/network/strategic-design/event-standard-cloudevents) and
[ADR 0007](/network/adr/0007-cloudevents-namespace).

## Envelope

| Attribute | Value |
| --- | --- |
| `specversion` | `1.0` (structured JSON mode) |
| `id` | a UUID minted once, when the event is written to the outbox; a redelivery carries the same `id` |
| `source` | `/retailnetwork/linehaul-transportation` |
| `type` | `com.retailnetwork.logistics.linehaul-transportation.<entity>.<EventName>`, entity `departure` or `load` |
| `subject` | the aggregate root id: `departureId` for `departure` events, `loadId` for `load` events |
| `time` | the instant the fact happened, UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:linehaul-transportation:events:<EventName>:v1` |
| Kafka topic | `retailnetwork.linehaul-transportation.events` |
| Kafka key | the same aggregate root id as `subject`, so one departure's (or one load's) events stay in order on one partition |

Every event leaves through the transactional outbox, in the same
transaction as the aggregate change.

## Published

### Departure events (key `departureId`)

| Event | Full `type` | `data` fields | Producing command / use case | Consumers |
| --- | --- | --- | --- | --- |
| `DepartureScheduled` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureScheduled` | `departureId`, `laneId`, `kind`, `originNodeId`, `destinationNodeId`, `cutoffAt`, `departsAt`, `arrivesAt`, `capacityPackages` | `ScheduleDeparture`, via `GenerateDepartures` (`HorizonRoll`) or `PickupFromCutoffs` | `delivery-promise` (`DepartureView`), `order-sourcing` (`NetworkGraphView`) |
| `DepartureCapacityChanged` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureCapacityChanged` | `departureId`, `capacityPackages`, `bookedPackages`, `remainingPackages` | `BookCapacity`, `ReleaseCapacity` (policy `BookOnLock`) | `delivery-promise`, `order-sourcing` |
| `DepartureCancelled` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureCancelled` | `departureId`, `reason`, `cancelledAt` | `CancelDeparture` (planner, or `PickupFromCutoffs` on `NodeSuspended` / `NodeRetired`) | `delivery-promise` (`RepromiseOnRisk`), `order-sourcing` |
| `DepartureDeparted` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureDeparted` | `departureId`, `departedAt` | `RecordDeparture` | analytics only |
| `DepartureArrived` | `com.retailnetwork.logistics.linehaul-transportation.departure.DepartureArrived` | `departureId`, `arrivedAt` | `RecordArrival` | analytics only |

### Load events (key `loadId`)

| Event | Full `type` | `data` fields | Producing command / use case | Consumers |
| --- | --- | --- | --- | --- |
| `LoadClosed` | `com.retailnetwork.logistics.linehaul-transportation.load.LoadClosed` | `loadId`, `departureId`, `packageCount` | `CloseLoad` | analytics only |
| `LoadDeparted` | `com.retailnetwork.logistics.linehaul-transportation.load.LoadDeparted` | `loadId`, `departureId`, `originNodeId`, `trackingNumbers`, `departedAt`, `departureKind`, `nodeType` (the type of the origin node; policy `NodeTypeSnapshot`) | `DispatchLoad` | `shipping-and-tracking` (journey scans, `HandoverOnFirstScan`) |
| `LoadArrived` | `com.retailnetwork.logistics.linehaul-transportation.load.LoadArrived` | `loadId`, `departureId`, `destinationNodeId`, `trackingNumbers`, `arrivedAt`, `departureKind`, `nodeType` (the type of the destination node; policy `NodeTypeSnapshot`) | `ReceiveLoad` | `shipping-and-tracking` (journey scans), `last-mile-delivery` (`InductOnArrival`, `InboundPackagesView`) |

"Analytics only" means the model names no in-org consumer. The events are
still published on the integration topic; no context may depend on them for
a decision without a model change.

`OpenLoad`, `AddPackage`, `CloseDeparture`, `DefineLaneSchedule`,
`RetireLaneSchedule` and `GenerateDepartures` (itself) raise no event.

### Example: a pickup departure scheduled

`DepartureScheduled` is the most important event: it is how a vendor's
declared cutoff reaches the promise. Example for a `PICKUP` departure (ids
and times are illustrative):

```json
{
  "specversion": "1.0",
  "id": "6f1d2c4e-8a1b-4e8f-9b4a-2d5c7e9f1a30",
  "source": "/retailnetwork/linehaul-transportation",
  "type": "com.retailnetwork.logistics.linehaul-transportation.departure.DepartureScheduled",
  "subject": "dep-20261023-ln-fc017-sc003-1800",
  "time": "2026-10-22T01:00:04Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:linehaul-transportation:events:DepartureScheduled:v1",
  "data": {
    "departureId": "dep-20261023-ln-fc017-sc003-1800",
    "laneId": "ln-fc017-sc003-ground",
    "kind": "PICKUP",
    "originNodeId": "node-fc017",
    "destinationNodeId": "node-sc003",
    "cutoffAt": "2026-10-23T21:00:00Z",
    "departsAt": "2026-10-23T21:30:00Z",
    "arrivesAt": "2026-10-23T23:45:00Z",
    "capacityPackages": 1200
  }
}
```

## Consumed

Every consumer is idempotent on the CloudEvents `id` (a row in
`processed_events` written in the same transaction as the effect) and
dispatches on the full `type` string, never on a suffix.

| Producer | Full `type` | What this context does with it | Idempotency beyond the inbox |
| --- | --- | --- | --- |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeRegistered` | Inserts the node (type, operator, vendor, region, time zone) into `NodeProfileView` | Upsert on `nodeId` |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeOperationalProfileDeclared` | Stores the profile in `NodeProfileView`; `PickupFromCutoffs` (re)generates `PICKUP` departures for every cutoff of the horizon (`ScheduleDeparture`) | Ignore a `profileRevision` not above the stored one; one pickup per (node, cutoff, operating day) |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeActivated` | Marks the node `ACTIVE` in `NodeProfileView` (no further reaction is named in the model) | Status overwrite |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeSuspended` | Marks the node `SUSPENDED`; `PickupFromCutoffs` cancels its future pickups (`CancelDeparture`) | A departure already `CANCELLED` is skipped |
| `node-topology` | `com.retailnetwork.logistics.node-topology.node.NodeRetired` | Marks the node `RETIRED`; `PickupFromCutoffs` cancels its future pickups | As above |
| `node-topology` | `com.retailnetwork.logistics.node-topology.lane.LaneOpened` | Inserts the lane (origin, destination, mode, nominal transit) into `LaneView` as `OPEN` | Upsert on `laneId` |
| `node-topology` | `com.retailnetwork.logistics.node-topology.lane.LaneClosed` | Marks the lane `CLOSED`; later `ScheduleDeparture` on it fails with `ErrLaneClosed` | Status overwrite |
| `order-sourcing` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReleasedToNode` | Records the assignment, node and `pickupDepartureId` in `ExpectedVolumeView` | Upsert on (`assignmentId`, `releaseNo`) |
| `order-sourcing` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReassigned` | Moves the assignment in `ExpectedVolumeView`; `BookOnLock` releases a booking if one exists (`ReleaseCapacity`) | Ignore an `assignmentVersion` not above the stored one |
| `order-sourcing` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentLocked` | `BookOnLock`: `BookCapacity` of one package on `pickupDepartureId`; marks the assignment booked in `ExpectedVolumeView` | One booking per `assignmentId` |
| `order-sourcing` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentCancelled` | Removes the assignment from `ExpectedVolumeView`; `BookOnLock` releases its booking if one exists (`ReleaseCapacity`) | Release only a booking that exists |
| `shipping-and-tracking` | `com.retailnetwork.logistics.shipping-and-tracking.label.LabelIssued` | Adds `trackingNumber` and `packageNo` to the assignment in `ExpectedVolumeView` | Upsert on `labelRef` |

Derived from: `model.yaml → contexts[linehaul-transportation].consumes`,
`.policies`, `.read_models`, and the producers' `publishes[*].data`.

## Notes and gaps

- `FulfillmentReassigned` and `FulfillmentCancelled` are raised by
  `order-sourcing` only before `LOCKED` (`ErrAssignmentLocked`,
  `ErrCancelAfterLock` on its side), while `BookOnLock` books only on
  `FulfillmentLocked`. The release branch is therefore defensive: in the
  model as written it never finds a booking. Reported as a model gap.
- `DepartureCapacityChanged` carries `capacityPackages`, which suggests the
  capacity itself can change; no command in the model changes it. Reported
  as a model gap.
- The idempotency keys in the last column are proposals; the model requires
  only the inbox on the CloudEvents `id`.
