---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
slug: /contexts/order-management/domain-events
description: The ten past-tense domain events order-management raises, when each is published, and which three are forwarded to Kafka as integration events.
---

# Domain Events

Ten past-tense events (`internal/domain/shared/events.go`): the nine in
the catalog below plus the operational-visibility event
`OrderAllocationPartiallyFailed`, raised by the `Order` aggregate's use
cases (including `RepromiseOrder`, which reacts to an inbound Kafka fact
rather than an order lifecycle command) and published through
`ports.EventPublisher`. Since
[ADR-0005](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0005-choreographed-release-via-kafka.md),
that port has TWO real implementations, selected by the `EVENT_PUBLISHER`
env var:

- **`log`** (default): every event is logged as JSON, in-process only.
- **`kafka`**: the SAME events are logged/persisted locally as before, but
  `OrderAllocated`, `OrderPartiallyAllocated` and — since
  [ADR-0018](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0018-repromise-order-consumer-and-order-repromised.md)
  — `OrderRepromised` are ADDITIONALLY forwarded to the shared Kafka
  broker, topic `warehouse.order-management.events`, for
  `wes-work-planning` (or any other subscriber) to consume.

Every event embeds an `occurredAt` from the injected `Clock` port — never
wall-clock time read directly — so ordering is a domain fact, not an
infrastructure artefact.

## The catalog

| Event | When published | Consumed by |
| --- | --- | --- |
| `OrderReceived` | `ReceiveOrder` accepts a new order into `Received` status | No Kafka consumer in v1 — log publisher only |
| `OrderLineAllocated` | `inventory-storage`'s `POST /reservations` succeeds for a line | No Kafka consumer in v1 — log publisher only |
| `OrderLineBackordered` | `inventory-storage` returns `409` for a line (a business fact) | No Kafka consumer in v1 — log publisher only |
| `OrderAllocated` | Every line on the order is `Allocated`, and the lines eligible for release in this pass WERE released | **Forwarded to Kafka** (`warehouse.order-management.events`) — consumed by `wes-work-planning`'s own consumer, which reacts to the released `lines[]` payload to enqueue its own work independently. Fire-and-forget: no confirmation reply event exists in v1. |
| `OrderPartiallyAllocated` | Some lines allocated, some backordered, on an order that allows partial shipment; the eligible lines WERE released | **Forwarded to Kafka**, same contract and same fire-and-forget caveat as `OrderAllocated` |
| `OrderLineReleased` | A line transitioned to `Released` (a pure domain fact — no longer tied to a synchronous `wes-work-planning` call) | No Kafka consumer in v1 — log publisher only |
| `OrderReleased` | Every line on the order has been released | No Kafka consumer in v1 — log publisher only |
| `OrderCancelled` | `CancelOrder` succeeds, revoking every allocated line's reservation | No Kafka consumer in v1 — log publisher only |
| `OrderRepromised` | `RepromiseOrder` ([ADR-0018](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0018-repromise-order-consumer-and-order-repromised.md)) reacts to a `fulfillment-execution` `TaskCPTMissed`/`PackageManifested` fact and finds the affected shipment group's promise moved | **Forwarded to Kafka** (`warehouse.order-management.events`) — the fleet's "your delivery is delayed" signal. No sibling context consumes it yet. |

Three of them are integration events — mirroring `inventory-storage`'s
own precedent of forwarding only a subset of its domain events
(`StockReserved`, `ReservationRevoked`). The other six named events stay
local: `OrderReceived` through `OrderLineBackordered` are intake/allocation
progress this service's own callers already see synchronously in the HTTP
response; `OrderLineReleased`/`OrderReleased`/`OrderCancelled` are equally
local concerns with no cross-context subscriber today.

## The operational-visibility event

[ADR-0003](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0003-ship-complete-default-and-fail-closed-allocation.md)
documents one further event, **`OrderAllocationPartiallyFailed`**: raised
when the shared allocation pass hits a hard, non-business (non-409)
failure partway through. The lines that genuinely succeeded before the
failure are kept `Allocated` — discarding them would strand real
reservations inside `inventory-storage` — and the event exists purely so
that partial-progress outcome is operationally visible rather than only
discoverable by reading a source comment. Carries `AllocatedLines`,
`RemainingLines`, and a truncated `Cause`. Publishing it is best-effort:
if the publish itself fails, that failure is joined onto the original
allocation error rather than replacing it. It is never forwarded to
Kafka — no Kafka consumer in v1 for this event either.

## The Kafka integration contract (the three forwarded events)

