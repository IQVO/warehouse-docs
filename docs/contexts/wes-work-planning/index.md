---
id: index
title: WES Work Planning & Release
sidebar_label: WES Work Planning & Release
description: The conductor — waveless release and continuous flow balancing across process paths. The Core subdomain of the WES tier.
slug: /contexts/wes-work-planning
---

# WES Work Planning & Release

<span className="badge-core">Core Subdomain</span> · WES tier · **the conductor**

**wes-work-planning** turns a shift's **charge** (volume due by CPT) into a
committed **plan** (rate × heads per process path), then **releases work
continuously** — waveless, one unit at a time, earliest-CPT-first — and
performs **flow balancing** from live buffer telemetry so that every parcel
makes its truck without the floor ever being starved or flooded.

It sits downstream of three upstream event suppliers (`inventory-storage`,
`workforce-management`, `order-management`), conforms to two Generic
contexts (`process-path-management`'s catalogue and `facility-layout`'s
travel distances), closes a control loop with `fulfillment-execution`
(`WorkReleased` out, `TaskCompleted` back), and reports remaining path
capacity (`PathCapacityChanged`) to `order-management` and
`network-fulfillment`. Following
the industry WMS/WES/WCS framing this platform adopts: WMS says *what must
happen*, WCS says *how equipment performs it*, and this service — the WES
tier's core — decides **which activities happen when**. That is what
"conductor" means concretely, not a metaphor added for color.

:::note[What Core obliges here]
Because this context is classified Core, the platform accepts real cost for
it: a hand-written domain model with no ORM, invariants enforced in the
aggregate with a failing-path test for each, a release policy as a
first-class, replaceable domain-service object, executable architecture
fitness tests, and mutation testing on the domain packages. See
[Bounded Context Canvas](/contexts/wes-work-planning/bounded-context-canvas) for the full
justification.
:::

## This context's pages

- [Business Context](/contexts/wes-work-planning/business-context): why
  waveless, continuous release beats wave-based batching, and what flow
  balancing means operationally (Drum-Buffer-Rope with CPT as the drum).
- [Ubiquitous Language](/contexts/wes-work-planning/ubiquitous-language):
  Charge, CPT, Process Path, Work Pool, WorkUnit, ShiftPlan/PathPlan, and
  the traps where the same word means something different in another
  bounded context.
- [Core Domain Chart](/contexts/wes-work-planning/core-domain-chart)
  ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts)):
  why this context is Core.
- [Bounded Context Canvas](/contexts/wes-work-planning/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, strategic classification, domain roles, inbound and outbound
  communication, business decisions, assumptions, verification metrics and
  open questions.
- [Context Map](/contexts/wes-work-planning/context-map)
  ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)):
  every upstream and downstream relationship with its pattern, technology
  and status.
- [Aggregate Design Canvas](/contexts/wes-work-planning/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  the `WorkPool` aggregate, with its state, invariants, corrective
  policies, commands, events, throughput and size.
- [Domain Events](/contexts/wes-work-planning/domain-events): the eleven
  past-tense domain events, including the two that siblings consume today
  (`WorkReleased` and `PathCapacityChanged`), and the events this context
  consumes.
- [Domain Message Flow](/contexts/wes-work-planning/domain-message-flow)
  ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling)):
  key scenarios as commands, events and queries.
- [EventStorming](/contexts/wes-work-planning/eventstorming)
  ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)):
  process-level boards.
- [Class Diagram](/contexts/wes-work-planning/class-diagram): the domain
  model as it exists in the code.
- [Entity Relationship](/contexts/wes-work-planning/entity-relationship):
  the persisted tables.
- [Sequence Diagrams](/contexts/wes-work-planning/sequence-diagrams): the
  main runtime interactions.
- [Async API](/contexts/wes-work-planning/async-api): the Kafka integration
  in narrative form, covering the shared envelope, the topics published and
  consumed, and real payloads.

Every page above except the Business Context and the Async API narrative
is synced from the `wes-work-planning` repository.

## Elsewhere

- **Repository**: [github.com/IQVO/wes-work-planning](https://github.com/IQVO/wes-work-planning)
- [ADR index](/adr): links to this context's own decision records.
- Generated references on this site:
  [REST](/api-reference/rest/wes-work-planning/wes-work-planning-release)
  and [AsyncAPI](/api-reference/async/wes-work-planning).
