---
id: entity-relationship
title: Entity Relationship
sidebar_label: Entity Relationship
description: "The proposed Postgres schema of Order Sourcing: the FulfillmentAssignment tables, the rm_ read-model tables fed by sibling events, and the outbox, inbox, idempotency and migration tables."
---

# Entity Relationship

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

A **proposed** schema for this context's own Postgres database ("every
context owns its database; no shared tables"). Column names are the model's
field names in `snake_case`; SQL types are this page's proposal. A
relationship line is drawn **only** for a foreign key inside one aggregate.

## FulfillmentAssignment (aggregate tables)

```mermaid
erDiagram
    direction LR
    fulfillment_assignments ||--|{ assignment_lines : "lines"
    fulfillment_assignments ||--o{ assignment_releases : "releases"
    fulfillment_assignments ||--o{ assignment_excluded_nodes : "exclusions"
    fulfillment_assignments {
        TEXT assignment_id PK
        TEXT order_id UK
        INTEGER group_no UK
        TEXT state
        BIGINT assignment_version
        TEXT promise_id
        TEXT tier
        TIMESTAMPTZ deliver_by_latest
        TEXT witness_node_id
        TEXT destination_postal_prefix
        TEXT candidate_node_id
        TEXT candidate_pickup_departure_id
        JSONB candidate_legs
        TEXT candidate_delivery_wave_id
        TIMESTAMPTZ candidate_eta
        NUMERIC candidate_cost
        TIMESTAMPTZ release_at
        TIMESTAMPTZ locked_at
        TEXT lock_reason
        JSONB tracking_numbers
        TIMESTAMPTZ shipped_at
        TIMESTAMPTZ delivered_at
    }
    assignment_lines {
        TEXT assignment_id PK,FK
        INTEGER line_no PK
        TEXT catalog_item_id
        INTEGER quantity
        TEXT listing_id
    }
    assignment_releases {
        TEXT assignment_id PK,FK
        INTEGER release_no PK
        TEXT node_id
        TIMESTAMPTZ released_at
        TIMESTAMPTZ required_ship_by
        TEXT outcome
        TEXT reason_code
    }
    assignment_excluded_nodes {
        TEXT assignment_id PK,FK
        TEXT node_id PK
        TEXT reason
    }
```

Derived from: model.yaml → `contexts[order-sourcing].aggregates[FulfillmentAssignment]`
(`root_id`, `states`, `value_objects`, `invariants`), `.publishes[*].data`;
`contexts[customer-ordering].publishes[CustomerOrderPlaced].data`
(`destinationPostalPrefix`, `lineNo`).

Column notes: `order_id` + `group_no` is one composite unique key (one
assignment per shipment group); `state` is `CHECK`ed against the seven states;
`assignment_version` is the optimistic lock; `candidate_legs` holds the
departure ids; `release_at` orders the virtual queue; `listing_id` is set at
release; `outcome` is `ACCEPTED`, `REJECTED`, `EXPIRED` or `PENDING`.
Every child table's `assignment_id` is a foreign key to
`fulfillment_assignments` with `ON DELETE CASCADE`. The candidate, lock,
shipment and delivery columns are nullable until they apply.

Omitted: indexes. Proposed: a partial index on `release_at WHERE state =
'QUEUED'` (the virtual queue and the release timer), a partial unique index
on `assignment_releases (assignment_id) WHERE outcome = 'PENDING'`
(`ErrReleaseInFlight` as a database backstop), and indexes on `promise_id`
and on `candidate_node_id` (`GET /assignments?nodeId=`). The exclusion table
has no promise-revision column because `PromiseConstraint` carries none
(open question). `destination_postal_prefix` is a postal prefix, not an
address: no PII is stored here.

## Read-model tables

Fed only by sibling events; rebuilt by replaying their topics.

```mermaid
erDiagram
    direction LR
    rm_node_profile {
        TEXT node_id PK
        TEXT node_type
        TEXT subtype
        TEXT operator "VENDOR or NETWORK"
        TEXT vendor_id "nullable"
        TEXT region_id
        TEXT timezone
        TEXT status "ACTIVE SUSPENDED RETIRED"
        INTEGER profile_revision
        INTEGER handling_time_minutes
        JSONB cutoffs
        JSONB operating_hours_by_day
        JSONB holidays
        JSONB throughput_cap
    }
    rm_scorecards {
        TEXT node_id PK
        TEXT score_window PK "7d or 30d"
        TEXT grade
        NUMERIC on_time_handover_rate
        NUMERIC late_ack_rate
        NUMERIC reject_rate
        NUMERIC expiry_rate
        NUMERIC promise_kept_rate
        INTEGER observations
        TIMESTAMPTZ computed_at
    }
    rm_promise_book_pressure {
        TEXT book_id PK "nodeId:pickupDepartureId"
        TEXT node_id
        TEXT pickup_departure_id
        INTEGER share
        TIMESTAMPTZ exhausted_at
    }
```

