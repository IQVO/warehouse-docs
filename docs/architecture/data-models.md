---
id: data-models
title: Data Models
sidebar_label: Data Models
description: The real Postgres schema of every bounded context, drawn as entity-relationship diagrams straight from each repository's migrations.
---

# Data Models

The fleet-level view of persistence: which databases exist, which tables each
context owns, which of them hold aggregates and which are infrastructure,
and where real foreign keys exist. The full entity-relationship diagram for
each context, with every column, is on that context's own
**Entity-Relationship** page. Those pages are synced from each repository's
`develop` branch and drawn from its `migrations/*.up.sql`.

The table names and counts below come from replaying every repository's
migrations on `origin/develop` (`CREATE TABLE` minus `DROP TABLE`), and match
the synced entity-relationship pages. golang-migrate's own `schema_migrations`
bookkeeping table is excluded from the counts.

Two conventions hold on every page, here and per context:

1. **A relationship line is drawn only where a real `FOREIGN KEY` exists.**
   No foreign key ever crosses a context boundary. Each context has its own
   database.
2. **Infrastructure tables are marked.** `outbox_events`,
   `idempotency_keys`, `processed_events` (and their per-consumer variants)
   and the `analytics_*` bookkeeping tables implement the transactional
   outbox, HTTP idempotency and consumer idempotency. They are not domain
   concepts.

:::info[A table is not an aggregate]

The [Domain Model](/architecture/domain-model) is the authoritative view of
the domain. This page is the persistence shape it is stored in, and the two
are deliberately not one-to-one. The domain layer has no knowledge of SQL.

:::

## Databases

Eleven contexts on this site persist. Each has an **OLTP** database and a separate
**analytical** database. The OLTP binary (and its MCP sibling) owns the first.
The analytical one is written only by that context's projector binary and
read only by its reports binary (see [Containers](/architecture/containers)).
`warehouse-ops-agent` has no database at all: its circuit breaker, config and
tool-spec cache are in memory
([its entity-relationship page](/contexts/warehouse-ops-agent/entity-relationship)
explains why).

| Context | OLTP tables | Analytics tables | Real FKs (OLTP) | Detailed page |
| --- | ---: | ---: | --- | --- |
| `order-management` | 10 | 4 | `order_lines` and `order_promise_groups` to `orders` | [ER](/contexts/order-management/entity-relationship) |
| `inventory-storage` | 12 | 3 | `stock_units` to `bins`; `reservation_allocations` to `reservations` and `stock_units` | [ER](/contexts/inventory-storage/entity-relationship) |
| `wes-work-planning` | 12 | 3 | `work_pool_entries` to `work_pools` | [ER](/contexts/wes-work-planning/entity-relationship) |
| `fulfillment-execution` | 9 | 4 | none | [ER](/contexts/fulfillment-execution/entity-relationship) |
| `workforce-management` | 8 | 4 | `path_plan` to `shift_plan`; `labor_assignment_history` to `labor_assignment` | [ER](/contexts/workforce-management/entity-relationship) |
| `facility-layout` | 10 | 3 | eight, along the site, zone, aisle and slot hierarchy | [ER](/contexts/facility-layout/entity-relationship) |
| `process-path-management` | 5 | 3 | `cpt_schedule_cutoffs` to `cpt_schedules` | [ER](/contexts/process-path-management/entity-relationship) |
| `labor-performance` | 6 | 3 | none | [ER](/contexts/labor-performance/entity-relationship) |
| `network-fulfillment` | 4 | 3 | `network_order_lines` to `network_orders` | [ER](/contexts/network-fulfillment/entity-relationship) |
| `warehouse-planning` | 10 | 2 | `process_capacity_constraint` to `process_capacity` | [ER](/contexts/warehouse-planning/entity-relationship) |
| `product-master` | 3 | 3 | none | [ER](/contexts/product-master/entity-relationship) |
| `warehouse-ops-agent` | 0 | 0 | no database | [ER](/contexts/warehouse-ops-agent/entity-relationship) |
| **Total** | **89** | **35** | | |

