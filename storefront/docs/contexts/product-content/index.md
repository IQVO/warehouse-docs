---
id: index
title: Product Content
sidebar_label: Product Content
description: "Product Content, a Generic subdomain of the digital storefront: the description, bullets, attributes, media and category tree of an item the network already knows."
---

# Product Content

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-content` service is built on develop ([`IQVO/product-content`](https://github.com/IQVO/product-content) at `2f09dc0`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-content#service-and-operations) section lists it.
:::

<span className="badge-generic">Generic</span>

**Product Content** (`product-content`, code `PC`, tier `storefront`)
enriches the network's catalogue item with everything a product page needs
and the item master does not have: description, bullets, attributes, media
and the category tree. The title stays the item master's
(`offer-availability`); only `catalogItemId` crosses the boundary, and
content never redefines the item itself. Media upload is out of scope: media
are URLs to static assets. Content publishes only when complete — a
description, exactly one PRIMARY medium and a category — and a retired
content never publishes again. The category tree is a single, versioned
aggregate, at most four levels deep, browsed by shoppers through
`product-discovery`, the one consumer of every event this context
publishes.

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/storefront/contexts/product-content/business-context) | The problem, actors, decisions, why a PIM is a buy, out of scope | (narrative) |
| [Ubiquitous Language](/storefront/contexts/product-content/ubiquitous-language) | Terms, code identifiers, terms not to confuse | [Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas) (UL section) |
| [Core Domain Chart](/storefront/contexts/product-content/core-domain-chart) | Why this context is Generic | [Core Domain Charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/storefront/contexts/product-content/bounded-context-canvas) | Purpose, classification, roles, inbound and outbound messages, decisions, metrics | [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/storefront/contexts/product-content/context-map) | Every neighbour, direction and pattern | [Context Mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/storefront/contexts/product-content/aggregate-design-canvas) | `ProductContent` and `CategoryTree`, states, invariants, commands | [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/storefront/contexts/product-content/domain-events) | Published and consumed CloudEvents, with an example envelope | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) (message catalogue) |
| [Domain Message Flow](/storefront/contexts/product-content/domain-message-flow) | Authoring to publish, revision, tree publication, retire on discontinue | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/storefront/contexts/product-content/eventstorming) | Process-level boards with hotspots | [EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/storefront/contexts/product-content/use-cases) | One section per command: trigger, flow, errors, events, idempotency | (application layer, fleet convention) |
| [Class Diagram](/storefront/contexts/product-content/class-diagram) | Proposed domain model and hexagonal ports and adapters | (UML, fleet convention) |
| [Entity Relationship](/storefront/contexts/product-content/entity-relationship) | Proposed Postgres schema | (fleet convention) |
| [Sequence Diagrams](/storefront/contexts/product-content/sequence-diagrams) | Adapter to Kafka for every command use case | (UML, fleet convention) |

## Elsewhere

- REST contract (proposed): `storefront/apis/product-content/openapi.yaml`,
  rendered under the [API reference](/storefront/api-reference).
- The storefront-wide [Context Map](/storefront/strategic-design/context-map),
  [Subdomain Classification](/storefront/strategic-design/subdomain-classification),
  [Ubiquitous Language](/storefront/strategic-design/ubiquitous-language) and
  [Event Standard](/storefront/strategic-design/event-standard-cloudevents)
  (generated from the model).
- The upstream network context [offer-availability](/network/contexts/offer-availability),
  which owns the item master this context enriches, and the storefront's
  read side `product-discovery` (pack pending; its model entry drives the
  consumer tables here).
