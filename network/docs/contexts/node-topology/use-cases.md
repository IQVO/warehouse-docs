---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: The nine proposed command use cases of Node Topology, with their trigger, inbound adapter, preconditions, main flow, error mapping, events and idempotency.
---

# Use Cases

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One section per command in the model. Each would live in
`internal/application/usecases` (proposed). The step-by-step diagrams are on
[Sequence Diagrams](/network/contexts/node-topology/sequence-diagrams); payloads are on
[Domain Events](/network/contexts/node-topology/domain-events); the HTTP contract is
`apis/node-topology/openapi.yaml`.

Reads are not use cases here. `GET /nodes/{nodeId}` (`GetNode`),
`GET /nodes?type=&region=&status=` (`ListNodes`), `GET /lanes?origin=&destination=`
(`ListLanes`) and `GET /service-areas/{postalPrefix}` (`ResolveServiceArea`)
read the repositories directly; an unknown id answers 404.

## Triggers at a glance

| Use case | Actor / trigger | Inbound adapter | Event on success |
| --- | --- | --- | --- |
| `RegisterNode` | `vendor-connectivity` (vendor node) or network-ops planner (network node) | REST `POST /nodes` | `NodeRegistered` |
| `DeclareOperationalProfile` | `vendor-connectivity` (`declaredBy` `VENDOR`) or network-ops planner (`declaredBy` `NETWORK_OPS`) | REST `PUT /nodes/{nodeId}/operational-profile` | `NodeOperationalProfileDeclared` |
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
   on the same route with the same request replays the stored response;
   nothing runs again. Keys are kept for 24 hours in the context's
   `idempotency_keys` table, keyed by `(route, key)`.
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
| `ErrValidation` | 422 | `validation-failed` | The request is well-formed JSON but violates a value-object rule; the adapter rejects it before the use case runs. |
| `ErrNotFound` | 404 | `not-found` | An addressed aggregate does not exist: an unknown `nodeId`, `laneId` or `postalPrefix` in the path, or an unknown node named in the body. |
| `ErrIllegalTransition` | 409 | `illegal-transition` | The command is not allowed from the aggregate's current state. Listed per use case below where it applies. |
| `ErrConcurrentUpdate` | 409 | `concurrent-update` | Optimistic-concurrency version mismatch after one retry; the caller re-reads and retries. |

These four are the shared errors of model `conventions.errors`, the same in
every context.

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
  4. Check `regionId` names a defined `Region` and, when given, that
     `subtype` is one of the node type's subtypes.
  5. Create the `Node` in `PROPOSED` with a new `nodeId`.
  6. Save, write `NodeRegistered` to the outbox, commit.
  7. Answer `201` with the node.
- **Errors**:

| `Err...` | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrOperatorNotAllowedForNodeType` | 422 | `operator-not-allowed-for-node-type` |
| `ErrUnknownRegion` | 422 | `unknown-region` |
| `ErrSubtypeNotAllowed` | 422 | `subtype-not-allowed` |
| `ErrVendorNodeCodeTaken` | 409 | `vendor-node-code-taken` |

- **Events**: `NodeRegistered`.
- **Idempotency**: `Idempotency-Key` is required. `vendor-connectivity` is
  expected to send its `transactionId` as the key, so a re-processed
  submission replays the first answer instead of failing on
  `ErrVendorNodeCodeTaken`.

## DeclareOperationalProfile

- **Actor / trigger**: `vendor-connectivity` while processing a
  `DeclareNodeProfile` submission (`declaredBy` `VENDOR`); or the network-ops
  planner for a network node (`declaredBy` `NETWORK_OPS`).
- **Inbound adapter**: REST `PUT /nodes/{nodeId}/operational-profile`.
- **Input**: `profileRevision`, `timezone`, `operatingHoursByDay`,
  `holidays[]` (ISO dates), `handlingTimeMinutes`,
  `cutoffs[{localTime, days?, maxOrders?}]`,
  `throughputCap{value, timeUnit, unit}`, `sortDwellMinutes` (sortation
  centres and air hubs only), `declaredBy`. `operatingHoursByDay` is
  `{monday … sunday: {start, end}}` in `HH:mm`; a missing day is closed.
  `timeUnit` is `HOUR` or `DAY`.
- **Preconditions**: the node exists and is not `RETIRED`.
- **Main flow**:
  1. Load the `Node`.
  2. Refuse a revision not above the current one.
  3. Check every day of every cutoff (`days`, default every operating day)
     against the operating hours of that day.
  4. For an `ACTIVE` `FULFILLMENT_CENTER`, check the new revision still has at
     least one cutoff and a `handlingTime` above zero.
  5. Check `sortDwellMinutes` is absent unless the node is a
     `SORTATION_CENTER` or `AIR_HUB`.
  6. Append the profile as a new revision with `declaredAt` = now; the old
     revision is kept unchanged.
  7. Save, write `NodeOperationalProfileDeclared` to the outbox, commit.
  8. Answer `200` with the node and its current profile.
- **Errors**:

| `Err...` | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrStaleProfileRevision` | 409 | `stale-profile-revision` |
| `ErrCutoffOutsideOperatingHours` | 422 | `cutoff-outside-operating-hours` |
| `ErrSortDwellNotAllowed` | 422 | `sort-dwell-not-allowed` |
| `ErrIncompleteOperationalProfile` | 409 | `incomplete-operational-profile` |
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
| `ErrIllegalTransition` (node already `ACTIVE`) | 409 | `illegal-transition` |

- **Events**: `NodeActivated`.
- **Idempotency**: by `Idempotency-Key`. Without a key replay, a second
  activation of an `ACTIVE` node is refused with `ErrIllegalTransition`.

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
| `ErrIllegalTransition` (node `PROPOSED` or already `SUSPENDED`) | 409 | `illegal-transition` |

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
| `ErrIllegalTransition` (node still `PROPOSED`) | 409 | `illegal-transition` |

- **Events**: `NodeRetired`.
- **Idempotency**: by `Idempotency-Key`. Lanes and service areas of the node
  are not touched (policy `SuspendedEndpointsUnusable`): consumers treat them
  as unusable while the node is not `ACTIVE`.

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
| `ErrIllegalTransition` (lane already `CLOSED`) | 409 | `illegal-transition` |

- **Events**: `LaneClosed`. `linehaul-transportation` then refuses to
  schedule on it (`ErrLaneClosed`, its invariant).
- **Idempotency**: by `Idempotency-Key`.

## AssignServiceArea

- **Actor / trigger**: network-ops planner; in bulk at network redesign.
- **Inbound adapter**: REST `PUT /service-areas/{postalPrefix}`.
- **Input**: `deliveryStationNodeId`, `assignmentVersion`.
- **Preconditions**: the station exists, is a `DELIVERY_STATION` and is
  `ACTIVE` with a defined region; the version is above the prefix's current
  one.
- **Main flow**:
  1. Load the `ServiceArea` for the prefix, or start a new one.
  2. Load the station `Node` (read only) and check type and state.
  3. Refuse a version not above the current one.
  4. Take `regionId` from the station and check it names a defined `Region`
     (read only).
  5. Assign the station. The prefix is `ASSIGNED`, whether new or reassigned
     (`ASSIGNED` to `ASSIGNED`).
  6. Save, write `ServiceAreaAssigned`, commit.
  7. Answer `200` with the service area.
- **Errors**:

| `Err...` | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrUnknownRegion` | 422 | `unknown-region` |
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
