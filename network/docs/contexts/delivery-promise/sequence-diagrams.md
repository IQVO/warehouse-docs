---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: Proposed UML sequence diagrams for every Delivery Promise command use case, from inbound adapter through aggregate, repository and outbox to Kafka.
---

# Sequence Diagrams

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One UML sequence diagram per command use case of
[the use cases page](/network/contexts/delivery-promise/use-cases): inbound adapter →
use case → aggregate → repository and outbox in the **same transaction** →
relay → Kafka. `Postgres tx` stands for the repositories, the inbox
(`processed_events`) and the outbox (`outbox_events`) inside one transaction.
`alt` blocks show error branches, optimistic-concurrency version checks
(`UPDATE ... WHERE version = :read`) and idempotency. Participants are proposed
Go components, not built code.

Common rules, shown once here and abbreviated below:

- Every Kafka-driven use case first inserts the CloudEvents `id` into
  `processed_events`; a conflict means a duplicate and the transaction rolls
  back with no effect.
- Every event is written to `outbox_events` in the aggregate's transaction; the
  relay (diagram 0) publishes it. "relay to Kafka" in a diagram stands for
  diagram 0.
- A lost version check rolls back; the use case reloads and retries (three
  times, proposed) or leaves the row to the next tick.

## 0. Outbox relay (shared)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant DB as Postgres
    participant RL as Outbox relay
    participant K as Kafka
    loop every poll interval
        RL->>DB: SELECT unpublished outbox_events FOR UPDATE SKIP LOCKED
        DB-->>RL: rows in id order
        RL->>K: produce to retailnetwork.delivery-promise.events<br/>key = subject, value = CloudEvent
        alt ack
            RL->>DB: UPDATE published_at = now
        else broker error
            RL->>DB: UPDATE attempts + 1, last_error
            Note over RL: row retried next pass, same CloudEvents id
        end
    end
```

Derived from: `model.yaml → conventions.integration_rules` ("every published event
leaves through a transactional outbox"), `conventions.cloudevents` (topic,
subject = key).

Omitted: the analytics topic (`retailnetwork.delivery-promise.analytics`), which
the same relay drains for `DeliveryOfferQuoted` rows.

## 1. QuoteDeliveryOffers (REST)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor C as Storefront or customer-ordering
    participant H as http adapter
    participant UC as QuoteDeliveryOffers
    participant SN as NetworkSnapshot + BookRepository
    participant A as DeliveryOffer
    participant DB as Postgres tx
    C->>H: POST /delivery-offers:quote
    H->>UC: Execute(prefix, lines, tiers, key)
    alt Idempotency-Key seen, offers still QUOTED
        UC->>DB: offers by idempotency_key
        UC-->>H: same offers
    else new quote
        UC->>SN: service area, candidate nodes, grades
        alt prefix not served
            UC-->>H: constraints DESTINATION_NOT_SERVED
        else served
            UC->>SN: pickups with book room, departures, waves
            Note over UC: PromisePolicy per tier<br/>handicap, deadline, grouping
            loop each tier with a best path
                UC->>A: Quote(request, candidate, ttl, now)
                Note over A: ErrOfferExpiryTooLate guard
            end
            UC->>DB: BEGIN, insert offers, outbox row<br/>DeliveryOfferQuoted analytics, COMMIT
            UC-->>H: offers and constraints
        end
    end
    H-->>C: 200 offers, constraints
```

Derived from: `model.yaml → contexts[delivery-promise].rest[POST /delivery-offers:quote]`,
`.aggregates[DeliveryOffer]`, `.policies`, `.read_models`.

Omitted: the search steps (listed on the use cases page and worked through in
[the promise model](/network/network-model/promise-model)); a malformed body returns
`422 invalid-request` before the use case runs. No synchronous call leaves the
context: `NetworkSnapshot` reads local `rm_` tables. The quote reads books but
never writes them.

