---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: Every proposed Customer Payments command use case with its actor or trigger, inbound adapter, preconditions, main flow, error mapping, events and idempotency.
---

# Use Cases

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

One section per command of
`contexts[customer-payments].aggregates[PaymentAuthorization].commands` and
`aggregates[Refund].commands`, plus the policies that issue them. They are
proposed application services in `internal/application/usecases`. The
step-by-step diagrams are on
[Sequence Diagrams](/storefront/contexts/customer-payments/sequence-diagrams);
the payloads are on [Domain Events](/storefront/contexts/customer-payments/domain-events);
the REST contract is `storefront/apis/customer-payments/openapi.yaml`.

Reads are not use cases here: `GET /payment-authorizations/{authorizationId}`
(`GetAuthorization`, also called by `checkout`),
`GET /payment-authorizations?orderId=|checkoutSessionId=`
(`ListAuthorizations`) and `GET /refunds?orderId=` (`ListRefunds`) read the
repository directly. `ListAuthorizations` takes exactly one of the two
filters (422 `validation-failed` otherwise).

## Triggers at a glance

| Use case | Trigger | Inbound adapter | Emits |
| --- | --- | --- | --- |
| `AuthorizePayment` | `checkout` | REST `POST /payment-authorizations` | `PaymentAuthorized` or `PaymentDeclined` |
| `VoidAuthorization` | `checkout` after a definitive rejection; policy `VoidUnboundAuthorizations` | REST `POST /payment-authorizations/{authorizationId}:void`; scheduler | none (hotspot H1) |
| `RequestRefund` | Storefront ops; policies `RefundOnLostPackage`, `RefundOnReturnToSender` | REST `POST /refunds`; Kafka consumer, `retailnetwork.shipping-and-tracking.events` | `RefundIssued` or `RefundFailed` after the outcome |
| `RecordRefundOutcome` | The provider's answer to `Refund` | the provider port (inside `RequestRefund`) | `RefundIssued` or `RefundFailed` |
| `CaptureAllocation` | `order-sourcing` `FulfillmentShipped`, policy `CaptureOnShipment` | Kafka consumer, `retailnetwork.order-sourcing.events` | `PaymentCaptured` |
| `ReleaseAllocation` | `order-sourcing` `FulfillmentCancelled`, policy `ReleaseOnCancellation` | Kafka consumer, `retailnetwork.order-sourcing.events` | `PaymentReleased` |
| `BindOrder` | `checkout` `CheckoutCompleted`, policy `BindOrderOnCheckoutCompleted` | Kafka consumer, `retailnetwork.checkout.events` | none |
| `ReauthorizePayment` | Clock, policy `ReauthorizeBeforeExpiry` (24 h before `expiresAt`) | scheduler | none (hotspot H1) |
| `ExpireAuthorization` | not named in the model (hotspot H2) | not named | `PaymentAuthorizationExpired` |

## How save and publish commit

Every use case that changes an aggregate loads it with its `version`, calls
the aggregate, then saves it inside one Postgres transaction. The save is
conditional on the version it loaded (`UPDATE ... WHERE version = ?`); a
conflict is retried once inside the use case, then surfaces as 409
`concurrent-update`. If an event is raised, the outbox row
(`outbox_events`) is written in the same transaction. A consumer-driven use
case also inserts the CloudEvents `id` into `processed_events` in that
transaction. A relay publishes outbox rows to
`retailnetwork.customer-payments.analytics` after the commit.

**The provider call sits outside the transaction.** A use case that calls
the provider (`AuthorizePayment`, `CaptureAllocation`, `VoidAuthorization`,
`RequestRefund`, `ReauthorizePayment`) calls the port first with the
deterministic key per (operation, `authorizationId`, `groupNo`), then saves
the outcome and the outbox row in one transaction. A crash between the two
repeats the call with the same key, which the provider answers with the
first result; that is the reason the key is deterministic.

Error responses use `application/problem+json` (RFC 9457) with `type`
`/problems/<slug>` per `conventions.integration_rules`: not-found 404,
illegal-transition 409, concurrent-update 409, validation-failed 422, plus
one kebab-case slug per `Err` in the model. Every write route takes an
`Idempotency-Key` header. Consumer-driven use cases (capture, release,
bind, refund policies) have no caller: an error is logged and the inbox row
is still written, which is a proposed disposition the model does not state.

## AuthorizePayment

- **Actor / trigger:** `checkout`, saga step before the place-order pivot.
- **Inbound adapter:** REST `POST /payment-authorizations`, header
  `Idempotency-Key` required (`<sessionId>:auth`).
- **Input:** `checkoutSessionId`, `paymentMethodToken` (the PSP token,
  never a card number), `currency`, `totalMinor`, `allocations` (`groupNo`,
  `amountMinor`).
- **Preconditions:** no authorization exists for the session; allocations
  sum to the total and name the session's groups.
