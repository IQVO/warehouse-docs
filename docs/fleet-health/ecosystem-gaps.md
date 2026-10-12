---
id: ecosystem-gaps
title: Ecosystem gaps, October 2026
sidebar_label: Ecosystem gaps (2026-10)
description: What the October 2026 documentation-coverage campaign found missing or broken across the fleet, ranked by impact, with the evidence for each gap and the context that owns the fix.
---

# Ecosystem gaps, October 2026

Between 2026-10-09 and 2026-10-12 every application repository got a full
operational documentation set (configuration, runbook, observability,
troubleshooting, testing, integration, use cases; see
[Documentation coverage](./docs-coverage.md)). Writing those pages meant
reading every binary, chart, consumer and route against the code on
`develop`. This page lists what that reading found: capabilities that do not
work end to end, operational risks, contract defects and documentation that
is still missing.

How to read it:

- Every gap names the **owning context** and the **evidence** (file and line
  on `develop` at the time of writing). Docs describe the code as it is: none
  of these were "fixed" in the docs PRs, they were documented as current
  behaviour.
- **Verified** means the evidence was re-checked independently of the agent
  that reported it. Everything else was read from code by one reviewer and
  should be confirmed before work starts.
- Severity: **S1** a business capability does not work end to end;
  **S2** an operational failure mode with no guard; **S3** a contract or API
  defect a client can hit; **S4** observability blind spot; **S5** drift
  between code, comments, charts and docs; **S6** delivery and docs gaps.

## Summary

| # | Gap | Owner | Severity |
|---|-----|-------|----------|
| 1 | Inter-warehouse transfers cannot run: nothing publishes `SiteCapabilityChanged` | facility-layout → network-inventory-planning | S1 · verified |
| 2 | Scheduled rebalancing always proposes nothing | network-inventory-planning | S1 · verified |
| 3 | Transfer saga goes silent after approval | network-inventory-planning | S1 |
| 4 | A malformed allocation reply blocks `warehouse.inventory.events` forever | network-inventory-planning | S2 · verified |
| 5 | Console order entry fails against a real order-management | order-management (web) | S1 · verified |
| 6 | Console network-fulfillment report screen calls a route that does not exist | warehouse-console | S1 · verified |
| 7 | slotting-optimization is built but cannot be deployed, and nobody consumes its plans | slotting-optimization, warehouse-infra | S1 · verified |
| 8 | Outbox relay has no attempt cap in inventory-storage | inventory-storage | S2 · verified |
| 9 | Analytics projectors can die silently while probes stay green | process-path-management, workforce-management | S2 |
| 10 | Chart ConfigMaps that no Deployment mounts | facility-layout, inbound-receiving | S2 · verified (facility-layout) |
| 11 | Optional MCP tool inputs are published as required | 5 contexts | S3 |
| 12 | MCP safety annotations that are wrong | wes-work-planning, fulfillment-execution | S3 · verified (wes-work-planning) |
| 13 | Report routes outside the OpenAPI contracts | 8 contexts + warehouse-ops-agent | S3 |
| 14 | Every 5xx dashboard panel is empty | warehouse-infra (fleet) | S4 |
| 15 | Binaries with no telemetry, or charts feeding env they never read | 5 contexts | S4 |
| 16 | Boot-retry, sweeper and log-level drift between code and comments | fleet template | S5 |
| 17 | Docs and delivery gaps that remain after the campaign | fleet | S6 |

## S1: capabilities that do not work end to end

### 1. Inter-warehouse transfers cannot run

- **facility-layout** declares `com.warehouse.wms.facility-layout.site.SiteCapabilityChanged`
  (DTO, partition key, AsyncAPI entry, fitness test) but on `develop`
  `shared.NewSiteCapabilityChanged` is called only from `*_test.go`
  (`internal/domain/shared/events.go:60-78`). No use case, REST route or MCP
  tool raises it.
- **network-inventory-planning** fills its `site_capability` read model from
  exactly that event (`internal/adapters/inbound/kafka/consumers.go:36-110`),
  and transfer simulation and approval fail closed when capability facts are
  missing. This matches the `503` with empty facts seen on the kind cluster on
  2026-10-08.
- **Fix (facility-layout):** a command that sets a site's transfer
  capability (`transferOriginEnabled`, `transferDestinationEnabled`) and
  raises the event through the outbox, with a new ADR. While there, align the
  payload casing: `SiteCapabilityChanged` uses `snake_case`, every other
  facility-layout event uses `camelCase` (`internal/adapters/kafka/cloudevents/wire.go:37`).
  The consumer must be updated in the same change.

### 2. Scheduled rebalancing always proposes nothing

