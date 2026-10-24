---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: "The nine proposed command use cases of Order Sourcing, one per FulfillmentAssignment command: trigger, inbound adapter, preconditions, main flow, errors with HTTP status and problem type, events and idempotency."
---

# Use Cases

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

One application service per command of `FulfillmentAssignment`, in the
proposed package `internal/application/usecases`. The runtime sequences are
on [Sequence Diagrams](/network/contexts/order-sourcing/sequence-diagrams); event
payloads on [Domain Events](/network/contexts/order-sourcing/domain-events). The
network-level walk-through with times is the
[order assignment model](/network/network-model/order-assignment-model).

## Triggers at a glance

| Use case | Trigger | Inbound adapter (proposed) |
| --- | --- | --- |
| `QueueAssignment` | `CustomerOrderPlaced` | `internal/adapters/inbound/kafka`, topic `retailnetwork.customer-ordering.events` |
| `ReoptimiseAssignment` | re-optimisation sweep; network-ops planner | scheduler in `cmd/order-sourcing`; `internal/adapters/inbound/http` `POST /assignments/{assignmentId}:reoptimise` |
| `ReleaseToNode` | `releaseAt` reached; `SAME_DAY` right after queueing | scheduler in `cmd/order-sourcing` (release timer) |
| `HandleNodeRefusal` | `PurchaseOrderRejected`, `PurchaseOrderExpired` | Kafka, topic `retailnetwork.vendor-connectivity.events` |
| `LockAssignment` | `PurchaseOrderAccepted` | Kafka, topic `retailnetwork.vendor-connectivity.events` |
| `MarkShipped` | `VendorShipmentConfirmed` | Kafka, topic `retailnetwork.vendor-connectivity.events` |
| `MarkDelivered` | `PackageDelivered` | Kafka, topic `retailnetwork.shipping-and-tracking.events` |
| `CancelAssignment` | `CustomerOrderCancelled` | Kafka, topic `retailnetwork.customer-ordering.events` |
| `ApplyRevisedPromise` | `PromiseRevised` | Kafka, topic `retailnetwork.delivery-promise.events` |

Queries are not use cases here. `GET /assignments?state=&nodeId=&orderId=`
(`ListAssignments`) and `GET /assignments/{assignmentId}` (`GetAssignment`)
read the repository directly. The read-model projectors (29 consumed event
types into five views) are not use cases either: they apply no domain rule.

## How a change commits

Every use case loads the assignment, calls one aggregate method, and saves it
with an optimistic-concurrency check on `assignmentVersion`, writing the
outbox row (and, for a Kafka trigger, the `processed_events` inbox row) in the
**same** Postgres transaction. A relay later drains the outbox to
`retailnetwork.order-sourcing.events`. No use case calls another context
synchronously (`sync_calls: []`).

## Error mapping

The problem `type` is the slug below; responses are
`application/problem+json` (RFC 9457). For Kafka-driven use cases the
status is the canonical mapping of the error (it is not sent anywhere); the
consumer action is what the adapter does.

| Error | HTTP status | Problem `type` | Kind |
| --- | --- | --- | --- |
| `ErrCandidateBreaksPromise` | 422 | `candidate-breaks-promise` | validation of a candidate against `deliverByLatest` |
| `ErrAssignmentLocked` | 409 | `assignment-locked` | state |
| `ErrNodeExcluded` | 409 | `node-excluded` | conflict |
| `ErrReleaseInFlight` | 409 | `release-in-flight` | state |
| `ErrStaleAssignmentVersion` | 409 | `stale-assignment-version` | stale |
| `ErrCancelAfterLock` | 409 | `cancel-after-lock` | state |
| unknown `assignmentId` (no `Err...` in the model) | 404 | `assignment-not-found` | not found |

Kafka consumers retry `ErrStaleAssignmentVersion` from a fresh load. A domain
error that a retry cannot fix (for example `ErrCancelAfterLock`) is logged,
the inbox row is written, and the message is acknowledged; it is never
retried forever.

## QueueAssignment

