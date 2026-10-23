---
id: entity-relationship
title: Entity Relationship
sidebar_label: Entity Relationship
description: The proposed Postgres schema of Last-Mile Delivery, with aggregate tables, read-model tables and the outbox, inbox and migration tables.
---

# Entity Relationship

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

The **proposed** Postgres schema of this context's own database (model
`integration_rules`: every context owns its database; no shared tables).
There is one table per aggregate root, child tables for its entities and
collections, `rm_` tables for read models, and four infrastructure tables.
Relationship lines are drawn only inside one aggregate.

## Aggregate tables

DeliveryWave:

```mermaid
erDiagram
    delivery_waves ||--o{ wave_inductions : "inducted packages"
    delivery_waves {
        TEXT wave_id PK
        TEXT station_node_id "by value"
        DATE service_date
        TIMESTAMPTZ induct_cutoff_at "before window_start"
        TIMESTAMPTZ window_start "before window_end"
        TIMESTAMPTZ window_end
        INTEGER stop_capacity
        INTEGER assigned_stops "at most stop_capacity"
        TEXT state "wave states"
        TEXT cancel_reason "nullable"
        BIGINT version
    }
    wave_inductions {
        TEXT wave_id PK,FK
        TEXT tracking_number PK
        TIMESTAMPTZ inducted_at
    }
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[DeliveryWave]` (`root_id`, `states`, `value_objects`, `invariants`).

Route:

```mermaid
erDiagram
    routes ||--|{ route_stops : "ordered stops"
    route_stops ||--|{ route_stop_packages : "tracking numbers"
    routes ||--o{ route_attempts : "attempts"
    routes {
        TEXT route_id PK
        TEXT wave_id "by value"
        TEXT dsp_id "by value"
        TEXT station_node_id "from the wave"
        TEXT state "route states"
        BIGINT version
    }
    route_stops {
        TEXT route_id PK,FK
        INTEGER stop_no PK
        TEXT outcome "nullable"
    }
    route_stop_packages {
        TEXT route_id PK,FK
        INTEGER stop_no PK,FK
        TEXT tracking_number PK
    }
    route_attempts {
        BIGSERIAL attempt_id PK
        TEXT route_id FK
        TEXT tracking_number
        TEXT outcome "DELIVERED or FAILED"
        TEXT failure_reason "nullable"
        TIMESTAMPTZ attempted_at
    }
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[Route]` (`root_id`, `states`, `entities`, `invariants`), `.publishes[DeliveryAttempted].data`.

DeliveryServicePartner:

```mermaid
erDiagram
    delivery_service_partners {
        TEXT dsp_id PK
        TEXT station_node_id "by value"
        INTEGER van_capacity "CHECK above 0"
        TEXT state "ACTIVE, INACTIVE"
    }
```

Derived from: model.yaml → `contexts[last-mile-delivery].aggregates[*]`
(`root_id`, `states`, `value_objects`, `entities`, `invariants`),
`.publishes[*].data`.

Column notes in full: `state` is CHECKed against the aggregate's states
(`OPEN`, `INDUCTION_CLOSED`, `DISPATCHED`, `COMPLETED`, `CANCELLED` for
waves; `PLANNED`, `OUT_FOR_DELIVERY`, `COMPLETED` for routes). CHECKs back
the invariants: `induct_cutoff_at < window_start < window_end`
(`ErrInvalidWaveTimes`), `assigned_stops <= stop_capacity` (`ErrWaveFull`),
`van_capacity > 0` (`ErrInvalidVanCapacity`). `route_stops.outcome` is
`DELIVERED` or `FAILED` once attempted. `version` is the optimistic
concurrency counter. "By value" marks an id of another aggregate or
context.

Omitted: indexes, for example `delivery_waves (station_node_id,
service_date)` for the list query, `delivery_waves (station_node_id,
induct_cutoff_at) WHERE state = 'OPEN'` for the earliest-wave search, and a
partial unique index on `route_attempts (tracking_number) WHERE outcome =
'DELIVERED'` backing `ErrAlreadyDelivered`.

`wave_inductions`, `route_stop_packages` and `route_attempts` are
collections this pack proposes so that induction is idempotent, stops hold
their tracking numbers (`Stop{stopNo, trackingNumbers[], outcome}`), and
attempts (`route.Attempt`) are kept per package. The model lists no such
fields. `dsp_id` and `van_capacity` on partners come from the aggregate's
root id and invariant; the model gives no field list.

## Read-model tables

```mermaid
erDiagram
    rm_stations {
        TEXT node_id PK
        TEXT node_type "DELIVERY_STATION only"
        TEXT region_id
        TEXT timezone
    }
    rm_station_service_areas {
        TEXT postal_prefix PK
        TEXT delivery_station_node_id
        TEXT region_id
        BIGINT assignment_version
    }
```

