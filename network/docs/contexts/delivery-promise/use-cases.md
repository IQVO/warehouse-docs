---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: Every command use case of Delivery Promise - trigger, adapter, preconditions, main flow, errors mapped to HTTP problem types, events and idempotency.
---

# Use Cases

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

The proposed application services of `internal/application/usecases`, one per
command of the model. Step-by-step interactions are on
[the sequence diagrams page](/network/contexts/delivery-promise/sequence-diagrams);
payloads are on [the domain events page](/network/contexts/delivery-promise/domain-events).

Reads are not use cases: `GET /delivery-offers/{offerId}`,
`GET /promises/{promiseId}`, `GET /promises?orderId=` and
`GET /promise-books?nodeId=&date=` read the repositories directly. Read-model
projection (board 1 of [the EventStorming page](/network/contexts/delivery-promise/eventstorming))
is not a use case either: it changes no aggregate.

## Triggers at a glance

| Use case | Command(s) | Trigger | Inbound adapter |
| --- | --- | --- | --- |
| `QuoteDeliveryOffers` | `QuoteDeliveryOffers` | shopper / storefront, `customer-ordering` | REST `POST /delivery-offers:quote` |
| `MakePromise` | `MakePromise`, `HoldCapacity` | `customer-ordering` checkout | REST `POST /promises` |
| `ConfirmPromise` | `ConfirmPromise`, `ConfirmCapacity` | `CustomerOrderPlaced` | Kafka consumer `promise-lifecycle` |
| `CancelPromise` | `CancelPromise`, `ReleaseCapacity` | `CustomerOrderCancelled` | Kafka consumer `promise-lifecycle` |
| `FlagPromiseAtRisk` | `FlagPromiseAtRisk` | `RepromiseOnRisk`: `FulfillmentUnsourceable`, `PackageExceptionRaised`, `DepartureCancelled` | Kafka consumer `promise-lifecycle` |
| `RevisePromise` | `RevisePromise` (+ book commands) | `RepromiseOnRisk`, right after `FlagPromiseAtRisk` | same consumer, second transaction |
| `JudgePromise` | `JudgePromise` | `JudgeOnDelivery`: `PackageDelivered` | Kafka consumer `promise-lifecycle` |
| `ReleaseExpiredHolds` | `ReleaseExpiredHolds`, `ReleaseCapacity` | clock | scheduler (proposed every minute) |
| `ExpireOffers` | `ExpireOffers` | clock | scheduler (proposed every minute) |
| `CloseBook` | `CloseBook` | clock, at the pickup `cutoffAt` | scheduler (policy `CloseBooksAtCutoff`) |

## How a change commits

Every use case that changes an aggregate saves it and writes its events to
`outbox_events` **in one Postgres transaction**. A Kafka-driven use case also
inserts the CloudEvents `id` into `processed_events` in that same transaction,
so a redelivered message commits nothing. `Promise` and `PromiseBook` carry a
`version`; the repository updates `WHERE version = :read` and a lost race
surfaces as a stale-write conflict, which the use case retries (up to three
times, proposed) before reporting `409 stale-write`.

`MakePromise` is the one use case that changes three aggregates (consumes the
offer, creates the promise, holds capacity) in one local transaction. This is a
deliberate, proposed exception: a promise without a hold would break the
business decision "a promise reserves capacity", and all three rows live in
this context's own database (open question 13 on
[the canvas page](/network/contexts/delivery-promise/bounded-context-canvas)).

## Error mapping

| `Err...` | HTTP | Problem `type` slug | Kind |
| --- | --- | --- | --- |
| `ErrOfferNotQuotable` | 409 | `offer-not-quotable` | state |
| `ErrOfferExpiryTooLate` | — (never returned) | `offer-expiry-too-late` | internal guard: an offer that would break it is not quoted |
| `ErrInvalidPromiseTerms` | 422 | `invalid-promise-terms` | validation |
| `ErrNominalBasisNotAllowedForTier` | 422 | `nominal-basis-not-allowed-for-tier` | validation |
| `ErrPromiseHoldExpired` | 409 | `promise-hold-expired` | state |
| `ErrRevisionMovesEarlier` | 409 | `revision-moves-earlier` | state |
| `ErrPromiseClosed` | 409 | `promise-closed` | state |
| `ErrGroupSpansNodes` | 422 | `group-spans-nodes` | validation |
| `ErrPromiseCapacityExhausted` | 409 | `promise-capacity-exhausted` | capacity |
| `ErrBookClosed` | 409 | `book-closed` | closed |
| `ErrCapacityUnderflow` | — (never returned) | `capacity-underflow` | internal guard |
| (no `Err` in the model) offer, promise not found | 404 | `offer-not-found`, `promise-not-found` | not found |
| (no `Err` in the model) malformed request | 422 | `invalid-request` | validation |
| (infrastructure) optimistic version lost three times | 409 | `stale-write` | stale |
| (infrastructure) same `Idempotency-Key`, different body | 422 | `idempotency-key-reused` | validation |