- **Actor / trigger:** `customer-ordering` publishes `CustomerOrderPlaced`.
- **Inbound adapter:** Kafka consumer of
  `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderPlaced`.
- **Preconditions:** no assignment exists for (`orderId`, `groupNo`).
- **Main flow:**
  1. Check the inbox for the CloudEvents `id`; stop if processed.
  2. For each entry of `groups`: build the `PromiseConstraint`
     (`promiseId`, `tier`, `deliverByLatest`, `witnessNodeId`) and the lines.
  3. Search candidates in the read models and rank them (`AssignmentCost`);
     the best one sets `releaseAt` (`VirtualQueue`).
  4. Create the assignment in `QUEUED`, `assignmentVersion` 1.
  5. Save, outbox `FulfillmentQueued`, inbox row, one transaction.
  6. For a `SAME_DAY` group, run `ReleaseToNode` at once.
- **Errors:** none of the model's invariants applies at creation. A group
  with no feasible candidate at all is still queued; `ReleaseToNode` will
  declare it unsourceable (see the open question on `releaseAt` without a
  candidate).
- **Events:** `FulfillmentQueued`.
- **Idempotency:** inbox on the CloudEvents `id`; a unique key on
  (`orderId`, `groupNo`) makes a repeated event a no-op.

## ReoptimiseAssignment

- **Actor / trigger:** the re-optimisation sweep over `QUEUED` assignments;
  the network-ops planner.
- **Inbound adapter:** scheduler; REST
  `POST /assignments/{assignmentId}:reoptimise` with `Idempotency-Key`.
- **Preconditions:** state `QUEUED`.
- **Main flow:**
  1. Load the assignment (404 if unknown).
  2. Re-run the candidate search on the current read models, skipping
     excluded nodes and candidates with `eta > deliverByLatest`.
  3. Rank by `AssignmentCost`; ties go to the witness node.
  4. If the best node differs, replace the candidate, move `releaseAt`, bump
     `assignmentVersion` and raise `FulfillmentReassigned`. If it is the same
     node with a better path, update the candidate and `releaseAt` silently.
  5. Save with the version check and the outbox row.
- **Errors:**

  | Error | When | HTTP | Problem `type` |
  | --- | --- | --- | --- |
  | `ErrAssignmentLocked` | state `LOCKED` (or later) | 409 | `assignment-locked` |
  | `ErrReleaseInFlight` | state `RELEASED`, a release is pending | 409 | `release-in-flight` |
  | `ErrNodeExcluded` | the chosen candidate is an excluded node (guard) | 409 | `node-excluded` |
  | `ErrCandidateBreaksPromise` | the chosen candidate's `eta` is past `deliverByLatest` (guard) | 422 | `candidate-breaks-promise` |
  | `ErrStaleAssignmentVersion` | the row changed since the load | 409 | `stale-assignment-version` |
  | (no `Err...` in the model) | state `UNSOURCEABLE`, `CANCELLED`, `SHIPPED`, `DELIVERED` | 409 | not named (open question) |
  | not found | unknown `assignmentId` | 404 | `assignment-not-found` |

- **Events:** `FulfillmentReassigned` when the node changes; none otherwise.
- **Idempotency:** a re-run on unchanged read models picks the same
  candidate and changes nothing. The REST route stores the response per
  `Idempotency-Key`.

## ReleaseToNode

- **Actor / trigger:** the release timer at `releaseAt`; immediately for
  `SAME_DAY`.
- **Inbound adapter:** scheduler (`QUEUED` assignments with
  `releaseAt <= now`).
- **Preconditions:** state `QUEUED`; no release `PENDING`.
- **Main flow:**
  1. Load the assignment.
  2. Re-check the candidate against fresh read models: not excluded,
     `eta <= deliverByLatest`, node still `ACTIVE`, every line available.
  3. If it holds: append a `Release` (`releaseNo` = last + 1, `nodeId`,
     `releasedAt`, `requiredShipBy` = pickup cutoff, `outcome` `PENDING`), resolve each line's
     `listingId` for the node, state `RELEASED`, raise
     `FulfillmentReleasedToNode`.
  4. If no candidate meets `deliverByLatest`: state `UNSOURCEABLE`, raise
     `FulfillmentUnsourceable` with `excludedNodes`.
  5. Save with the version check and the outbox row.
