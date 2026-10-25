---
id: aggregate-design-canvas
title: Aggregate Design Canvas
sidebar_label: Aggregate Design Canvas
description: The ddd-crew Aggregate Design Canvas for Checkout's single aggregate, the CheckoutSession, with its eight states, five invariants, nine commands and the replayable stored placement request.
---

# Aggregate Design Canvas

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

Following the ddd-crew [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas).
The model has one aggregate root in this context, **CheckoutSession**, and no
read models (`read_models: []`). Proposed Go package: `internal/domain/session`
(the package the UL code identifiers name).

## CheckoutSession

### 1. Name

`CheckoutSession` (`session.CheckoutSession`), identified by `sessionId`.

### 2. Description

The purchase transaction from review to placed order. It holds the cart id
and version, the `shopperId`, the `shipToAddressId` (never the address), the
numbered lines and groups, the `priceQuoteId`, the totals and
`quoteExpiresAt`, the `authorizationId`, the stored placement request, the
`orderId`, the `requotedOffers` and a failure code. Value objects:

| Value object | Fields | Note |
| --- | --- | --- |
| `SessionLine` | `lineNo`, `catalogItemId`, `quantity` | The session numbers the cart's lines `1..n` when it opens (gap S1). |
| `SessionGroup` | `groupNo`, `offerId`, `tier`, `lineNos[]` | Groups follow the quote's `groupNo`; the REST contract adds `amountMinor`, the share of the authorization (the **Allocation**). |
| `RequotedOffer` | `offerId`, `groupNo`, `tier`, `deliverByEarliest`, `deliverByLatest`, `expiresAt` | One offer the network returned in a definitive `409`; present only in `REQUOTE_REQUIRED`. |

The **stored placement request** is part of the aggregate's state: the
PII-free body the Anti-Corruption Layer sends to `customer-ordering`, kept so
that `ResolveInDoubtPlacements` can re-send it byte for byte with the same
`Idempotency-Key`. The model names no value object for it (hotspot H9 on
[EventStorming](/storefront/contexts/checkout/eventstorming)).

### 3. State Transitions

```mermaid
stateDiagram-v2
    [*] --> OPEN: OpenSession
    OPEN --> AUTHORIZING: ConfirmSession
    OPEN --> EXPIRED: ExpireSession
    AUTHORIZING --> PLACING: RecordAuthorization
    AUTHORIZING --> DECLINED: RecordDecline
    DECLINED --> AUTHORIZING: ConfirmSession
    PLACING --> PLACING: RecordPlacementInDoubt
    PLACING --> COMPLETED: RecordPlaced
    PLACING --> REQUOTE_REQUIRED: RecordRequoteRequired
    PLACING --> FAILED: RecordFailure
    COMPLETED --> [*]
    EXPIRED --> [*]
    REQUOTE_REQUIRED --> [*]
    FAILED --> [*]
    note right of PLACING
        the semantic lock: no void and no
        new attempt while the place-order
        outcome is unknown
    end note
    note right of DECLINED
        another token may be tried
        while the price quote is valid
    end note
```

Derived from: `model.yaml → contexts[checkout].aggregates[CheckoutSession].states`,
`.transitions`, `.commands`, `.policies`.

The entry arrow `[*] --> OPEN` is the creating command `OpenSession`. Four
states are terminal: `COMPLETED`, `EXPIRED`, `REQUOTE_REQUIRED` and `FAILED`
(`ErrSessionClosed`). The only loops are `DECLINED → AUTHORIZING` (a new
token) and `PLACING → PLACING` (an in-doubt outcome that stays in doubt).
`DECLINED → EXPIRED` has no row, although `ExpireOnQuoteExpiry` says a
`DECLINED` session expires (hotspot H1).

### 4. Enforced Invariants

| Invariant | Enforced by |
| --- | --- |
| The cart's checkout readiness holds at session open | `OpenSession` → `ErrCartNotCheckoutReady` |
| The price quote is unexpired at confirm | `ConfirmSession` → `ErrPriceQuoteExpired` |
| No transition out of `COMPLETED`, `EXPIRED`, `FAILED` or `REQUOTE_REQUIRED` | all commands → `ErrSessionClosed` |
| The authorized amount equals the quote total | `RecordAuthorization` → `ErrAuthorizationMismatch` |
| No void and no new attempt while the place-order outcome is unknown (the semantic lock) | `ConfirmSession` and the void step in `PLACING` → `ErrPlacementInDoubt` |

Derived from: `model.yaml → contexts[checkout].aggregates[CheckoutSession].invariants`.
The mapping of an invariant to the command that raises it is read from the
REST contract (`409` on open: `cart-not-checkout-ready`; `409` on confirm:
`session-closed`, `price-quote-expired`, `authorization-mismatch`,
`placement-in-doubt`) and from the invariant text; the model itself pairs rule
and error but names no command.