## 2. MakePromise (REST)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http adapter
    participant UC as MakePromise
    participant O as DeliveryOffer
    participant P as Promise
    participant B as PromiseBook
    participant DB as Postgres tx
    H->>UC: Execute(offerId, lines, Idempotency-Key)
    UC->>DB: promise by idempotency_key
    alt key already used, same body
        UC-->>H: existing promise, 200
    else new
        UC->>DB: load offer, book, read models
        alt offer missing
            UC-->>H: 404 offer-not-found
        else offer EXPIRED or CONSUMED
            UC-->>H: 409 offer-not-quotable
        else quotable
            Note over UC: re-validate witness path<br/>ErrGroupSpansNodes
            UC->>P: Make(offer, group, terms, holdExpiresAt)
            Note over P: ErrInvalidPromiseTerms<br/>ErrNominalBasisNotAllowedForTier
            UC->>B: Hold(now)
            alt full or closed
                B-->>UC: ErrPromiseCapacityExhausted or ErrBookClosed
                UC-->>H: 409
            else held
                B-->>UC: exhausted true or false
                UC->>O: Consume(now)
                UC->>DB: BEGIN, insert promise, update book<br/>WHERE version, update offer, outbox<br/>PromiseMade, PromiseBookExhausted if full
                alt book version changed
                    DB-->>UC: 0 rows, ROLLBACK
                    Note over UC: reload book and retry, max 3, then 409 stale-write
                else committed
                    DB-->>UC: COMMIT
                    UC-->>H: 201 promise
                end
            end
        end
    end
```

Derived from: `model.yaml → contexts[delivery-promise].rest[POST /promises]`,
`.aggregates[Promise].invariants`, `.aggregates[PromiseBook].invariants`,
`.aggregates[DeliveryOffer].transitions`, `.publishes[PromiseMade, PromiseBookExhausted]`.

Omitted: the relay (diagram 0) publishing `PromiseMade` and, when the book
filled, `PromiseBookExhausted`; the `422 idempotency-key-reused` branch (same key,
different body). The three aggregates change in one local transaction (see
the use cases page).

## 3. ConfirmPromise (Kafka: CustomerOrderPlaced)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as ConfirmPromise
    participant P as Promise
    participant B as PromiseBook
    participant DB as Postgres tx
    participant RL as relay to Kafka
    KC->>UC: CustomerOrderPlaced, CloudEvents id
    UC->>DB: BEGIN, insert processed_events id
    alt id already processed
        DB-->>UC: conflict, ROLLBACK
        Note over UC: duplicate, nothing to do
    else first time
        loop each group
            UC->>DB: load promise, book
            UC->>P: Confirm(orderId, groupNo, now)
            alt hold expired or promise closed
                P-->>UC: ErrPromiseHoldExpired or ErrPromiseClosed
                Note over UC: group skipped, alert, hotspot H6
            else confirmed
                UC->>B: Confirm()
                UC->>DB: update promise and book WHERE version<br/>outbox PromiseConfirmed
            end
        end
        UC->>DB: COMMIT
        alt a version check failed
            DB-->>UC: ROLLBACK, message redelivered
        end
    end
    RL->>DB: drain outbox, publish PromiseConfirmed
```

Derived from: `model.yaml → contexts[delivery-promise].consumes[CustomerOrderPlaced]`,
`.aggregates[Promise].transitions[PROVISIONAL, CONFIRMED]`,
`.aggregates[PromiseBook].commands[ConfirmCapacity]`.

Omitted: nothing else. All groups of one order commit in one transaction with
the inbox row, so a failure redelivers the whole event and a success can never
be half applied.

## 4. CancelPromise (Kafka: CustomerOrderCancelled)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as CancelPromise
    participant P as Promise
    participant B as PromiseBook
    participant DB as Postgres tx
    participant RL as relay to Kafka
    KC->>UC: CustomerOrderCancelled, CloudEvents id
    UC->>DB: BEGIN, insert processed_events id
    alt duplicate id
        DB-->>UC: conflict, ROLLBACK
    else first time
        loop each groupNo
            UC->>DB: promise by orderId, groupNo
            UC->>P: Cancel(reason)
            alt already CANCELLED, KEPT or BROKEN
                P-->>UC: ErrPromiseClosed, skipped
            else cancelled
                UC->>B: Release(confirmed)
                Note over B: ErrCapacityUnderflow guard
                UC->>DB: update promise, book WHERE version<br/>outbox PromiseCancelled
            end
        end
        UC->>DB: COMMIT
    end
    RL->>DB: drain outbox, publish PromiseCancelled