Problem types are `https://retailnetwork.example/problems/<slug>` in an RFC 9457
body (`type`, `title`, `status`, `detail`). On a Kafka-driven use case there is
no HTTP reply: the error column says what the consumer does instead.

## QuoteDeliveryOffers

- **Actor / trigger**: a shopper on a product page or cart (storefront), or
  `customer-ordering` at checkout.
- **Inbound adapter**: REST `POST /delivery-offers:quote`
  (`internal/adapters/inbound/http`).
- **Input**: `destinationPostalPrefix`, `lines[]` (`catalogItemId`, `quantity`),
  optional `tiers[]` (default: all four).
- **Preconditions**: none on aggregates. Reads only local read models and
  `PromiseBook` rows. Makes **no synchronous call**.
- **Main flow** (`PromisePolicy`; worked example in
  [the promise model](/network/network-model/promise-model), the AUS3 / DFW7 cart on
  Thursday at 14:05):
  1. Resolve the destination postal prefix to its delivery station and region
     (`RegionAndServiceAreaView`). None: every tier gets
     `DESTINATION_NOT_SERVED`.
  2. Group the lines (`ShipmentGrouping`): find `ACTIVE` nodes with the
     `OUTBOUND` capability whose listings are live and hold the quantity of
     each line (`NodeProfileView`, `AvailabilityView`; discontinued items are
     excluded). Prefer one node for the whole cart; otherwise split into the
     fewest groups. A line no node can cover: `ITEM_QUANTITY_NOT_AVAILABLE`.
  3. Apply `TierOrderDeadline`: a tier whose policy-versioned local order
     deadline in the destination region has passed is not searched.
  4. For each candidate node compute
     `readyAt = now + handling time` (counted inside operating hours, skipping
     holidays, in the node's time zone) `+ handicap` (`ScorecardHandicap`:
     grade A +0, B + handling × 0.25, C next cutoff, D two cutoffs later, no
     scorecard yet +0).
  5. Take the first pickup departure (`DepartureView`, kind `PICKUP`) at the
     node with `cutoffAt >= readyAt` and remaining capacity, whose `PromiseBook`
     (`nodeId:pickupDepartureId`) is `OPEN` and has
     `provisional + confirmed < share`.
  6. Search the earliest-arrival path from the pickup to the delivery station
     over scheduled departures with remaining capacity (a time-expanded graph;
     at each intermediate node add its sort dwell before the next departure's
     cutoff). `SAME_DAY` admits only a `SUB_SAME_DAY` or `MICRO` fulfillment
     centre injecting directly into the destination's delivery station.
  7. Take the first delivery wave at the station with
     `inductCutoffAt >= arrival` and stop capacity left (`DeliveryWaveView`).
     The offer window is the wave's `windowStart`..`windowEnd`.
  8. Keep the path for a tier only if the window ends within the tier's
     calendar days (`SAME_DAY` 0, `NEXT_DAY` 1, `TWO_DAY` 2, `STANDARD` 7). For
     `STANDARD` only, if no scheduled path exists, fall back to nominal lane
     transit (`LaneView`); the offer's basis is then `NOMINAL`.
  9. Pick the best path per tier: earliest `windowEnd`; ties go in-region,
     then fewer legs, then the better grade.
  10. Create one `DeliveryOffer` (`QUOTED`) per tier with an offer, with
      `expiresAt = min(quotedAt + offerTtl, the latest instant the witness
      pickup cutoff can still be met)`. Save the offers and write one
      `DeliveryOfferQuoted` row for the analytics topic, in one transaction.
  11. Return the offers, and for each requested tier without an offer, the
      `OfferConstraint` that blocked it: `DELIVERY_SLA_UNAVAILABLE` when no path
      fits the tier, `NODE_CAPACITY_EXHAUSTED` when paths exist but every
      candidate book or departure is full.
