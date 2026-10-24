---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: "Proposed UML sequence diagrams for the nine Order Sourcing command use cases: inbound adapter, use case, aggregate, repository and outbox in one transaction, relay and Kafka, with idempotency, version checks and error branches."
---

# Sequence Diagrams

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One diagram per command use case on [Use Cases](/network/contexts/order-sourcing/use-cases).
The participants are the proposed hexagonal pieces:

| Participant | Proposed component |
| --- | --- |
| adapter | `internal/adapters/inbound/kafka` consumer, `internal/adapters/inbound/http` handler, or the scheduler in `cmd/order-sourcing` |
| use case | `internal/application/usecases.<Command>` |
| aggregate | `assignment.FulfillmentAssignment` |
| repo + outbox | `internal/adapters/outbound/postgres`: the assignment repository, `outbox_events`, `processed_events` and `idempotency_keys`, all in **one** transaction |
| relay | the outbox relay, `internal/adapters/outbound/kafka` |
| Kafka | topic `retailnetwork.order-sourcing.events` |

Every save is `UPDATE ... WHERE assignment_id = ? AND assignment_version = ?`
(optimistic concurrency); zero rows updated is `ErrStaleAssignmentVersion`.
Kafka consumers check the inbox (`processed_events`) first and write their
inbox row in the same transaction as the change. Event names are short; the
full type is `com.retailnetwork.commerce.order-sourcing.assignment.<EventName>`.

The relay half (outbox to Kafka) is the same in every diagram, so it is drawn
in full in diagram 1 and shortened afterwards.

## 1. QueueAssignment

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant AD as kafka consumer
    participant UC as Queue<br/>Assignment
    participant A as Fulfillment<br/>Assignment
    participant R as repo + outbox
    participant RL as relay
    participant K as Kafka
    AD->>UC: CustomerOrderPlaced
    UC->>R: inbox has CloudEvents id?
    alt already processed
        R-->>UC: yes
        UC-->>AD: ack, no change
    else new
        loop each group
            UC->>R: find by orderId, groupNo
            alt assignment exists
                Note over UC: skip the group
            else none
                Note over UC: candidates from read models, AssignmentCost, VirtualQueue releaseAt
                UC->>A: QueueAssignment(constraint, lines, best)
                A-->>UC: QUEUED, version 1
                UC->>R: BEGIN, insert assignment
                UC->>R: insert outbox FulfillmentQueued
            end
        end
        UC->>R: insert inbox row, COMMIT
        UC-->>AD: ack
    end
    RL->>R: poll unpublished outbox rows
    RL->>K: produce, key assignmentId
    RL->>R: mark published
    opt SAME_DAY group
        UC->>UC: run ReleaseToNode now
    end
```

Derived from: model.yaml → `aggregates[FulfillmentAssignment].commands`,
`.policies` (`VirtualQueue`, `AssignmentCost`), `conventions.integration_rules`.

Omitted: the unique key on (`orderId`, `groupNo`) also rejects a racing
duplicate insert, which the consumer treats as "already queued". A crash
before `COMMIT` leaves nothing; the event is re-delivered.

## 2. ReoptimiseAssignment

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant AD as http or sweep
    participant UC as Reoptimise<br/>Assignment
    participant A as Fulfillment<br/>Assignment
    participant R as repo + outbox
    participant RL as relay
    participant K as Kafka
    AD->>UC: reoptimise(assignmentId, Idempotency-Key)
    opt http with a known Idempotency-Key
        UC->>R: idempotency_keys lookup
        R-->>UC: stored response
        UC-->>AD: replay stored response
    end
    UC->>R: load assignment
    alt not found
        UC-->>AD: 404 assignment-not-found
    else found
        Note over UC: candidates without excluded nodes and with eta within deliverByLatest
        UC->>A: ReoptimiseAssignment(best)
        alt state RELEASED
            A-->>UC: ErrReleaseInFlight
            UC-->>AD: 409 release-in-flight
        else state LOCKED or later
            A-->>UC: ErrAssignmentLocked
            UC-->>AD: 409 assignment-locked
        else QUEUED and the node changes
            A-->>UC: new candidate, releaseAt, version + 1
            UC->>R: BEGIN, update where version matches
            UC->>R: insert outbox FulfillmentReassigned, COMMIT
            alt version mismatch
                R-->>UC: ErrStaleAssignmentVersion
                UC-->>AD: 409 stale-assignment-version
            else saved
                UC-->>AD: 200 assignment
            end
        else QUEUED, same node
            UC->>R: update candidate and releaseAt, no event
            UC-->>AD: 200 assignment
        end
    end
    RL->>K: FulfillmentReassigned
```

