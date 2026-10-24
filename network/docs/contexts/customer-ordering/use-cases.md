---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: Every proposed Customer Ordering command use case with its actor or trigger, inbound adapter, preconditions, main flow, error mapping, events and idempotency.
---

# Use Cases

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
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
| `CancelOrder` | Shopper | REST `POST /orders/{orderId}:cancel` | `CustomerOrderCancelled` |
| `CancelOrder` (policy) | `CancelOnUnfulfillable` | Kafka consumer, `FulfillmentUnsourceable` | `CustomerOrderCancelled` |
| `RegisterShopper` | Storefront (assumed; no `inbound` row) | REST `POST /shoppers` | none |
| `MarkInFulfillment` | `order-sourcing` | Kafka consumer, `FulfillmentLocked` | none |
| `MarkGroupShipped` | `order-sourcing` | Kafka consumer, `FulfillmentShipped` | none |
| `MarkGroupDelivered` | `shipping-and-tracking` | Kafka consumer, `PackageDelivered` | none |
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
- **Preconditions:** none on stored state. The model names no error for an
  unknown `shopperId`, so checkout does not check it (model gap).
- **Main flow:**
  1. Look up the `Idempotency-Key`. On a hit with the same request body,
     return the stored response.
  2. Check that every line is in exactly one group
     (`ErrLineWithoutPromise`), before any call.
  3. For each group, call `delivery-promise` `MakePromise`
     (`POST /promises`, with the `offerId`). Send an `Idempotency-Key` derived
     from the `offerId`, so a retried checkout gets back the same provisional
     promise. The reply gives `promiseId`, `tier`, `nodeId` (the witness
     node), `shipBy`, `deliverByEarliest`, `deliverByLatest`, `holdExpiresAt`.
  4. If a group's offer is expired or consumed (`ErrOfferNotQuotable`), apply
     `CheckoutPromising`. Call `QuoteDeliveryOffers`
     (`POST /delivery-offers:quote`) for that group's lines and the ship-to's
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
- **Inbound adapter:** REST `POST /orders/{orderId}:cancel`, header
  `Idempotency-Key` required; body `reason`.
- **Preconditions:** the order exists; no group is locked.
- **Main flow:**
  1. Look up the `Idempotency-Key`; replay the stored response on a hit.
  2. Load `CustomerOrder` with its `version` (404 if absent).
  3. If it is already `CANCELLED`, answer `200` with it unchanged and publish
     nothing.
  4. `CustomerOrder.CancelOrder(groupNos = every group, reason)`: it checks
     `ErrCancelAfterLock` and `ErrStatusRegression`. Status `CANCELLED`.
  5. In one transaction, save (version checked) and write
     `CustomerOrderCancelled` to the outbox.
  6. Answer `200` with the order.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| order not found | 404 | `order-not-found` | Repository miss; the model names no `Err` for it. |
| `ErrCancelAfterLock` | 409 | `cancel-after-lock` | A group is locked; cancellation is now a return. |
| `ErrStatusRegression` | 409 | `status-regression` | The order is past the point a cancel can reach. |
| version conflict | 409 | `stale-order` | Retried once inside the use case before it is returned. |

- **Events emitted:** `CustomerOrderCancelled` (`groupNos` = every group).
- **Idempotency:** `Idempotency-Key`, and a cancel of a `CANCELLED` order is
  a no-op.
- **Race:** a lock that `order-sourcing` has made but this context has not
  consumed yet is invisible here. The request is accepted, and `order-sourcing`
  answers `FulfillmentCancelRefused` (`CANCEL_AFTER_LOCK`); the group returns to
  `LOCKED` (command `RefuseGroupCancellation`) and the vendor ships. A cancel
  is only a request: `FulfillmentCancelled` (`ConfirmGroupCancelled`) is what
  makes a group `CANCELLED`, and this context's `ErrCancelAfterLock` is
  advisory.

## CancelOrder (policy CancelOnUnfulfillable)

- **Actor / trigger:** the `CancelOnUnfulfillable` policy, after
  `FulfillmentUnsourceable` for a group.
- **Inbound adapter:** Kafka consumer on `retailnetwork.order-sourcing.events`,
  type `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentUnsourceable`.
- **Preconditions:** the group is unsourceable and no revised promise is
  feasible. The model has **no event** that says the second part (hotspot
  H6). A `PromiseRevised` for the group's `promiseId` means it was re-promised,
  and the policy stands down.
- **Main flow:**
  1. Inbox check on the CloudEvents `id`.
  2. Note the group as waiting for a re-promise (`OrderTrackingView`).
  3. When the not-feasible condition holds: `CancelOrder(groupNos = [that
     group], reason)`. If no other group remains, the status becomes
     `CANCELLED`.
  4. Save, outbox `CustomerOrderCancelled`, inbox row, one transaction.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrCancelAfterLock` | — (consumer) | — | Another group of the order is locked. The model does not say whether the unsourceable group may still be cancelled alone (hotspot H7). Recorded and skipped. |
| `ErrStatusRegression` | — (consumer) | — | The order is already `CANCELLED`; recorded and skipped. |

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
  3. `MarkInFulfillment(groupNo, assignmentId, lockedAt)`: records the group
     as locked; `PLACED → IN_FULFILLMENT` for the first lock, no status change
     for later ones.
  4. Save (version checked) and insert the inbox row in one transaction.
     Update `OrderTrackingView`.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrStatusRegression` | — (consumer) | — | For example the order is `CANCELLED` (see the race above). Recorded, logged as an anomaly, acknowledged. |

- **Events emitted:** none.
- **Idempotency:** inbox; locking an already locked group is a no-op.

## MarkGroupShipped

- **Actor / trigger:** `order-sourcing` reports the group shipped.
- **Inbound adapter:** Kafka consumer, type
  `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentShipped`.
- **Preconditions:** the group is locked.
- **Main flow:**
  1. Inbox check.
  2. Load the order.
  3. `MarkGroupShipped(groupNo, trackingNumbers, shippedAt)`:
     `IN_FULFILLMENT → SHIPPED` if every remaining group has shipped, else
     `→ PARTIALLY_SHIPPED`; `PARTIALLY_SHIPPED → SHIPPED` for the last group.
  4. Save and inbox row in one transaction. Update `OrderTrackingView`.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrStatusRegression` | — (consumer) | — | The order is `PLACED` (lock not seen) or `CANCELLED`. A `PLACED` order is retried, because the lock may be late; a `CANCELLED` one is recorded and skipped. |

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
     number of the group is delivered, `MarkGroupDelivered(groupNo,
     deliveredAt)`. `SHIPPED → DELIVERED` when every group is delivered.
  4. Save and inbox row in one transaction. Update `OrderTrackingView`.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrStatusRegression` | — (consumer) | — | The order is not `SHIPPED`. On `PARTIALLY_SHIPPED` the model has no transition (hotspot H4): the delivery is recorded on the group, the status stays. |

- **Events emitted:** none. The verdict `PromiseKept` or `PromiseBroken` comes
  from `delivery-promise`.
- **Idempotency:** inbox; a tracking number already delivered is a no-op.

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
