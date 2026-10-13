---
id: slos
title: Fleet SLOs
sidebar_label: Fleet SLOs
description: The service level objectives every bounded context is held to, the indicator behind each one, how to measure it on the kind cluster, and which alert protects it.
---

# Fleet SLOs

One set of objectives for every bounded context. Each SLO names its
indicator (SLI), a target, the PromQL or probe that measures it, and the
alert in the [alert catalogue](./alert-catalogue.md) that fires before the
target is lost. Where no signal exists yet, the SLO says so instead of
inventing one.

:::note[Scope and limits]
- These are the objectives for the local kind fleet. Prometheus keeps
  **24 h** of data (`retention = "24h"` in warehouse-infra
  `terraform/observability.tf`), so every window below is **1 day**, not
  the usual 28 days.
- Alertmanager is off: nothing pages. There is no error-budget policy (no
  release freeze when a budget is spent). Treat a missed SLO as an
  incident to investigate with the [incident runbook](./incident-runbook.md).
- Availability and latency are measured **at Kong**, the only place that
  records HTTP status codes (`otelchi` v0.12.3 records none). A pod-to-pod
  call that bypasses Kong is not in these numbers.
:::

## Summary

| # | SLO | SLI | Target (1 day) | Protected by | Contexts |
| --- | --- | --- | --- | --- | --- |
| 1 | API availability | share of Kong requests to the context's routes that do not answer 5xx | ≥ 99% | `WarehouseKong5xxRatioHigh` (5% over 5 min) | all 15 |
| 2 | API latency | share of Kong requests whose upstream latency is ≤ 500 ms | ≥ 95% | none yet | all 15 |
| 3 | Event delivery | share of minutes in which the oldest unpublished outbox row is younger than 60 s | ≥ 99% | `WarehouseOutboxLagHigh` (> 60 s for 5 min) | the 5 contexts with an outbox-lag gauge |
| 4 | No parked events | outbox rows that reached `OUTBOX_MAX_ATTEMPTS` and were not re-armed | 0 at the end of the day | none (log line and SQL only) | every context with an outbox |
| 5 | Pod stability | containers restarting 2 or more times in 15 minutes | 0 | `WarehousePodRestarting` | all 15 |
| 6 | Report freshness | `lagSeconds` of a reports binary's `/reports/<name>/freshness` | p95 ≤ 30 s | none (probe by hand) | contexts with a reports binary |

## 1. API availability

**SLI**: for each Kong route of a context (API `<context>.N`, MCP
`<context>-mcp.N`, reports `<context>-reports.N`), non-5xx responses
divided by all responses.

```text
1 - (
  sum by (service) (increase(kong_http_requests_total{service=~"httproute[.]warehouse-systems[.]order-management(-mcp|-reports)?[.][0-9]+", code=~"5.."}[1d]))
  /
  sum by (service) (increase(kong_http_requests_total{service=~"httproute[.]warehouse-systems[.]order-management(-mcp|-reports)?[.][0-9]+"}[1d]))
)
```

Replace `order-management` with the context. The same selector backs the
`WarehouseKong5xxRatioHigh` rule.

**Target**: 99% per route per day. The alert fires at a 5% error share
sustained for 5 minutes: at that rate a day's 1% budget is gone in about
5 hours, so the alert gives time to react before the SLO is lost.