Derived from: model.yaml → `aggregates[FulfillmentAssignment].transitions`
(`QUEUED → QUEUED`), `.invariants` (`ErrReleaseInFlight`,
`ErrAssignmentLocked`, `ErrStaleAssignmentVersion`), `.rest`,
`.policies[AssignmentCost]`.

Omitted: the guards `ErrNodeExcluded` and `ErrCandidateBreaksPromise`, which
the candidate search makes unreachable; the `UNSOURCEABLE`, `CANCELLED`,
`SHIPPED` and `DELIVERED` states, for which the model names no error (open
question). The sweep ignores 409s and moves to the next row. The HTTP answer
is stored under the `Idempotency-Key` in the same transaction.

## 3. ReleaseToNode

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant AD as release timer
    participant UC as Release<br/>ToNode
    participant A as Fulfillment<br/>Assignment
    participant R as repo + outbox
    participant RL as relay
    participant K as Kafka
    AD->>R: QUEUED with releaseAt due
    R-->>AD: assignments
    loop each assignment
        AD->>UC: release(assignmentId)
        UC->>R: load
        Note over UC: re-check best candidate on fresh read models
        UC->>A: ReleaseToNode(best, now)
        alt a release is PENDING
            A-->>UC: ErrReleaseInFlight
            Note over UC: skip, already released
        else candidate meets deliverByLatest
            A-->>UC: RELEASED, releaseNo n, requiredShipBy, version + 1
            UC->>R: BEGIN, update where version matches, insert release row
            UC->>R: insert outbox FulfillmentReleasedToNode, COMMIT
        else no candidate meets deliverByLatest
            A-->>UC: UNSOURCEABLE, version + 1
            UC->>R: BEGIN, update where version matches
            UC->>R: insert outbox FulfillmentUnsourceable, COMMIT
        end
        opt version mismatch
            R-->>UC: ErrStaleAssignmentVersion
            Note over UC: rollback, the next tick retries
        end
    end
    RL->>K: FulfillmentReleasedToNode or FulfillmentUnsourceable
```

Derived from: model.yaml → `aggregates[FulfillmentAssignment].transitions`
(`QUEUED → RELEASED`, `QUEUED → UNSOURCEABLE`), `.invariants`,
`.policies[VirtualQueue]`, `.publishes`; `contexts[vendor-connectivity].policies[IssueOnRelease]`.

Omitted: the guard `ErrNodeExcluded`; the resolution of each line's
`listingId` from `AvailabilityView`. `vendor-connectivity` issues the
purchase order idempotently on `assignmentId + releaseNo`, so a re-published
event issues no second PO.

## 4. HandleNodeRefusal

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant AD as kafka consumer
    participant UC as HandleNode<br/>Refusal
    participant A as Fulfillment<br/>Assignment
    participant R as repo + outbox
    participant RL as relay
    participant K as Kafka
    AD->>UC: PurchaseOrderRejected or PurchaseOrderExpired
    UC->>R: inbox has CloudEvents id?
    alt already processed
        UC-->>AD: ack
    else new
        UC->>R: load assignmentId
        alt releaseNo is not the PENDING release
            UC->>R: insert inbox row only
            UC-->>AD: ack, stale outcome ignored
        else current release
            Note over UC: candidates without the refusing node
            UC->>A: HandleNodeRefusal(releaseNo, outcome, reasonCode, next)
            alt candidate left
                A-->>UC: QUEUED, node excluded, version + 1
                UC->>R: BEGIN, update, outbox FulfillmentReassigned
            else none meets deliverByLatest
                A-->>UC: UNSOURCEABLE, version + 1
                UC->>R: BEGIN, update, outbox FulfillmentUnsourceable
            else already LOCKED
                A-->>UC: ErrAssignmentLocked
                UC->>R: insert inbox row only
            end
            UC->>R: insert inbox row, COMMIT
            opt version mismatch
                R-->>UC: ErrStaleAssignmentVersion
                UC-->>AD: nack, re-delivery retries
            end
        end
    end
    RL->>K: FulfillmentReassigned or FulfillmentUnsourceable
```

