---
id: domain-events
title: Domain events
sidebar_label: Domain events
---

# Domain events

:::info[Authored in warehouse-docs]
`network-inventory-planning` does not yet ship a `docs/docs/ddd/` pack, so this page was written here from the repository's code and ADRs on `develop` (commit `8d25980`) instead of being synced. When the repository publishes its pack, replace this page with a synced copy.
:::

Every event this context publishes or consumes. All are CloudEvents 1.0 in
structured content mode (Kafka header
`content-type: application/cloudevents+json; charset=UTF-8`), with
`source=/warehouse/network-inventory-planning` on the messages it publishes. The
published catalogue is pinned by
[ADR 0004](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0004-cloudevents-type-catalogue.md)
and an architecture fitness test (`catalogue_fitness_test.go`): adding, renaming
or versioning a published type is one change across the AsyncAPI document, the
emitting code and that ADR.

## Published

Six types, all through the transactional outbox, in the same transaction as the
state change that justifies them. Three go on the integration topic
`warehouse.network-inventory-planning.events`.

| Type | Dataschema | Subject and Kafka key | Raised when | Consumers |
| --- | --- | --- | --- | --- |
| `com.warehouse.wes.network-inventory-planning.transfer.TransferPlanApproved` | `urn:warehouse:network-inventory-planning:events:TransferPlanApproved:v1` | `transfer_id` | an operator approved a proposal (`POST /v1/transfers:approve`, the `APPROVED` transition) | none in the fleet today |
| `com.warehouse.wes.network-inventory-planning.transfer.TransferAllocationRequested` | `urn:warehouse:network-inventory-planning:events:TransferAllocationRequested:v1` | `transfer_line_id` (`<transfer_id>:1` in v1) | the saga's command to allocate origin stock (the `ALLOCATING` transition, same transaction) | `inventory-storage` (its transfer-allocation consumer, ADR 0030 there) |
| `com.warehouse.wes.network-inventory-planning.workdemand.WorkDemandReleased` | `urn:warehouse:network-inventory-planning:events:WorkDemandReleased:v1` | `demand_id` (`<transfer_id>:pick` or `:dispatch`) | the pick leg with the `ALLOCATED` transition, the dispatch leg with the `PICKED` transition | `wes-work-planning` (ADR 0033 there) |

Note the `workdemand` entity segment: WES's consumed contract names it, not
`transfer`.

Payloads, from `apis/asyncapi.yaml`:

- `TransferPlanApproved`: `transfer_id`, `origin_site_id`, `destination_site_id`, `sku`,
  `quantity`, `policy_version`, `operator_reason` (may be empty), `proposal_as_of`.
- `TransferAllocationRequested`: exactly inventory-storage's five fields,
  `transfer_id`, `transfer_line_id`, `origin_site_id`, `sku`, `quantity`.
- `WorkDemandReleased`: exactly WES's eight fields, `demand_id`, `work_kind`
  (`TRANSFER_PICK` or `TRANSFER_DISPATCH` from this context), `transfer_ref`,
  `path_id`, `site_id` (the origin), `cpt` (the triggering fact's time plus the
  leg's configured offset), `sku`, `quantity` (allocated for the pick leg, the picked
  quantity for the dispatch leg).

### Analytics occurrences (ADR 0007)

Three more types on `warehouse.network-inventory-planning.analytics`, with
`dataschema=urn:warehouse:network-inventory-planning:analytics:<EventName>:v1`
(stream `analytics`, not `events`). They are saga-health signals for this
context's own projector, not an integration contract.

| Type | Subject and key | Data | Raised when |
| --- | --- | --- | --- |
| `com.warehouse.wes.network-inventory-planning.saga.TransferStateAdvanced` | `transfer_id` | `transfer_id`, `from` (empty for the creation entry), `to`, `age_seconds` (since creation) | every saga transition |
| `com.warehouse.wes.network-inventory-planning.saga.TransferStuckDetected` | `transfer_id` | `transfer_id`, `state`, `age_seconds` (in the current state), `threshold_seconds` | the observe-only health ticker finds a non-terminal transfer past its per-state threshold |
| `com.warehouse.wes.network-inventory-planning.saga.RebalanceRunCompleted` | `run_id` | `run_id`, `proposal_count`, `rejected_count`, `stale_facts` | a scheduled rebalance pass completes |

