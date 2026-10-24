---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: Process-level EventStorming boards for Last-Mile Delivery, from wave scheduling through induction, routes and delivery attempts, with hotspots from the model's open questions.
---

# EventStorming

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Process-level EventStorming in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky is a command, aggregate, event, policy or read model of
the model. Every hotspot is a gap or risk that can be read in the model
itself; the source of each is in the hotspot table. The network-wide board is
[EventStorming big picture](/network/strategic-design/eventstorming-big-picture).

## Legend

| Sticky | Colour | Meaning here |
| --- | --- | --- |
| Actor | pale yellow `#fff9db` | Station planner, DSP driver app |
| Command | blue `#a5d8ff` | a command of an aggregate (`commands`) |
| Aggregate | yellow `#ffec99` | `DeliveryWave`, `Route`, `DeliveryServicePartner` |
| Domain Event | orange `#ffc078` | an event this context publishes or consumes |
| Policy | lilac `#d0bfff` | `InductOnArrival`, `RetryNextWave` |
| Read Model | green `#b2f2bb` | `StationView`, `InboundPackagesView` |
| External System | pink `#fcc2d7` | a sibling context |
| Hotspot | red `#ff8787` | an open question or risk from the model |

## 1. Scheduling waves and keeping station data

```mermaid
flowchart TB
    NT["node-topology"]:::external
    E0["NodeRegistered<br/>ServiceAreaAssigned"]:::event
    RM1["StationView"]:::readmodel
    SP["Station planner"]:::actor
    C1["ScheduleWave"]:::command
    G1["DeliveryWave"]:::aggregate
    E1["DeliveryWaveScheduled"]:::event
    C2["CancelWave"]:::command
    E2["DeliveryWaveCancelled"]:::event
    DP["delivery-promise<br/>order-sourcing"]:::external
    AN["analytics only"]:::external
    H1["H1 no node status<br/>reaches StationView"]:::hotspot
    H2["H2 cancelled wave<br/>not consumed"]:::hotspot
    H3["H3 CancelWave has<br/>no trigger"]:::hotspot

    NT --> E0 --> RM1
    RM1 --> C1
    SP --> C1 --> G1 --> E1 --> DP
    C2 --> G1
    G1 --> E2 --> AN
    RM1 -.- H1
    E2 -.- H2
    C2 -.- H3

    classDef actor fill:#fff9db,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[DeliveryWave]`,
`.read_models[StationView]`, `.publishes`, `.consumes`;
`contexts[delivery-promise].read_models[DeliveryWaveView]`.

Omitted: the list-waves query; the outbox between aggregate and event.

## 2. Induction on arrival

```mermaid
flowchart TB
    LH["linehaul-<br/>transportation"]:::external
    E0["LoadArrived"]:::event
    RM1["InboundPackagesView"]:::readmodel
    RM2["StationView"]:::readmodel
    P1["InductOnArrival"]:::policy
    C1["InductPackage"]:::command
    G1["DeliveryWave"]:::aggregate
    E1["DeliveryWaveCapacity<br/>Changed"]:::event
    DP["delivery-promise<br/>order-sourcing"]:::external
    SP["Station planner"]:::actor
    C2["CloseInduction"]:::command
    H4["Resolved H4: stops grouped<br/>by stopKey, no address"]:::hotspot
    H5["H5 no event when no<br/>wave is eligible"]:::hotspot

    LH --> E0 --> RM1
    E0 --> P1
    RM2 --> P1
    P1 --> C1 --> G1 --> E1 --> DP
    SP --> C2 --> G1
    C1 -.- H4
    P1 -.- H5

    classDef actor fill:#fff9db,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: model.yaml → `contexts[last-mile-delivery].policies[InductOnArrival]`,
`.read_models`, `.aggregates[DeliveryWave].invariants`,
`.publishes[DeliveryWaveCapacityChanged]`;
`contexts[linehaul-transportation].publishes[LoadArrived]`.

Omitted: the invariants `ErrWaveFull` and `ErrInductionClosed`, which make
the policy try the next wave.

## 3. Routes and dispatch

```mermaid
flowchart TB
    SP["Station planner"]:::actor
    C0["ContractPartner"]:::command
    G0["DeliveryService<br/>Partner"]:::aggregate
    C1["PlanRoute"]:::command
    G1["Route"]:::aggregate
    E1["RoutePlanned"]:::event
    AN["analytics only"]:::external
    C2["DispatchWave"]:::command
    G2["DeliveryWave"]:::aggregate
    DR["DSP driver app"]:::actor
    C3["StartRoute"]:::command
    E3["PackageOutFor<br/>Delivery"]:::event
    ST["shipping-and-<br/>tracking"]:::external
    H3["H3 CompleteRoute has<br/>no trigger"]:::hotspot

    SP --> C0 --> G0
    G0 -. van capacity .-> C1
    SP --> C1 --> G1 --> E1 --> AN
    SP --> C2 --> G2
    DR --> C3 --> G1
    G1 --> E3 --> ST
    G1 -.- H3

    classDef actor fill:#fff9db,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[Route]`,
