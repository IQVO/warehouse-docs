---
id: index
title: Slotting Optimization
sidebar_label: Slotting Optimization
description: The Supporting, WMS-tier bounded context that decides which SKUs deserve a forward pick slot, and which slot each one gets, by pick velocity, with human approval.
slug: /contexts/slotting-optimization
---

# Slotting Optimization

<span className="badge-supporting">Supporting Subdomain</span>

**Slotting Optimization** is one of the fleet's fourteen domain bounded
contexts. It sits in the `wms` tier of the CloudEvents subdomain taxonomy, the
fifth `wms` context after `facility-layout`, `inventory-storage`,
`product-master` and `inbound-receiving`. It decides **which SKUs deserve a
forward pick slot, and which slot each one gets**. It computes a reviewable
proposal (a *slot plan*), a human approves or rejects it, and an approved plan
is published as a CloudEvent carrying the full forward assignment map and the
physical moves it implies.

:::info[What is built, what is not deployed, and what is planned]
Per this context's own [Context Map](/contexts/slotting-optimization/context-map)
and [integration page](https://iqvo.github.io/slotting-optimization/docs/ecosystem/integration),
checked against `develop`:

**Built on `develop`:** one binary, `cmd/api`: the REST API (seven
operations), the transactional outbox and relay, and three opt-in local-copy
consumers (demand from `order-management`, product facts from
`product-master`, zones and slots from `facility-layout`).

**Not deployed:** there is no `Dockerfile`, no `charts/` directory and no
`warehouse-infra` wiring (values file, Kong route, ArgoCD application) yet.
The service runs from source or a locally built binary.

**Planned, not built:** executing the moves of an approved plan (MOVE and
REPLENISH work through `process-path-management`, `wes-work-planning` and
`fulfillment-execution`), a read-only MCP server (no `cmd/mcp`), an
analytics read side and a console remote. Nothing consumes its events today.
:::

It owns one aggregate, **`SlotPlan`** (package `internal/domain/slotplan`),
generated as a `Draft` by the `abc-velocity-v1` policy (package
`internal/domain/planning`) and moved to `Approved` or `Rejected` by a human.
Approving a plan supersedes the site's previous Approved plan in the same
transaction (`Superseded` is the fourth state).

## This context's pages

- [Business Context](/contexts/slotting-optimization/business-context): the
  gap, what it owns, the v1 policy, the decisions taken, and what the context
  deliberately does not do.
- [Ubiquitous Language](/contexts/slotting-optimization/ubiquitous-language):
  slot plan, forward slot, assignment, move, velocity, demand window,
  stickiness, local copy.
- [Core Domain Chart](/contexts/slotting-optimization/core-domain-chart):
  Supporting, and why.
- [Bounded Context Canvas](/contexts/slotting-optimization/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, classification, roles, inbound and outbound communication,
  business decisions and open questions.
- [Context Map](/contexts/slotting-optimization/context-map): every edge with
  its pattern, technology and state, planned edges labelled.
- [Aggregate Design Canvas](/contexts/slotting-optimization/aggregate-design-canvas):
  `SlotPlan`.
- [Domain Events](/contexts/slotting-optimization/domain-events): the three
  published events and the seven consumed ones.
- [Domain Message Flow](/contexts/slotting-optimization/domain-message-flow),
  [EventStorming](/contexts/slotting-optimization/eventstorming),
  [Class Diagram](/contexts/slotting-optimization/class-diagram),
  [Entity Relationship](/contexts/slotting-optimization/entity-relationship),
  [Sequence Diagrams](/contexts/slotting-optimization/sequence-diagrams) and
  [Use Cases](/contexts/slotting-optimization/use-cases).
- [Async API](/contexts/slotting-optimization/async-api): the Kafka narrative.
- Generated references: [REST](/api-reference/rest/slotting-optimization/slotting-optimization-api)
  and [AsyncAPI](/api-reference/async/slotting-optimization).

## Elsewhere

- **Repository**: [github.com/IQVO/slotting-optimization](https://github.com/IQVO/slotting-optimization),
  with its own docs site at
  [iqvo.github.io/slotting-optimization](https://iqvo.github.io/slotting-optimization/).
  Its ADRs live under `docs/adr/`, all Accepted (2026-10-08): 0001 (bounded
  context), 0002 (the `SlotPlan` aggregate, its invariants and the
  `abc-velocity-v1` policy), 0003 (event-fed local copies and the consumed
  contracts), 0004 (CloudEvents envelope and type catalogue).
- **Fleet-level**: [Context Map](/strategic-design/context-map) (K25 to K27
  and K29), the [Event Standard](/strategic-design/event-standard-cloudevents)
  (subdomain table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [Ubiquitous Language](/strategic-design/ubiquitous-language).
