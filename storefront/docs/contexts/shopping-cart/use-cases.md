---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: Every proposed Shopping Cart command use case with its actor or trigger, inbound adapter, preconditions, main flow, error mapping, events and idempotency.
---

# Use Cases

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `shopping-cart` service is built on develop ([`IQVO/shopping-cart`](https://github.com/IQVO/shopping-cart) at `95bc5bc`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/shopping-cart#service-and-operations) section lists it.
:::

One section per command of `contexts[shopping-cart].aggregates[Cart].commands`,
plus the two policies and the view projector. They are proposed application
services in `internal/application/usecases`. The step-by-step diagrams are
on [Sequence Diagrams](/storefront/contexts/shopping-cart/sequence-diagrams);
the payloads are on [Domain Events](/storefront/contexts/shopping-cart/domain-events);
the REST contract is `storefront/apis/shopping-cart/openapi.yaml`.

Reads are not use cases here: `GET /carts/{cartId}` (`GetCart`, with the
`CheckoutReadiness` view and the labelled estimate — also called by
`checkout` at session open) and `GET /carts?shopperId=&state=`
(`ListCarts`) read the repository and views directly.

## Triggers at a glance

| Use case | Trigger | Inbound adapter | Emits |
| --- | --- | --- | --- |
| `CreateCart` | Shopper via `storefront-bff` | REST `POST /carts` | none |
| `AddLine` | Shopper via `storefront-bff` | REST `POST /carts/{cartId}/lines` | `CartLineAdded` |
| `SetLineQuantity` | Shopper via `storefront-bff` | REST `POST /carts/{cartId}/lines/{catalogItemId}:set-quantity` | none |
| `RemoveLine` | Shopper via `storefront-bff` | REST `POST /carts/{cartId}/lines/{catalogItemId}:remove` | none |
| `SetDestination` | Shopper via `storefront-bff` | REST `POST /carts/{cartId}:set-destination` | none |
| `QuoteDelivery` | Shopper via `storefront-bff` | REST `POST /carts/{cartId}:quote-delivery` | `CartDeliveryQuoted` |
| `SelectDelivery` | Shopper via `storefront-bff` | REST `POST /carts/{cartId}:select-delivery` | none |
| `MergeInto` | Shopper via `storefront-bff` (the sign-in moment, D4) | REST `POST /carts/{cartId}:merge-into` | none |
| `AbandonInactive` | Clock, policy `AbandonInactive` (30 days) | scheduler | `CartAbandoned` |
| `CloseOnCheckoutCompleted` | `checkout` `CheckoutCompleted` | Kafka consumer, `retailnetwork.checkout.events` | `CartCheckedOut` |
| Project `PurchasabilityView`, `EstimateView` | `offer-availability`, `pricing` | Kafka consumers, `retailnetwork.offer-availability.events`, `retailnetwork.pricing.events` | none |

## How save and publish commit

Every use case that changes the cart loads it with its `version`, calls
the aggregate, then saves it inside one Postgres transaction. The save is
conditional on the version it loaded (`UPDATE ... WHERE version = ?`); a
conflict is retried once inside the use case, then surfaces as 409
`concurrent-update`. If an event is raised, the outbox row
(`outbox_events`) is written in the same transaction. A consumer-driven
use case also inserts the CloudEvents `id` into `processed_events` in that
transaction. A relay publishes outbox rows to
`retailnetwork.shopping-cart.analytics` after the commit.

Error responses use `application/problem+json` (RFC 9457) with `type`
`/problems/<slug>` per `conventions.integration_rules`: not-found 404,
illegal-transition / cart-closed 409, concurrent-update 409,
validation-failed 422, plus one kebab-case slug per `Err` in the model.
Every write route takes an `Idempotency-Key` header, minted by the BFF.

## CreateCart

- **Actor / trigger:** the shopper, through `storefront-bff`.
- **Inbound adapter:** REST `POST /carts`, header `Idempotency-Key`
  required.
- **Input:** optional `shopperId` (guest-first, D4; absent for a guest).
- **Main flow:** `Cart.CreateCart(shopperId, now)` creates an `OPEN`, empty
  cart; insert; store the response under the key.
- **Errors:** 422 `validation-failed` only.
- **Events emitted:** none (`CreateCart` publishes nothing — hotspot H1).
- **Idempotency:** `Idempotency-Key`; the BFF keeps the returned `cartId`
  in its cookie.

## AddLine

- **Actor / trigger:** the shopper, through `storefront-bff`.
- **Inbound adapter:** REST `POST /carts/{cartId}/lines`, header
  `Idempotency-Key` required.
- **Input:** `catalogItemId`, `quantity`.
- **Preconditions:** the cart is `OPEN`; the item is purchasable in
  `PurchasabilityView`.
- **Main flow:**
  1. `Idempotency-Key` lookup; replay the stored response on a hit.
  2. Load `Cart` (404 `not-found`).
  3. `Cart.AddLine(...)`: one line per item — re-adding merges quantities
     (`ErrDuplicateLine` is the invariant behind the merge); quantity
     bounds and the line cap; the quote and the selections are cleared.
  4. In one transaction: save (version-checked), outbox `CartLineAdded`
     with the merged quantity, store the key response.
  5. Answer `200` with the cart.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrItemNotPurchasable` | 422 | `item-not-purchasable` | The view is fed by catalogue and price events only (hotspot H3). |
| `ErrQuantityOutOfRange` | 422 | `quantity-out-of-range` | Quantity must be in `1..99`. |
| `ErrTooManyLines` | 422 | `too-many-lines` | At most 100 lines (customer-ordering A15). |
| `ErrCartClosed` | 409 | `cart-closed` | The cart is `CHECKED_OUT`, `ABANDONED` or `MERGED`. |
| version conflict | 409 | `concurrent-update` | Retried once inside the use case. |

- **Events emitted:** `CartLineAdded` (analytics).
- **Idempotency:** `Idempotency-Key`.

## SetLineQuantity

- **Actor / trigger:** the shopper, through `storefront-bff`.
- **Inbound adapter:** REST
  `POST /carts/{cartId}/lines/{catalogItemId}:set-quantity`, header
  `Idempotency-Key` required.
- **Main flow:** load the cart (404), set the line's quantity
  (`ErrQuantityOutOfRange`; unknown line → 404 `not-found`), clear quote
  and selections, save (version-checked), one transaction.
- **Errors:** as `AddLine`, minus `ErrItemNotPurchasable` and
  `ErrTooManyLines`.
- **Events emitted:** none (hotspot H1 — analytics never sees a quantity
  change).
- **Idempotency:** `Idempotency-Key`.

## RemoveLine

- **Actor / trigger:** the shopper, through `storefront-bff`.
- **Inbound adapter:** REST
  `POST /carts/{cartId}/lines/{catalogItemId}:remove`, header
  `Idempotency-Key` required.
- **Main flow:** load the cart (404), remove the line (unknown line → 404),
  clear quote and selections, save (version-checked), one transaction.
- **Errors:** `ErrCartClosed` 409; 404 `not-found`; 409
  `concurrent-update`.
- **Events emitted:** none (hotspot H1).
- **Idempotency:** `Idempotency-Key`; replaying returns the stored
  response.

## SetDestination

- **Actor / trigger:** the shopper, through `storefront-bff`.
- **Inbound adapter:** REST `POST /carts/{cartId}:set-destination`, header
  `Idempotency-Key` required.
- **Input:** `destinationPostalPrefix` — a prefix, never an address.
- **Main flow:** load the cart (404), set the prefix, clear quote and
  selections, save (version-checked), one transaction.
- **Errors:** 404 `not-found`; 409 `cart-closed` / `concurrent-update`;
  422 `validation-failed`.
- **Events emitted:** none; the prefix reaches the tax band through the
  next quote and every later estimate.
- **Idempotency:** `Idempotency-Key`.

## QuoteDelivery

- **Actor / trigger:** the shopper (or the BFF on their behalf), through
  `storefront-bff`.
- **Inbound adapter:** REST `POST /carts/{cartId}:quote-delivery`, header
  `Idempotency-Key` required.
- **Preconditions:** the cart is `OPEN` and a destination prefix is set.
- **Main flow:**
  1. `Idempotency-Key` lookup.
  2. Load `Cart` (404); `ErrNoDestination` without a prefix (422).
  3. Call `delivery-promise` `QuoteDeliveryOffers`
     (`REST POST /delivery-offers:quote`, the network's Open Host Service
     route for the `shopper / storefront` caller) with the cart's lines
     and the prefix — the cart's only synchronous call.
  4. `Cart.QuoteDelivery(quote, now)`: hold the groups with their lines,
     offers (`offerId`, tier, window, `expiresAt`) and the unavailable
     tiers, with their constraints. A quote holds no capacity.
  5. In one transaction: save (version-checked), outbox
     `CartDeliveryQuoted`, store the key response.
  6. Answer `200` with the cart, its quote and the labelled estimate.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrNoDestination` | 422 | `no-destination` | Set a destination first. |
| `delivery-promise` unreachable or timed out | 503 | `delivery-promise-unavailable` | Lines and prefix are kept; retry with the same `Idempotency-Key`. |
| `ErrCartClosed` | 409 | `cart-closed` | |
| version conflict | 409 | `concurrent-update` | |

- **Events emitted:** `CartDeliveryQuoted` (analytics).
- **Idempotency:** `Idempotency-Key`.

## SelectDelivery

- **Actor / trigger:** the shopper, through `storefront-bff`.
- **Inbound adapter:** REST `POST /carts/{cartId}:select-delivery`, header
  `Idempotency-Key` required.
- **Input:** `groupNo`, `offerId`.
- **Preconditions:** the cart is `OPEN` and holds a current quote.
- **Main flow:** load the cart (404), record the selection
  (`groupNo` to `offerId`) — the offer must belong to the current quote
  (`ErrStaleDeliverySelection`); after every group is selected and no
  offer has expired, `CheckoutReadiness` holds. Save (version-checked),
  one transaction.
- **Errors:** 404 `not-found`; 409 `stale-delivery-selection` /
  `cart-closed` / `concurrent-update`; 422 `validation-failed`.
- **Events emitted:** none (hotspot H1).
- **Idempotency:** `Idempotency-Key`; re-selecting the same offer replays
  the stored response.
- **Note:** expiry is a fact about the clock, not a stored flag —
  readiness compares each `QuotedOffer`'s `expiresAt`, and checkout
  re-checks with `ErrCartNotCheckoutReady` at session open.

## MergeInto

- **Actor / trigger:** the shopper at the sign-in moment (D4): the BFF
  merges the guest cart into the shopper's open cart.
- **Inbound adapter:** REST `POST /carts/{cartId}:merge-into`, header
  `Idempotency-Key` required.
- **Input:** `targetCartId`.
- **Preconditions:** the target is an `OPEN` cart of the same shopper,
  never the cart itself (`ErrMergeTarget`).
- **Main flow:** load both carts and versions (404), take the source's
  lines into the target, merging quantities, clear the target's quote and
  selections (its lines changed), mark the source `MERGED`; both saves in
  one transaction, both version-checked.
- **Errors:** 404 `not-found`; 409 `cart-closed` / `concurrent-update`;
  422 `merge-target` / `validation-failed`.
- **Events emitted:** none (hotspot H1 — analytics never sees a merge).
- **Idempotency:** `Idempotency-Key`; the source is terminal after the
  merge (`ErrCartClosed` on any later change).

## AbandonInactive (clock)

- **Actor / trigger:** the clock; policy `AbandonInactive` — an `OPEN`
  cart with no change for 30 days.
- **Inbound adapter:** an internal scheduler scanning
  `last_changed_at`.
- **Main flow:** per idle cart, `Cart.AbandonInactive(now)`:
  `OPEN → ABANDONED`; save (version-checked), outbox `CartAbandoned`
  (carrying `lastChangedAt`), one transaction.
- **Errors:** none reach a caller.
- **Events emitted:** `CartAbandoned` (analytics).
- **Idempotency:** the scan selects `OPEN` carts only, so a second sweep
  finds nothing; the model's size estimate says abandoned carts are purged
  afterwards, but names no purge (hotspot H5).

## CloseOnCheckoutCompleted (Kafka)

- **Actor / trigger:** `checkout` completed the purchase.
- **Inbound adapter:** Kafka consumer on
  `retailnetwork.checkout.events`, type
  `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutCompleted`,
  consumer group `shopping-cart.checkout`.
- **Main flow:**
  1. Inbox check on the CloudEvents `id`; a duplicate is acknowledged.
  2. Load `Cart` by the event's `cartId` (the upstream key is
     `sessionId`, so the cart never relies on the partition for order).
  3. `Cart.CloseOnCheckoutCompleted(sessionId, now)`:
     `OPEN → CHECKED_OUT`; outbox `CartCheckedOut` (carrying
     `checkoutSessionId`), inbox row, one transaction.
  4. A cart that is not `OPEN` has no transition: the inbox row is still
     written and the case is logged as an anomaly (`ErrCartClosed`).
- **Errors:** none reach a caller.
- **Events emitted:** `CartCheckedOut` (analytics).
- **Idempotency:** inbox on the CloudEvents `id`.

## Project PurchasabilityView and EstimateView (Kafka)

- **Actor / trigger:** `offer-availability` and `pricing` events.
- **Inbound adapter:** Kafka consumers on
  `retailnetwork.offer-availability.events`
  (`CatalogItemCreated`, `CatalogItemDiscontinued`; group
  `shopping-cart.offer-availability`) and `retailnetwork.pricing.events`
  (`ItemPriceChanged`, `ItemPriceWithdrawn`,
  `DeliveryChargeScheduleChanged`, `TaxTableChanged`; group
  `shopping-cart.pricing`).
- **Main flow:** inbox check; upsert `rm_purchasability` /
  `rm_item_prices`, or replace `rm_current_schedule` /
  `rm_current_tax_table` with the version they carry; inbox row, one
  transaction. The `Cart` aggregate is never touched.
- **Errors:** none reach a caller.
- **Events emitted:** none.
- **Idempotency:** inbox on the CloudEvents `id`; per-item order comes
  from the producers' `catalogItemId` keying, and the schedule and table
  events carry the versions the views store.
