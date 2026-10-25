---
id: index
title: Shopping Cart
sidebar_label: Shopping Cart
description: "Shopping Cart, the Supporting subdomain of the digital storefront that holds a shopper's intent: one line per item, the destination postal prefix, the delivery quote with an offer per shipment group, the shopper's tier selection, and the labelled, non-binding estimate."
---

# Shopping Cart

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

<span className="badge-supporting">Supporting</span>

**Shopping Cart** (`shopping-cart`, code `SC`, tier `storefront`) holds a
shopper's intent: cart lines (one per item, quantities merged),
the destination postal prefix, the delivery quote
[delivery-promise](/network/contexts/delivery-promise) returned for the cart
(one group per shipment, with its offers and their expiry, plus the tiers
that were unavailable), the shopper's tier selection per group, and a
labelled, non-binding estimate (effective prices plus selected tier charges
plus tax band) so the total cost is visible up front. The cart is
guest-first: `shopperId` is optional (decision D4), and a signed-in
shopper's carts can be merged. Every line or destination change clears the
quote and the selections; the binding total is the
[checkout](/storefront/contexts) session's `PriceQuote`, never the estimate
(gap S2). [pricing](/storefront/contexts/pricing) owns the prices, charges
and tax bands the estimate is computed from; the cart never calls pricing
synchronously — it follows its events.

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/storefront/contexts/shopping-cart/business-context) | The problem, actors, decisions, relation to real storefronts, out of scope | (narrative) |
| [Ubiquitous Language](/storefront/contexts/shopping-cart/ubiquitous-language) | Terms, code identifiers, terms not to confuse | [Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas) (UL section) |
| [Core Domain Chart](/storefront/contexts/shopping-cart/core-domain-chart) | Why this context is Supporting | [Core Domain Charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/storefront/contexts/shopping-cart/bounded-context-canvas) | Purpose, classification, roles, inbound and outbound messages, decisions, metrics | [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/storefront/contexts/shopping-cart/context-map) | Every neighbour, direction and pattern | [Context Mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/storefront/contexts/shopping-cart/aggregate-design-canvas) | `Cart`: states, invariants, commands | [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/storefront/contexts/shopping-cart/domain-events) | Published and consumed CloudEvents, with an example envelope | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) (message catalogue) |
| [Domain Message Flow](/storefront/contexts/shopping-cart/domain-message-flow) | Cart building, quoting and selecting delivery, price changes landing, checkout | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/storefront/contexts/shopping-cart/eventstorming) | Process-level boards with hotspots | [EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/storefront/contexts/shopping-cart/use-cases) | One section per command: trigger, flow, errors, events, idempotency | (application layer, fleet convention) |
| [Class Diagram](/storefront/contexts/shopping-cart/class-diagram) | Proposed domain model and hexagonal ports and adapters | (UML, fleet convention) |
| [Entity Relationship](/storefront/contexts/shopping-cart/entity-relationship) | Proposed Postgres schema | (fleet convention) |
| [Sequence Diagrams](/storefront/contexts/shopping-cart/sequence-diagrams) | Adapter to Kafka for every command use case | (UML, fleet convention) |

## Elsewhere

- REST contract (proposed): `storefront/apis/shopping-cart/openapi.yaml`,
  rendered under the [API reference](/storefront/api-reference).
- The storefront-wide [Context Map](/storefront/strategic-design/context-map),
  [Subdomain Classification](/storefront/strategic-design/subdomain-classification)
  and [Ubiquitous Language](/storefront/strategic-design/ubiquitous-language).
- The [Model Gap Register](/storefront/strategic-design/model-gap-register)
  tracks gap S1 (who maps quote groups to checkout lines: the cart's
  one-line-per-item rule and the quote's groups) and gap S2 (price change
  between cart and checkout: the estimate is labelled non-binding, the
  binding total is the checkout session's `PriceQuote`).
- [delivery-promise](/network/contexts/delivery-promise) owns the offers the
  cart quotes and holds — a quote holds no capacity;
  [offer-availability](/network/contexts/offer-availability) and
  [pricing](/storefront/contexts/pricing) feed the cart's purchasability and
  estimate views; [checkout](/storefront/contexts) reads the cart at session
  open and closes it on `CheckoutCompleted`.