`.aggregates[DeliveryServicePartner]`, `.aggregates[DeliveryWave].transitions`,
`.publishes[RoutePlanned, PackageOutForDelivery]`.

Omitted: `ErrRouteOverCapacity` (the van-capacity check on `PlanRoute`) and
`CompleteWave`.

## 4. Attempts and retries

```mermaid
flowchart TB
    DR["DSP driver app"]:::actor
    C1["RecordAttempt"]:::command
    G1["Route"]:::aggregate
    E1["DeliveryAttempted"]:::event
    ST["shipping-and-<br/>tracking"]:::external
    P1["RetryNextWave"]:::policy
    C2["InductPackage"]:::command
    G2["DeliveryWave"]:::aggregate
    E2["DeliveryWaveCapacity<br/>Changed"]:::event
    DP["delivery-promise<br/>order-sourcing"]:::external
    H6["H6 third failure:<br/>no counter, no event"]:::hotspot
    H7["H7 stop outcome vs<br/>per-package attempt"]:::hotspot

    DR --> C1 --> G1 --> E1 --> ST
    E1 -- FAILED --> P1
    P1 --> C2 --> G2 --> E2 --> DP
    P1 -.- H6
    G1 -.- H7

    classDef actor fill:#fff9db,stroke:#b59f00,color:#000
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#f08c00,color:#000
    classDef event fill:#ffc078,stroke:#e8590c,color:#000
    classDef policy fill:#d0bfff,stroke:#7048e8,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

Derived from: model.yaml → `contexts[last-mile-delivery].policies[RetryNextWave]`,
`.aggregates[Route].entities`, `.aggregates[Route].invariants`,
`.publishes[DeliveryAttempted]`.

Omitted: `ErrRouteNotStarted` and `ErrAlreadyDelivered`, and
`shipping-and-tracking`'s journey transitions.

## Hotspots

| # | Hotspot | Where it comes from in the model |
| --- | --- | --- |
| H1 | A suspended or retired station can still get waves. | `read_models[StationView].source` lists only `NodeRegistered`, `ServiceAreaAssigned`; `node-topology` does not list this context as a consumer of `NodeSuspended` or `NodeRetired`. `DeliveryWave.invariants` has no station check. |
| H2 | A cancelled wave may stay in the promise's view. | `publishes[DeliveryWaveCancelled].consumers` is `analytics only`; `delivery-promise.read_models[DeliveryWaveView]` reads only `DeliveryWaveScheduled`, `DeliveryWaveCapacityChanged`; `RepromiseOnRisk` names cancelled departures, not waves. |
| H3 | `CancelWave`, `CompleteWave` and `CompleteRoute` have no trigger. | They are in `aggregates[*].commands` and `transitions` but have no `rest` route, `inbound` row or policy. |
| H4 | Resolved (G11): capacity is in stops, induction is per package, and stops are grouped by the opaque `stopKey` of `LabelIssued`, never by an address. | `StopCapacity{stops, assigned}`, `Stop{stopNo, trackingNumbers[], outcome}`, `read_models[PackageStopView]`, `policies[GroupByStopKey]`; the address stays in `customer-ordering` and `shipping-and-tracking` ([ADR 0006](/network/adr/0006-pii-confinement)) and no address route exists (`policies[NoAddressAtLastMile]`). |
| H5 | When no wave is eligible, nobody hears about it. | `InductOnArrival` has no failure outcome and no event; only `shipping-and-tracking`'s `ExceptionOnSilence` would surface it later. |
| H6 | "Three failures return it to sender" has no home. | `RetryNextWave.rule`; no aggregate holds a failure count across routes; no event or command carries the return to sender; `shipping-and-tracking`'s `ReturnToSender` has no inbound trigger from this context. |
| H7 | A stop has one `outcome`, an attempt is per package. | `Route.entities` `Stop{..., outcome}` against `DeliveryAttempted.data` (`trackingNumber`, `outcome`). |
