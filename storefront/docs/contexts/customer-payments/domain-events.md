---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: Every CloudEvents type Customer Payments publishes and consumes, with topics, keys, payload fields, consumers, idempotency and one complete example envelope.
---

# Domain Events

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

Every event this context publishes and consumes, from
`contexts[customer-payments].publishes` and `.consumes`, with the producer's
entry for each consumed event. The domain-wide rules are on
[Event standard: CloudEvents](/storefront/strategic-design/event-standard-cloudevents).

## Envelope

Every Kafka message is a **CloudEvents 1.0 event in structured JSON mode**
(`conventions.cloudevents`):

| Attribute | Value for this context |
| --- | --- |
| `specversion` | `1.0` |
| `id` | a UUID minted once when the event is written to the outbox; a redelivery carries the same `id` |
| `source` | `/retailnetwork/customer-payments` |
| `type` | `com.retailnetwork.storefront.customer-payments.<entity>.<EventName>` (tier `storefront`; entity `paymentauthorization` or `refund` from the `publishes` rows) |
| `subject` | the aggregate root id (`authorizationId` or `refundId`) |
| `time` | the instant the fact happened, UTC |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:retailnetwork:customer-payments:events:<EventName>:v1` |
| Kafka topic | `retailnetwork.customer-payments.analytics` — **every** published event is analytics-only, so by `conventions.integration_rules` the `.events` topic carries nothing from this context |
| Kafka key | the subject: `authorizationId` for authorization events, `refundId` for refund events, so one aggregate's events stay on one partition and in order |

No payment event carries a card number, a PSP token or any shopper data: the
payloads hold ids, amounts, reasons and timestamps only
(`meta.hard_boundary`).

## Published

Every event is written to `outbox_events` in the same transaction as the
aggregate save, and a relay publishes it. All seven events name their
consumers as "analytics only": they go to the `.analytics` topic and no
storefront or network context subscribes to a payment fact
([Context Map](/storefront/contexts/customer-payments/context-map)).

### PaymentAuthorized

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.customer-payments.paymentauthorization.PaymentAuthorized` |
| Topic | `retailnetwork.customer-payments.analytics` |
| Subject / key | `authorizationId` |
| Dataschema | `urn:retailnetwork:customer-payments:events:PaymentAuthorized:v1` |
| Producing command / use case | `AuthorizePayment` (accepted by the provider) |
| Consumers | analytics only |

| Field | Type | Meaning |
| --- | --- | --- |
| `authorizationId` | string | The new authorization. |
| `checkoutSessionId` | string | The session it belongs to (unique). |
| `currency` | string | The configured ISO 4217 currency. |
| `totalMinor` | integer | The authorized total in minor units. |
| `allocations` | array | One entry per shipment group: `groupNo` and `amountMinor`. |
| `expiresAt` | timestamp | When the provider's authorization stops being honoured. |

### PaymentCaptured

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.customer-payments.paymentauthorization.PaymentCaptured` |
| Topic | `retailnetwork.customer-payments.analytics` |
| Subject / key | `authorizationId` |
| Dataschema | `urn:retailnetwork:customer-payments:events:PaymentCaptured:v1` |
| Producing command / use case | `CaptureAllocation` (the `CaptureOnShipment` policy on `FulfillmentShipped`) |
| Consumers | analytics only (the future `customer-notifications` context would consume it) |

| Field | Type | Meaning |
| --- | --- | --- |
| `authorizationId` | string | The authorization captured from. |
| `orderId` | string | The order bound to it. |
| `groupNo` | integer | The shipment group whose allocation was captured. |
| `amountMinor` | integer | The captured amount in minor units. |

### PaymentReleased

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.customer-payments.paymentauthorization.PaymentReleased` |
| Topic | `retailnetwork.customer-payments.analytics` |
| Subject / key | `authorizationId` |
| Dataschema | `urn:retailnetwork:customer-payments:events:PaymentReleased:v1` |
| Producing command / use case | `ReleaseAllocation` (the `ReleaseOnCancellation` policy on `FulfillmentCancelled`) |
| Consumers | analytics only (the future `customer-notifications` context would consume it) |

| Field | Type | Meaning |
| --- | --- | --- |
| `authorizationId` | string | The authorization the allocation belongs to. |
| `orderId` | string | The order bound to it. |
| `groupNo` | integer | The group whose allocation was released. |
| `amountMinor` | integer | The released amount in minor units. |
| `reason` | string | Why it was released; the model names the field but not its values (see Open Questions on the [Bounded Context Canvas](/storefront/contexts/customer-payments/bounded-context-canvas)). |

