---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: Proposed UML sequence diagrams for every Customer Payments command use case, from inbound adapter through aggregate, repository, the payment provider Anti-Corruption Layer port and outbox to Kafka, with error, concurrency and idempotency branches.
---

# Sequence Diagrams

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

One UML sequence diagram per command use case on
[Use Cases](/storefront/contexts/customer-payments/use-cases). Participant
names are the proposed packages and ports from the
[Class Diagram](/storefront/contexts/customer-payments/class-diagram):

- `http`, `kafka consumer` and `scheduler` are the inbound adapters.
- The use case is in `internal/application/usecases`.
- `PaymentProvider` is the outbound adapter behind the Anti-Corruption Layer
  port (`Authorize`, `Capture`, `Void`, `Refund`, `Reauthorize`, `ReduceAuthorization`); the
  payment-provider simulator answers behind it. It is the context's only
  synchronous dependency.
- `Postgres` stands for the repositories, the parked facts, the outbox, the
  inbox and the idempotency store. They share one transaction through
  `UnitOfWork`.
- `Relay / Kafka` is the outbox relay. It reads committed `outbox_events`
  rows and publishes them to `retailnetwork.customer-payments.analytics` —
  the only topic the context writes to (all eight events are analytics-only by design).

The provider call is made **before** the transaction opens and carries the
deterministic key per (operation, `authorizationId`, `groupNo`); a crash
between the call and the commit repeats the call with the same key. Every
save is conditional on the loaded `version` (optimistic concurrency). Full
CloudEvents types are on [Domain Events](/storefront/contexts/customer-payments/domain-events).

## 1. AuthorizePayment (REST POST /payment-authorizations)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as AuthorizePayment
    participant P as PaymentProvider
    participant A as PaymentAuthorization
    participant DB as Postgres
    participant K as Relay / Kafka
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response
        H-->>H: replay 201
    else new key
        H->>UC: Execute(sessionId, token, total, allocations)
        UC->>DB: find authorization by checkoutSessionId
        alt one exists
            UC-->>H: 409 duplicate-authorization
        else allocations do not sum to the total
            UC-->>H: 422 allocation-mismatch
        else
            UC->>P: Authorize(token, total, key)
            alt provider unreachable or timed out
                P-->>UC: error
                UC-->>H: 503 provider unavailable,<br/>retry with the same key
            else approved
                P-->>UC: providerAuthorizationId, expiresAt
                UC->>A: AuthorizePayment(...)
                A-->>UC: AUTHORIZED, PaymentAuthorized
                UC->>DB: BEGIN, insert authorization and allocations
                UC->>DB: outbox PaymentAuthorized,<br/>key response, COMMIT
                UC-->>H: 201 AUTHORIZED
                DB-->>K: relay publishes after commit
            else declined
                P-->>UC: declined, reason
                UC->>A: AuthorizePayment(...) declined
                A-->>UC: DECLINED, PaymentDeclined
                UC->>DB: BEGIN, insert DECLINED,<br/>outbox PaymentDeclined,<br/>key response, COMMIT
                UC-->>H: 201 DECLINED
                DB-->>K: relay publishes after commit
            end
        end
    end
```

Derived from: `model.yaml → contexts[customer-payments].aggregates[PaymentAuthorization].commands[AuthorizePayment]`,
`.invariants`, `.notes`, `.rest["POST /payment-authorizations"]`,
`.sync_calls`, `.publishes[PaymentAuthorized, PaymentDeclined]`.

Omitted: the optimistic-concurrency branch (a new row has none). A unique
key on `checkout_session_id` also catches two concurrent first calls under
different keys, answered `409 duplicate-authorization`.

## 2. VoidAuthorization (REST POST /payment-authorizations/authorizationId:void)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as VoidAuthorization
    participant A as PaymentAuthorization
    participant P as PaymentProvider
    participant DB as Postgres
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response
        H-->>H: replay 200
    else new key
        H->>UC: Execute(authorizationId)
        UC->>DB: load authorization and version
        alt not found
            UC-->>H: 404 not-found
        else not AUTHORIZED
            UC-->>H: 409 illegal-transition
        else
            UC->>P: Void(key)
            alt provider unreachable or timed out
                P-->>UC: error
                UC-->>H: 503 payment-provider-unavailable<br/>retry with the same key
            else voided
                P-->>UC: voided
                UC->>A: VoidAuthorization(now)
                A-->>UC: VOIDED, PaymentReleased(VOIDED)
                UC->>DB: BEGIN, save with version check,<br/>outbox PaymentReleased
                alt version conflict
                    DB-->>UC: 0 rows
                    UC-->>H: 409 concurrent-update
                else saved
                    UC->>DB: store key response, COMMIT
                    UC-->>H: 200 VOIDED
                    DB-->>K: relay publishes PaymentReleased<br/>reason VOIDED after commit
                end
            end
        end
    end
```

