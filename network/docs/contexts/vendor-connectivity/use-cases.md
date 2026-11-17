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

One application service per command in
`contexts[vendor-connectivity].aggregates[*].commands`, under
`internal/application/usecases`. The step-by-step runtime view is on
[Sequence Diagrams](/network/contexts/vendor-connectivity/sequence-diagrams).

Reads are not use cases. `PollPurchaseOrders`, `GetPurchaseOrder`,
`GetTransaction` and `GetNode` read repositories or read models directly;
`GetScorecard` relays node-performance's `GET /scorecards/{nodeId}`.

## Conventions for every use case

- **Errors** are RFC 9457 `application/problem+json`. Mapping: validation
  `422`, conflict or state `409`, not found `404`, version conflict `409`.
  The `type` is the slug shown: the shared slugs are `not-found`,
  `illegal-transition`, `concurrent-update` and `validation-failed`; the rest
  is one slug per `Err...` name (kebab-case, no `Err`). The earlier placeholders
  `validation`, `stale` and `purchase-order-state` are not used (service ADR
  0002; `internal/adapters/inbound/http/errors.go`).
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
| `ErrVendorSuspended` | 409 | `vendor-suspended` (every vendor write while the vendor is `SUSPENDED`) |
| `ErrCancelAfterAcknowledgement` | no HTTP (Kafka consumer) | would be 409 `cancel-after-acknowledgement` |
| `ErrSubmissionAlreadyProcessed` | no HTTP (internal) | would be 409 `submission-already-processed` |
| `ErrSubmissionNotDue` | no HTTP (internal) | would be 409 `submission-not-due` |
| `ErrNotFound`: purchase order, vendor, node or transaction unknown | 404 | `not-found` |
| `ErrValidation`: request body malformed | 422 | `validation-failed` |
| `ErrIllegalTransition`: a command from a state that has no dedicated `Err...` | 409 | `illegal-transition` |
| `ErrConcurrentUpdate`: optimistic-concurrency version conflict | 409 | `concurrent-update` (retried once inside the use case before it is returned) |
| `ErrUpstreamUnavailable`: a neighbouring context did not answer | 503 | `upstream-unavailable` |
| `ErrUpstreamRefused`: a neighbouring context answered with a refusal this context does not translate | 502 | `upstream-refused` |

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
  `vendorId` with a new key returns the existing account unchanged, `200`
  (service ADR 0002 A8; the model has no duplicate-vendor error).

## SuspendVendor

- **Actor / trigger:** network partner manager.
- **Inbound adapter:** REST `POST /vendors/{vendorId}/suspensions` (optional
  body `reason`, 1 to 200 characters).
- **Preconditions:** the vendor exists.
- **Main flow:**
  1. Load the `VendorAccount`.
  2. `Suspend()`: `ACTIVE` to `SUSPENDED`.
  3. Save with a version check and write `VendorSuspended` to the outbox in
     one transaction.
- **Effect while `SUSPENDED` (service ADR 0002 A9):** every vendor write is refused
  with 409 `vendor-suspended` (`ErrVendorSuspended`): acknowledgement,
  inventory feed, node registration, node profile, label request, shipment
  confirmation and inbound receipt. Reads, polling, the issuing of new
  purchase orders, the expiry sweep and the processing of submissions already
  received continue.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| vendor unknown | 404 | `not-found` |
| version conflict | 409 | `concurrent-update` |

- **Events:** `VendorSuspended` (`vendorId`, `suspendedAt`, optional `reason`)
  on `retailnetwork.vendor-connectivity.events`; no context consumes it yet
  (service ADR 0002 A14, ADR 0004).
- **Idempotency:** suspending a `SUSPENDED` vendor is a no-op: `200` with the
  account unchanged and no event (service ADR 0002 A8).

## ReinstateVendor

- **Actor / trigger:** network partner manager.
- **Inbound adapter:** REST `POST /vendors/{vendorId}/reinstatements`.
- **Preconditions:** the vendor exists.
- **Main flow:**
  1. Load the `VendorAccount`.
  2. `Reinstate()`: `SUSPENDED` to `ACTIVE`.
  3. Save with a version check and write `VendorReinstated` to the outbox in
     one transaction.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| vendor unknown | 404 | `not-found` |
| version conflict | 409 | `concurrent-update` |

- **Events:** `VendorReinstated` (`vendorId`, `reinstatedAt`) on
  `retailnetwork.vendor-connectivity.events`; no context consumes it yet.
- **Idempotency:** reinstating an `ACTIVE` vendor is a no-op: `200` with the
  account unchanged and no event (service ADR 0002 A8).

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
  4. Load the vendor's ack window and the node's `handlingTimeMinutes` from
     `VendorNodeView`, which `NodeOperationalProfileDeclared` feeds (a lower
     `profileRevision` never overwrites a higher one). A node with no declared
     profile has handling time 0 (service ADR 0002 A3).
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
- **Handling time:** consumed from `NodeOperationalProfileDeclared` (service
  ADR 0003); there is no gap.

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
| `ErrVendorSuspended` | 409 | `vendor-suspended` |
| PO unknown | 404 | `not-found` |
| a `CANCELLED` PO (`ErrIllegalTransition`) | 409 | `illegal-transition` |
| `REJECT` without `reasonCode` | 422 | `validation-failed` |
| version conflict | 409 | `concurrent-update` |

