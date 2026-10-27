---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: One proposed UML sequence diagram per Linehaul Transportation command use case, from the inbound adapter through the aggregate, repository and outbox to Kafka.
---

# Sequence Diagrams

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One UML sequence diagram per command use case of
[Use Cases](/network/contexts/linehaul-transportation/use-cases), in the proposed
hexagonal layout: inbound adapter → use case → aggregate → repository →
outbox (same transaction) → relay → Kafka. The relay and Kafka share one
lifeline ("relay to Kafka") to keep each diagram at six participants or
fewer. `alt` blocks show error
branches, optimistic-concurrency `version` checks and idempotency (REST
`Idempotency-Key`, Kafka inbox on the CloudEvents `id`). Problem slugs with
no `Err...` in the model (`not-found`, `invalid-state-transition`,
`concurrent-modification`) are proposed placeholders. Route parameters are
written without braces. The relay always publishes to
`retailnetwork.linehaul-transportation.events`, keyed by the aggregate root
id.

## 1. ScheduleDeparture

Triggered by `GenerateDepartures` or by `PickupFromCutoffs`; the caller here is the Kafka consumer reacting to `NodeOperationalProfileDeclared`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as kafka<br/>consumer
    participant U as use case
    participant A as Departure
    participant R as Departure<br/>Repository
    participant O as outbox
    participant RL as relay to Kafka
    H->>U: ScheduleDeparture lane, kind, times, packages
    U->>R: Get deterministic departureId
    alt already exists
        R-->>U: departure
        U-->>H: no-op, idempotent
    else new
        U->>U: LaneView status of laneId
        alt lane CLOSED
            U-->>H: ErrLaneClosed, logged
        else lane OPEN
            U->>A: ScheduleDeparture
            alt cutoffAt le departsAt lt arrivesAt fails
                A-->>U: ErrInvalidDepartureTimes
                U-->>H: refused, logged
            else valid
                A-->>U: Departure SCHEDULED
                Note over U,O: one transaction
                U->>R: insert departure
                U->>O: insert DepartureScheduled
                U->>O: insert processed_events row
                U-->>H: ok
            end
        end
    end
    Note over O,RL: after commit
    RL->>O: claim unpublished rows
    Note over RL: publish to retailnetwork.<br/>linehaul-transportation.events
    RL->>O: mark published
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Departure]` (`commands`, `invariants`), `.policies[PickupFromCutoffs, HorizonRoll]`, `conventions.integration_rules`.

Omitted: the inbox check that precedes the call (shown in diagram 2); when `GenerateDepartures` is the caller there is no `processed_events` row. `le` / `lt` stand for `<=` / `<`.

## 2. BookCapacity

Policy `BookOnLock` on `FulfillmentLocked`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as kafka<br/>consumer
    participant U as use case
    participant A as Departure
    participant R as Departure<br/>Repository
    participant O as outbox
    participant RL as relay to Kafka
    H->>U: FulfillmentLocked event id, pickupDepartureId
    U->>O: processed_events contains event id?
    alt already processed
        U-->>H: ack, no effect
    else new
        U->>R: Get pickupDepartureId with version
        U->>A: BookCapacity now
        alt now after cutoffAt
            A-->>U: ErrDepartureClosed
            U->>O: insert processed_events row
            U-->>H: ack, refusal logged
        else booked plus one above packages
            A-->>U: ErrDepartureFull
            U->>O: insert processed_events row
            U-->>H: ack, refusal logged
        else room left
            A-->>U: booked plus one
            Note over U,O: one transaction
            U->>R: update where version matches
            alt version changed
                R-->>U: conflict
                U-->>H: rollback, redeliver
            else saved
                U->>O: insert DepartureCapacityChanged
                U->>O: mark assignment booked, insert processed_events row
                U-->>H: ack
            end
        end
    end
    Note over O,RL: after commit
    RL->>O: claim unpublished rows
    Note over RL: publish to retailnetwork.<br/>linehaul-transportation.events
    RL->>O: mark published
```