- **Errors**:

  | Error | HTTP | Problem `type` |
  | --- | --- | --- |
  | malformed body (no prefix, quantity below 1, unknown tier) | 422 | `invalid-request` |
  | `ErrOfferExpiryTooLate` | not returned | the offer is not created; the tier is reported unavailable |

  "No offer" is a normal `200` answer with constraints, not an error.
- **Events**: none on the integration topic; `DeliveryOfferQuoted` on the
  analytics topic.
- **Idempotency**: a quote is safe to repeat. With an `Idempotency-Key`, a
  repeat within the offers' TTL returns the same, still-`QUOTED` offers instead
  of creating new ones.

## MakePromise

- **Actor / trigger**: `customer-ordering` at checkout (`CheckoutPromising`),
  once per shipment group, with the offer the shopper saw.
- **Inbound adapter**: REST `POST /promises` (in-org).
- **Input**: `offerId`, `lines[]` (`catalogItemId`, `quantity`) of the group;
  header `Idempotency-Key`.
- **Preconditions**: the offer exists and is `QUOTED` and not past
  `expiresAt`; the lines are shippable from the offer's witness node; the
  witness book is `OPEN` and has room.
- **Main flow**:
  1. Load the offer; reject if missing (404) or not quotable
     (`ErrOfferNotQuotable`).
  2. Re-validate the offer's witness path against the current read models
     (the departures and the wave still have room), and check the group against
     `AvailabilityView` for the witness node (`ErrGroupSpansNodes` if any line
     is not shippable from it). A path that is no longer feasible is refused
     like a full book, so checkout re-quotes.
  3. Build `PromiseTerms` from the offer: tier, `shipBy` = the witness pickup
     cutoff, `deliverByEarliest`/`deliverByLatest` = the offer window, basis
     and `policyVersion` of the quote (`ErrInvalidPromiseTerms`,
     `ErrNominalBasisNotAllowedForTier`).
  4. Create the `Promise` in `PROVISIONAL` with `holdExpiresAt`.
  5. `HoldCapacity` on the book `nodeId:pickupDepartureId`
     (`ErrPromiseCapacityExhausted`, `ErrBookClosed`). If this hold makes
     `provisional + confirmed = share`, raise `PromiseBookExhausted`.
  6. Mark the offer `CONSUMED`.
  7. Commit offer, promise, book and outbox rows in one transaction; reply
     `201` with the promise.
- **Errors**:

  | Error | HTTP | Problem `type` |
  | --- | --- | --- |
  | offer not found | 404 | `offer-not-found` |
  | `ErrOfferNotQuotable` | 409 | `offer-not-quotable` |
  | `ErrGroupSpansNodes` | 422 | `group-spans-nodes` |
  | `ErrInvalidPromiseTerms` | 422 | `invalid-promise-terms` |
  | `ErrNominalBasisNotAllowedForTier` | 422 | `nominal-basis-not-allowed-for-tier` |
  | `ErrPromiseCapacityExhausted` | 409 | `promise-capacity-exhausted` |
  | `ErrBookClosed` | 409 | `book-closed` |
  | book version lost three times | 409 | `stale-write` |
  | same key, different body | 422 | `idempotency-key-reused` |

- **Events**: `PromiseMade`; `PromiseBookExhausted` when the book fills.
- **Idempotency**: the `Idempotency-Key` is stored on the promise (unique), and
  an offer backs at most one promise (`offer_id` unique). A retry with the same
  key and body returns the existing promise with `200`.

## ConfirmPromise

- **Actor / trigger**: `customer-ordering` placed the order.
- **Inbound adapter**: Kafka consumer of
  `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderPlaced`.
