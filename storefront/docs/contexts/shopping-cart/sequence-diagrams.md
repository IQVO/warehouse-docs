---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: Proposed UML sequence diagrams for every Shopping Cart command use case, from inbound adapter through aggregate, repository, the delivery-promise quote port and outbox to Kafka, with error, concurrency and idempotency branches.
---

# Sequence Diagrams

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `shopping-cart` service is built on develop ([`IQVO/shopping-cart`](https://github.com/IQVO/shopping-cart) at `95bc5bc`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/shopping-cart#service-and-operations) section lists it.
:::

One UML sequence diagram per command use case on
[Use Cases](/storefront/contexts/shopping-cart/use-cases). Participant
names are the proposed packages and ports from the
[Class Diagram](/storefront/contexts/shopping-cart/class-diagram):

- `http`, `kafka consumer` and `scheduler` are the inbound adapters.
- The use case is in `internal/application/usecases`.
- `Purchasability` stands for the `PurchasabilityStore` port behind
  `PurchasabilityView`.
- `deliverypromise` is the outbound REST adapter behind the `QuoteOffers`
  port — the cart's only synchronous dependency.
- `Postgres` stands for the repository, the views, the outbox, the inbox
  and the idempotency store. They share one transaction through
  `UnitOfWork`.
- `Relay / Kafka` is the outbox relay. It reads committed `outbox_events`
  rows and publishes them to `retailnetwork.shopping-cart.analytics` — the
  only topic the cart writes to (all four events are analytics-only).

Every save is conditional on the loaded `version` (optimistic concurrency)
— one shopper's rapid edits are the hot path. Full CloudEvents types are on
[Domain Events](/storefront/contexts/shopping-cart/domain-events).

## 1. CreateCart (REST POST /carts)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as CreateCart
    participant A as Cart
    participant DB as Postgres
    H->>DB: find Idempotency-Key
    alt key seen with the same body
        DB-->>H: stored response
        H-->>H: replay 201
    else new key
        H->>UC: Execute(shopperId?)
        UC->>A: CreateCart(shopperId, now)
        A-->>UC: OPEN cart
        UC->>DB: BEGIN, insert cart
        UC->>DB: store key response, COMMIT
        UC-->>H: 201 cartId, version
        Note over UC,DB: no event:<br/>CreateCart publishes nothing
    end
```

Derived from: `model.yaml → contexts[shopping-cart].aggregates[Cart].commands[CreateCart]`,
`.rest["POST /carts"]`, `conventions.integration_rules`.

Omitted: nothing. `shopperId` is optional (guest-first, D4); the BFF mints
the `Idempotency-Key` and keeps the returned `cartId` in its cookie.

## 2. AddLine (REST POST /carts/cartId/lines)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as AddLine
    participant PV as Purchasability
    participant A as Cart
    participant DB as Postgres
    participant K as Relay / Kafka
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay
    else new key
        H->>UC: Execute(cartId, catalogItemId, quantity)
        UC->>DB: load Cart and version
        alt cart not OPEN
            UC-->>H: 409 cart-closed<br/>ErrCartClosed
        else OPEN
            UC->>PV: purchasable?
            alt not purchasable
                PV-->>UC: miss
                UC-->>H: 422 item-not-purchasable<br/>ErrItemNotPurchasable
            else purchasable
                UC->>A: AddLine(catalogItemId, quantity, now)
                alt quantity out of 1..99 or over 100 lines
                    A-->>UC: ErrQuantityOutOfRange<br/>/ ErrTooManyLines
                    UC-->>H: 422 problem
                else added or merged
                    A-->>UC: line stored, quote and<br/>selections cleared
                    UC->>DB: BEGIN, update where version matches
                    UC->>DB: insert outbox CartLineAdded<br/>merged quantity
                    UC->>DB: store key response, COMMIT
                    UC-->>H: 200 cart
                    K->>DB: poll outbox
                    K->>K: publish key cartId
                end
            end
        end
    end
```

Derived from: `model.yaml → contexts[shopping-cart].aggregates[Cart]`
(`AddLine`, invariants), `.read_models[PurchasabilityView]`,
`.publishes[CartLineAdded]`; `conventions.integration_rules`.

Omitted: the version-conflict retry (reload once, then 409
`concurrent-update`; as in diagram 5). Re-adding an existing item merges
quantities — the event carries the merged line, and
`ErrDuplicateLine` is the invariant behind the merge (hotspot H2).

## 3. SetLineQuantity and RemoveLine (REST)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as SetLineQuantity<br/>or RemoveLine
    participant A as Cart
    participant DB as Postgres
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay
    else new key
        H->>UC: Execute(cartId, catalogItemId, quantity?)
        UC->>DB: load Cart and version
        alt cart not OPEN
            UC-->>H: 409 cart-closed<br/>ErrCartClosed
        else line unknown
            UC-->>H: 404 not-found
        else line found
            UC->>A: SetLineQuantity / RemoveLine
            alt quantity out of 1..99
                A-->>UC: ErrQuantityOutOfRange
                UC-->>H: 422 quantity-out-of-range
            else applied
                A-->>UC: line changed, quote and<br/>selections cleared
                UC->>DB: BEGIN, update where version matches
                UC->>DB: store key response, COMMIT
                UC-->>H: 200 cart
                Note over UC,DB: no event: neither command<br/>publishes (hotspot H1)
            end
        end
    end
```

Derived from: `model.yaml → contexts[shopping-cart].aggregates[Cart].commands`,
`.publishes` (no event for either command).

One diagram covers both commands: the shape is identical; only the line
mutation differs. Omitted: the version-conflict retry and the relay.

## 4. SetDestination (REST POST /carts/cartId:set-destination)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as SetDestination
    participant A as Cart
    participant DB as Postgres
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay
    else new key
        H->>UC: Execute(cartId, destinationPostalPrefix)
        UC->>DB: load Cart and version
        alt cart not OPEN
            UC-->>H: 409 cart-closed<br/>ErrCartClosed
        else OPEN
            UC->>A: SetDestination(prefix, now)
            A-->>UC: prefix stored, quote and<br/>selections cleared
            UC->>DB: BEGIN, update where version matches
            UC->>DB: store key response, COMMIT
            UC-->>H: 200 cart
            Note over UC,DB: no event:<br/>the prefix moves the tax band<br/>only through the next quote
        end
    end
```

Derived from: `model.yaml → contexts[shopping-cart].aggregates[Cart].commands[SetDestination]`,
`business_decisions` (clearing rule).

Omitted: the version-conflict retry. The destination is a prefix, never an
address; `EstimateView`'s tax band is keyed on it at read time.

## 5. QuoteDelivery (REST POST /carts/cartId:quote-delivery)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as QuoteDelivery
    participant DP as deliverypromise
    participant A as Cart
    participant DB as Postgres
    participant K as Relay / Kafka
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay
    else new key
        H->>UC: Execute(cartId)
        UC->>DB: load Cart and version
        alt cart not OPEN
            UC-->>H: 409 cart-closed<br/>ErrCartClosed
        else no destination prefix
            UC-->>H: 422 no-destination<br/>ErrNoDestination
        else prefix set
            UC->>DP: QuoteDeliveryOffers<br/>POST /delivery-offers:quote<br/>lines, prefix
            alt the OHS call fails
                DP-->>UC: error
                UC-->>H: 503 delivery-promise-unavailable<br/>lines and prefix kept, no quote
            else offers returned
                DP-->>UC: groups, offers, windows,<br/>expiries, unavailable tiers
                UC->>A: QuoteDelivery(quote, now)
                A-->>UC: quote held, holds no capacity
                UC->>DB: BEGIN, update where version matches
                alt version changed
                    DB-->>UC: 0 rows, ROLLBACK
                    UC->>UC: reload and retry once,<br/>then 409 concurrent-update
                else saved
                    UC->>DB: insert outbox CartDeliveryQuoted
                    UC->>DB: store key response, COMMIT
                    UC-->>H: 200 cart with quote<br/>and estimate
                    K->>DB: poll outbox
                    K->>K: publish key cartId
                end
            end
        end
    end
```

Derived from: `model.yaml → contexts[shopping-cart].sync_calls[QuoteDeliveryOffers]`,
`.aggregates[Cart].commands[QuoteDelivery]`, `.invariants[ErrNoDestination]`,
`.publishes[CartDeliveryQuoted]`;
`network/model/model.yaml → contexts[delivery-promise].inbound` (caller
`shopper / storefront`).

Omitted: the network's own quote mechanics (feasible witness paths,
capacity — `delivery-promise`'s pages). The cart consumes the offer set as
returned and stores the unavailable tiers with their constraints. A failed
OHS call leaves the cart's lines and prefix intact: the shopper retries the
quote, not the cart.

## 6. SelectDelivery (REST POST /carts/cartId:select-delivery)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as SelectDelivery
    participant A as Cart
    participant DB as Postgres
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay
    else new key
        H->>UC: Execute(cartId, groupNo, offerId)
        UC->>DB: load Cart and version
        alt cart not OPEN
            UC-->>H: 409 cart-closed<br/>ErrCartClosed
        else offer not of the current quote
            UC-->>H: 409 stale-delivery-selection<br/>ErrStaleDeliverySelection
        else offer of the quote
            UC->>A: SelectDelivery(groupNo, offerId, now)
            A-->>UC: selection recorded
            UC->>DB: BEGIN, update where version matches
            UC->>DB: store key response, COMMIT
            UC-->>H: 200 cart, estimate,<br/>CheckoutReadiness
            Note over UC,DB: no event.<br/>readiness is every group selected,<br/>no offer expired, vs the clock
        end
    end
```

Derived from: `model.yaml → contexts[shopping-cart].aggregates[Cart].commands[SelectDelivery]`,
`.invariants[ErrStaleDeliverySelection]`, `.read_models[CheckoutReadiness]`.

Omitted: the version-conflict retry and the estimate arithmetic
(`EstimateView`: effective prices plus the selected tiers' charges plus the
band of the destination prefix). Expiry is checked by comparing
`expiresAt` with the clock; no event announces an expiry.

## 7. MergeInto (REST POST /carts/cartId:merge-into)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as MergeInto
    participant A as Cart source
    participant T as Cart target
    participant DB as Postgres
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay
    else new key
        H->>UC: Execute(sourceCartId, targetCartId)
        UC->>DB: load both carts and versions
        alt target not OPEN, or not the same<br/>shopper, or the cart itself
            UC-->>H: 422 merge-target<br/>ErrMergeTarget
        else both OPEN, same shopper
            UC->>A: MergeInto(target, now)
            UC->>T: take the lines, merge quantities<br/>clear target quote and selections
            A-->>UC: source MERGED, target updated
            UC->>DB: BEGIN, update both where<br/>versions match
            UC->>DB: store key response, COMMIT
            UC-->>H: 200 target cart
            Note over UC,DB: no event: MergeInto<br/>publishes nothing (hotspot H1)
        end
    end
```

Derived from: `model.yaml → contexts[shopping-cart].aggregates[Cart].commands[MergeInto]`,
`.invariants[ErrMergeTarget]`, `business_decisions` (guest-first bullet).

Omitted: the version-conflict retry and the relay. The typical caller is
the sign-in moment (D4): the BFF merges the guest cart into the shopper's
open cart. Both writes share one transaction; `MERGED` is terminal
(`ErrCartClosed` afterwards).

## 8. AbandonInactive (scheduler)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant SCH as scheduler
    participant UC as AbandonInactive
    participant A as Cart
    participant DB as Postgres
    participant K as Relay / Kafka
    SCH->>DB: scan OPEN carts with<br/>last_changed_at older than 30 days
    loop each idle cart
        UC->>A: AbandonInactive(now)
        A-->>UC: ABANDONED + CartAbandoned
        UC->>DB: BEGIN, update where version matches
        UC->>DB: insert outbox CartAbandoned<br/>lastChangedAt
        UC->>DB: COMMIT
    end
    K->>DB: poll outbox
    K->>K: publish key cartId
    Note over SCH,DB: the purge of abandoned carts<br/>is unnamed in the model (hotspot H5)
```

Derived from: `model.yaml → contexts[shopping-cart].policies[AbandonInactive]`,
`.publishes[CartAbandoned]`, `.size_estimate`.

Omitted: nothing. The sweep is idempotent: an already-`ABANDONED` cart
fails no rule because the scan selects `OPEN` carts only.

## 9. CloseOnCheckoutCompleted (Kafka)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as CloseOnCheckoutCompleted
    participant A as Cart
    participant DB as Postgres
    participant K as Relay / Kafka
    KC->>DB: processed_events has CloudEvents id?
    alt duplicate
        KC->>KC: ack, no effect
    else new CheckoutCompleted
        KC->>UC: Execute(cartId, sessionId)
        UC->>DB: load Cart by cartId, version
        alt cart OPEN
            UC->>A: CloseOnCheckoutCompleted(sessionId, now)
            A-->>UC: CHECKED_OUT + CartCheckedOut
            UC->>DB: BEGIN, update where version matches
            UC->>DB: insert outbox CartCheckedOut<br/>checkoutSessionId
            UC->>DB: insert inbox row, COMMIT
            K->>DB: poll outbox
            K->>K: publish key cartId
        else cart not OPEN
            UC->>DB: insert inbox row, COMMIT
            Note over UC,DB: ErrCartClosed logged as an anomaly:<br/>no transition exists from<br/>CHECKED_OUT, ABANDONED or MERGED
        end
    end
```

Derived from: `model.yaml → contexts[shopping-cart].policies[CloseOnCheckoutCompleted]`,
`.consumes[CheckoutCompleted]`, `.publishes[CartCheckedOut]`;
`contexts[checkout].publishes[CheckoutCompleted]`.

Omitted: the version-conflict retry (redeliver). The upstream event is
keyed by `sessionId`, not `cartId`; the cart looks itself up by the
`cartId` in the data and relies on the inbox, not the partition, for
exactly-once effect.

## 10. Project the views (Kafka)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as ProjectPurchasabilityView<br/>/ ProjectEstimateView
    participant DB as Postgres
    KC->>DB: processed_events has CloudEvents id?
    alt duplicate
        KC->>KC: ack, no effect
    else new catalogue or pricing event
        KC->>UC: Execute(fields)
        UC->>DB: BEGIN
        alt CatalogItemCreated / Discontinued
            UC->>DB: upsert rm_purchasability
        else ItemPriceChanged / Withdrawn
            UC->>DB: upsert rm_purchasability,<br/>rm_item_prices
        else DeliveryChargeScheduleChanged
            UC->>DB: replace rm_current_schedule
        else TaxTableChanged
            UC->>DB: replace rm_current_tax_table
        end
        UC->>DB: insert inbox row, COMMIT
    end
    Note over UC,DB: no event, no outbox row,<br/>the Cart aggregate is never touched
```

Derived from: `model.yaml → contexts[shopping-cart].consumes`,
`.read_models[PurchasabilityView, EstimateView]`.

Omitted: nothing. All five event types land in one consumer flow with three
consumer groups; per-item order comes from pricing's `catalogItemId` keying,
and the schedule and table events carry the versions the views store.
