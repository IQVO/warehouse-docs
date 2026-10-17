---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for pick-face-replenishment — two published topics (three request events plus an analytics-only policy event), three consumed sibling topics feeding local copies and closing requests, dead-lettering and the CloudEvents envelope.
---

# Async API

This page is written here from `apis/asyncapi.yaml`, the encoder and relay in
`internal/adapters/outbound/` and the consumers in
`internal/adapters/inbound/kafka/` on `pick-face-replenishment`'s `develop`.
The machine-generated reference is at the bottom. For per-event payloads and
the producing use cases, see
[Domain Events](/contexts/pick-face-replenishment/domain-events).

:::caution[Nothing of this runs in the reference cluster yet]
`warehouse-infra` `develop` has no entry for this context, so no instance
publishes or consumes any topic below in the reference deployment. Two of the
consumed types are also not produced yet: `inventory-storage` publishes no
`BinStockLevelChanged`, and its `StockRelocated` never carries the reason
`REPLENISHMENT`. Nothing consumes `ReplenishmentRequested`. The tables state
what the code does and what each producer or consumer publishes today.
:::

## Topics

| Topic | Direction | Notes |
| --- | --- | --- |
| `warehouse.pick-face-replenishment.events` | **Published** | `ReplenishmentRequested`, `ReplenishmentCompleted` and `ReplenishmentCancelled` from the `ReplenishmentRequest` aggregate, written by the transactional outbox relay. Key = the request id. No consumer exists in any repository checked: `wes-work-planning` is the intended one for `ReplenishmentRequested` (planned). |
| `warehouse.pick-face-replenishment.analytics` | **Published** | The same three request events again (same `type`, same CloudEvents `id`, dataschema `...:analytics:<EventName>:v1`) plus the analytics-only `ReplenishmentPolicyDeclared` (key and subject `<site_id>/<sku>`). No reader exists yet. |
| `warehouse.inventory.events` | Consumed | Only `BinStockLevelChanged` (key `<bin>:<sku>`) and `StockRelocated` (key `relocation_id`). Started only when `INVENTORY_MODE=kafka`, group from `INVENTORY_CONSUMER_GROUP`. |
| `warehouse.slotting-optimization.events` | Consumed | Only `SlotPlanApproved`. Started only when `SLOTTING_MODE=kafka`, group from `SLOTTING_CONSUMER_GROUP`. |
| `warehouse.facility.events` | Consumed | Only `ZoneRegistered`, `LocationSlotRegistered` and `LocationSlotDecommissioned`. Started only when `LAYOUT_MODE=kafka`, group from `LAYOUT_CONSUMER_GROUP`. |
| `<consumed topic>.dlq` | Published (dead letters) | One per consumed topic, written after a transient failure exhausts its retries, or at once for an undecodable payload of a handled type (see below). |

## The envelope

Every message is a CloudEvents 1.0 event in structured content mode, Kafka
header `content-type: application/cloudevents+json; charset=UTF-8`
(see the [Event Standard](/strategic-design/event-standard-cloudevents)).