Derived from: `model.yaml → contexts[linehaul-transportation].policies[BookOnLock]`, `.aggregates[Departure].invariants`, `conventions.integration_rules`.

Omitted: the read-model write is shown as part of the outbox step for width; it is a row in `rm_expected_volume`, same transaction. The model names no follow-up for the two refusals.

## 3. ReleaseCapacity

Policy `BookOnLock` on `FulfillmentCancelled` or `FulfillmentReassigned`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as kafka<br/>consumer
    participant U as use case
    participant A as Departure
    participant R as Departure<br/>Repository
    participant O as outbox
    participant RL as relay to Kafka
    H->>U: FulfillmentCancelled or Reassigned
    U->>O: processed_events contains event id?
    alt already processed
        U-->>H: ack, no effect
    else no booking recorded for assignmentId
        U->>O: insert processed_events row
        U-->>H: ack, nothing to release
    else booking recorded
        U->>R: Get departure with version
        U->>A: ReleaseCapacity
        A-->>U: booked minus one
        Note over U,O: one transaction
        U->>R: update where version matches
        alt version changed
            U-->>H: rollback, redeliver
        else saved
            U->>O: insert DepartureCapacityChanged
            U->>O: clear booking, insert processed_events row
            U-->>H: ack
        end
    end
    Note over O,RL: after commit
    RL->>O: claim unpublished rows
    Note over RL: publish to retailnetwork.<br/>linehaul-transportation.events
    RL->>O: mark published
```

Derived from: `model.yaml → contexts[linehaul-transportation].policies[BookOnLock]`; `contexts[order-sourcing].aggregates[FulfillmentAssignment].invariants`.

Omitted: in the model as written the "no booking recorded" branch is the only reachable one, because `order-sourcing` cancels and reassigns only before `LOCKED`.

## 4. CloseDeparture

No trigger is named in the model; the caller is drawn as a generic adapter.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as caller<br/>unnamed
    participant U as use case
    participant A as Departure
    participant R as Departure<br/>Repository
    participant O as outbox
    participant RL as relay to Kafka
    H->>U: CloseDeparture departureId
    U->>R: Get with version
    alt not found
        U-->>H: 404 not-found
    else found
        U->>A: CloseDeparture
        alt state CLOSED already
            A-->>U: unchanged, idempotent
        else state not SCHEDULED
            A-->>U: 409 invalid-state-transition
        else SCHEDULED
            A-->>U: CLOSED
            U->>R: update where version matches
            alt version changed
                U-->>H: 409 concurrent-modification
            else saved
                U-->>H: ok
            end
        end
    end
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Departure].transitions`.

Omitted: no outbox row: the model lists no event for `CloseDeparture`, so the relay and Kafka are not involved.

## 5. RecordDeparture

No trigger is named in the model.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as caller<br/>unnamed
    participant U as use case
    participant A as Departure
    participant R as Departure<br/>Repository
    participant O as outbox
    participant RL as relay to Kafka
    H->>U: RecordDeparture departureId, at
    U->>R: Get with version
    alt not found
        U-->>H: 404 not-found
    else found
        U->>A: RecordDeparture
        alt state DEPARTED already
            A-->>U: unchanged, idempotent
        else state not CLOSED
            A-->>U: 409 invalid-state-transition
        else CLOSED
            A-->>U: DEPARTED
            Note over U,O: one transaction
            U->>R: update where version matches
            alt version changed
                R-->>U: conflict
                U-->>H: 409 concurrent-modification
            else saved
                U->>O: insert DepartureDeparted
                U-->>H: ok
            end
        end
    end
    Note over O,RL: after commit
    RL->>O: claim unpublished rows
    Note over RL: publish to retailnetwork.<br/>linehaul-transportation.events
    RL->>O: mark published
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Departure]`, `.publishes[DepartureDeparted]`.

Omitted: the caller is unnamed in the model (a reported gap).

## 6. RecordArrival

No trigger is named in the model.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as caller<br/>unnamed
    participant U as use case
    participant A as Departure
    participant R as Departure<br/>Repository
    participant O as outbox
    participant RL as relay to Kafka
    H->>U: RecordArrival departureId, at
    U->>R: Get with version
    alt not found
        U-->>H: 404 not-found
    else found
        U->>A: RecordArrival
        alt state ARRIVED already
            A-->>U: unchanged, idempotent
        else state not DEPARTED
            A-->>U: 409 invalid-state-transition
        else DEPARTED
            A-->>U: ARRIVED
            Note over U,O: one transaction
            U->>R: update where version matches
            alt version changed
                R-->>U: conflict
                U-->>H: 409 concurrent-modification
            else saved
                U->>O: insert DepartureArrived
                U-->>H: ok
            end
        end
    end
    Note over O,RL: after commit
    RL->>O: claim unpublished rows
    Note over RL: publish to retailnetwork.<br/>linehaul-transportation.events
    RL->>O: mark published
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Departure]`, `.publishes[DepartureArrived]`.