- **Input**: `orderId`, and for each group `groupNo`, `promiseId`.
- **Preconditions**: each promise is `PROVISIONAL` and `now < holdExpiresAt`.
- **Main flow** (all groups in one transaction with the inbox row):
  1. For each group, load the promise; `ConfirmPromise(orderId, groupNo)`
     (`PROVISIONAL` → `CONFIRMED`).
  2. `ConfirmCapacity` on its book (`provisional - 1`, `confirmed + 1`).
  3. Save both, write `PromiseConfirmed`, record the CloudEvents `id`.
- **Errors**:

  | Error | Consumer outcome | Problem `type` (for logs) |
  | --- | --- | --- |
  | `ErrPromiseHoldExpired` | logged and alerted; the order exists without a held promise (hotspot H6) | `promise-hold-expired` |
  | `ErrPromiseClosed` (already `RELEASED`) | as above | `promise-closed` |
  | `ErrCapacityUnderflow` | bug alarm; transaction rolled back, message retried | `capacity-underflow` |
  | stale version | retried | `stale-write` |

- **Events**: `PromiseConfirmed` per group.
- **Idempotency**: inbox on the CloudEvents `id`; a promise already `CONFIRMED`
  for the same `orderId` and `groupNo` is a no-op.

## CancelPromise

- **Actor / trigger**: the customer cancelled, or `customer-ordering` cancelled
  an unfulfillable group (`CancelOnUnfulfillable`).
- **Inbound adapter**: Kafka consumer of
  `com.retailnetwork.commerce.customer-ordering.customerorder.CustomerOrderCancelled`.
  The model names no policy joining this event to `CancelPromise`; this is the
  pack's reading.
- **Input**: `orderId`, `groupNos`, `reason`.
- **Preconditions**: each promise is `CONFIRMED` or `AT_RISK`.
- **Main flow** (per group):
  1. Find the promise by `orderId` and `groupNo`; `CancelPromise(reason)`.
  2. `ReleaseCapacity` (confirmed) on its book.
  3. Save, write `PromiseCancelled`, record the `id`.
- **Errors**:

  | Error | Consumer outcome | Problem `type` (for logs) |
  | --- | --- | --- |
  | `ErrPromiseClosed` | no-op if `CANCELLED`; logged if `KEPT`/`BROKEN` | `promise-closed` |
  | `ErrCapacityUnderflow` | bug alarm, retried | `capacity-underflow` |

- **Events**: `PromiseCancelled`.
- **Idempotency**: inbox; a `CANCELLED` promise is a no-op.

## FlagPromiseAtRisk

- **Actor / trigger**: `RepromiseOnRisk`, on `FulfillmentUnsourceable`
  (by `promiseId`), `PackageExceptionRaised` (by the group's assignment, see
  open question 4 on [the canvas page](/network/contexts/delivery-promise/bounded-context-canvas)),
  or `DepartureCancelled` (every `CONFIRMED` promise whose witness path uses
  the departure).
- **Inbound adapter**: Kafka consumer `promise-lifecycle`.
- **Preconditions**: the promise is `CONFIRMED`.
- **Main flow**:
  1. `FlagPromiseAtRisk(reason, detectedAt)` (`CONFIRMED` → `AT_RISK`).
  2. Save, write `PromiseAtRisk`, record the `id`.
  3. Hand the promise to `RevisePromise`.
- **Errors**:

  | Error | Consumer outcome | Problem `type` (for logs) |
  | --- | --- | --- |
  | `ErrPromiseClosed` | ignored (already judged, released or cancelled) | `promise-closed` |
  | already `AT_RISK` | no second `PromiseAtRisk`; goes straight to `RevisePromise` | — |

- **Events**: `PromiseAtRisk`.
- **Idempotency**: inbox; an `AT_RISK` promise is not flagged twice.

## RevisePromise

- **Actor / trigger**: `RepromiseOnRisk`, after `FlagPromiseAtRisk`.
- **Inbound adapter**: same consumer, separate transaction.
- **Preconditions**: the promise is `AT_RISK` (or `CONFIRMED`, which the model
  allows).
