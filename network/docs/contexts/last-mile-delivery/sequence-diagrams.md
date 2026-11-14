---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: Proposed UML sequence diagrams for every Last-Mile Delivery command, from inbound adapter through aggregate, repository and outbox to Kafka.
---

# Sequence Diagrams

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One UML sequence diagram per command use case on
[Use Cases](/network/contexts/last-mile-delivery/use-cases). The participants are the
proposed hexagonal pieces:

| Participant | Piece |
| --- | --- |
| `http` / `kafka consumer` | inbound adapter: `internal/adapters/inbound/http` or `internal/adapters/inbound/kafka` |
| use case (named after the command) | `internal/application/usecases` |
| aggregate (`DeliveryWave`, `Route`, `DeliveryServicePartner`) | `internal/domain/{wave,route,partner}` |
| `WaveRepo`, `RouteRepo`, `PartnerRepo` | repository ports, implemented in `internal/adapters/outbound/postgres` |
| `outbox` | the `outbox_events` table, written in the same transaction as the repository |
| `relay to Kafka` | the outbox relay in `internal/adapters/outbound/kafka`, publishing to topic `retailnetwork.last-mile-delivery.events`; drawn as one participant to keep each diagram at six participants |

Every save checks the row `version` it loaded (optimistic concurrency). A
mismatch rolls the transaction back and returns 409 `concurrent-update`, or, in
a consumer, retries. Every REST `POST` first looks up its `Idempotency-Key`
in `idempotency_keys`: the key is global, a 2xx and a 4xx answer are stored,
and the same key with another request is 409 `idempotency-key-reused`
(last-mile-delivery ADR 0010; the use-cases page has the details). Event names are broken over two
lines inside the diagrams to keep them narrow. REST path parameters are
written without braces.

## 1. ScheduleWave

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant HTTP as http
    participant UC as ScheduleWave
    participant AGG as DeliveryWave
    participant REPO as WaveRepo
    participant OB as outbox
    participant K as relay to Kafka
    HTTP->>UC: POST /waves<br/>Idempotency-Key
    alt key stored
        UC-->>HTTP: stored reply
    else new key
        UC->>REPO: station in<br/>StationView?
        alt unknown or not a station
            UC-->>HTTP: 422 unknown-<br/>station
        else known station
        UC->>AGG: ScheduleWave
        alt times out of order
            AGG-->>UC: ErrInvalid<br/>WaveTimes
            UC-->>HTTP: 422 invalid-<br/>wave-times
        else valid
            AGG-->>UC: wave OPEN
            UC->>REPO: begin tx,<br/>insert wave
            UC->>OB: DeliveryWave<br/>Scheduled
            UC->>REPO: store key,<br/>commit
            UC-->>HTTP: 201 wave
        end
        end
    end
    K->>OB: relay claims rows
    K->>K: publish to Kafka,<br/>key waveId
    K->>OB: mark published
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[DeliveryWave]`,
`.rest`, `.publishes[DeliveryWaveScheduled]`, `conventions.integration_rules`.

The station check against `StationView` is a precondition of the use case
(ADR 0002 A1), not an invariant of the aggregate. After the commit the
packages waiting at the station are inducted into the new wave (A19).

## 2. InductPackage (InductOnArrival)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as InductPackage
    participant REPO as WaveRepo
    participant AGG as DeliveryWave
    participant OB as outbox
    participant K as relay to Kafka
    KC->>UC: LoadArrived
    alt id in processed_events
        UC-->>KC: ack, no-op
    else not a station
        UC-->>KC: claim id, ignore
    else station
        UC->>REPO: record rm_<br/>inbound_packages
        loop each trackingNumber
            UC->>REPO: OPEN waves<br/>after arrivedAt
            loop earliest wave first
                UC->>AGG: InductPackage
                alt full or closed
                    AGG-->>UC: ErrWaveFull or<br/>ErrInductionClosed
                else already inducted
                    AGG-->>UC: no-op
                else inducted
                    UC->>REPO: begin tx, save,<br/>version check
                    UC->>OB: DeliveryWave<br/>CapacityChanged
                    UC->>REPO: commit
                end
            end
        end
        UC->>REPO: claim id
        UC-->>KC: ack
    end
    OB->>K: relay publishes,<br/>key waveId
```

