---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: One proposed application use case per Vendor Connectivity command - trigger, inbound adapter, preconditions, main flow, errors mapped to HTTP problem types, events and idempotency.
---

# Use Cases

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One proposed application service per command in
`contexts[vendor-connectivity].aggregates[*].commands`, under
`internal/application/usecases`. The step-by-step runtime view is on
[Sequence Diagrams](/network/contexts/vendor-connectivity/sequence-diagrams).

Reads are not use cases. `PollPurchaseOrders`, `GetPurchaseOrder`,
`GetTransaction` and `GetNode` read repositories or read models directly;
`GetScorecard` relays node-performance's `GET /scorecards/{nodeId}`.

## Conventions for every use case

- **Errors** are RFC 9457 `application/problem+json`. Mapping: validation
  `422`, conflict or state `409`, not found `404`, stale version `409`.
  The `type` is the slug shown.
- **Rate limit.** Every `/vendor/...` route may answer `429` `rate-limited`
  with `Retry-After` before the use case runs (`RATE_LIMIT_RPS`).
- **Idempotency-Key.** Every `POST`/`PUT` carries one. A repeat with the
  same key and vendor returns the first response (for an asynchronous
  write, the same `transactionId`).
- **Synchronous refusal vs failed transaction.** Rules this context can
  check at receipt are refused synchronously (no transaction is created).
  Refusals by a neighbour during processing end the transaction in
  `FAILURE`, with the neighbour's `Err...` in `SubmissionError.code`. This
  split is proposed; the model does not state it.
- **One transaction** per use case: the aggregate change, its outbox rows
  and (for consumers) the inbox row commit together.

| Model error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrAckWindowOutOfRange` | 422 | `ack-window-out-of-range` |
| `ErrNodeNotOwnedByVendor` | 404 | `node-not-owned-by-vendor` (404, so a vendor cannot probe another vendor's nodes) |
| `ErrPartialAcknowledgement` | 422 | `partial-acknowledgement` |
| `ErrAlreadyAcknowledged` | 409 | `already-acknowledged` |
| `ErrAckWindowClosed` | 409 | `ack-window-closed` |
| `ErrLabelBeforeAcceptance` | 409 | `label-before-acceptance` |
| `ErrConfirmWithoutLabel` | 409 | `confirm-without-label` |
| `ErrCancelAfterAcknowledgement` | no HTTP (Kafka consumer) | would be 409 `cancel-after-acknowledgement` |
| `ErrSubmissionAlreadyProcessed` | no HTTP (internal) | would be 409 `submission-already-processed` |
| `ErrSubmissionNotDue` | no HTTP (internal) | would be 409 `submission-not-due` |
| purchase order, node or transaction unknown (no model `Err`) | 404 | `not-found` |
| request body malformed (no model `Err`) | 422 | `validation` |
| optimistic-concurrency version conflict (no model `Err`) | 409 | `stale` (retried once inside the use case before it is returned) |

## OnboardVendor

- **Actor / trigger:** network partner manager.
- **Inbound adapter:** REST `POST /vendors` (`internal/adapters/inbound/http`).
- **Preconditions:** none on other aggregates.
- **Main flow:**
  1. Validate `vendorId`, `name`, `ackWindowMinutes`.
  2. `vendor.Onboard(vendorId, name, ackWindow)`: checks 1h to 24h.
  3. Save the `VendorAccount` (`ACTIVE`) and write `VendorOnboarded` to the
     outbox in one transaction.
  4. Return `201` with the account.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrAckWindowOutOfRange` | 422 | `ack-window-out-of-range` |

- **Events:** `VendorOnboarded`.
- **Idempotency:** `Idempotency-Key`; a second onboarding of an existing
  `vendorId` with a new key returns the existing account unchanged
  (proposed; the model has no duplicate-vendor error).

## SuspendVendor

- **Actor / trigger:** not stated in the model.
- **Inbound adapter:** none in the model (no route).
- **Preconditions:** the vendor is `ACTIVE`.
- **Main flow:**
  1. Load the `VendorAccount`.
  2. `Suspend()`: `ACTIVE` to `SUSPENDED`.
  3. Save with a version check.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| vendor unknown | 404 | `not-found` |
| version conflict | 409 | `stale` |

- **Events:** none in the model.
- **Idempotency:** suspending a `SUSPENDED` vendor is a no-op (proposed).
- **Gap:** the model gives this command no channel, no event and no rule
  for what a suspended vendor may not do.

## ReinstateVendor

