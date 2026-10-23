---
id: entity-relationship
title: Entity Relationship
sidebar_label: Entity Relationship
description: The proposed Postgres schema of Node Topology, one table group per aggregate plus the outbox, inbox, idempotency and migration infrastructure tables.
---

# Entity Relationship

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

The **proposed** Postgres schema of the context's own database (every context
owns its database; no shared tables, model `conventions.integration_rules`).
A relationship line is drawn only for a foreign key inside one aggregate.
Column types are a proposal; column names follow the model's fields in
snake case.

## Node aggregate

```mermaid
erDiagram
    nodes ||--o{ node_operational_profiles : "one per revision"
    nodes {
        TEXT node_id PK
        TEXT node_type "CHECK node types"
        TEXT subtype "nullable, FC only"
        TEXT operator "CHECK NETWORK, VENDOR"
        TEXT vendor_id UK "nullable"
        TEXT vendor_node_code UK "nullable"
        TEXT region_id "a value, no FK"
        TEXT timezone "IANA"
        TEXT postal_code
        TEXT country_code
        NUMERIC lat
        NUMERIC lon
        TEXT status "CHECK four states"
        INTEGER current_profile_revision "nullable"
        TEXT suspend_reason "nullable"
        TIMESTAMPTZ registered_at
        TIMESTAMPTZ activated_at "nullable"
        TIMESTAMPTZ suspended_at "nullable"
        TIMESTAMPTZ retired_at "nullable"
        BIGINT version "OCC"
    }
    node_operational_profiles {
        TEXT node_id PK,FK
        INTEGER profile_revision PK "increasing"
        TEXT timezone
        INTEGER handling_time_minutes "CHECK >= 0"
        INTEGER sort_dwell_minutes "nullable, SC and AIR_HUB only"
        INTEGER throughput_cap_value "CHECK > 0"
        TEXT throughput_cap_time_unit "CHECK HOUR, DAY"
        TEXT throughput_cap_unit "CHECK ORDER"
        TEXT declared_by "CHECK declarers"
        TIMESTAMPTZ declared_at
    }
```