Derived from: `model.yaml → contexts[customer-payments].aggregates[PaymentAuthorization].commands[VoidAuthorization]`,
`.transitions`, `.rest`, `.sync_calls`; `contexts[checkout].sync_calls[VoidAuthorization]`.

Omitted: the scheduler trigger of `VoidUnboundAuthorizations`, which runs the
same use case without the HTTP branches (no `Idempotency-Key`; the
authorization is selected as unbound for 24 h).

## 3. RequestRefund and RecordRefundOutcome (REST POST /refunds, Kafka PackageLost, PackageReturned)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http / kafka
    participant UC as RequestRefund
    participant R as Refund
    participant P as PaymentProvider
    participant DB as Postgres
    participant K as Relay / Kafka
    H->>DB: find Idempotency-Key or inbox CloudEvents id
    alt already seen
        DB-->>H: replay or acknowledge
    else new
        H->>UC: Execute(orderId, groupNo, authorizationId,<br/>amountMinor, reason)
        UC->>DB: load order's captured total and refunds
        alt order not bound (consumer path)
            UC->>DB: park the fact in parked facts
        else would exceed the captured total
            UC-->>H: 409 over-refund
        else
            UC->>R: RequestRefund(...)
            R-->>UC: REQUESTED
            UC->>P: Refund(key)
            alt provider unreachable or timed out
                P-->>UC: error
                UC-->>H: 503 provider unavailable,<br/>retry with the same key
            else refunded
                P-->>UC: refunded
                UC->>R: RecordRefundOutcome(success)
                R-->>UC: SUCCEEDED, RefundIssued
                UC->>DB: BEGIN, save refund,<br/>outbox RefundIssued,<br/>key or inbox row, COMMIT
                UC-->>H: 201 SUCCEEDED
                DB-->>K: relay publishes after commit
            else failed
                P-->>UC: failure code
                UC->>R: RecordRefundOutcome(failure)
                R-->>UC: FAILED, RefundFailed
                UC->>DB: BEGIN, save refund,<br/>outbox RefundFailed,<br/>key or inbox row, COMMIT
                UC-->>H: 201 FAILED
                DB-->>K: relay publishes after commit
            end
        end
    end
