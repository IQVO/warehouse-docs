---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for network-inventory-planning — its integration topic and analytics topic, six consumed topics, the CloudEvents envelope, the outbox, and the state of each edge today.
---

# Async API

## Topics

| Topic | Direction | Messages | Status |
| --- | --- | --- | --- |
| `warehouse.network-inventory-planning.events` | **Published** (this context is the exclusive publisher) | `TransferPlanApproved`, `TransferAllocationRequested`, `WorkDemandReleased` | **Live**. `inventory-storage` consumes `TransferAllocationRequested` (opt-in, `TRANSFER_ALLOCATION_CONSUMER_MODE=kafka`, set in the reference deployment); `wes-work-planning` consumes `WorkDemandReleased` (the fifth topic of its always-on consumer); `TransferPlanApproved` has no consumer |
| `warehouse.network-inventory-planning.analytics` | **Published** and consumed only by this context's own `nip-projector` (ADR 0009) | `TransferStateAdvanced`, `TransferStuckDetected`, `RebalanceRunCompleted`, `dataschema=urn:warehouse:network-inventory-planning:analytics:<EventName>:v1` | **Live** (internal, not an integration contract) |
| `warehouse.facility.events` | **Consumed** (producer: `facility-layout`) | `SiteCapabilityChanged` (every other type is ignored) | **Live** when `SITE_CAPABILITY_CONSUMER_GROUP` is set |
| `warehouse.order-management.events` | **Consumed** (producer: `order-management`) | `SiteSkuDemandChanged` (every other type is ignored) | **Live** when `SITE_SKU_DEMAND_CONSUMER_GROUP` is set |
| `warehouse.warehouse-planning.events` | **Consumed** (producer: `warehouse-planning`) | `CapacityPlanPublished` (every other type is ignored; a legacy payload without `site_id` is excluded) | **Live** when `CAPACITY_PLAN_CONSUMER_GROUP` is set |
| `warehouse.inventory.events` | **Consumed** (producer: `inventory-storage`) | `TransferStockAllocated`, `TransferStockAllocationRejected`, `TransferReceiptStaged`, `TransferStockStowed` | **Live** when `TRANSFER_REPLY_CONSUMER_GROUP` is set |
| `warehouse.fulfillment.events` | **Consumed** (producer: `fulfillment-execution`) | `TransferPicked`, `TransferDispatched`, `TransferArrived` (reserved) | **Live** when `TRANSFER_FACT_CONSUMER_GROUP` is set |

Each consumer group id comes from the environment with no default. An unset
group means that consumer does not exist: a default could let a locally run
process join the live cluster group. The reference deployment sets all five (see
`warehouse-infra` `terraform/network-inventory-planning.tf`), and the analytics
projector's fixed group is `network-inventory-planning-analytics`.

## The envelope

Every message is CloudEvents 1.0 in structured content mode (Kafka header
`content-type: application/cloudevents+json; charset=UTF-8`), the fleet-wide,
mandatory [Event Standard](/strategic-design/event-standard-cloudevents). Here is
the command to `inventory-storage`:

```json
{
  "specversion": "1.0",
  "id": "7c1e0a52-3b49-4d8e-9f0a-2d6b1f4c8e17",
  "source": "/warehouse/network-inventory-planning",
  "type": "com.warehouse.wes.network-inventory-planning.transfer.TransferAllocationRequested",
  "subject": "trf-0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10:1",
  "time": "2026-10-08T14:20:05Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:network-inventory-planning:events:TransferAllocationRequested:v1",
  "data": {
    "transfer_id": "trf-0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
    "transfer_line_id": "trf-0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10:1",
    "origin_site_id": "SIM1",
    "sku": "SKU-1",
    "quantity": 40
  }
}
```

The example is illustrative: the field names, the five-field `data` and the
`subject` rule come from `apis/asyncapi.yaml`; the ids, site and SKU are made up.