`internal/application/usecases/scheduled_rebalance.go:88-94` calls
`Planner.Generate(positions, nil, nil)`: no policies and no lanes are
projected in v1, and the planner proposes only when policies exist. Every
scheduled run is recorded as a completed run with zero proposals. Owner:
network-inventory-planning (project policies and lanes, or stop scheduling
the run until they exist).

### 3. Transfer saga goes silent after approval

`cmd/network-inventory-planning/main.go:353-359` wires the
receipt-staged, stow, dispatched and arrival appliers without a publisher, so
`IN_TRANSIT`, `ARRIVED`, `RECEIVED` and `UNFULFILLABLE` emit no
`TransferStateAdvanced`. ADR 0007 ("every saga transition") and
`apis/asyncapi.yaml:67` say they should. `InterWarehouseTransfer.Cancel`
exists but no use case, route or consumer calls it. Owner:
network-inventory-planning.

### 5. Console order entry fails against a real order-management

The order-management remote (`web/src/api.ts:36-48`) posts `POST /orders`
without an `Idempotency-Key`. When the service runs with a database the
idempotency middleware answers `400 idempotency-key-required`
(`internal/adapters/inbound/http/idempotency.go:78-79`). Kong already allows
the header through CORS. Owner: order-management (`web/`).

### 6. Console network-fulfillment report screen calls a missing route

`src/features/context-reports/networkFulfillment.config.tsx:144` requests
`/reports/network-orders`; network-fulfillment serves
`/reports/acknowledgement` and `/reports/acknowledgement/freshness`
(`internal/adapters/inbound/http/reports_handler.go:170-171`). The screen
gets a `404`. Owner: warehouse-console.

### 7. slotting-optimization cannot be deployed, and nobody consumes it

The repository has no `Dockerfile` and no `charts/` directory, yet
`ci.yml` has `docker-publish` and `release` jobs that would build and package
them (push-to-main only, so they have never run). warehouse-infra has no
Kong route, Terraform service entry or dashboard for it, and no context
consumes `warehouse.slotting-optimization.events` (not wes-work-planning, not
the console, not the ops agent). Its GitHub Pages site is not enabled either.
Owners: slotting-optimization (packaging), warehouse-infra (deploy), and a
decision on who consumes approved slot plans.

## S2: operational failure modes with no guard

### 4. A malformed allocation reply blocks a partition forever (network-inventory-planning)

`MarkAllocated` / `MarkUnfulfillable` return plain errors for a line-id
mismatch or an unknown rejection reason (`internal/domain/transfer/saga.go:331-334`).
`usecases.IsDeterministic` classifies only not-found and illegal-transition
errors (`approve_transfer.go:241-243`), so
`transfer_reply_consumer.go:266-271` returns the error and the message is
retried forever, blocking every later message on that
`warehouse.inventory.events` partition. Fix: classify domain validation
errors as deterministic (skip and dead-letter). The same context's
`site_sku_demand` upsert has no ordering guard, so an older redelivery
overwrites a newer value (`planning_repositories.go:86`).

### 8. Outbox relay with no attempt cap (inventory-storage)

`cmd/inventory/adapters.go:199` builds the relay without `WithMaxAttempts`:
a row that can never be sent blocks the relay forever, with no DLQ. Other
contexts' relays should be checked for the same option.

### 9. Projectors that die silently

When the analytics consumer loop exits (commit or DLQ write failure), the
projector logs the error and keeps serving `/healthz` and `/readyz` as `200`
(process-path-management `cmd/pathmgmt-projector/main.go:130-136`,
workforce-management `cmd/workforce-projector/main.go:149-154`). Nothing
consumes until someone restarts the pod. Fix: flip readiness or exit the
process.

### 10. ConfigMaps that nothing mounts

facility-layout's chart renders `OUTBOX_RELAY_INTERVAL`,
`HOUSEKEEPING_INTERVAL`, `IDEMPOTENCY_KEY_TTL` and `OUTBOX_RETENTION` into a
ConfigMap that no Deployment mounts (no `envFrom` in
`charts/facility-layout/templates`), so the `config.*` values have no effect.
inbound-receiving's chart has the same pattern. Both look like a template
inheritance: check every chart.

### Other operational risks

