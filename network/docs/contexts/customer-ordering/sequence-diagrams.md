---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: Proposed UML sequence diagrams for every Customer Ordering command use case, from inbound adapter through aggregate, repository and outbox to Kafka, with error, concurrency and idempotency branches.
---

# Sequence Diagrams

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

One UML sequence diagram per command use case on
[Use Cases](/network/contexts/customer-ordering/use-cases). Participant names are the
proposed packages and ports from the
[Class Diagram](/network/contexts/customer-ordering/class-diagram):

- `http` and `kafka` are the inbound adapters.
- The use case is in `internal/application/usecases`.
- `Postgres` stands for the repository, the outbox, the inbox and the
  idempotency store. They share one transaction through `UnitOfWork`.
- `Relay / Kafka` is the outbox relay. It reads committed `outbox_events`
  rows and publishes them to `retailnetwork.customer-ordering.events`.

Every save is conditional on the loaded `version` (optimistic concurrency).
Full CloudEvents types are on [Domain Events](/network/contexts/customer-ordering/domain-events).

## 1. PlaceOrder (REST POST /checkout)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as PlaceOrder
    participant PG as PromiseGateway deliverypromise
    participant A as CustomerOrder
    participant DB as Postgres
    participant K as Relay / Kafka
    H->>DB: find Idempotency-Key
    alt key seen with the same body
        DB-->>H: stored response
        H-->>H: replay 201
    else new key
        H->>UC: Execute(shopperId, shipTo, lines, groups)
        UC->>UC: every line in one group, else ErrLineWithoutPromise
        loop each group
            UC->>PG: MakePromise(offerId, key from offerId)
            alt ErrOfferNotQuotable
                PG-->>UC: 409
                UC->>PG: QuoteDeliveryOffers(group lines, prefix)
                PG-->>UC: new offers
                UC-->>H: 409 offer-not-quotable with new offers
            else ErrPromiseCapacityExhausted or ErrBookClosed
                PG-->>UC: 409
                UC-->>H: 409 promise-capacity-exhausted or book-closed
            else promise made
                PG-->>UC: promiseId, tier, nodeId, shipBy, window
            end
        end
        UC->>A: PlaceOrder(shopperId, shipTo, lines, groups)
        alt ErrLineWithoutPromise or ErrPromiseDestinationMismatch
            A-->>UC: error
            UC-->>H: 422 problem
        else valid
            A-->>UC: order PLACED + CustomerOrderPlaced
            UC->>DB: BEGIN, insert order version 1
            UC->>DB: insert outbox_events CustomerOrderPlaced
            UC->>DB: store Idempotency-Key response, COMMIT
            UC-->>H: 201 orderId, windows
            K->>DB: poll unpublished outbox rows
            K->>K: publish key orderId
            K->>DB: mark published_at
        end
    end
```

Derived from: `model.yaml → contexts[customer-ordering].aggregates[CustomerOrder]`
(`PlaceOrder`, invariants), `.sync_calls`, `.policies[CheckoutPromising]`,
`.publishes[CustomerOrderPlaced]`; `conventions.integration_rules`.

Omitted: `ErrGroupSpansNodes` (422) and a `delivery-promise` timeout (503),
both handled like the 409 branch. Promises made before a failing group are
not released by this context; `delivery-promise` releases them at
`holdExpiresAt`. There is no version conflict on an insert. A second
insert with the same `orderId` cannot happen, because the id is minted here.

## 2. CancelOrder (REST POST /orders/orderId:cancel)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as CancelOrder
    participant A as CustomerOrder
    participant DB as Postgres
    participant K as Relay / Kafka
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay
    else new key
        H->>UC: Execute(orderId, reason)
        UC->>DB: load order and version
        alt not found
            UC-->>H: 404 order-not-found
        else already CANCELLED
            UC-->>H: 200 unchanged, no event
        else found
            UC->>A: CancelOrder(all groupNos, reason, now)
            alt ErrCancelAfterLock
                A-->>UC: error
                UC-->>H: 409 cancel-after-lock
            else ErrStatusRegression
                A-->>UC: error
                UC-->>H: 409 status-regression
            else allowed
                A-->>UC: CANCELLED + CustomerOrderCancelled
                UC->>DB: BEGIN, update where version matches
                alt version changed
                    DB-->>UC: 0 rows, ROLLBACK
                    UC->>UC: reload and retry once, then 409 stale-order
                else saved
                    UC->>DB: insert outbox CustomerOrderCancelled
                    UC->>DB: store key response, COMMIT
                    UC-->>H: 200 CANCELLED
                    K->>DB: poll outbox
                    K->>K: publish key orderId
                end
            end
        end
    end
```

