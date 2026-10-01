---
id: async-api
title: Async API
sidebar_label: Async API
description: Two live Kafka integrations for labor-performance — an inbound Customer/Supplier consumption of warehouse.fulfillment.events, and, since ADR 0013, an outbound Open-Host-Service publish onto warehouse.labor-performance.events for workforce-management to consume.
---

# Async API

Labor Performance has **two** live Kafka integrations today: one inbound,
one outbound. Until ADR 0013 it had only the inbound one and was the
fleet's only pure event sink — this page now documents both directions.

## Inbound: consuming `warehouse.fulfillment.events`

**Topic:** `warehouse.fulfillment.events` — the SAME shared topic
`wes-work-planning` already consumes from. It is a fan-out topic with
multiple independent consumer groups; this context does not compete with
`wes-work-planning`'s consumption of it, each reads the full stream
independently under its own group.

**Consumer group id:** `labor-performance` (default, configurable via
`KAFKA_CONSUMER_GROUP`).

**Filter:** only `type == "com.warehouse.wes.fulfillment-execution.task.TaskCompleted"` is acted on. Every other
event type on this shared topic — `fulfillment-execution` now also
publishes `TaskCPTMissed` and `PackageManifested` there — is silently
skipped, **not an error**, mirroring
`wes-work-planning`'s own consumer's skip-unrecognized-event-type
behavior.

**Strategic relationship:** Customer/Supplier, with this context as a
**Conformist** downstream. `fulfillment-execution` is the Open Host
Service; this context subscribes to its Published Language (the
`TaskCompleted` event shape) and never gets write access to a `Task` or
`Station` aggregate. This context **MUST NOT** import any Go package from
`fulfillment-execution` — it is a separate Go module in a separate
repository, and the inbound Kafka adapter's `taskCompletedData` struct is
this context's own private mirror of the wire shape.

### The envelope

CloudEvents 1.0, structured content mode — the fleet-wide, mandatory
[Event Standard](/strategic-design/event-standard-cloudevents) every warehouse-systems publisher uses (Kafka header
`content-type: application/cloudevents+json; charset=UTF-8`). The consumer
dispatches on the full `type`, ignores unknown types, and skips (never
parses) anything that is not a valid CloudEvent:

```json
{
  "specversion": "1.0",
  "id": "uuid-v4",
  "source": "/warehouse/fulfillment-execution",
  "type": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
  "subject": "...",
  "time": "2026-08-29T22:00:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:fulfillment-execution:events:TaskCompleted:v1",
  "data": {
    "task_id": "...",
    "station_id": "...",
    "work_unit_id": "...",
    "associate_id": "...",
    "duration_seconds": 52,
    "task_type": "PICK"
  }
}
```

`associate_id`, `duration_seconds` and `task_type` are enrichments added
over time in `fulfillment-execution` — all three are optional on the
wire, and an older payload that predates an enrichment omits the field.
This service's JSON unmarshaling degrades those absent fields to their Go
zero values (`""` / `0`) rather than erroring — exactly the "no
checked-in occupant" / "unmeasurable duration" / "unclassified" business
facts this service's own aggregate invariants already model.

### `task_type` on the wire (gap closed)

`task_type` was once a known wire-contract gap: every consumed event was
bucketed as `""` (unclassified). `fulfillment-execution`'s ADR-0023 added
it to the `TaskCompleted` payload, and this service's consumer now passes
it through `shared.ParseTaskTypeLenient`. A recognized `PICK`/`PACK`/`SLAM`
passes through; an unrecognized value (e.g. `REBIN`, which this context
does not model as an engineered-labor-standard task type) or an absent
field still resolves to `""` — recorded and counted, but never scored
against a `LaborStandard` and never listed under `GetTaskTypePerformance`
(the analytics side reports it as `UNCLASSIFIED`).

The same event also drives idleness (ADR 0014): the gap between an
associate's previous completion and this task's claim instant
(`time − duration_seconds`) is recorded as an `IdlePeriod`, with no
additional upstream field required.

### Idempotency

Keyed on the CloudEvents `id`, **not** `TaskId` — a `TaskId`
could in principle be reused after a very long time. Unlike some sibling
services' use of the same `ProcessedEvents` idempotency-gate pattern
(which gates only an additive analytics side-projection), here it gates
the **entire OLTP write path**, since consuming `TaskCompleted` IS this
service's whole job, not a side effect of it.

## What this context does NOT consume or call

