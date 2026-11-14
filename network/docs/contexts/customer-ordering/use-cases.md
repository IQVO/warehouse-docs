---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: Every proposed Customer Ordering command use case with its actor or trigger, inbound adapter, preconditions, main flow, error mapping, events and idempotency.
---

# Use Cases

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One section per command of `contexts[customer-ordering].aggregates[*].commands`.
They are proposed application services in `internal/application/usecases`. The
step-by-step diagrams are on [Sequence Diagrams](/network/contexts/customer-ordering/sequence-diagrams);
the payloads are on [Domain Events](/network/contexts/customer-ordering/domain-events);
the REST contract is `apis/customer-ordering/openapi.yaml`.

Reads are not use cases here: `GET /orders/{orderId}` (`GetOrder`),
`GET /orders/{orderId}/tracking` (`GetTracking`, from `OrderTrackingView`) and
`GET /orders/{orderId}/ship-to` (`GetShipTo`) read the stores directly.

## Triggers at a glance

| Use case | Trigger | Inbound adapter | Emits |
| --- | --- | --- | --- |
| `PlaceOrder` | Shopper | REST `POST /checkout` | `CustomerOrderPlaced` |
| `CancelOrder` | Shopper | REST `POST /orders/{orderId}/cancellations` | `CustomerOrderCancelled` |
| `CancelUnkeepableGroup` (policy `CancelOnUnfulfillable`) | `delivery-promise` | Kafka consumer, `PromiseUnkeepable` | `CustomerOrderCancelled` |
| `RegisterShopper` | Storefront (assumed; no `inbound` row) | REST `POST /shoppers` | none |
| `MarkInFulfillment` | `order-sourcing` | Kafka consumer, `FulfillmentLocked` | none |
| `MarkGroupShipped` | `order-sourcing` | Kafka consumer, `FulfillmentShipped` | none |
| `MarkGroupDelivered` | `shipping-and-tracking` | Kafka consumer, `PackageDelivered` | none |
| `MarkGroupLost`, `MarkGroupReturned` | `shipping-and-tracking` | Kafka consumer, `PackageLost`, `PackageReturned` | none |
| `ConfirmGroupCancelled`, `RefuseGroupCancellation` | `order-sourcing` | Kafka consumer, `FulfillmentCancelled`, `FulfillmentCancelRefused` | none |
| `UpdateGroupPromise` | `delivery-promise` | Kafka consumer, `PromiseRevised` | none |

The pairing of consumed events with commands is this pack's reading. The
model lists both sides but does not pair them (see the
[canvas](/network/contexts/customer-ordering/bounded-context-canvas) open questions).

## How save and publish commit

Every use case that changes an aggregate loads it with its `version`,
calls the aggregate, then saves it inside one Postgres transaction. The save
is conditional on the version it loaded (`UPDATE ... WHERE version = ?`). If
an event is raised, the outbox row (`outbox_events`) is written in the same
transaction. A consumer-driven use case also inserts the CloudEvents `id` into
`processed_events` in that transaction. A relay publishes outbox rows to
Kafka after the commit. Synchronous calls to `delivery-promise` happen
**before** the transaction, never inside it.

Error responses use `application/problem+json` (RFC 9457) with `type`
`/problems/<slug>` (a relative URI reference). Mapping rule: validation
422, conflict or state 409, not found 404, capacity or closed 409, stale 409.

## PlaceOrder

- **Actor / trigger:** the shopper, through the storefront (or e2e-tests).
- **Inbound adapter:** REST `POST /checkout`, header `Idempotency-Key`
  required.
- **Input:** `shopperId`, `shipTo` (`ShipTo`), `lines[]` (`lineNo`,
  `catalogItemId`, `quantity`), `groups[]` (`groupNo`, `offerId`, `lineNos[]`):
  the shipment groups and offers the shopper saw when the storefront quoted
  `delivery-promise`.