- **Errors:**

  | Error | When | HTTP | Problem `type` |
  | --- | --- | --- | --- |
  | `ErrReleaseInFlight` | a release is already `PENDING` | 409 | `release-in-flight` |
  | `ErrCandidateBreaksPromise` | the candidate no longer meets `deliverByLatest` (guard; the flow picks another or goes `UNSOURCEABLE`) | 422 | `candidate-breaks-promise` |
  | `ErrNodeExcluded` | the candidate is an excluded node (guard) | 409 | `node-excluded` |
  | `ErrStaleAssignmentVersion` | concurrent change | 409 | `stale-assignment-version` |

- **Events:** `FulfillmentReleasedToNode` or `FulfillmentUnsourceable`.
- **Idempotency:** the timer selects only `QUEUED` rows; a second firing
  finds `RELEASED` and stops. `vendor-connectivity` derives `poNumber` from
  `assignmentId + releaseNo`, so a re-delivered event issues no second PO.

## HandleNodeRefusal

- **Actor / trigger:** `vendor-connectivity` publishes
  `PurchaseOrderRejected` or `PurchaseOrderExpired`.
- **Inbound adapter:** Kafka consumer of
  `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderRejected`
  and `...purchaseorder.PurchaseOrderExpired`.
- **Preconditions:** state `RELEASED`; the event's `releaseNo` is the
  `PENDING` release.
- **Main flow:**
  1. Inbox check.
  2. Load; if `releaseNo` is not the pending release, record the inbox row
     and stop (a late outcome of an old release).
  3. Set that release's `outcome` (`REJECTED` with `reasonCode`, or
     `EXPIRED`) and add `ExcludedNode{nodeId, reason}`.
  4. Search and rank candidates without the excluded nodes.
  5. A candidate meets `deliverByLatest`: state `QUEUED`, new `releaseAt`
     (immediately if already past), raise `FulfillmentReassigned`
     (`fromNodeId` = refusing node). None: state `UNSOURCEABLE`, raise
     `FulfillmentUnsourceable`.
  6. Save with version check, outbox and inbox rows.
- **Errors:**

  | Error | When | HTTP | Problem `type` |
  | --- | --- | --- | --- |
  | `ErrAssignmentLocked` | the assignment is already `LOCKED` | 409 | `assignment-locked` |
  | `ErrStaleAssignmentVersion` | concurrent change | 409 | `stale-assignment-version` (retry) |

- **Events:** `FulfillmentReassigned` or `FulfillmentUnsourceable`.
- **Idempotency:** inbox; the `releaseNo` match makes a repeat a no-op.

## LockAssignment

- **Actor / trigger:** `vendor-connectivity` publishes `PurchaseOrderAccepted`
  (`LockOnCommit`).
- **Inbound adapter:** Kafka consumer of
  `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderAccepted`.
- **Preconditions:** state `RELEASED`; `releaseNo` is the pending release.
- **Main flow:**
  1. Inbox check; load.
  2. Set the release `outcome` to `ACCEPTED`, `lockedAt = acceptedAt`, state
     `LOCKED`.
  3. Save with version check, outbox `FulfillmentLocked`, inbox row.
- **Errors:**

  | Error | When | HTTP | Problem `type` |
  | --- | --- | --- | --- |
  | `ErrAssignmentLocked` | already `LOCKED` by a different release (should not happen) | 409 | `assignment-locked` |
  | `ErrStaleAssignmentVersion` | concurrent change | 409 | `stale-assignment-version` (retry) |

  An acceptance for a `CANCELLED` assignment has no modelled outcome (open
  question): the proposal is to log it and record the inbox row.
