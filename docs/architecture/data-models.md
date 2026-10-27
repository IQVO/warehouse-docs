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

Eighteen contexts on this site persist, and every one of them has an
**OLTP** database and a separate **analytical** database. All eighteen are
registered with `database: true` and an `analytics:` read side in
`warehouse-infra` `develop`'s `terraform/apps.yaml`. The OLTP binary (and
its MCP sibling) owns the first.
The analytical one is written only by that context's projector binary and
read only by its reports binary (see [Containers](/architecture/containers)).
`warehouse-ops-agent` has no database at all: its circuit breaker, config and
tool-spec cache are in memory
([its entity-relationship page](/contexts/warehouse-ops-agent/entity-relationship)
explains why).

| Context | OLTP tables | Analytics tables | Real FKs (OLTP) | Detailed page |
| --- | ---: | ---: | --- | --- |
| `order-management` | 12 | 4 | `order_lines` and `order_promise_groups` to `orders` | [ER](/contexts/order-management/entity-relationship) |
| `inventory-storage` | 18 | 3 | `stock_units` to `bins`; `reservation_allocations` to `reservations` and `stock_units` | [ER](/contexts/inventory-storage/entity-relationship) |
| `wes-work-planning` | 14 | 3 | `work_pool_entries` to `work_pools` | [ER](/contexts/wes-work-planning/entity-relationship) |
| `fulfillment-execution` | 10 | 4 | none | [ER](/contexts/fulfillment-execution/entity-relationship) |
| `workforce-management` | 8 | 4 | `path_plan` to `shift_plan`; `labor_assignment_history` to `labor_assignment` | [ER](/contexts/workforce-management/entity-relationship) |
| `facility-layout` | 10 | 3 | eight, along the site, zone, aisle and slot hierarchy | [ER](/contexts/facility-layout/entity-relationship) |
| `process-path-management` | 5 | 3 | `cpt_schedule_cutoffs` to `cpt_schedules` | [ER](/contexts/process-path-management/entity-relationship) |
| `labor-performance` | 6 | 3 | none | [ER](/contexts/labor-performance/entity-relationship) |
| `network-fulfillment` | 19 | 3 | nine: `network_order_lines` to `network_orders`; `network_purchase_order_lines` and `network_labels` to `network_purchase_orders`; `network_node_profiles`, `network_inventory_feeds` and `network_rejected_listings` to `network_nodes`; `inbound_receipts`, `inbound_receipt_cartons` and `inbound_receipt_findings` to `inbound_shipments` | [ER](/contexts/network-fulfillment/entity-relationship) |
| `warehouse-planning` | 13 | 2 | `process_capacity_constraint` to `process_capacity` | [ER](/contexts/warehouse-planning/entity-relationship) |
| `product-master` | 4 | 3 | `product_pack_levels` to `products` | [ER](/contexts/product-master/entity-relationship) |
| `network-inventory-planning` | 11 | 4 | `transfer_audit` to `inter_warehouse_transfer` | [ER](/contexts/network-inventory-planning/entity-relationship) |
| `inbound-receiving` | 16 | 6 | nine: `asn_lines`, `asn_cartons` and `receipts` to `asns`; `asn_carton_contents` to `asn_cartons` and `asn_lines`; `appointment_asns` to `appointments`; `receipt_lines`, `receipt_cartons` and `receipt_carton_discrepancies` to `receipts` | [ER](/contexts/inbound-receiving/entity-relationship) |
| `slotting-optimization` | 13 | 2 | `slot_plan_assignments`, `slot_plan_moves`, `slot_plan_unassigned` and `slot_plan_move_executions` to `slot_plans` | [ER](/contexts/slotting-optimization/entity-relationship) |
| `pick-face-replenishment` | 11 | 3 | none: the schema declares no foreign keys | [ER](/contexts/pick-face-replenishment/entity-relationship) |
| `task-interleaving` | 10 | 2 | three: `hints` to `station_trips`, `station_trips.current_hint_id` to `hints`, and `candidates` to `hints` | [ER](/contexts/task-interleaving/entity-relationship) |
| `returns-processing` | 11 | 3 | `return_receipt_lines` to `return_receipts` | none synced yet (its pack has no ER page) |
| `exception-management` | 5 | 3 | none | [ER](/contexts/exception-management/entity-relationship) |
| `warehouse-ops-agent` | 0 | 0 | no database | [ER](/contexts/warehouse-ops-agent/entity-relationship) |
| **Total** | **196** | **58** | | |