- **Actor / trigger:** not stated in the model.
- **Inbound adapter:** none in the model (no route).
- **Preconditions:** the vendor is `SUSPENDED`.
- **Main flow:**
  1. Load the `VendorAccount`.
  2. `Reinstate()`: `SUSPENDED` to `ACTIVE`.
  3. Save with a version check.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| vendor unknown | 404 | `not-found` |
| version conflict | 409 | `stale` |

- **Events:** none in the model.
- **Idempotency:** reinstating an `ACTIVE` vendor is a no-op (proposed).

## IssuePurchaseOrder

- **Actor / trigger:** policy `IssueOnRelease`, on
  `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReleasedToNode`.
- **Inbound adapter:** Kafka consumer on `retailnetwork.order-sourcing.events`
  (`internal/adapters/inbound/kafka`).
- **Preconditions:** `nodeId` is a `VENDOR` node in `VendorNodeView`; its
  vendor has a `VendorAccount`.
- **Main flow:**
  1. Claim the CloudEvents `id` in `processed_events`; a duplicate stops
     here.
  2. Look up the node in `VendorNodeView`. Not a vendor node: record the
     inbox row and stop.
  3. Derive `poNumber` from `assignmentId + releaseNo`. If it exists, stop.
  4. Load the vendor's ack window.
  5. `po.Issue(...)` with `requiredShipBy`, `lines` (`listingId`,
     `quantity`, numbered `lineNo`) and
     `ackBy = min(issuedAt + ackWindow, requiredShipBy - handlingTime)`.
  6. Save (`ISSUED`), write `PurchaseOrderIssued` to the outbox, commit
     with the inbox row.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| node not in `VendorNodeView` yet | no HTTP | not acknowledged on Kafka; retried, so the release is not lost to an event race |

- **Events:** `PurchaseOrderIssued`.
- **Idempotency:** the inbox on the event `id`, and `poNumber` on
  `assignmentId + releaseNo`.
- **Gap:** step 5 needs the node's `handlingTime`, which this context has
  no source for.

## SubmitAcknowledgement

- **Actor / trigger:** vendor.
- **Inbound adapter:** Vendor API `POST /vendor/acknowledgements`.
- **Preconditions:** the PO exists, belongs to a node of `vendorId`, is
  `ISSUED`, and now is not after `ackBy`.
- **Main flow:**
  1. Load the PO by `poNumber`; check ownership through `VendorNodeView`.
  2. `po.SubmitAcknowledgement(decision, reasonCode, lines, now)`: every
     line once at its ordered quantity, one decision, before `ackBy`.
  3. In one transaction: save the PO (`ACK_PROCESSING`, decision recorded)
     and `ReceiveSubmission` a `Submission` of kind `ACKNOWLEDGEMENT`
     (`PROCESSING`, `notBefore = receivedAt + TX_PROCESSING_DELAY`).
  4. Return `202 {transactionId}`.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrPartialAcknowledgement` | 422 | `partial-acknowledgement` |
| `ErrAlreadyAcknowledged` | 409 | `already-acknowledged` |
| `ErrAckWindowClosed` | 409 | `ack-window-closed` |
| `ErrNodeNotOwnedByVendor` | 404 | `node-not-owned-by-vendor` |
| PO unknown | 404 | `not-found` |
| `REJECT` without `reasonCode` | 422 | `validation` |
| version conflict | 409 | `stale` |

- **Events:** none at receipt. `PurchaseOrderAccepted` or
  `PurchaseOrderRejected` and `SubmissionProcessed` follow from
  `ProcessSubmission`.
- **Idempotency:** `Idempotency-Key` returns the same `transactionId`. A
  second acknowledgement with a new key is `ErrAlreadyAcknowledged` until a
  failed transaction returns the PO to `ISSUED`.
- **Gap:** an acknowledgement of a `CANCELLED` or `EXPIRED` PO has no
  dedicated `Err...`; `EXPIRED` is past `ackBy` and gets
  `ErrAckWindowClosed`, `CANCELLED` has none.

## RequestLabel

- **Actor / trigger:** vendor.
- **Inbound adapter:** Vendor API `POST /vendor/shipping-labels`.
- **Preconditions:** the PO is `ACCEPTED` and belongs to the vendor.
- **Main flow:**
  1. Load the PO; check ownership.
  2. `po.CanLabel()`: `ACCEPTED` only.
  3. For each requested `packageNo`, call shipping-and-tracking
     `POST /labels` (`IssueLabel`) with `poNumber`, `assignmentId`,
     `packageNo`. The address is resolved there and never returned.
  4. `po.AddLabels(labels)`: `labelRef`, `trackingNumber`, `carrier`.
  5. Save; return `200` with the labels.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrLabelBeforeAcceptance` | 409 | `label-before-acceptance` |
