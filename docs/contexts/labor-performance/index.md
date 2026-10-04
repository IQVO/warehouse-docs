---
id: index
title: Labor Performance
sidebar_label: Labor Performance
description: Engineered labor standards and actual-vs-standard performance scoring — a Supporting subdomain, a Kafka Customer of fulfillment-execution's TaskCompleted event and a Kafka Supplier to workforce-management, with zero outbound calls to any other service.
slug: /contexts/labor-performance
---

# Labor Performance

<span class="badge-supporting">Supporting Subdomain</span>

**Labor Performance** owns engineered labor standards (`LaborStandard` —
"a PICK should take 45s") and actual-vs-standard performance scoring
(`TaskPerformance` — "this associate's last PICK took 52s, 87% of
standard"). Since ADR 0014, it also derives idle-gap / utilization
read models — the between-task waits `TaskPerformance` scoring alone
never measured — additively on the same event stream, and since ADR 0015 a
standard may carry an optional, caller-supplied travel-time component. It
was the fleet's eighth bounded-context Go service, added after
`order-management`, `inventory-storage`, `wes-work-planning`,
`workforce-management`, `fulfillment-execution`, `facility-layout`, and
`warehouse-ops-agent` (the fleet has since grown to eleven backend contexts).

:::info[One input, zero outbound calls]
This context has exactly **one input**: it is a Kafka **Customer** of
`fulfillment-execution`'s `TaskCompleted` event, on the same shared,
fan-out topic `wes-work-planning` also consumes from. Everything else
points the other way: it publishes `TaskPerformanceRecorded` on
`warehouse.labor-performance.events`, consumed by `workforce-management`
(ADR 0013), and exposes its own OLTP REST, reports and MCP surfaces, read
by the console's `labor_mfe` remote and by `warehouse-ops-agent`. It makes
**no outbound REST or MCP call** to any sibling context. See
[Bounded Context Canvas](/contexts/labor-performance/bounded-context-canvas) and
[Context Map](/strategic-design/context-map) for the full picture.
:::

## On this page set

- **[Business Context](/contexts/labor-performance/business-context)** — why a standard frozen at
  completion time matters, what an engineered standard is, and why this
  context is a pure observer, never a decision-maker.
- **[Ubiquitous Language](/contexts/labor-performance/ubiquitous-language)** — Standard, Scorecard,
  Coaching Flag, and every other term this context defines.
- **[Bounded Context Canvas](/contexts/labor-performance/bounded-context-canvas)** — the full
  ddd-crew canvas: purpose, strategic classification, domain roles,
  inbound/outbound communication, business decisions, open questions.
- **[Aggregate Design Canvas](/contexts/labor-performance/aggregate-design-canvas)** — the
  `TaskPerformance` aggregate (with notes on `LaborStandard` and
  `IdlePeriod`): state transitions, invariants, commands, events,
  throughput, size.
- **[Domain Events](/contexts/labor-performance/domain-events)** — `LaborStandardDefined`,
  `LaborStandardRevised`, `TaskPerformanceRecorded` (and its additive
  `IdleSecondsBefore` field since ADR 0014).
- **[Async API](/contexts/labor-performance/async-api)** — the Kafka integrations (one inbound, one outbound), narrative form.

## Elsewhere

- **Repository** — [github.com/claudioed/labor-performance](https://github.com/claudioed/labor-performance)
- **Docs site** — the service's own Docusaurus site, published from
  `docs/docs/**/*.md` in that repository (the source this page set is
  built from)
- **[Generated API Reference](/api-reference/async/labor-performance)** —
  AsyncAPI reference generated from the real `apis/asyncapi.yaml`
