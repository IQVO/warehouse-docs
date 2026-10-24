---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: The nine proposed command use cases of Node Topology, with their trigger, inbound adapter, preconditions, main flow, error mapping, events and idempotency.
---

# Use Cases

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

One section per command in the model. Each would live in
`internal/application/usecases` (proposed). The step-by-step diagrams are on
[Sequence Diagrams](/contexts/node-topology/sequence-diagrams); payloads are on
[Domain Events](/contexts/node-topology/domain-events); the HTTP contract is
`apis/node-topology/openapi.yaml`.

Reads are not use cases here. `GET /nodes/{nodeId}`,
`GET /nodes?type=&region=&status=`, `GET /lanes?origin=&destination=` and
`GET /service-areas/{postalPrefix}` read the repositories directly; an
unknown id answers 404.

## Triggers at a glance

| Use case | Actor / trigger | Inbound adapter | Event on success |
| --- | --- | --- | --- |
| `RegisterNode` | `vendor-connectivity` (vendor node) or network-ops planner (network node) | REST `POST /nodes` | `NodeRegistered` |
| `DeclareOperationalProfile` | `vendor-connectivity` | REST `PUT /nodes/{nodeId}/operational-profile` | `NodeOperationalProfileDeclared` |
| `ActivateNode` | network-ops planner | REST `POST /nodes/{nodeId}:activate` | `NodeActivated` |
| `SuspendNode` | network-ops planner | REST `POST /nodes/{nodeId}:suspend` | `NodeSuspended` |
| `RetireNode` | network-ops planner | REST `POST /nodes/{nodeId}:retire` | `NodeRetired` |
| `OpenLane` | network-ops planner | REST `POST /lanes` | `LaneOpened` |
| `CloseLane` | network-ops planner | REST `POST /lanes/{laneId}:close` | `LaneClosed` |
| `AssignServiceArea` | network-ops planner | REST `PUT /service-areas/{postalPrefix}` | `ServiceAreaAssigned` |
| `DefineRegion` | network-ops planner | REST `POST /regions` | `RegionDefined` |

No use case is driven by Kafka: the context consumes no event.

Derived from: model.yaml → `contexts[node-topology].aggregates[*].commands`,
`.inbound`, `.rest`, `.publishes`.

## How every command commits

1. The HTTP adapter checks the `Idempotency-Key` header. A key already seen
   with the same request replays the stored response; nothing runs again.
2. The use case loads the aggregate (and, where an invariant needs it, the
   other aggregate it reads), calls the domain method, and saves the
   aggregate with an optimistic-concurrency version check.
3. In the same Postgres transaction it writes one `outbox_events` row with
   the CloudEvents envelope, and the idempotency record.
4. The outbox relay publishes the row to `retailnetwork.node-topology.events`
   after commit.

A version conflict at step 2 is retried once by reloading; if it still
conflicts, the call answers 409 and the caller retries. A domain error at
step 2 writes nothing and publishes nothing.

### Errors common to every use case

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| Request body fails the schema | 422 | `validation-failed` | Not a domain invariant; the adapter rejects it before the use case runs. |
| Unknown `nodeId`, `laneId` or `postalPrefix` in the path, or an unknown node named in the body | 404 | `node-not-found`, `lane-not-found`, `service-area-not-found` | The model names no `Err...` for a repository miss (a model gap). |
| Optimistic-concurrency conflict after one retry | 409 | `concurrent-update` | Infrastructure, not a model invariant. |

Problems are `application/problem+json` (RFC 9457) with `type`, `title`,
`status` and `detail`.

## RegisterNode

- **Actor / trigger**: `vendor-connectivity` while processing a vendor's
  `RegisterVendorNode` submission (in-org, Customer/Supplier); or the
  network-ops planner for a parcel node.
- **Inbound adapter**: REST `POST /nodes`.
- **Input**: `nodeType`, `subtype` (fulfillment centres only), `operator`,
  `vendorRef{vendorId, vendorNodeCode}` (vendor nodes), `regionId`,
  `timezone`, `location{postalCode, countryCode, lat, lon}`.
- **Preconditions**: for a vendor node, `vendor-connectivity` has already
  checked the vendor account (`ErrNodeNotOwnedByVendor` is its invariant,
  not this one).
- **Main flow**:
  1. Check the operator against `node_types[nodeType].operator_allowed`.
  2. For a vendor node, check that `(vendorId, vendorNodeCode)` is free.
  3. Derive `NodeCapabilities` from the node type (`DefaultCapabilitiesByType`).
  4. Create the `Node` in `PROPOSED` with a new `nodeId`.
  5. Save, write `NodeRegistered` to the outbox, commit.
  6. Answer `201` with the node.
