---
id: index
title: Customer Ordering
sidebar_label: Customer Ordering
description: "Customer Ordering, a Generic subdomain of the retail network: storefront checkout that promises every shipment group, the customer order record, and the only home of shopper and ship-to PII."
---

# Customer Ordering

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

<span className="badge-generic">Generic</span>

**Customer Ordering** (`customer-ordering`, code `CO`, tier `commerce`) turns
a shopper's cart into a customer order. At checkout it calls
`delivery-promise` synchronously to obtain one promise per shipment group,
then records the order with the shopper and the ship-to address. That
address is synthetic PII and is held only here. The context publishes
`CustomerOrderPlaced`, which carries the promise snapshot of every group, so
`order-sourcing` can queue the work from one event without correlating it with
the promise stream. Afterwards it follows fulfilment, promise and package
events into a customer-facing status and tracking view. It handles customer
cancellation only while no shipment group is locked. The same storefront API
is what the e2e-tests and a future storefront UI drive. `shipping-and-tracking`
is the only other context that ever reads the ship-to address: it calls the
restricted, in-organization route `GET /orders/{orderId}/ship-to` to print a
label.

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/network/contexts/customer-ordering/business-context) | The problem, actors, decisions, relation to the Amazon-like reality, out of scope | (narrative) |
| [Ubiquitous Language](/network/contexts/customer-ordering/ubiquitous-language) | Terms, code identifiers, terms not to confuse | [Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas) (UL section) |
| [Core Domain Chart](/network/contexts/customer-ordering/core-domain-chart) | Why this context is Generic | [Core Domain Charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/network/contexts/customer-ordering/bounded-context-canvas) | Purpose, classification, roles, inbound and outbound messages, decisions, metrics | [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/network/contexts/customer-ordering/context-map) | Every neighbour, direction and pattern | [Context Mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/network/contexts/customer-ordering/aggregate-design-canvas) | `CustomerOrder` and `Shopper`, states, invariants, commands | [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/network/contexts/customer-ordering/domain-events) | Published and consumed CloudEvents, with an example envelope | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) (message catalogue) |
| [Domain Message Flow](/network/contexts/customer-ordering/domain-message-flow) | Checkout, expired offer, fulfilment to delivery, cancellation | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/network/contexts/customer-ordering/eventstorming) | Process-level boards with hotspots | [EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/network/contexts/customer-ordering/use-cases) | One section per command: trigger, flow, errors, events, idempotency | (application layer, fleet convention) |
| [Class Diagram](/network/contexts/customer-ordering/class-diagram) | Proposed domain model and hexagonal ports and adapters | (UML, fleet convention) |
| [Entity Relationship](/network/contexts/customer-ordering/entity-relationship) | Proposed Postgres schema | (fleet convention) |
| [Sequence Diagrams](/network/contexts/customer-ordering/sequence-diagrams) | Adapter to Kafka for every command use case | (UML, fleet convention) |

## Elsewhere

- REST contract (proposed): `apis/customer-ordering/openapi.yaml`, rendered
  under the [API reference](/network/api-reference).
- [ADR 0006: PII confinement](/network/adr/0006-pii-confinement) explains why the
  ship-to address lives here and is read by `shipping-and-tracking` only.
- [ADR 0002: promise and assignment are separate](/network/adr/0002-promise-and-assignment-are-separate)
  explains why checkout talks to `delivery-promise` and never to
  `order-sourcing`.
- The network-wide [Context Map](/network/strategic-design/context-map) and
  [Subdomain Classification](/network/strategic-design/subdomain-classification).