**Note**: `503 downstream-unavailable` from a context whose dependency is
down (order-management with inventory-storage's breaker open) counts
against the calling context. That is deliberate: the client saw the
failure there.

## 2. API latency

**SLI**: share of Kong requests to the context whose upstream latency
(Kong to the pod and back) is at most 500 ms.

```text
sum by (service) (increase(kong_upstream_latency_ms_bucket{service=~"httproute[.]warehouse-systems[.]fulfillment-execution[.][0-9]+", le="500"}[1d]))
/
sum by (service) (increase(kong_upstream_latency_ms_count{service=~"httproute[.]warehouse-systems[.]fulfillment-execution[.][0-9]+"}[1d]))
```

`kong_upstream_latency_ms_bucket` is the histogram the
`kong-gateway-overview` dashboard already plots. Use a bucket boundary that
exists in your Kong plugin configuration; if `500` is not a boundary, take
the nearest one and say which.

**Target**: 95% of requests within 500 ms. fulfillment-execution's
`claim-next` and `complete` sit on a station's critical path, which is why
its observability page suggests the same 500 ms p95 threshold.

**Gap**: no alert rule provisions this SLO yet.

## 3. Event delivery

Every context publishes through a transactional outbox: the business write
and the event row commit together, and a relay sends the row to Kafka. An
event that sits in the outbox is late for every downstream context.

**SLI**: the context's outbox-lag gauge (age of the oldest unpublished
`outbox_events` row), sampled every minute; good minutes are the ones
under 60 s.

```text
avg_over_time((max(order_outbox_lag_seconds) < bool 60)[1d:1m])
```

| Context | Gauge |
| --- | --- |
| order-management | `order_outbox_lag_seconds` |
| wes-work-planning | `wes_outbox_lag_seconds` |
| workforce-management | `workforce_outbox_lag_seconds` |
| labor-performance | `labor_performance_outbox_lag_seconds` |
| process-path-management | `process_path_management_outbox_lag_seconds` |

**Target**: 99% of minutes under 60 s.

**Gap**: the other ten contexts export no outbox-lag gauge, so their event
delivery is measured only by SQL
(`SELECT min(created_at) FROM outbox_events WHERE published_at IS NULL`)
and by the relay's `outbox relay pass failed` log line. Consumer lag is not
measurable at all: no Kafka exporter runs in the cluster.

## 4. No parked events

Since the gap-fix wave every relay passes `WithMaxAttempts`: a row that
fails `OUTBOX_MAX_ATTEMPTS` sends (default 20, `0` = unlimited) is no
longer claimed, so one poison row cannot stop the relay. The price is that
the parked event is not delivered until an operator re-arms it, and later
rows with the same key overtake it.

**SLI**: count of rows with `published_at IS NULL AND attempts >=
OUTBOX_MAX_ATTEMPTS` per context database, plus the ERROR log line
`outbox relay: row reached the attempt cap and is no longer claimed`.

**Target**: 0 parked rows at the end of each day. Re-arm with
`UPDATE outbox_events SET attempts = 0 WHERE id = ...` after fixing the
cause (each context runbook has the procedure).

**Gap**: no metric counts parked rows, so no rule can alert on it. A Loki
query on the log line is the closest signal:
`{app=~".+"} |= "row reached the attempt cap"`.

## 5. Pod stability

**SLI**: `increase(kube_pod_container_status_restarts_total{namespace="warehouse-systems"}[15m])`
per container, from kube-state-metrics (enabled for the D30 rules, limited
to the pods and deployments collectors).

**Target**: no container restarts twice within 15 minutes. Since the
gap-fix wave the process-path-management and workforce-management
analytics projectors exit non-zero when their consumer loop stops (D13),
so a dead projector now shows up here instead of staying green.

## 6. Report freshness

Every `*-reports` binary serves `GET /reports/<name>/freshness` with
`lagSeconds`: the age of the newest event its projector has applied.

**Target**: p95 of `lagSeconds` at or under 30 s, the freshness SLA that
order-management, wes-work-planning and fulfillment-execution already state
on their observability pages.

**Gap**: Prometheus does not scrape these endpoints. Probe them through Kong
(`/api/<context>/reports/<name>/freshness`); the
[API reference](/api-reference) lists each context's reports routes.

## Business objectives outside this page

Some contexts carry a business deadline that is not a service objective:
network-fulfillment's 24 h acknowledgement clock (an external SLA; see its
[observability page](/contexts/network-fulfillment/observability)) and the
CPT on every work unit and task (a physical truck departure, not a
target). Missing them is a business incident; the SLOs above only tell you
whether the platform was able to move the work.