Derived from: model.yaml → `contexts[last-mile-delivery].read_models[StationView]`; `contexts[node-topology].publishes[NodeRegistered, ServiceAreaAssigned].data`.

```mermaid
erDiagram
    rm_inbound_packages {
        TEXT load_id PK
        TEXT tracking_number PK
        TEXT departure_id
        TEXT station_node_id "destinationNodeId"
        TIMESTAMPTZ arrived_at
    }
```

Derived from: model.yaml → `contexts[last-mile-delivery].read_models`
(`StationView`, `InboundPackagesView`); `contexts[node-topology].publishes`
(`NodeRegistered`, `ServiceAreaAssigned` data);
`contexts[linehaul-transportation].publishes[LoadArrived].data`.

Omitted: the other `NodeRegistered` fields (`subtype`, `operator`,
`vendorId`, `vendorNodeCode`, `postalCode`, `countryCode`), which are not
needed here. `StationView` is the pair `rm_stations` and
`rm_station_service_areas`; a `ServiceAreaAssigned` row is applied only if
its `assignment_version` is higher than the stored one.

## Infrastructure tables

```mermaid
erDiagram
    outbox_events {
        BIGSERIAL id PK
        UUID event_id UK "CloudEvents id"
        TEXT topic
        TEXT event_type "full type"
        TEXT kafka_key "waveId or routeId"
        JSONB payload "CloudEvent"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ published_at "nullable"
        INTEGER attempts
    }
    processed_events {
        UUID event_id PK "inbox"
        TEXT event_type
        TIMESTAMPTZ processed_at
    }
```

Derived from: model.yaml → `conventions.integration_rules` (outbox, inbox).

```mermaid
erDiagram
    idempotency_keys {
        TEXT idempotency_key PK
        TEXT route "method and path"
        TEXT request_hash
        INTEGER response_status
        JSONB response_body
        TIMESTAMPTZ created_at
    }
    schema_migrations {
        BIGINT version PK
        BOOLEAN dirty
    }
```

Derived from: model.yaml → `conventions.integration_rules` (outbox, inbox)
and `conventions.cloudevents` (topic, key).

**Infrastructure, not domain:** `outbox_events` is the transactional outbox,
written in the same transaction as the aggregate and drained by a relay.
`processed_events` is the inbox: a consumer claims the CloudEvents `id` in
the same transaction as its effect. `idempotency_keys` stores the response
to a REST command under its `Idempotency-Key` header. `schema_migrations` is
the migration tool's bookkeeping.

## Why there is no foreign key across aggregates or contexts

- **Across aggregates.** `routes.wave_id` and `routes.dsp_id` point at other
  aggregates. Each aggregate is its own consistency boundary and is saved in
  its own transaction. A foreign key would couple their lifecycles and lock
  both rows on every write. The rule that needs the partner
  (`ErrRouteOverCapacity`) reads it once, at `PlanRoute`.
- **Across contexts.** `station_node_id`, `tracking_number`, `load_id` and
  `departure_id` belong to `node-topology`, `shipping-and-tracking` and
  `linehaul-transportation`. Their rows live in other databases. They arrive
  by event and are carried by value.
- **Read models.** `rm_` tables are rebuilt from events and may lag. A
  foreign key from an aggregate to a read model would make a write fail
  because a projection is late.

## Table ≠ aggregate

| Table | Aggregate / role | Notes |
| --- | --- | --- |
| `delivery_waves` | **DeliveryWave** (root) | One row per wave; `version` checked on every save. |
| `wave_inductions` | **DeliveryWave** (collection) | One row per inducted package; makes `InductPackage` idempotent. |
| `routes` | **Route** (root) | One row per route; `version` checked. |
| `route_stops` | **Route** (`Stop` entities) | `stopNo` is unique within the route. |
| `route_stop_packages` | **Route** (`Stop.trackingNumbers`) | Tracking numbers per stop. |
| `route_attempts` | **Route** (`Attempt` values) | Append-only. |
| `delivery_service_partners` | **DeliveryServicePartner** (root) | Rare writes. |
| `rm_stations`, `rm_station_service_areas` | read model `StationView` | Fed by `NodeRegistered`, `ServiceAreaAssigned`. |
| `rm_inbound_packages` | read model `InboundPackagesView` | Fed by `LoadArrived`. |
| `outbox_events` | none (infrastructure) | Transactional outbox. |
| `processed_events` | none (infrastructure) | Inbox, idempotent consumers. |
| `idempotency_keys` | none (infrastructure) | REST `Idempotency-Key`. |
| `schema_migrations` | none (infrastructure) | Migration bookkeeping. |