Derived from: model.yaml → `.policies[ReassignOnRefusal]`,
`aggregates[FulfillmentAssignment].transitions` (`RELEASED → QUEUED`,
`RELEASED → UNSOURCEABLE`), `.invariants` (`ErrNodeExcluded`,
`ErrAssignmentLocked`); `contexts[vendor-connectivity].publishes`
(`assignmentId`, `releaseNo` in the outcome data).

Omitted: a re-queued assignment whose new `releaseAt` is already past is
released by the next timer tick (diagram 3).

## 5. LockAssignment

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant AD as kafka consumer
    participant UC as Lock<br/>Assignment
    participant A as Fulfillment<br/>Assignment
    participant R as repo + outbox
    participant RL as relay
    participant K as Kafka
    AD->>UC: PurchaseOrderAccepted
    UC->>R: inbox has CloudEvents id?
    alt already processed
        UC-->>AD: ack
    else new
        UC->>R: load assignmentId
        alt LOCKED by the same releaseNo
            UC->>R: insert inbox row only
        else RELEASED, releaseNo is PENDING
            UC->>A: LockAssignment(releaseNo, acceptedAt)
            A-->>UC: LOCKED, version + 1
            UC->>R: BEGIN, update where version matches
            UC->>R: insert outbox FulfillmentLocked, inbox row, COMMIT
        else CANCELLED
            Note over UC: not modelled, logged, inbox row only
        end
        opt version mismatch
            R-->>UC: ErrStaleAssignmentVersion
            UC-->>AD: nack, re-delivery retries
        end
    end
    RL->>K: FulfillmentLocked
```

Derived from: model.yaml → `.policies[LockOnCommit]`,
`aggregates[FulfillmentAssignment].transitions` (`RELEASED → LOCKED`),
`.invariants` (`ErrAssignmentLocked`, `ErrStaleAssignmentVersion`).

Omitted: the consumers' reactions (`linehaul-transportation` `BookOnLock`).
The `CANCELLED` branch is the known residual "acceptance after cancellation": the acceptance is only recorded and logged (policy `AcceptanceAfterCancelOnlyLogged`).

## 6. MarkShipped

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant AD as kafka consumer
    participant UC as Mark<br/>Shipped
    participant A as Fulfillment<br/>Assignment
    participant R as repo + outbox
    participant RL as relay
    participant K as Kafka
    AD->>UC: VendorShipmentConfirmed
    UC->>R: inbox check, load assignmentId
    alt already SHIPPED
        UC->>R: insert inbox row only
    else LOCKED
        UC->>A: MarkShipped(trackingNumbers, shippedAt)
        A-->>UC: SHIPPED, version + 1
        UC->>R: BEGIN, update where version matches
        UC->>R: insert outbox FulfillmentShipped, inbox row, COMMIT
    end
    opt version mismatch
        R-->>UC: ErrStaleAssignmentVersion
        UC-->>AD: nack, re-delivery retries
    end
    RL->>K: FulfillmentShipped
```

Derived from: model.yaml → `aggregates[FulfillmentAssignment].transitions`
(`LOCKED → SHIPPED`), `.publishes[FulfillmentShipped]`.

Omitted: a shipment for an assignment that is not `LOCKED`; the model names
no error for it (logged, inbox row only).

