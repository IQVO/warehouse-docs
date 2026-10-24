---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: Proposed UML class diagrams of the NodeScorecard domain model and the hexagonal ports and adapters of Node Performance.
---

# Class Diagram

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

UML class diagrams of the **proposed** Go domain model in
`internal/domain/scorecard`, followed by the hexagonal ports and adapters
in the fleet's layout. Fields are shown unexported (`-`), methods exported
(`+`). Only state-changing methods and key queries are shown.

## 1. NodeScorecard aggregate

### 1a. Root, observations and metrics

```mermaid
classDiagram
    direction TB
    class NodeScorecard {
        <<AggregateRoot>>
        -id ScorecardId
        -nodeId NodeId
        -window Window
        -state State
        -grade Grade nullable
        -metrics Metrics
        -observations Observation[]
        -computedAt time.Time
        -version int
        +RecordObservation(obs Observation) error
        +Recompute(now, minObservations, grading) error
        +PendingEvents() DomainEvent[]
    }
    class Observation {
        <<Entity>>
        -sourceEventId string
        -sourceType string
        -nodeId NodeId
        -observedAt time.Time
        -fields map
    }
    class Metrics {
        <<ValueObject>>
        -onTimeHandoverRate float64
        -lateAckRate float64
        -rejectRate float64
        -expiryRate float64
        -promiseKeptRate float64
        -feedFreshnessP95Minutes float64
        -observations int
        +NewMetrics(...)$ Metrics
    }
    NodeScorecard "1" *-- "0..*" Observation : observations
    NodeScorecard *-- Metrics
```

### 1b. Identity and enumerations

```mermaid
classDiagram
    direction LR
    class NodeScorecard {
        <<AggregateRoot>>
    }
    class ScorecardId {
        <<ValueObject>>
        nodeId plus window
    }
    class NodeId {
        <<ValueObject>>
        string
    }
    class Window {
        <<Enumeration>>
        7d
        30d
    }
    class State {
        <<Enumeration>>
        PROVISIONAL
        GRADED
    }
    class Grade {
        <<Enumeration>>
        A
        B
        C
        D
    }
    NodeScorecard --> ScorecardId : identity
    NodeScorecard --> NodeId
    NodeScorecard --> Window
    NodeScorecard --> State
    NodeScorecard --> Grade : 0..1
```

Derived from: model.yaml → contexts[node-performance].aggregates[NodeScorecard]
(.root_id, .states, .value_objects, .commands, .invariants, .size_estimate).

Omitted: the errors. `NewMetrics` returns `ErrRateOutOfRange`;
`Recompute` returns `ErrInsufficientObservations` only on a path that
would grade a thin window; `RecordObservation` returns
`ErrDuplicateObservation`. `Observation` is this page's name for the
collection the model implies (no entity is listed); `fields` holds the
source event's data fields a metric reads. `version` is the proposed
optimistic-concurrency counter. The `7d` and `30d` literals are proposed.
`PROVISIONAL` is a `State`; when the state is `PROVISIONAL` the published
`grade` is the string `PROVISIONAL` and `grade` here is empty.

## 2. Events, policies and repository

### 2a. Domain events

```mermaid
classDiagram
    direction LR
    class NodeScorecard {
        <<AggregateRoot>>
    }
    class NodeScorecardUpdated {
        <<DomainEvent>>
        +nodeId string
        +window string
        +grade string
        +onTimeHandoverRate float64
        +lateAckRate float64
        +rejectRate float64
        +expiryRate float64
        +promiseKeptRate float64
        +feedFreshnessP95Minutes float64
        +observations int
        +computedAt time.Time
    }
    class NodeThresholdBreached {
        <<DomainEvent>>
        +nodeId string
        +metric string
        +value float64
        +threshold float64
        +window string
    }
    NodeScorecard ..> NodeScorecardUpdated : raises
    NodeScorecard ..> NodeThresholdBreached : raises
```

### 2b. Policies and repository

```mermaid
classDiagram
    direction TB
    class NodeScorecard {
        <<AggregateRoot>>
    }
    class Grading {
        <<Policy>>
        +GradeFor(m Metrics) Grade
    }
    class ThresholdAlert {
        <<Policy>>
        +Crossed(previous, current Metrics) string[]
    }
    class ScorecardRepository {
        <<Repository>>
        +Get(ctx, id ScorecardId) NodeScorecard
        +ListByNode(ctx, nodeId) NodeScorecard[]
        +ListByGrade(ctx, grade) NodeScorecard[]
        +ListDue(ctx, now) ScorecardId[]
        +Save(ctx, s NodeScorecard) error
    }
    NodeScorecard ..> Grading : uses in Recompute
    NodeScorecard ..> ThresholdAlert : uses in Recompute
    ScorecardRepository ..> NodeScorecard : persists
```

Derived from: model.yaml → contexts[node-performance].policies,
.publishes[].data, .rest.

Omitted: the `Grading` thresholds (on the
[Bounded Context Canvas](/network/contexts/node-performance/bounded-context-canvas));
`ThresholdAlert` has no threshold table in the model.

## 3. Hexagonal ports and adapters

```mermaid
flowchart TB
    subgraph IN["internal/adapters/inbound"]
        HTTP["http<br/>GET /scorecards/nodeId<br/>GET /scorecards?grade="]
        KC["kafka<br/>consumers, 5 topics"]
    end
    TICK["cmd/node-performance<br/>per-minute ticker"]
    subgraph APP["internal/application"]
        UC1["usecases.RecordObservation"]
        UC2["usecases.Recompute"]
        PORTS["ports.ScorecardRepository<br/>ports.Inbox, ports.Outbox<br/>ports.UnitOfWork, ports.Clock"]
    end
    DOM["internal/domain/scorecard<br/>NodeScorecard"]
    subgraph OUT["internal/adapters/outbound"]
        PG["postgres<br/>repo, outbox, inbox, UoW"]
        KR["kafka<br/>outbox relay"]
    end
    KC --> UC1
    TICK --> UC2
    HTTP -. reads .-> PORTS
    UC1 --> DOM
    UC2 --> DOM
    UC1 --> PORTS
    UC2 --> PORTS
    PORTS --- PG
    PG --> KR
```

Derived from: model.yaml → contexts[node-performance].rest, .consumes,
.aggregates[NodeScorecard].commands, .throughput_estimate;
conventions.integration_rules.

Omitted: `Clock` is satisfied in the composition root and has no adapter
package. The HTTP adapter reads the repository directly, because both
routes are pure reads (the fleet's convention). There is no outbound HTTP
client: `sync_calls` is empty. The relay reads `outbox_events` and
publishes to `retailnetwork.node-performance.events`.
