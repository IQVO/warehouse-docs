---
id: ecosystem-gaps
title: Ecosystem gaps tracker, October 2026
sidebar_label: Ecosystem gaps (tracker)
description: Status of every gap the October 2026 documentation-coverage campaign found across the fleet — fixed (with the merged pull request), kept by decision (with the ADR), or still open — re-verified against each repository's develop branch.
---

# Ecosystem gaps tracker, October 2026

Between 2026-10-09 and 2026-10-12 every application repository got a full
operational documentation set (see
[Documentation coverage](./docs-coverage.md)). Writing those pages meant
reading every binary, chart, consumer and route against the code on
`develop`, and that reading found the gaps below. A gap-fix wave
(2026-10-12 to 2026-10-13) then fixed them, one pull request per
repository, with every decision recorded in a decision log (D1 to D33).

This page is now a **tracker**. Every gap has one status:

- **Fixed in `<repo>#<pr>`**: the pull request is merged into that
  repository's `develop` (checked with `gh pr view`). Links go to the PR.
- **Kept by decision**: the behaviour stays on purpose; the cell names the
  ADR (or code comment) that records why.
- **Open**: not fixed yet, with what is missing.

:::info[How this was verified]
Every row was re-checked on 2026-10-13 against `origin/develop` of each
repository with the wave's read-only scripts (`verify-ecogaps.sh` 1 to 4:
`git grep` / `git show` per claim) plus targeted checks. "Fixed" means
merged to `develop`. **Released** (merged to `main`, live on the
repository's own docs site) and **deployed** (applied to the kind cluster)
are separate: see gap 17a for the release round. Context pages on this site
were re-synced from the same `develop` commits.
:::

Severity: **S1** a business capability does not work end to end;
**S2** an operational failure mode with no guard; **S3** a contract or API
defect a client can hit; **S4** observability blind spot; **S5** drift
between code, comments, charts and docs; **S6** delivery and docs gaps.
Gaps are numbered by severity; the "was" column keeps the number the first
version of this page used.

## Status at a glance

| Status | Rows |
| --- | --- |
| Fixed | 42 |
| Kept by decision | 6 |
| Open | 4 |
| **Total** | **52** |

A row with a mixed outcome counts under its worst status (15d and 17f are
Open). E1, E2 and E5 only point at another row and are not counted twice.

Open rows: [15d](#s4-observability-blind-spots) facility-layout trace
context across the outbox, [16d](#s5-drift-between-code-comments-and-charts)
coverage scope drift, [17a](#s6-documentation-and-delivery-gaps) release of
the gap fixes to `main`, [17f](#s6-documentation-and-delivery-gaps)
process-path-management Dependabot alerts.

## S1: capabilities that did not work end to end

| # | Was | Gap | Owner | Status |
| --- | --- | --- | --- | --- |
| 1 | 1 | Nothing raised `SiteCapabilityChanged`, so inter-warehouse transfers could not run (network-inventory-planning fails closed without capability facts). | facility-layout | **Fixed** in [facility-layout#173](https://github.com/IQVO/facility-layout/pull/173): `PUT /sites/{siteCode}/transfer-capability` raises the event through the outbox with a per-site `capabilityRevision` (facility-layout ADR 0035). |
| 1b | 1 | `SiteCapabilityChanged` uses a `snake_case` payload; every other facility-layout event is `camelCase`. | facility-layout | **Kept by decision**: recasing would be a breaking `.v2` with zero benefit; facility-layout ADR 0035 records the inconsistency (D2). |
| 2 | 2 | The scheduled rebalance always proposed nothing (`Planner.Generate(positions, nil, nil)`). | network-inventory-planning | **Fixed** in [network-inventory-planning#38](https://github.com/IQVO/network-inventory-planning/pull/38): operator-managed Rebalance Policy and Transfer Lane catalogues (`PUT/GET /v1/rebalance-policies`, `/v1/transfer-lanes`); the scheduled pass plans from them (ADR 0015). |
| 3 | 3 | The transfer saga went silent after approval: no `TransferStateAdvanced` for `IN_TRANSIT`, `ARRIVED`, `RECEIVED`, `UNFULFILLABLE`. | network-inventory-planning | **Fixed** in [network-inventory-planning#36](https://github.com/IQVO/network-inventory-planning/pull/36) (every applier gets the outbox publisher); [network-inventory-planning#38](https://github.com/IQVO/network-inventory-planning/pull/38) adds the test that every transition outboxes the event (D3). |
| 3b | 3 | `InterWarehouseTransfer.Cancel` has no caller. | network-inventory-planning | **Kept by decision**: no ADR says who may cancel a transfer or how the origin reservation is compensated, so the transition stays reserved; network-inventory-planning ADR 0015 lists it as a Proposed follow-up (D7). |
| 4 | 5 | The order-management web remote posted `POST /orders` without an `Idempotency-Key`, so a real order-management answered `400`. | order-management | **Fixed** in [order-management#183](https://github.com/IQVO/order-management/pull/183): one `crypto.randomUUID()` per submission, reused on retry (ADR 0038). |
| 5 | 6 | The console network-fulfillment report called `/reports/network-orders`, a route that does not exist. | warehouse-console | **Fixed** in [warehouse-console#79](https://github.com/IQVO/warehouse-console/pull/79): the screen reads `/reports/acknowledgement` and its freshness route. |
| 6 | 7 | slotting-optimization could not be deployed. The first version of this page also said it had no `Dockerfile` and no chart: **that was wrong** (both landed 2026-10-08, commits `4f8a4e1` and `d40e217`). What was missing was the infra wiring. | warehouse-infra | **Fixed** in [warehouse-infra#75](https://github.com/IQVO/warehouse-infra/pull/75): services map entry, Kong route, initdb role and database, dashboard (D10). The repository's Pages site now answers `200`. |
| 6b | 7 | Nobody consumes approved slot plans. | slotting-optimization | **Kept by decision**: who executes a plan (wes-work-planning moves vs inventory-storage relocation) is undecided; slotting-optimization ADR 0007 names the options with status Proposed ([slotting-optimization#17](https://github.com/IQVO/slotting-optimization/pull/17), D11). |

## S2: operational failure modes with no guard

| # | Was | Gap | Owner | Status |
| --- | --- | --- | --- | --- |
| 7 | 4 | A malformed allocation reply (line-id mismatch, unknown rejection reason) was retried forever, blocking a `warehouse.inventory.events` partition. | network-inventory-planning | **Fixed** in [network-inventory-planning#38](https://github.com/IQVO/network-inventory-planning/pull/38): domain validation failures are deterministic, dead-lettered and never retried (D4). |
| 7b | 4 | The `site_sku_demand` upsert had no ordering guard: an older redelivery overwrote newer demand. | network-inventory-planning | **Fixed** in [network-inventory-planning#38](https://github.com/IQVO/network-inventory-planning/pull/38) (D5). |
| 8 | 8 | Outbox relays had no attempt cap: one poison row blocked a relay forever. The first version named only inventory-storage; **no** relay in the fleet passed a cap. | every context with an outbox | **Fixed** in every relay (`OUTBOX_MAX_ATTEMPTS`, default 20, `0` = unlimited; each repository has its own ADR): [inventory-storage#184](https://github.com/IQVO/inventory-storage/pull/184), [order-management#183](https://github.com/IQVO/order-management/pull/183), [process-path-management#143](https://github.com/IQVO/process-path-management/pull/143), [workforce-management#165](https://github.com/IQVO/workforce-management/pull/165), [wes-work-planning#175](https://github.com/IQVO/wes-work-planning/pull/175), [fulfillment-execution#189](https://github.com/IQVO/fulfillment-execution/pull/189), [labor-performance#148](https://github.com/IQVO/labor-performance/pull/148), [inbound-receiving#20](https://github.com/IQVO/inbound-receiving/pull/20), [product-master#27](https://github.com/IQVO/product-master/pull/27), [warehouse-planning#49](https://github.com/IQVO/warehouse-planning/pull/49), [slotting-optimization#17](https://github.com/IQVO/slotting-optimization/pull/17), [network-fulfillment#81](https://github.com/IQVO/network-fulfillment/pull/81), [network-inventory-planning#43](https://github.com/IQVO/network-inventory-planning/pull/43), [facility-layout#178](https://github.com/IQVO/facility-layout/pull/178). |
| 9 | 9 | Analytics projectors kept answering `200` on `/healthz` and `/readyz` after their consumer loop died. | process-path-management, workforce-management | **Fixed** in [process-path-management#143](https://github.com/IQVO/process-path-management/pull/143) and [workforce-management#164](https://github.com/IQVO/workforce-management/pull/164): the projector exits non-zero so the pod restarts (D13). |
| 10 | 10 | Chart ConfigMaps that no Deployment mounted, so `config.*` values did nothing. The first version named two charts; the full list was eleven. | fleet charts | **Fixed** with `envFrom: configMapRef` plus a render test: [facility-layout#173](https://github.com/IQVO/facility-layout/pull/173), [inbound-receiving#20](https://github.com/IQVO/inbound-receiving/pull/20), [inventory-storage#184](https://github.com/IQVO/inventory-storage/pull/184), [labor-performance#148](https://github.com/IQVO/labor-performance/pull/148), [order-management#183](https://github.com/IQVO/order-management/pull/183), [process-path-management#143](https://github.com/IQVO/process-path-management/pull/143), [product-master#27](https://github.com/IQVO/product-master/pull/27), [warehouse-planning#49](https://github.com/IQVO/warehouse-planning/pull/49), [wes-work-planning#175](https://github.com/IQVO/wes-work-planning/pull/175), [fulfillment-execution#189](https://github.com/IQVO/fulfillment-execution/pull/189), [workforce-management#164](https://github.com/IQVO/workforce-management/pull/164) (D14). |
| 10a | other | inbound-receiving had no sweeper: `outbox_events`, `processed_events`, `idempotency_keys` grew without bound. | inbound-receiving | **Fixed** in [inbound-receiving#20](https://github.com/IQVO/inbound-receiving/pull/20) (housekeeping sweeper, inbound-receiving ADR 0010). |
| 10b | other | workforce-management's chart set neither `INSTALLED_CAPACITY_MODE` nor `FULFILLMENT_EXECUTION_BASE_URL`: every shift-plan commit answered `503`. | workforce-management | **Fixed** in [workforce-management#164](https://github.com/IQVO/workforce-management/pull/164): the chart defaults the edge to fulfillment-execution over HTTP, pinned by its render test. |
| 10c | other | fulfillment-execution waited up to 60 s for the Kafka catalogue replay before starting its HTTP listener, so a slow replay ended in a probe kill. | fulfillment-execution | **Fixed** in [fulfillment-execution#190](https://github.com/IQVO/fulfillment-execution/pull/190): the listener starts first and `/readyz` answers `503` until the replay catches up (ADR 0044). |
| 10d | other | warehouse-infra pointed process-path-management's readiness probe at `/healthz`, hiding the `/readyz` shutdown drain. | warehouse-infra | **Fixed** in [warehouse-infra#75](https://github.com/IQVO/warehouse-infra/pull/75) (D24). |
| 10e | other | The ops agent's `/runtime-signals` reported zeros in kind (no `prometheus.url`, no `runtimeSignals.lokiUrl`), and it built MCP clients with empty endpoints. | warehouse-infra, warehouse-ops-agent | **Fixed** in [warehouse-infra#75](https://github.com/IQVO/warehouse-infra/pull/75) (real Prometheus and Loki URLs) and [warehouse-ops-agent#139](https://github.com/IQVO/warehouse-ops-agent/pull/139) (an upstream client is built only when its endpoint is set). |
| 10f | other | Housekeeping could not be disabled: `durationEnv` turned `0` into the default although comments, charts and ADRs say `0` disables it. | process-path-management, labor-performance | **Fixed** in [process-path-management#143](https://github.com/IQVO/process-path-management/pull/143) and [labor-performance#148](https://github.com/IQVO/labor-performance/pull/148): the housekeeping settings use a parser where `0` disables (D15). |

## S3: contract and API defects

| # | Was | Gap | Owner | Status |
| --- | --- | --- | --- | --- |
| 11 | 11 | Optional MCP report-tool inputs had no `omitempty`, so `tools/list` marked them required and calls without them failed. | 6 contexts | **Fixed** in [inventory-storage#184](https://github.com/IQVO/inventory-storage/pull/184), [wes-work-planning#175](https://github.com/IQVO/wes-work-planning/pull/175), [fulfillment-execution#188](https://github.com/IQVO/fulfillment-execution/pull/188), [workforce-management#165](https://github.com/IQVO/workforce-management/pull/165), [process-path-management#143](https://github.com/IQVO/process-path-management/pull/143), [facility-layout#173](https://github.com/IQVO/facility-layout/pull/173); every repository with MCP tools now runs the fitness test `TestMCPOptionalToolInputsCarryOmitempty` (D16). |
| 12 | 12 | wes-work-planning annotated `get_backlog_telemetry` and `get_rebalance_recommendation` read-only although they publish events. | wes-work-planning | **Fixed** in [wes-work-planning#174](https://github.com/IQVO/wes-work-planning/pull/174): `readOnlyHint=false`, `destructiveHint=true` (ADR-0037). |
| 12b | 12 | fulfillment-execution's MCP server instructions said "Read-only access" next to the `complete_task` write tool. | fulfillment-execution | **Fixed** in [fulfillment-execution#188](https://github.com/IQVO/fulfillment-execution/pull/188): the instructions name the write tool and ask for confirmation. |
| 13 | 13 | The `*-reports` binaries' routes were outside every contract (no spec, no contract test, no generated reference). The first version said "8 contexts"; six were open. | 6 contexts | **Fixed** with an `apis/openapi-reports.yaml` per binary: [order-management#183](https://github.com/IQVO/order-management/pull/183), [wes-work-planning#175](https://github.com/IQVO/wes-work-planning/pull/175), [fulfillment-execution#189](https://github.com/IQVO/fulfillment-execution/pull/189), [workforce-management#165](https://github.com/IQVO/workforce-management/pull/165), [facility-layout#173](https://github.com/IQVO/facility-layout/pull/173), [process-path-management#143](https://github.com/IQVO/process-path-management/pull/143) (D18). This site generates a **Reports REST** section for each (see the [API reference](/api-reference)). |
| 13b | 13 | warehouse-ops-agent has no OpenAPI spec. | warehouse-ops-agent | **Kept by decision**: the ops agent has no spec by design and documents its routes on a hand-written page ([warehouse-ops-agent API surface](/api-reference/warehouse-ops-agent)) (D19). |

### Events with no producer or no consumer

| # | Event | State found | Status |
| --- | --- | --- | --- |
| E1 | `SiteCapabilityChanged` (facility-layout) | declared, never raised | **Fixed**: gap 1. |
| E2 | `TransferStateAdvanced` after approval (network-inventory-planning) | emitted for no transition after approval | **Fixed**: gap 3. |
| E3 | `RateDeviationDetected` (wes-work-planning) | `NewRateDeviationDetected` never called; the report column is always 0 | **Kept by decision**: no ADR defines when it is raised (ADR-0003 calls the rate rule unbuilt, ADR-0020 defers it), so it stays reserved; the AsyncAPI description and the report say so and a sensor test fails if code starts raising it without an ADR ([wes-work-planning#174](https://github.com/IQVO/wes-work-planning/pull/174), D26). |
| E4 | `OrderRepromised` (order-management) | published, consumed by no context | **Kept by decision**: it carries CPT ids and a reason but no new cutoff instant, so it cannot move an order between windows; warehouse-planning ADR 0004 and `order_demand_consumer.go:32` record why it is not consumed (D32). |
| E5 | slotting-optimization events | published, consumed by no context | **Kept by decision**: gap 6b. |
| E6 | fulfillment-execution `domain_events` table | created by migration 0001, never read or written | **Fixed** in [fulfillment-execution#191](https://github.com/IQVO/fulfillment-execution/pull/191): migration 0018 drops it (ADR 0045; the owner approved the drop, superseding D23). |

## S4: observability blind spots

| # | Was | Gap | Owner | Status |
| --- | --- | --- | --- | --- |
| 14 | 14 | Every 5xx dashboard panel was empty: the panels filtered on a status-code label that `otelchi` v0.12.3 never records. | warehouse-infra | **Fixed** in [warehouse-infra#75](https://github.com/IQVO/warehouse-infra/pull/75): the 5xx panels use Kong's `kong_http_requests_total` per route (D20). |
| 14b | 14 | workforce-management's labor panel grouped by `workforce_assignment_outcome`; the attribute is `outcome`. | warehouse-infra | **Fixed** in [warehouse-infra#75](https://github.com/IQVO/warehouse-infra/pull/75). |
| 14c | 14 | inbound-receiving and slotting-optimization had no dashboard; process-path-management's outbox-lag gauge had no panel. | warehouse-infra | **Fixed**: inbound-receiving in [warehouse-infra#72](https://github.com/IQVO/warehouse-infra/pull/72) (already merged when the first version was written, so that part was stale); slotting-optimization and the process-path-management outbox panel in [warehouse-infra#75](https://github.com/IQVO/warehouse-infra/pull/75). |
| 15 | 15 | No OpenTelemetry setup in `cmd/planning-projector`, `cmd/inbound-projector`, `cmd/pathmgmt-projector`, `cmd/pathmgmt-reports`. | 3 contexts | **Fixed** in [warehouse-planning#49](https://github.com/IQVO/warehouse-planning/pull/49), [inbound-receiving#20](https://github.com/IQVO/inbound-receiving/pull/20), [process-path-management#143](https://github.com/IQVO/process-path-management/pull/143) (`telemetry.Setup`, D21). |
| 15b | 15 | Reports Deployments without `ENVIRONMENT` reported `deployment.environment.name=local`. | product-master, inbound-receiving | **Fixed** in [product-master#27](https://github.com/IQVO/product-master/pull/27) and [inbound-receiving#20](https://github.com/IQVO/inbound-receiving/pull/20). |
| 15c | 15 | warehouse-planning's chart set no `OTEL_EXPORTER_OTLP_ENDPOINT`, `SERVICE_VERSION`, `ENVIRONMENT`. | warehouse-planning | **Fixed** in [warehouse-planning#49](https://github.com/IQVO/warehouse-planning/pull/49). |
| 15d | 15 | Traces stopped at the outbox: relayed messages carried no originating trace context. | every context with an outbox | **Open** for facility-layout only: its `outbox_events` has no `headers` column and `relay_sink.go` injects the relay's own context, not the request's. Fixed elsewhere (outbox `headers` + relay forwarding + the two trace tests, D27): [order-management#183](https://github.com/IQVO/order-management/pull/183), [process-path-management#143](https://github.com/IQVO/process-path-management/pull/143), [workforce-management#165](https://github.com/IQVO/workforce-management/pull/165), [wes-work-planning#175](https://github.com/IQVO/wes-work-planning/pull/175), [fulfillment-execution#189](https://github.com/IQVO/fulfillment-execution/pull/189), [labor-performance#148](https://github.com/IQVO/labor-performance/pull/148), [inbound-receiving#20](https://github.com/IQVO/inbound-receiving/pull/20), [product-master#27](https://github.com/IQVO/product-master/pull/27), [warehouse-planning#49](https://github.com/IQVO/warehouse-planning/pull/49), [slotting-optimization#17](https://github.com/IQVO/slotting-optimization/pull/17), [network-fulfillment#81](https://github.com/IQVO/network-fulfillment/pull/81), [network-inventory-planning#43](https://github.com/IQVO/network-inventory-planning/pull/43); inventory-storage already stored and forwarded the headers. |
| 15e | 15 | The ops agent's outbound MCP, REST, Prometheus, Loki and Anthropic clients had no `otelhttp` transport. | warehouse-ops-agent | **Fixed** in [warehouse-ops-agent#139](https://github.com/IQVO/warehouse-ops-agent/pull/139). |
| 15f | 15 | labor-performance's MCP governance charter requires invocation and denial counters; none were emitted. | labor-performance | **Fixed** in [labor-performance#148](https://github.com/IQVO/labor-performance/pull/148) (ADR 0033, D28). |

## S5: drift between code, comments and charts

| # | Was | Gap | Status |
| --- | --- | --- | --- |
| 16 | 16 | Every `internal/bootretry` said "~31s (1+2+4+8+16)"; the real backoff is 15 s. | **Fixed** in every backend repository's gap-fix PR (D22), e.g. [order-management#183](https://github.com/IQVO/order-management/pull/183), [inventory-storage#184](https://github.com/IQVO/inventory-storage/pull/184), [warehouse-planning#49](https://github.com/IQVO/warehouse-planning/pull/49); no `~31s` is left under `internal/`, `cmd/` or `charts/` on any `develop`. |
| 16b | 16 | `LOG_LEVEL=warning` silently became `info` in some binaries. | **Fixed** in [order-management#183](https://github.com/IQVO/order-management/pull/183), [inventory-storage#184](https://github.com/IQVO/inventory-storage/pull/184), [product-master#27](https://github.com/IQVO/product-master/pull/27), [workforce-management#165](https://github.com/IQVO/workforce-management/pull/165) (the D22 parity item in each repository's gap-fix PR). |
| 16c | 16 | inventory-storage read `KAFKA_BROKERS` twice with different defaults. | **Fixed** in [inventory-storage#184](https://github.com/IQVO/inventory-storage/pull/184): read once in `cmd/inventory/config.go`. |
| 16d | 16 | `Makefile` and `ci.yml` measure coverage over different package sets. | **Open**: process-path-management's `COVERAGE_PKGS` adds `./internal/analytics/...` and warehouse-ops-agent's `COVERPKG` adds `./internal/adapters/inbound/...`, while both `ci.yml` jobs use `-coverpkg=./internal/domain/...,./internal/application/...`. No decision row covered it. |
| 16e | 16 | Copy-paste comments: product-master CI comments described the StockUnit aggregate; inbound-receiving's relay comment called the partition key "the SKU". | **Fixed** in [product-master#27](https://github.com/IQVO/product-master/pull/27) and [inbound-receiving#20](https://github.com/IQVO/inbound-receiving/pull/20). |
| 16f | 16 | Console chart `image.repository` differed from what CI publishes; `src/config.ts` said no Kong reports route exists. | **Fixed** in [warehouse-console#79](https://github.com/IQVO/warehouse-console/pull/79) (`ghcr.io/iqvo/warehouse-console`; the comment now describes the Kong reports route). |
| 16g | 16 | order-management still shipped the retired `docker-compose.kafka.yml`, binding the kind broker's port. | **Fixed** in [order-management#183](https://github.com/IQVO/order-management/pull/183). |

## S6: documentation and delivery gaps

| # | Was | Gap | Status |
| --- | --- | --- | --- |
| 17a | 17 | Published sites lag `develop`: each repository's docs site publishes only from `main`. | **Open** (release in progress): the final develop→main round merged [order-management#189](https://github.com/IQVO/order-management/pull/189), [inventory-storage#190](https://github.com/IQVO/inventory-storage/pull/190) and [fulfillment-execution#197](https://github.com/IQVO/fulfillment-execution/pull/197); wes-work-planning#181, workforce-management#171, facility-layout#179, process-path-management#149, labor-performance#155, network-fulfillment#86, warehouse-planning#54, product-master#32, inbound-receiving#26 and warehouse-infra#76 were still open on 2026-10-13. slotting-optimization, network-inventory-planning, warehouse-ops-agent and warehouse-console have nothing left to release. |
| 17b | 17 | Docs were not built on pull requests. The first version named three repositories; nine Docusaurus sites lacked the trigger. | **Fixed** (build-only `pull_request` trigger, D25) in [order-management#183](https://github.com/IQVO/order-management/pull/183), [wes-work-planning#175](https://github.com/IQVO/wes-work-planning/pull/175), [workforce-management#164](https://github.com/IQVO/workforce-management/pull/164), [facility-layout#178](https://github.com/IQVO/facility-layout/pull/178), [fulfillment-execution#189](https://github.com/IQVO/fulfillment-execution/pull/189), [labor-performance#148](https://github.com/IQVO/labor-performance/pull/148), [process-path-management#143](https://github.com/IQVO/process-path-management/pull/143), [warehouse-ops-agent#139](https://github.com/IQVO/warehouse-ops-agent/pull/139), [warehouse-console#79](https://github.com/IQVO/warehouse-console/pull/79). network-fulfillment has plain Markdown docs and no docs workflow, so there is nothing to build. |
| 17c | 17 | No fleet-level operations content: no cross-context incident runbook, no SLO page, and alerts that were suggestions no repository provisioned. | **Fixed**: the alert rules in [warehouse-infra#75](https://github.com/IQVO/warehouse-infra/pull/75) (35 rules, promtool-tested); the pages on this site: [incident runbook](../fleet-operations/incident-runbook.md), [Fleet SLOs](../fleet-operations/slos.md), [alert catalogue](../fleet-operations/alert-catalogue.md) (D30). |
| 17d | 17 | Contracts without generated reference: the report APIs and the ops agent's HTTP API. | **Fixed** for the report APIs (gap 13; generated here). The ops agent's API stays hand-written: **Kept by decision** (gap 13b). |
| 17e | 17 | Agent guides: inbound-receiving had no `CLAUDE.md`/`AGENTS.md`; stale `.claude` lines in six repositories. | **Fixed** in [inbound-receiving#18](https://github.com/IQVO/inbound-receiving/pull/18) (guides added; the first version was already stale), [order-management#181](https://github.com/IQVO/order-management/pull/181), [warehouse-planning#47](https://github.com/IQVO/warehouse-planning/pull/47), [warehouse-ops-agent#134](https://github.com/IQVO/warehouse-ops-agent/pull/134), [product-master#25](https://github.com/IQVO/product-master/pull/25), [warehouse-console#77](https://github.com/IQVO/warehouse-console/pull/77). |
| 17f | 17 | Supply chain: open Dependabot alerts. | order-management: **Fixed** in [order-management#183](https://github.com/IQVO/order-management/pull/183) (0 open alerts). **Open** for process-path-management: 5 open alerts (2 critical, 1 high, 1 medium, 1 low) on 2026-10-13, waiting for the fleet-wide sweep (D29). |
| 17g | 17 | Chart Service-selector tests not run by CI. The first version named two repositories; five lacked the job. | **Fixed** (`chart-tests` job, D25) in [order-management#183](https://github.com/IQVO/order-management/pull/183), [wes-work-planning#175](https://github.com/IQVO/wes-work-planning/pull/175), [inventory-storage#184](https://github.com/IQVO/inventory-storage/pull/184), [fulfillment-execution#189](https://github.com/IQVO/fulfillment-execution/pull/189), [workforce-management#164](https://github.com/IQVO/workforce-management/pull/164). |
| 17h | 17 | This site's `npm run typecheck` failed with TS5102 and no workflow ran it. | **Fixed** in [warehouse-docs#42](https://github.com/IQVO/warehouse-docs/pull/42), the PR that publishes this tracker: `tsconfig.json` overrides `baseUrl` and the `build-check` job runs the typecheck (D31). |

## Not a gap any more, but not deployed either

Merged to `develop` is not running in the kind cluster. The capability
command (gap 1), the policy and lane catalogues (gap 2), the slotting
wiring (gap 6) and the alert rules (gap 17c) reach the cluster only after
the release to `main` (gap 17a) and a `terraform apply` / ArgoCD sync of
warehouse-infra. Check the cluster before you rely on them there.