| `ErrNodeNotOwnedByVendor` | 404 | `node-not-owned-by-vendor` |
| PO unknown | 404 | `not-found` |
| shipping-and-tracking unavailable | 503 | `upstream-unavailable` (proposed) |

- **Events:** none here; shipping-and-tracking publishes `LabelIssued`.
- **Idempotency:** shipping-and-tracking issues one label per
  `(poNumber, packageNo)` (`ErrLabelAlreadyIssued` there); this use case
  returns the stored label for a package it already holds.
- **Gap:** synchronous, unlike every other vendor write.

## SubmitShipmentConfirmation

- **Actor / trigger:** vendor.
- **Inbound adapter:** Vendor API `POST /vendor/shipment-confirmations`.
- **Preconditions:** the PO is `ACCEPTED`, has labels, and every
  `trackingNumber` in the request is one of its labels.
- **Main flow:**
  1. Load the PO; check ownership.
  2. `po.SubmitShipmentConfirmation(trackingNumbers, shippedAt)`.
  3. In one transaction: save the PO (`SHIPMENT_PROCESSING`) and
     `ReceiveSubmission` of kind `SHIPMENT_CONFIRMATION`.
  4. Return `202 {transactionId}`.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrConfirmWithoutLabel` | 409 | `confirm-without-label` |
| `ErrNodeNotOwnedByVendor` | 404 | `node-not-owned-by-vendor` |
| PO unknown | 404 | `not-found` |
| PO not `ACCEPTED` and no label missing (no model `Err`) | 409 | `purchase-order-state` (proposed; see gap) |
| version conflict | 409 | `stale` |

- **Events:** none at receipt; `VendorShipmentConfirmed` and
  `SubmissionProcessed` follow from `ProcessSubmission`.
- **Idempotency:** `Idempotency-Key`. A confirmation while one is
  processing is refused by state.
- **Gap:** the model has no `Err...` for a shipment confirmation against a
  PO that is not `ACCEPTED` (for example `SHIPMENT_PROCESSING` or `SHIPPED`).

## ExpireUnacknowledgedOrders

- **Actor / trigger:** policy `ExpireUnacknowledged` (sweep timer).
- **Inbound adapter:** internal ticker (`cmd`), no route.
- **Preconditions:** the PO is `ISSUED` and now is after `ackBy`.
- **Main flow:**
  1. List `ISSUED` POs with `ackBy` in the past.
  2. For each: `po.Expire(now)`, save with a version check, write
     `PurchaseOrderExpired` to the outbox, commit.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| version conflict (the vendor acknowledged meanwhile) | no HTTP | skipped; the next pass re-reads |

- **Events:** `PurchaseOrderExpired`.
- **Idempotency:** only `ISSUED` POs are expired; an `EXPIRED` one is not
  listed again. A PO in `ACK_PROCESSING` is never expired; if its
  transaction fails after `ackBy`, it returns to `ISSUED` and the next pass
  expires it.

## CancelPurchaseOrder

- **Actor / trigger:** policy `CancelOnSourcingCancel`, on
  `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentCancelled`.
- **Inbound adapter:** Kafka consumer on `retailnetwork.order-sourcing.events`.
- **Preconditions:** a PO exists for that `assignmentId` and is `ISSUED`.
- **Main flow:**
  1. Claim the event `id` in the inbox.
  2. Find the PO of the assignment's open release (the event carries
     `assignmentId` but no `releaseNo`; order-sourcing allows one pending
     release at a time).
  3. `po.Cancel(reason)`: `ISSUED` only.
  4. Save, write `PurchaseOrderCancelled`, commit with the inbox row.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrCancelAfterAcknowledgement` | no HTTP | logged; the inbox row is written so the event is not retried |
| no PO for the assignment | no HTTP | inbox row written, nothing else |

- **Events:** `PurchaseOrderCancelled`.
- **Idempotency:** the inbox; a `CANCELLED` PO is left as is.
- **Gap:** nothing tells the vendor or order-sourcing when the cancel is
  refused after acknowledgement.

## ReceiveSubmission

- **Actor / trigger:** vendor, for the three relay writes below. The
  acknowledgement and shipment-confirmation use cases above also call it
  inside their own transaction.
- **Inbound adapter:** Vendor API `POST /vendor/nodes`
  (`RegisterVendorNode`, kind `NODE_REGISTRATION`),
  `PUT /vendor/nodes/{nodeId}/profile` (`DeclareNodeProfile`, kind
  `NODE_PROFILE`), `POST /vendor/inventory` (`SubmitInventory`, kind
  `INVENTORY`).