- **Events:** none at receipt. `PurchaseOrderAccepted` or
  `PurchaseOrderRejected` and `SubmissionProcessed` follow from
  `ProcessSubmission`.
- **Idempotency:** `Idempotency-Key` returns the same `transactionId`. A
  second acknowledgement with a new key is `ErrAlreadyAcknowledged` until a
  failed transaction returns the PO to `ISSUED`.
- **Other states (service ADR 0002 A7):** an acknowledgement of a `CANCELLED`
  PO is `ErrIllegalTransition`; `EXPIRED` is past `ackBy` and gets
  `ErrAckWindowClosed`.

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
| `ErrVendorSuspended` | 409 | `vendor-suspended` |
| PO unknown | 404 | `not-found` |
| a `REJECTED`, `EXPIRED` or `CANCELLED` PO (`ErrIllegalTransition`) | 409 | `illegal-transition` |
| shipping-and-tracking did not answer (`ErrUpstreamUnavailable`) | 503 | `upstream-unavailable` |
| shipping-and-tracking refused with an answer this context does not translate (`ErrUpstreamRefused`) | 502 | `upstream-refused` |

- **Events:** none here; shipping-and-tracking publishes `LabelIssued`.
- **Idempotency:** shipping-and-tracking issues one label per
  `(poNumber, packageNo)` (`ErrLabelAlreadyIssued` there); this use case
  returns the stored label for a package it already holds.
- **Partial failure:** labels already issued stay stored when a later package
  fails; the answer is then 503 or 502 and a retry returns the stored labels and
  issues only the missing ones (service ADR 0002 A19).
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
| `ErrVendorSuspended` | 409 | `vendor-suspended` |
| PO `SHIPMENT_PROCESSING`, `SHIPPED`, `REJECTED`, `EXPIRED` or `CANCELLED` (`ErrIllegalTransition`) | 409 | `illegal-transition` |
| version conflict | 409 | `concurrent-update` |

- **Events:** none at receipt; `VendorShipmentConfirmed` and
  `SubmissionProcessed` follow from `ProcessSubmission`.
- **Idempotency:** `Idempotency-Key`. A confirmation while one is
  processing is refused by state.
- **Other states (service ADR 0002 A7):** a confirmation against an `ISSUED`
  or `ACK_PROCESSING` PO is `ErrConfirmWithoutLabel` (no label can exist yet);
  against `SHIPMENT_PROCESSING`, `SHIPPED`, `REJECTED`, `EXPIRED` or
  `CANCELLED` it is `ErrIllegalTransition`.

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
  Any other state is refused: `ErrCancelAfterAcknowledgement` for
  `ACK_PROCESSING`, `ACCEPTED`, `REJECTED`, `SHIPMENT_PROCESSING` and
  `SHIPPED`, and `ErrIllegalTransition` for `EXPIRED` and `CANCELLED`
  (`PurchaseOrder.Cancel`). Both are logged at INFO and acknowledged, so the
  observable result is the same.