## 7. MarkDelivered

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant AD as kafka consumer
    participant UC as Mark<br/>Delivered
    participant A as Fulfillment<br/>Assignment
    participant R as repo + outbox
    participant RL as relay
    participant K as Kafka
    AD->>UC: PackageDelivered
    UC->>R: inbox check, load assignmentId
    alt already DELIVERED
        UC->>R: insert inbox row only
    else SHIPPED
        UC->>A: MarkDelivered(deliveredAt)
        A-->>UC: DELIVERED, version + 1
        UC->>R: BEGIN, update where version matches
        UC->>R: insert outbox FulfillmentDelivered, inbox row, COMMIT
    end
    opt version mismatch
        R-->>UC: ErrStaleAssignmentVersion
        UC-->>AD: nack, re-delivery retries
    end
    RL->>K: FulfillmentDelivered
```

Derived from: model.yaml → `aggregates[FulfillmentAssignment].transitions`
(`SHIPPED → DELIVERED`), `contexts[shipping-and-tracking].publishes[PackageDelivered].data`.

Omitted: the multi-package rule (open question): this diagram delivers on
the first `PackageDelivered`.

## 8. CancelAssignment

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant AD as kafka consumer
    participant UC as Cancel<br/>Assignment
    participant A as Fulfillment<br/>Assignment
    participant R as repo + outbox
    participant RL as relay
    participant K as Kafka
    AD->>UC: CustomerOrderCancelled
    UC->>R: inbox has CloudEvents id?
    loop each groupNo in groupNos
        UC->>R: load by orderId, groupNo
        UC->>A: CancelAssignment(reason)
        alt QUEUED or RELEASED
            A-->>UC: CANCELLED, version + 1
            UC->>R: update, outbox FulfillmentCancelled
        else already CANCELLED
            Note over UC: no-op
        else LOCKED, SHIPPED or DELIVERED
            A-->>UC: ErrCancelAfterLock
            UC->>R: outbox FulfillmentCancelRefused
        end
    end
    UC->>R: insert inbox row, COMMIT
    opt version mismatch
        R-->>UC: ErrStaleAssignmentVersion
        UC-->>AD: nack, re-delivery retries
    end
    RL->>K: FulfillmentCancelled
```

Derived from: model.yaml → `aggregates[FulfillmentAssignment].transitions`
(`QUEUED → CANCELLED`, `RELEASED → CANCELLED`, `UNSOURCEABLE → CANCELLED`,
`RefuseCancel`), `.invariants` (`ErrCancelAfterLock`), `.policies[CancelDecision]`;
`contexts[vendor-connectivity].policies[CancelOnSourcingCancel]`.

Omitted: an `UNSOURCEABLE` assignment is cancelled the same way as a `QUEUED`
one. All groups of one event are decided in one transaction. The refused
branch (`LOCKED`, `SHIPPED`, `DELIVERED`) keeps the state, bumps the version
and publishes `FulfillmentCancelRefused` with reason `CANCEL_AFTER_LOCK`.

## 9. ApplyRevisedPromise

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant AD as kafka consumer
    participant UC as ApplyRevised<br/>Promise
    participant A as Fulfillment<br/>Assignment
    participant R as repo + outbox
    participant RL as relay
    participant K as Kafka
    AD->>UC: PromiseRevised
    UC->>R: inbox check, load by promiseId
    alt state UNSOURCEABLE
        Note over UC: candidates against the new deliverByLatest
        UC->>A: ApplyRevisedPromise(constraint, best)
        A-->>UC: QUEUED, releaseAt, version + 1
        UC->>R: BEGIN, update where version matches
        UC->>R: insert inbox row, COMMIT
        Note over R,K: no event in the model, nothing for the relay
    else any other state
        Note over UC: no transition in the model, inbox row only
    end
    opt version mismatch
        R-->>UC: ErrStaleAssignmentVersion
        UC-->>AD: nack, re-delivery retries
    end
```

Derived from: model.yaml → `aggregates[FulfillmentAssignment].transitions`
(`UNSOURCEABLE → QUEUED`), `.events` (none for this command);
`contexts[delivery-promise].publishes[PromiseRevised].data`.

Omitted: the relay and Kafka do nothing here, because the model names no
event for this transition (open question). The re-queued assignment is then
released by diagram 3.