```

Derived from: `model.yaml → contexts[delivery-promise].consumes[CustomerOrderCancelled]`,
`.aggregates[Promise].transitions` (`CANCELLED`), `.publishes[PromiseCancelled]`.

Omitted: nothing else. Joining this event to `CancelPromise` is this pack's
reading; the model names no policy for it.

## 5. FlagPromiseAtRisk (Kafka: RepromiseOnRisk triggers)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as FlagPromiseAtRisk
    participant P as Promise
    participant DB as Postgres tx
    participant RL as relay to Kafka
    KC->>UC: trigger event<br/>see table below
    UC->>DB: BEGIN, insert processed_events id
    alt duplicate id
        DB-->>UC: conflict, ROLLBACK
    else first time
        UC->>DB: affected promises
        loop each CONFIRMED promise
            UC->>P: FlagAtRisk(reason, detectedAt)
            UC->>DB: update promise WHERE version<br/>outbox PromiseAtRisk
        end
        UC->>DB: COMMIT
        Note over UC: each AT_RISK promise goes to RevisePromise
    end
    RL->>DB: drain outbox, publish PromiseAtRisk
```

Derived from: `model.yaml → contexts[delivery-promise].policies[RepromiseOnRisk]`,
`.aggregates[Promise].transitions[CONFIRMED, AT_RISK]`.

The trigger events: `FulfillmentUnsourceable` (finds the promise by
`promiseId`), `PackageExceptionRaised` (by `assignmentId`, open question 3) and
`DepartureCancelled` (every `CONFIRMED` promise whose witness pickup or legs use
the departure; the same consumer also updates `rm_departure`). An `AT_RISK`
promise is not flagged again.

## 6. RevisePromise

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant UC as RevisePromise
    participant SN as NetworkSnapshot
    participant P as Promise
    participant B as PromiseBook
    participant DB as Postgres tx
    participant RL as relay to Kafka
    UC->>SN: search from now<br/>down to STANDARD
    alt nothing feasible
        Note over UC: promise stays AT_RISK<br/>judged later
    else candidate found
        UC->>P: Revise(terms, witness, reason, now)
        alt deliverByLatest earlier
            P-->>UC: ErrRevisionMovesEarlier
        else revised
            UC->>B: new book Hold() then Confirm()
            alt new book full or closed
                B-->>UC: ErrPromiseCapacityExhausted<br/>or ErrBookClosed
            else held
                UC->>B: old book Release(confirmed)
                UC->>DB: one tx: promise, both books<br/>outbox PromiseRevised
                alt version conflict
                    DB-->>UC: ROLLBACK, retry from search
                end
            end
        end
    end
    RL->>DB: drain outbox, publish PromiseRevised
```

Derived from: `model.yaml → contexts[delivery-promise].policies[RepromiseOnRisk]`,
`.aggregates[Promise].invariants[ErrRevisionMovesEarlier]`,
`.publishes[PromiseRevised]`.

Omitted: the book moves (hold and confirm on the new book, release on the old)
are this pack's reading (open question 11); when the witness book does not
change, no book is touched. The trigger's CloudEvents `id` is stored with the
revision so a redelivered trigger does not revise twice.

## 7. JudgePromise (Kafka: PackageDelivered)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as JudgePromise
    participant P as Promise
    participant DB as Postgres tx
    participant RL as relay to Kafka
    KC->>UC: PackageDelivered, assignmentId, orderId, deliveredAt
    UC->>DB: BEGIN, insert processed_events id
    alt duplicate id
        DB-->>UC: conflict, ROLLBACK
    else first time
        UC->>DB: promise by assignmentId
        alt not found, lock not seen yet
            DB-->>UC: none, ROLLBACK
            Note over KC: redelivered with back-off
        else found
            UC->>P: Judge(deliveredAt)
            alt already judged
                P-->>UC: ErrPromiseClosed, commit inbox only
            else on or before deliverByLatest
                UC->>DB: update promise KEPT, outbox PromiseKept, COMMIT
            else late
                UC->>DB: update promise BROKEN, lateByMinutes<br/>outbox PromiseBroken, COMMIT
            end
        end
    end
    RL->>DB: drain outbox, publish the judgement
```

