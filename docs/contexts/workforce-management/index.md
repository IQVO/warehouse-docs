---
id: index
title: Workforce Management
sidebar_label: Workforce Management
description: Certifies, assigns, and tracks labor against process-path capability requirements — a Supporting subdomain that stops deliberately at the path boundary.
slug: /contexts/workforce-management
---

# Workforce Management

<span className="badge-supporting">Supporting Subdomain</span>

**Workforce Management** makes the labor picture of a shift legible and
enforceable: it records who is on shift and what they are qualified for,
lets a human commit a split of headcount across process paths, tracks where
each person actually is as that split drifts, and surfaces the gap — without
ever deciding what any individual person should do next.

It owns three things: **who is on** (`AssociateShift`), **what the plan is**
(`ShiftPlan`), and **where people actually are** (`LaborAssignment`). It
stops deliberately at the **path boundary** — it never links an associate to
a specific task, by design (ADR-0002), leaving task dispatch entirely to
`fulfillment-execution`. Since ADR 0020, it also folds `labor-performance`'s
observed idle share into `GetStaffingGap` (`observedIdlePct`) and into
`ProposePathPlan`'s headcount trim — a staffing signal, never a second
source of truth about task dispatch. Its one synchronous dependency is a
fail-loud read of `fulfillment-execution`'s installed station capacity on
every `CommitShiftPlan` (ADR 0014) — a count, not tasks.

## This context's pages

- [Business Context](/contexts/workforce-management/business-context): the
  domain vision, the two planning horizons, and why stopping at the path
  boundary is a deliberate scope limit rather than a gap.
- [Ubiquitous Language](/contexts/workforce-management/ubiquitous-language):
  `ShiftPlan`, `PathPlan`, `AssociateShift`, `LaborAssignment`,
  `Certification`, `PathUnderstaffed`, `Process path` and more, with the
  definitions the code implements.
- [Core Domain Chart](/contexts/workforce-management/core-domain-chart)
  ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts)):
  why this context is Supporting.
- [Bounded Context Canvas](/contexts/workforce-management/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, strategic classification, roles, inbound and outbound
  communication, business decisions, assumptions and open questions.
- [Context Map](/contexts/workforce-management/context-map)
  ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)):
  every upstream and downstream relationship with its pattern, technology
  and status.
- [Aggregate Design Canvas](/contexts/workforce-management/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  the `ShiftPlan` and `LaborAssignment` aggregates, with their state
  transitions, invariants, corrective policies, commands and events.
- [Domain Events](/contexts/workforce-management/domain-events): all ten
  events and what raises them. Only one, `ShiftPlanCommitted`, reaches
  other contexts (`wes-work-planning` and `warehouse-planning`), published
  as one message per `PathPlan` line.
- [Domain Message Flow](/contexts/workforce-management/domain-message-flow)
  ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling)):
  key scenarios as commands, events and queries.
- [EventStorming](/contexts/workforce-management/eventstorming)
  ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)):
  process-level boards.
- [Class Diagram](/contexts/workforce-management/class-diagram): the domain
  model as it exists in the code.
- [Entity Relationship](/contexts/workforce-management/entity-relationship):
  the persisted tables.
- [Sequence Diagrams](/contexts/workforce-management/sequence-diagrams):
  the main runtime interactions.
- [Async API](/contexts/workforce-management/async-api): the Kafka
  integration in narrative form. It covers `ShiftPlanCommitted` to
  `wes-work-planning` and `warehouse-planning`, and the two opt-in sibling
  topics it consumes (`process-path-management` and `labor-performance`).

Every page above except the Business Context and the Async API narrative
is synced from the `workforce-management` repository.

## Elsewhere

- **Repository**: [github.com/IQVO/workforce-management](https://github.com/IQVO/workforce-management)
- [ADR index](/adr): links to this context's own decision records.
- Generated references on this site:
  [REST](/api-reference/rest/workforce-management/workforce-management-api)
  and [AsyncAPI](/api-reference/async/workforce-management).