| Context | Gap | Evidence |
|---|---|---|
| inbound-receiving | No sweeper for `outbox_events`, `processed_events`, `idempotency_keys`, `analytics_processed_events`: unbounded growth | runbook, code reading |
| workforce-management | Chart does not set `INSTALLED_CAPACITY_MODE` / `FULFILLMENT_EXECUTION_BASE_URL`; with the permissive code default every shift-plan commit answers `503` unless `extraEnv` sets them | `charts/workforce-management/templates/deployment.yaml` |
| fulfillment-execution | Kafka catalogue mode waits up to 60 s before the HTTP listener starts; the startupProbe also allows 60 s, so a slow replay ends in a probe kill instead of a clear boot error | `cmd/execution/main.go:316`, `values.yaml:277-282` |
| process-path-management | warehouse-infra points the readiness probe at `/healthz`, so the `/readyz` shutdown flip (ADR 0012) is not used in kind | `helm-values/process-path-management.yaml:41-43` |
| warehouse-ops-agent | warehouse-infra sets neither `prometheus.url` nor `runtimeSignals.lokiUrl`: `/runtime-signals` reports zeros in kind; 8 of 12 MCP clients are built even with an empty endpoint and fail at call time | `terraform/ops-agent.tf`, `cmd/agent/main.go:200-247` |
| process-path-management, labor-performance | Housekeeping cannot be disabled: `durationEnv` replaces `0` with the default, although comments, charts and ADR 0018 say `0s` disables it | `cmd/pathmgmt/main.go:468-477`, `cmd/labor/main.go:541` |

## S3: contract and API defects

### 11. Optional MCP inputs published as required

Report tools describe filters (`pathId`, `granularity`, `sku`, `binId`,
`taskType`, `stationId`) as optional, but the input structs have no
`omitempty`, so the go-sdk schema in `tools/list` marks them required and a
call without them fails with `missing properties`. Seen in
process-path-management, inventory-storage, wes-work-planning,
fulfillment-execution and workforce-management (`internal/adapters/inbound/mcp/report_tool.go`
in each). A fleet sensor (a fitness test that every optional field has
`omitempty`) would stop it recurring.

### 12. MCP annotations that are wrong

- wes-work-planning: `get_backlog_telemetry` and
  `get_rebalance_recommendation` are annotated `ReadOnlyHint: true`
  (`internal/adapters/inbound/mcp/tools.go:110-118`) but their use cases
  publish `BacklogThresholdBreached`, `PathThrottled` and
  `LaborReassignmentFlagged`.
- fulfillment-execution: the server instructions say "Read-only access"
  (`internal/adapters/inbound/mcp/server.go:15`) while `complete_task` is a
  destructive write tool on the same server.

An agent that trusts these annotations will call a writing tool without the
confirmation it gives writes.

### 13. Routes outside the contracts

- The `/reports/...` routes of the `*-reports` binaries are not in
  `apis/openapi.yaml` in order-management, wes-work-planning,
  fulfillment-execution, workforce-management, facility-layout,
  process-path-management and labor-performance (labor-performance has a
  separate `openapi-reports.yaml`; the others have none). Contract tests do
  not cover them and the generated API reference does not show them.
- warehouse-ops-agent has no `apis/openapi.yaml` at all: its 13 routes are
  documented only by hand (`docs/docs/api/http-routes.md`).

### Events with no producer or no consumer

| Event | State |
|---|---|
| `SiteCapabilityChanged` (facility-layout) | declared, never raised (gap 1) |
| `RateDeviationDetected` (wes-work-planning) | `NewRateDeviationDetected` never called; the analytics column is always 0 |
| `OrderRepromised` (order-management) | published since ADR 0018, consumed by no context |
| slotting-optimization events | published, consumed by no context (gap 7) |
| `TransferStateAdvanced` after approval (network-inventory-planning) | declared for every transition, emitted for none after approval (gap 3) |

Dead schema: fulfillment-execution creates `domain_events` in
`migrations/0001_init.up.sql:27` and never reads or writes it.

## S4: observability blind spots

### 14. Every 5xx panel is empty

The warehouse-infra context dashboards filter the error panels on
`http_response_status_code` / `http_status_code`. `otelchi` v0.12.3, used by
every service, records only `http.method`, `http.scheme`, `http.route` and
`service.name` on `http.server.request.duration`. The panels are empty for
every context, and no service can report a 5xx rate. Fix once: a status-code
attribute in a shared middleware, or a dashboard that uses Kong's metrics.
Also: workforce-management's labor panel groups by
`workforce_assignment_outcome` but the attribute is now `outcome`;
inbound-receiving and slotting-optimization have no dashboard; the
process-path-management outbox-lag gauge has no panel.

### 15. Telemetry holes

- No OpenTelemetry setup at all: `cmd/planning-projector` (warehouse-planning),
  `cmd/inbound-projector` (inbound-receiving), `cmd/pathmgmt-projector` and
  `cmd/pathmgmt-reports` (process-path-management, whose chart still injects
  `OTEL_*` they never read).
- Reports Deployments without `ENVIRONMENT` (product-master,
  inbound-receiving): their telemetry reports `deployment.environment.name=local`.
