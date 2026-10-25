---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: Process-level EventStorming boards for Checkout, covering opening a session, authorize and place, the three definitive failures, in-doubt resolution and expiry, with hotspots taken only from gaps and risks in the model.
---

# EventStorming

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

Process-level boards in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky comes from `model.yaml`. Events published by a
neighbour are drawn as orange stickies prefixed with the producer. Every
hotspot is a gap or a risk the model itself shows, and its source is given
in the hotspot table. Boards are drawn top to bottom; each stays within the page width.

## Legend

| Colour | Sticky | Meaning here |
| --- | --- | --- |
| Pale yellow `#fff59d` | Actor | The shopper (through the BFF), the clock |
| Blue `#a5d8ff` | Command | A command from `aggregates[CheckoutSession].commands` |
| Yellow `#ffec99` | Aggregate | The `CheckoutSession` aggregate and its state |
| Orange `#ffc078` | Domain Event | Ours (`publishes`) or a neighbour's (prefixed with the producer) |
| Lilac `#d0bfff` | Policy | `policies`, or the reaction a neighbour takes to an event |
| Pink `#fcc2d7` | External System | A sibling context or the network (`shopping-cart`, `pricing`, `customer-payments`, `delivery-promise`, `customer-ordering`, analytics) |
| Red `#ff8787` | Hotspot | A gap or risk in the model (see the table at the end) |

## 1. Opening a session

```mermaid
flowchart TB
    S["Shopper<br/>via storefront-bff"]:::actor
    C0["OpenSession<br/>POST /checkout-sessions"]:::command
    SC["shopping-cart"]:::external
    DP["delivery-promise<br/>(network)"]:::external
    PR["pricing"]:::external
    G1["CheckoutSession<br/>OPEN"]:::aggregate
    E1["CheckoutOpened"]:::event
    AN(["analytics"]):::actor
    H3["H3 an offer no longer<br/>QUOTED at the pre-check<br/>has no outcome"]:::hotspot

    S --> C0
    C0 -->|"qry GetCart,<br/>ErrCartNotCheckoutReady"| SC
    C0 -->|"qry GetDeliveryOffer<br/>per selected offer"| DP
    C0 -->|"cmd IssuePriceQuote"| PR
    SC --> G1
    DP --> G1
    PR -->|"binding quote,<br/>lines 1..n, groups"| G1
    G1 --> E1
    E1 --> AN
    DP --- H3

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[checkout].inbound` (BFF cmd row),
`.sync_calls` (`GetCart`, `GetDeliveryOffer`, `IssuePriceQuote`),
`.aggregates[CheckoutSession].invariants` (`ErrCartNotCheckoutReady`),
`.publishes[CheckoutOpened]`; gap S1 and S2 on the
[Model Gap Register](/storefront/strategic-design/model-gap-register).

Omitted: the `503` when a dependency is unreachable, and the outbox. The
price quote is binding and expiring; its expiry becomes the session's
`quoteExpiresAt`, the clock for board 6.

## 2. Authorize, then place the order

```mermaid
flowchart TB
    S["Shopper<br/>via storefront-bff"]:::actor
    C1["ConfirmSession<br/>POST ...:confirm<br/>ErrPriceQuoteExpired"]:::command
    G1["CheckoutSession<br/>OPEN to AUTHORIZING"]:::aggregate
    CP["customer-payments"]:::external
    C2["RecordAuthorization<br/>ErrAuthorizationMismatch"]:::command
    G2["CheckoutSession<br/>PLACING<br/>placement request stored"]:::aggregate
    CO["customer-ordering<br/>(network, via the ACL)"]:::external
    C3["RecordPlaced"]:::command
    G3["CheckoutSession<br/>COMPLETED"]:::aggregate
    E1["CheckoutCompleted"]:::event
    P1["shopping-cart<br/>CloseOnCheckoutCompleted"]:::policy
    P2["customer-payments<br/>BindOrderOnCheckoutCompleted"]:::policy
    H4["H4 AUTHORIZING has no exit<br/>if the authorize outcome<br/>is unknown"]:::hotspot

    S --> C1
    C1 --> G1
    G1 -->|"cmd AuthorizePayment<br/>key sessionId:auth"| CP
    CP -->|authorized| C2
    C2 --> G2
    G2 -->|"cmd PlaceOrder<br/>key sessionId"| CO
    CO -->|"order accepted"| C3
    C3 --> G3
    G3 --> E1
    E1 --> P1
    E1 --> P2
    G1 --- H4

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[checkout].aggregates[CheckoutSession]`
(`transitions`, `invariants`, `commands`), `.sync_calls`
(`AuthorizePayment`, `PlaceOrder`), `.publishes[CheckoutCompleted]`;
`contexts[customer-payments].policies[BindOrderOnCheckoutCompleted]`;
`contexts[shopping-cart].policies[CloseOnCheckoutCompleted]`.