Omitted: the caller is unnamed in the model (a reported gap).

## 7. CancelDeparture

From the planner over REST; `PickupFromCutoffs` calls the same use case from the Kafka consumer on `NodeSuspended` or `NodeRetired`, once per future pickup.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http<br/>handler
    participant U as use case
    participant A as Departure
    participant R as Departure<br/>Repository
    participant O as outbox
    participant RL as relay to Kafka
    H->>U: POST departures/id:cancel<br/>reason, Idempotency-Key
    U->>O: idempotency_keys has key?
    alt key seen
        U-->>H: stored response
    else new key
        U->>R: Get with version
        alt not found
            U-->>H: 404 not-found
        else found
            U->>A: CancelDeparture reason, now
            alt state CANCELLED already
                A-->>U: unchanged
                U-->>H: 200 departure
            else state not SCHEDULED
                A-->>U: 409 invalid-state-transition
            else SCHEDULED
                A-->>U: CANCELLED
                Note over U,O: one transaction
                U->>R: update where version matches
                alt version changed
                    U-->>H: 409 concurrent-modification
                else saved
                    U->>O: insert DepartureCancelled
                    U->>O: store idempotency key
                    U-->>H: 200 departure
                end
            end
        end
    end
    Note over O,RL: after commit
    RL->>O: claim unpublished rows
    Note over RL: publish to retailnetwork.<br/>linehaul-transportation.events
    RL->>O: mark published
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Departure]`, `.inbound`, `.rest`, `.policies[PickupFromCutoffs]`, `.publishes[DepartureCancelled]`.

Omitted: the Kafka-driven path, which replaces the idempotency key by the inbox row. The idempotency store is drawn on the outbox lifeline for width; it is the `idempotency_keys` table.

## 8. DefineLaneSchedule

From the planner over REST.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http<br/>handler
    participant U as use case
    participant A as LaneSchedule
    participant R as LaneSchedule<br/>Repository
    participant O as idempotency<br/>keys
    H->>U: POST lane-schedules<br/>laneId, slots, Idempotency-Key
    U->>O: key seen?
    alt key seen
        U-->>H: stored response
    else new key
        U->>U: LaneView has laneId?
        alt unknown lane
            U-->>H: 404 not-found
        else known
            U->>A: DefineLaneSchedule laneId, slots
            alt slots overlap
                A-->>U: ErrOverlappingSlots
                U-->>H: 422 overlapping-slots
            else valid
                A-->>U: LaneSchedule ACTIVE
                Note over U,R: one transaction
                U->>R: upsert schedule and slots
                U->>O: store key
                U-->>H: 201 schedule
            end
        end
    end
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[LaneSchedule]`, `.inbound`, `.rest`.

Omitted: no outbox, relay or Kafka: `LaneSchedule` raises no event. A `RETIRED` schedule for the lane answers 409 `invalid-state-transition` (not drawn).

## 9. RetireLaneSchedule