```

Derived from: `model.yaml → contexts[customer-payments].aggregates[Refund]`
(`commands`, `transitions`, `invariants`), `.policies[RefundOnLostPackage,
RefundOnReturnToSender]`, `.rest["POST /refunds"]`, `.sync_calls`,
`.publishes[RefundIssued, RefundFailed]`.

Omitted: the optimistic-concurrency branch and `RetryRefund` (`FAILED →
REQUESTED`, at most 5 attempts, then the refund stays `FAILED` with an
operator alert; `ErrOverRefund` counts `REQUESTED` and issued refunds, never
`FAILED`). On the policy path the group comes from the tracking number stored
on its allocation at capture (H6), and the refund carries `groupNo` and
`authorizationId` (H12). The REST route answers `201` with the
refund in its final state when the provider replies in the same request; a
slower outcome would leave `REQUESTED` visible through `GET /refunds`, a
detail the model does not specify.

## 4. CaptureAllocation (Kafka FulfillmentShipped)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant C as kafka consumer
    participant UC as CaptureAllocation
    participant A as PaymentAuthorization
    participant P as PaymentProvider
    participant DB as Postgres
    participant K as Relay / Kafka
    C->>DB: inbox lookup on CloudEvents id
    alt already processed
        DB-->>C: duplicate, acknowledge
    else new
        C->>UC: Execute(orderId, groupNo, trackingNumbers)
        UC->>DB: load authorization by orderId
        alt order not bound yet
            UC->>DB: park the fact, inbox row
        else bound
            UC->>P: Capture(key for operation, authorizationId, groupNo)
            alt provider unreachable or timed out
                P-->>UC: error
                UC-->>C: error, redelivered
            else captured
                P-->>UC: providerCaptureId
                UC->>A: CaptureAllocation(groupNo, now)
                alt ErrUnknownGroup, ErrOverCapture or ErrCaptureAfterExpiry
                    A-->>UC: error
                    UC->>DB: inbox row, log anomaly
                else captured
                    A-->>UC: allocation CAPTURED, PaymentCaptured
                    UC->>DB: BEGIN, save with version check<br/>set the allocation's trackingNumber
                    UC->>DB: insert outbox PaymentCaptured, inbox row, COMMIT
                    DB-->>K: relay publishes after commit
                end
            end
        end
    end
```

Derived from: `model.yaml → contexts[customer-payments].consumes[FulfillmentShipped]`,
`.policies[CaptureOnShipment]`, `.aggregates[PaymentAuthorization]`
(`commands`, `transitions`, `invariants`), `.read_models`, `.sync_calls`,
`.publishes[PaymentCaptured]`.

Omitted: the version-conflict retry. An unexpected error is not
acknowledged, so the event is redelivered and the deterministic provider key
makes the repeated `Capture` safe. The capture happens before the guards in
this drawing; an implementation may run the aggregate guards first, so a
capture the aggregate would refuse never reaches the provider (the model does
not fix the order).

## 5. ReleaseAllocation (Kafka FulfillmentCancelled, FulfillmentUnsourceable)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant C as kafka consumer
    participant UC as ReleaseAllocation
    participant A as PaymentAuthorization
    participant P as PaymentProvider
    participant DB as Postgres
    participant K as Relay / Kafka
    C->>DB: inbox lookup on CloudEvents id
    alt already processed
        DB-->>C: duplicate, acknowledge
    else new
        C->>UC: Execute(orderId, groupNo, reason)
        UC->>DB: load authorization by orderId
        alt order not bound yet
            UC->>DB: park the fact, inbox row
        else bound
            UC->>P: ReduceAuthorization(amount) for a partial release
            UC->>A: ReleaseAllocation(groupNo, reason, now)
            alt ErrUnknownGroup
                A-->>UC: error
                UC->>DB: inbox row, log anomaly
            else released
                A-->>UC: allocation RELEASED, PaymentReleased
                UC->>DB: BEGIN, save with version check
                UC->>DB: insert outbox PaymentReleased, inbox row, COMMIT
                DB-->>K: relay publishes after commit
            end
        end
    end
```

Derived from: `model.yaml → contexts[customer-payments].consumes[FulfillmentCancelled, FulfillmentUnsourceable]`,
`.policies[ReleaseOnCancellation, ReleaseOnUnsourceable]`, `.aggregates[PaymentAuthorization]`
(`commands`, `invariants`), `.publishes[PaymentReleased]`.

Omitted: the provider-error branch. A partial release calls the provider
port's `ReduceAuthorization(amount)` (H4). The reason is `CANCELLED` for
`FulfillmentCancelled` and `UNSOURCEABLE` for `FulfillmentUnsourceable`; the
state follows the allocations, so releasing the last one gives `RELEASED` (or
`CAPTURED` when some were captured) (H3).

## 6. BindOrder and apply parked facts (Kafka CheckoutCompleted)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant C as kafka consumer
    participant UC as BindOrder
    participant A as PaymentAuthorization
    participant DB as Postgres
    participant UCs as Capture, Release, RequestRefund
    C->>DB: inbox lookup on CloudEvents id
    alt already processed
        DB-->>C: duplicate, acknowledge
    else new
        C->>UC: Execute(sessionId, orderId, authorizationId)
        UC->>DB: load authorization by authorizationId
        UC->>A: BindOrder(orderId)
        A-->>UC: orderId set
        UC->>DB: BEGIN, save with version check, inbox row, COMMIT
        UC->>DB: take parked facts for orderId
        loop each parked fact in arrival order
            UC->>UCs: apply the fact<br/>(sequences 3, 4 and 5)
        end
    end
```

