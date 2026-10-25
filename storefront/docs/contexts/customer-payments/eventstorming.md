---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: Process-level EventStorming boards for Customer Payments, covering authorize and void at checkout, binding and parked facts, capture and release, refunds, and the clock policies, with hotspots taken only from gaps and risks in the model.
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
in the hotspot table. Boards are drawn left to right; each stays within the
page width.

## Legend

| Colour | Sticky | Meaning here |
| --- | --- | --- |
| Pale yellow `#fff59d` | Actor | Checkout, storefront ops, the clock |
| Blue `#a5d8ff` | Command | A command from `aggregates[PaymentAuthorization].commands` or `aggregates[Refund].commands` |
| Yellow `#ffec99` | Aggregate | `PaymentAuthorization` or `Refund` |
| Orange `#ffc078` | Domain Event | Ours (`publishes`) or a neighbour's (`consumes`, prefixed with the producer) |
| Lilac `#d0bfff` | Policy | `policies`, or the reaction a command takes to an event |
| Green `#b2f2bb` | Read Model | `ParkedFulfillmentFacts`, a read route |
| Pink `#fcc2d7` | External System | A sibling context, the network, the payment provider, analytics |
| Red `#ff8787` | Hotspot | A gap or risk in the model (see the table at the end) |

## 1. Authorize at checkout

```mermaid
flowchart LR
    CK["checkout"]:::external
    C0["AuthorizePayment<br/>POST /payment-authorizations"]:::command
    C1["VoidAuthorization<br/>POST ...:void"]:::command
    PSP["payment-provider<br/>ACL port"]:::external
    G1["PaymentAuthorization"]:::aggregate
    E1["PaymentAuthorized"]:::event
    E2["PaymentDeclined"]:::event
    E3["state VOIDED"]:::event
    AN([analytics]):::actor
    H1["H1 Void and Reauthorize<br/>raise no event"]:::hotspot
    H7["H7 PaymentDeclined carries<br/>no authorizationId"]:::hotspot
    H9["H9 the .events topic<br/>carries nothing"]:::hotspot

    CK --> C0
    CK -->|only after a definitive<br/>rejection| C1
    C0 -->|Authorize<br/>ErrDuplicateAuthorization,<br/>ErrAllocationMismatch| PSP
    PSP --> G1
    C1 -->|Void| PSP
    C1 --> G1
    G1 --> E1
    G1 --> E2
    G1 --> E3
    E1 --> AN
    E2 --> AN
    C1 --- H1
    E2 --- H7
    E1 --- H9

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[customer-payments].inbound` (checkout cmd
rows), `.aggregates[PaymentAuthorization]` (`commands`, `invariants`,
`events`, `notes`), `.sync_calls`, `.publishes`; `contexts[checkout].sync_calls`.

Omitted: the saga around the call, the requote path (gap S3), the provider
timeout and the outbox. A declined authorize is saved as a terminal
`DECLINED` record and the checkout session stays open for another token. The
voided state is drawn as a sticky because the model names no void event
(H1).

## 2. Bind the order and apply parked facts

```mermaid
flowchart LR
    OS["OS FulfillmentShipped,<br/>FulfillmentCancelled"]:::event
    ST["ST PackageLost,<br/>PackageReturned"]:::event
    CK["checkout"]:::external
    E4["CK CheckoutCompleted"]:::event
    RM0["ParkedFulfillmentFacts"]:::readmodel
    P1["BindOrderOnCheckoutCompleted"]:::policy
    C2["BindOrder"]:::command
    G1["PaymentAuthorization"]:::aggregate
    P2["apply parked facts"]:::policy
    H10["H10 parked facts for an<br/>order that never binds"]:::hotspot

    OS -->|order not bound| RM0
    ST -->|order not bound| RM0
    CK --> E4
    E4 --> P1
    P1 --> C2
    C2 --> G1
    G1 --> P2
    RM0 --> P2
    RM0 --- H10

    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[customer-payments].read_models`,
`.policies[BindOrderOnCheckoutCompleted]`, `.business_decisions`,
`.consumes`; `contexts[checkout].publishes[CheckoutCompleted]`.

Omitted: the commands the applied facts cause (boards 3 and 4) and the inbox.
`BindOrder` raises no event of its own; gap S4 is the reason the board exists
at all.