Over REST; the `inbound` rows do not name the actor.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http<br/>handler
    participant U as use case
    participant A as LaneSchedule
    participant R as LaneSchedule<br/>Repository
    H->>U: POST lane-schedules/laneId:retire<br/>Idempotency-Key
    U->>R: Get laneId with version
    alt not found
        U-->>H: 404 not-found
    else found
        U->>A: RetireLaneSchedule
        alt RETIRED already
            A-->>U: unchanged
            U-->>H: 200 schedule
        else ACTIVE
            A-->>U: RETIRED
            U->>R: update where version matches
            alt version changed
                U-->>H: 409 concurrent-modification
            else saved
                U-->>H: 200 schedule
            end
        end
    end
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[LaneSchedule].transitions`, `.rest`.

Omitted: the idempotency-key check (as in diagram 8); no outbox row, no event.

## 10. GenerateDepartures

Nightly, policy `HorizonRoll`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant T as scheduler
    participant U as use case
    participant S as LaneSchedule<br/>Repository
    participant V as read models
    participant SD as ScheduleDeparture
    participant O as outbox, relay<br/>to Kafka
    T->>U: GenerateDepartures horizon 14 days
    U->>S: ListActive
    loop each ACTIVE schedule
        U->>U: slots in horizon
        loop each slot without a departure
            U->>SD: ScheduleDeparture
            SD->>O: DepartureScheduled, same transaction as the departure
        end
    end
    U->>V: pickup lanes and node cutoffs
    loop each cutoff of an ACTIVE vendor FC per operating day
        U->>SD: ScheduleDeparture kind PICKUP
        alt ErrLaneClosed or ErrInvalidDepartureTimes
            SD-->>U: refused, logged, continue
        else scheduled
            SD->>O: DepartureScheduled
        end
    end
    Note over O: relay publishes after<br/>each commit
```

Derived from: `model.yaml → contexts[linehaul-transportation].policies[HorizonRoll]`, `.aggregates[LaneSchedule].description`, `.business_decisions`.

Omitted: the per-departure detail, which is diagram 1. Each `ScheduleDeparture` is its own transaction, so one refusal does not roll back the night's work.

## 11. OpenLoad

From a sort-centre or station operator over REST.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http<br/>handler
    participant U as use case
    participant D as Departure<br/>Repository
    participant A as Load
    participant R as Load<br/>Repository
    participant I as idempotency<br/>keys
    H->>U: POST loads departureId<br/>Idempotency-Key
    U->>I: key seen?
    alt key seen
        U-->>H: stored response
    else new key
        U->>D: Get departureId
        alt not found
            U-->>H: 404 not-found
        else found
            U->>A: OpenLoad departure snapshot
            A-->>U: Load OPEN
            Note over U,I: one transaction
            U->>R: insert load
            U->>I: store key
            U-->>H: 201 load
        end
    end
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Load]`, `.rest`.

Omitted: outbox, relay and Kafka: `OpenLoad` raises no event. A second load for the same departure fails on the unique `departure_id` (409, not drawn).

## 12. AddPackage

From a scanner over REST.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http<br/>handler
    participant U as use case
    participant A as Load
    participant R as Load<br/>Repository
    participant I as idempotency<br/>keys
    H->>U: POST loads/loadId/packages<br/>trackingNumber
    U->>I: key seen?
    alt key seen
        U-->>H: stored response
    else new key
        U->>R: Get loadId with version
        alt not found
            U-->>H: 404 not-found
        else found
            U->>R: IsOnOpenLoad trackingNumber
            U->>A: AddPackage trackingNumber
            alt load not OPEN
                A-->>U: 409 invalid-state-transition
            else on another OPEN or CLOSED load
                A-->>U: ErrPackageAlreadyLoaded
                U-->>H: 409 package-already-loaded
            else count would exceed capacity
                A-->>U: ErrLoadOverCapacity
                U-->>H: 409 load-over-capacity
            else accepted
                Note over U,I: one transaction
                U->>R: update where version matches
                alt version changed or unique index hit
                    U-->>H: 409 concurrent-modification or package-already-loaded
                else saved
                    U->>I: store key
                    U-->>H: 200 load
                end
            end
        end
    end
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Load].invariants`, `.rest`.