Every row was counted on 2026-10-27 from each repository's migrations on
`origin/develop`: the `CREATE TABLE` minus `DROP TABLE` statements of every
`*.up.sql` file, split into the OLTP set (`migrations/` or
`internal/adapters/outbound/postgres/migrations/`) and the analytics set
(`migrations/analytics/` or `analytics/migrations/`), and the FKs from every
`REFERENCES` clause. The totals are the sums of the rows above (OLTP 196,
analytics 58). Several synced entity-relationship pages predate their
newest migrations and do not show every table counted here:
`inventory-storage` (the container, receipt-booking, packaging and transfer tables),
`wes-work-planning` (`slot_plans`, `product_pack_level_copy`),
`fulfillment-execution` (`product_classification_copy`, `interleaving_hints`,
`pack_view`), `network-fulfillment` (the fifteen tables of its live
retail-network adapter), `warehouse-planning` (the three ADR 0017 tables),
`inbound-receiving` (the carton tables, `pack_levels` and its analytical database),
`slotting-optimization`, `network-inventory-planning` and
`pick-face-replenishment` (`pack_levels`), and the analytical tables of
`task-interleaving` and `exception-management`. Those pages are fixed in their
own repositories and re-synced.

Most FKs in the fleet run from a child table to its parent **inside one
aggregate** (an `Order` and its lines, a `WorkPool` and its entries, a
`ProcessCapacity` and its constraints, a `Product` and its pack levels, a
`ReturnReceipt` and its lines). Some contexts also put FKs between
separate aggregates or records of their own:

- **facility-layout**: `Zone` to `Site`, and `LocationSlot` to `Aisle` and
  `LocationType`. Physical geography is genuinely hierarchical, and the FKs
  back its no-orphan-slots rule.
- **inventory-storage**: `stock_units.bin_id` to `bins`, and
  `reservation_allocations.stock_unit_id` to `stock_units`.
- **inbound-receiving**: `receipts` to `asns` and `appointment_asns` to
  `appointments`, across its three aggregates.
- **network-fulfillment**: its live-adapter protocol tables hang off
  `network_nodes`, `network_purchase_orders` and `inbound_shipments`.
- **task-interleaving**: `hints` to `station_trips` and back through
  `station_trips.current_hint_id`, and `candidates` to `hints`. The two
  aggregates it owns (`InterleavingPolicy`, `StationTrip`) reference nothing
  of each other; the FKs bind a trip to its hints inside the `StationTrip`
  aggregate.

fulfillment-execution, labor-performance, pick-face-replenishment and
exception-management have no FKs at all. Their
aggregates reference each other only by identity.

## Tables by role

