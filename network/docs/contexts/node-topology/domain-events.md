---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: The nine CloudEvents types Node Topology publishes, their payloads, producing commands and consumers; it consumes no event.
---

# Domain Events

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Every event this context publishes, with its full CloudEvents type, and the
(empty) list of events it consumes. The envelope rules are the domain-wide
[event standard](/strategic-design/event-standard-cloudevents).

## Envelope

| Attribute | Value |
| --- | --- |
| `specversion` | `1.0` (structured JSON, mandatory on every Kafka message) |
| `id` | a UUID minted once when the outbox row is written; a relay retry re-sends the same `id` |
| `source` | `/retailnetwork/node-topology` |
| `type` | `com.retailnetwork.logistics.node-topology.<entity>.<EventName>`; tier `logistics`; entity `node`, `lane`, `servicearea` or `region` |
| `subject` | the aggregate root id: `nodeId`, `laneId`, `postalPrefix` or `regionId` |
| `time` | the instant the change was committed, UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:node-topology:events:<EventName>:v1` |
| Topic | `retailnetwork.node-topology.events` |
| Kafka key | the same aggregate root id as `subject`, so one aggregate's events stay in order on one partition |

Every event leaves through a transactional outbox, written in the same
transaction as the aggregate (model `conventions.integration_rules`).

Derived from: model.yaml → `conventions.cloudevents`,
`conventions.integration_rules`.

## Published

### Summary

| Event | Full `type` | Subject / key | Producing command | Consumers |
| --- | --- | --- | --- | --- |
| `NodeRegistered` | `com.retailnetwork.logistics.node-topology.node.NodeRegistered` | `nodeId` | `RegisterNode` | `offer-availability`, `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `last-mile-delivery`, `node-performance`, `vendor-connectivity` |
| `NodeOperationalProfileDeclared` | `com.retailnetwork.logistics.node-topology.node.NodeOperationalProfileDeclared` | `nodeId` | `DeclareOperationalProfile` | `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `node-performance` |
| `NodeActivated` | `com.retailnetwork.logistics.node-topology.node.NodeActivated` | `nodeId` | `ActivateNode` | `offer-availability`, `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `vendor-connectivity` |
| `NodeSuspended` | `com.retailnetwork.logistics.node-topology.node.NodeSuspended` | `nodeId` | `SuspendNode` | `offer-availability`, `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `vendor-connectivity` |
| `NodeRetired` | `com.retailnetwork.logistics.node-topology.node.NodeRetired` | `nodeId` | `RetireNode` | `offer-availability`, `delivery-promise`, `order-sourcing`, `linehaul-transportation`, `vendor-connectivity` |
| `LaneOpened` | `com.retailnetwork.logistics.node-topology.lane.LaneOpened` | `laneId` | `OpenLane` | `linehaul-transportation`, `delivery-promise`, `order-sourcing` |
| `LaneClosed` | `com.retailnetwork.logistics.node-topology.lane.LaneClosed` | `laneId` | `CloseLane` | `linehaul-transportation`, `delivery-promise`, `order-sourcing` |
| `ServiceAreaAssigned` | `com.retailnetwork.logistics.node-topology.servicearea.ServiceAreaAssigned` | `postalPrefix` | `AssignServiceArea` | `delivery-promise`, `order-sourcing`, `last-mile-delivery` |
| `RegionDefined` | `com.retailnetwork.logistics.node-topology.region.RegionDefined` | `regionId` | `DefineRegion` | `delivery-promise`, `order-sourcing` |

Derived from: model.yaml → `contexts[node-topology].publishes`,
`.aggregates[*].events`.

The data field lists below are exactly the model's `data` lists. Types and
descriptions are the proposed wire format.

### NodeRegistered

Producing use case: `RegisterNode`. What consumers do with it: build their
node read models (`NodeStatusView`, `NodeProfileView`, `StationView`,
`VendorNodeView`).

| Field | Type | Meaning |
| --- | --- | --- |
| `nodeId` | string | The network's id of the node |
| `nodeType` | enum | `FULFILLMENT_CENTER`, `INBOUND_CROSS_DOCK`, `RETURNS_CENTER`, `SORTATION_CENTER`, `DELIVERY_STATION`, `AIR_HUB` |
| `subtype` | enum, nullable | A `FULFILLMENT_CENTER` subtype; null otherwise |
| `operator` | enum | `NETWORK` or `VENDOR` |
| `vendorId` | string, nullable | Set when `operator` is `VENDOR` |
| `vendorNodeCode` | string, nullable | The vendor's own code; set when `operator` is `VENDOR` |
| `regionId` | string | The node's region |
| `timezone` | string | IANA time zone of the building |
| `postalCode` | string | Postal code of the building |
| `countryCode` | string | ISO 3166-1 alpha-2 |

Capabilities are not on the wire: consumers derive them from `nodeType`
(policy `DefaultCapabilitiesByType`, model `node_types`).

### NodeOperationalProfileDeclared

Producing use case: `DeclareOperationalProfile`. What consumers do with it:
`linehaul-transportation` (re)generates pickup departures per cutoff
(`PickupFromCutoffs`); `delivery-promise` and `order-sourcing` update
`NodeProfileView` (handling time, cutoffs, throughput cap); `node-performance`
records the declaration it will measure against.

| Field | Type | Meaning |
| --- | --- | --- |
| `nodeId` | string | The node |
| `profileRevision` | integer | Strictly increasing per node |
| `timezone` | string | IANA time zone the local times are in |
| `operatingHoursByDay` | object | Per day of week, the open and close local times |
| `holidays` | array of dates | Days the node does not operate |
| `handlingTimeMinutes` | integer | Declared time from order release to a package ready for handover |
| `cutoffs` | array of `{localTime, maxOrders?}` | Local times packages are ready for handover; `maxOrders` optional |
| `throughputCap` | `{value, timeUnit, unit}` | Maximum orders per time unit; `unit` is `ORDER` |
| `sortDwellMinutes` | integer | Declared sort dwell |
| `declaredBy` | enum | `VENDOR` or `NETWORK_OPS` |

### NodeActivated

Producing use case: `ActivateNode`. Consumers mark the node sellable and
promisable; `offer-availability` restores listings it suppressed for the
node's unavailability.

| Field | Type | Meaning |
| --- | --- | --- |
| `nodeId` | string | The node |
| `activatedAt` | timestamp | When it became `ACTIVE` |

### NodeSuspended

Producing use case: `SuspendNode`. `offer-availability` suppresses the node's
listings; `linehaul-transportation` cancels future pickups.

| Field | Type | Meaning |
| --- | --- | --- |
| `nodeId` | string | The node |
| `reason` | string | Why the planner suspended it |
| `suspendedAt` | timestamp | When it became `SUSPENDED` |

### NodeRetired

Producing use case: `RetireNode`. Same reactions as `NodeSuspended`, for
good.

| Field | Type | Meaning |
| --- | --- | --- |
| `nodeId` | string | The node |
| `retiredAt` | timestamp | When it became `RETIRED` |

### LaneOpened

Producing use case: `OpenLane`. `linehaul-transportation` may schedule
departures on it; `delivery-promise` and `order-sourcing` add it to their
graph.

| Field | Type | Meaning |
| --- | --- | --- |
| `laneId` | string | The lane |
| `originNodeId` | string | Origin node |
| `destinationNodeId` | string | Destination node |
| `mode` | enum | `GROUND` or `AIR` |
| `nominalTransitMinutes` | integer | Nominal transit time |

### LaneClosed

Producing use case: `CloseLane`.

| Field | Type | Meaning |
| --- | --- | --- |
| `laneId` | string | The lane |
| `closedAt` | timestamp | When it closed |

### ServiceAreaAssigned

Producing use case: `AssignServiceArea`.

| Field | Type | Meaning |
| --- | --- | --- |
| `postalPrefix` | string | The postal prefix |
| `deliveryStationNodeId` | string | The `DELIVERY_STATION` that serves it |
| `regionId` | string | The station's region |
| `assignmentVersion` | integer | Strictly increasing per prefix; consumers keep the highest |

### RegionDefined

Producing use case: `DefineRegion`.

| Field | Type | Meaning |
| --- | --- | --- |
| `regionId` | string | The region |
| `code` | string | Unique short code |
| `name` | string | Display name |

### Example envelope

`NodeOperationalProfileDeclared` is the event most decisions downstream
depend on: pickup departures, promise cutoffs and the throughput cap all come
from it. One complete envelope, with illustrative values:

```json
{
  "specversion": "1.0",
  "id": "3f6c2a9e-8b1d-4c7a-9e55-0d2f6b7a1c44",
  "source": "/retailnetwork/node-topology",
  "type": "com.retailnetwork.logistics.node-topology.node.NodeOperationalProfileDeclared",
  "subject": "node-0f3a91",
  "time": "2026-10-22T13:05:12Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:node-topology:events:NodeOperationalProfileDeclared:v1",
  "data": {
    "nodeId": "node-0f3a91",
    "profileRevision": 3,
    "timezone": "America/Sao_Paulo",
    "operatingHoursByDay": {
      "MONDAY": [{"open": "06:00", "close": "22:00"}],
      "TUESDAY": [{"open": "06:00", "close": "22:00"}],
      "WEDNESDAY": [{"open": "06:00", "close": "22:00"}],
      "THURSDAY": [{"open": "06:00", "close": "22:00"}],
      "FRIDAY": [{"open": "06:00", "close": "22:00"}],
      "SATURDAY": [{"open": "08:00", "close": "14:00"}],
      "SUNDAY": []
    },
    "holidays": ["2026-12-25"],
    "handlingTimeMinutes": 240,
    "cutoffs": [
      {"localTime": "11:00"},
      {"localTime": "18:00", "maxOrders": 1200}
    ],
    "throughputCap": {"value": 400, "timeUnit": "HOUR", "unit": "ORDER"},
    "sortDwellMinutes": 0,
    "declaredBy": "VENDOR"
  }
}
```

The values are illustrative. The shape of `operatingHoursByDay` (day keys,
`open`/`close` pairs) and the `timeUnit` value are this page's proposal: the
model names the fields but not their inner structure or vocabulary.

## Consumed

None. The model's `consumes` list for `node-topology` is empty, so the
context has no Kafka consumer, no consumer group and no inbox to dedupe. Its
inputs are the REST commands listed on [Use Cases](/contexts/node-topology/use-cases).

## Analytics

The model names no analytics event for this context, so nothing is published
on `retailnetwork.node-topology.analytics`.