### 5. Corrective Policies

| Policy | Owner | Rule | Effect on this aggregate |
| --- | --- | --- | --- |
| `ResolveInDoubtPlacements` | this context | Re-send the stored placement body with the same `Idempotency-Key` (`customer-ordering` replays the first response) with backoff until a definitive answer; alert at 20 h. | A `PLACING` session reaches `COMPLETED` (`RecordPlaced`), `REQUOTE_REQUIRED` (`RecordRequoteRequired`) or `FAILED` (`RecordFailure`), or stays `PLACING` (`RecordPlacementInDoubt`). |
| `ExpireOnQuoteExpiry` | this context | An `OPEN` or `DECLINED` session expires with its price quote. | `OPEN → EXPIRED` (`ExpireSession`); the `DECLINED` case has no transition (hotspot H1). |
| Idempotent writes | this context | Every write route takes an `Idempotency-Key`; a repeated key returns the stored response of the first call. | A repeated `ConfirmSession` with the same key does not authorize twice. |
| Deterministic downstream keys | this context | `<sessionId>:auth` on authorize, `<sessionId>:void` on void, the `sessionId` on place-order. | No two holds on a card for one session; a replayed place-order is answered with the first response. |

### 6. Handled Commands

| Command | Trigger | Transition |
| --- | --- | --- |
| `OpenSession` | Shopper via BFF, REST `POST /checkout-sessions` (reads the cart, pre-checks offers, issues the `PriceQuote`) | `[*] → OPEN` |
| `ConfirmSession` | Shopper via BFF, REST `POST /checkout-sessions/{sessionId}:confirm` | `OPEN → AUTHORIZING`; `DECLINED → AUTHORIZING` |
| `RecordAuthorization` | the answer to `AuthorizePayment` (authorized) | `AUTHORIZING → PLACING` |
| `RecordDecline` | the answer to `AuthorizePayment` (declined) | `AUTHORIZING → DECLINED` |
| `RecordPlacementInDoubt` | `PlaceOrder` timed out or answered `503`; also each unsuccessful pass of `ResolveInDoubtPlacements` | `PLACING → PLACING` |
| `RecordPlaced` | `PlaceOrder` succeeded (first call or replay) | `PLACING → COMPLETED` |
| `RecordRequoteRequired` | `PlaceOrder` answered a definitive `409` with re-quoted offers, after a successful void | `PLACING → REQUOTE_REQUIRED` |
| `RecordFailure` | `PlaceOrder` answered `422` (a contract bug), after a void | `PLACING → FAILED` |
| `ExpireSession` | the `ExpireOnQuoteExpiry` policy (clock, quote expiry) | `OPEN → EXPIRED` |

`GetSession` (REST `GET /checkout-sessions/{sessionId}`) is a query and
changes nothing. The seven `Record...` and `Expire` commands have no inbound
route; they are applied by the use cases that make the outbound call.

### 7. Created Events

| Event | Raised when | Full CloudEvents type |
| --- | --- | --- |
| `CheckoutOpened` | `OpenSession` is saved | `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutOpened` |
| `CheckoutDeclined` | `RecordDecline` is saved | `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutDeclined` |
| `CheckoutCompleted` | `RecordPlaced` is saved | `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutCompleted` |
| `CheckoutRequoteRequired` | `RecordRequoteRequired` is saved | `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutRequoteRequired` |
| `CheckoutFailed` | `RecordFailure` is saved | `com.retailnetwork.storefront.checkout.checkoutsession.CheckoutFailed` |

`CheckoutCompleted` goes to `retailnetwork.checkout.events` (the cart and
`customer-payments` consume it); the other four are analytics-only (topic
`retailnetwork.checkout.analytics`). `ConfirmSession`, `RecordAuthorization`,
`RecordPlacementInDoubt` and `ExpireSession` raise nothing (hotspot H7). The
pairing of event to command is read from the event names and data; the model
lists the events on the aggregate without naming the raising command. Events
leave through the transactional outbox in the same transaction as the save.

### 8. Throughput

*Estimate.* The model says "medium: one session per purchase attempt".
Contention is per session: a double click or a polling BFF meets the same
`version` column, and the `Idempotency-Key` makes a retry harmless.

### 9. Size

*Estimate.* The model says "one row per session; placement request retained
for the idempotency window". One root row with its lines, groups and
requoted offers; the stored placement request is the one field that is
deliberately kept for the network's idempotency window and then no longer
needed. The purge is unnamed (hotspot H9).

## Read models

The model lists none for this context. Checkout takes the cart, the offers,
the quote and the authorization by synchronous call at the moment it needs
them, and reads no event.