| Context | Aggregate state | Read models of other contexts | Infrastructure |
| --- | --- | --- | --- |
| `order-management` | `orders`, `order_lines`, `order_promise_groups`; the release-confirmation process-manager state `release_confirmations` (ADR 0043, empty while `RELEASE_CONFIRMATION_MODE=off`) | `planned_capacity_windows` (warehouse-planning's `CapacityPlan`), `product_classification_copy` (product-master's `ProductClassified`, ADR 0036) | `outbox_events`, `idempotency_keys`, `repromise_processed_events`, `planned_capacity_processed_events`, `product_classification_processed_events`, `release_confirmation_processed_events` |
| `inventory-storage` | `bins`, `stock_units`, `reservations`, `reservation_allocations`; `containers` (the `Container` aggregate, one sealed case); `relocations` (the immutable record of each applied move, ADR 0039); `bin_sku_levels` (the per-bin, per-SKU level version, ADR 0040); the transfer tables `transfer_allocations`, `transfer_receipts`, `inventory_exceptions` | `product_classifications` (a version-guarded copy of product-master's classification since ADR 0034), `pack_levels` (product-master's pack levels), `order_pick_progress` (fulfillment-execution's `TaskCompleted`, ADR 0035), `receipt_line_bookings` and `container_pending_links` (what inbound-receiving's receipts booked, and sealed cartons waiting for a booking or a pack level, ADR 0045); the facility location cache is in memory | `outbox_events`, `idempotency_keys`, `processed_events` |
| `wes-work-planning` | `work_pools`, `work_pool_entries`, `work_units`, `shift_plans`, `charge_forecasts` | `labor_plan_view` (workforce), `usable_inventory_view` (inventory), `product_classification_copy` (product-master, ADR-0035), `product_pack_level_copy` (product-master's pack levels), `slot_plans` (the approved slotting plans it applied, so a newer plan supersedes an older one) | `outbox_events`, `idempotency_keys`, `processed_events`; `events` is legacy and unused |
| `fulfillment-execution` | `tasks`, `stations`, `packages`, `order_consolidations` | `product_classification_copy` (product-master, ADR-0039), `pack_view` (product-master's pack levels, ADR 0054), `interleaving_hints` (task-interleaving's `InterleavingHintIssued`, ADR 0051); the path catalogue is in memory | `outbox_events`, `idempotency_keys`, `processed_events` |
| `workforce-management` | `shift_plan`, `path_plan`, `associate_shift`, `labor_assignment`, `labor_assignment_history` | none (catalogue and performance caches are in memory) | `outbox_events`, `idempotency_keys`; `domain_event` is legacy and unused |
| `facility-layout` | `sites`, `zones`, `aisles`, `cross_aisles`, `location_slots`, `location_types`, `placement_rules`, `fixed_structures` | none (it consumes nothing) | `outbox_events`, `idempotency_keys` |
| `process-path-management` | `process_paths`, `cpt_schedules`, `cpt_schedule_cutoffs` | none (it consumes nothing) | `outbox_events`, `idempotency_keys` |
| `labor-performance` | `labor_standards`, `task_performances`, `idle_periods` | none | `outbox_events`, `idempotency_keys`, `processed_events` |
| `network-fulfillment` | `network_orders`, `network_order_lines`, `capability_offers`; the protocol state of its live retail-network adapter (ADRs 0026 to 0028): `network_nodes`, `network_purchase_orders`, `network_purchase_order_lines`, `network_labels`, `network_submissions` (the submission ledger), `network_node_profiles`, `network_inventory_feeds`, `network_rejected_listings`, `inbound_shipments`, `inbound_poll_cursors`, `inbound_receipts` | `inbound_receipt_events`, `inbound_receipt_cartons`, `inbound_receipt_findings` (inbound-receiving's receipt events for the ASNs it registered), `gtin_sku_cache` (product-master's GTIN answers); path and capacity caches are in memory | `outbox_events` |
| `product-master` | `products` and `product_pack_levels` (the `Product` aggregate: classification, physical profile and every pack level) | none | `outbox_events`, `processed_events` |
| `network-inventory-planning` | `inter_warehouse_transfer`, `transfer_audit` (the immutable audit trail), `rebalance_runs`; the operator-managed catalogues `rebalance_policies` and `transfer_lanes` (ADR 0015) | `site_capability` (facility-layout), `site_sku_demand` (order-management), `published_capacity_plan` (warehouse-planning), `pack_levels` (product-master, ADR 0017) | `outbox_events`, `processed_events` |
| `warehouse-planning` | `process_capacity`, `process_capacity_constraint`, `capacity_plans`; plus the locally declared `process_paths`, stored `station_standards` and operator-declared `inbound_labour_standards` (ADR 0017) | `location_slot_registration`, `location_slot_tally` (facility-layout), `order_demand` (order-management), `inbound_appointments` (inbound-receiving's dock appointments) and `observed_capacity` (fulfillment-execution's `TaskCompleted`), both ADR 0017 | `outbox_events`, `processed_events` |
| `inbound-receiving` | `asns`, `asn_lines`, `asn_cartons`, `asn_carton_contents` (`Asn`), `appointments`, `appointment_asns` (`DockAppointment`), `receipts`, `receipt_lines`, `receipt_cartons`, `receipt_carton_discrepancies` (`Receipt`) | `dock_doors` (facility-layout), `known_skus` (product-master's `ProductRegistered`), `pack_levels` (product-master's pack levels) | `outbox_events`, `idempotency_keys`, `processed_events` |
| `slotting-optimization` | `slot_plans`, `slot_plan_assignments`, `slot_plan_moves`, `slot_plan_unassigned` (`SlotPlan`) | `demand_lines` (order-management), `product_profiles` and `pack_levels` (product-master), `zones` and `slots` (facility-layout), `slot_plan_move_executions` (inventory-storage's `StockRelocated`, the execution progress, ADR 0010) | `outbox_events`, `idempotency_keys`, `processed_events` |
| `pick-face-replenishment` | `policies` (`ReplenishmentPolicy`), `replenishment_requests` (`ReplenishmentRequest`) | `bin_stock_levels` (inventory-storage's bin levels), `forward_assignments` and `forward_assignment_maps` (slotting-optimization's `SlotPlanApproved`, with a stale-map guard), `zones` and `locations` (facility-layout), `pack_levels` (product-master, ADR 0009) | `outbox_events`, `idempotency_keys`, `processed_events` |
| `task-interleaving` | `interleaving_policies` (`InterleavingPolicy`), `station_trips`, `hints` and `candidates` (`StationTrip` and its hints) | `task_pool` (fulfillment-execution's `TaskAvailable`, `TaskClaimed`, `TaskCompleted`), `zones` and `locations` with geometry (facility-layout) | `outbox_events`, `idempotency_keys`, `processed_events` |
| `returns-processing` | `return_authorizations` (`ReturnAuthorization`), `return_receipts` and `return_receipt_lines` (`ReturnReceipt`), `dispositions` (`Disposition`), `disposition_policies` (the versioned `DispositionPolicy`) | `allocated_lines` (order-management's allocations), `manifested_units` (fulfillment-execution's `PackageManifested`), `product_classes` (product-master's `ProductClassified`) | `outbox`, `idempotency_keys`, `processed_events` |
| `exception-management` | `exception_cases` (`ExceptionCase`), `exception_policies` (one row per `ExceptionPolicy` version) | none: a case keeps a frozen copy of its source payload | `outbox`, `idempotency_keys`, `processed_events` |

Patterns that the table makes visible:

- **Every persisting context has a transactional outbox.** An aggregate
  change and the events it raises commit in one transaction to
  `outbox_events` (`outbox` in returns-processing and exception-management),
  and a relay in the OLTP binary drains them to Kafka. Each
  domain event becomes one row per destination topic (integration and/or
  analytics), and every row is a CloudEvents 1.0 structured-mode message.
- **Consumer idempotency is a table wherever a consumer writes state.**
  `processed_events` (or a per-consumer ledger, as in order-management) is
  keyed on the inbound CloudEvents `id`. labor-performance goes one step
  further and uses that `id` as the primary key of `task_performances`.
- **HTTP idempotency.** Fourteen of the eighteen persisting contexts store
  `Idempotency-Key` replays in an `idempotency_keys` table: every context in
  the table above except network-fulfillment, warehouse-planning,
  product-master and network-inventory-planning.
  network-fulfillment and warehouse-planning do not
  implement that middleware (network-fulfillment keeps its own outbound
  idempotency keys in `network_submissions`), and product-master needs none:
  every write is an idempotent `PUT`. network-inventory-planning keeps its
  approval idempotency in a unique `idempotency_key` column on the transfer
  itself.
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
| `inter_warehouse_transfer.reservation_id`, `allocations` and `stow_allocations` (`stock_unit_id`, `bin_id`) | an inventory-storage reservation and its stock units and bins | inventory-storage |
| `product_classifications.sku` (inventory-storage), `product_classification_copy.sku` (order-management, wes-work-planning, fulfillment-execution), `product_classes.sku` (returns-processing), each with the product's `version` | a product's SKU | product-master |
| `allocated_lines`, `manifested_units` and `return_authorizations` (returns-processing) | an order id and line number, and the work unit id `{order_id}-line-{line_no}` | order-management / wes-work-planning |

Two seams parse an identity. order-management's re-promise
consumer reads `orderId` and the line number back out of the
`order_ref` (`orderId-line-n`) carried on `TaskCPTMissed` and
`PackageManifested`. returns-processing's `OrderLineRef` builds and parses
the same `{order_id}-line-{line_no}` work unit id, the exact reverse of
fulfillment-execution's `order_ref`, to key its manifest copy by order line.
order-management's release-confirmation consumer does not parse: it matches
the optional `reference` and `line_no` attributes on `WorkUnitCreated`.

## Analytical databases

Every analytical database has the same shape: report tables, sometimes
correlation state, plus projector bookkeeping.

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
| `product-master` | `product_facts`, `profile_states` (the physical-profile history, read at query time) | none | `analytics_processed_events` only |
| `network-inventory-planning` | `transfer_state_advances`, `transfer_stuck_detections`, `rebalance_run_facts` (append-only facts, aggregated at read time) | none | `analytics_processed_events` only |
| `inbound-receiving` | `asn_facts`, `appointment_facts`, `receipt_facts`, `receipt_line_events`, `receipt_discrepancies` | none | `analytics_processed_events` only |
| `slotting-optimization` | `slot_plan_facts` | none | `analytics_processed_events` only |
| `pick-face-replenishment` | `replenishment_facts`, `policy_declaration_facts` | none | `analytics_processed_events` only |
| `task-interleaving` | `hint_facts` | none | `analytics_processed_events` only |
| `returns-processing` | `return_line_facts`, `disposition_facts` | none | `analytics_processed_events` only |
| `exception-management` | `exception_case_facts`, `exception_policy_facts` | none | `analytics_processed_events` only |

| Table kind | Purpose |
| --- | --- |
| `*_rollup`, `*_facts`, `*_events`, `profile_states`, `receipt_discrepancies` | The report itself: either pre-aggregated rollups keyed by the dimensions that context reports on, or one row per fact or milestone, aggregated when a report is read. |
| `analytics_pending_*` | Correlation state for events that must be paired (a claim with its completion, a break start with its end) to compute a duration. |
| `analytics_processed_events` / `analytics_consumed_events` | Idempotent consumption of the analytics topic, which is delivered at least once like any other. |

The report is rebuilt purely from that context's own
`warehouse.<context>.analytics` stream (wes-work-planning's is
`warehouse.wes.analytics`, see [Containers](/architecture/containers#kafka-one-broker-two-topic-families)),
never by a second write from the OLTP side.