- **Outbound topic:** `warehouse.order-management.events`
- **Inbound topic (ADR-0018 only):** `warehouse.fulfillment.events` —
  `fulfillment-execution`'s fan-out topic, consumed ONLY for
  `TaskCPTMissed`/`PackageManifested` under the stable consumer group
  `order-management-repromise`.
- **Envelope:** `{event_id, event_type, occurred_at, source, data}` —
  matches the platform-wide shape used by `inventory-storage`
- **`data` shape** for `OrderAllocated`/`OrderPartiallyAllocated`
  (frozen — shared verbatim with `wes-work-planning`'s Kafka consumer):

  ```json
  {
    "order_id": "ord-a1b2c3d4-0000-0000-0000-000000000001",
    "promise_date": "2026-08-27T09:00:00Z",
    "promise_cpt_id": "sp1-1200",
    "promise_basis": "Capability",
    "lines": [
      {"line_no": 1, "sku": "SKU-1", "path_id": "pick", "gift_wrap": false,
       "fulfillment_class": "SINGLE", "promise_cpt_id": "sp1-1200",
       "promise_basis": "Capability", "promise_cutoff_at": "2026-08-27T12:00:00Z"}
    ]
  }
  ```

  The original four line fields are frozen; everything else is additive
  and optional — `fulfillment_class` (ADR-0008) and the order-level and
  per-line `promise_cpt_id`/`promise_basis`/`promise_cutoff_at`
  (ADR-0014/0017; omitted for a `LeadTime`-basis promise).

- **`data` shape** for `OrderRepromised` (ADR-0018, additive):
  `{order_id, cpt_id_old, cpt_id_new, reason}` — `cpt_id_old`/`cpt_id_new`
  are omitted (never present-and-empty) for a `LeadTime`-basis promise on
  that side.

- **The deterministic work-unit id.** `wes-work-planning`'s consumer
  independently reconstructs `{order_id}-line-{line_no}` from the payload
  above (`usecases.WorkUnitID` in this repo) — this id is never
  transmitted on the wire; both sides derive it the same way, and it MUST
  match byte-for-byte or idempotent redelivery breaks. ADR-0018's
  `RepromiseOrder` consumer reverses the same formula
  (`usecases.ParseWorkUnitID`) to recover `(OrderId, LineNo)` from
  `fulfillment-execution`'s `order_ref`.
- **Fire-and-forget, deliberately.** v1 has NO release-confirmation reply
  event from `wes-work-planning` back to this service — a documented gap,
  not an oversight.
- **No ordering guarantee across events on the topic** (no partition
  key), matching `inventory-storage`'s own documented limitation for the
  identical reason.

## A separate, additive analytics topic

[ADR-0006](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0006-analytical-data-product.md)
adds a second, wider event fan-out on **`warehouse.order-management.analytics`**,
carrying all ten domain events (including
`OrderAllocationPartiallyFailed` and, since
[ADR-0019](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0019-promise-kpis-on-order-funnel.md),
`OrderRepromised`) under the shared Envelope v1 wrapper (keyed by
`OrderId`) for
the [Order Funnel & Allocation Health report](https://github.com/claudioed/order-management/blob/develop/docs/docs/analytics/order-funnel-report.md),
consumed only by this context's own `cmd/order-projector`. This topic is
untouched by, and does not widen, the integration contract above.

## Which use case emits what

```mermaid
flowchart LR
  RO["ReceiveOrder"] --> E1["OrderReceived"]
  RO --> AR["allocateAndRelease<br/>(shared)"]
  RA["RetryAllocation"] --> AR
  AR --> E2["OrderLineAllocated"]
  AR --> E3["OrderLineBackordered"]
  AR --> E4["OrderAllocated"]
  AR --> E5["OrderPartiallyAllocated"]
  RH["ReleaseHeldOrder"] --> AR
  AR --> E6["OrderLineReleased / OrderReleased"]
  CO["CancelOrder"] --> E8["OrderCancelled"]
  RP["RepromiseOrder"] --> E9["OrderRepromised"]

  E1 & E2 & E3 & E4 & E5 & E6 & E8 & E9 --> LOG["ports.EventPublisher<br/>log or Postgres (EVENT_PUBLISHER=log, default)"]
  E4 & E5 & E9 --> KAFKA["Kafka topic<br/>warehouse.order-management.events<br/>(EVENT_PUBLISHER=kafka)"]

  classDef local fill:#94a3b8,stroke:#475569,color:#0f172a;
  classDef kafka fill:#38bdf8,stroke:#0369a1,color:#0f172a;
  class LOG local;
  class KAFKA kafka;
```