Derived from: `model.yaml → contexts[delivery-promise].policies[JudgeOnDelivery]`,
`.business_decisions` ("kept means delivered on or before deliverByLatest"),
`.publishes[PromiseKept, PromiseBroken]`.

Omitted: the lookup by `assignmentId` relies on the correlation recorded from
`FulfillmentLocked`, which the model does not name (open questions 3 and 4 on
[the canvas page](/network/contexts/delivery-promise/bounded-context-canvas)).

## 8. ReleaseExpiredHolds (scheduler)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant S as scheduler
    participant UC as ReleaseExpiredHolds
    participant P as Promise
    participant B as PromiseBook
    participant DB as Postgres tx
    participant RL as relay to Kafka
    S->>UC: tick
    UC->>DB: PROVISIONAL with holdExpiresAt before now, limit n
    loop each promise
        UC->>P: ReleaseExpiredHold(now)
        alt confirmed meanwhile
            P-->>UC: ErrPromiseClosed, skipped
        else released
            UC->>B: Release(provisional)
            UC->>DB: BEGIN, update promise, book WHERE version<br/>outbox PromiseReleased, COMMIT
            alt version conflict
                DB-->>UC: ROLLBACK, left for next tick
            end
        end
    end
    RL->>DB: drain outbox, publish PromiseReleased
```

Derived from: `model.yaml → contexts[delivery-promise].aggregates[Promise].transitions[PROVISIONAL, RELEASED]`,
`.aggregates[PromiseBook].commands[ReleaseCapacity]`, `.publishes[PromiseReleased]`.

Omitted: the batch size and tick interval (proposed: every minute).

## 9. ExpireOffers (scheduler)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant S as scheduler
    participant UC as ExpireOffers
    participant A as DeliveryOffer
    participant DB as Postgres tx
    S->>UC: tick
    UC->>DB: QUOTED offers with expiresAt before now, limit n
    loop each offer
        UC->>A: Expire(now)
        alt consumed meanwhile
            A-->>UC: ErrOfferNotQuotable, skipped
        else expired
            UC->>DB: update offer EXPIRED WHERE state QUOTED
        end
    end
    UC->>DB: COMMIT, drop expired day partitions
    Note over UC,DB: no outbox row, offers publish no integration event
```

Derived from: `model.yaml → contexts[delivery-promise].aggregates[DeliveryOffer]`
(`transitions[QUOTED, EXPIRED]`, `size_estimate`).

Omitted: nothing. The offer has no version column: the conditional update on
`state` is its concurrency check against a racing `MakePromise`.

## 10. CloseBook (scheduler)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant S as scheduler
    participant UC as CloseBook
    participant B as PromiseBook
    participant DB as Postgres tx
    S->>UC: tick
    UC->>DB: OPEN books with cutoffAt before now
    loop each book
        UC->>B: Close(now)
        alt already CLOSED
            B-->>UC: no-op
        else closed
            UC->>DB: BEGIN, update book WHERE version, COMMIT
            alt version conflict, a hold won the race
                DB-->>UC: ROLLBACK, retried next tick
            end
        end
    end
    Note over UC,DB: no event, the model gives PromiseBook only PromiseBookExhausted
```

Derived from: `model.yaml → contexts[delivery-promise].aggregates[PromiseBook]`
(`transitions[OPEN, CLOSED]`, `invariants[ErrBookClosed]`).

Omitted: nothing. The trigger is the policy `CloseBooksAtCutoff`: a clock job at `cutoffAt`.