Omitted: outbox, relay and Kafka: `AddPackage` raises no event. The partial unique index on `load_packages` is the race-safe backstop for `ErrPackageAlreadyLoaded`.

## 13. CloseLoad

From an operator over REST.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http<br/>handler
    participant U as use case
    participant A as Load
    participant R as Load<br/>Repository
    participant O as outbox
    participant RL as relay to Kafka
    H->>U: POST loads/<br/>loadId:close<br/>Idempotency-Key
    U->>R: Get loadId with version
    alt not found
        U-->>H: 404 not-found
    else found
        U->>A: CloseLoad
        alt state CLOSED already
            A-->>U: unchanged
            U-->>H: 200 load
        else state not OPEN
            A-->>U: 409 invalid-state-transition
        else OPEN
            A-->>U: CLOSED
            Note over U,O: one transaction
            U->>R: update where version matches
            alt version changed
                U-->>H: 409 concurrent-modification
            else saved
                U->>O: insert LoadClosed
                U-->>H: 200 load
            end
        end
    end
    Note over O,RL: after commit
    RL->>O: claim unpublished rows
    Note over RL: publish to retailnetwork.<br/>linehaul-transportation.events
    RL->>O: mark published
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Load]`, `.publishes[LoadClosed]`.

Omitted: the idempotency-key check (as in diagram 11).

## 14. DispatchLoad

From an operator over REST, when the truck leaves.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http<br/>handler
    participant U as use case
    participant A as Load
    participant R as Load<br/>Repository
    participant O as outbox
    participant RL as relay to Kafka
    H->>U: POST loads/<br/>loadId:dispatch<br/>Idempotency-Key
    U->>R: Get loadId with version
    alt not found
        U-->>H: 404 not-found
    else found
        U->>A: DispatchLoad
        alt state DEPARTED already
            A-->>U: unchanged
            U-->>H: 200 load
        else state not CLOSED
            A-->>U: 409 invalid-state-transition
        else CLOSED
            A-->>U: DEPARTED
            Note over U,O: one transaction
            U->>R: update where version matches
            alt version changed
                U-->>H: 409 concurrent-modification
            else saved
                U->>O: insert LoadDeparted
                U-->>H: 200 load
            end
        end
    end
    Note over O,RL: after commit
    RL->>O: claim unpublished rows
    Note over RL: publish to retailnetwork.<br/>linehaul-transportation.events
    RL->>O: mark published
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Load]`, `.publishes[LoadDeparted]`.

Omitted: the idempotency-key check; clearing `on_open_load` on the package rows (same transaction). Whether this also drives `RecordDeparture` is not stated in the model.

## 15. ReceiveLoad

From an operator at the destination node over REST.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http<br/>handler
    participant U as use case
    participant A as Load
    participant R as Load<br/>Repository
    participant O as outbox
    participant RL as relay to Kafka
    H->>U: POST loads/<br/>loadId:receive<br/>Idempotency-Key
    U->>R: Get loadId with version
    alt not found
        U-->>H: 404 not-found
    else found
        U->>A: ReceiveLoad
        alt state ARRIVED already
            A-->>U: unchanged
            U-->>H: 200 load
        else state not DEPARTED
            A-->>U: 409 invalid-state-transition
        else DEPARTED
            A-->>U: ARRIVED
            Note over U,O: one transaction
            U->>R: update where version matches
            alt version changed
                U-->>H: 409 concurrent-modification
            else saved
                U->>O: insert LoadArrived
                U-->>H: 200 load
            end
        end
    end
    Note over O,RL: after commit
    RL->>O: claim unpublished rows
    Note over RL: publish to retailnetwork.<br/>linehaul-transportation.events
    RL->>O: mark published
```

Derived from: `model.yaml → contexts[linehaul-transportation].aggregates[Load]`, `.publishes[LoadArrived]`.

Omitted: the idempotency-key check. `shipping-and-tracking` and `last-mile-delivery` consume `LoadArrived` from Kafka (`InductOnArrival`).
