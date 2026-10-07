---
id: index
title: Bounded Contexts
sidebar_label: Bounded Contexts
description: The twelve bounded contexts, each with its ddd-crew artifact set — business context, ubiquitous language, core domain chart, canvases, context map, domain events, message flows, EventStorming and code-level diagrams.
slug: /contexts
---

# Bounded Contexts

Every bounded context below has the same page set, in this order, except
`product-master`, which is new and so far has only the Business Context and
the Bounded Context Canvas. The
ddd-crew tool behind each page, or the page's source if no ddd-crew tool
applies, is given in brackets:

1. **Business Context**: the domain vision and the problem this context
   solves, in business language. (Hand-written for this site.)
2. **Ubiquitous Language**: the exact vocabulary the context uses, taken
   from its domain code. (Context repository.)
3. **Core Domain Chart**: where the context sits on the
   differentiation/complexity chart, with the evidence for that position.
   ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts))
4. **Bounded Context Canvas**: name, purpose, strategic classification,
   domain roles, inbound and outbound communication, business decisions,
   assumptions, verification metrics and open questions.
   ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas))
5. **Context Map**: this context's upstream and downstream relationships,
   each with its pattern, technology and status.
   ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping))
6. **Aggregate Design Canvas**: the context's aggregate(s), with state
   transitions, invariants, corrective policies, commands, events,
   throughput and size.
   ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas))
7. **Domain Events**: every event the context publishes and consumes, with
   its full CloudEvents `type`, topic, partition key, payload and known
   consumers. (Context repository.)
8. **Domain Message Flow**: the context's key scenarios as commands,
   events and queries crossing its boundary.
   ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling))
9. **EventStorming**: process-level boards in EventStorming notation.
   ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet))
10. **Class Diagram**: the domain model as it exists in the code. (Context
    repository, Mermaid.)
11. **Entity Relationship**: the persisted tables and how they map to the
    aggregates. (Context repository, Mermaid.)
12. **Sequence Diagrams**: the main runtime interactions. (Context
    repository, Mermaid.)
13. **Async API**: the Kafka integration in narrative form, with a link to
    the generated AsyncAPI reference. This page exists only for
    `inventory-storage`, `wes-work-planning`, `fulfillment-execution`,
    `workforce-management`, `process-path-management`,
    `labor-performance`, `network-fulfillment` and `warehouse-planning`.
    (Hand-written for this site.)

:::info[Synced pages]
Pages 2 to 12 are **copies** synced from each context repository's
`develop` branch. Each one carries a "Synced from" note and is derived from
that repository's code. To correct one, edit it in the owning repository
and re-sync. Do not edit the copy here. Only the Business Context, the
overview (index) page and the Async API narrative are written for this
site.
:::

| Context | Classification | CloudEvents subdomain | Tier |
| --- | --- | --- | --- |
| [order-management](/contexts/order-management) | Generic/Supporting | `wes` | Upstream front door |
| [inventory-storage](/contexts/inventory-storage) | Core | `wms` | WMS |
| [wes-work-planning](/contexts/wes-work-planning) | Core | `wes` | WES — the conductor |
| [fulfillment-execution](/contexts/fulfillment-execution) | Core | `wes` | WES |
| [workforce-management](/contexts/workforce-management) | Supporting | `wes` | WES |
| [facility-layout](/contexts/facility-layout) | Generic | `wms` | WMS-adjacent, extracted |
| [process-path-management](/contexts/process-path-management) | Generic | `wes` | Extracted catalogue |
| [labor-performance](/contexts/labor-performance) | Supporting | `wes` | Downstream observer |
| [warehouse-ops-agent](/contexts/warehouse-ops-agent) | Supporting | `wes` | Operator tooling, no aggregate |
| [network-fulfillment](/contexts/network-fulfillment) | Supporting | `wes` | External network edge (anti-corruption layer) |
| [warehouse-planning](/contexts/warehouse-planning) | Core | `wes` | WES — capacity planning |
| [product-master](/contexts/product-master) | Supporting | `wms` | WMS — product master data (decided 2026-10-06, being built; Business Context and Bounded Context Canvas only so far) |

See [Strategic Design](/strategic-design) for how these twelve relate to
each other at the fleet level, and the
[DDD Starter Modelling Process](/strategic-design/ddd-starter-modelling-process)
for which modelling step each page belongs to.
