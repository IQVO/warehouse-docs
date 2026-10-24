---
id: index
title: Order Sourcing
sidebar_label: Order Sourcing
description: "Order Sourcing, a Core subdomain of the retail network: decides, as late as the promise allows, which vendor node and path fulfil each shipment group, and locks that choice once the node accepts the purchase order."
---

# Order Sourcing

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

<span className="badge-core">Core</span>

**Order Sourcing** (`order-sourcing`, code `OS`, CloudEvents tier `commerce`)
decides, as late as the promise allows, which node and path will actually
fulfil each shipment group of a customer order. It owns one aggregate,
**FulfillmentAssignment**. Assignments wait in a **virtual queue** where they
are re-optimised against current capacity and cost until their release point.
At release the group is sent to one vendor node, which for a vendor node means
a purchase order issued through `vendor-connectivity`. A rejection or an
expiry moves the group to another node. The node's acceptance **locks** the
assignment for good. When no node can still meet the promise's
`deliverByLatest`, the group becomes **UNSOURCEABLE** and goes back to
`delivery-promise` for a re-promise. Sourcing never breaks a promise silently.

:::info[What this pack describes]
- **Inbound:** nine Kafka topics of sibling contexts (orders, promises,
  purchase-order outcomes, delivery, topology, availability, departures,
  waves, scorecards) and a small REST surface for the network-ops planner
  (`GET /assignments`, `GET /assignments/{assignmentId}`,
  `POST /assignments/{assignmentId}:reoptimise`).
- **Outbound:** eight CloudEvents types
  (`com.retailnetwork.commerce.order-sourcing.assignment.*`) on
  `retailnetwork.order-sourcing.events`. No synchronous call to any other
  context (`sync_calls: []`).
- **Not here:** the promise itself ([Delivery Promise](/contexts/delivery-promise/bounded-context-canvas)),
  the purchase-order protocol and its clock
  ([Vendor Connectivity](/contexts/vendor-connectivity/bounded-context-canvas)),
  and picking and packing, which the vendor does in its own building.
:::

## This context's pages

| Page | What it covers | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/contexts/order-sourcing/business-context) | The sourcing problem in plain language, actors, decisions, the Amazon-like reality, scope | — (narrative) |
| [Ubiquitous Language](/contexts/order-sourcing/ubiquitous-language) | Every term of this context and the neighbour terms it uses | glossary, from the [DDD Starter Modelling Process](https://github.com/ddd-crew/ddd-starter-modelling-process) (Define step) |
| [Core Domain Chart](/contexts/order-sourcing/core-domain-chart) | Why this context is Core | [core-domain-charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/contexts/order-sourcing/bounded-context-canvas) | Purpose, classification, roles, every inbound and outbound message, decisions, open questions | [bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas) v5 |
| [Context Map](/contexts/order-sourcing/context-map) | Every upstream and downstream neighbour with its pattern and channel | [context-mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/contexts/order-sourcing/aggregate-design-canvas) | `FulfillmentAssignment`: states, invariants, policies, commands, events, read models | [aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas) v1.1 |
| [Domain Events](/contexts/order-sourcing/domain-events) | The 8 published events with data fields and consumers; the 29 consumed events | — (CloudEvents catalogue) |
| [Domain Message Flow](/contexts/order-sourcing/domain-message-flow) | Happy path, refusal and re-promise, cancellation, across contexts | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/contexts/order-sourcing/eventstorming) | Process-level boards with hotspots | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/contexts/order-sourcing/use-cases) | One section per command: trigger, adapter, flow, errors, events, idempotency | — (application layer) |
| [Class Diagram](/contexts/order-sourcing/class-diagram) | Proposed domain classes and the hexagonal ports and adapters | — (UML) |
| [Entity Relationship](/contexts/order-sourcing/entity-relationship) | Proposed Postgres schema, read-model and infrastructure tables | — (UML / ER) |
| [Sequence Diagrams](/contexts/order-sourcing/sequence-diagrams) | One runtime sequence per command use case, with outbox and version checks | — (UML) |

The REST contract is `apis/order-sourcing/openapi.yaml` (proposed, OpenAPI
3.0.3), rendered under the [API reference](/api-reference).

## Elsewhere

- [Order assignment model](/network-model/order-assignment-model): the
  network-level worked example of queue, release, refusal and lock. This pack
  links to it rather than repeating it.
- [ADR 0002: promise and assignment are separate](/adr/0002-promise-and-assignment-are-separate)
  and [ADR 0005: vendor acceptance is the path lock](/adr/0005-vendor-acceptance-is-the-path-lock).
- [Strategic context map](/strategic-design/context-map) and
  [subdomain classification](/strategic-design/subdomain-classification).
- [Event standard (CloudEvents)](/strategic-design/event-standard-cloudevents).
