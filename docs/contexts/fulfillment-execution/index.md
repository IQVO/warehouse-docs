---
id: index
title: Fulfillment Execution
sidebar_label: Fulfillment Execution
description: The Pick/Pack/SLAM task lifecycle — pull-based claimNext dispatch, lease-based at-most-once claiming — a Core subdomain in the WES tier.
slug: /contexts/fulfillment-execution
---

# Fulfillment Execution

<span className="badge-core">Core Subdomain</span>

**Fulfillment Execution** turns released work into completed physical
operations: the **task lifecycle** for Pick, Pack, Rebin, and SLAM. It sits
in the WES tier, downstream of `wes-work-planning` (which decides *how much*
work should be released and *when*) and answers a narrower, harder question —
*how does a released unit of work safely get from the pool into a completed
state, without ever being lost?*

The defining design rule is **pull, not push**: a station claims the next
task (`claimNext(stationId, capabilities)`); the system selects work, not
workers. There is deliberately no `assign(task, station)` operation. A claim
is a time-boxed **lease** — if it is not renewed or completed before expiry,
the task returns to the pool rather than vanishing. This context has the
longest ADR trail in the fleet: thirty-five decisions (0001 to 0035) on
`develop`, including the pull-dispatch rule itself, the lease mechanism,
per-package DOT hazard segregation, a structural (unimplemented)
anti-corruption seam reserved for the WCS/equipment tier this platform
deliberately does not build, and — most recently — a CPT-missed sweep,
`PackageManifested`, and an on-time-to-CPT KPI that feed order-management's
promise loop.

## This context's pages

- [Business Context](/contexts/fulfillment-execution/business-context): why
  pull-based `claimNext` dispatch beats push assignment, and the task
  lifecycle in business language.
- [Ubiquitous Language](/contexts/fulfillment-execution/ubiquitous-language):
  Task, `claimNext`, Lease, Station, Fragile, Gift wrap and the rest of this
  context's exact vocabulary.
- [Core Domain Chart](/contexts/fulfillment-execution/core-domain-chart)
  ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts)):
  why this context is Core.
- [Bounded Context Canvas](/contexts/fulfillment-execution/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, strategic classification, roles, inbound and outbound
  communication, business decisions and open questions.
- [Context Map](/contexts/fulfillment-execution/context-map)
  ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)):
  every upstream and downstream relationship with its pattern, technology
  and status.
- [Aggregate Design Canvas](/contexts/fulfillment-execution/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  the `Task` aggregate, with its state transitions, invariants, corrective
  policies, commands and events.
- [Domain Events](/contexts/fulfillment-execution/domain-events): the
  thirteen past-tense domain events. Three of them (`TaskCompleted`,
  `TaskCPTMissed` and `PackageManifested`) form the integration contract on
  `warehouse.fulfillment.events`, ten go to the analytics topic, and two
  Rebin events never leave the process.
- [Domain Message Flow](/contexts/fulfillment-execution/domain-message-flow)
  ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling)):
  key scenarios as commands, events and queries.
- [EventStorming](/contexts/fulfillment-execution/eventstorming)
  ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)):
  process-level boards.
- [Class Diagram](/contexts/fulfillment-execution/class-diagram): the
  domain model as it exists in the code.
- [Entity Relationship](/contexts/fulfillment-execution/entity-relationship):
  the persisted tables.
- [Sequence Diagrams](/contexts/fulfillment-execution/sequence-diagrams):
  the main runtime interactions.
- [Async API](/contexts/fulfillment-execution/async-api): the Kafka
  integration in narrative form, including the shared fan-out topic that
  three downstream consumers (`wes-work-planning`, `labor-performance` and
  `order-management`) read.

Every page above except the Business Context and the Async API narrative
is synced from the `fulfillment-execution` repository.

## Elsewhere

- **Repository**: [github.com/IQVO/fulfillment-execution](https://github.com/IQVO/fulfillment-execution),
  with its full ADR trail under `docs/docs/adr/`.
- [ADR index](/adr): links to this context's own decision records.
- [REST API Reference](/api-reference/rest/fulfillment-execution/fulfillment-execution-api)
  and [AsyncAPI Reference](/api-reference/async/fulfillment-execution),
  generated from the real `apis/openapi.yaml` and `apis/asyncapi.yaml`.