Derived from: `model.yaml → contexts[customer-payments].consumes[CheckoutCompleted]`,
`.policies[BindOrderOnCheckoutCompleted]`, `.read_models[ParkedFulfillmentFacts]`,
`.aggregates[PaymentAuthorization].commands[BindOrder]`.

Omitted: the transactional detail of each applied fact (see sequences 3 to
5). The bind commits first, so a fact arriving while the parked ones are
applied already finds a bound order; the model does not fix whether the bind
and the replay share one transaction.

## 7. ReauthorizePayment (scheduler)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant S as scheduler
    participant UC as ReauthorizePayment
    participant A as PaymentAuthorization
    participant P as PaymentProvider
    participant DB as Postgres
    S->>DB: select authorizations 24 h before expiresAt<br/>with PENDING allocations
    loop each authorization
        S->>UC: Execute(authorizationId)
        UC->>DB: load authorization and version
        UC->>P: Reauthorize(uncaptured allocations, key)
        alt provider declines
            P-->>UC: declined
            UC->>A: ExpireAuthorization(now)
            A-->>UC: EXPIRED, PaymentDeclined(REAUTH_DECLINED)
            UC->>DB: BEGIN, save with version check,<br/>outbox PaymentDeclined, COMMIT
        else reauthorized
            P-->>UC: new expiresAt, providerRef
            UC->>A: ReauthorizePayment(expiresAt, providerRef)
            A-->>UC: AUTHORIZED, PaymentReauthorized
            UC->>DB: BEGIN, save with version check,<br/>outbox PaymentReauthorized, COMMIT
        end
    end
```

Derived from: `model.yaml → contexts[customer-payments].policies[ReauthorizeBeforeExpiry]`,
`.aggregates[PaymentAuthorization].commands[ReauthorizePayment]`,
`.sync_calls`.

Omitted: the idempotency detail — the scan selects only authorizations close
to expiry and the provider key is deterministic, so a second sweep repeats
the same call. A successful reauthorization keeps the state `AUTHORIZED` and
records the new `expiresAt` and provider reference (H1); a provider decline
moves the authorization to `EXPIRED` (H2). A provider timeout is retried by
the next sweep.

## 8. ExpireAuthorization (provider decline on re-authorization)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant T as ReauthorizePayment
    participant UC as ExpireAuthorization
    participant A as PaymentAuthorization
    participant DB as Postgres
    participant K as Relay / Kafka
    T->>UC: Execute(authorizationId)
    UC->>DB: load authorization and version
    UC->>A: ExpireAuthorization(now)
    alt AUTHORIZED or PARTIALLY_CAPTURED
        A-->>UC: EXPIRED, PaymentAuthorizationExpired
        UC->>DB: BEGIN, save with version check
        UC->>DB: insert outbox PaymentAuthorizationExpired, COMMIT
        DB-->>K: relay publishes after commit
    else already terminal
        A-->>UC: no transition, no-op
    end
```

Derived from: `model.yaml → contexts[customer-payments].aggregates[PaymentAuthorization]`
(`commands[ExpireAuthorization]`, `transitions`, `events`),
`.publishes[PaymentAuthorizationExpired]`.

Omitted: the trigger's own flow (sequence 7). `ExpireAuthorization` is raised
by a provider decline on re-authorization (H2); the diagram draws the two
transitions into `EXPIRED` and the event they raise.
