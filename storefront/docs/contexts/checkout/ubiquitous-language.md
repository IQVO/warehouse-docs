---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: The terms Checkout speaks, each mapped to its proposed code identifier, plus the neighbour terms it uses and the terms most often confused with them, above all the network's Checkout.
---

# Ubiquitous Language

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

The terms this context speaks, each mapped to the identifier a future
implementation must use. The first table is the context's own `ul` list in
`model.yaml`. The second holds the model elements of its aggregate. The
third holds neighbour terms this context uses but does not own; their
definitions come from the owning context's `ul` list. The storefront-wide
glossary is [Ubiquitous Language](/storefront/strategic-design/ubiquitous-language).

## Own terms

Derived from: `model.yaml → contexts[checkout].ul`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Checkout Session** | The purchase transaction from review to placed order. | `session.CheckoutSession` | The network's "Checkout" (`customer-ordering` `PlaceOrder`), which is the session's place-order step. |
| **Place-Order Step** | The pivot of the saga: `customer-ordering` `POST /checkout` through the ACL. | `session.PlaceOrder` | The whole session: placing the order is one step; authorizing before it and the events after it are the others. |
| **In-Doubt Placement** | The place-order outcome is unknown (timeout or 503); `PLACING` holds the semantic lock until the resolver settles it. | `session.PlacementInDoubt` | A failure: nothing is known to have failed, and nothing is known to have succeeded. The session neither voids nor retries as a new attempt. |
| **Requote** | A definitive 409 from the network: the authorization is voided and the session carries the re-quoted offers for the cart. | `session.RequotedOffer` | The cart's **Delivery Quote**: a requote is the network's answer to a place-order attempt and ends the session in `REQUOTE_REQUIRED`; a new session starts from the cart. |
| **Allocation** | The share of an authorization that belongs to one shipment group. | `session.SessionGroup.Amount` | `customer-payments`' **Allocation** (`authorization.Allocation`, with a `PENDING`, `CAPTURED` or `RELEASED` state): the session's amount per group is what the authorization is split by; the payment-side object tracks the money. |

## Model elements of this context

Derived from: `model.yaml → contexts[checkout].aggregates[CheckoutSession]`
(`value_objects`, `states`, `commands`), `policies`.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Session Line** | One numbered line of the session: `lineNo`, `catalogItemId`, `quantity`. | `session.SessionLine{lineNo, catalogItemId, quantity}` | The cart's `CartLine{catalogItemId, quantity}`: the session numbers lines 1..n when it opens (gap S1). |
| **Session Group** | One shipment group: `groupNo` (from the quote), the chosen `offerId`, `tier` and the `lineNos` it covers. | `session.SessionGroup{groupNo, offerId, tier, lineNos[]}` | The network's `GroupPromise{groupNo, promiseId, ...}` in a placed order: the session group carries the offer, the order carries the confirmed promise. |
| **Requoted Offer** | One offer the network returned in a definitive 409: `offerId`, `groupNo`, `tier`, delivery window and `expiresAt`. | `session.RequotedOffer{offerId, groupNo, tier, deliverByEarliest, deliverByLatest, expiresAt}` | The cart's `QuotedOffer`: same shape, different moment; this one answers a failed placement. |
| **Session states** | `OPEN`, `AUTHORIZING`, `DECLINED`, `PLACING`, `REQUOTE_REQUIRED`, `COMPLETED`, `EXPIRED`, `FAILED`. | `session.SessionStatus` | The network order's states (`PLACED`, `IN_FULFILLMENT`, ...): a `COMPLETED` session is the placed order's origin, not its status. |
| **Semantic Lock** | `PLACING` while the place-order outcome is unknown: no void and no new attempt. | `ErrPlacementInDoubt` (the invariant that enforces it) | A database lock: it is a business state that survives restarts and is visible to the shopper as `202`. |
| **Stored Placement Request** | The PII-free body sent to `customer-ordering`, kept so it can be replayed byte for byte. | (a field of `CheckoutSession`; the model names no identifier) | The order itself: it holds `shipToAddressId` and numbered lines, never the address. |
| **Resolve In-Doubt Placements** | Policy: re-send the stored body with the same `Idempotency-Key` with backoff until a definitive answer; alert at 20 h. | `ResolveInDoubtPlacements` | A retry of the shopper's confirm: confirm is refused while `PLACING`. |
| **Expire On Quote Expiry** | Policy: an `OPEN` or `DECLINED` session expires with its price quote. | `ExpireOnQuoteExpiry` | A session timeout in general: only the quote's expiry ends an open session. |

## Neighbour terms this context uses

| Term | Definition (owner's) | Code identifier (owner) | Not to be confused with |
| --- | --- | --- | --- |
| **Checkout** (network) | The act of turning a cart into a customer order, promising every group. | `order.PlaceOrder` (`customer-ordering`, [network](/network/contexts/customer-ordering)) | The storefront's **Checkout Session**, a larger transaction of which this is one step. |
| **Customer Order** | What the shopper bought, with a promise per shipment group. | `order.CustomerOrder` (`customer-ordering`, [network](/network/contexts/customer-ordering)) | The checkout session: the order is the network's record, the session is the storefront's saga. |
| **Ship-To** | The delivery address; synthetic PII held only in `customer-ordering`. | `order.ShipTo` (`customer-ordering`, [network](/network/contexts/customer-ordering)) | The session's `shipToAddressId`: a reference, never the address. |
| **Shopper** | The (synthetic) customer placing orders. | `shopper.Shopper` (`customer-ordering`, [network](/network/contexts/customer-ordering)) | The session's `shopperId`: a reference to it. |
| **Cart** | One shopper's held intent: lines, destination, delivery quote and selections. | `cart.Cart` ([shopping-cart](/storefront/contexts/shopping-cart)) | The session: the cart is intent, the session is the transaction. |
| **Checkout Readiness** | Every group selected and no offer expired. | `cart.CheckoutReadiness` ([shopping-cart](/storefront/contexts/shopping-cart)) | The session's own state; checkout enforces the readiness at open (`ErrCartNotCheckoutReady`). |
| **Price Quote** | A binding, immutable, expiring price snapshot for one checkout. | `quote.PriceQuote` ([pricing](/storefront/contexts/pricing)) | The cart's **Estimate** (non-binding). |
| **Payment Authorization** | A hold on the shopper's payment method for the quote total, split into allocations per shipment group. | `authorization.PaymentAuthorization` (`customer-payments`) | The charge: an authorization holds, a capture takes. |
| **Void** | Cancelling the whole authorization before any capture. | `authorization.Void` (`customer-payments`) | A refund (money returned after capture) or a release (one allocation). |
| **Payment Method Token** | The PSP token standing in for the shopper's card; the storefront never sees a card number. | `(provider port)` (`customer-payments`) | A card number: the session never holds one. |
| **DeliveryOffer** | A short-lived quote for (item, quantity, destination prefix, tier) with a delivery window, the witness path that proves it, and an expiry. | `offer.DeliveryOffer` (`delivery-promise`, [network](/network/contexts/delivery-promise)) | The session group's `offerId`: a reference to such an offer. |

## Fleet translation

None. Checkout never touches the warehouse-systems fleet and never produces
or consumes a `warehouse.*` topic (`meta.hard_boundary`).
