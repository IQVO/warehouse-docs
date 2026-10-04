---
id: index
title: Warehouse Ops Agent
sidebar_label: Introduction
description: The read-side decision-support agent and console BFF that correlates facts read from the fleet's bounded contexts into ranked, human-gated recommendations — no domain aggregate, no apis/openapi.yaml.
slug: /contexts/warehouse-ops-agent
---

# Warehouse Ops Agent

<span class="badge-supporting">Supporting</span> · Operator tooling, no aggregate

`warehouse-ops-agent` is the fleet's *agentic* layer: an "AI teammate that
sees, analyzes, and recommends" over the warehouse-systems bounded
contexts — an outbound MCP client for eight of them: the five original
ones (`inventory-storage`, `wes-work-planning`, `fulfillment-execution`,
`workforce-management`, `facility-layout`) plus three second-wave clients
(`labor-performance`, `order-management`, `process-path-management`,
[ADR 0007](https://github.com/claudioed/warehouse-ops-agent/blob/develop/docs/docs/adr/0007-second-wave-outbound-mcp-clients.md))
— and, separately, the Backend-for-Frontend behind the operator console's
genuinely cross-cutting screens.

It is a **Customer** of those contexts' published MCP Open Host Services
and plain REST APIs — never a Go-level dependency on any of them, and
never a write (zero write capability is CI-enforced by
`internal/architecture/zerowrite/zerowrite_test.go`). Its own REST and MCP
surfaces are unauthenticated by deliberate decision — see
[ADR 0006](https://github.com/claudioed/warehouse-ops-agent/blob/develop/docs/docs/adr/0006-fleet-wide-auth-removal.md).

:::info[Defining trait: no domain aggregate, no `apis/openapi.yaml`]
Unlike every other bounded context documented in this fleet,
`warehouse-ops-agent` owns **no domain aggregate, no invariant, and no
persisted domain state** — and correspondingly ships **no
`apis/openapi.yaml`**. Its REST and MCP surface is small enough, and
changes fast enough, that it is documented in prose on the
[API surface](https://github.com/claudioed/warehouse-ops-agent/blob/develop/docs/docs/api-surface.md)
page of its own docs site rather than generated from a spec. This is not
an oversight this documentation pass is filling in — it is a deliberate,
disclosed consequence of what this repository actually is: a read-side
correlation and aggregation mechanism, not a bounded context with a
domain layer to formalize. See [Bounded Context Canvas](/contexts/warehouse-ops-agent/bounded-context-canvas)
for the full reasoning.
:::

## What it is

A **read-side / decision-support mechanism** with three independent
use-case families in one binary:

1. **Decision support (MCP-facing)** — correlates facts read from
   upstream contexts' MCP Open Host Services through a pure policy layer
   into ranked, human-gated recommendations: the "daily brief", the
   "flow-balance exception" (with the ADR 0008 labor-utilization overlay
   and an optional, default-off LLM reasoner per ADR 0004), and
   `explain_travel_factor` (ADR 0009).
2. **Console BFF** — a thin Backend-for-Frontend that fans out read-only
   REST calls to four contexts' OLTP APIs (Order Lifecycle) and seven
   contexts' `*-reports` analytics binaries (WMS/WES dashboards) on behalf
   of the operator console's browser SPA.
3. **Runtime signals** — `GET /runtime-signals` reads Istio metrics from
   Prometheus and error logs from Loki and classifies each backend
   service's error rate and p99 latency.

## What it is not

It is **not a bounded context** in the domain sense (its own ADR 0001
frames this as "not a sixth bounded context"). There is no
aggregate or invariant for this repo to own, so calling it a "context"
in the tactical-pattern sense would be a domain in name only. See
[ADR 0001](https://github.com/claudioed/warehouse-ops-agent/blob/develop/docs/docs/adr/0001-warehouse-ops-agent-placement.md)
in the repo's own docs for the full placement rationale.

## On this page set

- [Business Context](/contexts/warehouse-ops-agent/business-context) — what a "daily brief" and a
  "flow-balance exception" mean operationally, and why the console needs
  a BFF instead of each micro-frontend calling four services directly.
- [Ubiquitous Language](/contexts/warehouse-ops-agent/ubiquitous-language) — the exact vocabulary
  this agent coins for its own correlation policies, plus the terms it
  borrows unredefined from its upstream contexts.
- [Bounded Context Canvas](/contexts/warehouse-ops-agent/bounded-context-canvas) — the full
  ddd-crew canvas, including why this context's Domain Role reads
  *analysis context* rather than Core/Supporting/Generic, and why there
  is no Aggregate Design Canvas, Domain Events, or AsyncAPI page for it.

## Elsewhere

- Repository: [github.com/claudioed/warehouse-ops-agent](https://github.com/claudioed/warehouse-ops-agent)
- Full docs site: [claudioed.github.io/warehouse-ops-agent](https://claudioed.github.io/warehouse-ops-agent)
- Architecture Decision Records: ten on `develop` (0001–0010), newest
  [0008](https://github.com/claudioed/warehouse-ops-agent/blob/develop/docs/docs/adr/0008-labor-utilization-advisory-correlation.md),
  [0009](https://github.com/claudioed/warehouse-ops-agent/blob/develop/docs/docs/adr/0009-explain-travel-factor.md) and
  [0010](https://github.com/claudioed/warehouse-ops-agent/blob/develop/docs/docs/adr/0010-standard-metrics-convention.md)
- Fleet-wide [Strategic Design](/strategic-design) — how all eleven backend contexts relate
