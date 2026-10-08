---
id: entity-relationship
title: Entity-relationship diagram
sidebar_label: Entity-relationship
---

# Entity-relationship diagram

:::info[Authored in warehouse-docs]
`network-inventory-planning` does not yet ship a `docs/docs/ddd/` pack, so this page was written here from the repository's code and ADRs on `develop` (commit `8d25980`) instead of being synced. When the repository publishes its pack, replace this page with a synced copy.
:::

The final schemas after applying every migration in order. This service has
**two** Postgres databases:

- the **OLTP** database (`DATABASE_URL`), migrated by `cmd/network-inventory-planning`
  and `cmd/mcp` from `internal/adapters/outbound/postgres/migrations/0001` to `0004`;
- the separate **analytical** database (`ANALYTICS_DATABASE_URL`), migrated and
  written only by `cmd/nip-projector` from `analytics/migrations/0001`
  ([ADR 0009](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0009-analytics-read-side.md)).

Migrations run through golang-migrate. The OLTP step reads
`MIGRATIONS_DATABASE_URL` and falls back to `DATABASE_URL`, because a transaction
pooler cannot honour golang-migrate's session advisory lock
([ADR 0006](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0006-migrations-over-a-direct-connection.md)).

## OLTP database

```mermaid
erDiagram
  inter_warehouse_transfer ||--o{ transfer_audit : "has, ON DELETE CASCADE"

  inter_warehouse_transfer {
    text transfer_id PK
    text idempotency_key "UNIQUE"
    text origin_site_id
    text destination_site_id "CHECK differs from origin"
    text sku
    integer quantity "CHECK above 0"
    text policy_version
    text operator_reason
    timestamptz proposal_as_of
    timestamptz expires_at
    text state "CHECK eleven states"
    text reservation_id "nullable, only from ALLOCATED on"
    jsonb allocations
    timestamptz allocation_expires_at "nullable"
    text rejection_reason "nullable, closed vocabulary"
    integer picked_quantity "nullable, 0003"
    jsonb stow_allocations "0003"
    timestamptz created_at
    timestamptz updated_at
    bigint version "optimistic concurrency"
  }
  transfer_audit {
    text transfer_id PK,FK
    bigint seq PK
    text from_state
    text to_state
    text event
    text reason
    timestamptz occurred_at
  }
  outbox_events {
    bigserial id PK
    text topic
    text event_type
    bytea key
    bytea value "already-encoded CloudEvent"
    jsonb headers
    timestamptz created_at
    timestamptz published_at "nullable"
    integer attempts
    text last_error "nullable"
  }
  processed_events {
    text consumer PK
    text event_id PK
    timestamptz processed_at
  }
  site_capability {
    text site_id PK
    boolean transfer_origin_enabled
    boolean transfer_destination_enabled
    bigint capability_revision
    timestamptz as_of
  }
  site_sku_demand {
    text source_order_id PK
    integer line_no PK
    text site_id
    text sku
    integer demanded_units
    timestamptz due_at
    text state "ACTIVE or REMOVED"
    text assignment_version
    timestamptz as_of
  }
  published_capacity_plan {
    text plan_id PK
    text site_id
    text location
    text path_id
    timestamptz window_start
    timestamptz window_end "CHECK end after start"
    double_precision assigned_demand
    double_precision capacity_over_window
    double_precision shortage
    timestamptz published_at
  }
  rebalance_runs {
    bigserial id PK
    timestamptz started_at
    timestamptz snapshot_as_of "nullable"
    integer proposal_count
    integer rejected_count
    text outcome "COMPLETED or FAILED"
    text fail_closed_reason "nullable"
    timestamptz created_at
  }
```

Source: `internal/adapters/outbound/postgres/migrations/0001_planning_read_models.up.sql`,
`0002_transfer_saga_and_outbox.up.sql`, `0003_work_demand_release.up.sql`,
`0004_rebalance_runs.up.sql`. Only `transfer_audit` has a foreign key. Everything
else is deliberately free of foreign keys: the read models mirror sibling facts and
do not reference one another, `processed_events` is a guard keyed by consumer and
event id, and `outbox_events` is a queue.

Notes that the columns alone do not show:

- `state` carries the eleven-state CHECK widened by migration 0003, which also
  re-created the constraints under stable names and added
  `transfer_picked_quantity_check`: a picked quantity exists only from `PICKED`
  onwards and never exceeds `quantity`.
- `inter_warehouse_transfer.idempotency_key` is UNIQUE: it is the approval
  endpoint's `Idempotency-Key`.
- `outbox_events` holds a `topic` per row, so one approval writes rows for both
  the integration topic and the analytics topic. The relay claims unpublished rows
  `FOR UPDATE SKIP LOCKED` in id order.
- `site_sku_demand` is indexed on `(site_id, due_at)` and
  `published_capacity_plan` on `(site_id, window_start)`.

## Analytical database

```mermaid
erDiagram
  analytics_processed_events {
    text event_id PK
    text event_type
    timestamptz occurred_at
    timestamptz applied_at
  }
  transfer_state_advances {
    text event_id PK
    text transfer_id
    text from_state "empty for the creation entry"
    text to_state
    bigint age_seconds "since creation"
    timestamptz occurred_at
  }
  transfer_stuck_detections {
    text event_id PK
    text transfer_id
    text state
    bigint age_seconds "in the current state"
    bigint threshold_seconds
    timestamptz occurred_at
  }
  rebalance_run_facts {
    text event_id PK
    text run_id
    integer proposal_count
    integer rejected_count
    integer stale_facts
    timestamptz occurred_at
  }
```

Source: `analytics/migrations/0001_saga_facts.up.sql`. The model is append-only: one
row per CloudEvents `id`, written in the same transaction as its
`analytics_processed_events` mark. It is a derived copy that can be dropped and
rebuilt from the topic, so it has no foreign keys and no link to the OLTP tables.
The projector is the only writer; `nip-reports` reads it through a read-only pool
and computes percentiles, rejection rates and day buckets from these tables.

## Table is not aggregate

Only `inter_warehouse_transfer` with its `transfer_audit` rows maps to an
aggregate (`InterWarehouseTransfer`, see the
[Aggregate Design Canvas](/contexts/network-inventory-planning/aggregate-design-canvas)).
`site_capability`, `site_sku_demand` and `published_capacity_plan` are local
copies of sibling facts. `rebalance_runs` is a record of a scheduled pass.
`outbox_events` and `processed_events` are infrastructure. The analytical tables
are projections.