- **Main flow:**
  1. Claim the event `id` in the inbox.
  2. Find the PO of the assignment's open release (the event carries
     `assignmentId` but no `releaseNo`; order-sourcing allows one pending
     release at a time).
  3. `po.Cancel(reason)`: `ISSUED` only.
  4. Save, write `PurchaseOrderCancelled`, commit with the inbox row.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrCancelAfterAcknowledgement` (the order is past acknowledgement and not `EXPIRED` or `CANCELLED`) | no HTTP | logged at INFO; the inbox row is written so the event is not retried |
| `ErrIllegalTransition` (the order is `EXPIRED` or `CANCELLED`) | no HTTP | logged at INFO; the inbox row is written, nothing is published |
| no PO for the assignment | no HTTP | inbox row written, nothing else |

- **Events:** `PurchaseOrderCancelled`.
- **Idempotency:** the inbox; a `CANCELLED` PO is left as is (it answers `ErrIllegalTransition`, logged and acknowledged).
- **Gap:** nothing tells the vendor or order-sourcing when the cancel is
  refused after acknowledgement.

## CancelOnReleaseWithdrawn

- **Actor / trigger:** policy `CancelOnReleaseWithdrawn`, on
  `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentReleaseWithdrawn`
  (`assignmentId`, `releaseNo`, `orderId`, `groupNo`, `reason`, `withdrawnAt`).
- **Inbound adapter:** the Kafka consumer already subscribed to `retailnetwork.order-sourcing.events`.
- **Preconditions:** a PO exists for (`assignmentId`, `releaseNo`) and is `ISSUED`.
- **Main flow:** claim the event `id` in the inbox; find the order by (`assignmentId`, `releaseNo`);
  not found is a no-op; `po.Cancel('release withdrawn: ' + reason)` (sanitised, at most 200 characters);
  save and write `PurchaseOrderCancelled` in the same transaction as the inbox row.
- **Errors:** `ErrCancelAfterAcknowledgement` (the order is past acknowledgement: `ACK_PROCESSING`, `ACCEPTED`,
  `REJECTED`, `SHIPMENT_PROCESSING` or `SHIPPED`) and `ErrIllegalTransition` (`EXPIRED` or already `CANCELLED`) are
  logged at INFO and acknowledged, not retried.
- **Events:** `PurchaseOrderCancelled`.
- **Idempotency:** the inbox. The lookup is by release number, so it never touches the order of a later
  release. The reason is carried as opaque text; this context does not branch on it.
- **Residual (owned by `order-sourcing`):** between the dissolve and this cancel the vendor may acknowledge;
  the order is then `ACCEPTED`, it is left as it is and `order-sourcing` ignores the stale acceptance.

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
| `ErrVendorSuspended` | 409 | `vendor-suspended` |
| node unknown | 404 | `not-found` |
| body malformed | 422 | `validation-failed` |

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

> **Built, [ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)** as realized by [`vendor-connectivity` ADR 0005](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0005-inbound-shipments-receipts-and-catalog-packaging.md) (inbound shipments, inbound receipts and catalogue packaging). This section is the delta the seller-inbound design added to this page; where the service decided differently, the text below says so.

- **Actor / trigger:** a vendor (for the fleet, `network-fulfillment`). REST `POST /vendor/inbound-receipts` with an `Idempotency-Key`.
- **Preconditions:** the shipment is in `InboundShipmentView` and its `nodeId` belongs to the vendor.
- **Flow:** validate the body (carton statuses, GTIN and SSCC shapes, quantities as eaches), create a `Submission` of kind `INBOUND_RECEIPT` in `PROCESSING`, return `202` with the `transactionId`. `InboundReceiptSubmitted` is appended to the outbox in the same unit of work, so a `202` always has its event; `ProcessSubmission` later reports `SubmissionProcessed` (service ADR 0005).
- **Errors:** `ErrNodeNotOwnedByVendor` (404), a suspended vendor (409 `vendor-suspended`), an unknown vendor, shipment or node (404 `not-found`, so a vendor cannot probe another vendor's shipments; the design named it `ErrUnknownInboundShipment`), body malformed (422 `validation-failed`).
- **Reads:** `GET /vendor/inbound-shipments?vendorId=&nodeId=&createdAfter=&nextCursor=&limit=` and `GET /vendor/inbound-shipments/{shipmentId}` read `InboundShipmentView` directly. They return the shipment as a tree (shipment, optional pallet, carton, item) with `sscc`, `gtin`, `qtyEaches`, `lot`, `expiry` and `sellerId` (the seller of record, which the vendor keeps as its `ownerRef`).

## SubmitReturnOutcome

> **Built, [ADR 0012](/network/adr/0012-customer-returns-is-a-bounded-context)** as realized by `vendor-connectivity` ADR 0014 (return advices and return outcomes).

- **Actor / trigger:** a vendor's returns-centre system. REST `POST /vendor/return-outcomes` with an `Idempotency-Key`. The fleet's `network-fulfillment` has no client for it on its `develop`.
- **Preconditions:** the authorization is in `ReturnAdviceView` and still `AUTHORIZED`; `nodeId` is the advice's node and belongs to the vendor.
- **Flow:** validate the body (`vendorId`, `authorizationId`, `nodeId`, `receivedAt`, 1 to 50 lines of `catalogItemId`, optional `ownerRef`, `qtyRestockable`, `qtyUnsellable`), create a `Submission` of kind `RETURN_OUTCOME`, move the advice to `OUTCOME_RECORDED` and append `VendorReturnOutcomeSubmitted` to the outbox in the same unit of work, return `202` with the `transactionId`. Lines the advice never authorized are reported, never refused; `customer-returns` records them as unexpected.
- **Errors:** a suspended vendor (409 `vendor-suspended`), an unknown vendor, authorization or node (404 `not-found`), `ErrNodeNotOwnedByVendor` (404), an advice that is not `AUTHORIZED` (409 `illegal-transition`), a `nodeId` that is not the advice's node or a malformed body (422 `validation-failed`).
- **Events:** `VendorReturnOutcomeSubmitted` (subject and key `authorizationId`), consumed by `customer-returns`.
- **Reads:** `GET /vendor/return-advices?vendorId=&readyAfter=&nodeId=&cursor=&limit=` (`PollReturnAdvices`) and `GET /vendor/return-advices/{authorizationId}` (`GetReturnAdvice`) read `ReturnAdviceView` directly. The poll answers the `AUTHORIZED` advices of the vendor's nodes, oldest first; the single read also answers a closed advice (`CANCELLED` or `OUTCOME_RECORDED`).