Derived from: `model.yaml → contexts[customer-ordering].aggregates[CustomerOrder]`
(`CancelOrder`, `ErrCancelAfterLock`, `ErrStatusRegression`),
`.publishes[CustomerOrderCancelled]`.

Omitted: the relay marking the row published (as in diagram 1). A lock
`order-sourcing` made but this context has not consumed yet is not visible
here (race, see [Use Cases](/network/contexts/customer-ordering/use-cases)).

## 3. CancelOrder by policy CancelOnUnfulfillable (Kafka)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as CancelOrder policy
    participant A as CustomerOrder
    participant DB as Postgres
    participant K as Relay / Kafka
    KC->>DB: processed_events has CloudEvents id?
    alt duplicate
        KC->>KC: ack, no effect
    else new FulfillmentUnsourceable
        KC->>UC: Execute(orderId, groupNo, promiseId)
        UC->>DB: BEGIN, mark group awaiting re-promise, insert inbox row, COMMIT
        Note over UC: waits for PromiseRevised or for the not-feasible condition, which no model event signals
        opt not-feasible condition holds
            UC->>DB: load order and version
            UC->>A: CancelOrder(groupNo, reason, now)
            alt ErrCancelAfterLock or ErrStatusRegression
                A-->>UC: error
                UC->>UC: log anomaly, no event
            else allowed
                A-->>UC: group cancelled + CustomerOrderCancelled
                UC->>DB: BEGIN, update where version matches
                UC->>DB: insert outbox CustomerOrderCancelled, COMMIT
                K->>DB: poll outbox
                K->>K: publish key orderId
            end
        end
    end
```

Derived from: `model.yaml → contexts[customer-ordering].policies[CancelOnUnfulfillable]`,
`.consumes` (`FulfillmentUnsourceable`), `.publishes[CustomerOrderCancelled]`.

Omitted: the version-conflict retry (as in diagram 2). The trigger of the
`opt` block is the model gap recorded as hotspot H6 on
[EventStorming](/network/contexts/customer-ordering/eventstorming).

## 4. RegisterShopper (REST POST /shoppers)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http
    participant UC as RegisterShopper
    participant A as Shopper
    participant DB as Postgres
    H->>DB: find Idempotency-Key
    alt key seen
        DB-->>H: stored response, replay
    else new key
        H->>UC: Execute(email, savedAddresses)
        UC->>A: RegisterShopper(email, savedAddresses)
        A-->>UC: shopper ACTIVE
        UC->>DB: BEGIN, insert shopper and addresses
        alt unique email violated
            DB-->>UC: conflict, ROLLBACK
            UC-->>H: 409 shopper-exists, ErrShopperExists
        else inserted
            UC->>DB: store key response, COMMIT
            UC-->>H: 201 shopperId
        end
    end
    Note over UC,DB: Shopper raises no event, no outbox row, nothing reaches Kafka
```

Derived from: `model.yaml → contexts[customer-ordering].aggregates[Shopper]`.

Omitted: nothing else. The model gives `Shopper` no events.

## 5. MarkInFulfillment (Kafka FulfillmentLocked)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as MarkInFulfillment
    participant A as CustomerOrder
    participant DB as Postgres
    KC->>DB: processed_events has CloudEvents id?
    alt duplicate
        KC->>KC: ack, no effect
    else new
        KC->>UC: Execute(orderId, groupNo, assignmentId, lockedAt)
        UC->>DB: load order and version
        alt order not found
            UC-->>KC: retry later, then dead-letter
        else found
            UC->>A: MarkInFulfillment(groupNo, assignmentId, lockedAt)
            alt ErrStatusRegression
                A-->>UC: error, for example CANCELLED
                UC->>DB: insert inbox row, log anomaly, COMMIT
            else ok
                A-->>UC: group locked, PLACED to IN_FULFILLMENT
                UC->>DB: BEGIN, update where version matches
                alt version changed
                    DB-->>UC: 0 rows, ROLLBACK, redeliver
                else saved
                    UC->>DB: insert inbox row, update rm_order_tracking, COMMIT
                end
            end
        end
    end
    Note over UC,DB: no event, no outbox row
