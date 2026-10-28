---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: Every Customer Payments command use case with its actor or trigger, inbound adapter, preconditions, main flow, error mapping, events and idempotency.
---

# Use Cases

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `customer-payments` service is built on develop ([`IQVO/customer-payments`](https://github.com/IQVO/customer-payments) at `530c7cb`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/customer-payments#service-and-operations) section lists it.
:::

One section per command of
`contexts[customer-payments].aggregates[PaymentAuthorization].commands` and
`aggregates[Refund].commands`, plus the policies that issue them. They are
application services in `internal/application/usecases` (as built). The
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
| `VoidAuthorization` | `checkout` after a definitive rejection; policy `VoidUnboundAuthorizations` | REST `POST /payment-authorizations/{authorizationId}:void`; scheduler | `PaymentReleased` (reason `VOIDED`) |
| `RequestRefund` | Storefront ops; policies `RefundOnLostPackage`, `RefundOnReturnToSender` | REST `POST /refunds`; Kafka consumer, `retailnetwork.shipping-and-tracking.events` | `RefundIssued` or `RefundFailed` after the outcome |
| `RecordRefundOutcome` | The provider's answer to `Refund` | the provider port (inside `RequestRefund`) | `RefundIssued` or `RefundFailed` |
| `RetryRefund` | Storefront ops or an automatic retry of a `FAILED` refund (max 5 attempts) | internal; the model's `rest` list has no route | `RefundIssued` or `RefundFailed` after the outcome |
| `CaptureAllocation` | `order-sourcing` `FulfillmentShipped`, policy `CaptureOnShipment` | Kafka consumer, `retailnetwork.order-sourcing.events` | `PaymentCaptured` |
| `ReleaseAllocation` | `order-sourcing` `FulfillmentCancelled`, policy `ReleaseOnCancellation`; `FulfillmentUnsourceable`, policy `ReleaseOnUnsourceable` | Kafka consumer, `retailnetwork.order-sourcing.events` | `PaymentReleased` |
| `BindOrder` | `checkout` `CheckoutCompleted`, policy `BindOrderOnCheckoutCompleted` | Kafka consumer, `retailnetwork.checkout.events` | none |
| `ReauthorizePayment` | Clock, policy `ReauthorizeBeforeExpiry` (24 h before `expiresAt`) | scheduler | `PaymentReauthorized`, or `PaymentDeclined` (reason `REAUTH_DECLINED`) on a provider decline |
| `ExpireAuthorization` | a provider decline on re-authorization | internal, inside `ReauthorizePayment` | `PaymentAuthorizationExpired` |

## How save and publish commit

Every use case that changes an aggregate loads it with its `version`, calls
the aggregate, then saves it inside one Postgres transaction. The save is
conditional on the version it loaded (`UPDATE ... WHERE version = ?`); a
conflict is retried once inside the use case, then surfaces as 409
`concurrent-update`. If an event is raised, the outbox row
(`outbox_events`) is written in the same transaction. A consumer-driven use
case also inserts the CloudEvents `id` into `processed_events` in that
transaction. A relay publishes outbox rows to
`retailnetwork.customer-payments.events` after the commit.

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
  4. `PaymentAuthorization.Void(now)`: `AUTHORIZED → VOIDED`; raises
     `PaymentReleased{reason: VOIDED}`.
  5. In one transaction: save (version-checked), store the key response.
  6. Answer `200` with the authorization.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| not found | 404 | `not-found` | |
| authorization already captured, voided or expired | 409 | `illegal-transition` | The model lists `VOIDED` only from `AUTHORIZED`. |
| provider unreachable or timed out | 503 | `payment-provider-unavailable` | Retry with the same key. |
| version conflict | 409 | `concurrent-update` | |

- **Events emitted:** `PaymentReleased` with reason `VOIDED` (analytics).
- **Idempotency:** `Idempotency-Key`; a second void of a `VOIDED`
  authorization replays the stored response.

## RequestRefund

- **Actor / trigger:** storefront ops (`MANUAL`); or the policies
  `RefundOnLostPackage` (`LOST`) and `RefundOnReturnToSender`
  (`RETURNED_TO_SENDER`) on `PackageLost` and `PackageReturned`.
- **Inbound adapter:** REST `POST /refunds`, header `Idempotency-Key`
  required; Kafka consumer on `retailnetwork.shipping-and-tracking.events`,
  group `customer-payments.shipping-and-tracking`.
- **Input:** `orderId`, `groupNo`, `authorizationId`, `amountMinor`,
  `reason` (REST); for the policies the group is found by the tracking number
  stored on its allocation at capture, and the amount is that group's captured
  amount.
- **Preconditions:** the order is bound; refunds of the order do not exceed
  its captured total (`REQUESTED` and issued refunds count; `FAILED` never
  does).
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
- **Idempotency:** a `SUCCEEDED` refund is terminal and a repeated answer is
  a no-op; a `FAILED` refund can be retried by `RetryRefund`.

## RetryRefund

- **Actor / trigger:** storefront ops or an automatic retry of a `FAILED`
  refund. The model's `rest` list has no `RetryRefund` route, so the REST
  contract carries none (H8).
- **Preconditions:** the refund is `FAILED` and has fewer than 5 attempts;
  `ErrOverRefund` counts `REQUESTED` and issued refunds, never `FAILED`.
- **Main flow:** `Refund.Retry()`: `FAILED → REQUESTED`; call the provider
  `Refund` with the same deterministic key; `RecordRefundOutcome`. After the
  fifth failed attempt the refund stays `FAILED` and an operator alert fires.
- **Errors:** `ErrOverRefund` (409 `over-refund`); a refund past 5 attempts
  is refused with 409 `illegal-transition`.
- **Events emitted:** `RefundIssued` or `RefundFailed` (analytics).
- **Idempotency:** the provider key is deterministic per refund; a `REQUESTED`
  refund is not retried.

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
     `ErrOverCapture`, `ErrCaptureAfterExpiry`. Set the allocation's
     nullable `trackingNumber` from `trackingNumbers` (H6); the aggregate
     state is derived from the allocations, so a one-group order goes
     `AUTHORIZED → CAPTURED`.
  6. In one transaction: save (version-checked), outbox `PaymentCaptured`,
     inbox row.
- **Errors:** none reach a caller. `ErrOverCapture`, `ErrCaptureAfterExpiry`
  and `ErrUnknownGroup` are logged as anomalies (proposed); a late capture
  after expiry is the case the correctness target counts.
- **Events emitted:** `PaymentCaptured` (analytics).
- **Idempotency:** inbox on the CloudEvents `id`; the deterministic provider
  key means a replayed capture cannot move money twice.

## ReleaseAllocation (Kafka)

- **Actor / trigger:** `order-sourcing` cancelled a group or found it
  unsourceable; policies `ReleaseOnCancellation` and `ReleaseOnUnsourceable`.
- **Inbound adapter:** Kafka consumer on
  `retailnetwork.order-sourcing.events`, type
  `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentCancelled`
  or `...FulfillmentUnsourceable`, consumer group `customer-payments.order-sourcing`.
- **Main flow:**
  1. Inbox check; park the fact if the order is not bound.
  2. Load the authorization by `orderId`; find the allocation by `groupNo`
     (`ErrUnknownGroup`).
  3. For a partial release call the provider `ReduceAuthorization(amount)`
     through the ACL port (H4).
  4. `PaymentAuthorization.Release(groupNo, reason)`: allocation `RELEASED`
     (reason `CANCELLED` or `UNSOURCEABLE`); the state follows the
     allocations: `AUTHORIZED → AUTHORIZED` or `RELEASED`,
     `PARTIALLY_CAPTURED → PARTIALLY_CAPTURED`, `CAPTURED` or `RELEASED` (H3).
  5. In one transaction: save (version-checked), outbox `PaymentReleased`,
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
     `CaptureAllocation`, `ReleaseAllocation` and `RequestRefund`. Parked
     facts older than 30 days were purged (H10).
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
  the ACL port for the uncaptured allocations with the deterministic key.
  On success `Reauthorize(providerAuthorizationId, newExpiresAt)`: `AUTHORIZED →
  AUTHORIZED` with the new `expiresAt` and provider reference. On a provider
  decline the authorization goes to `EXPIRED` (`ExpireAuthorization`) and
  `PaymentDeclined{reason: REAUTH_DECLINED}` is raised (H1, H2).
- **Errors:** none reach a caller.
- **Events emitted:** `PaymentReauthorized`, or `PaymentDeclined` and
  `PaymentAuthorizationExpired` on a decline (analytics).
- **Idempotency:** the deterministic provider key; the scan selects only
  authorizations close to expiry.

## ExpireAuthorization

- **Actor / trigger:** a provider decline on re-authorization, inside
  `ReauthorizePayment` (H2).
- **Main flow:** `PaymentAuthorization.Expire(now)`: `AUTHORIZED → EXPIRED`
  or `PARTIALLY_CAPTURED → EXPIRED`; save (version-checked), outbox
  `PaymentAuthorizationExpired`, one transaction.
- **Errors:** none reach a caller.
- **Events emitted:** `PaymentAuthorizationExpired` (analytics).
- **Idempotency:** the transition is terminal; a second expiry is a no-op.