```mermaid
erDiagram
    direction LR
    node_operational_profiles ||--o{ node_profile_operating_hours : "FK"
    node_operational_profiles ||--o{ node_profile_cutoffs : "FK"
    node_operational_profiles ||--o{ node_profile_holidays : "FK"
    node_operational_profiles {
        TEXT node_id PK,FK
        INTEGER profile_revision PK
    }
    node_profile_operating_hours {
        TEXT node_id PK,FK
        INTEGER profile_revision PK,FK
        TEXT day_of_week PK "monday to sunday"
        TIME start_time
        TIME end_time
    }
    node_profile_cutoffs {
        TEXT node_id PK,FK
        INTEGER profile_revision PK,FK
        TIME local_time PK
        TEXT days "weekdays, null = every operating day"
        INTEGER max_orders "nullable"
    }
    node_profile_holidays {
        TEXT node_id PK,FK
        INTEGER profile_revision PK,FK
        DATE holiday PK
    }
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Node]`
(`value_objects`, `invariants`, `size_estimate`: "one row + one profile row
per revision"), `.publishes[NodeRegistered|NodeOperationalProfileDeclared].data`.

Omitted: indexes other than the keys. The second diagram repeats only the
key of `node_operational_profiles`. `OCC` marks the optimistic-concurrency
counter. The `CHECK`s are: `status` in `PROPOSED`, `ACTIVE`, `SUSPENDED`,
`RETIRED`; `declared_by` in `VENDOR`, `NETWORK_OPS`; `node_type` in the six
node types; `subtype` set only for `FULFILLMENT_CENTER` (`ErrSubtypeNotAllowed`
also checks it is one of the seven subtypes); `throughput_cap_time_unit` in
`HOUR`, `DAY`. `sort_dwell_minutes` is set only when the node is a
`SORTATION_CENTER` or `AIR_HUB` (`ErrSortDwellNotAllowed`); that rule needs the
node type, so the domain checks it, not a table constraint. The unique key on
`(vendor_id, vendor_node_code)` is one compound `UNIQUE` constraint, drawn as
`UK` on both columns; it backs `ErrVendorNodeCodeTaken`. Capabilities are not stored: they are derived from
`node_type` on load (`DefaultCapabilitiesByType`). Profile rows are only
inserted, never updated, so an old revision cannot be edited.

## Lane, ServiceArea and Region aggregates

```mermaid
erDiagram
    direction LR
    lanes {
        TEXT lane_id PK
        TEXT origin_node_id "a value, no FK"
        TEXT destination_node_id "a value"
        TEXT mode "CHECK GROUND, AIR"
        INTEGER nominal_transit_minutes "CHECK > 0"
        TEXT status "CHECK OPEN, CLOSED"
        TIMESTAMPTZ opened_at
        TIMESTAMPTZ closed_at "nullable"
        BIGINT version "OCC"
    }
    regions {
        TEXT region_id PK
        TEXT code UK "unique code"
        TEXT name
        TIMESTAMPTZ defined_at
    }
```

```mermaid
erDiagram
    service_areas ||--o{ service_area_assignments : "one per version"
    service_areas {
        TEXT postal_prefix PK
        TEXT delivery_station_node_id "a value, no FK"
        TEXT region_id "a value, no FK"
        INTEGER assignment_version "current"
        TIMESTAMPTZ assigned_at
        BIGINT version "OCC"
    }
    service_area_assignments {
        TEXT postal_prefix PK,FK
        INTEGER assignment_version PK
        TEXT delivery_station_node_id
        TEXT region_id
        TIMESTAMPTZ assigned_at
    }
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Lane|ServiceArea|Region]`,
`.publishes[LaneOpened|LaneClosed|ServiceAreaAssigned|RegionDefined].data`.

Omitted: a `CHECK` that `destination_node_id` differs from
`origin_node_id` (backs `ErrLaneLoop`); `regions.code` is unique (backs
`ErrRegionCodeTaken`); the partial unique index `uq_lanes_open` on
`(origin_node_id, destination_node_id, mode) WHERE status = 'OPEN'`, which
backs `ErrDuplicateLane` (Mermaid cannot draw a partial key); the index on
`lanes (origin_node_id, destination_node_id)` for `ListLanes`; the index on
`nodes (node_type, region_id, status)` for the node list query.

## Infrastructure tables

```mermaid
erDiagram
    direction LR
    outbox_events {
        BIGSERIAL id PK
        TEXT topic "retailnetwork.node-topology.events"
        TEXT event_type "full CloudEvents type"
        TEXT event_key "aggregate root id, Kafka key"
        BYTEA value "CloudEvents structured JSON"
        JSONB headers
        TIMESTAMPTZ created_at
        TIMESTAMPTZ published_at "nullable"
        INTEGER attempts
        TEXT last_error "nullable"
    }
    processed_events {
        TEXT event_id PK "CloudEvents id"
        TEXT event_type
        TIMESTAMPTZ processed_at
    }
    idempotency_keys {
        TEXT route PK
        TEXT idempotency_key PK
        TEXT request_hash
        INTEGER response_status
        JSONB response_body
        TIMESTAMPTZ created_at
        TIMESTAMPTZ expires_at "created_at + 24 h"
    }
    schema_migrations {
        BIGINT version PK
        BOOLEAN dirty
    }
```

Derived from: model.yaml → `conventions.integration_rules` (transactional
outbox, idempotent consumers with an inbox table), `conventions.cloudevents`.

**All four tables are infrastructure, not domain state.**
`outbox_events` is written in the same transaction as the aggregate and
drained by the relay. `processed_events` is the standard inbox; it stays
**empty** here because the context consumes no topic, and is kept only so the
service has the same shape as its siblings when a consumer is added.
`idempotency_keys` is keyed by `(route, key)`, stores the first answer per
`Idempotency-Key` header, keeps it for 24 hours (`expires_at`) and is written
in the same transaction as the command. It is an infrastructure table, not an
aggregate. `schema_migrations` is
the migration tool's bookkeeping.

## Read-model tables

None. The model gives this context no read model (`read_models: []`), so
there is no `rm_...` table. The four query routes read the aggregate tables.

## Why there is no foreign key across aggregates or to other contexts

- **Across aggregates.** `lanes.origin_node_id`,
  `lanes.destination_node_id`, `service_areas.delivery_station_node_id`,
  `nodes.region_id` and `service_areas.region_id` hold ids by value. Each
  aggregate is a consistency boundary loaded and saved on its own. The rules
  that need another aggregate's state (both lane ends `ACTIVE`, the station
  `ACTIVE`, the region defined: `ErrUnknownRegion`) are checked by the use case when it reads that aggregate, and are
  facts about the moment of the command: a node retired later must not make
  the lane row invalid or block the retirement.
- **To other contexts.** `nodes.vendor_id` names a `vendor-connectivity`
  vendor account, which lives in another database. No context shares a table
  (model `conventions.integration_rules`).
- **Inside one aggregate**, foreign keys are drawn and real: a profile
  revision and its hours, cutoffs and holidays belong to one node; an
  assignment history row belongs to one service area.

## Table ≠ aggregate

| Table | Aggregate / role | Notes |
| --- | --- | --- |
| `nodes` | **Node** (root) | One row per node, saved with a `version` check. |
| `node_operational_profiles` | **Node** (its `OperationalProfile` revisions) | Insert-only; `nodes.current_profile_revision` points at the latest. |
| `node_profile_operating_hours` | **Node** (`operatingHoursByDay` of one revision; a missing day has no row, so it is closed) | Insert-only. |
| `node_profile_cutoffs` | **Node** (`cutoffs[CutoffSlot]` of one revision) | Insert-only. |
| `node_profile_holidays` | **Node** (`holidays[]` of one revision) | Insert-only. |
| `lanes` | **Lane** | One row per lane; a closed lane is never reopened. |
| `service_areas` | **ServiceArea** (current assignment) | One row per postal prefix. |
| `service_area_assignments` | **ServiceArea** (assignment history) | One row per `assignmentVersion`; insert-only. |
| `regions` | **Region** | One row per region. |
| `outbox_events` | none (infrastructure) | Transactional outbox. |
| `processed_events` | none (infrastructure) | Inbox; empty, no consumer. |
| `idempotency_keys` | none (infrastructure) | `Idempotency-Key` replay store, keyed by `(route, key)`, 24-hour TTL. |
| `schema_migrations` | none (infrastructure) | Migration bookkeeping. |
