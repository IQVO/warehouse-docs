---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: "One UML sequence per key Customer Returns use case, from inbound adapter through aggregate, repository and outbox."
---

# Sequence Diagrams

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built ([`IQVO/customer-returns`](https://github.com/IQVO/customer-returns), decided by [ADR 0012](/network/adr/0012-customer-returns-is-a-bounded-context)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses. Where the model left a choice open, the service's own ADRs 0001 to 0005 record what it does.
:::

Shared conventions: `Repo` saves with an optimistic version check; `Outbox`
rows are written in the same database transaction as the aggregate; a relay
produces them to Kafka `retailnetwork.customer-returns.events`. Consumers claim
the CloudEvents `id` in `processed_events` in the same transaction as their
effect. Event names are short; the full types are on
[Domain Events](/network/contexts/customer-returns/domain-events).

## 1. AuthorizeReturn

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http POST authorizations
    participant UC as AuthorizeReturn
    participant V as read models
    participant A as ReturnAuthorization
    participant R as AuthorizationRepo
    participant OB as Outbox
    H->>UC: Execute(orderId, groupNo, lines, reason, key)
    UC->>V: group from OrderGroupView
    alt unknown or not shipped
        UC-->>H: 422 group-not-shipped
    else SHIPPED or DELIVERED
        UC->>V: returns centre and origin node
        UC->>A: Decide, then Authorize
        alt no destination
            A-->>UC: ErrNoReturnDestination
            UC-->>H: 422 no-return-destination
        else decided
            A-->>UC: AUTHORIZED or CLOSED_KEEP<br/>and ReturnAuthorized
            UC->>R: Save
            UC->>OB: write event in the same transaction
            UC-->>H: 201 authorization
        end
    end
```

## 2. IssueLabel

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http POST labels
    participant UC as IssueLabel
    participant R as AuthorizationRepo
    participant L as label client
    participant A as ReturnAuthorization
    participant OB as Outbox
    H->>UC: Execute(authorizationId, packageNo, key)
    UC->>R: Get(authorizationId)
    Note over UC: expired: cancel and answer<br/>422 authorization-expired
    Note over UC: not AUTHORIZED or KEEP:<br/>409 illegal-transition
    UC->>L: reverse label for the package<br/>outside the transaction
    alt not configured, or no tracking number
        L-->>UC: ErrLabelUnavailable
        UC-->>H: 422 label-unavailable
    else tracking number returned
        UC->>R: Get again, inside the transaction
        UC->>A: LinkLabel(trackingNumber)
        A-->>UC: ReturnLabelIssued
        UC->>R: Save
        UC->>OB: write event in the same transaction
        UC-->>H: 200 authorization
    end
```

As built the first branch is the one taken: the route is not in
`shipping-and-tracking`'s `develop` contract (policy `ReverseLabelCall`).

## 3. ApplyOutcome (consumer)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant K as Kafka
    participant C as consumer
    participant IB as processed_events
    participant UC as outcome use case
    participant A as ReturnAuthorization
    participant F as ReturnOutcomeFacts
    participant OB as Outbox
    K->>C: the vendor's graded outcome
    C->>IB: claim event id
    alt already processed
        IB-->>C: duplicate
        C-->>K: ack and skip
    else new
        C->>UC: Execute(outcome)
        alt unknown, closed, or no covered line
            UC->>F: record the outcome as a fact
        else open and covered
            UC->>A: ApplyOutcome(covered lines)
            A-->>UC: RECEIVED and ReturnCompleted
            UC->>F: record, other lines flagged unexpected
            UC->>OB: ReturnCompleted in the same transaction
        end
        C-->>K: ack after commit
    end
```

Not triggered today: the producer of the graded outcome is not on `develop`
(policy `FirstFittingOutcomeCompletes`).

## 4. CancelReturn

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http POST cancellations
    participant UC as CancelReturn
    participant A as ReturnAuthorization
    participant R as AuthorizationRepo
    participant OB as Outbox
    H->>UC: Execute(authorizationId, key)
    UC->>R: Get(authorizationId)
    UC->>A: Cancel(SHOPPER_REQUESTED, or EXPIRED when past expiresAt)
    alt not AUTHORIZED
        A-->>UC: ErrIllegalTransition
        UC-->>H: 409 illegal-transition
    else AUTHORIZED
        A-->>UC: CANCELLED and ReturnCancelled
        UC->>R: Save
        UC->>OB: write event in the same transaction
        UC-->>H: 200 authorization
    end
```

Derived from: model.yaml → contexts[customer-returns].aggregates[ReturnAuthorization]
(`commands`, `invariants`), .policies, .publishes; `conventions.integration_rules`.
