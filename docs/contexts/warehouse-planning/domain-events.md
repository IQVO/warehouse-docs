---
id: domain-events
title: Domain Events
sidebar_label: Domain Events
description: CapacityPlanCreated, CapacityPlanPublished, CapacityShortageDetected, BottleneckDetected — when each is published, and who consumes them today (nobody yet; order-management is planned).
---

# Domain Events

Four past-tense events, all raised by the `CapacityPlan` aggregate and
published on `warehouse.warehouse-planning.events` (Kafka key = `subject` =
the capacity plan id, so one plan's events stay ordered on one partition).
See the [Aggregate Design Canvas](./aggregate-design-canvas) for the commands
that raise them and [Async API](./async-api) for the wire envelope.

| Event | When published | Consumed by |
| --- | --- | --- |
| **CapacityPlanCreated** | `POST /capacity-plans` (MCP `create_capacity_plan`) creates a `DRAFT` plan | No live consumer today |
| **CapacityPlanPublished** | A plan is published (always, once per plan) | No live consumer today |
| **CapacityShortageDetected** | Publish time, **only when `shortage > 0`** (demand equal to capacity is not a shortage) | No live consumer today — `order-management` is a **planned / in progress** consumer |
| **BottleneckDetected** | Publish time, **only when `shortage > 0`**; names the limiting process step | No live consumer today |

Order on a shortage plan: `CapacityPlanCreated` at creation; then
`CapacityPlanPublished`, `CapacityShortageDetected`, `BottleneckDetected` at
publish.

## The honest state of consumption

**Nothing consumes these events yet.** ADR 0001 names `order-management` as
the intended downstream consumer, "in a later, separate change" in its own
repository; that change is in progress and is **not live**. `warehouse-ops-agent`
and `warehouse-console` do not consume this context today either (neither
Kafka nor REST/MCP). See the platform
[Context Map](/strategic-design/context-map) — the edge is drawn there as
planned, and is to be flipped to live when the consumer ships.

## What is not an event

- `ProcessCapacityRegistered` and `ProcessCapacityChanged` are domain-model
  vocabulary only — nothing raises or publishes them.
- `bottleneck_constraint` and `warnings` are REST/MCP read-model fields; the
  published payloads do not carry them.
- There is no analytics stream (`warehouse.warehouse-planning.analytics`) yet,
  so no event is fanned out a second time.

## Delivery

Events are encoded once, inside the use case, and inserted into the
`outbox_events` table in the same transaction as the plan; a relay in
`cmd/api` drains them to Kafka at-least-once. The CloudEvents `id` is minted
once and persisted with the outbox row, so a redelivery carries the same `id`
and consumers dedupe on it. A breaking payload change would get a new `.v2`
type and dataschema, never a mutation.