- **Main flow:**
  1. `Idempotency-Key` lookup; replay the stored response on a hit.
  2. Check that the session has no authorization (`ErrDuplicateAuthorization`)
     and that the allocations sum to the total (`ErrAllocationMismatch`).
  3. Call the provider `Authorize` through the ACL port with the token, the
     total and the deterministic key.
  4. Approved: create the `PaymentAuthorization` `AUTHORIZED` with the
     provider reference and `expiresAt`. Declined: create it `DECLINED`,
     a terminal record.
  5. In one transaction: save, outbox `PaymentAuthorized` or
     `PaymentDeclined`, store the key response.
  6. Answer `201` with the authorization (`AUTHORIZED` or `DECLINED`); the
     checkout session stays open for another token after a decline.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrDuplicateAuthorization` | 409 | `duplicate-authorization` | A second authorize for the same session under a different key; the same key replays the first response. |
| `ErrAllocationMismatch` | 422 | `allocation-mismatch` | Allocations do not sum to the total or do not name the session's groups. |
| provider unreachable or timed out | 503 | `payment-provider-unavailable` | Retry with the same `Idempotency-Key`; the provider key is deterministic. |
| version conflict | 409 | `concurrent-update` | |
| malformed request | 422 | `validation-failed` | |

- **Events emitted:** `PaymentAuthorized` or `PaymentDeclined` (analytics).
- **Idempotency:** `Idempotency-Key`; one authorization per session.

## VoidAuthorization

- **Actor / trigger:** `checkout`, only after a definitive rejection of the
  place-order step (never while the outcome is in doubt); or the clock,
  policy `VoidUnboundAuthorizations` (no `CheckoutCompleted` after 24 h).
- **Inbound adapter:** REST
  `POST /payment-authorizations/{authorizationId}:void`, header
  `Idempotency-Key` required (`<sessionId>:void`); an internal scheduler for
  the policy.
- **Preconditions:** the authorization is `AUTHORIZED` (no capture yet).
- **Main flow:**
  1. `Idempotency-Key` lookup.
  2. Load `PaymentAuthorization` (404 `not-found`).
  3. Call the provider `Void` through the ACL port with the deterministic
     key.
  4. `PaymentAuthorization.Void(now)`: `AUTHORIZED → VOIDED`.
  5. In one transaction: save (version-checked), store the key response.
  6. Answer `200` with the authorization.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| not found | 404 | `not-found` | |
| authorization already captured, voided or expired | 409 | `illegal-transition` | The model lists `VOIDED` only from `AUTHORIZED`. |
| provider unreachable or timed out | 503 | `payment-provider-unavailable` | Retry with the same key. |
| version conflict | 409 | `concurrent-update` | |

- **Events emitted:** none (hotspot H1).
- **Idempotency:** `Idempotency-Key`; a second void of a `VOIDED`
  authorization replays the stored response.

## RequestRefund

- **Actor / trigger:** storefront ops (`MANUAL`); or the policies
  `RefundOnLostPackage` (`LOST`) and `RefundOnReturnToSender`
  (`RETURNED_TO_SENDER`) on `PackageLost` and `PackageReturned`.
- **Inbound adapter:** REST `POST /refunds`, header `Idempotency-Key`
  required; Kafka consumer on `retailnetwork.shipping-and-tracking.events`,
  group `customer-payments.shipping-and-tracking`.
- **Input:** `orderId`, `amountMinor`, `reason` (REST); for the policies the
  amount is the affected group's captured amount.
- **Preconditions:** the order is bound; refunds of the order do not exceed
  its captured total.
- **Main flow:**
  1. `Idempotency-Key` lookup, or inbox check on the CloudEvents `id`.
  2. If the order is not bound yet, park the fact (consumer path only,
     `ParkedFulfillmentFacts`).
  3. `Refund.Request(...)`: create `REQUESTED`, checking `ErrOverRefund`
     against the order's captured total.
  4. Call the provider `Refund` through the ACL port with the deterministic
     key.
  5. `RecordRefundOutcome` (below), then answer `201` with the refund
     (`REQUESTED` on the REST route when the outcome is still pending).
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrOverRefund` | 409 | `over-refund` | Refunds of the order would exceed its captured total. |
| provider unreachable or timed out | 503 | `payment-provider-unavailable` | Retry with the same `Idempotency-Key`. |
| version conflict | 409 | `concurrent-update` | |
| malformed request | 422 | `validation-failed` | |

- **Events emitted:** `RefundIssued` or `RefundFailed` (analytics), from
  `RecordRefundOutcome`.
- **Idempotency:** `Idempotency-Key` on REST; inbox on the CloudEvents `id`
  and the provider key on the policy path.

## RecordRefundOutcome

- **Actor / trigger:** the provider's answer to `Refund`.
- **Inbound adapter:** the provider port, inside `RequestRefund`; the model
  names no separate route or callback.
- **Main flow:** `Refund.RecordOutcome(result)`: `REQUESTED → SUCCEEDED` or
  `REQUESTED → FAILED` (with the translated failure `code`); save
  (version-checked), outbox `RefundIssued` or `RefundFailed`, one
  transaction.
- **Errors:** none reach a caller.
- **Events emitted:** `RefundIssued` or `RefundFailed` (analytics).
- **Idempotency:** the refund is terminal after the outcome; a repeated
  answer is a no-op (hotspot H8: no retry of a `FAILED` refund).

