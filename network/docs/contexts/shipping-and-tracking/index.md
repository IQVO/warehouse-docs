---
id: index
title: Shipping & Tracking
sidebar_label: Shipping & Tracking
description: "Shipping & Tracking (proposed): a Generic subdomain that issues shipping labels and keeps one forward-only, customer-visible journey per package."
---

# Shipping & Tracking

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

<span className="badge-generic">Generic Subdomain</span>

**Shipping & Tracking** (`shipping-and-tracking`, code `ST`, tier
`logistics`) issues the shipping label for every package and owns the
package's journey. A label is issued in-organization when
`vendor-connectivity` asks for one on behalf of a vendor node (`POST /labels`).
At that moment this context reads the ship-to address from
`customer-ordering` (`GET /orders/{orderId}/ship-to`, restricted) and keeps
only an encrypted snapshot needed to print it. It is the only context outside
`customer-ordering` that ever sees an address, and it never publishes one.
After the label, it folds facts from three other contexts into one
customer-visible, forward-only timeline: the vendor's
`VendorShipmentConfirmed` and the first pickup scan, linehaul `LoadDeparted`
and `LoadArrived`, and last-mile `PackageOutForDelivery` and
`DeliveryAttempted`. The timeline ends in delivered, returned or lost.
`PackageHandedOver` feeds `node-performance`. `PackageDelivered` feeds the
promise judgement in `delivery-promise`. A package that goes silent is raised
as an exception (`ExceptionOnSilence`).

:::info[What its pages describe]
- **Inbound:** `IssueLabel` from `vendor-connectivity` (REST, in-org);
  events from `vendor-connectivity`, `linehaul-transportation`,
  `last-mile-delivery` and `offer-availability`; `GetJourney` from shoppers
  and `customer-ordering`.
- **Outbound:** one synchronous query, `GetShipTo`, to `customer-ordering`;
  eight CloudEvents types on `retailnetwork.shipping-and-tracking.events`.
- **Aggregates:** `ShippingLabel` (`labelRef`) and `PackageJourney`
  (`trackingNumber`).
:::

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/network/contexts/shipping-and-tracking/business-context) | The business problem, actors, decisions, out of scope | [DDD Starter Modelling Process](https://github.com/ddd-crew/ddd-starter-modelling-process) (Understand, Discover) |
| [Ubiquitous Language](/network/contexts/shipping-and-tracking/ubiquitous-language) | Every term, its code identifier and its false friends | [Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas) (Ubiquitous Language section) |
| [Core Domain Chart](/network/contexts/shipping-and-tracking/core-domain-chart) | Why this context is Generic | [Core Domain Charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/network/contexts/shipping-and-tracking/bounded-context-canvas) | Purpose, roles, every inbound and outbound message | [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/network/contexts/shipping-and-tracking/context-map) | Every neighbour, direction and pattern | [Context Mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/network/contexts/shipping-and-tracking/aggregate-design-canvas) | `ShippingLabel` and `PackageJourney`: states, invariants, commands, events | [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/network/contexts/shipping-and-tracking/domain-events) | Eight published and six consumed events, with full CloudEvents types | [EventStorming glossary](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) (domain event) |
| [Domain Message Flow](/network/contexts/shipping-and-tracking/domain-message-flow) | Label issue, journey to delivery, failure paths | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/network/contexts/shipping-and-tracking/eventstorming) | Process-level boards with hotspots | [EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/network/contexts/shipping-and-tracking/use-cases) | One section per command, errors mapped to HTTP | none (application layer) |
| [Class Diagram](/network/contexts/shipping-and-tracking/class-diagram) | Proposed domain types and the hexagonal layout | none (UML) |
| [Entity Relationship](/network/contexts/shipping-and-tracking/entity-relationship) | Proposed Postgres schema | none |
| [Sequence Diagrams](/network/contexts/shipping-and-tracking/sequence-diagrams) | Adapter to Kafka for every command use case | none (UML) |

## Elsewhere

- Read-only MCP server (service ADR 0006): `cmd/mcp`, a second binary serving Streamable HTTP
  on `:8090` with no auth; it sources this context's own reads and nothing that writes. One
  tool: `get_journey`. The gateway (Kong) exposes it at `/api/mcp/shipping-and-tracking`,
  rewritten to the server's `/mcp` mount.
- Console remote (service ADR 0007): `web/`, a Vite + React Module Federation remote —
  federation container `shipping_mfe`, gateway mount `/mfes/shipping-and-tracking/`,
  dev/preview port `4020` — read-only screens over the existing REST reads, calling only this
  context's API.
- REST contract (as built, from the service repository): `apis/shipping-and-tracking/openapi.yaml`,
  rendered under the [API reference](/network/api-reference).
- [ADR 0006: PII confinement](/network/adr/0006-pii-confinement): why the ship-to
  address lives only in `customer-ordering` and here.
- [ADR 0007: CloudEvents namespace](/network/adr/0007-cloudevents-namespace) and the
  [event standard](/network/strategic-design/event-standard-cloudevents).
- The domain-wide [Context Map](/network/strategic-design/context-map) and
  [Subdomain Classification](/network/strategic-design/subdomain-classification).
