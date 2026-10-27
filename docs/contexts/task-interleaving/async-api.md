---
id: async-api
title: Async API
sidebar_label: Async API
description: Kafka integration for task-interleaving — two published topics (the hint on the integration topic, hint outcomes and policy declarations on the analytics topic), two consumed sibling topics feeding the open-task pool and the location geometry, dead-lettering and the CloudEvents envelope.
---

# Async API

This page is written here from `apis/asyncapi.yaml`, the encoder and relay in
`internal/adapters/outbound/` and the consumers in
`internal/adapters/inbound/kafka/` on `task-interleaving`'s `develop`. The
machine-generated reference is at the bottom. For per-event payloads and the
producing use cases, see
[Domain Events](/contexts/task-interleaving/domain-events).

:::info[Wired in warehouse-infra develop]
`warehouse-infra` `develop` registers this context (`terraform/apps.yaml`,
`helm-values/task-interleaving.yaml` with both consumer groups and the
analytics projector). Both consumed sides are built and match their
producers, and `fulfillment-execution` consumes the published
`InterleavingHintIssued` (its ADR 0051, `TASK_INTERLEAVING_MODE=kafka` in
`warehouse-infra`). The kind cluster was not checked for this page. The tables
state what the code does.
:::

## Topics

| Topic | Direction | Notes |
| --- | --- | --- |
| `warehouse.task-interleaving.events` | **Published** | Only `InterleavingHintIssued`, from the `StationTrip` aggregate, written by the transactional outbox relay. Key = the station id. Consumed by `fulfillment-execution` (its ADR 0051) as an advisory `claimNext` tie-break. |
| `warehouse.task-interleaving.analytics` | **Published** | `InterleavingHintIssued` again (same `type`, same CloudEvents `id`, dataschema `...:analytics:<EventName>:v1`), the hint outcomes `InterleavingHintConsumed` and `InterleavingHintExpired` (key = station id), and `InterleavingPolicyDeclared` (key = site id). Read only by this context's own `ti-projector` (ADR 0008). |
| `warehouse.fulfillment.events` | Consumed | Only `TaskAvailable`, `TaskClaimed` and `TaskCompleted` (key = task id). `FULFILLMENT_MODE` must be `kafka` (ADR 0006), group from the required `FULFILLMENT_CONSUMER_GROUP`. |
| `warehouse.facility.events` | Consumed | Only `ZoneRegistered`, `LocationSlotRegistered`, `LocationSlotDecommissioned` and `LocationGeometryUpdated`. `LAYOUT_MODE` must be `kafka` (ADR 0006), group from the required `LAYOUT_CONSUMER_GROUP`. |
| `<consumed topic>.dlq` | Published (dead letters) | One per consumed topic, written after a transient failure exhausts its retries, or at once for a payload of a handled type that can never be applied (see below). |

## The envelope

Every message is a CloudEvents 1.0 event in structured content mode, Kafka
header `content-type: application/cloudevents+json; charset=UTF-8`
(see the [Event Standard](/strategic-design/event-standard-cloudevents)).

| Attribute | Value |
| --- | --- |
| `source` | `/warehouse/task-interleaving` |
| `type` | `com.warehouse.wes.task-interleaving.<entity>.<EventName>`, with entity `stationtrip` or `policy` |
| `subject` | the station id; the site id for the policy event |
| `time` | the domain occurred-at (UTC) |
| `datacontenttype` | `application/json` |
| `dataschema` | `urn:warehouse:task-interleaving:<events\|analytics>:<EventName>:v1` |
| Kafka key | the subject, so one station's hint events stay ordered on one partition |

`id` is a UUID minted once at encode time and stored with the outbox row, so a
relay retry republishes the same `id`. A breaking payload change is a new
`.v2` type and dataschema, never a mutation. The `wes` segment is the tier of
this context, unlike the `wms` contexts it consumes from `facility-layout`.

Example (`InterleavingHintIssued`, the context's golden file
`internal/adapters/outbound/events/testdata/issued.events.golden.json`):

```json
{
  "specversion": "1.0",
  "id": "6f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e5f",
  "source": "/warehouse/task-interleaving",
  "type": "com.warehouse.wes.task-interleaving.stationtrip.InterleavingHintIssued",
  "subject": "STN-07",
  "time": "2026-10-17T12:00:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:task-interleaving:events:InterleavingHintIssued:v1",
  "data": {
    "hint_id": "hint-3b0e8d2a-7c41-4f6a-9d15-2a8b6c4e1f07",
    "station_id": "STN-07",
    "site_id": "SITE-1",
    "after_task_id": "task-8a1f",
    "origin_location": "WH1-FWD-A01-01-01-A",
    "expires_at": "2026-10-17T12:01:30Z",
    "policy_version": 2,
    "candidates": [
      {"rank": 1, "task_id": "task-9c2e", "task_type": "PICK", "location": "WH1-FWD-A01-02-01-A", "detour_m": 4.5},
      {"rank": 2, "task_id": "task-9d10", "task_type": "REPLENISH", "location": "WH1-FWD-A02-01-01-A", "detour_m": 12.0}
    ]
  }
}
```

The golden file shows a `PICK` candidate to illustrate the shape; in a live
cluster the pool holds the announced task types only (see below).

## Published types