| Attribute | Value |
| --- | --- |
| `source` | `/warehouse/pick-face-replenishment` |
| `type` | `com.warehouse.wms.pick-face-replenishment.<entity>.<EventName>`, with entity `replenishment` or `policy` |
| `subject` | the request id; `<site_id>/<sku>` for the policy event |
| `time` | the domain occurred-at (UTC) |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:warehouse:pick-face-replenishment:<events\|analytics>:<EventName>:v1` |
| Kafka key | the subject, so one request's events stay ordered on one partition |

`id` is a UUID minted once at encode time and stored with the outbox row, so a
relay retry republishes the same `id`. A breaking payload change is a new
`.v2` type and dataschema, never a mutation. Optional W3C trace-context
headers carry the trace of the request that wrote the outbox row; consumers
may extract them and must not require them.

Example from the spec (`ReplenishmentRequested`):

```json
{
  "specversion": "1.0",
  "id": "6f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e5f",
  "source": "/warehouse/pick-face-replenishment",
  "type": "com.warehouse.wms.pick-face-replenishment.replenishment.ReplenishmentRequested",
  "subject": "repl-3b0e8d2a-7c41-4f6a-9d15-2a8b6c4e1f07",
  "time": "2026-10-17T09:30:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:pick-face-replenishment:events:ReplenishmentRequested:v1",
  "data": {
    "request_id": "repl-3b0e8d2a-7c41-4f6a-9d15-2a8b6c4e1f07",
    "site_id": "WH1",
    "sku": "SKU-1",
    "forward_bin": "WH1-FWD-A01-01-01-A",
    "source_bin": "WH1-RSV-A07-03-02-B",
    "quantity": 24,
    "priority": "NORMAL",
    "policy_min": 10,
    "policy_max": 60,
    "requested_at": "2026-10-17T09:30:00Z"
  }
}
```

## Published types

| Type (after `com.warehouse.wms.pick-face-replenishment.`) | Raised by | Payload |
| --- | --- | --- |
| `replenishment.ReplenishmentRequested` | `Request.Plan`, through the detector on a bin level or forward map change, `POST /sites/{siteId}/evaluate` or `POST /replenishments` | `request_id`, `site_id`, `sku`, `forward_bin`, `source_bin`, `quantity`, `priority` (`NORMAL` or `URGENT`), `policy_min`, `policy_max`, `requested_at` |
| `replenishment.ReplenishmentCompleted` | `Request.Complete`, through a `StockRelocated` with reason `REPLENISHMENT` | the same ids and bins, `quantity` = what the relocation moved (possibly less than requested), `completed_at` |
| `replenishment.ReplenishmentCancelled` | `Request.Cancel`, through `POST /replenishments/{requestId}/cancel`, a policy removal or a `SlotPlanApproved` that drops the assignment | `request_id`, `site_id`, `sku`, `reason` (`OPERATOR`, `ASSIGNMENT_CHANGED`, `POLICY_REMOVED`), `cancelled_at` |
| `policy.ReplenishmentPolicyDeclared` (analytics topic only) | `DeclarePolicy` through `PUT /policies/{siteId}/{sku}` | `site_id`, `sku`, `min_qty`, `max_qty`, `multiple`, `version`, `declared_at` |

Removing a policy raises no event of its own: its open requests are cancelled
with reason `POLICY_REMOVED`. `ReplenishmentRequested` is the only event that
asks the floor to do something. `ReplenishmentCancelled` tells a downstream to
drop work it has not released; a request already planned or released as floor
work is not recalled by this service.

## Publishing: the transactional outbox

Events leave only through the outbox: the request row and its already-encoded
event rows commit in one Postgres transaction, and the relay (default every
1 s via `OUTBOX_RELAY_INTERVAL`, 100 rows per pass, `FOR UPDATE SKIP LOCKED`,
id order, stops at the first failure so per-request order holds) sends them.
The relay's Kafka writer waits for all in-sync replicas (acks=all), hashes on
the key, and has a 10 ms batch timeout. A row that fails `OUTBOX_MAX_ATTEMPTS`
times (default 20; `0` is unlimited) is excluded from future claims until it is
re-armed by hand. Delivery is at-least-once with the same `id` on a retry, so
consumers dedupe on it. The relay runs only when `DATABASE_URL` and
`KAFKA_BROKERS` are both set.

## Who consumes these events

**Nobody does today.** The intended consumer of `ReplenishmentRequested` is
`wes-work-planning`, which would plan one `REPLENISH` work unit per request
(producer-side change P3b of the context's ADR 0001), then
`fulfillment-execution` (a `REPLENISH` task, P3) and `inventory-storage`
(`RelocateStock` with reason `REPLENISHMENT` and `source_ref` = the request id,
P4), closing the loop with a `StockRelocated`. None of these exists on
`develop`: `wes-work-planning` has only `RELOCATE` work (for slot plans).
`ReplenishmentCompleted`, `ReplenishmentCancelled` and the analytics topic
have no consumer in any repository checked. This is the fleet's edge K44
(planned); see the [context map](/contexts/pick-face-replenishment/context-map).

## Consuming: local copies and closing requests

All three consumers dispatch on the full `type` and ignore every other type on
their topic. The CloudEvents `id` claim (`processed_events`) and the effect run
in one transaction, and the offset is committed only afterwards, so a
redelivery is a no-op (`duplicate`). Each mode defaults to `permissive` (no
consumer started; the copy is whatever the database already holds).

| Type | Effect | Producer today |
| --- | --- | --- |
| `BinStockLevelChanged` | upsert `bin_stock_levels` only when `version` is greater than the stored one (the levels are absolute), then evaluate the SKU's pick face | **absent**: `inventory-storage` does not publish it (producer change P1); the contract is pinned consumer-first |
| `StockRelocated` | complete the open request named by `source_ref`, only when `reason` is `REPLENISHMENT` and site, SKU and both bins match; every other reason is ignored | published by `inventory-storage`, but `REPLENISHMENT` is not among its reasons yet (`SLOTTING`, `CONSOLIDATION`, `MANUAL`; change P4) |
| `SlotPlanApproved` | replace the site's forward map wholesale, cancel requests whose bin no longer holds their SKU (`ASSIGNMENT_CHANGED`), evaluate new or moved faces; an older or equal `approved_at` is `stale` and ignored | published by `slotting-optimization` (live) |
| `ZoneRegistered`, `LocationSlotRegistered`, `LocationSlotDecommissioned` | upsert `zones` and `locations`, to tell reserve bins from forward bins; a decommissioned location stays decommissioned | published by `facility-layout` (live) |

| Situation | Behaviour |
| --- | --- |
| Not a valid CloudEvents 1.0 message | logged at WARN and committed past: never retried, never dead-lettered |
| Unknown `type` on the topic | ignored silently |
| Transient failure (for example Postgres) | the same message is retried with backoff (200 ms doubling to a 5 s cap), 5 attempts in total, then published to `<topic>.dlq` with `x-dlq-source-topic`, `x-dlq-source-partition`, `x-dlq-source-offset`, `x-dlq-error` and `x-dlq-failed-at` headers |
| Payload of a handled type that can never be applied (undecodable `data`, a blank required field, a negative level, `version` below 1, a `SlotPlanApproved` that assigns one SKU twice, a `REPLENISHMENT` relocation of quantity below 1) | deterministic poison: dead-lettered at once, no retries |
| Context cancelled during shutdown | never dead-lettered; the offset stays uncommitted and the message is redelivered after restart |
| Producer down or silent | nothing breaks; the copy goes stale and the detector reports `NO_SOURCE` or `NO_POLICY` instead of guessing |

A location and its zone may arrive in any order; they are joined when read. A
bin whose location is unknown counts as a pick face (permissive until the
layout converges) but never as a reserve bin.

See the consumed contracts on
[Integration](https://iqvo.github.io/pick-face-replenishment/docs/ecosystem/integration)
and the [context map](/contexts/pick-face-replenishment/context-map). The
dead-letter procedure is in the
[Runbook](/contexts/pick-face-replenishment/runbook).

## Machine-generated reference

The generated AsyncAPI documentation is on the
[API Reference](/api-reference/async/pick-face-replenishment) page.
