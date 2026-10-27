---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for slotting-optimization — one published integration topic with three SlotPlan events and its analytics mirror, four consumed sibling topics (five consumers: four feeding local copies, one feeding the plan execution progress), dead-lettering and the CloudEvents envelope.
---

# Async API

This page is written here from `apis/asyncapi.yaml`,
`internal/domain/slotplan/events.go`, the encoder and relay sink in
`internal/adapters/outbound/kafka/` and the consumers in
`internal/adapters/inbound/kafka/` on `slotting-optimization`'s `develop`.
The machine-generated reference is at the bottom. For per-event payloads,
producer use cases and consumed contracts, see
[Domain Events](/contexts/slotting-optimization/domain-events).

## Topics

| Topic | Direction | Notes |
| --- | --- | --- |
| `warehouse.slotting-optimization.events` | **Published** | Three events from the `SlotPlan` aggregate, written by the transactional outbox relay. Key = the plan id. `wes-work-planning` and `pick-face-replenishment` consume `SlotPlanApproved`. |
| `warehouse.order-management.events` | Consumed | Only `SiteSkuDemandChanged`, into the `demand_lines` local copy. `DEMAND_MODE` defaults to `kafka` (`permissive` and `off` are boot errors, ADR 0011), group from `DEMAND_CONSUMER_GROUP`. |
| `warehouse.product-master.events` | Consumed | `ProductClassified`, `ProductDimensionsDeclared` and `ProductMeasured` into the `product_profiles` local copy, and (a second consumer, `PACK_LEVEL_MODE` / `PACK_LEVEL_CONSUMER_GROUP`, ADR 0012) `ProductPackLevelDeclared`, `ProductPackLevelMeasured` and `ProductPackLevelRetired` into the local pack view behind the case-pick faces. `PRODUCT_MODE` defaults to `kafka` (`permissive` and `off` are boot errors, ADR 0011), group from `PRODUCT_CONSUMER_GROUP`. |
| `warehouse.facility.events` | Consumed | Only `ZoneRegistered`, `LocationSlotRegistered` and `LocationSlotDecommissioned`, into the `zones` and `slots` local copies. `LAYOUT_MODE` defaults to `kafka` (`permissive` and `off` are boot errors, ADR 0011), group from `LAYOUT_CONSUMER_GROUP`. |
| `warehouse.inventory.events` | Consumed | Only `com.warehouse.wms.inventory-storage.stock.StockRelocated`, into `slot_plan_move_executions` (the plans' execution progress, ADR 0010). `RELOCATION_MODE` defaults to `kafka` (ADR 0011), group from `RELOCATION_CONSUMER_GROUP` (no default). |
| `<consumed topic>.dlq` | Published (dead letters) | One per consumed topic, written after a transient failure exhausts its retries, or at once for a `StockRelocated` that cannot be decoded (see below). |
| `warehouse.slotting-optimization.analytics` | **Published** (internal data product) | The three SlotPlan events again, read only by this context's own `slotting-projector` (ADR 0006). |

## The envelope

Every message is a CloudEvents 1.0 event in structured content mode, Kafka
header `content-type: application/cloudevents+json; charset=UTF-8`
(see the [Event Standard](/strategic-design/event-standard-cloudevents)).

| Attribute | Value |
| --- | --- |
| `source` | `/warehouse/slotting-optimization` |
| `type` | `com.warehouse.wms.slotting-optimization.slotplan.<EventName>` |
| `subject` | the plan id (`plan-<uuid>`) |
| `time` | the domain occurred-at (UTC) |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:warehouse:slotting-optimization:events:<EventName>:v1` |
| Kafka key | the plan id, so one plan's events stay ordered on one partition |

`id` is a UUID minted once at encode time and stored with the outbox row, so a
relay retry republishes the same `id`. A breaking payload change is a new
`.v2` type and dataschema, never a mutation.

Example from the spec (`SlotPlanRejected`):

```json
{
  "specversion": "1.0",
  "id": "4d3c2b1a-0f9e-4d8c-8b7a-6f5e4d3c2b1a",
  "source": "/warehouse/slotting-optimization",
  "type": "com.warehouse.wms.slotting-optimization.slotplan.SlotPlanRejected",
  "subject": "plan-3b0e8d2a-7c41-4f6a-9d15-2a8b6c4e1f07",
  "time": "2026-10-08T12:15:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:slotting-optimization:events:SlotPlanRejected:v1",
  "data": {
    "plan_id": "plan-3b0e8d2a-7c41-4f6a-9d15-2a8b6c4e1f07",
    "site_id": "SITE-1",
    "rejected_at": "2026-10-08T12:15:00Z",
    "reason": "Too many relocations before peak season."
  }
}
```

## Published types

| Type (after `com.warehouse.wms.slotting-optimization.`) | Raised by | Payload |
| --- | --- | --- |
| `slotplan.SlotPlanGenerated` | `slotplan.Generate` through `POST /slot-plans` (`GeneratePlan`) | sizes only: `plan_id`, `site_id`, `window_from`, `window_to`, `policy`, `assignment_count`, `move_count`, `unassigned_count` |
| `slotplan.SlotPlanApproved` | `SlotPlan.Approve` through `POST /slot-plans/{planId}/approve` (`ApprovePlan`) | the FULL `assignments` map (`{sku, slot}`), the `moves` (`Assign`, `Relocate`, `Vacate`), `approved_at`, and `supersedes_plan_id` when the site had an Approved plan |
| `slotplan.SlotPlanRejected` | `SlotPlan.Reject` through `POST /slot-plans/{planId}/reject` (`RejectPlan`) | `rejected_at` and an optional `reason` |

`Supersede` raises **no** event: consumers learn it from
`supersedes_plan_id` on the newer `SlotPlanApproved`. Only `SlotPlanApproved`
changes the published forward-slot picture.

## Publishing: the transactional outbox

Events leave only through the outbox: the plan row and its already-encoded
event rows commit in one Postgres transaction, and the relay (default every
1 s via `OUTBOX_RELAY_INTERVAL`, 100 rows per pass, `FOR UPDATE SKIP LOCKED`,
id order, stops at the first failure so per-plan order holds) sends them. The
relay's Kafka writer waits for all in-sync replicas (`RequireAll`), hashes on
the key, and has a 10 ms batch timeout. Delivery is at-least-once with the
same `id` on a retry, so consumers dedupe on it. `EVENT_PUBLISHER=log` (the
default) only logs the messages; `EVENT_PUBLISHER=kafka` requires
`KAFKA_BROKERS`.

## Who consumes these events

**`wes-work-planning` consumes `SlotPlanApproved`**, and nobody consumes
`SlotPlanGenerated` or `SlotPlanRejected`. Its inbound consumer reads this
topic as its sixth stream, under its existing consumer group, whenever
`KAFKA_BROKERS` is set (`kafka.enabled` in `warehouse-infra`'s
`helm-values/wes-work-planning.yaml`), with its own
`warehouse.slotting-optimization.events.dlq`. Per plan it plans one `RELOCATE`
work unit per entry of `moves` (id `<plan_id>-move-<move_seq>`, `move_seq` =
the move's 0-based position in `moves`), holds back a move into a slot that
another move of the plan vacates until that vacate completes, and cancels the
not-yet-released work of an older plan of the same site (wes-work-planning
ADR-0040). A plan that breaks the contract, or that arrives before the
`RELOCATE` process path exists in the catalogue, is retried and then
dead-lettered. The rest of the chain is `fulfillment-execution` (the `RELOCATE`
task, its ADR 0047), `inventory-storage` (`RelocateStock`, its ADR 0039) and
back to this context as `StockRelocated` (below). This is fleet edge K29, with
K37 and K38 closing the loop; all three are live in `warehouse-infra`
`develop`.

## Consuming: local copies and the execution progress

All five consumers dispatch on the full `type` and ignore every other type
on their topic. The CloudEvents `id` claim (`processed_events`) and the
effect run in one transaction, and the offset is committed only afterwards,
so a redelivery is a no-op (`outcome=duplicate`). The product copy also
applies a message only when its `version` is newer than the stored one
(`outcome=stale` otherwise). Every mode defaults to `kafka`; `permissive` and
`off` are boot errors (ADR 0011).

| Situation | Behaviour |
| --- | --- |
| Not a valid CloudEvents 1.0 message, malformed payload, values the use case refuses | logged at WARN and committed past: never retried, never dead-lettered |
| Transient failure (for example Postgres) | the same message is retried with capped backoff, 5 attempts in total, then published to `<topic>.dlq` with `x-dlq-source-topic`, `x-dlq-source-partition`, `x-dlq-source-offset`, `x-dlq-error` and `x-dlq-failed-at` headers |
| `StockRelocated` whose data cannot be decoded, misses a required field or carries a quantity below 1 | deterministic poison: dead-lettered at once to `warehouse.inventory.events.dlq`, no retries |
| `StockRelocated` that matches no move (unknown plan or move, other site, a manual or consolidation relocation) | claimed, logged at INFO and counted (`outcome=unmatched`, with a reason), never dead-lettered |
| Producer down or silent | nothing breaks; the copy goes stale and a plan lists unplaceable SKUs with a reason instead of guessing |

### `StockRelocated` and the plan's `execution`

`inventory-storage` raises `StockRelocated` for `POST /relocations` and for
every completed `RELOCATE` task. This context acts on `relocation_id`,
`site_code`, `sku`, `from_bin`, `to_bin`, `quantity`, `source_ref` and
`occurred_at`. On the slot-plan path `source_ref` is the move reference
`<plan_id>:<move_seq>` that `fulfillment-execution` carries as
`relocation_ref`; it matches when the plan of that id is Approved or
Superseded, belongs to `site_code`, and has a move at `move_seq` for that SKU.
When `source_ref` is no move reference, the move of the site's current
Approved plan with that SKU whose bins agree with its kind matches instead. A
match is recorded once per `relocation_id` in `slot_plan_move_executions`, and
nothing is published in response. The result is the optional `execution`
object on `GET /slot-plans/{planId}` (and the MCP `get_slot_plan`): moves
total, moves executed, last executed at, and per move an executed flag and
quantity.

See the producers' contracts on
[Integration](https://iqvo.github.io/slotting-optimization/docs/ecosystem/integration)
and the [context map](/contexts/slotting-optimization/context-map).

## Machine-generated reference

The generated AsyncAPI documentation is on the
[API Reference](/api-reference/async/slotting-optimization) page.