Derived from: model.yaml → `contexts[last-mile-delivery].policies[InductOnArrival]`,
`.aggregates[DeliveryWave].invariants`, `.read_models[InboundPackagesView]`,
`.publishes[DeliveryWaveCapacityChanged]`.

Each induction is its own transaction and is a no-op for a package already
in `wave_inductions`, so a crash part way through a load resumes without
double counting; the CloudEvents `id` is claimed after the last package. On
a version conflict the package is retried. A full or closed wave sends the
loop to the next wave. Omitted: a package that no wave accepts stays only in
`rm_inbound_packages`; the model has no event for it. The `RetryNextWave`
path runs the same loop, triggered by a `FAILED` attempt (diagram 9).

## 3. CloseInduction

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant HTTP as http
    participant UC as CloseInduction
    participant REPO as WaveRepo
    participant AGG as DeliveryWave
    HTTP->>UC: POST /waves/waveId/induction-closures
    alt key stored
        UC-->>HTTP: stored reply
    else new key
        UC->>REPO: get waveId
        alt not found
            UC-->>HTTP: 404 not-found
        else found
            UC->>AGG: CloseInduction
            alt not OPEN
                UC-->>HTTP: 409 illegal-transition
            else OPEN
                UC->>REPO: save,<br/>version check
                alt version changed
                    UC-->>HTTP: 409 concurrent-update
                else saved
                    UC-->>HTTP: 200 INDUCTION_<br/>CLOSED
                end
            end
        end
    end
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[DeliveryWave].transitions`,
`.rest`. No event: the model has none for this transition, so there is no
outbox write and nothing for the relay.

## 4. DispatchWave

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant HTTP as http
    participant UC as DispatchWave
    participant REPO as WaveRepo
    participant AGG as DeliveryWave
    HTTP->>UC: POST /waves/waveId/dispatches
    alt key stored
        UC-->>HTTP: stored reply
    else new key
        UC->>REPO: get waveId
        alt not found
            UC-->>HTTP: 404 not-found
        else found
            UC->>AGG: DispatchWave
            alt not INDUCTION_CLOSED
                UC-->>HTTP: 409 illegal-transition
            else ok
                UC->>REPO: save,<br/>version check
                alt version changed
                    UC-->>HTTP: 409 concurrent-update
                else saved
                    UC-->>HTTP: 200 DISPATCHED
                end
            end
        end
    end
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[DeliveryWave].transitions`,
`.rest`. No event, so no outbox write.

## 5. CompleteWave

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant T as CompleteRoute or<br/>DispatchWave
    participant UC as CompleteWave
    participant REPO as WaveRepo
    participant AGG as DeliveryWave
    T->>UC: last route COMPLETED,<br/>or no route at dispatch
    UC->>REPO: get waveId
    UC->>AGG: CompleteWave
    AGG-->>UC: COMPLETED
    UC->>REPO: save, version check,<br/>same transaction as the trigger
