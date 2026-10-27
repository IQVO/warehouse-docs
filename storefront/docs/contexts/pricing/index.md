---
id: index
title: Pricing
sidebar_label: Pricing
description: "Pricing, the Core subdomain of the digital storefront: list prices and sale windows per catalogue item, the delivery charge per service tier, a synthetic tax table, and the binding, expiring PriceQuote a checkout session is confirmed against."
---

# Pricing

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `pricing` service is built on develop ([`IQVO/pricing`](https://github.com/IQVO/pricing) at `5a18326`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/pricing#service-and-operations) section lists it.
:::

<span className="badge-core">Core</span>

**Pricing** (`pricing`, code `PR`, tier `storefront`) owns what a shopper
pays: the list price and sale windows per catalogue item (`ItemPrice`), the
delivery charge per service tier (`DeliveryChargeSchedule`), a synthetic tax
table (`TaxTable`), and the binding, immutable, expiring `PriceQuote` a
[checkout](/storefront/contexts) session is confirmed against. One configured
currency, integer minor units. The item master stays in the network's
[offer-availability](/network/contexts/offer-availability) context; pricing
only references `catalogItemId`, kept current through
`CatalogItemCreated`/`CatalogItemDiscontinued` events. Promotions are a later
phase (decision D10).

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/storefront/contexts/pricing/business-context) | The problem, actors, decisions, relation to real storefronts, out of scope | (narrative) |
| [Ubiquitous Language](/storefront/contexts/pricing/ubiquitous-language) | Terms, code identifiers, terms not to confuse | [Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas) (UL section) |
| [Core Domain Chart](/storefront/contexts/pricing/core-domain-chart) | Why this context is Core | [Core Domain Charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/storefront/contexts/pricing/bounded-context-canvas) | Purpose, classification, roles, inbound and outbound messages, decisions, metrics | [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/storefront/contexts/pricing/context-map) | Every neighbour, direction and pattern | [Context Mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/storefront/contexts/pricing/aggregate-design-canvas) | `ItemPrice`, `DeliveryChargeSchedule`, `TaxTable`, `PriceQuote`: states, invariants, commands | [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/storefront/contexts/pricing/domain-events) | Published and consumed CloudEvents, with an example envelope | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) (message catalogue) |
| [Domain Message Flow](/storefront/contexts/pricing/domain-message-flow) | Price management, sale boundaries, quote issuing, discontinuation | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/storefront/contexts/pricing/eventstorming) | Process-level boards with hotspots | [EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/storefront/contexts/pricing/use-cases) | One section per command: trigger, flow, errors, events, idempotency | (application layer, fleet convention) |
| [Class Diagram](/storefront/contexts/pricing/class-diagram) | Proposed domain model and hexagonal ports and adapters | (UML, fleet convention) |
| [Entity Relationship](/storefront/contexts/pricing/entity-relationship) | Proposed Postgres schema | (fleet convention) |
| [Sequence Diagrams](/storefront/contexts/pricing/sequence-diagrams) | Adapter to Kafka for every command use case | (UML, fleet convention) |

## Elsewhere

- REST contract (proposed): `storefront/apis/pricing/openapi.yaml`, rendered
  under the [API reference](/storefront/api-reference).
- The storefront-wide [Context Map](/storefront/strategic-design/context-map),
  [Subdomain Classification](/storefront/strategic-design/subdomain-classification)
  and [Ubiquitous Language](/storefront/strategic-design/ubiquitous-language).
- The [Model Gap Register](/storefront/strategic-design/model-gap-register)
  tracks gap S2 (price change between cart and checkout), which the binding
  `PriceQuote` answers.
- [offer-availability](/network/contexts/offer-availability) owns the
  catalogue item this context prices; [delivery-promise](/network/contexts/delivery-promise)
  owns the service tiers a `TierCharge` names.
