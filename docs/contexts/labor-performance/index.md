---
id: index
title: Labor Performance
sidebar_label: Labor Performance
description: Engineered labor standards and actual-vs-standard performance scoring — a Supporting subdomain, a Kafka Customer of fulfillment-execution's TaskCompleted event and a Kafka Supplier to workforce-management, with zero outbound calls to any other service.
slug: /contexts/labor-performance
---

# Labor Performance

<span className="badge-supporting">Supporting Subdomain</span>

**Labor Performance** owns engineered labor standards (`LaborStandard` —
"a PICK should take 45s") and actual-vs-standard performance scoring
(`TaskPerformance` — "this associate's last PICK took 52s, 87% of
standard"). Since ADR 0014, it also derives idle-gap / utilization
read models — the between-task waits `TaskPerformance` scoring alone
never measured — additively on the same event stream, and since ADR 0015 a
standard may carry an optional, caller-supplied travel-time component. It
is one of the fleet's fourteen domain bounded contexts.

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

## This context's pages

- [Business Context](/contexts/labor-performance/business-context): why a
  standard frozen at completion time matters, what an engineered standard
  is, and why this context is a pure observer, never a decision-maker.
- [Ubiquitous Language](/contexts/labor-performance/ubiquitous-language):
  Standard, Scorecard, Coaching Flag and every other term this context
  defines.
- [Core Domain Chart](/contexts/labor-performance/core-domain-chart)
  ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts)):
  why this context is Supporting.
- [Bounded Context Canvas](/contexts/labor-performance/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, strategic classification, domain roles, inbound and outbound
  communication, business decisions and open questions.
- [Context Map](/contexts/labor-performance/context-map)
  ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)):
  every upstream and downstream relationship with its pattern, technology
  and status.
- [Aggregate Design Canvas](/contexts/labor-performance/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  the `TaskPerformance` aggregate, with notes on `LaborStandard` and
  `IdlePeriod`.
- [Domain Events](/contexts/labor-performance/domain-events):
  `LaborStandardDefined` and `LaborStandardRevised` (analytics topic only),
  `TaskPerformanceRecorded` (analytics topic and the integration topic
  `warehouse.labor-performance.events`), and the consumed
  `fulfillment-execution` `TaskCompleted`.
- [Domain Message Flow](/contexts/labor-performance/domain-message-flow)
  ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling)):
  key scenarios as commands, events and queries.
- [EventStorming](/contexts/labor-performance/eventstorming)
  ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)):
  process-level boards.
- [Class Diagram](/contexts/labor-performance/class-diagram): the domain
  model as it exists in the code.
- [Entity Relationship](/contexts/labor-performance/entity-relationship):
  the persisted tables.
- [Sequence Diagrams](/contexts/labor-performance/sequence-diagrams): the
  main runtime interactions.
- [Async API](/contexts/labor-performance/async-api): the Kafka
  integrations (one inbound, one outbound) in narrative form.

Every page above except the Business Context and the Async API narrative
is synced from the `labor-performance` repository.

## Elsewhere

- **Repository**: [github.com/IQVO/labor-performance](https://github.com/IQVO/labor-performance)
- [ADR index](/adr): links to this context's own decision records.
- Generated references on this site:
  [REST](/api-reference/rest/labor-performance/labor-performance-api),
  [Reports REST](/api-reference/rest/labor-performance-reports/labor-performance-reports-api)
  and [AsyncAPI](/api-reference/async/labor-performance).