- warehouse-planning's chart sets no `OTEL_EXPORTER_OTLP_ENDPOINT`,
  `SERVICE_VERSION`, `ENVIRONMENT` or `SHUTDOWN_DRAIN_DELAY`.
- Traces stop at the outbox: relayed messages carry no originating trace
  context (facility-layout `relay_sink.go:50`; the outbox stores no headers),
  and the ops agent's outbound MCP/REST/Prometheus/Loki/Anthropic clients have
  no `otelhttp` transport.
- labor-performance's MCP governance charter requires invocation and denial
  counters; none are emitted.

## S5: drift between code, comments and charts

These cost a reader time but break nothing on their own. They were documented
correctly in the new pages and left in the code:

- **Boot retry budget**: every template-derived `internal/bootretry` says
  "~31s (1+2+4+8+16)"; the loop sleeps only between its 5 attempts, so the
  real backoff is 15 s. The same figure is repeated in several charts'
  `values.yaml`.
- **Log level**: `LOG_LEVEL=warning` is accepted by some binaries and
  silently becomes `info` in others (order-management, inventory-storage,
  product-master, workforce-management API binaries).
- **Kafka brokers**: inventory-storage reads `KAFKA_BROKERS` twice with
  different defaults (`cmd/inventory/config.go:96`, `adapters.go:147`).
- **Coverage scope**: `Makefile` and `ci.yml` measure different package sets
  (process-path-management, warehouse-ops-agent).
- **Copy-paste from inventory-storage**: CI comments in product-master
  describe the StockUnit aggregate; inbound-receiving's relay comment calls the
  partition key "the SKU" (it is the ASN number or appointment id).
- **Console**: the chart's default `image.repository`
  (`iqvo/warehouse-console`) differs from what CI publishes
  (`ghcr.io/iqvo/warehouse-console`); `src/config.ts` and two `.claude`
  skills still say no Kong reports route exists (warehouse-infra now creates
  it).
- **Local Kafka**: order-management still ships `docker-compose.kafka.yml`,
  retired fleet-wide, which binds the same port 9092 as the kind broker.

## S6: documentation and delivery gaps that remain

The campaign closed the page-level gaps (every application now scores 100
on the coverage audit). What is still missing:

- **Published sites lag `develop`.** Every per-repo docs site builds only on
  push to `main`, so the new pages go live only with each repo's next
  develop→main release. slotting-optimization has no Pages site enabled.
- **Docs are not built on pull requests** in order-management,
  wes-work-planning and workforce-management (`docs.yml` runs on `main`
  only): a broken link is found after the release, not in review.
- **Fleet-level operations content does not exist.** Every runbook stops at
  its context's boundary. There is no cross-context incident runbook (a
  stuck order across order-management → wes-work-planning →
  fulfillment-execution), no fleet SLO page and no alert catalogue: the
  alerts on the observability pages are suggestions that no repository
  provisions.
- **Contracts without generated reference**: the report APIs (gap 13) and
  the whole warehouse-ops-agent HTTP API have only hand-written pages.
- **Agent guides**: inbound-receiving has no `CLAUDE.md` / `AGENTS.md`;
  stale `.claude` lines were found in order-management, warehouse-planning,
  warehouse-ops-agent, product-master, inbound-receiving and
  warehouse-console (drafts kept with the campaign plan, to apply in one
  rules PR per repo).
- **Supply chain**: order-management's default branch had 5 open Dependabot
  alerts (2 critical, 1 high) on 2026-10-12.
- **Tests not wired into CI**: the chart Service-selector tests
  (`charts/*/tests/test_service_selectors.py`) in order-management and
  wes-work-planning are never run by `ci.yml`.
- **This site's own typecheck is broken**: `npm run typecheck` fails with
  TS5102 (`baseUrl` removed in TypeScript 7, inherited from
  `@docusaurus/tsconfig` 3.10.2), and no workflow runs it, so nothing notices.

## Suggested order of work

1. facility-layout: publish `SiteCapabilityChanged` (unblocks gap 1), then
   network-inventory-planning gaps 2-4 in one wave.
2. Console and order-management web fixes (gaps 5 and 6): small, user-visible.
3. Fleet sensors that stop recurrence: MCP `omitempty` fitness test (gap 11),
   ConfigMap-mounted chart test (gap 10), outbox relay attempt cap (gap 8),
   projector liveness (gap 9).
4. One observability pass in warehouse-infra (gaps 14-15).
5. slotting-optimization packaging and a consumer decision (gap 7).
6. Release develop→main per repo so the new docs go live; enable Pages for
   slotting-optimization.