```

Derived from: `model.yaml → contexts[customer-ordering].aggregates[CustomerOrder]`
(`MarkInFulfillment`, `ErrStatusRegression`), `.consumes`
(`FulfillmentLocked`), `.read_models`.

Omitted: the tracking projector, which here runs in the same transaction.
It can also run as its own consumer.

## 6. MarkGroupShipped (Kafka FulfillmentShipped)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as MarkGroupShipped
    participant A as CustomerOrder
    participant DB as Postgres
    KC->>DB: processed_events has CloudEvents id?
    alt duplicate
        KC->>KC: ack, no effect
    else new
        KC->>UC: Execute(orderId, groupNo, trackingNumbers, shippedAt)
        UC->>DB: load order and version
        UC->>A: MarkGroupShipped(groupNo, trackingNumbers, shippedAt)
        alt ErrStatusRegression on PLACED
            A-->>UC: error, lock not seen yet
            UC-->>KC: retry later
        else ErrStatusRegression on CANCELLED
            A-->>UC: error
            UC->>DB: insert inbox row, log anomaly, COMMIT
        else ok
            A-->>UC: PARTIALLY_SHIPPED or SHIPPED
            UC->>DB: BEGIN, update where version matches
            alt version changed
                DB-->>UC: 0 rows, ROLLBACK, redeliver
            else saved
                UC->>DB: insert packages and inbox row, COMMIT
            end
        end
    end
    Note over UC,DB: no event, no outbox row
```

Derived from: `model.yaml → contexts[customer-ordering].aggregates[CustomerOrder]`
(`MarkGroupShipped`, transitions), `.consumes` (`FulfillmentShipped`).

Omitted: the order-not-found branch (as in diagram 5) and the tracking
projection.

## 7. MarkGroupDelivered (Kafka PackageDelivered)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as MarkGroupDelivered
    participant A as CustomerOrder
    participant DB as Postgres
    KC->>DB: processed_events has CloudEvents id?
    alt duplicate
        KC->>KC: ack, no effect
    else new
        KC->>UC: Execute(orderId, assignmentId, trackingNumber, deliveredAt)
        UC->>DB: load order and version, group by assignmentId
        UC->>A: record package delivered
        alt every package of the group delivered
            UC->>A: MarkGroupDelivered(groupNo, deliveredAt)
            alt ErrStatusRegression, order not SHIPPED
                A-->>UC: error, delivery kept on the group
            else ok
                A-->>UC: DELIVERED once every group is
            end
        end
        UC->>DB: BEGIN, update where version matches
        alt version changed
            DB-->>UC: 0 rows, ROLLBACK, redeliver
        else saved
            UC->>DB: insert inbox row, COMMIT
        end
    end
    Note over UC,DB: no event, no outbox row
```

Derived from: `model.yaml → contexts[customer-ordering].aggregates[CustomerOrder]`
(`MarkGroupDelivered`, transitions), `.consumes` (`PackageDelivered`).

Omitted: the order-not-found branch and the tracking projection. On
`PARTIALLY_SHIPPED` the model has no transition (hotspot H4), so the status
stays.

## 8. UpdateGroupPromise (Kafka PromiseRevised)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as UpdateGroupPromise
    participant A as CustomerOrder
    participant DB as Postgres
    KC->>DB: processed_events has CloudEvents id?
    alt duplicate
        KC->>KC: ack, no effect
    else new
        KC->>UC: Execute(orderId, promiseId, revisionNo, window, shipBy)
        UC->>DB: load order and version
        alt no group with this promiseId
            UC->>DB: insert inbox row, log, COMMIT
        else revisionNo not above the last applied
            UC->>DB: insert inbox row, COMMIT
        else newer revision
            UC->>A: UpdateGroupPromise(groupNo, window, shipBy, revisionNo)
            A-->>UC: window replaced, status unchanged
            UC->>DB: BEGIN, update where version matches
            alt version changed
                DB-->>UC: 0 rows, ROLLBACK, redeliver
            else saved
                UC->>DB: insert inbox row, update rm_order_tracking, COMMIT
            end
        end
    end
    Note over UC,DB: no event, no outbox row
```

Derived from: `model.yaml → contexts[customer-ordering].aggregates[CustomerOrder]`
(`UpdateGroupPromise`), `.consumes` (`PromiseRevised`);
`contexts[delivery-promise].publishes[PromiseRevised].data`.

Omitted: telling the shopper about the new window, which belongs to the
future `customer-notification` context.