The `type` is `com.warehouse.wes.network-inventory-planning.<entity>.<EventName>`.
The entity segment is `transfer` for the two saga events, `workdemand` for
`WorkDemandReleased` (the name WES's consumed contract uses) and `saga` for the
analytics occurrences. `subject` and the Kafka message key differ per event:
`transfer_id` for `TransferPlanApproved` and the analytics transitions,
`transfer_line_id` for `TransferAllocationRequested` (inventory-storage's ledger and
reply-correlation key), `demand_id` for `WorkDemandReleased`, `run_id` for
`RebalanceRunCompleted`. Times are RFC 3339 UTC.

## Publishing: the transactional outbox

There is no dual write. Every use case that changes saga state inserts the
already-encoded CloudEvents into `outbox_events` in the same unit of work as the
state change (the CloudEvents `id` is minted once and persisted with the row, so it
is stable across redelivery). `postgres.OutboxRelay` is the only path to the
broker: it claims unpublished rows `FOR UPDATE SKIP LOCKED`, sends them one at a
time in id order, marks each published as it succeeds, and on a failure records
`attempts` and `last_error` and stops the pass so no later row overtakes the
failed one. Delivery is at-least-once. A request handler never sends to Kafka.

The relay runs when `OUTBOX_RELAY_ENABLED` is set and `KAFKA_BROKERS` is
configured; without brokers the rows wait and the endpoint still works. The W3C
`traceparent` is injected at encode time, inside the use case's transaction, and
travels in the row's headers, so a trace survives the relay hop (ADR 0007).

## Consuming

| Consumed `type` | What it does |
| --- | --- |
| `com.warehouse.wms.facility-layout.site.SiteCapabilityChanged` | Upserts `site_capability`, keyed `site_id`, last writer wins on `capability_revision` |
| `com.warehouse.wes.order-management.siteskudemand.SiteSkuDemandChanged` | Upserts `site_sku_demand`, keyed by order and line; `REMOVED` tombstones |
| `com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanPublished` | Upserts `published_capacity_plan`, keyed `plan_id`, last writer wins on the CloudEvents `time`; no `site_id` means excluded |
| `com.warehouse.wms.inventory-storage.reservation.TransferStockAllocated` | `ALLOCATING` to `ALLOCATED`, then releases the pick demand in the same transaction |
| `com.warehouse.wms.inventory-storage.reservation.TransferStockAllocationRejected` | `ALLOCATING` to `UNFULFILLABLE` with a closed reason |
| `com.warehouse.wes.fulfillment-execution.transfer.TransferPicked` | `ALLOCATED` to `PICKED`, then releases the dispatch demand with the picked quantity |
| `com.warehouse.wes.fulfillment-execution.transfer.TransferDispatched` | `PICKED` to `IN_TRANSIT` |
| `com.warehouse.wes.fulfillment-execution.transfer.TransferArrived` | `IN_TRANSIT` to `ARRIVED` (reserved kind) |
| `com.warehouse.wms.inventory-storage.stock.TransferReceiptStaged` | `IN_TRANSIT` to `ARRIVED` (scan-driven receiving) |
| `com.warehouse.wms.inventory-storage.stock.TransferStockStowed` | `ARRIVED` to `RECEIVED`, stow allocations persisted |

Consumer rules: decode and validate the CloudEvent (structured mode only),
dispatch on the **full** `type`, ignore unknown types, dedupe on the CloudEvents
`id` in `processed_events`. The claim and the effect, including any outbox rows,
commit or roll back together in one unit of work, and the offset is committed only
after the transaction settles. Transient failures (database, transaction) return an
error and the same message is retried with capped exponential backoff, 200 ms up to
5 s, with no attempt limit: a message that keeps failing blocks its partition and
is logged at ERROR on every attempt, never dropped. Deterministic problems (not a CloudEvent, unknown type, malformed payload,
failed domain validation, unknown `transfer_ref`, an illegal transition or a
refused fact) are logged and committed past, never retried. The five OLTP
consumers have **no dead-letter topic**.

The analytics projector differs: it dead-letters a known type with an unusable
payload, or one the store deterministically rejects, to
`warehouse.network-inventory-planning.analytics.dlq` (raw bytes plus
`x-dlq-source-topic`, `x-dlq-error`, `x-dlq-failed-at` headers). It never
dead-letters a transient failure, so a database outage blocks the partition instead
of silently losing analytics. A brand-new projector group starts at the earliest
offset, which lets the model be rebuilt from retained history.

## Machine-generated reference

For the complete generated reference with every payload schema, see the
[AsyncAPI reference](/api-reference/async/network-inventory-planning), generated
from
[`apis/asyncapi.yaml`](https://github.com/IQVO/network-inventory-planning/blob/develop/apis/asyncapi.yaml)
(a verbatim copy lives at `apis/network-inventory-planning/asyncapi.yaml` in this
repository). See [Domain Events](/contexts/network-inventory-planning/domain-events)
for what each event means and who consumes it.
