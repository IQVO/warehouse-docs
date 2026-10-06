---
id: index
title: Process Path Management
sidebar_label: Process Path Management
description: The operator-configurable process-path catalogue — a Generic subdomain, extracted once instead of duplicated across three consumers.
slug: /contexts/process-path-management
---

# Process Path Management

<span className="badge-generic">Generic Subdomain</span>

**Process Path Management** owns the operator-configurable catalogue of
process paths (`PICK`, `PACK`, `REBIN`, `SLAM`, …) — a path's canonical
identity, the `matchPrefix` rule downstream consumers use to resolve a
caller-supplied id to a path family, whether it is `Direct`, and the
capabilities a station/associate must hold to work it. Since
[ADR 0010](https://github.com/IQVO/process-path-management/blob/develop/docs/docs/adr/0010-fulfillment-capability-contract.md)
each path also declares a p95 cycle time and eligibility rules, and the
context owns a second aggregate — a site-scoped **CPT schedule** — so
`order-management` can derive its delivery promise from path capability.

It replaces a static YAML file
(`warehouse-infra/config/process-paths/sortable-fc.yaml`) that
`fulfillment-execution`, `wes-work-planning`, and `workforce-management`
each independently boot-loaded — three unowned copies of the same fact,
revisable only by a coordinated redeploy of all three. This service is the
single, auditable source of truth in its place.

:::note[Five consumers, zero outbound calls]
This context publishes real, tested domain events. The three original
catalogue consumers (`fulfillment-execution`, `wes-work-planning`,
`workforce-management`) replay its topic into a local cache (ADR 0002).
`order-management` consumes the same topic for cycle time, eligibility
and `CPTScheduleChanged` (ADR 0010), and `network-fulfillment` reads the
catalogue and CPT schedule into an opt-in capability cache. This context
consumes no other context's events and calls no sibling over REST or
MCP. It also ships its own analytics data product (ADR 0007). See
[Domain Events](/contexts/process-path-management/domain-events) and
[Async API](/contexts/process-path-management/async-api) for the full
picture.
:::

## This context's pages

- [Business Context](/contexts/process-path-management/business-context):
  why extracting the catalogue beats three services each owning a copy of
  the same YAML file.
- [Ubiquitous Language](/contexts/process-path-management/ubiquitous-language):
  ProcessPath, PathId, Capability, MatchPrefix, Direct,
  DestinationLocationRole, CycleTimeP95, Eligibility, CPTSchedule, Status.
- [Core Domain Chart](/contexts/process-path-management/core-domain-chart)
  ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts)):
  why this context is Generic.
- [Bounded Context Canvas](/contexts/process-path-management/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, strategic classification, roles, inbound and outbound
  communication, business decisions and open questions.
- [Context Map](/contexts/process-path-management/context-map)
  ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)):
  every downstream relationship with its pattern, technology and status.
- [Aggregate Design Canvas](/contexts/process-path-management/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  the `ProcessPath` aggregate (plus the smaller `CPTSchedule` aggregate),
  with state transitions, invariants, commands and events.
- [Domain Events](/contexts/process-path-management/domain-events):
  `ProcessPathCreated`, `ProcessPathUpdated`, `ProcessPathDeactivated` and
  `CPTScheduleChanged`, with their known consumers.
- [Domain Message Flow](/contexts/process-path-management/domain-message-flow)
  ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling)):
  key scenarios as commands, events and queries.
- [EventStorming](/contexts/process-path-management/eventstorming)
  ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)):
  process-level boards.
- [Class Diagram](/contexts/process-path-management/class-diagram): the
  domain model as it exists in the code.
- [Entity Relationship](/contexts/process-path-management/entity-relationship):
  the persisted tables.
- [Sequence Diagrams](/contexts/process-path-management/sequence-diagrams):
  the main runtime interactions.
- [Async API](/contexts/process-path-management/async-api): the Kafka
  integration in narrative form.

Every page above except the Business Context and the Async API narrative
is synced from the `process-path-management` repository.

## Elsewhere

- **Repository**: [github.com/IQVO/process-path-management](https://github.com/IQVO/process-path-management)
- [ADR index](/adr): links to this context's own decision records.
- Generated references on this site:
  [REST](/api-reference/rest/process-path-management/process-path-management-api)
  and [AsyncAPI](/api-reference/async/process-path-management).