- **Events:** `FulfillmentLocked`.
- **Idempotency:** inbox; a repeat on `LOCKED` with the same `releaseNo` is a
  no-op.

## MarkShipped

- **Actor / trigger:** `vendor-connectivity` publishes
  `VendorShipmentConfirmed`.
- **Inbound adapter:** Kafka consumer of
  `com.retailnetwork.partner.vendor-connectivity.purchaseorder.VendorShipmentConfirmed`.
- **Preconditions:** state `LOCKED`.
- **Main flow:** inbox check; load; record `trackingNumbers`, `shippedAt`;
  state `SHIPPED`; save with outbox `FulfillmentShipped`.
- **Errors:** `ErrStaleAssignmentVersion` → 409 `stale-assignment-version`
  (retry). A shipment for an assignment that is not `LOCKED` has no `Err...`
  in the model; it is logged.
- **Events:** `FulfillmentShipped`.
- **Idempotency:** inbox; a repeat on `SHIPPED` is a no-op.

## MarkDelivered

- **Actor / trigger:** `shipping-and-tracking` publishes `PackageDelivered`.
- **Inbound adapter:** Kafka consumer of
  `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageDelivered`.
- **Preconditions:** state `SHIPPED`.
- **Main flow:** inbox check; load by `assignmentId`; record `deliveredAt`;
  state `DELIVERED`; save with outbox `FulfillmentDelivered`.
- **Errors:** `ErrStaleAssignmentVersion` → 409 `stale-assignment-version`
  (retry).
- **Events:** `FulfillmentDelivered`.
- **Idempotency:** inbox; a repeat on `DELIVERED` is a no-op. Whether a
  multi-package group waits for every `trackingNumber` is an open question.

## CancelAssignment

- **Actor / trigger:** `customer-ordering` publishes
  `CustomerOrderCancelled`.
- **Inbound adapter:** Kafka consumer of
  `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderCancelled`.
- **Preconditions:** state `QUEUED` or `RELEASED`.
- **Main flow:**
  1. Inbox check.
  2. For each `groupNo` in `groupNos`, load the assignment of (`orderId`,
     `groupNo`).
  3. Cancel: state `CANCELLED`; a `PENDING` release stays as it is (the PO
     is cancelled by `vendor-connectivity` on the event).
  4. Save with outbox `FulfillmentCancelled` (`reason` from the event).
- **Errors:**

  | Error | When | HTTP | Problem `type` |
  | --- | --- | --- | --- |
  | `ErrCancelAfterLock` | state `LOCKED`, `SHIPPED` or `DELIVERED` | 409 | `cancel-after-lock` |
  | `ErrStaleAssignmentVersion` | concurrent change | 409 | `stale-assignment-version` (retry) |
  | (no `Err...` in the model) | state `UNSOURCEABLE` | 409 | not named (open question) |

- **Events:** `FulfillmentCancelled`.
- **Idempotency:** inbox; an already `CANCELLED` assignment is a no-op.

## ApplyRevisedPromise

- **Actor / trigger:** `delivery-promise` publishes `PromiseRevised`
  (its answer to `FulfillmentUnsourceable`).
- **Inbound adapter:** Kafka consumer of
  `com.retailnetwork.commerce.delivery-promise.promise.PromiseRevised`.
- **Preconditions:** the assignment of `promiseId` is `UNSOURCEABLE`.
- **Main flow:**
  1. Inbox check; load the assignment by `promiseId`.
  2. Update `PromiseConstraint.deliverByLatest` (a revision never moves it
     earlier, `delivery-promise`'s `ErrRevisionMovesEarlier`) and
     `witnessNodeId` from the event's `nodeId`.
  3. Search and rank candidates; set `releaseAt`; state `QUEUED`.
  4. Save with version check and inbox row.
- **Errors:** `ErrStaleAssignmentVersion` → 409 `stale-assignment-version`
  (retry). For an assignment in any other state the model defines no
  transition; the event is recorded and ignored (open question).
- **Events:** none in the model (open question).
- **Idempotency:** inbox; applied only from `UNSOURCEABLE`.