The ticker (`NIP_HEALTH_CHECK_INTERVAL`, default `5m`, `0` disables) uses the
default thresholds `ALLOCATING=1h`, `PICKED=24h`, `IN_TRANSIT=72h` and a flat 24
hours for any other non-terminal state, overridable with `NIP_STUCK_THRESHOLDS`.
`NIP_REBALANCE_SCHEDULE` has no default: unset means no scheduled pass.

### Not published

The design plan names more events than the code raises. `TransferProposed`,
`OriginReservationRequested` and any transfer-completed or transfer-cancelled
integration event are not in the AsyncAPI document; the audit trail records those
steps and the analytics topic carries the transitions. A proposal is never
published, because it is advisory.

## Consumed

Ten types, none declared for itself in ADR 0004. All are decoded as CloudEvents
1.0 structured mode only, dispatched on the full `type`, deduplicated on the
CloudEvents `id` in `processed_events`, applied in one unit of work with the claim,
and acknowledged only after the transaction commits.

| Type | Topic | Producer | Effect here |
| --- | --- | --- | --- |
| `com.warehouse.wms.facility-layout.site.SiteCapabilityChanged` | `warehouse.facility.events` | `facility-layout` | upsert `site_capability`, keyed `site_id`, last writer wins on `capability_revision` |
| `com.warehouse.wes.order-management.siteskudemand.SiteSkuDemandChanged` | `warehouse.order-management.events` | `order-management` | upsert `site_sku_demand`, keyed `source_order_id` and `line_no`; `REMOVED` tombstones the row |
| `com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanPublished` | `warehouse.warehouse-planning.events` | `warehouse-planning` | upsert `published_capacity_plan`, keyed `plan_id`, last writer wins on the CloudEvents time; a legacy event without `site_id` is excluded |
| `com.warehouse.wms.inventory-storage.reservation.TransferStockAllocated` | `warehouse.inventory.events` | `inventory-storage` | `ALLOCATING` to `ALLOCATED`; persists reservation id, allocations and expiry; releases the pick demand |
| `com.warehouse.wms.inventory-storage.reservation.TransferStockAllocationRejected` | `warehouse.inventory.events` | `inventory-storage` | `ALLOCATING` to `UNFULFILLABLE` with a closed reason; an unknown reason is a deterministic skip |
| `com.warehouse.wes.fulfillment-execution.transfer.TransferPicked` | `warehouse.fulfillment.events` | `fulfillment-execution` | `ALLOCATED` to `PICKED`; records the picked quantity (short picks allowed); releases the dispatch demand |
| `com.warehouse.wes.fulfillment-execution.transfer.TransferDispatched` | `warehouse.fulfillment.events` | `fulfillment-execution` | `PICKED` to `IN_TRANSIT` |
| `com.warehouse.wes.fulfillment-execution.transfer.TransferArrived` | `warehouse.fulfillment.events` | `fulfillment-execution` | `IN_TRANSIT` to `ARRIVED`; **reserved**, may never fire |
| `com.warehouse.wms.inventory-storage.stock.TransferReceiptStaged` | `warehouse.inventory.events` | `inventory-storage` | `IN_TRANSIT` to `ARRIVED` (scan-driven receiving); the variance is informational |
| `com.warehouse.wms.inventory-storage.stock.TransferStockStowed` | `warehouse.inventory.events` | `inventory-storage` | `ARRIVED` to `RECEIVED`; persists the stow allocations |

Whichever of `TransferArrived` and `TransferReceiptStaged` arrives first drives
the arrival; the other becomes a deterministic out-of-order skip.