## CaptureAllocation (Kafka)

- **Actor / trigger:** `order-sourcing` shipped a group; policy
  `CaptureOnShipment`.
- **Inbound adapter:** Kafka consumer on
  `retailnetwork.order-sourcing.events`, type
  `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentShipped`,
  consumer group `customer-payments.order-sourcing`.
- **Main flow:**
  1. Inbox check on the CloudEvents `id`; a duplicate is acknowledged.
  2. If `orderId` is not bound to an authorization yet, park the fact in
     `ParkedFulfillmentFacts` (gap S4) and stop.
  3. Load the authorization by `orderId`; find the allocation by `groupNo`
     (`ErrUnknownGroup`).
  4. Call the provider `Capture` through the ACL port with the key for
     (`Capture`, `authorizationId`, `groupNo`).
  5. `PaymentAuthorization.Capture(groupNo, ...)`: allocation `CAPTURED`;
     `AUTHORIZED → PARTIALLY_CAPTURED`, `PARTIALLY_CAPTURED →
     PARTIALLY_CAPTURED`, or `PARTIALLY_CAPTURED → CAPTURED`. Guards:
     `ErrOverCapture`, `ErrCaptureAfterExpiry`. Store the tracking numbers
     against the group (hotspot H6).
  6. In one transaction: save (version-checked), outbox `PaymentCaptured`,
     inbox row.
- **Errors:** none reach a caller. `ErrOverCapture`, `ErrCaptureAfterExpiry`
  and `ErrUnknownGroup` are logged as anomalies (proposed); a late capture
  after expiry is the case the correctness target counts.
- **Events emitted:** `PaymentCaptured` (analytics).
- **Idempotency:** inbox on the CloudEvents `id`; the deterministic provider
  key means a replayed capture cannot move money twice.

## ReleaseAllocation (Kafka)

- **Actor / trigger:** `order-sourcing` cancelled a group; policy
  `ReleaseOnCancellation`.
- **Inbound adapter:** Kafka consumer on
  `retailnetwork.order-sourcing.events`, type
  `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentCancelled`,
  consumer group `customer-payments.order-sourcing`.
- **Main flow:**
  1. Inbox check; park the fact if the order is not bound.
  2. Load the authorization by `orderId`; find the allocation by `groupNo`
     (`ErrUnknownGroup`).
  3. `PaymentAuthorization.Release(groupNo, reason)`: allocation
     `RELEASED`. The model lists no transition and no provider call for it
     (hotspots H3 and H4).
  4. In one transaction: save (version-checked), outbox `PaymentReleased`,
     inbox row.
- **Errors:** none reach a caller; `ErrUnknownGroup` is logged.
- **Events emitted:** `PaymentReleased` (analytics).
- **Idempotency:** inbox on the CloudEvents `id`.

## BindOrder (Kafka)

- **Actor / trigger:** `checkout` completed the purchase; policy
  `BindOrderOnCheckoutCompleted`.
- **Inbound adapter:** Kafka consumer on `retailnetwork.checkout.events`,
  type `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutCompleted`,
  consumer group `customer-payments.checkout`.
- **Main flow:**
  1. Inbox check on the CloudEvents `id`.
  2. Load the authorization by `authorizationId` (the event carries it).
  3. `PaymentAuthorization.BindOrder(orderId)`: set `orderId`.
  4. Apply every parked fact for the `orderId`, in arrival order, through
     `CaptureAllocation`, `ReleaseAllocation` and `RequestRefund`.
  5. Save (version-checked), inbox row, one transaction; the applied facts
     raise their own events.
- **Errors:** none reach a caller.
- **Events emitted:** none from the bind itself.
- **Idempotency:** inbox on the CloudEvents `id`; binding the same
  `orderId` twice is a no-op.

## ReauthorizePayment (clock)

- **Actor / trigger:** the clock; policy `ReauthorizeBeforeExpiry`, 24 h
  before `expiresAt`, for authorizations with allocations still `PENDING`.
- **Inbound adapter:** an internal scheduler scanning `expires_at`.
- **Main flow:** per authorization, call the provider `Reauthorize` through
  the ACL port for the uncaptured allocations with the deterministic key;
  record the new provider reference. The model does not say how the new
  validity is recorded (hotspot H1).
- **Errors:** none reach a caller.
- **Events emitted:** none (hotspot H1).
- **Idempotency:** the deterministic provider key; the scan selects only
  authorizations close to expiry.

## ExpireAuthorization

- **Actor / trigger:** not named in the model (hotspot H2).
- **Main flow:** `PaymentAuthorization.Expire(now)`: `AUTHORIZED → EXPIRED`
  or `PARTIALLY_CAPTURED → EXPIRED`; save (version-checked), outbox
  `PaymentAuthorizationExpired`, one transaction.
- **Errors:** none reach a caller.
- **Events emitted:** `PaymentAuthorizationExpired` (analytics).
- **Idempotency:** the transition is terminal; a second expiry is a no-op.
