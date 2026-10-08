---
id: index
title: Warehouse Ops Agent
sidebar_label: Introduction
description: The read-side decision-support agent and console BFF that correlates facts read from the fleet's bounded contexts into ranked, human-gated recommendations — no domain aggregate, no apis/openapi.yaml.
slug: /contexts/warehouse-ops-agent
---

# Warehouse Ops Agent

<span className="badge-supporting">Supporting Subdomain</span> · Operator tooling, no aggregate

`warehouse-ops-agent` is the fleet's *agentic* layer: an "AI teammate that
sees, analyzes, and recommends" over the warehouse-systems bounded
contexts — an outbound MCP client for eleven of them: the five original
ones (`inventory-storage`, `wes-work-planning`, `fulfillment-execution`,
`workforce-management`, `facility-layout`), three second-wave clients
(`labor-performance`, `order-management`, `process-path-management`,
[ADR 0007](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0007-second-wave-outbound-mcp-clients.md);
the `order-management` and `process-path-management` MCP clients are wired
but unused), and `warehouse-planning`
([ADR 0013](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0013-warehouse-planning-mcp-client-and-capacity-outlook.md),
read tools only, active when `WAREHOUSE_PLANNING_MCP_ENDPOINT` is set),
`network-inventory-planning`
([ADR 0019](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0019-network-inventory-planning-transfer-watch.md),
transfer watch) and `product-master`
([ADR 0020](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0020-product-master-mcp-client-and-master-data-gaps.md),
four read tools, of which `list_products` feeds `find_master_data_gaps` and
`GET /master-data-gaps`; active when `PRODUCT_MASTER_MCP_ENDPOINT` is set,
which the reference deployment does)
— and, separately, the Backend-for-Frontend behind the operator console's
genuinely cross-cutting screens.

It is a **Customer** of those contexts' published MCP Open Host Services
and plain REST APIs — never a Go-level dependency on any of them, and
never a write (zero write capability is CI-enforced by
`internal/architecture/zerowrite/zerowrite_test.go`). Its own REST and MCP
surfaces are unauthenticated by deliberate decision — see
[ADR 0006](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0006-fleet-wide-auth-removal.md).

:::info[Defining trait: no domain aggregate, no `apis/openapi.yaml`]
Unlike every other bounded context documented in this fleet,
`warehouse-ops-agent` owns **no domain aggregate, no invariant, and no
persisted domain state** — and correspondingly ships **no
`apis/openapi.yaml`**. Its REST and MCP surface is small enough, and
changes fast enough, that it is documented in prose on the
[API surface](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/api-surface.md)
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
[ADR 0001](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0001-warehouse-ops-agent-placement.md)
in the repo's own docs for the full placement rationale.

## This context's pages

- [Business Context](/contexts/warehouse-ops-agent/business-context): what
  a "daily brief" and a "flow-balance exception" mean operationally, and
  why the console needs a BFF instead of each micro-frontend calling
  several services directly.
- [Ubiquitous Language](/contexts/warehouse-ops-agent/ubiquitous-language):
  the vocabulary this agent coins for its own correlation policies, plus
  the terms it borrows unchanged from its upstream contexts.
- [Core Domain Chart](/contexts/warehouse-ops-agent/core-domain-chart)
  ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts)):
  why this context is Supporting, with a caveat.
- [Bounded Context Canvas](/contexts/warehouse-ops-agent/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  the full canvas, including why this context's domain role reads
  *analysis context*.
- [Context Map](/contexts/warehouse-ops-agent/context-map)
  ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)):
  every upstream it reads, each with its tools and whether it is live or
  wired but unused, plus the console downstream.
- [Aggregate Design Canvas](/contexts/warehouse-ops-agent/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  states that there is **no aggregate root**, and lists the boundary
  validation, decision objects and read models instead.
- [Domain Events](/contexts/warehouse-ops-agent/domain-events): this
  context publishes and consumes **no** events, with the evidence.
- [Domain Message Flow](/contexts/warehouse-ops-agent/domain-message-flow)
  ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling)):
  the morning brief, flow-balance exception, stranded-reservation triage
  and console order-lifecycle scenarios.
- [EventStorming](/contexts/warehouse-ops-agent/eventstorming)
  ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)):
  boards for the daily brief, flow-balance exception and stranded
  reservation.
- [Class Diagram](/contexts/warehouse-ops-agent/class-diagram): the policy
  layer, ports and adapters as they exist in the code.
- [Entity Relationship](/contexts/warehouse-ops-agent/entity-relationship):
  there is no database, so this page describes the in-memory state the
  agent does hold.
- [Sequence Diagrams](/contexts/warehouse-ops-agent/sequence-diagrams): the
  main runtime interactions.

Every page above except the Business Context is synced from the
`warehouse-ops-agent` repository. There is no Async API page, because
this context has no Kafka integration.

## Elsewhere

- Repository: [github.com/IQVO/warehouse-ops-agent](https://github.com/IQVO/warehouse-ops-agent)
- Full docs site: [iqvo.github.io/warehouse-ops-agent](https://iqvo.github.io/warehouse-ops-agent)
- Architecture Decision Records: fifteen on `develop` (0001 to 0015), the
  newest being
  [0013](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0013-warehouse-planning-mcp-client-and-capacity-outlook.md),
  [0014](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0014-runtime-signals-and-stranded-reservation-adoption.md)
  and
  [0015](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0015-core-flow-balance-and-daily-brief-adoption.md).
  See also the [ADR index](/adr).
- The [API surface page](/api-reference/warehouse-ops-agent) on this site
  describes its REST and MCP surface in prose.
- Fleet-wide [Strategic Design](/strategic-design): how the twelve contexts
  documented on this site relate.