```

Derived from: ADR 0002 A9 and `contexts[last-mile-delivery].aggregates[DeliveryWave].transitions`
(`DISPATCHED` → `COMPLETED`). There is no REST route and no caller: the wave
completes in the transaction in which its last route completes, or at once
when it is dispatched with no route (the dispatch response may then show
`COMPLETED`). No event.

## 6. CancelWave

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant HTTP as http
    participant UC as CancelWave
    participant REPO as WaveRepo
    participant AGG as DeliveryWave
    participant OB as outbox
    participant K as relay to Kafka
    HTTP->>UC: POST /waves/waveId/<br/>cancellations<br/>Idempotency-Key, reason
    alt key stored
        UC-->>HTTP: stored reply
    else new key
        UC->>REPO: get waveId
        alt not found
            UC-->>HTTP: 404 not-found
        else found
            UC->>AGG: CancelWave
            alt reason empty or too long
                UC-->>HTTP: 422 validation-failed
            else not OPEN, also CANCELLED
                UC-->>HTTP: 409 illegal-transition
            else OPEN
                UC->>REPO: begin tx, re-induct each<br/>package onto the next wave
                UC->>REPO: save, version check
                UC->>OB: DeliveryWave<br/>Cancelled
                UC->>REPO: store key, commit
                UC-->>HTTP: 200 CANCELLED
            end
        end
    end
    OB->>K: relay publishes,<br/>key waveId
```

Derived from: ADR 0002 A10, A22, `contexts[last-mile-delivery].aggregates[DeliveryWave].transitions`,
`.publishes[DeliveryWaveCancelled]`.

A package with no eligible wave is unplaced and raises
`PackageInductionDeferred`. A second cancel of a `CANCELLED` wave is 409
`illegal-transition`: the wave stays `CANCELLED` and no second
`DeliveryWaveCancelled` is raised. A version conflict is 409
`concurrent-update` (omitted from the diagram).

## 7. PlanRoute

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant HTTP as http
    participant UC as PlanRoute
    participant REPO as Partner, Wave,<br/>RouteRepo
    participant AGG as Route
    participant OB as outbox
    participant K as relay to Kafka
    HTTP->>UC: POST /routes<br/>Idempotency-Key
    alt key stored
        UC-->>HTTP: stored reply
    else new key
        UC->>REPO: get dspId,<br/>get waveId
        alt missing
            UC-->>HTTP: 404 not-found
        else found
            UC->>AGG: PlanRoute
            alt wave not INDUCTION_CLOSED
                UC-->>HTTP: 409 illegal-<br/>transition
            else partner or package rule broken
                UC-->>HTTP: 409 partner-inactive,<br/>partner-station-mismatch,<br/>package-not-inducted,<br/>package-already-routed,<br/>stop-key-mismatch
            else over van capacity
                AGG-->>UC: ErrRoute<br/>OverCapacity
                UC-->>HTTP: 409 route-<br/>over-capacity
            else ok
                UC->>REPO: begin tx,<br/>insert route
                UC->>OB: RoutePlanned
                UC->>REPO: store key,<br/>commit
                UC-->>HTTP: 201 PLANNED
            end
        end
    end
    OB->>K: relay publishes,<br/>key routeId
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[Route]`,
`.aggregates[DeliveryServicePartner].invariants`, `.publishes[RoutePlanned]`.

The partner and the wave are read, not changed, and are not part of the
transaction. The preconditions are those of ADR 0002 A12.

## 8. StartRoute

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant HTTP as http
    participant UC as StartRoute
    participant REPO as RouteRepo
    participant AGG as Route
    participant OB as outbox
    participant K as relay to Kafka
    HTTP->>UC: POST /routes/<br/>routeId/starts
    alt key stored
        UC-->>HTTP: stored reply
    else new key
        UC->>REPO: get routeId
        alt not found
            UC-->>HTTP: 404 not-found
        else found
            UC->>AGG: StartRoute
            alt not PLANNED
                UC-->>HTTP: 409 illegal-transition
            else ok
                UC->>REPO: begin tx, save,<br/>version check
                loop each trackingNumber
                    UC->>OB: PackageOut<br/>ForDelivery
                end
                alt version changed
                    UC->>REPO: rollback
                    UC-->>HTTP: 409 concurrent-update
                else saved
                    UC->>REPO: commit
                    UC-->>HTTP: 200 OUT_FOR_<br/>DELIVERY
                end
            end
        end
    end
    OB->>K: relay publishes,<br/>key routeId
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[Route].transitions`,
`.publishes[PackageOutForDelivery]`. The route's wave must be `DISPATCHED`
(ADR 0002 A14), else 409 `illegal-transition`.