| Type (after `com.warehouse.wes.task-interleaving.`) | Raised by | Payload |
| --- | --- | --- |
| `stationtrip.InterleavingHintIssued` (both topics) | `StationTrip.IssueHint`, after a `TaskCompleted` that leaves at least one candidate | `hint_id`, `station_id`, `site_id`, `after_task_id`, `origin_location`, `expires_at`, `policy_version`, `candidates[]` (`rank`, `task_id`, `task_type`, `location`, `detour_m`) |
| `stationtrip.InterleavingHintConsumed` (analytics only) | `StationTrip.RecordClaim`, when the hinted station claims one of the candidates before the hint expires | `hint_id`, `station_id`, `site_id`, `task_id`, `rank`, `detour_m`, `consumed_at` |
| `stationtrip.InterleavingHintExpired` (analytics only) | `StationTrip.Expire`, from the expiry worker | `hint_id`, `station_id`, `site_id`, `expires_at` |
| `policy.InterleavingPolicyDeclared` (analytics only) | `DeclarePolicy` through `PUT /sites/{siteId}/policy` | `site_id`, `max_detour_m`, `max_candidates`, `hint_ttl_seconds`, `eligible_task_types`, `vertical_weight`, `version`, `declared_at` |

A superseded hint has no event of its own: the next `InterleavingHintIssued` of
the station replaces it. `InterleavingHintIssued` is the only event meant to be
read by another context.

## Publishing: the transactional outbox

Events leave only through the outbox: the aggregate row and its already-encoded
event rows commit in one Postgres transaction, and the relay (default every
1 s via `OUTBOX_RELAY_INTERVAL`, 100 rows per pass) sends them. The relay's
Kafka writer waits for all in-sync replicas (acks=all) and hashes on the key. A
row that fails `OUTBOX_MAX_ATTEMPTS` times (default 20; `0` is unlimited) is
excluded from future claims until it is re-armed by hand. Delivery is
at-least-once with the same `id` on a retry, so consumers dedupe on it. `DATABASE_URL` and `KAFKA_BROKERS` are required at boot (ADR 0006), so the relay
always runs.

## Who consumes these events

`fulfillment-execution` consumes `InterleavingHintIssued` (its ADR 0051,
`TASK_INTERLEAVING_MODE=kafka` with its own consumer group, both set in
`warehouse-infra` `develop`). It stores the hint locally and uses it only as a
tie-break inside one priority band, never across a CPT or priority boundary,
and ignores it once `expires_at` has passed. `InterleavingHintConsumed`,
`InterleavingHintExpired`, `InterleavingPolicyDeclared` and the analytics copy
of the hint are read only by this context's own projector. This is the
fleet's edge K47 (live); see the
[context map](/contexts/task-interleaving/context-map).

## Consuming: local copies

Both consumers dispatch on the full `type` and ignore every other type on their
topic. The CloudEvents `id` claim (`processed_events`) and the effect run in one
transaction, and the offset is committed only afterwards, so a redelivery is a
no-op (`duplicate`). Both consumers always run: a mode other than `kafka` or a
missing group variable is a boot error (ADR 0006).

| Type | Effect | Producer today |
| --- | --- | --- |
| `TaskAvailable` | upsert the task into `task_pool` as available (`task_id`, `task_type`, `site_id`, `from_location`, `to_location`, `required_capabilities`, `priority_band`); a task already completed never re-enters | published by `fulfillment-execution` since its ADR 0049, for `RELOCATE` and `REPLENISH` tasks only (the only ones with bins, its ADR 0050); a `PICK`, `PACK`, `SLAM` or `REBIN` task is not announced |
| `TaskClaimed` | mark the task claimed by the station (it leaves the candidates); if the station holds an Active, unexpired hint that lists the task, the hint becomes `Consumed` | published on the integration topic for every task type, with `claimed_at` |
| `TaskCompleted` | mark the task completed; move the station to the task's `to_location` and, if the site has a policy and a candidate exists, issue a hint | published by `fulfillment-execution` (live for other consumers); the position needs the task's `to_location` from the pool copy, so a completion of an unannounced task type is `ignored` |
| `ZoneRegistered`, `LocationSlotRegistered`, `LocationSlotDecommissioned` | upsert `zones` and `locations` (the site of a location is its zone's site); a decommissioned location stays decommissioned | published by `facility-layout` (live) |
| `LocationGeometryUpdated` | store the point (`xM`, `yM`, `zM`) of the location, even before its registration | published by `facility-layout`; its own spec notes that no consumer was wired until this service |

| Situation | Behaviour |
| --- | --- |
| Not a valid CloudEvents 1.0 message (including the retired flat envelope) | logged at WARN and committed past: never retried, never dead-lettered |
| Unknown `type` on the topic | ignored silently |
| Transient failure (for example Postgres) | the same message is retried with backoff (200 ms doubling to a 5 s cap), 5 attempts in total, then published to `<topic>.dlq` with `x-dlq-*` headers |
| Payload of a handled type that can never be applied (undecodable `data`, a missing `task_id`, `site_id` or `from_location` on `TaskAvailable`, a missing coordinate or a non-finite one on `LocationGeometryUpdated`) | deterministic poison: dead-lettered at once, no retries |
| Context cancelled during shutdown | never dead-lettered; the offset stays uncommitted and the message is redelivered after restart |
| Producer down or silent | nothing breaks; the pool copy goes stale and hints are stale or absent, never wrong assignments |

A location with no geometry has an unknown distance: it is never a candidate
and, as an origin, yields no hint. A decoded outcome is logged as `event
processed` with `applied`, `duplicate`, `stale` or `ignored`.

See the consumed contracts on
[Integration](https://iqvo.github.io/task-interleaving/docs/ecosystem/integration)
and the [context map](/contexts/task-interleaving/context-map). The
dead-letter procedure is in the
[Runbook](/contexts/task-interleaving/runbook).

## Machine-generated reference

The generated AsyncAPI documentation is on the
[API Reference](/api-reference/async/task-interleaving) page.
