---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: Proposed UML sequence diagrams for RecordObservation and Recompute, from inbound adapter to Kafka, with idempotency and version-check branches.
---

# Sequence Diagrams

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

One UML sequence diagram per command use case of the **proposed**
implementation. `UoW` is `ports.UnitOfWork`, one Postgres transaction.
`Inbox` is the `processed_events` table, `Outbox` the `outbox_events`
table; both are written inside the same transaction as the aggregate
(`conventions.integration_rules`). The relay drains the outbox to Kafka
outside that transaction. Use-case prose is on
[Use Cases](/network/contexts/node-performance/use-cases).

## 1. RecordObservation (Kafka consumer)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka<br/>consumer
    participant UC as Record<br/>Observation
    participant U as UoW,<br/>Inbox
    participant R as Scorecard<br/>Repository
    participant A as NodeScorecard
    KC->>KC: decode CloudEvent,<br/>dispatch on full type
    alt type with no use in the model
        KC->>U: insert processed_events id
        KC->>KC: commit, ack offset
    else observation type
        KC->>UC: Execute(observation)
        UC->>U: begin
        UC->>U: insert processed_events id
        alt id already present
            U-->>UC: conflict
            UC->>U: commit
            UC-->>KC: duplicate, ack
        else first delivery
            UC->>R: Get nodeId:7d and nodeId:30d
            alt scorecard missing
                R-->>UC: not found
                UC->>A: new, PROVISIONAL
            else found
                R-->>UC: scorecard, version v
            end
            UC->>A: RecordObservation<br/>on each
            alt ErrDuplicateObservation
                A-->>UC: already counted
                Note over UC: treated as success
            else counted
                A-->>UC: ok
            end
            UC->>R: Save both if<br/>version = v, due
            alt stale version
                R-->>UC: conflict
                UC->>U: rollback
                UC-->>KC: retry message
            else saved
                UC->>U: commit
                UC-->>KC: ok, ack offset
            end
        end
    end
```

Derived from: model.yaml → contexts[node-performance].aggregates[NodeScorecard]
(.commands, .invariants), .consumes; conventions.integration_rules.

Omitted: the dead-letter path for an undecodable message or a missing
`nodeId`. No outbox row is written: `RecordObservation` emits no event, so
there is no relay or Kafka publish in this diagram. The two scorecards are
saved in one transaction (see
[Entity Relationship](/network/contexts/node-performance/entity-relationship)).

## 2. Recompute (per-minute ticker)

### 2a. Recompute, save and outbox

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant T as ticker
    participant UC as Recompute
    participant U as UoW
    participant R as Scorecard<br/>Repository
    participant A as NodeScorecard
    participant OB as Outbox
    T->>UC: Execute(now)
    UC->>R: ListDue(now)
    R-->>UC: scorecard ids
    loop each due scorecard
        UC->>U: begin
        UC->>R: Get(id)
        R-->>UC: scorecard, version v
        UC->>A: Recompute(now,<br/>min, grading)
        A->>A: drop old<br/>observations
        alt a rate outside 0 to 1
            A-->>UC: ErrRateOutOfRange
            UC->>U: rollback
            Note over UC: log and skip
        else metrics valid
            alt observations below minObservations
                A->>A: state PROVISIONAL
            else enough observations
                A->>A: GRADED,<br/>Grading A to D
            end
            opt a metric crossed downward
                A->>A: ThresholdAlert<br/>adds a breach
            end
            A-->>UC: pending events
            UC->>R: Save where version = v
            alt stale version
                R-->>UC: conflict
                UC->>U: rollback
                Note over UC: stays due,<br/>next pass retries
            else saved
                UC->>OB: insert events,<br/>key scorecardId
                UC->>U: commit
            end
        end
    end
```

### 2b. Relay to Kafka

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant RL as outbox relay
    participant OB as Outbox
    participant K as Kafka
    loop poll
        RL->>OB: select unpublished,<br/>skip locked
        OB-->>RL: rows
        RL->>K: publish to<br/>retailnetwork.node-performance.events
        alt broker ack
            RL->>OB: set published_at
        else send failed
            RL->>OB: attempts + 1
        end
    end
```

Derived from: model.yaml → contexts[node-performance].aggregates[NodeScorecard]
(.commands, .transitions, .invariants, .events, .throughput_estimate),
.policies, .publishes; conventions.cloudevents (topic, key),
conventions.integration_rules.

Omitted: `ErrInsufficientObservations`, which `Recompute` never returns
(a thin window is set `PROVISIONAL` instead). The full types published are
`com.retailnetwork.partner.node-performance.scorecard.NodeScorecardUpdated`
and `com.retailnetwork.partner.node-performance.scorecard.NodeThresholdBreached`.
A relay crash after the broker ack and before `published_at` is set
republishes the same CloudEvents `id`; consumers deduplicate on it.

## Queries

The two GET routes read `ScorecardRepository` directly and touch no
aggregate method, outbox or Kafka. They are not drawn.
`GET /scorecards/{nodeId}` answers 404 `scorecard-not-found` when the node has
no scorecard; `GET /scorecards?grade=` answers 422 `invalid-grade` for an
unknown grade.
