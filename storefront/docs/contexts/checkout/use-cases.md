---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: Every proposed Checkout command use case with its actor or trigger, inbound adapter, preconditions, main flow, error mapping, events and idempotency, including the in-doubt resolver policy.
---

# Use Cases

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `checkout` service is built on develop ([`IQVO/checkout`](https://github.com/IQVO/checkout) at `ab4f0e9`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/checkout#service-and-operations) section lists it.
:::

One section per command of
`contexts[checkout].aggregates[CheckoutSession].commands`, plus the
`ResolveInDoubtPlacements`, `ResolveStuckAuthorizations` and `RetryOwedVoids`
policies. They are proposed application services in
`internal/application/usecases`. The step-by-step diagrams are on
[Sequence Diagrams](/storefront/contexts/checkout/sequence-diagrams); the
payloads are on [Domain Events](/storefront/contexts/checkout/domain-events);
the REST contract is `storefront/apis/checkout/openapi.yaml`.

Only `OpenSession` and `ConfirmSession` have a route. The seven `Record...`
and `Expire` commands are what the application service applies to the
aggregate after an outbound call has answered, so they are described as the
steps of the use case that drives them, and also once each below.

Reads are not use cases here: `GET /checkout-sessions/{sessionId}`
(`GetSession`) reads the repository directly. While a session is `PLACING`
after an in-doubt placement it is the endpoint the BFF polls.

## Triggers at a glance

| Use case | Trigger | Inbound adapter | Emits |
| --- | --- | --- | --- |
| `OpenSession` | Shopper via `storefront-bff` | REST `POST /checkout-sessions` | `CheckoutOpened` |
| `ConfirmSession` | Shopper via `storefront-bff` | REST `POST /checkout-sessions/{sessionId}:confirm` | the outcome's event (see below) |
| `RecordAuthorization` | The answer to `AuthorizePayment` | inside `ConfirmSession` | none |
| `RecordDecline` | The answer to `AuthorizePayment` | inside `ConfirmSession` | `CheckoutDeclined` |
| `RecordPlacementInDoubt` | `PlaceOrder` timed out or answered `503` | inside `ConfirmSession` or `ResolveInDoubtPlacements` | `CheckoutPlacementInDoubt` |
| `RecordPlaced` | `PlaceOrder` succeeded | inside `ConfirmSession` or `ResolveInDoubtPlacements` | `CheckoutCompleted` |
| `RecordRequoteRequired` | `PlaceOrder` answered a definitive `409`; sets `voidOwed` | inside `ConfirmSession` or `ResolveInDoubtPlacements` | `CheckoutRequoteRequired` |
| `RecordFailure` | `PlaceOrder` answered `422`; sets `voidOwed` | inside `ConfirmSession` or `ResolveInDoubtPlacements` | `CheckoutFailed` |
| `ExpireSession` | Clock, policy `ExpireOnQuoteExpiry` | scheduler | `CheckoutSessionExpired` |
| `ResolveInDoubtPlacements` | Clock, policy (backoff, alert at 20 h, give up and void at 22 h) | scheduler | as the `Record...` it ends in |
| `ResolveStuckAuthorizations` | Clock, policy (`AUTHORIZING` over 2 minutes) | scheduler | as the `Record...` it ends in |
| `RetryOwedVoids` | Clock, policy (every minute) | scheduler | none |

## How save and publish commit

Every use case that changes the session loads it with its `version`, calls the
aggregate, then saves it inside one Postgres transaction. The save is
conditional on the version it loaded (`UPDATE ... WHERE version = ?`); a
conflict is retried once inside the use case, then surfaces as 409
`concurrent-update`. If an event is raised, the outbox row (`outbox_events`)
is written in the same transaction. A relay publishes outbox rows to
`retailnetwork.checkout.events` (`CheckoutCompleted`) and
`retailnetwork.checkout.analytics` (the other six) after the commit.

**An outbound call is never inside a database transaction.** The use cases
save the state they are about to act from (`AUTHORIZING`, `PLACING` with the
stored request), call out, then save the outcome. That is why a crash between
the two leaves a session a resolver can find: `PLACING` with a stored request.

Error responses use `application/problem+json` (RFC 9457) with `type`
`/problems/<slug>` per `conventions.integration_rules`: not-found 404,
illegal-transition 409, concurrent-update 409, validation-failed 422, plus
one kebab-case slug per `Err` in the model. Every write route takes an
`Idempotency-Key` header, minted by the BFF.

## OpenSession

- **Actor / trigger:** the shopper, through `storefront-bff`.
- **Inbound adapter:** REST `POST /checkout-sessions`, header
  `Idempotency-Key` required.
- **Input:** `cartId`, `shopperId`, `shipToAddressId` (a reference to a saved
  address in `customer-ordering` (NG1), never the address).
- **Preconditions:** the cart's checkout readiness holds; every selected
  offer is still `QUOTED`, with margin.
- **Main flow:**
  1. `Idempotency-Key` lookup; replay the stored response on a hit.
  2. `GetCart` (`shopping-cart`): the cart snapshot, its version, groups,
     selections and readiness.
  3. Fail fast: if the snapshot's checkout readiness does not hold, answer
     `ErrCartNotCheckoutReady` before calling anyone else (the aggregate
     enforces the same invariant in step 6).
  4. `GetDeliveryOffer` (`delivery-promise`) for each selected offer: still
     `QUOTED`, with margin; a failure here is `ErrOfferNotQuotable` (the same
     check is repeated before authorize at confirm).
  5. `IssuePriceQuote` (`pricing`): the binding `PriceQuote`; the session
     records `priceQuoteId`, `currency`, `totalMinor` and `quoteExpiresAt`.
  6. `CheckoutSession.OpenSession(cart, quote, now)`: `ErrCartNotCheckoutReady`
     unless the readiness holds; lines numbered `1..n`, groups by the quote's
     `groupNo` (gap S1). In one transaction: insert the session `OPEN`,
     outbox `CheckoutOpened`, store the key response.
  7. Answer `201` with the session and its binding total.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrCartNotCheckoutReady` | 409 | `cart-not-checkout-ready` | A group is unselected or an offer expired. |
| dependency unreachable | 503 | (`503`) | `shopping-cart`, `delivery-promise` or `pricing`; the shopper retries with the same `Idempotency-Key`. |
| invalid input | 422 | `validation-failed` | A missing `cartId`, `shopperId` or `shipToAddressId`. |
| version conflict | 409 | `concurrent-update` | Retried once inside the use case. |

- **Events emitted:** `CheckoutOpened` (analytics).
- **Idempotency:** `Idempotency-Key`; the BFF mints one per open.

## ConfirmSession

- **Actor / trigger:** the shopper, through `storefront-bff`.
- **Inbound adapter:** REST `POST /checkout-sessions/{sessionId}:confirm`,
  header `Idempotency-Key` required.
- **Input:** `paymentMethodToken`, the PSP token from the hosted fields,
  never a card number.
- **Preconditions:** the session is `OPEN` or `DECLINED`; the price quote is
  unexpired.
- **Main flow:**
  1. `Idempotency-Key` lookup; replay the stored response on a hit.
  2. Load `CheckoutSession` (404 `not-found`).
  3. `GetDeliveryOffer` (`delivery-promise`) for each selected offer, before
     anything is authorized: still `QUOTED`, with margin. A failure is
     `ErrOfferNotQuotable` (`422`), with no state change; the BFF refreshes
     the cart quote.
  4. `ConfirmSession(now)`: `ErrSessionClosed` on a terminal state,
     `ErrPlacementInDoubt` while `PLACING`, `ErrPriceQuoteExpired` past
     `quoteExpiresAt`; `OPEN` or `DECLINED` becomes `AUTHORIZING` (from
     `DECLINED`, `authAttempt` is incremented). Save.
  5. `AuthorizePayment` (`customer-payments`), key
     `<sessionId>:auth:<authAttempt>`, allocations per group. Declined:
     `RecordDecline`, answer `200` `DECLINED`. Authorized: continue.
  6. `RecordAuthorization(authorizationId, totalMinor)`: `ErrAuthorizationMismatch`
     unless the authorized amount equals the quote total (then `voidOwed` is
     set with the decision to void); `AUTHORIZING`
     becomes `PLACING`, and the PII-free placement request is stored in the
     same save.
  7. `PlaceOrder` (`customer-ordering`) through the Anti-Corruption Layer,
     `Idempotency-Key` the `sessionId`, `shipToAddressId` never an inline
     address.
  8. Map the answer: success to `RecordPlaced` (`COMPLETED`, answer `200`);
     definitive `409` to `RecordRequoteRequired` (answer `200`
     `REQUOTE_REQUIRED` with `requotedOffers`); `422` to `RecordFailure` and
     an alert (answer `200` `FAILED`); timeout or `503` to
     `RecordPlacementInDoubt` (answer `202`, the session stays `PLACING`).
     For `409` and `422` the decision and `voidOwed` are saved in one
     transaction, the void is then attempted at once, and `RetryOwedVoids`
     retries it if it fails.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrSessionClosed` | 409 | `session-closed` | `COMPLETED`, `EXPIRED`, `FAILED` or `REQUOTE_REQUIRED`; `DECLINED` is not closed. |
| `ErrPriceQuoteExpired` | 409 | `price-quote-expired` | Checked at confirm; the session is `OPEN` or `DECLINED`. |
| `ErrOfferNotQuotable` | 422 | `offer-not-quotable` | A selected offer is no longer `QUOTED` at the pre-authorize check; no state change. |
| `ErrAuthorizationMismatch` | 409 | `authorization-mismatch` | The authorized amount is not the quote total; the authorization is voided (`voidOwed`). |
| `ErrPlacementInDoubt` | 409 | `placement-in-doubt` | A confirm or a void while `PLACING`: the semantic lock. |
| session not found | 404 | `not-found` | |
| invalid input | 422 | `validation-failed` | A missing `paymentMethodToken`. |
| version conflict | 409 | `concurrent-update` | Retried once inside the use case. |

- **Events emitted:** the event of the outcome: `CheckoutDeclined`,
  `CheckoutCompleted`, `CheckoutRequoteRequired` or `CheckoutFailed`; none
  for an in-doubt answer.
- **Idempotency:** `Idempotency-Key`, plus the deterministic downstream keys
  `<sessionId>:auth:<authAttempt>`, the `sessionId` and `<sessionId>:void`.
  A repeated confirm returns the stored first response; a second authorize
  after a decline is a new attempt (`authAttempt` + 1), so it is not answered
  with the first, declined response, while a stuck call replays the same key.

## RecordAuthorization

- **Trigger:** the authorized answer to `AuthorizePayment`, inside
  `ConfirmSession`.
- **Main flow:** `AUTHORIZING → PLACING`; store `authorizationId` and the
  placement request; save. `ErrAuthorizationMismatch` if the authorized amount
  is not the quote total; the authorization is then voided: `voidOwed` is set
  in the same save and `RetryOwedVoids` retries the void until it succeeds.
- **Events emitted:** none.
- **Idempotency:** the transition is taken once; a replayed answer finds the
  session already `PLACING`.

## RecordDecline

- **Trigger:** the declined answer to `AuthorizePayment`.
- **Main flow:** `AUTHORIZING → DECLINED`; store the reason; save. The session
  stays open for another token while the price quote is valid; the next
  `ConfirmSession` increments `authAttempt`, and `ExpireOnQuoteExpiry` can
  take it to `EXPIRED`.
- **Events emitted:** `CheckoutDeclined` (analytics).
- **Idempotency:** a replayed confirm returns the stored response.

## RecordPlacementInDoubt

- **Trigger:** `PlaceOrder` timed out or answered `503`; also each pass of
  `ResolveInDoubtPlacements` that still gets no definitive answer.
- **Main flow:** `PLACING → PLACING`. No void and no new attempt: the
  semantic lock. The session answers `202`.
- **Events emitted:** `CheckoutPlacementInDoubt` (analytics; carries
  `placingSince`).
- **Idempotency:** recorded as often as it happens; it changes nothing.

## RecordPlaced

- **Trigger:** `PlaceOrder` succeeded: the first call, or a replay answered
  with the first response.
- **Main flow:** store `orderId`; `PLACING → COMPLETED`; save.
- **Events emitted:** `CheckoutCompleted` (`retailnetwork.checkout.events`),
  consumed by `shopping-cart` and `customer-payments`.
- **Idempotency:** `COMPLETED` has no transition out (`ErrSessionClosed`); the
  event is written once.

## RecordRequoteRequired

- **Trigger:** `PlaceOrder` answered a definitive `409` carrying re-quoted
  offers.
- **Main flow:** store `requotedOffers` and set `voidOwed` to the
  `authorizationId`; `PLACING → REQUOTE_REQUIRED`; save. The void
  (`<sessionId>:void`) is attempted at once and retried by `RetryOwedVoids`.
- **Events emitted:** `CheckoutRequoteRequired` (analytics).
- **Idempotency:** terminal; the void is keyed `<sessionId>:void`.

## RecordFailure

- **Trigger:** `PlaceOrder` answered `422`, a contract bug.
- **Main flow:** store the failure code, set `voidOwed`, raise an alert;
  `PLACING → FAILED`; save. The void is attempted at once and retried by
  `RetryOwedVoids`.
- **Events emitted:** `CheckoutFailed` (analytics).
- **Idempotency:** terminal; the void is keyed `<sessionId>:void`.

## ExpireSession

- **Trigger:** the `ExpireOnQuoteExpiry` policy: an `OPEN` or `DECLINED`
  session expires with its price quote.
- **Inbound adapter:** a scheduler, no route.
- **Main flow:** `OPEN → EXPIRED` or `DECLINED → EXPIRED`; save.
- **Events emitted:** `CheckoutSessionExpired` (analytics).
- **Idempotency:** `EXPIRED` has no transition out.

## ResolveInDoubtPlacements (policy)

- **Trigger:** a scheduler, for every session in `PLACING`.
- **Main flow:**
  1. Load the session and its stored placement request.
  2. Re-send the stored body to `customer-ordering` through the
     Anti-Corruption Layer with the same `Idempotency-Key` (the `sessionId`);
     `customer-ordering` replays its first response.
  3. Apply the answer as in `ConfirmSession` step 7: `RecordPlaced`, or a void
     then `RecordRequoteRequired` or `RecordFailure`, or
     `RecordPlacementInDoubt` again.
  4. Back off between passes; alert at 20 h (from `placingSince`); give up and
     void at 22 h, before `customer-payments`' 24 h backstop and the
     network's 24 h idempotency window.
- **Errors:** none surfaced to a shopper; the BFF polls `GetSession`.
- **Idempotency:** the same body and the same key on every pass, so a pass that
  raced a slow first call cannot place a second order. The interplay with
  `customer-payments`' 24 h void of an unbound authorization is ordered:
  alert at 20 h, give up and void at 22 h, backstop at 24 h. `Void` is
  idempotent, so a race between the two is harmless.

## ResolveStuckAuthorizations (policy)

- **Trigger:** a scheduler, for every session in `AUTHORIZING` for more than
  2 minutes (a crash or timeout between the save and the answer).
- **Main flow:** re-call `AuthorizePayment` with the SAME key
  `<sessionId>:auth:<authAttempt>`; it is idempotent and yields the true
  outcome. Apply it as in `ConfirmSession`: `RecordAuthorization` or
  `RecordDecline`.
- **Errors:** none surfaced to a shopper; the BFF polls `GetSession`.
- **Idempotency:** the same key on every pass. `customer-payments`' 24 h void
  stays the backstop.

## RetryOwedVoids (policy)

- **Trigger:** a scheduler, every minute, for every session with `voidOwed`.
- **Main flow:** void the authorization named by `voidOwed`
  (`<sessionId>:void`); on success clear `voidOwed`. Covers the
  `ErrAuthorizationMismatch` void and every definitive-rejection void.
- **Errors:** none surfaced; retried until success.
- **Idempotency:** `Void` is idempotent.