- **Errors**:

| `Err...` | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrOperatorNotAllowedForNodeType` | 422 | `operator-not-allowed-for-node-type` |
| `ErrVendorNodeCodeTaken` | 409 | `vendor-node-code-taken` |

- **Events**: `NodeRegistered`.
- **Idempotency**: `Idempotency-Key` is required. `vendor-connectivity` is
  expected to send its `transactionId` as the key, so a re-processed
  submission replays the first answer instead of failing on
  `ErrVendorNodeCodeTaken`.

## DeclareOperationalProfile

- **Actor / trigger**: `vendor-connectivity` while processing a
  `DeclareNodeProfile` submission.
- **Inbound adapter**: REST `PUT /nodes/{nodeId}/operational-profile`.
- **Input**: `profileRevision`, `timezone`, `operatingHoursByDay`,
  `holidays[]`, `handlingTimeMinutes`, `cutoffs[{localTime, maxOrders?}]`,
  `throughputCap{value, timeUnit, unit}`, `sortDwellMinutes`, `declaredBy`.
- **Preconditions**: the node exists and is not `RETIRED`.
- **Main flow**:
  1. Load the `Node`.
  2. Refuse a revision not above the current one.
  3. Check every cutoff against the operating hours of each operating day.
  4. Append the profile as a new revision with `declaredAt` = now; the old
     revision is kept unchanged.
  5. Save, write `NodeOperationalProfileDeclared` to the outbox, commit.
  6. Answer `200` with the node and its current profile.
- **Errors**:

| `Err...` | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrStaleProfileRevision` | 409 | `stale-profile-revision` |
| `ErrCutoffOutsideOperatingHours` | 422 | `cutoff-outside-operating-hours` |
| `ErrNodeRetired` | 409 | `node-retired` |

- **Events**: `NodeOperationalProfileDeclared`.
- **Idempotency**: by `Idempotency-Key`, and by the revision itself: the same
  revision sent twice with a different key is refused with
  `ErrStaleProfileRevision`, which `vendor-connectivity` reports as a failed
  submission.

## ActivateNode

- **Actor / trigger**: network-ops planner.
- **Inbound adapter**: REST `POST /nodes/{nodeId}:activate`.
- **Preconditions**: the node is `PROPOSED` or `SUSPENDED`. A
  `FULFILLMENT_CENTER` has a current profile with at least one cutoff and a
  handling time above zero.
- **Main flow**:
  1. Load the `Node`.
  2. Check completeness of the profile for a fulfillment centre.
  3. Move to `ACTIVE`, record `activatedAt`.
  4. Save, write `NodeActivated` to the outbox, commit.
  5. Answer `200` with the node.
- **Errors**:

| `Err...` | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrIncompleteOperationalProfile` | 409 | `incomplete-operational-profile` |
| `ErrNodeRetired` | 409 | `node-retired` |
| (unnamed in the model) node already `ACTIVE` | 409 | not yet named |

- **Events**: `NodeActivated`.
- **Idempotency**: by `Idempotency-Key`. Without a key replay, a second
  activation of an `ACTIVE` node is a transition outside the model's table.

## SuspendNode

- **Actor / trigger**: network-ops planner.
- **Inbound adapter**: REST `POST /nodes/{nodeId}:suspend`.
- **Input**: `reason`.
- **Preconditions**: the node is `ACTIVE`.
- **Main flow**:
  1. Load the `Node`.
  2. Move to `SUSPENDED`, record `reason` and `suspendedAt`.
  3. Save, write `NodeSuspended` to the outbox, commit.
  4. Answer `200` with the node.
- **Errors**:

| `Err...` | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrNodeRetired` | 409 | `node-retired` |
| (unnamed in the model) node `PROPOSED` or already `SUSPENDED` | 409 | not yet named |

- **Events**: `NodeSuspended`. Downstream, `offer-availability` suppresses
  the node's listings and `linehaul-transportation` cancels future pickups.
- **Idempotency**: by `Idempotency-Key`.

## RetireNode

- **Actor / trigger**: network-ops planner.
- **Inbound adapter**: REST `POST /nodes/{nodeId}:retire`.
- **Preconditions**: the node is `ACTIVE` or `SUSPENDED`.
- **Main flow**:
  1. Load the `Node`.
  2. Move to `RETIRED`, record `retiredAt`.
  3. Save, write `NodeRetired` to the outbox, commit.
  4. Answer `200` with the node.
