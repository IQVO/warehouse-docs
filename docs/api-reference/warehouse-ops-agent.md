---
id: warehouse-ops-agent
title: warehouse-ops-agent — API Surface
sidebar_label: warehouse-ops-agent
description: The REST and MCP surface warehouse-ops-agent exposes. No OpenAPI spec — documented in prose, sourced from the service's own docs.
---

# warehouse-ops-agent — API surface

`warehouse-ops-agent` has no `apis/openapi.yaml`. Its owning repository
documents the surface in prose instead of generating it. The tables below
summarise that repository's
[`docs/docs/api-surface.md`](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/api-surface.md),
checked against `internal/adapters/inbound/` on `develop`. Where this page
and that source differ, the source wins. Every route is a `GET`. Neither
surface is authenticated (that repository's ADR 0006, the fleet-wide auth
removal).

## REST (`internal/adapters/inbound/http`)

| Method & path | What it returns |
| --- | --- |
| `GET /healthz` | `{"status": "ok"}` |
| `GET /daily-brief` | The full synthesized `DailyBrief`: each monitored site's paths with backlog, staffing, queue and stuck-task facts, plus ranked `openExceptions`. When `WAREHOUSE_PLANNING_MCP_ENDPOINT` is set, each path also carries an optional `capacityOutlook` from `warehouse-planning` (ADR 0013). This section fails open: it never fails the brief and never changes `openExceptions`. |
| `GET /flow-balance/{pathId}?buildingId=&shiftId=` | The E1 `FlowBalanceException` correlation for one path. The LLM reasoner can arbitrate it (ADR 0004), and the labor-utilization correlation can enrich it (ADR 0008). 503 if the use case isn't wired. |
| `GET /explain-travel-factor?pathId=&fromLocationCode=&toLocationCode=` | Calls `facility-layout`'s `estimate_travel_distance` for two required, caller-supplied location codes and classifies the result as `travel_significant` or `travel_negligible` (ADR 0009). The agent never infers the codes itself. |
| `GET /console/orders/{id}/lifecycle` | The console-bff read model. It fans out to `order-management`, `inventory-storage`, `wes-work-planning` and `fulfillment-execution`, then stitches one order's cross-service lifecycle for `warehouse-console`'s Order Lifecycle screen. Each stage degrades on its own, so one unreachable context never 500s the whole response. |
| `GET /console/reports/wms?from=&to=` | The console-bff WMS dashboard (ADR 0003). It has three sections, one each from the reports binaries of `order-management`, `inventory-storage` and `facility-layout`. Each section degrades on its own. |
| `GET /console/reports/wes?from=&to=` | The console-bff WES dashboard. It has four sections, one each from `wes-work-planning`, `fulfillment-execution`, `workforce-management` and `labor-performance`. Each section degrades on its own. |
| `GET /runtime-signals` | Runtime health per backend service over a 10-minute window: Istio 5xx rate and p99 latency from Prometheus, plus error-log counts from Loki. A source that cannot be queried is listed in `unavailableSources` and does not fail the request. |
| `GET /master-data-gaps?kind=&cursor=` | Pages through `product-master`'s `list_products` MCP tool and reports products with a master-data gap: `unclassified` or `dimension-discrepancy` (all kinds when `kind` is omitted). 503 when `PRODUCT_MASTER_MCP_ENDPOINT` is unset, 502 when product-master is unreachable (ADR 0020). |
| `GET /transfer-watch/stuck`, `GET /transfer-watch/transfers/{id}`, `GET /transfer-watch/imbalance` | Reads over `network-inventory-planning` (ADR 0019). That context is not documented on this site yet. |

## MCP (`internal/adapters/inbound/mcp`)

The agent runs its own MCP server (Streamable HTTP, unauthenticated). An
agentic host can call it for recommendations the same way it calls any
bounded context for facts.

| Tool | What it does |
| --- | --- |
| `get_daily_brief` | Returns the full synthesized `DailyBrief`, including the optional per-path `capacityOutlook`. |
| `list_open_exceptions` | Lists open exceptions, optionally filtered to a minimum `severity` (`info`/`warning`/`critical`). An unrecognized severity value is rejected, never silently defaulted. |
| `get_flow_balance_exception` | Correlates the E1 signals for one `pathId` (+ `buildingId`/`shiftId`) into a ranked `FlowBalanceException`. |
| `explain_travel_factor` | Same as the REST route. Both location codes are required and never guessed. |
| `detect_stranded_reservation` | The E2 `StrandedReservationException` use case. It correlates `fulfillment-execution`'s expired or expiring leases with `inventory-storage`'s usable-stock shortfall for one SKU. It recommends `revoke_reservation` only together with the blast radius that recommendation requires, and never calls that write tool itself. |
| `find_master_data_gaps` | Same as `GET /master-data-gaps`. Registered only when `PRODUCT_MASTER_MCP_ENDPOINT` is set (ADR 0020). |

All six tools are annotated read-only. The agent has no write tools. See
[warehouse-ops-agent's governance note](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/mcp/governance-note.md)
for why that is a v1 design choice.

## What is not yet exposed

The outbound MCP clients for `order-management` and `process-path-management`
are wired in the composition root, but no use case consumes them yet
(ADR 0007). The agent uses its `warehouse-planning` client
(ADR 0013) only through `get_process_path_capacity`, for the daily brief's
capacity outlook. Its other planning read tools are wired but unused. Its
`product-master` client (ADR 0020) may call exactly four read tools; only
`list_products` has a use case today, and `get_product`,
`get_product_classification` and `get_physical_profile` are wired but
unused.