The `inventory-storage`, `order-management`, `wes-work-planning`,
`fulfillment-execution` and `product-master` rows were re-counted from each
repository's migrations on `develop` (2026-10-07), after the product-master
migration added a classification copy to each consumer. Some synced ER pages
predate it: `fulfillment-execution`'s does not show
`product_classification_copy`, and `inventory-storage`'s does not show the
transfer tables.

Most FKs in the fleet run from a child table to its parent **inside one
aggregate** (an `Order` and its lines, a `WorkPool` and its entries, a
`ProcessCapacity` and its constraints). Two contexts also put FKs between
separate aggregates of their own:

- **facility-layout**: `Zone` to `Site`, and `LocationSlot` to `Aisle` and
  `LocationType`. Physical geography is genuinely hierarchical, and the FKs
  back its no-orphan-slots rule.
- **inventory-storage**: `stock_units.bin_id` to `bins`, and
  `reservation_allocations.stock_unit_id` to `stock_units`.

fulfillment-execution, labor-performance and product-master have no FKs at all. Their
aggregates reference each other only by identity.

## Tables by role

| Context | Aggregate state | Read models of other contexts | Infrastructure |
| --- | --- | --- | --- |
| `order-management` | `orders`, `order_lines`, `order_promise_groups` | `planned_capacity_windows` (warehouse-planning's `CapacityPlan`), `product_classification_copy` (product-master's `ProductClassified`, ADR 0036) | `outbox_events`, `idempotency_keys`, `repromise_processed_events`, `planned_capacity_processed_events`, `product_classification_processed_events` |
| `inventory-storage` | `bins`, `stock_units`, `reservations`, `reservation_allocations`; the transfer tables `transfer_allocations`, `transfer_receipts`, `inventory_exceptions` | `product_classifications` (a version-guarded copy of product-master's classification since ADR 0034), `order_pick_progress` (fulfillment-execution's `TaskCompleted`, ADR 0035); the facility location cache is in memory | `outbox_events`, `idempotency_keys`, `processed_events` |
| `wes-work-planning` | `work_pools`, `work_pool_entries`, `work_units`, `shift_plans`, `charge_forecasts` | `labor_plan_view` (workforce), `usable_inventory_view` (inventory), `product_classification_copy` (product-master, ADR-0035) | `outbox_events`, `idempotency_keys`, `processed_events`; `events` is legacy and unused |
| `fulfillment-execution` | `tasks`, `stations`, `packages`, `order_consolidations` | `product_classification_copy` (product-master, ADR-0039); the path catalogue is in memory | `outbox_events`, `idempotency_keys`, `processed_events`; `domain_events` is legacy and unused |
| `workforce-management` | `shift_plan`, `path_plan`, `associate_shift`, `labor_assignment`, `labor_assignment_history` | none (catalogue and performance caches are in memory) | `outbox_events`, `idempotency_keys`; `domain_event` is legacy and unused |
| `facility-layout` | `sites`, `zones`, `aisles`, `cross_aisles`, `location_slots`, `location_types`, `placement_rules`, `fixed_structures` | none (it consumes nothing) | `outbox_events`, `idempotency_keys` |
| `process-path-management` | `process_paths`, `cpt_schedules`, `cpt_schedule_cutoffs` | none (it consumes nothing) | `outbox_events`, `idempotency_keys` |
| `labor-performance` | `labor_standards`, `task_performances`, `idle_periods` | none | `outbox_events`, `idempotency_keys`, `processed_events` |
| `network-fulfillment` | `network_orders`, `network_order_lines`, `capability_offers` | none (path and capacity caches are in memory) | `outbox_events` |
| `product-master` | `products` (the `Product` aggregate, classification and physical profile in one row) | none (the legacy importer writes into `products`) | `outbox_events`, `processed_events` |
| `warehouse-planning` | `process_capacity`, `process_capacity_constraint`, `capacity_plans`; plus the locally declared `process_paths` and stored `station_standards` value objects | `location_slot_registration`, `location_slot_tally` (facility-layout), `order_demand` (order-management) | `outbox_events`, `processed_events` |

Patterns that the table makes visible:

