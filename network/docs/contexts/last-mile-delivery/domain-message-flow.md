---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: Key Last-Mile Delivery scenarios as ddd-crew Domain Message Flow diagrams of commands, events and queries between contexts and actors.
---

# Domain Message Flow

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Four scenarios. Participants are contexts and actors. Every arrow is a
message from the model, prefixed `cmd:` (command), `qry:` (query) or `evt:`
(event). Events travel on Kafka through the producer's outbox; the diagrams
draw them from producer to consumer and leave Kafka out. Event names are
written `<entity>.<EventName>`; the full types are on
[Domain Events](/network/contexts/last-mile-delivery/domain-events). REST path
parameters are written without braces. The network-wide flows are on
[Domain Message Flows](/network/strategic-design/domain-message-flows).

Scenarios 2 and 3 are the happy path, from arrival to the doorstep, split in
two diagrams to stay readable. Scenario 4 is the most important failure path.

## 1. A wave is scheduled and becomes promisable

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor SP as Station planner
    participant LM as last-mile-<br/>delivery
    participant DP as delivery-<br/>promise
    participant OS as order-sourcing
    SP->>LM: cmd: ScheduleWave<br/>POST /waves
    LM-->>SP: cmd: reply 201, wave OPEN
    LM->>DP: evt: wave.<br/>DeliveryWaveScheduled
    LM->>OS: evt: wave.<br/>DeliveryWaveScheduled
    Note over DP,OS: wave now in their<br/>event-fed views
    SP->>LM: qry: GET /waves<br/>stationNodeId, serviceDate
    LM-->>SP: qry: reply waves
```

Derived from: model.yaml → `contexts[last-mile-delivery].rest`,
`.publishes[DeliveryWaveScheduled]`;
`contexts[delivery-promise].read_models[DeliveryWaveView]`;
`contexts[order-sourcing].read_models[NetworkGraphView]`.

Omitted: the `ErrInvalidWaveTimes` reply (422) and how `delivery-promise`
quotes on the wave (see [promise model](/network/network-model/promise-model)).

## 2. A load arrives and its packages are inducted

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant LH as linehaul-<br/>transportation
    participant LM as last-mile-<br/>delivery
    participant DP as delivery-<br/>promise
    participant OS as order-sourcing
    LH->>LM: evt: load.LoadArrived<br/>destinationNodeId,<br/>trackingNumbers
    Note over LM: InductOnArrival,<br/>InductPackage per package
    LM->>DP: evt: wave.<br/>DeliveryWaveCapacityChanged
    LM->>OS: evt: wave.<br/>DeliveryWaveCapacityChanged
    Note over DP,OS: remainingStops updated
```

Derived from: model.yaml → `contexts[last-mile-delivery].policies[InductOnArrival]`,
`.consumes`, `.publishes[DeliveryWaveCapacityChanged]`;
`contexts[linehaul-transportation].publishes[LoadArrived]`.

Omitted: `InboundPackagesView`, and the earliest-wave search, which skips
waves that fail with `ErrWaveFull` or `ErrInductionClosed`.

## 3. The wave is dispatched and the package is delivered

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor SP as Station planner
    actor DR as DSP driver app
    participant LM as last-mile-<br/>delivery
    participant ST as shipping-and-<br/>tracking
    participant DP as delivery-<br/>promise
    SP->>LM: cmd: CloseInduction
    SP->>LM: cmd: PlanRoute<br/>waveId, dspId, stops
    Note over LM: route.RoutePlanned,<br/>analytics only
    SP->>LM: cmd: DispatchWave
    DR->>LM: cmd: StartRoute
    LM->>ST: evt: route.<br/>PackageOutForDelivery
    DR->>LM: cmd: RecordAttempt<br/>DELIVERED
    LM->>ST: evt: route.<br/>DeliveryAttempted
    ST->>DP: evt: journey.<br/>PackageDelivered
    Note over DP: JudgeOnDelivery
```

Derived from: model.yaml → `contexts[last-mile-delivery].inbound`, `.rest`,
`.publishes`; `contexts[shipping-and-tracking].publishes[PackageDelivered]`;
`contexts[delivery-promise].policies[JudgeOnDelivery]`.

Omitted: the routes behind each command (`POST /waves/waveId:close-induction`,
`POST /routes`, `POST /waves/waveId:dispatch`, `POST /routes/routeId:start`,
`POST /routes/routeId/attempts`); `PackageOutForDelivery` is sent once per
package; `ErrRouteOverCapacity` on `PlanRoute`; `CompleteRoute` and
`CompleteWave` (no trigger in the model); the other consumers of
`PackageDelivered`.

## 4. Failed attempt, next wave, return to sender

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor DR as DSP driver app
    participant LM as last-mile-<br/>delivery
    participant ST as shipping-and-<br/>tracking
    participant DP as delivery-<br/>promise
    participant OS as order-sourcing
    DR->>LM: cmd: RecordAttempt<br/>FAILED + reason
    LM->>ST: evt: route.<br/>DeliveryAttempted
    alt first or second failure
        Note over LM: RetryNextWave,<br/>InductPackage next wave
        LM->>DP: evt: wave.<br/>DeliveryWaveCapacityChanged
        LM->>OS: evt: wave.<br/>DeliveryWaveCapacityChanged
    else third failure
        Note over LM: return to sender,<br/>no message in model
    end
    DR->>LM: cmd: RecordAttempt<br/>on a delivered package
    LM-->>DR: cmd: reply 409<br/>already-delivered
```

Derived from: model.yaml → `contexts[last-mile-delivery].policies[RetryNextWave]`,
`.aggregates[Route].invariants`, `.publishes[DeliveryAttempted]`;
`contexts[shipping-and-tracking].aggregates[PackageJourney].transitions`
(`OUT_FOR_DELIVERY` back to `AT_STATION`).

Omitted: a full or closed next wave (`ErrWaveFull`, `ErrInductionClosed`:
the policy tries the wave after); `ExceptionOnSilence` in
`shipping-and-tracking` and `RepromiseOnRisk` in `delivery-promise`. The
third-failure branch is a gap in the model. The rule exists
(`RetryNextWave`), but no command, event or state of this context carries
the return to sender, and `shipping-and-tracking` has no inbound row for it.
See the open questions on the
[Bounded Context Canvas](/network/contexts/last-mile-delivery/bounded-context-canvas).