## 9. RecordAttempt

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant HTTP as http
    participant UC as RecordAttempt
    participant REPO as RouteRepo
    participant AGG as Route
    participant OB as outbox
    participant K as relay to Kafka
    HTTP->>UC: POST /routes/<br/>routeId/attempts
    alt key stored
        UC-->>HTTP: stored reply
    else new key
        UC->>REPO: get routeId
        UC->>AGG: RecordAttempt
        alt package not on the route
            AGG-->>UC: ErrPackage<br/>NotOnRoute
            UC-->>HTTP: 404 package-<br/>not-on-route
        else not OUT_FOR_DELIVERY
            AGG-->>UC: ErrRoute<br/>NotStarted
            UC-->>HTTP: 409 route-<br/>not-started
        else already DELIVERED
            AGG-->>UC: ErrAlready<br/>Delivered
            UC-->>HTTP: 409 already-<br/>delivered
        else already FAILED
            UC-->>HTTP: 409 attempt-already-<br/>recorded
        else recorded
            UC->>REPO: begin tx, save,<br/>version check
            UC->>OB: Delivery<br/>Attempted
            UC->>REPO: store key,<br/>commit
            UC-->>HTTP: 201 attempt
        end
    end
    OB->>K: relay publishes,<br/>key routeId
    opt outcome FAILED
        Note over UC: RetryNextWave runs<br/>diagram 2 in its own tx
    end
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[Route].invariants`,
`.policies[RetryNextWave]`, `.publishes[DeliveryAttempted]`.

Omitted: 404 `not-found` for an unknown route and the `concurrent-update`
branch (as in diagram 8). When the attempt is the last outstanding package the
route completes in the same unit of work (diagram 10). The third failure
raises `PackageReturnInitiated` and the package is not re-inducted (ADR 0002
A18).

## 10. CompleteRoute

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant T as RecordAttempt<br/>(last package)
    participant UC as CompleteRoute
    participant REPO as RouteRepo
    participant AGG as Route
    T->>UC: CompleteRouteOnLastAttempt
    UC->>AGG: CompleteRoute
    alt a package has no attempt
        AGG-->>UC: ErrRoute<br/>Incomplete
    else all packages attempted
        UC->>REPO: second save in the<br/>same unit of work
        UC-->>T: COMPLETED
    end
```

Derived from: ADR 0002 A16 and `contexts[last-mile-delivery].aggregates[Route].transitions`.
There is no REST route and no caller: the route completes right after the
attempt that records its last outstanding package (policy
`CompleteRouteOnLastAttempt`), and the wave completes when its last route does
(diagram 5). The domain refuses it with `ErrRouteIncomplete` (409
`route-incomplete`) while a package has no attempt. No event.

## 11. ContractPartner

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant HTTP as http
    participant UC as ContractPartner
    participant AGG as DeliveryService<br/>Partner
    participant REPO as PartnerRepo
    HTTP->>UC: POST /partners<br/>Idempotency-Key
    alt key stored
        UC-->>HTTP: stored reply
    else new key
        UC->>REPO: station in<br/>StationView?
        alt unknown or not a station
            UC-->>HTTP: 422 unknown-<br/>station
        else known station
        UC->>AGG: ContractPartner
        alt vanCapacity not above 0
            AGG-->>UC: ErrInvalid<br/>VanCapacity
            UC-->>HTTP: 422 invalid-<br/>van-capacity
        else ok
            UC->>REPO: insert ACTIVE,<br/>store key
            UC-->>HTTP: 201 partner
        end
        end
    end
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[DeliveryServicePartner]`,
`.rest`. No event (`events: []`), so there is no outbox write.
