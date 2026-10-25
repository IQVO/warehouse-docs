---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why moving money with the shipment facts is the storefront's Generic subdomain, the decisions customer-payments makes, and what it deliberately leaves to checkout, the network and the payment provider.
---

# Business Context

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

## The problem in plain language

A shopper pays once, at checkout, but the retail network ships in pieces: an
order is split into shipment groups, each group is sourced and shipped on its
own clock, and a group can be cancelled, lost or returned after the rest has
gone out. Charging the whole total up front would mean refunding every group
that does not arrive; charging nothing until the last group ships would mean
losing the money of an order whose card expired in the meantime.

The research behind this design (see [Benchmarks](/storefront/research/benchmarks))
names the practice the model adopts: **authorize at checkout, capture when
the goods are fulfilled** [10], and **re-authorize before the provider's
authorization window closes** [9]. Customer Payments owns that money
lifecycle, in two aggregates:

| It owns | Why here |
| --- | --- |
| The **payment authorization** (`PaymentAuthorization`) — one per checkout session, with an allocation per shipment group, each `PENDING`, `CAPTURED` or `RELEASED` | The hold is the unit the provider reasons about; the allocations are the unit the network ships by. Keeping both in one aggregate is what lets `ErrOverCapture` and `ErrAllocationMismatch` be enforced as invariants. |
| The **refund** (`Refund`) — money returned for an order or group, for reason `LOST`, `RETURNED_TO_SENDER` or `MANUAL` | A refund has its own outcome (`REQUESTED`, then `SUCCEEDED` or `FAILED`) and its own cap: refunds of an order never exceed what was captured (`ErrOverRefund`). |
| The **parked fulfilment facts** (a read model) | A shipment, cancellation, lost or returned fact can arrive before `CheckoutCompleted` binds the order to its authorization; the fact is kept and applied after the bind (gap S4). |
| The **provider port** (an Anti-Corruption Layer) | Authorize, Capture, Void, Refund and Reauthorize are the only provider verbs the domain knows; the provider's vocabulary stays in one adapter. |

What this context never does: it does not run the purchase saga or decide
when to authorize ([checkout](/storefront/contexts)), it does not decide
that a group ships or is cancelled (the network's
[order-sourcing](/network/contexts/order-sourcing)), it does not declare a
package lost or returned
([shipping-and-tracking](/network/contexts/shipping-and-tracking)), it
stores no PII, and it never sees a card number — only PSP tokens.

## Actors

| Actor | What they do here | Channel |
| --- | --- | --- |
| `checkout` | Authorizes the quote total with one allocation per shipment group; voids the authorization after a definitive rejection of the place-order step; reads an authorization | REST `POST /payment-authorizations`, `POST /payment-authorizations/{authorizationId}:void`, `GET /payment-authorizations/{authorizationId}` |
| `checkout` (again) | Announces that the purchase completed, which binds the order to the authorization | Kafka `retailnetwork.checkout.events`, `CheckoutCompleted` |
| Storefront ops (human) | Requests a manual refund; lists authorizations by order or checkout session and refunds by order | REST `POST /refunds`, `GET /payment-authorizations?orderId=\|checkoutSessionId=`, `GET /refunds?orderId=` |
| `order-sourcing` (network) | Reports that a group shipped (capture) or was cancelled (release) | Kafka `retailnetwork.order-sourcing.events`, `FulfillmentShipped`, `FulfillmentCancelled` |
| `shipping-and-tracking` (network) | Reports that a package was lost or returned (refund) | Kafka `retailnetwork.shipping-and-tracking.events`, `PackageLost`, `PackageReturned` |
| `payment-provider` (external) | Answers the five provider operations; in the study, the payment-provider simulator stands in behind the port | Provider port (ACL), the only synchronous call out |
| Analytics consumers | Follow authorizations, captures, releases, expiries, declines and refunds | Kafka `retailnetwork.customer-payments.analytics` |

The shopper is a synthetic person who never calls a payment route: the
card details are entered into the provider's hosted fields, and the
storefront hands only the resulting token to `checkout`.

## Decisions this context makes

The model lists four business decisions
(`contexts[customer-payments].business_decisions`):

1. **One authorization per checkout session; a replayed authorize returns
   the existing one** (`ErrDuplicateAuthorization` is the invariant behind
   it). The role "Enforcer: never two holds for one session" in the model
   is this rule.
2. **Capture is per allocation (shipment group).** The correctness targets
   are zero captures without `FulfillmentShipped` and zero expired
   authorizations on shipped groups.
3. **Fulfilment facts for a not-yet-bound order are parked** and applied on
   `BindOrderOnCheckoutCompleted` (cross-topic order, gap S4).
4. **Provider idempotency keys are deterministic per (operation,
   `authorizationId`, `groupNo`)**, so a retried call can never move money
   twice.

It also runs seven policies: **BindOrderOnCheckoutCompleted**,
**CaptureOnShipment** (which also stores the tracking number against the
group), **ReleaseOnCancellation**, **RefundOnLostPackage**,
**RefundOnReturnToSender**, **ReauthorizeBeforeExpiry** (24 h before
`expiresAt`) and **VoidUnboundAuthorizations** (no `CheckoutCompleted` after
24 h: void, which covers a checkout crash after authorize).

## How it relates to real storefronts

The [benchmarks](/storefront/research/benchmarks) research describes three
practices this model copies in shape, not in any internal service name:

- **Authorize at checkout, capture on fulfilment, per fulfilled line items
  where the platform allows it** [10]. Here the capture unit is the shipment
  group, because that is the unit the network ships and cancels.
- **Authorizations expire** — card-not-present authorizations are valid for
  about seven days on the major card networks [9], and a `STANDARD` delivery
  can take that long — so uncaptured allocations are re-authorized before
  expiry instead of being captured early.
- **Card data stays out of scope**: the page uses the provider's hosted
  fields and the merchant side holds only a token [11][12]. In this model
  that is a hard boundary: no field of any aggregate holds a card number.

## Deliberately out of scope

| Out of scope | Where it belongs |
| --- | --- |
| The purchase saga, the choice to authorize, the requote path | `checkout` (it calls this context; gap S3) |
| Prices, tier charges, tax bands, the binding quote total | `pricing`; `checkout` carries the total into `AuthorizePayment` |
| Deciding that a group ships or is cancelled | `order-sourcing` (network) |
| Deciding that a package is lost or returned | `shipping-and-tracking` (network) |
| The order record, ship-to address, shopper PII | `customer-ordering` (network); the storefront holds references only |
| Entering and holding card details | The external `payment-provider`; the simulator stands in for it in the study |
| Notifying the shopper about captures and refunds | the future `customer-notifications` context (adopting the network's future `customer-notification`) |
| Vendor payouts and settlement | the network's future vendor-settlement (the model records that the network's payments-and-invoicing splits in two, D5) |
| Authentication and identity | deferred (D4): the `identity` future context |

See the [Bounded Context Canvas](/storefront/contexts/customer-payments/bounded-context-canvas)
for every message and the [Context Map](/storefront/contexts/customer-payments/context-map)
for every relationship.
