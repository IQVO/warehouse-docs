---
id: index
title: Architecture Decision Records
sidebar_label: ADRs
description: Index of ADRs across the fleet, linking to each context's own repository — never copied, so they never drift.
slug: /adr
---

# Architecture Decision Records

Every ADR lives in its owning context's own repository, under
`docs/docs/adr/`, and is published on that context's own docs site. This
page only indexes them — copying ADR content here would create a second
source of truth that inevitably drifts, exactly what
[Overview](/overview) explains this site avoids.

| Context | ADR index |
| --- | --- |
| order-management | [order-management ADRs](https://github.com/claudioed/order-management/tree/develop/docs/docs/adr) |
| inventory-storage | [inventory-storage ADRs](https://github.com/claudioed/inventory-storage/tree/develop/docs/docs/adr) |
| wes-work-planning | [wes-work-planning ADRs](https://github.com/claudioed/wes-work-planning/tree/develop/docs/docs/adr) |
| fulfillment-execution | [fulfillment-execution ADRs](https://github.com/claudioed/fulfillment-execution/tree/develop/docs/docs/adr) |
| workforce-management | [workforce-management ADRs](https://github.com/claudioed/workforce-management/tree/develop/docs/docs/adr) |
| facility-layout | [facility-layout ADRs](https://github.com/claudioed/facility-layout/tree/develop/docs/docs/adr) |
| process-path-management | [process-path-management ADRs](https://github.com/claudioed/process-path-management/tree/develop/docs/docs/adr) |
| labor-performance | [labor-performance ADRs](https://github.com/claudioed/labor-performance/tree/develop/docs/docs/adr) |
| warehouse-ops-agent | [warehouse-ops-agent ADRs](https://github.com/claudioed/warehouse-ops-agent/tree/develop/docs/docs/adr) |
| network-fulfillment | [network-fulfillment ADRs](https://github.com/claudioed/network-fulfillment/tree/develop/docs/adr) (companion to order-management ADR 0020) |

## Cross-cutting decisions worth reading first

A handful of ADRs establish fleet-wide conventions, referenced from more
than one context's own docs:

- **Hexagonal ports & adapters** — every context's own ADR-0001 adopts the
  identical layering (`domain` depends on nothing; `application` depends on
  `domain`; `adapters` depend on `application`/`domain`).
- **RFC 7807 Problem Details** — the shared HTTP error-response convention,
  adopted independently but identically across contexts.
- **Micro-frontend console architecture** —
  [`warehouse-ops-agent` ADR-0002](https://github.com/claudioed/warehouse-ops-agent/tree/develop/docs/docs/adr)
  establishes the fleet's Module Federation console pattern; each context
  that adopts it (`order-management`, `inventory-storage`,
  `wes-work-planning`, `fulfillment-execution`, `workforce-management`,
  `facility-layout`) records its own adoption ADR referencing it back.
- **MCP inbound adapter governance** — each context exposing an MCP server
  (`facility-layout`, `fulfillment-execution`, `inventory-storage`,
  `wes-work-planning`, `workforce-management`, `order-management`,
  `labor-performance`, `process-path-management`) documents its tool
  surface and review gate in its own `docs/docs/mcp/governance-charter.md`
  (`process-path-management` instead documents its MCP adapter in its own
  ADR 0006). The charters' original static bearer key + read/read-write
  scope requirements no longer describe the running code — see the auth
  bullet below. `warehouse-ops-agent` is a Customer of these eight MCP
  surfaces rather than an Open Host Service governed the same way (it runs
  its own separate inbound MCP server for agentic/LLM callers of its own
  read models — see its [API surface](/api-reference/warehouse-ops-agent)),
  and `network-fulfillment` has no MCP server.
- **REST and MCP identity: adopted, then removed** — static bearer keys +
  read/read-write scopes were decided fleet-wide on 2026-09-07
  ([`warehouse-ops-agent` ADR-0005](https://github.com/claudioed/warehouse-ops-agent/tree/develop/docs/docs/adr))
  and rolled out to every REST and MCP surface, then **fully removed**
  fleet-wide ([`warehouse-ops-agent` ADR-0006](https://github.com/claudioed/warehouse-ops-agent/tree/develop/docs/docs/adr),
  plus one superseding ADR per context, e.g. order-management ADR-0012,
  inventory-storage ADR-0015, wes-work-planning ADR-0016,
  fulfillment-execution ADR-0022). Every REST and MCP endpoint is currently
  unauthenticated by deliberate decision, pending a fresh auth-model
  decision.
- **Transactional outbox** — every context that publishes integration or
  analytics events commits the event in the same database transaction as
  the aggregate change and relays it to Kafka afterwards, so a store and
  its topic can never diverge. Reference implementation and full decision
  record:
  [`process-path-management` ADR-0003](https://github.com/claudioed/process-path-management/tree/develop/docs/docs/adr);
  `labor-performance` (ADR 0010), `workforce-management` (ADR 0016),
  `wes-work-planning` (ADR 0014), and `fulfillment-execution` (ADR 0020)
  each adopted the identical pattern with their own ADR. `order-management`
  and `inventory-storage` do **not** have a working outbox — each
  explicitly documents the gap as an accepted, scoped-down tradeoff in its
  own ADR (order-management ADR-0005, inventory-storage ADR-0004): a
  publish failure after the repository commit still fails the whole
  request today, rather than diverging silently. `facility-layout` has a
  Postgres table shaped like an outbox but nothing drains it — its own
  ADR-0009 publishes directly instead and documents that the table is
  unused for live delivery. See the platform
  [Context Map](/strategic-design/context-map)'s outbox section for the
  full, current per-context state.