## 3. Capture and release

```mermaid
flowchart LR
    OS["OS FulfillmentShipped"]:::event
    OC["OS FulfillmentCancelled"]:::event
    P3["CaptureOnShipment"]:::policy
    P4["ReleaseOnCancellation"]:::policy
    C3["CaptureAllocation"]:::command
    C4["ReleaseAllocation"]:::command
    PSP["payment-provider<br/>Capture"]:::external
    G1["PaymentAuthorization<br/>allocations"]:::aggregate
    E5["PaymentCaptured"]:::event
    E6["PaymentReleased"]:::event
    AN([analytics]):::actor
    H3["H3 no AUTHORIZED to CAPTURED,<br/>no release transition"]:::hotspot
    H4["H4 no provider verb<br/>for a partial release"]:::hotspot
    H5["H5 unsourceable group is not<br/>FulfillmentCancelled"]:::hotspot
    H6["H6 tracking number has<br/>no field"]:::hotspot

    OS --> P3
    OC --> P4
    P3 --> C3
    P4 --> C4
    C3 -->|ErrOverCapture,<br/>ErrCaptureAfterExpiry,<br/>ErrUnknownGroup| PSP
    PSP --> G1
    C4 -->|ErrUnknownGroup| G1
    G1 --> E5
    G1 --> E6
    E5 --> AN
    E6 --> AN
    G1 --- H3
    C4 --- H4
    OC --- H5
    P3 --- H6

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[customer-payments].policies[CaptureOnShipment,
ReleaseOnCancellation]`, `.consumes`, `.aggregates[PaymentAuthorization]`
(`commands`, `transitions`, `invariants`), `.sync_calls`, `.publishes`;
`network/model/model.yaml → contexts[order-sourcing].publishes`.

Omitted: the bind and parking (board 2), the provider call on release (the
model names none) and the inbox. Capture and release both act on one
allocation; the aggregate state follows only the capture transitions.

## 4. Refunds

```mermaid
flowchart LR
    ST["ST PackageLost"]:::event
    SR["ST PackageReturned"]:::event
    OPS["storefront ops"]:::actor
    P5["RefundOnLostPackage"]:::policy
    P6["RefundOnReturnToSender"]:::policy
    C5["RequestRefund<br/>POST /refunds"]:::command
    G2["Refund"]:::aggregate
    PSP["payment-provider<br/>Refund"]:::external
    C6["RecordRefundOutcome"]:::command
    E7["RefundIssued"]:::event
    E8["RefundFailed"]:::event
    H8["H8 FAILED refund has no<br/>retry"]:::hotspot
    H12["H12 refund carries no<br/>groupNo"]:::hotspot

    ST --> P5
    SR --> P6
    P5 -->|reason LOST| C5
    P6 -->|reason RETURNED_TO_SENDER| C5
    OPS -->|reason MANUAL| C5
    C5 -->|ErrOverRefund| G2
    G2 --> PSP
    PSP --> C6
    C6 --> G2
    G2 --> E7
    G2 --> E8
    E8 --- H8
    C5 --- H12

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[customer-payments].aggregates[Refund]`,
`.policies[RefundOnLostPackage, RefundOnReturnToSender]`, `.inbound` (ops
rows), `.consumes`, `.sync_calls`, `.publishes[RefundIssued, RefundFailed]`;
`network/model/model.yaml → contexts[shipping-and-tracking].publishes`.

Omitted: the parking of a fact for an unbound order (board 2) and the read
routes `GET /refunds?orderId=`. `RefundIssued` and `RefundFailed` are
analytics-only.

## 5. Clock policies