- **Preconditions:** the body is well-formed; for profile and inventory,
  the node belongs to `vendorId` in `VendorNodeView`.
- **Main flow:**
  1. Validate the body and, where a node is named, ownership.
  2. `submission.Receive(vendorId, kind, payload, now, delay)`: status
     `PROCESSING`, `notBefore = receivedAt + TX_PROCESSING_DELAY`.
  3. Save; return `202 {transactionId}`.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrNodeNotOwnedByVendor` | 404 | `node-not-owned-by-vendor` |
| node unknown | 404 | `not-found` |
| body malformed | 422 | `validation` |

- **Events:** none at receipt.
- **Idempotency:** `Idempotency-Key` per vendor, stored on the submission.

## ProcessSubmission

- **Actor / trigger:** the submission processor (internal ticker).
- **Inbound adapter:** none; `cmd` worker.
- **Preconditions:** the submission is `PROCESSING` and now is at or after
  `notBefore`.
- **Main flow:**
  1. Pick due `PROCESSING` submissions.
  2. Apply `TX_FAILURE_RATE`: a drawn failure ends the submission in
     `FAILURE` with a simulated `SubmissionError`.
  3. Otherwise by kind:
     - `NODE_REGISTRATION`: node-topology `POST /nodes` (`RegisterNode`).
     - `NODE_PROFILE`: node-topology `PUT /nodes/{nodeId}/operational-profile`.
     - `INVENTORY`: offer-availability `POST /inventory-feeds`.
     - `ACKNOWLEDGEMENT`, `SHIPMENT_CONFIRMATION`: no call.
     A `4xx` from a neighbour is `FAILURE` with its `Err...` as `code`; a
     `5xx` or timeout leaves the submission `PROCESSING` for the next pass.
  4. `submission.Complete(status, errors)`.
  5. For `ACKNOWLEDGEMENT` and `SHIPMENT_CONFIRMATION`, apply the outcome
     to the PO: `ACK_PROCESSING` to `ACCEPTED`, `REJECTED` or back to
     `ISSUED`; `SHIPMENT_PROCESSING` to `SHIPPED` or back to `ACCEPTED`.
  6. In one transaction: save the submission and the PO, write
     `SubmissionProcessed` and, where a PO changed, its event.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrSubmissionNotDue` | no HTTP | skipped until `notBefore` |
| `ErrSubmissionAlreadyProcessed` | no HTTP | skipped (a second processor got there first) |
| version conflict on the PO | no HTTP | the whole transaction rolls back and is retried |

- **Events:** `SubmissionProcessed`; and one of `PurchaseOrderAccepted`,
  `PurchaseOrderRejected`, `VendorShipmentConfirmed` on success of the PO
  kinds.
- **Idempotency:** `ErrSubmissionAlreadyProcessed`; relayed calls are
  idempotent downstream (`profileRevision`, `feedId`, `vendorNodeCode`).
- **Note:** step 6 changes two aggregates in one local transaction so that
  a vendor reading `SUCCESS` always sees the PO in its new state. This is a
  proposed exception to "one aggregate per transaction", listed as an open
  question.

## SubmitInboundReceipt

> **Proposed, [ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments).** This section is the delta that the seller-inbound design adds to this page. Nothing in it is built.

- **Actor / trigger:** a vendor (for the fleet, `network-fulfillment`). REST `POST /vendor/inbound-receipts` with an `Idempotency-Key`.
- **Preconditions:** the shipment is in `InboundShipmentView` and its `nodeId` belongs to the vendor.
- **Flow:** validate the body (carton statuses, GTIN and SSCC shapes, quantities as eaches), create a `Submission` of kind `INBOUND_RECEIPT` in `PROCESSING`, return `202` with the `transactionId`. `ProcessSubmission` later marks it `SUCCESS` and writes `SubmissionProcessed` and `InboundReceiptSubmitted` to the outbox in one transaction.
- **Errors:** `ErrNodeNotOwnedByVendor` (404), `ErrUnknownInboundShipment` (404 `not-found`, so a vendor cannot probe another vendor's shipments), body malformed (422 `validation`).
- **Reads:** `GET /vendor/inbound-shipments?nodeId=&createdAfter=&nextToken=` and `GET /vendor/inbound-shipments/{shipmentId}` read `InboundShipmentView` directly. They return the shipment as a tree (shipment, optional pallet, carton, item) with `sscc`, `gtin`, `qtyEaches`, `lot`, `expiry` and `sellerId` (the seller of record, which the vendor keeps as its `ownerRef`).