- **No outbound REST or MCP call to any sibling context** —
  `fulfillment-execution`, `workforce-management`, `facility-layout` or
  anyone else (ADR 0003; restated for facility-layout by
  [ADR 0015](https://github.com/claudioed/labor-performance/blob/develop/docs/docs/adr/0015-optional-travel-component-on-labor-standard.md),
  which made a standard's travel component caller-supplied rather than
  looked up). Everything this context needs (`AssociateId`, `TaskType`,
  `DurationSeconds`) already travels on the Kafka event above.
- **`workforce-management` is now a Kafka relationship, not "no
  relationship at all."** That framing predates ADR 0013. This context
  still has zero REST dependency on `workforce-management` and never will
  — labor allocation ("who is on shift, at what rate") and labor
  performance scoring still share no concepts — but the two contexts are
  no longer disconnected: `workforce-management` consumes
  `warehouse.labor-performance.events` (below) for its own read model.
  The relationship is exclusively asynchronous and one-way; this context
  has no idea `workforce-management` exists at the code level, since it
  never imports its package and has no inbound adapter that context
  reaches.
- **This context never calls anything synchronously.** This is
  choreography, not orchestration — a below-standard associate is never
  blocked, and a down `labor-performance` instance never slows down
  `fulfillment-execution`'s task-completion hot path; messages simply
  queue in Kafka and are processed on recovery, at-least-once.

## Outbound: publishing `warehouse.labor-performance.events`

**Topic:** `warehouse.labor-performance.events` — a NEW, dedicated
integration topic, separate from the pre-existing
`warehouse.labor-performance.analytics` topic below, added in ADR 0013.
This is this context's **first** Open-Host-Service Published Language for
another bounded context to consume; before it existed, this service
consumed `TaskCompleted` but published nothing any sibling service could
subscribe to.

**What is published:** only `TaskPerformanceRecorded`, raised by every
successful `RecordTaskPerformance` call (including unscorable/unmeasurable
rows — see [Domain Events](./domain-events)). `LaborStandardDefined` and
`LaborStandardRevised` remain analytics-only; widening the integration
contract to include them is a purely additive future change, not done
speculatively here.

**Envelope:** CloudEvents 1.0 — the SAME envelope this service consumes
on `warehouse.fulfillment.events` and publishes on the analytics topic
below. `type` is
`com.warehouse.wes.labor-performance.performance.TaskPerformanceRecorded`
on both topics; `dataschema` tells them apart
(`urn:warehouse:labor-performance:events:TaskPerformanceRecorded:v1` here,
`…:analytics:…` on the analytics topic). The old analytics
`schema_version` field is gone.

**Partition key:** `AssociateId` — not `TaskType`, which the analytics
publisher keys on. The intended consumer (workforce-management's
per-associate cache) needs every event for one associate applied in
publish order on a single partition. A task with no checked-in associate
(a robot station) keys on the empty string.

**Delivery mechanism:** the same transactional-outbox pattern this
service already uses for the analytics topic (ADR 0010) — no new
persistence or delivery code. `postgres.OutboxPublisher` and
`postgres.OutboxRelay` were already topic-agnostic (one outbox row per
`(event, encoder)` pair), so adding this topic required zero changes to
either file; only `cmd/labor/main.go`'s `buildEventPublisher` wiring
changed, to construct a second encoder alongside the existing analytics
one. Publishing is opt-in via `EVENT_PUBLISHER=kafka`, same as the
analytics topic; the log-only default is unchanged.

**Live consumer:** `workforce-management`, replacing what was previously
a synchronous `GET /task-types/{taskType}/performance` call from
`ProposePathPlan` with a local, event-fed running-mean cache
(`LABOR_PERFORMANCE_MODE=kafka-cache`, that repo's ADR 0019), which also
reads the additive `idle_seconds_before` field as a staffing signal (its
ADR 0020). That mode is opt-in: `workforce-management`'s binary defaults
`LABOR_PERFORMANCE_MODE` to `permissive`, keeps an older `http` option
that calls this service's REST API, and the kind cluster sets
`kafka-cache`. Either way the dependency points from
`workforce-management` to this context.

See [ADR 0013](https://github.com/claudioed/labor-performance/blob/develop/docs/docs/adr/0013-labor-performance-integration-events.md)
in the source repository for the full decision record.

## Generated reference

The machine-generated AsyncAPI document (from the real, Spectral-linted
`apis/asyncapi.yaml` in the source repository) is embedded at
[API Reference → Async → labor-performance](/api-reference/async/labor-performance).
That page documents the consumer contract formally; this page is the
narrative version — why the relationship is shaped this way, and the
honest gaps in the current wire contract.

## A separate reports API exists too

Beyond the OLTP `apis/openapi.yaml` (7 operations: `POST /standards`,
`GET /standards/{taskType}`, `GET /associates/{associateId}/scorecard`,
`GET /task-types/{taskType}/performance`,
`GET /task-types/{taskType}/utilization`,
`GET /associates/{associateId}/utilization`, `GET /healthz`), the source
repository also ships a **separate `openapi-reports.yaml`** covering the
read-only analytical Reports API served by `cmd/labor-reports` (3
operations: `GET /reports/performance`,
`GET /reports/performance/freshness`, `GET /healthz`). Neither API — nor
the MCP server — is authenticated, by deliberate decision
([ADR 0012](https://github.com/claudioed/labor-performance/blob/develop/docs/docs/adr/0012-remove-rest-auth-layer.md)
removed ADR 0011's static bearer-key layer). That API is fed by the
`warehouse.labor-performance.analytics` Kafka topic described in
[Domain Events](./domain-events) — a separate publish direction from the
`TaskCompleted` consumption this page documents, and one this context
produces for itself rather than consumes from anyone. See
[ADR 0007](https://github.com/claudioed/labor-performance/blob/develop/docs/docs/adr/0007-analytical-data-product.md)
in the source repository for the full three-process analytics design.