### PaymentAuthorizationExpired

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.customer-payments.paymentauthorization.PaymentAuthorizationExpired` |
| Topic | `retailnetwork.customer-payments.analytics` |
| Subject / key | `authorizationId` |
| Dataschema | `urn:retailnetwork:customer-payments:events:PaymentAuthorizationExpired:v1` |
| Producing command / use case | `ExpireAuthorization` (what raises it is not named in the model, hotspot H2) |
| Consumers | analytics only |

| Field | Type | Meaning |
| --- | --- | --- |
| `authorizationId` | string | The authorization that expired. |
| `orderId` | string | The order bound to it. |
| `expiredAt` | timestamp | When the expiry was recorded. |

### PaymentDeclined

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.customer-payments.paymentauthorization.PaymentDeclined` |
| Topic | `retailnetwork.customer-payments.analytics` |
| Subject / key | `authorizationId` (the `DECLINED` record's root id; the payload does not repeat it, hotspot H7) |
| Dataschema | `urn:retailnetwork:customer-payments:events:PaymentDeclined:v1` |
| Producing command / use case | `AuthorizePayment` (declined by the provider; the `DECLINED` record is saved) |
| Consumers | analytics only |

| Field | Type | Meaning |
| --- | --- | --- |
| `checkoutSessionId` | string | The session whose authorize was declined; it stays open for another token. |
| `reason` | string | The decline reason, translated by the ACL. |
| `at` | timestamp | When the decline happened. |

### RefundIssued

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.customer-payments.refund.RefundIssued` |
| Topic | `retailnetwork.customer-payments.analytics` |
| Subject / key | `refundId` |
| Dataschema | `urn:retailnetwork:customer-payments:events:RefundIssued:v1` |
| Producing command / use case | `RecordRefundOutcome` (`REQUESTED → SUCCEEDED`) |
| Consumers | analytics only (the future `customer-notifications` context would consume it) |

| Field | Type | Meaning |
| --- | --- | --- |
| `refundId` | string | The refund. |
| `orderId` | string | The order refunded. |
| `amountMinor` | integer | The refunded amount in minor units. |
| `reason` | string | `LOST`, `RETURNED_TO_SENDER` or `MANUAL`. |

### RefundFailed

| Item | Value |
| --- | --- |
| Full type | `com.retailnetwork.storefront.customer-payments.refund.RefundFailed` |
| Topic | `retailnetwork.customer-payments.analytics` |
| Subject / key | `refundId` |
| Dataschema | `urn:retailnetwork:customer-payments:events:RefundFailed:v1` |
| Producing command / use case | `RecordRefundOutcome` (`REQUESTED → FAILED`) |
| Consumers | analytics only |

| Field | Type | Meaning |
| --- | --- | --- |
| `refundId` | string | The refund. |
| `orderId` | string | The order whose refund failed. |
| `code` | string | The failure code, translated by the ACL. |

## Consumed

Every consumer is idempotent on the CloudEvents `id`: the id is inserted
into `processed_events` in the same transaction as the effect, and a
duplicate is acknowledged without effect. Consumers dispatch on the **full
type string**, never on a suffix. Proposed consumer groups:
`customer-payments.checkout`, `customer-payments.order-sourcing`,
`customer-payments.shipping-and-tracking`.

### From checkout (`retailnetwork.checkout.events`, Customer/Supplier)

| Event | Full type | Fields used | What this context does |
| --- | --- | --- | --- |
| `CheckoutCompleted` | `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutCompleted` | `sessionId`, `orderId`, `authorizationId`, `groups` | Runs `BindOrderOnCheckoutCompleted`: binds `orderId` to the authorization, then applies any parked fulfilment facts for that order. |

### From order-sourcing (`retailnetwork.order-sourcing.events`, Conformist)

| Event | Full type | Fields used | What this context does |
| --- | --- | --- | --- |
| `FulfillmentShipped` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentShipped` | `orderId`, `groupNo`, `trackingNumbers` | Runs `CaptureOnShipment`: captures that group's allocation (`PaymentCaptured`) and stores the tracking numbers against the group. Parked if the order is not yet bound. |
| `FulfillmentCancelled` | `com.retailnetwork.commerce.order-sourcing.assignment.FulfillmentCancelled` | `orderId`, `groupNo`, `reason` | Runs `ReleaseOnCancellation`: releases that group's allocation (`PaymentReleased`). Parked if the order is not yet bound. |

### From shipping-and-tracking (`retailnetwork.shipping-and-tracking.events`, Conformist)

| Event | Full type | Fields used | What this context does |
| --- | --- | --- | --- |
| `PackageLost` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageLost` | `orderId`, `trackingNumber` | Runs `RefundOnLostPackage`: refunds the affected group's captured amount, reason `LOST`. Parked if the order is not yet bound. |
| `PackageReturned` | `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageReturned` | `orderId`, `trackingNumber` | Runs `RefundOnReturnToSender`: refunds the affected group's captured amount, reason `RETURNED_TO_SENDER`. Parked if the order is not yet bound. |

**Ordering.** The three topics have no order between them (gap S4).
`CheckoutCompleted` is keyed by `sessionId` upstream, `FulfillmentShipped`
and `FulfillmentCancelled` by the assignment, and `PackageLost` and
`PackageReturned` by the tracking number, so nothing links an order's facts
across topics. A fact whose `orderId` is not bound to an authorization yet
is stored in `ParkedFulfillmentFacts` and applied on the bind; the inbox on
the CloudEvents `id` makes a redelivery safe, and the aggregate refuses what
the state does not allow (`ErrOverCapture`, `ErrCaptureAfterExpiry`,
`ErrOverRefund`). The model gives parked facts no expiry for an order that
never binds (hotspot H10).

## Example envelope

`PaymentCaptured`, the event the correctness target measures (all ids
synthetic):

```json
{
  "specversion": "1.0",
  "id": "b5d2c9a0-71e4-4c38-a6f1-0d3e8b7c5a92",
  "source": "/retailnetwork/customer-payments",
  "type": "com.retailnetwork.storefront.customer-payments.paymentauthorization.PaymentCaptured",
  "subject": "auth-7c1e2a",
  "time": "2026-10-26T14:03:09Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:retailnetwork:customer-payments:events:PaymentCaptured:v1",
  "data": {
    "authorizationId": "auth-7c1e2a",
    "orderId": "ord-90f4d1",
    "groupNo": 1,
    "amountMinor": 4290
  }
}
```

No card number, token or shopper reference appears in any payment event:
the events carry ids and amounts only, and the PSP token never leaves the
provider port (`conventions.no_auth` — the storefront stores no PII).