```mermaid
flowchart LR
    T([Clock]):::actor
    P7["ReauthorizeBeforeExpiry<br/>24 h before expiresAt"]:::policy
    P8["VoidUnboundAuthorizations<br/>no CheckoutCompleted after 24 h"]:::policy
    C7["ReauthorizePayment"]:::command
    C1["VoidAuthorization"]:::command
    C8["ExpireAuthorization"]:::command
    PSP["payment-provider<br/>Reauthorize, Void"]:::external
    G1["PaymentAuthorization"]:::aggregate
    E9["PaymentAuthorizationExpired"]:::event
    AN([analytics]):::actor
    H1["H1 reauthorization is<br/>not recorded"]:::hotspot
    H2["H2 nothing raises<br/>ExpireAuthorization"]:::hotspot

    T --> P7
    T --> P8
    P7 --> C7
    P8 --> C1
    C7 --> PSP
    C1 --> PSP
    PSP --> G1
    C8 --> G1
    G1 --> E9
    E9 --> AN
    C7 --- H1
    C8 --- H2

    classDef actor fill:#fff59d,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: `model.yaml → contexts[customer-payments].policies[ReauthorizeBeforeExpiry,
VoidUnboundAuthorizations]`, `.aggregates[PaymentAuthorization]` (`commands`,
`transitions`), `.sync_calls`, `.publishes[PaymentAuthorizationExpired]`.

Omitted: the capture-after-expiry guard (`ErrCaptureAfterExpiry`, board 3).
The two policies are the model's only clock-driven rules; the expiry itself
has no named cause.

## Hotspots

| # | Hotspot | Where it comes from in the model |
| --- | --- | --- |
| H1 | `VoidAuthorization` and `ReauthorizePayment` raise no event, and `ReauthorizePayment` has no transition; how a reauthorization is recorded (new `expiresAt`, new provider reference) is not stated, and analytics never sees a void. | `aggregates[PaymentAuthorization].commands` vs `.events` and `.transitions` |
| H2 | Nothing names what raises `ExpireAuthorization`: no policy, inbound row or provider callback. It also does not say what happens when a reauthorization is declined. | `aggregates[PaymentAuthorization].commands`, `policies` |
| H3 | `transitions` has no `AUTHORIZED → CAPTURED` (a one-group authorization), `ReleaseAllocation` has no transition, and the state after every allocation is released, or a mix of captured and released, is undefined. | `aggregates[PaymentAuthorization].transitions` vs `.states` and `.commands` |
| H4 | The provider port is Authorize, Capture, Void, Refund, Reauthorize; releasing one allocation of a multi-group authorization has no verb. | `sync_calls`, `policies[ReleaseOnCancellation]` |
| H5 | `ReleaseOnCancellation` says `FulfillmentCancelled` covers "an unsourceable group"; the network publishes `FulfillmentUnsourceable` separately and this context does not consume it. The `reason` field of `PaymentReleased` has no named values. | `policies[ReleaseOnCancellation]`, `consumes`; `network/model/model.yaml → contexts[order-sourcing].publishes` |
| H6 | `PackageLost` and `PackageReturned` carry `trackingNumber`; `CaptureOnShipment` "also stores trackingNumber to group", but `Allocation` and `ProviderRef` have no such field. | `policies[CaptureOnShipment]`, `aggregates[PaymentAuthorization].value_objects` |
| H7 | `PaymentDeclined` carries `checkoutSessionId`, `reason` and `at` but no `authorizationId`, although it is published by the aggregate whose root id is the subject and partition key. | `publishes[PaymentDeclined]` vs `aggregates[PaymentAuthorization].root_id` |
| H8 | A `FAILED` refund is terminal with no retry or follow-up, and the model does not say whether `REQUESTED` or `FAILED` refunds count toward `ErrOverRefund`. | `aggregates[Refund].transitions`, `.invariants` |
| H9 | All seven events are analytics-only, so `retailnetwork.customer-payments.events` carries nothing; the future `customer-notifications` context would be the first consumer. | `publishes` rows ("analytics only"); `future_contexts[customer-notifications]` |
| H10 | `ParkedFulfillmentFacts` has no expiry, size bound or alarm for an order that never binds (a `CheckoutCompleted` that never comes). | `read_models[ParkedFulfillmentFacts]`, `policies[VoidUnboundAuthorizations]` |
| H11 | The `PaymentAuthorization` description in the model is cut off in the middle of "unique checkoutSessionId" (a literal ellipsis). | `aggregates[PaymentAuthorization].description` |
| H12 | `Refund` and `RefundIssued` carry `orderId` only, no `groupNo` or `authorizationId`, although the policies refund "the affected group's captured amount" and the provider key is per group. | `aggregates[Refund]`, `publishes[RefundIssued]`, `policies[RefundOnLostPackage]` |
