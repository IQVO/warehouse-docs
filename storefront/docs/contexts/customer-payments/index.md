---
id: index
title: Customer Payments
sidebar_label: Customer Payments
description: "Customer Payments, the Generic subdomain of the digital storefront that moves money with the shipment facts: authorize at checkout, capture each shipment group when it ships, release on cancellation, refund on lost or returned packages, behind an Anti-Corruption Layer port to the payment provider."
---

# Customer Payments

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `customer-payments` service is built on develop ([`IQVO/customer-payments`](https://github.com/IQVO/customer-payments) at `530c7cb`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/customer-payments#service-and-operations) section lists it.
:::

<span className="badge-generic">Generic</span>

**Customer Payments** (`customer-payments`, code `CP`, tier `storefront`)
moves money with the shipment facts. [checkout](/storefront/contexts) asks it
for one `PaymentAuthorization` per checkout session, split into allocations
(one per shipment group). From then on the money follows the network's
facts, not storefront commands: a shipped group is **captured**
(`CaptureOnShipment`), a cancelled group is **released**
(`ReleaseOnCancellation`), a lost or returned package is **refunded**
(`RefundOnLostPackage`, `RefundOnReturnToSender`), and uncaptured allocations
are **re-authorized** before the provider's authorization validity runs out
(`ReauthorizeBeforeExpiry`). Because the shipment facts can arrive before the
order is bound to its authorization, they are **parked** and applied on
`CheckoutCompleted` (gap S4). The context speaks to the payment provider
only through an Anti-Corruption Layer port (Authorize, Capture, Void, Refund,
Reauthorize); the payment-provider simulator is the stand-in adapter. It never
sees a card number, only PSP tokens.

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/storefront/contexts/customer-payments/business-context) | The problem, actors, decisions, relation to real storefronts, out of scope | (narrative) |
| [Ubiquitous Language](/storefront/contexts/customer-payments/ubiquitous-language) | Terms, code identifiers, terms not to confuse | [Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas) (UL section) |
| [Core Domain Chart](/storefront/contexts/customer-payments/core-domain-chart) | Why this context is Generic | [Core Domain Charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/storefront/contexts/customer-payments/bounded-context-canvas) | Purpose, classification, roles, inbound and outbound messages, decisions, metrics | [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/storefront/contexts/customer-payments/context-map) | Every neighbour, direction and pattern, including the provider ACL | [Context Mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/storefront/contexts/customer-payments/aggregate-design-canvas) | `PaymentAuthorization` and `Refund`: states, invariants, commands | [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/storefront/contexts/customer-payments/domain-events) | Published and consumed CloudEvents, with an example envelope | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) (message catalogue) |
| [Domain Message Flow](/storefront/contexts/customer-payments/domain-message-flow) | Authorize, capture on shipment, release, refund, parked facts | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/storefront/contexts/customer-payments/eventstorming) | Process-level boards with hotspots | [EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/storefront/contexts/customer-payments/use-cases) | One section per command: trigger, flow, errors, events, idempotency | (application layer, fleet convention) |
| [Class Diagram](/storefront/contexts/customer-payments/class-diagram) | Proposed domain model and hexagonal ports and adapters | (UML, fleet convention) |
| [Entity Relationship](/storefront/contexts/customer-payments/entity-relationship) | Proposed Postgres schema | (fleet convention) |
| [Sequence Diagrams](/storefront/contexts/customer-payments/sequence-diagrams) | Adapter to Kafka and provider for every command use case | (UML, fleet convention) |

## Elsewhere

- REST contract (proposed): `storefront/apis/customer-payments/openapi.yaml`,
  rendered under the [API reference](/storefront/api-reference).
- The storefront-wide [Context Map](/storefront/strategic-design/context-map),
  [Subdomain Classification](/storefront/strategic-design/subdomain-classification)
  and [Ubiquitous Language](/storefront/strategic-design/ubiquitous-language).
- The [Model Gap Register](/storefront/strategic-design/model-gap-register)
  tracks gap S4 (event order across topics: fulfilment facts for an unbound
  order are parked and applied on `CheckoutCompleted`) and, on the checkout
  side, gap S3 (requote after authorization: void, then re-quote).
- [order-sourcing](/network/contexts/order-sourcing) publishes the
  `FulfillmentShipped` and `FulfillmentCancelled` facts and
  [shipping-and-tracking](/network/contexts/shipping-and-tracking) the
  `PackageLost` and `PackageReturned` facts that drive capture, release and
  refund (Conformist).
- [checkout](/storefront/contexts) calls `AuthorizePayment` and
  `VoidAuthorization` and publishes `CheckoutCompleted`;
  [shopping-cart](/storefront/contexts/shopping-cart) is the other
  consumer of that event.
