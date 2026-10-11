---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for slotting-optimization — one published integration topic with three SlotPlan events, three consumed sibling topics feeding local copies, dead-lettering and the CloudEvents envelope.
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
| `warehouse.slotting-optimization.events` | **Published** | Three events from the `SlotPlan` aggregate, written by the transactional outbox relay. Key = the plan id. |
| `warehouse.order-management.events` | Consumed | Only `SiteSkuDemandChanged`, into the `demand_lines` local copy. Started only when `DEMAND_MODE=kafka`, group from `DEMAND_CONSUMER_GROUP`. |
| `warehouse.product-master.events` | Consumed | Only `ProductClassified`, `ProductDimensionsDeclared` and `ProductMeasured`, into the `product_profiles` local copy. Started only when `PRODUCT_MODE=kafka`, group from `PRODUCT_CONSUMER_GROUP`. |
| `warehouse.facility.events` | Consumed | Only `ZoneRegistered`, `LocationSlotRegistered` and `LocationSlotDecommissioned`, into the `zones` and `slots` local copies. Started only when `LAYOUT_MODE=kafka`, group from `LAYOUT_CONSUMER_GROUP`. |
| `<consumed topic>.dlq` | Published (dead letters) | One per consumed topic, written only after a transient failure exhausts its retries (see below). |
| `warehouse.slotting-optimization.analytics` | Reserved | Named in ADR 0004 for a later analytics read side. Nothing publishes to it, so the spec does not declare it as a channel. |

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

**Nobody, today.** A search of `warehouse-ops-agent`, `warehouse-console` and
`wes-work-planning` on `develop` finds no subscriber. The planned consumer is
the execution of approved moves as MOVE and REPLENISH work through
`process-path-management`, `wes-work-planning` and `fulfillment-execution`
(fleet edge K29): **planned, not built**, and gated on ADRs in those
contexts. The service is not deployed in `warehouse-infra` either.

## Consuming: local copies

All three consumers dispatch on the full `type` and ignore every other type
on their topic. The CloudEvents `id` claim (`processed_events`) and the
effect run in one transaction, and the offset is committed only afterwards,
so a redelivery is a no-op (`outcome=duplicate`). The product copy also
applies a message only when its `version` is newer than the stored one
(`outcome=stale` otherwise). Each mode defaults to `permissive` (no consumer
started; the copy is whatever the database already holds).

| Situation | Behaviour |
| --- | --- |
| Not a valid CloudEvents 1.0 message, malformed payload, values the use case refuses | logged at WARN and committed past: never retried, never dead-lettered |
| Transient failure (for example Postgres) | the same message is retried with capped backoff, 5 attempts in total, then published to `<topic>.dlq` with `x-dlq-source-topic`, `x-dlq-source-partition`, `x-dlq-source-offset`, `x-dlq-error` and `x-dlq-failed-at` headers |
| Producer down or silent | nothing breaks; the copy goes stale and a plan lists unplaceable SKUs with a reason instead of guessing |

See the producers' contracts on
[Integration](https://iqvo.github.io/slotting-optimization/docs/ecosystem/integration)
and the [context map](/contexts/slotting-optimization/context-map).

## Machine-generated reference

The generated AsyncAPI documentation is on the
[API Reference](/api-reference/async/slotting-optimization) page.