- **Every persisting context has a transactional outbox.** An aggregate
  change and the events it raises commit in one transaction to
  `outbox_events`, and a relay in the OLTP binary drains them to Kafka. Each
  domain event becomes one row per destination topic (integration and/or
  analytics), and every row is a CloudEvents 1.0 structured-mode message.
- **Consumer idempotency is a table wherever a consumer writes state.**
  `processed_events` (or a per-consumer ledger, as in order-management) is
  keyed on the inbound CloudEvents `id`. labor-performance goes one step
  further and uses that `id` as the primary key of `task_performances`.
- **HTTP idempotency.** Eight contexts store `Idempotency-Key` replays in
  `idempotency_keys`. network-fulfillment and warehouse-planning do not
  implement that middleware, and product-master needs none: every write is an
  idempotent `PUT`.
- **Event-fed caches often live in memory, not in tables.** Process-path
  catalogues, the facility location cache, the labor-performance cache and
  path-capacity caches are rebuilt from Kafka at startup. That is why several
  consumers have no read-model table. See
  [Runtime Flows](/architecture/runtime-flows#8-event-fed-cache-instead-of-a-synchronous-call).

## Identity references across contexts

Cross-context identities are stored as plain `TEXT` with no constraint, and
are never parsed except at one documented seam:

| Column | Holds | Owner of that identity |
| --- | --- | --- |
| `order_lines.reservation_id` | a `Reservation` id | inventory-storage |
| `order_lines.path_id`, `planned_capacity_windows.path_id` | a process-path id | process-path-management / warehouse-planning |
| `reservations.demand_ref` | the order-management demand reference | order-management |
| `tasks.order_ref`, `packages.order_ref`, `order_consolidations.order_ref` | a `work_unit_id` | wes-work-planning |
| `task_performances.task_id`, `associate_id`, `task_type` | task, associate and task-type ids | fulfillment-execution |
| `network_orders.local_order_id` | an order id | order-management |
| `product_classifications.sku` (inventory-storage), `product_classification_copy.sku` (order-management, wes-work-planning, fulfillment-execution), each with the product's `version` | a product's SKU | product-master |

The one seam that parses an identity is order-management's re-promise
consumer: it reads `orderId` and the line number back out of the
`order_ref` (`orderId-line-n`) carried on `TaskCPTMissed` and
`PackageManifested`.

## Analytical databases

Every analytical database has the same shape: one or two report tables, plus
projector bookkeeping.

| Context | Report table(s) | Correlation state | Bookkeeping |
| --- | --- | --- | --- |
| `order-management` | `funnel_rollup`, `repromise_rollup` | none | `analytics_processed_events`, `analytics_consumed_events` |
| `inventory-storage` | `flow_accuracy_rollup` | none | same two |
| `wes-work-planning` | `throughput_rollup` | none | same two |
| `fulfillment-execution` | `throughput_rollup` | `analytics_pending_claims` | same two |
| `workforce-management` | `labor_rollup` | `analytics_pending_breaks` | same two |
| `facility-layout` | `catalog_growth_rollup` | none | same two |
| `process-path-management` | `catalogue_growth_rollup` | none | same two |
| `labor-performance` | `labor_performance_rollup` | none | same two |
| `network-fulfillment` | `acknowledgement_rollup` | none | same two |
| `warehouse-planning` | `plan_facts` | none | `analytics_processed_events` only |

| Table kind | Purpose |
| --- | --- |
| `*_rollup`, `plan_facts` | The report itself, pre-aggregated and keyed by the dimensions that context reports on. |
| `analytics_pending_*` | Correlation state for events that must be paired (a claim with its completion, a break start with its end) to compute a duration. |
| `analytics_processed_events` / `analytics_consumed_events` | Idempotent consumption of the analytics topic, which is delivered at least once like any other. |

The report is rebuilt purely from that context's own
`warehouse.<context>.analytics` stream (wes-work-planning's is
`warehouse.wes.analytics`, see [Containers](/architecture/containers#kafka-one-broker-two-topic-families)),
never by a second write from the OLTP side.