Omitted: the failure paths (boards 3 and 4), the in-doubt branch (board 5) and
the outbox. The money flow (D5) continues outside this context: capture on
`FulfillmentShipped`, release on `FulfillmentCancelled`, refund on
`PackageLost` or `PackageReturned` all belong to `customer-payments`.

## 3. A decline

```mermaid
flowchart TB
    A1["CheckoutSession<br/>AUTHORIZING"]:::aggregate
    CP["customer-payments"]:::external
    C4["RecordDecline"]:::command
    D1["CheckoutSession<br/>DECLINED<br/>another token allowed"]:::aggregate
    E2["CheckoutDeclined<br/>analytics only"]:::event
    H1["H1 no DECLINED to EXPIRED<br/>transition in the model"]:::hotspot
    H2["H2 a second authorize<br/>may replay the decline<br/>under the same key"]:::hotspot

    A1 -->|"cmd AuthorizePayment:<br/>declined"| CP
    CP --> C4
    C4 --> D1
    D1 --> E2
    D1 -->|"ConfirmSession again"| A1
    D1 --- H1
    A1 --- H2

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[checkout].business_decisions` (decline
bullet), `.aggregates[CheckoutSession].transitions` (`RecordDecline`,
`DECLINED → AUTHORIZING`), `.publishes[CheckoutDeclined]`;
`contexts[customer-payments].publishes[PaymentDeclined]`.

A decline voids nothing: no authorization exists. The session stays open for
as long as the price quote is valid.

## 4. Requote and contract failure

```mermaid
flowchart TB
    PL["CheckoutSession<br/>PLACING"]:::aggregate
    CO["customer-ordering<br/>(via the ACL)"]:::external
    V["VoidAuthorization<br/>key sessionId:void"]:::command
    C5["RecordRequoteRequired"]:::command
    G4["REQUOTE_REQUIRED<br/>requotedOffers"]:::aggregate
    E3["CheckoutRequoteRequired"]:::event
    C6["RecordFailure<br/>and an alert"]:::command
    G5["FAILED<br/>failure code"]:::aggregate
    E4["CheckoutFailed"]:::event
    H5["H5 a failed void has<br/>no defined outcome"]:::hotspot

    PL -->|"cmd PlaceOrder"| CO
    CO -->|"definitive 409<br/>or 422"| V
    V -->|"after 409"| C5
    V -->|"after 422"| C6
    C5 --> G4
    G4 --> E3
    C6 --> G5
    G5 --> E4
    V --- H5

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[checkout].business_decisions` (409 and
422 bullets), `.aggregates[CheckoutSession].transitions`,
`.sync_calls[VoidAuthorization]` ("only after a definitive rejection"),
`.publishes` (`CheckoutRequoteRequired`, `CheckoutFailed`), `.ul[Requote]`;
`contexts[customer-payments].inbound` (`VoidAuthorization`).

Both definitive rejections void first, then record. Both events are
analytics-only. Omitted: the shopper's next attempt after `REQUOTE_REQUIRED`,
which starts from the cart with a new session (hotspot H10 on how the cart
takes the requoted offers).

## 5. In-doubt placement

```mermaid
flowchart TB
    PL["CheckoutSession<br/>PLACING"]:::aggregate
    CO["customer-ordering<br/>(via the ACL)"]:::external
    C7["RecordPlacementInDoubt<br/>timeout or 503"]:::command
    LOCK["PLACING stays PLACING<br/>semantic lock, reply 202"]:::aggregate
    P1["ResolveInDoubtPlacements<br/>same body and key,<br/>alert at 20 h"]:::policy
    R1["RecordPlaced"]:::command
    R2["RecordRequoteRequired<br/>or RecordFailure"]:::command
    E1["CheckoutCompleted"]:::event
    H6["H6 resolver vs the 24 h<br/>VoidUnboundAuthorizations"]:::hotspot
    H7["H7 no event for<br/>an in-doubt placement"]:::hotspot

    PL -->|"cmd PlaceOrder"| CO
    CO -->|"no definitive answer"| C7
    C7 --> LOCK
    LOCK --> P1
    P1 -->|"replay"| CO
    CO -->|"order accepted"| R1
    CO -->|"409 or 422, then board 4"| R2
    R1 --> E1
    C7 --- H7
    H7 --- H6

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[checkout].policies[ResolveInDoubtPlacements]`,
`.business_decisions` (503 or timeout bullet), `.aggregates[CheckoutSession]`
(`RecordPlacementInDoubt`, `ErrPlacementInDoubt`), `.ul[In-Doubt Placement]`;
`contexts[customer-payments].policies[VoidUnboundAuthorizations]`.

The lock is a business state: a restart does not release it, and the
resolver runs from the stored request. The alert at 20 h comes before the
network's 24 h idempotency window, after which a replay could no longer be
answered with the first response.