- **Main flow**:
  1. Re-run the search of `QuoteDeliveryOffers` for the promise's group,
     destination and tier, from `now`. For `FulfillmentUnsourceable`, exclude
     the event's `excludedNodes` (this pack's reading). If the tier has no
     path, try the slower tiers down to `STANDARD`.
  2. Nothing feasible even at `STANDARD`: stop. The promise stays `AT_RISK`
     and is reported `PromiseBroken` at judgement time.
  3. Otherwise `RevisePromise(newTerms, newWitness, reason)`: append a
     `Revision{revisionNo, previousTerms, reason, revisedAt}`; reject with
     `ErrRevisionMovesEarlier` if the new `deliverByLatest` is earlier.
  4. Book capacity (this pack's reading; open question 11): `HoldCapacity` and
     `ConfirmCapacity` on the new book, `ReleaseCapacity` (confirmed) on the
     old one, if the book changed.
  5. Save, write `PromiseRevised`.
- **Errors**:

  | Error | Consumer outcome | Problem `type` (for logs) |
  | --- | --- | --- |
  | `ErrRevisionMovesEarlier` | the candidate is discarded (a later one is never earlier) | `revision-moves-earlier` |
  | `ErrPromiseCapacityExhausted`, `ErrBookClosed` on the new book | next candidate path | `promise-capacity-exhausted`, `book-closed` |
  | `ErrPromiseClosed` | ignored | `promise-closed` |
  | `ErrNominalBasisNotAllowedForTier` | candidate discarded | `nominal-basis-not-allowed-for-tier` |

- **Events**: `PromiseRevised`.
- **Idempotency**: the trigger's `id` is recorded with the revision; a
  redelivery finds it in the inbox and does nothing.

## JudgePromise

- **Actor / trigger**: `JudgeOnDelivery`, on `PackageDelivered`.
- **Inbound adapter**: Kafka consumer of
  `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageDelivered`.
- **Input**: `assignmentId`, `orderId`, `deliveredAt`.
- **Preconditions**: the group's promise is `CONFIRMED` or `AT_RISK`. Finding
  it needs `assignmentId` → (`orderId`, `groupNo`), which only
  `FulfillmentLocked` carries (open questions 3 and 4).
- **Main flow**:
  1. `JudgePromise(deliveredAt)`: `KEPT` if `deliveredAt <= deliverByLatest`,
     else `BROKEN` with `lateByMinutes` and a `cause`.
  2. Save, write `PromiseKept` or `PromiseBroken`, record the `id`.
- **Errors**:

  | Error | Consumer outcome | Problem `type` (for logs) |
  | --- | --- | --- |
  | `ErrPromiseClosed` | no-op (a second package of the same group, or a redelivery) | `promise-closed` |
  | promise not found yet (lock not seen) | retried with back-off | `promise-not-found` |

- **Events**: `PromiseKept` or `PromiseBroken`.
- **Idempotency**: inbox; a judged promise is terminal.

## ReleaseExpiredHolds

- **Actor / trigger**: the clock.
- **Inbound adapter**: scheduler.
- **Preconditions**: `PROVISIONAL` promises with `holdExpiresAt <= now`.
- **Main flow** (per promise, one transaction each):
  1. `ReleaseExpiredHolds` (`PROVISIONAL` → `RELEASED`).
  2. `ReleaseCapacity` (provisional) on its book.
  3. Save, write `PromiseReleased`.
- **Errors**: `ErrPromiseClosed` (confirmed in the meantime): skipped.
  `ErrCapacityUnderflow`: bug alarm. Stale version: next pass.
- **Events**: `PromiseReleased`.
- **Idempotency**: the state check; a `RELEASED` promise is not selected again.

## ExpireOffers

- **Actor / trigger**: the clock.
- **Inbound adapter**: scheduler.
- **Main flow**: move `QUOTED` offers past `expiresAt` to `EXPIRED` in batches;
  drop day partitions older than the retention.
- **Errors**: none returned; a concurrently `CONSUMED` offer is skipped.
- **Events**: none.
- **Idempotency**: the state check.

## CloseBook

- **Actor / trigger**: the clock, at the witness pickup's `cutoffAt` (policy
  `CloseBooksAtCutoff`). Holds are refused earlier, from the `holdDeadline`,
  the cutoff minus the node's handling time (the instant `ErrBookClosed`
  protects).
- **Inbound adapter**: scheduler.
- **Main flow**: `CloseBook` (`OPEN` → `CLOSED`); save.
- **Errors**: already `CLOSED`: no-op.
- **Events**: none (the model gives `PromiseBook` only `PromiseBookExhausted`).
- **Idempotency**: the state check.
