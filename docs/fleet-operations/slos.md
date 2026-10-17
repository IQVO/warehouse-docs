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
- Alertmanager is on in the kind cluster, but its only receiver is `null`:
  **nothing is delivered anywhere**, because a local cluster has no pager.
  An alert shows in Alertmanager (`/api/v2/alerts`), on Prometheus'
  `/alerts` page and in Grafana. The error-budget policy below is a
  **proposal**, not in force. Treat a missed SLO as an incident to
  investigate with the [incident runbook](./incident-runbook.md).
- Availability and latency are measured **at Kong**, the only place that
  records HTTP status codes (`otelchi` v0.12.3 records none). A pod-to-pod
  call that bypasses Kong is not in these numbers.
:::

## Summary

| # | SLO | SLI | Target (1 day) | Protected by | Contexts |
| --- | --- | --- | --- | --- | --- |
| 1 | API availability | share of Kong requests to the context's routes that do not answer 5xx | ≥ 99% | `WarehouseApiAvailabilityBurnFast` and `WarehouseApiAvailabilityBurnSlow`; `WarehouseKong5xxRatioHigh` (5% over 5 min) stays as the coarse signal | all 15 |
| 2 | API latency | share of Kong requests whose upstream latency is ≤ 400 ms (Kong exports no 500 ms bucket) | ≥ 95% | `WarehouseApiLatencyBurnFast` and `WarehouseApiLatencyBurnSlow` | all 15 |
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

**Target**: 99% per route per day. The coarse alert fires at a 5% error
share sustained for 5 minutes: at that rate a day's 1% budget is gone in
about 5 hours. Two burn-rate alerts per context protect the SLO more
precisely (see [Burn-rate alerts](#burn-rate-alerts)).

**Note**: `503 downstream-unavailable` from a context whose dependency is
down (order-management with inventory-storage's breaker open) counts
against the calling context. That is deliberate: the client saw the
failure there.

## 2. API latency

**SLI**: share of Kong requests to the context whose upstream latency
(Kong to the pod and back) is at most 400 ms. The objective is stated as
500 ms, but the Kong histogram has no 500 ms boundary (the live buckets are
25, 50, 80, 100, 250, 400, 700, 1000 ms and up), so the SLI counts the
nearest boundary below it. A request between 400 and 500 ms counts as slow,
which makes the measurement slightly stricter than the stated objective.

```text
sum by (service) (increase(kong_upstream_latency_ms_bucket{service=~"httproute[.]warehouse-systems[.]fulfillment-execution[.][0-9]+", le="400.0"}[1d]))
/
sum by (service) (increase(kong_upstream_latency_ms_count{service=~"httproute[.]warehouse-systems[.]fulfillment-execution[.][0-9]+"}[1d]))
```

`kong_upstream_latency_ms_bucket` is the histogram the
`kong-gateway-overview` dashboard already plots. If a cluster's Kong
exports different boundaries, take the nearest one below 500 ms and say
which.

**Target**: 95% of requests within 500 ms. fulfillment-execution's
`claim-next` and `complete` sit on a station's critical path, which is why
its observability page suggests the same 500 ms p95 threshold.

Two burn-rate alerts per context protect this SLO (see [Burn-rate alerts](#burn-rate-alerts)).

## Burn-rate alerts

SLOs 1 and 2 are protected by four alerts per context, generated by
warehouse-infra's `scripts/gen-context-dashboards.py` into the rule groups
`warehouse-<context>-slo` and promtool-tested (`make alert-rules-check`). The
burn rate is the observed bad share divided by the share the SLO allows
(1% for availability, 5% for latency), so a burn of 1 spends the day's error
budget in exactly one day. Both windows of a pair must hold, and the route
needs at least 30 requests in the long window, so one failed request on an
idle local route cannot fire a `critical` alert.

| Alert | SLO | Severity | Fires when | `for` | The day's budget is gone in |
| --- | --- | --- | --- | --- | --- |
| `WarehouseApiAvailabilityBurnFast` | 1 | critical | burn ≥ 14.4 over 1 h and 5 m (5xx share ≥ 14.4%) | 2 m | about 100 minutes |
| `WarehouseApiAvailabilityBurnSlow` | 1 | warning | burn ≥ 3 over 6 h and 30 m (5xx share ≥ 3%) | 15 m | about 8 hours |
| `WarehouseApiLatencyBurnFast` | 2 | critical | burn ≥ 14.4 over 1 h and 5 m (more than 72% slower than 400 ms) | 2 m | about 100 minutes |
| `WarehouseApiLatencyBurnSlow` | 2 | warning | burn ≥ 3 over 6 h and 30 m (more than 15% slower than 400 ms) | 15 m | about 8 hours |

In Alertmanager a `critical` alert inhibits the `warning` alerts of the same
context and service, so one incident shows once. Prometheus keeps 24 hours,
so the SLO window itself is one day, not the usual 28.

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

## Error-budget policy (proposed, not in force)

:::caution[Proposal]
Nothing in this section is in force until the owner accepts it. It is
published so the thresholds can be reviewed in one place.
:::

1. **Fast burn (`critical`).** Stop merging feature pull requests into that
   context. Fix or roll back, following the context's runbook. Merging
   resumes when the alert has resolved and a fix or rollback is in.
2. **Slow burn (`warning`).** Investigate the same day. No freeze. If it
   keeps burning into the next day, treat it as a fast burn.
3. **A missed daily SLO** (the day's good share ended below the target).
   Write the cause into the context's runbook incident log, and merge no
   feature pull requests into that context until one full day passes
   without a breach.
4. **Exempt from the freeze:** changes that fix or roll back the burn, and
   security fixes.

Open decisions: who looks at Alertmanager while no real receiver exists and
when one is added (`alertmanager.config.receivers` in warehouse-infra
`terraform/observability.tf`), and whether a 24-hour window is enough or
telemetry must be persisted so a 7 or 28 day window becomes possible.