## 6. Expiry and terminal states

```mermaid
flowchart TB
    T(["Clock<br/>quote expiry"]):::actor
    P1["ExpireOnQuoteExpiry<br/>OPEN or DECLINED"]:::policy
    C8["ExpireSession"]:::command
    G1["CheckoutSession<br/>EXPIRED"]:::aggregate
    G2["COMPLETED, EXPIRED,<br/>FAILED, REQUOTE_REQUIRED<br/>terminal: ErrSessionClosed"]:::aggregate
    H1["H1 no DECLINED to EXPIRED<br/>transition in the model"]:::hotspot
    H7["H7 ExpireSession<br/>raises no event"]:::hotspot

    T --> P1
    P1 --> C8
    C8 --> G1
    G1 --> G2
    P1 --- H1
    C8 --- H7

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[checkout].policies[ExpireOnQuoteExpiry]`,
`.aggregates[CheckoutSession]` (`states`, `transitions`,
`ErrSessionClosed`).

Omitted: the same-shaped `COMPLETED`, `FAILED` and `REQUOTE_REQUIRED`
terminals, drawn on boards 2 and 4. A session in `AUTHORIZING` or `PLACING`
is not touched by this policy: only an `OPEN` or `DECLINED` session expires
with its quote.

## Hotspots

| # | Hotspot | Where it comes from in the model |
| --- | --- | --- |
| H1 | `ExpireOnQuoteExpiry` says an `OPEN` or `DECLINED` session expires, but the transition list holds only `OPEN → EXPIRED`; a `DECLINED` session has no way to `EXPIRED`, and `ErrSessionClosed` does not list `DECLINED` as terminal. | `policies[ExpireOnQuoteExpiry]` vs `aggregates[CheckoutSession].transitions` |
| H2 | `AuthorizePayment` is keyed `<sessionId>:auth`, and a decline returns the session to `AUTHORIZING` for another token. If the second attempt reuses the key, `customer-payments` replays the first, declined answer; the model does not say how the key changes per attempt. | `sync_calls[AuthorizePayment]` (note), `transitions` (`DECLINED → AUTHORIZING`), `customer-payments` `ErrDuplicateAuthorization` |
| H3 | The pre-check that every selected offer is still `QUOTED` (and the `ErrCartNotCheckoutReady` check) happens before anything is authorized, but `REQUOTE_REQUIRED` is reachable only from `PLACING`. The model has no state or error for an offer that fails the pre-check. | `sync_calls[GetDeliveryOffer]` (note) vs `transitions`, `invariants` |
| H4 | No transition leaves `AUTHORIZING` for an unknown authorize outcome (timeout); only `customer-payments`' `VoidUnboundAuthorizations` (no `CheckoutCompleted` after 24 h) covers a crash after authorize, and nothing moves the session. | `transitions`, `contexts[customer-payments].policies` |
| H5 | `REQUOTE_REQUIRED` and `FAILED` follow a successful void (REST contract), but `VoidAuthorization` is a call, not a session command, and no state, error or retry covers a void that fails (or the void an `ErrAuthorizationMismatch` would call for). | `sync_calls[VoidAuthorization]`, `storefront/apis/checkout/openapi.yaml` |
| H6 | The resolver may still be replaying near 24 h, the instant `customer-payments`' `VoidUnboundAuthorizations` voids an authorization with no `CheckoutCompleted`; the 20 h alert is the only margin. | `policies[ResolveInDoubtPlacements]` vs `contexts[customer-payments].policies[VoidUnboundAuthorizations]` |
| H7 | `ExpireSession` and `RecordPlacementInDoubt` (and `ConfirmSession`, `RecordAuthorization`) raise no event, so analytics sees opens, declines, requotes and failures but never an expiry or an in-doubt placement. | `aggregates[CheckoutSession].commands` vs `publishes` |
| H8 | `shipToAddressId` (NG1), `offer-not-quotable` and `requotedOffers` are named by the storefront model, but the network model does not yet carry them; they are "once built" prerequisites the ACL depends on. | `sync_calls[PlaceOrder]`, `business_decisions`, `meta.hard_boundary` vs `network/model/model.yaml → contexts[customer-ordering]` |
| H9 | The stored placement request is central (replay byte for byte, "retained for the idempotency window") but has no value object, field name, shape or purge in the model. | `purpose`, `aggregates[CheckoutSession].description`, `.size_estimate` |
| H10 | The REST contract says the BFF writes `requotedOffers` into the cart as a new quote, but the cart's commands quote only through `delivery-promise` (`QuoteDelivery`); none accepts an offer set from outside. | `storefront/apis/checkout/openapi.yaml` (`CheckoutSession.requotedOffers`) vs `contexts[shopping-cart].aggregates[Cart].commands` |