- **Errors**:

| `Err...` | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrNodeRetired` | 409 | `node-retired` |
| (unnamed in the model) node still `PROPOSED` | 409 | not yet named |

- **Events**: `NodeRetired`.
- **Idempotency**: by `Idempotency-Key`. Lanes and service areas of the node
  are not touched (an open question).

## OpenLane

- **Actor / trigger**: network-ops planner.
- **Inbound adapter**: REST `POST /lanes`.
- **Input**: `originNodeId`, `destinationNodeId`, `mode` (`GROUND` or
  `AIR`), `nominalTransitMinutes`.
- **Preconditions**: both nodes exist and are `ACTIVE`; no `OPEN` lane with
  the same origin, destination and mode.
- **Main flow**:
  1. Refuse a loop.
  2. Load both `Node` aggregates (read only).
  3. Check the type pair against `lane_rules.allowed`.
  4. Check both ends are `ACTIVE`.
  5. Create the `Lane` in `OPEN` with a new `laneId`.
  6. Save (the partial unique index on open lanes guards
     `ErrDuplicateLane` against a concurrent open), write `LaneOpened`,
     commit.
  7. Answer `201` with the lane.
- **Errors**:

| `Err...` | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrLaneLoop` | 422 | `lane-loop` |
| `ErrLaneTypePairNotAllowed` | 422 | `lane-type-pair-not-allowed` |
| `ErrLaneEndpointNotActive` | 409 | `lane-endpoint-not-active` |
| `ErrDuplicateLane` | 409 | `duplicate-lane` |

- **Events**: `LaneOpened`.
- **Idempotency**: by `Idempotency-Key`; a retry with a new key finds the
  lane already open and gets `ErrDuplicateLane`.

## CloseLane

- **Actor / trigger**: network-ops planner.
- **Inbound adapter**: REST `POST /lanes/{laneId}:close`.
- **Preconditions**: the lane is `OPEN`.
- **Main flow**:
  1. Load the `Lane`.
  2. Move to `CLOSED`, record `closedAt`.
  3. Save, write `LaneClosed` to the outbox, commit.
  4. Answer `200` with the lane.
- **Errors**:

| `Err...` | HTTP | Problem `type` slug |
| --- | --- | --- |
| (unnamed in the model) lane already `CLOSED` | 409 | not yet named |

- **Events**: `LaneClosed`. `linehaul-transportation` then refuses to
  schedule on it (`ErrLaneClosed`, its invariant).
- **Idempotency**: by `Idempotency-Key`.

## AssignServiceArea

- **Actor / trigger**: network-ops planner; in bulk at network redesign.
- **Inbound adapter**: REST `PUT /service-areas/{postalPrefix}`.
- **Input**: `deliveryStationNodeId`, `assignmentVersion`.
- **Preconditions**: the station exists, is a `DELIVERY_STATION` and is
  `ACTIVE`; the version is above the prefix's current one.
- **Main flow**:
  1. Load the `ServiceArea` for the prefix, or start a new one.
  2. Load the station `Node` (read only) and check type and state.
  3. Refuse a version not above the current one.
  4. Assign the station; take `regionId` from the station.
  5. Save, write `ServiceAreaAssigned`, commit.
  6. Answer `200` with the service area.
- **Errors**:

| `Err...` | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrNotADeliveryStation` | 409 | `not-a-delivery-station` |
| `ErrStaleAssignmentVersion` | 409 | `stale-assignment-version` |

- **Events**: `ServiceAreaAssigned`.
- **Idempotency**: `PUT` with a version is naturally idempotent with the
  key; a replay of the same version with a new key gets
  `ErrStaleAssignmentVersion`.

## DefineRegion

- **Actor / trigger**: network-ops planner; rare.
- **Inbound adapter**: REST `POST /regions`.
- **Input**: `code`, `name`.
- **Preconditions**: no region with that code.
- **Main flow**:
  1. Check the code is free.
  2. Create the `Region` (`DEFINED`) with a new `regionId`.
  3. Save (a unique index on `code` guards a concurrent define), write
     `RegionDefined`, commit.
  4. Answer `201` with the region.
- **Errors**:

| `Err...` | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrRegionCodeTaken` | 409 | `region-code-taken` |

- **Events**: `RegionDefined`.
- **Idempotency**: by `Idempotency-Key`; a retry with a new key gets
  `ErrRegionCodeTaken`.