- **Preconditions:** the `shopperId` names a registered shopper. Checkout does
  check it, before `delivery-promise` is called: an unknown shopper is 422
  `validation-failed` (ADR 0002 A9; `ErrValidation`).
- **Main flow:**
  1. Look up the `Idempotency-Key`. On a hit with the same request body,
     return the stored response.
  2. Check that every line is in exactly one group
     (`ErrLineWithoutPromise`), and that the `shopperId` is a registered
     shopper (422 `validation-failed` when it is not), before any call.
  3. For each group, call `delivery-promise` `MakePromise`
     (`POST /promises`, with the `offerId`). Send an `Idempotency-Key` derived
     from the `offerId`, so a retried checkout gets back the same provisional
     promise. The reply gives `promiseId`, `tier`, `nodeId` (the witness
     node), `shipBy`, `deliverByEarliest`, `deliverByLatest`, `holdExpiresAt`.
  4. If a group's offer is expired or consumed (`ErrOfferNotQuotable`), apply
     `CheckoutPromising`. Call `QuoteDeliveryOffers`
     (`POST /delivery-quotes`) for that group's lines and the ship-to's
     destination postal prefix, and answer 409 with the new offers. Nothing is
     saved.
  5. `CustomerOrder.PlaceOrder(...)`: it checks
     `ErrLineWithoutPromise` (every group has a promise) and
     `ErrPromiseDestinationMismatch` (each promise's destination postal
     prefix equals the ship-to's). Status `PLACED`.
  6. In one transaction, insert the order and write `CustomerOrderPlaced` to
     the outbox. Store the response under the `Idempotency-Key`.
  7. Answer `201` with `orderId`, status and the window per group.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrLineWithoutPromise` | 422 | `line-without-promise` | A line in no group or two groups, or a group without a promise. |
| `ErrValidation` (unknown shopper) | 422 | `validation-failed` | `shopperId` is not a registered shopper, or a `shipToAddressId` is not a saved address of that shopper (ADR 0002 A9, A25). Refused before `delivery-promise` is called. |
| `ErrPromiseDestinationMismatch` | 422 | `promise-destination-mismatch` | An offer quoted for another postal prefix. |
| `ErrOfferNotQuotable` (from `delivery-promise`) | 409 | `offer-not-quotable` | Body carries the re-quoted offers (`CheckoutPromising`). |
| `ErrPromiseCapacityExhausted` (from `delivery-promise`) | 409 | `promise-capacity-exhausted` | The node cutoff filled since the quote. |
| `ErrBookClosed` (from `delivery-promise`) | 409 | `book-closed` | Too close to the cutoff to hold. |
| `ErrGroupSpansNodes` (from `delivery-promise`) | 422 | `group-spans-nodes` | The group's lines cannot ship from one node. |
| `delivery-promise` unreachable or timed out | 503 | `delivery-promise-unavailable` | No `Err` name in the model; retry with the same `Idempotency-Key`. |

- **Events emitted:** `CustomerOrderPlaced`, with the promise snapshot of
  every group.
- **Idempotency:** `Idempotency-Key` on the route; the derived key on each
  `MakePromise`. A failed checkout leaves provisional promises that
  `delivery-promise` releases at `holdExpiresAt` (`ReleaseExpiredHolds`).
- **Risk:** `delivery-promise` confirms only when it consumes
  `CustomerOrderPlaced`. Outbox lag past `holdExpiresAt` leaves a placed
  order with a released promise (EventStorming hotspot H2).

## CancelOrder (shopper)

- **Actor / trigger:** the shopper.
- **Inbound adapter:** REST `POST /orders/{orderId}/cancellations`, header
  `Idempotency-Key` required; body `reason`.
- **Preconditions:** the order exists; at least one group is unlocked
  (`PROMISED`) or the request is a repeat.
- **Main flow:**
  1. Look up the `Idempotency-Key`; replay the stored response on a hit.
  2. Load `CustomerOrder` with its `version` (404 `not-found` if absent).
  3. `CustomerOrder.CancelOrder(reason, now)` is a REQUEST (ADR 0002 A3): every
     `PROMISED` group moves to `CANCELLATION_REQUESTED`; locked, shipped and
     delivered groups are untouched, so the order keeps its derived status.
     When every group is already `CANCELLATION_REQUESTED` or `CANCELLED`
     (a repeat) it answers `200` with the order unchanged and publishes
     nothing. A `DELIVERED`, `LOST` or `RETURNED` order is `ErrStatusRegression`;
     an order whose groups are all locked, shipped or delivered is
     `ErrCancelAfterLock`.
  4. In one transaction, save (version checked) and write
     `CustomerOrderCancelled` to the outbox.
  5. Answer `200` with the order. The group is not `CANCELLED` yet:
     `order-sourcing` answers with `FulfillmentCancelled` (`ConfirmGroupCancelled`,
     the group becomes `CANCELLED`, and the order `CANCELLED` once no group
     remains outside `CANCELLED`) or `FulfillmentCancelRefused`
     (`RefuseGroupCancellation`, back to `LOCKED`).
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| order not found (`ErrNotFound`) | 404 | `not-found` | Repository miss; one of the four shared problem types. |
| `ErrCancelAfterLock` | 409 | `cancel-after-lock` | No group is unlocked; cancellation is now a return. |
| `ErrStatusRegression` | 409 | `status-regression` | The order is `DELIVERED`, `LOST` or `RETURNED`. |
| version conflict (`ErrConcurrentUpdate`) | 409 | `concurrent-update` | The use case runs twice (two attempts) before the conflict is returned. |

- **Events emitted:** `CustomerOrderCancelled` (`groupNos` = exactly the groups
  moved to `CANCELLATION_REQUESTED`).
- **Idempotency:** `Idempotency-Key`, and a repeat request is a no-op.
- **Race:** a lock that `order-sourcing` has made but this context has not
  consumed yet is invisible here. The request is accepted, and `order-sourcing`
  answers `FulfillmentCancelRefused` (`CANCEL_AFTER_LOCK`); the group returns to
  `LOCKED` (command `RefuseGroupCancellation`) and the vendor ships. A cancel
  is only a request: `FulfillmentCancelled` (`ConfirmGroupCancelled`) is what
  makes a group `CANCELLED`, and this context's `ErrCancelAfterLock` is
  advisory. A shipment also wins over a pending request: `FulfillmentShipped`
  moves a `CANCELLATION_REQUESTED` group to `SHIPPED`.

## CancelUnkeepableGroup (policy CancelOnUnfulfillable)

- **Actor / trigger:** the `CancelOnUnfulfillable` policy, after
  `delivery-promise` publishes `PromiseUnkeepable` for a group (ADR 0002 A5,
  gap G10). It is **not** triggered by `FulfillmentUnsourceable`: that event
  only records its reason on the tracking view and cancels nothing.
- **Inbound adapter:** Kafka consumer on `retailnetwork.delivery-promise.events`,
  type `com.retailnetwork.commerce.delivery-promise.promise.PromiseUnkeepable`
  (`promiseId`, `orderId`, `groupNo`, `reason`).
- **Preconditions:** the group is `PROMISED` (no node locked).
- **Main flow:**
  1. Inbox check on the CloudEvents `id`.
  2. Load the order by `orderId`, with its `version`.
  3. `CancelUnkeepableGroup(groupNo, reason, now)`: the `PROMISED` group goes
     straight to `CANCELLED` (no request step, `order-sourcing` moves its
     `UNSOURCEABLE` assignment to `CANCELLED` on the event). When no group
     remains outside `CANCELLED` the order becomes `CANCELLED`.
  4. Save, outbox `CustomerOrderCancelled` with the one `groupNo` and reason
     `PROMISE_UNKEEPABLE: <reason>`, inbox row, one transaction.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrIllegalTransition` | — (consumer) | — | The group is not `PROMISED` (locked, shipped, requested or already cancelled). Recorded and skipped. |
| `ErrNotFound` / unknown group | — (consumer) | — | Recorded and skipped. |

- **Events emitted:** `CustomerOrderCancelled` with the one `groupNo`.
- **Idempotency:** inbox on the CloudEvents `id`.

## RegisterShopper

- **Actor / trigger:** the storefront or a test (no `inbound` row names the
  caller).
- **Inbound adapter:** REST `POST /shoppers`, header `Idempotency-Key`
  required; body `email`, `savedAddresses[]` (`ShipTo`).
- **Preconditions:** no shopper with this `email`.
- **Main flow:**
  1. Look up the `Idempotency-Key`; replay on a hit.
  2. `Shopper.RegisterShopper(email, savedAddresses)`: status `ACTIVE`.
  3. Insert; the unique index on `email` is the last guard
     (`ErrShopperExists`).
  4. Answer `201` with `shopperId`.
- **Errors:**

| Error | HTTP | Problem `type` slug |
| --- | --- | --- |
| `ErrShopperExists` | 409 | `shopper-exists` |

- **Events emitted:** none.
- **Idempotency:** `Idempotency-Key`; a different key with the same `email` is
  `ErrShopperExists`.

## MarkInFulfillment

- **Actor / trigger:** `order-sourcing` locked a group (the vendor node
  accepted the purchase order).
- **Inbound adapter:** Kafka consumer, type
  `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentLocked`.
- **Preconditions:** the order exists (otherwise retry, then dead-letter).
- **Main flow:**
  1. Inbox check on the CloudEvents `id`; a duplicate is acknowledged.
  2. Load the order by `orderId`, with its `version`.
  3. `MarkInFulfillment(groupNo, assignmentId, lockedAt)`: `PROMISED` →
     `LOCKED` for that group; the order status is then re-derived
     (`PLACED → IN_FULFILLMENT` for the first lock, no status change for later
     ones). A lock for a `CANCELLATION_REQUESTED` group is recorded but leaves
     the state: `order-sourcing`'s answer decides.
  4. Save (version checked) and insert the inbox row in one transaction.
     Update `OrderTrackingView`.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrStatusRegression` | — (consumer) | — | The group is already `SHIPPED`, `DELIVERED`, `LOST` or `RETURNED`. Recorded, logged, acknowledged. |
| `ErrIllegalTransition` | — (consumer) | — | The group is `CANCELLED`. Recorded, logged, acknowledged. |

- **Events emitted:** none.
- **Idempotency:** inbox; locking an already locked group is a no-op.

## MarkGroupShipped

- **Actor / trigger:** `order-sourcing` reports the group shipped.
- **Inbound adapter:** Kafka consumer, type
  `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentShipped`.
- **Preconditions:** the group exists. It need not be locked: a shipment on
  a `PLACED` order is accepted (the lock event may arrive late).
- **Main flow:**
  1. Inbox check.
  2. Load the order.
  3. `MarkGroupShipped(groupNo, trackingNumbers, shippedAt)`: a `PROMISED`,
     `LOCKED` or `CANCELLATION_REQUESTED` group becomes `SHIPPED` (a vendor
     that ships wins over a pending cancel request); the order status is
     re-derived: `PARTIALLY_SHIPPED` while other groups are open, `SHIPPED`
     once every counted group has shipped (`PLACED → SHIPPED` is possible when
     the lock was never seen). Deliveries that arrived early are replayed.
  4. Save and inbox row in one transaction. Update `OrderTrackingView`.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrStatusRegression` | — (consumer) | — | The group is `DELIVERED`, `LOST` or `RETURNED`. Recorded and skipped, never retried. |
| `ErrIllegalTransition` | — (consumer) | — | The group is `CANCELLED`. Recorded and skipped. |

- **Events emitted:** none.
- **Idempotency:** inbox; the same `groupNo` shipped twice is a no-op.

## MarkGroupDelivered

- **Actor / trigger:** `shipping-and-tracking` reports a package delivered.
- **Inbound adapter:** Kafka consumer, type
  `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageDelivered`.
- **Preconditions:** the group of the package's `assignmentId` has shipped.
- **Main flow:**
  1. Inbox check.
  2. Load the order by `orderId`. Find the group by `assignmentId`.
  3. Record `deliveredAt` for the `trackingNumber`. When every tracking
     number of the group is delivered the group is `DELIVERED` (a delivery
     that arrives before the shipment is remembered and replayed). The order
     status is re-derived: `PARTIALLY_DELIVERED` while another group is open
     or lost or returned, `DELIVERED` when every counted group is delivered.
  4. Save and inbox row in one transaction. Update `OrderTrackingView`.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrIllegalTransition` | — (consumer) | — | The group is `CANCELLED`, `LOST` or `RETURNED` (terminal). Recorded and skipped. |

- **Events emitted:** none. The verdict `PromiseKept` or `PromiseBroken` comes
  from `delivery-promise`.
- **Idempotency:** inbox; a tracking number already delivered is a no-op.

## MarkGroupLost and MarkGroupReturned

- **Actor / trigger:** `shipping-and-tracking` declares a package lost or
  returned (ADR 0002 A19).
- **Inbound adapter:** Kafka consumer, types
  `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageLost` and
  `PackageReturned`.
- **Main flow:** the group is the one whose `FulfillmentShipped` announced the
  tracking number (for EVERY group that shares it). `SHIPPED → LOST` or
  `SHIPPED → RETURNED`, terminal; one lost or returned package closes the whole
  group. The order status is re-derived: with no group still open it is
  `DELIVERED`, `PARTIALLY_DELIVERED` (some delivered), `LOST` (none delivered,
  some lost) or `RETURNED`.
- **Errors:** a group that has not shipped, is `DELIVERED`, `CANCELLED` or already
  closed by the other outcome is `ErrIllegalTransition`; a package already
  reported delivered cannot be lost. All are recorded and skipped.
- **Events emitted:** none.

## ConfirmGroupCancelled and RefuseGroupCancellation

- **Actor / trigger:** `order-sourcing` answers the cancel request.
- **Inbound adapter:** Kafka consumer, types
  `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentCancelled`
  and `FulfillmentCancelRefused`.
- **Main flow:** `FulfillmentCancelled` makes a `PROMISED`, `CANCELLATION_REQUESTED`
  or `LOCKED` group `CANCELLED` (the order is `CANCELLED` when no group remains
  outside `CANCELLED`); a group that already shipped is a status regression.
  `FulfillmentCancelRefused` returns a `CANCELLATION_REQUESTED` group to `LOCKED`
  with the refusal reason (the vendor ships).
- **Errors:** recorded and skipped by the consumer.
- **Events emitted:** none.

## UpdateGroupPromise

- **Actor / trigger:** `delivery-promise` revised a group's promise
  (`RepromiseOnRisk`).
- **Inbound adapter:** Kafka consumer, type
  `com.retailnetwork.commerce.delivery-promise.promise.PromiseRevised`.
- **Preconditions:** the order has a group with this `promiseId`.
- **Main flow:**
  1. Inbox check.
  2. Load the order by `orderId`; find the group by `promiseId`.
  3. If `revisionNo` is not above the last applied revision, stop.
  4. `UpdateGroupPromise(groupNo, deliverByEarliest, deliverByLatest,
     shipBy, revisionNo)`; no status change.
  5. Save and inbox row in one transaction. Update `OrderTrackingView`.
- **Errors:** the model names none for this command. An unknown `promiseId`
  is logged and acknowledged.
- **Events emitted:** none. Telling the shopper is future
  `customer-notification`.
- **Idempotency:** inbox, plus the `revisionNo` check (Kafka keys
  `PromiseRevised` by `promiseId`, so revisions of one promise arrive in order).