```mermaid
erDiagram
    direction LR
    rm_lanes {
        TEXT lane_id PK
        TEXT origin_node_id
        TEXT destination_node_id
        TEXT mode "GROUND or AIR"
        INTEGER nominal_transit_minutes
        TEXT status "OPEN or CLOSED"
    }
    rm_departures {
        TEXT departure_id PK
        TEXT lane_id
        TEXT kind "PICKUP LINEHAUL AIR"
        TEXT origin_node_id
        TEXT destination_node_id
        TIMESTAMPTZ cutoff_at
        TIMESTAMPTZ departs_at
        TIMESTAMPTZ arrives_at
        INTEGER capacity_packages
        INTEGER remaining_packages
        BOOLEAN cancelled
    }
    rm_delivery_waves {
        TEXT wave_id PK
        TEXT station_node_id
        DATE service_date
        TIMESTAMPTZ induct_cutoff_at
        TIMESTAMPTZ window_start
        TIMESTAMPTZ window_end
        INTEGER stop_capacity
        INTEGER remaining_stops
    }
    rm_service_areas {
        TEXT postal_prefix PK
        TEXT delivery_station_node_id
        TEXT region_id
        INTEGER assignment_version
    }
    rm_regions {
        TEXT region_id PK
        TEXT code
        TEXT name
    }
```

```mermaid
erDiagram
    direction LR
    rm_availability {
        TEXT listing_id PK
        TEXT catalog_item_id UK "UK with node_id"
        TEXT node_id UK
        INTEGER available_qty
        TEXT basis "basis"
        TIMESTAMPTZ as_of
        TEXT feed_id
        BOOLEAN suppressed
    }
    rm_discontinued_items {
        TEXT catalog_item_id PK
        TIMESTAMPTZ received_at
    }
```

Derived from: model.yaml → `contexts[order-sourcing].read_models`; the
producers' `publishes[*].data` (`node-topology`, `linehaul-transportation`,
`last-mile-delivery`, `offer-availability`, `node-performance`,
`delivery-promise`).

The five read models map to tables as follows: `NodeProfileView` →
`rm_node_profile`; `NetworkGraphView` → `rm_lanes`, `rm_departures`,
`rm_delivery_waves`, `rm_service_areas`, `rm_regions`; `AvailabilityView` →
`rm_availability`, `rm_discontinued_items`; `ScorecardView` →
`rm_scorecards`; `PromiseBookPressureView` → `rm_promise_book_pressure`.
`score_window` stands for the scorecard's `window` (a reserved word in SQL).

Omitted: scorecard `feed_freshness_p95_minutes` and the node's
`sort_dwell_minutes`, `postal_code` and `country_code`, which the ranking does
not use.

## Infrastructure tables

```mermaid
erDiagram
    direction LR
    outbox_events {
        BIGSERIAL id PK
        UUID event_id UK "CloudEvents id"
        TEXT topic "events topic"
        TEXT event_type "full type"
        TEXT kafka_key "assignmentId"
        JSONB envelope "CloudEvent"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ published_at "nullable"
        INTEGER attempts
    }
    processed_events {
        UUID event_id PK "CloudEvents id"
        TEXT event_type
        TEXT source
        TIMESTAMPTZ processed_at
    }
    idempotency_keys {
        TEXT idempotency_key PK
        TEXT route
        INTEGER status_code
        JSONB response_body
        TIMESTAMPTZ created_at
    }
    schema_migrations {
        BIGINT version PK
        BOOLEAN dirty
    }
```

Derived from: model.yaml → `conventions.integration_rules` (outbox,
idempotent consumers on the CloudEvents id), `conventions.cloudevents`.

**All four are infrastructure, not domain tables.** `outbox_events` is
written in the same transaction as the aggregate and drained by the relay.
`processed_events` is the inbox: one row per consumed CloudEvents `id`,
written in the same transaction as its effect. `idempotency_keys` stores the
answer to `POST /assignments/{assignmentId}:reoptimise` per
`Idempotency-Key`. `schema_migrations` is the migration tool's bookkeeping.

## No foreign key across aggregates or contexts

- `node_id`, `candidate_node_id`, `witness_node_id`, `promise_id`,
  `order_id`, `catalog_item_id`, `listing_id`, `pickup_departure_id` name
  entities **of other contexts**. Those live in other databases, so they are
  values, not foreign keys. A node retired in `node-topology` must not be able
  to block a write here.
- The `rm_` tables are **not** joined to the aggregate by foreign keys
  either: they are projections that can be dropped and replayed at any time;
  a constraint would make a replay order-dependent.
- There is only one aggregate, so no cross-aggregate key exists; the child
  tables are part of `FulfillmentAssignment` and are written with it.

## Table ≠ aggregate

| Table | Aggregate / role | Notes |
| --- | --- | --- |
| `fulfillment_assignments` | **FulfillmentAssignment** (root) | One row per shipment group; `assignment_version` guards every update (`ErrStaleAssignmentVersion`). |
| `assignment_lines` | **FulfillmentAssignment** (lines) | Written at queueing; `listing_id` filled at release. |
| `assignment_releases` | **FulfillmentAssignment** (`Release` value objects) | One row per release; `outcome` moves from `PENDING` once. |
| `assignment_excluded_nodes` | **FulfillmentAssignment** (`ExcludedNode` value objects) | One row per refusing node. |
| `rm_node_profile` | read model `NodeProfileView` | |
| `rm_lanes`, `rm_departures`, `rm_delivery_waves`, `rm_service_areas`, `rm_regions` | read model `NetworkGraphView` | One view, five tables. |
| `rm_availability`, `rm_discontinued_items` | read model `AvailabilityView` | |
| `rm_scorecards` | read model `ScorecardView` | |
| `rm_promise_book_pressure` | read model `PromiseBookPressureView` | Rows age out after their pickup cutoff. |
| `outbox_events`, `processed_events`, `idempotency_keys`, `schema_migrations` | none (infrastructure) | |
