---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for process-path-management — topics, CloudEvents envelope, the four event types, and the live consumer state of this integration today.
---

# Async API

## Two topics

This context publishes on two separate Kafka topics, deliberately kept
apart so their contracts evolve independently:

- **`warehouse.process-path-management.events`** — the integration
  Published Language, documented below. Four sibling contexts consume it
  live; a fifth, `network-fulfillment`, has a wired but unused consumer.
- **`warehouse.process-path-management.analytics`** — a second,
  additive analytics-only topic (ADR 0007) feeding this service's own
  `cmd/pathmgmt-projector`. See
  [Bounded Context Canvas](./bounded-context-canvas)'s Outbound
  Communication table for its REST reports surface.

## Topic

`warehouse.process-path-management.events`

This context is the **exclusive** publisher on this topic and has **no
consumer of any sibling's topic** (its only Kafka consumer is its own
analytics projector) and **zero synchronous dependency** in any
direction — it is the SOURCE of the process-path published language, never
a consumer of anyone else's. Publishing happens whenever
`EVENT_PUBLISHER=kafka` is configured (the default is a local log
publisher); with a `DATABASE_URL` set as well — the cluster's mode —
every event goes through the transactional outbox (ADR 0003), relayed to
Kafka by an in-process relay, and each domain event enqueues one row per
topic in the same transaction as the aggregate change.

The topic carries four event types, filtered by consumers on the full
CloudEvents `type`:
`com.warehouse.wes.process-path-management.processpath.ProcessPathCreated`,
`…processpath.ProcessPathUpdated`, `…processpath.ProcessPathDeactivated`
(keyed and `subject`ed by `path_id`), and
`com.warehouse.wes.process-path-management.cptschedule.CPTScheduleChanged`
(keyed by `site_id`, ADR 0010).

## The envelope

Every warehouse-systems publisher emits CloudEvents 1.0 in structured
content mode (Kafka header
`content-type: application/cloudevents+json; charset=UTF-8`) — the
fleet-wide, mandatory [Event Standard](/strategic-design/event-standard-cloudevents). Here it is for `ProcessPathCreated`:

```json
{
  "specversion": "1.0",
  "id": "uuid-v4",
  "source": "/warehouse/process-path-management",
  "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
  "subject": "PICK",
  "time": "2026-09-06T00:00:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:process-path-management:events:ProcessPathCreated:v1",
  "data": {
    "path_id": "PICK",
    "match_prefix": "pick",
    "direct": true,
    "required_capabilities": ["pick"],
    "cycle_time_p95": "2h0m0s"
  }
}
```

`data` may also carry an optional `destination_location_role` (ADR 0009;
omitted when unset) and an `eligibility` object (ADR 0010).
`ProcessPathUpdated` and `ProcessPathDeactivated` share the same envelope, with `data` carrying the fields relevant to each transition —
`ProcessPathDeactivated` carries only `path_id`. `CPTScheduleChanged`
carries a full schedule snapshot (`site_id`, `timezone`, `cutoffs[]`),
never a diff. See
[apis/asyncapi.yaml](https://github.com/IQVO/process-path-management/blob/develop/apis/asyncapi.yaml)
in the source repository for the full, per-event-type schema.

## Why Kafka, not synchronous HTTP read-through

Every other cross-context integration in this fleet that resembles
"context A needs a fact that context B owns" is Kafka-driven, never a
synchronous hot-path call — `StockReserved`, `ShiftPlanCommitted`, and
`TaskCompleted` are all consumed asynchronously, never RPC'd on every
request. A synchronous read-through here — each consumer calling this service's REST API on every `claimNext`/dispatch
decision — would put a Generic-subdomain service's availability on the hot
path of the consuming contexts' most latency-sensitive operations.
Path definitions also change rarely relative to how often they'd be read,
which makes a local, event-maintained cache in each consumer the natural
fit. See [ADR 0001](https://github.com/IQVO/process-path-management/blob/develop/docs/docs/adr/0001-process-path-management-bounded-context.md)
for the full reasoning.

## Live consumers today

:::note[Four live consumers]
The topic and this service's publisher are **real and tested**.
`fulfillment-execution`, `wes-work-planning`, and `workforce-management`
each replay it into a local catalogue cache (ADR 0002; `ProcessPath*`
events only), rather than reading a live value on every dispatch
decision. `order-management` consumes it with two consumers — path
`cycle_time_p95`/`eligibility` and `CPTScheduleChanged` — as the
fulfillment capability contract behind its promise (ADR 0010). Every
consumer's catalogue source is opt-in (`PATH_CATALOGUE_SOURCE`, default
`file`/`none`); the cluster sets `kafka`. A fifth consumer, `network-fulfillment`, reads
`ProcessPath*` and `CPTScheduleChanged` into its `processpathcache`, but it
starts only with `CAPABILITY_OFFER_ENABLED=true`, which the reference
deployment does not set, so that edge is wired but unused. See [Domain Events](./domain-events) and the platform
[Context Map](/strategic-design/context-map) for the full, honest state.
:::

## Generated reference

For the machine-generated, per-event-type schema documentation (produced
from the real, linted `apis/asyncapi.yaml`), see
[/api-reference/async/process-path-management](/api-reference/async/process-path-management).
