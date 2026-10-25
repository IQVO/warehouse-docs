---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: The terms Customer Payments speaks, each mapped to its proposed code identifier, plus the neighbour terms it uses and the terms most often confused with them.
---

# Ubiquitous Language

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

The terms this context speaks, each mapped to the identifier a future
implementation must use. The first table is the context's own `ul` list in
`model.yaml`. The second holds the model elements of its two aggregates. The
third holds neighbour terms this context uses but does not own; their
definitions come from the owning context's `ul` list. The storefront-wide
glossary is [Ubiquitous Language](/storefront/strategic-design/ubiquitous-language).

## Own terms

Derived from: `model.yaml → contexts[customer-payments].ul`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Payment Authorization** | A hold on the shopper's payment method for the quote total, split into allocations per shipment group. | `authorization.PaymentAuthorization` | A charge: an authorization moves no money until an allocation is captured. |
| **Capture** | Taking an allocation's money when its shipment group ships. | `authorization.Allocation.Capture` | **Authorize** (the hold at checkout). |
| **Release** | Letting an uncaptured allocation go when its group is cancelled. | `authorization.Allocation.Release` | **Void**, which cancels the whole authorization. |
| **Void** | Cancelling the whole authorization before any capture. | `authorization.Void` | **Release** (one allocation) and **Refund** (money already captured). |
| **Refund** | Returning captured money for a lost or returned package, or manually. | `refund.Refund` | **Void** and **Release**, which return a hold, not money. |
| **Reauthorization** | A fresh authorization replacing one about to expire, for allocations not yet captured. | `authorization.Reauthorize` | The first **authorize** at checkout (`AuthorizePayment`); `ReauthorizePayment` is a separate command on the same aggregate and publishes no event of its own (see model gaps in the [Aggregate Design Canvas](/storefront/contexts/customer-payments/aggregate-design-canvas)). |
| **Payment Method Token** | The PSP token standing in for the shopper's card; the storefront never sees a card number. | `(provider port)` | A card number or any part of one: no aggregate field holds card data. |

## Model elements of this context

Derived from: `model.yaml → contexts[customer-payments].aggregates`
(`value_objects`, `states`, `commands`, `events`), `read_models`, `policies`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Allocation** | The share of an authorization that belongs to one shipment group: `groupNo`, `amountMinor`, state `PENDING`, `CAPTURED` or `RELEASED`. | `authorization.Allocation{groupNo, amountMinor, state}` | The checkout session's allocation (`session.SessionGroup.Amount`), the same amount before it reaches this context. |
| **Provider Ref** | The provider's authorization id and the ids of its captures. | `authorization.ProviderRef{providerAuthorizationId, providerCaptureIds[]}` | `authorizationId`, this context's own id for the aggregate. |
| **Authorization states** | `AUTHORIZED`, `PARTIALLY_CAPTURED`, `CAPTURED`, `VOIDED`, `EXPIRED`, `DECLINED`. | `authorization.Status` | `DECLINED` is a terminal record of a declined attempt, not a state the aggregate moves into. |
| **Declined** | The provider refused the authorize attempt; the record is kept and the checkout session stays open for another token. | `authorization.PaymentDeclined` | A decline of the shopper's order: the order is not placed yet. |
| **Expiry** | The moment (`expiresAt`) after which the provider no longer honours the hold; no capture after it. | `authorization.expiresAt`, `ErrCaptureAfterExpiry` | Void (a choice) and Release (one group's allocation). |
| **Refund Reason** | `LOST`, `RETURNED_TO_SENDER` or `MANUAL`. | `refund.RefundReason` | The network's cancellation reasons carried by `FulfillmentCancelled`. |
| **Refund states** | `REQUESTED`, `SUCCEEDED`, `FAILED`. | `refund.Status` | The authorization states. |
| **Parked Fulfilment Facts** | Read model: shipment, cancellation, lost and returned facts for orders not yet bound to an authorization, applied on `BindOrderOnCheckoutCompleted`. | `ParkedFulfillmentFacts` | A retry queue: parked facts wait for a bind, not for a failure. |
| **Provider Idempotency Key** | The key sent with every provider call, deterministic per (operation, `authorizationId`, `groupNo`). | `(provider port)` | The REST `Idempotency-Key` header, which dedupes the caller's request. |
| **Bind** | Attaching `orderId` to the session's authorization when `CheckoutCompleted` arrives. | `BindOrder`, `BindOrderOnCheckoutCompleted` | Authorize: the authorization exists before the order does. |

## Neighbour terms this context uses

| Term | Definition (owner's) | Code identifier (owner) | Not to be confused with |
| --- | --- | --- | --- |
| **Checkout Session** | The purchase transaction from review to placed order. | `session.CheckoutSession` (`checkout`) | The authorization: the session asks for it and later completes. |
| **Place-Order Step** | The pivot of the saga: customer-ordering `POST /checkout` through the ACL. | `session.PlaceOrder` (`checkout`) | `VoidAuthorization` is only called after this step is definitively rejected. |
| **Requote** | A definitive 409 from the network: the authorization is voided and the session carries the re-quoted offers. | `session.RequotedOffer` (`checkout`) | A refund: the void happens before any capture. |
| **Fulfillment Assignment** | The decision of which node and path fulfil one shipment group. | `assignment.FulfillmentAssignment` (`order-sourcing`, [network](/network/contexts/order-sourcing)) | An allocation: the assignment is the network's unit, the allocation the payment's, joined by `orderId` and `groupNo`. |
| **Tracking Number** | The network-wide unique id of one package. | `journey.TrackingNumber` (`shipping-and-tracking`, [network](/network/contexts/shipping-and-tracking)) | `groupNo`: `PackageLost` and `PackageReturned` carry the tracking number, which `CaptureOnShipment` stored against the group. |
| **Customer Order** | What the shopper bought, with a promise per shipment group. | `order.CustomerOrder` (`customer-ordering`, [network](/network/contexts/customer-ordering)) | The authorization: the order is the network's record, the authorization the storefront's money. |

## Fleet translation

None. Customer Payments never touches the warehouse-systems fleet and never
produces or consumes a `warehouse.*` topic (`meta.hard_boundary`).
