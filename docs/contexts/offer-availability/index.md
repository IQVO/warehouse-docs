---
id: index
title: Offer & Availability
sidebar_label: Offer & Availability
description: "The proposed Offer & Availability context: a Supporting subdomain that owns the catalogue item, one listing per (catalogue item, node) and the vendor-declared available quantity with its basis."
---

# Offer & Availability

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

<span className="badge-supporting">Supporting</span>

**Offer & Availability** (`offer-availability`, code `OA`, tier `commerce`)
knows what the network can sell and from which node. It owns the network's
own item master (**CatalogItem**), one **Listing** per (catalogue item,
node), and the quantity each node currently claims it can ship for that
listing, together with the **basis** the vendor gave for that number:
`PHYSICAL`, `THROUGHPUT_CONSTRAINED` or `UNKNOWN`. Vendors send that number
as **inventory feeds**, full or partial; a feed arrives through
`vendor-connectivity`'s in-organization call `POST /inventory-feeds` and is
applied here atomically (**InventoryFeed**). A listing is sellable only
while its node is `ACTIVE` in `node-topology`. The context publishes seven
CloudEvents types on `retailnetwork.offer-availability.events`;
`delivery-promise` and `order-sourcing` build their availability read
models from them.

## This context's pages

| Page | What it covers | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/contexts/offer-availability/business-context) | The business problem, actors, decisions, and what is out of scope | — (plain-language context) |
| [Ubiquitous Language](/contexts/offer-availability/ubiquitous-language) | Catalog Item, Listing, Available Quantity, Availability Basis, Inventory Feed, Full Feed, plus neighbour terms | [Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas) (Ubiquitous Language section) |
| [Core Domain Chart](/contexts/offer-availability/core-domain-chart) | Why this context is Supporting | [Core Domain Charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/contexts/offer-availability/bounded-context-canvas) | Purpose, classification, roles, inbound and outbound messages, decisions, open questions | [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/contexts/offer-availability/context-map) | Every upstream and downstream neighbour with pattern and channel | [Context Mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/contexts/offer-availability/aggregate-design-canvas) | `CatalogItem`, `Listing`, `InventoryFeed`: states, invariants, commands, events | [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/contexts/offer-availability/domain-events) | The seven published and four consumed events, with full CloudEvents types | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) (message catalogue) |
| [Domain Message Flow](/contexts/offer-availability/domain-message-flow) | Feed applied, feed failed, node suspended, catalogue set-up | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/contexts/offer-availability/eventstorming) | Process-level boards and the hotspots the model leaves open | [EventStorming Glossary & Cheat Sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/contexts/offer-availability/use-cases) | One section per command: trigger, adapter, flow, errors, events, idempotency | — (application-service catalogue) |
| [Class Diagram](/contexts/offer-availability/class-diagram) | Proposed domain types and the hexagonal ports and adapters | — (UML) |
| [Entity Relationship](/contexts/offer-availability/entity-relationship) | Proposed Postgres schema | — (UML / ER) |
| [Sequence Diagrams](/contexts/offer-availability/sequence-diagrams) | Adapter to use case to aggregate to outbox, per command | — (UML) |

## Elsewhere

- REST contract (as built, from the service repository): `apis/offer-availability/openapi.yaml`, rendered
  under the [API reference](/api-reference).
- The domain-wide [Context Map](/strategic-design/context-map) and
  [Subdomain Classification](/strategic-design/subdomain-classification).
- [ADR 0003: declared and measured capability](/adr/0003-declared-and-measured-capability):
  the declared availability basis this context keeps is one half of it.
- [ADR 0007: CloudEvents namespace](/adr/0007-cloudevents-namespace) and the
  [event standard](/strategic-design/event-standard-cloudevents).
