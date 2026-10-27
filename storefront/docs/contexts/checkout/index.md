---
id: index
title: Checkout
sidebar_label: Checkout
description: "Checkout, the Supporting subdomain of the digital storefront that runs the purchase saga: authorize payment, place the order through an Anti-Corruption Layer, and settle requote, void and in-doubt placement outcomes."
---

# Checkout

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `checkout` service is built on develop ([`IQVO/checkout`](https://github.com/IQVO/checkout) at `ab4f0e9`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/checkout#service-and-operations) section lists it.
:::

<span className="badge-supporting">Supporting</span>

**Checkout** (`checkout`, code `CK`, tier `storefront`) is the purchase
saga: one transaction across price, payment and the network's promise
confirmation. Its single aggregate, `CheckoutSession`, walks from review to
placed order. The saga authorizes the payment first (compensatable: it can be
voided), then places the order (the pivot), then leaves the retriable steps to
events. While the place-order outcome is unknown the session sits in
`PLACING`, the semantic lock: there is no void and no new attempt until a
definitive answer arrives. The place-order step reaches the network's
`customer-ordering` through an Anti-Corruption Layer, the only place that
knows the network's wire names. The context holds a `shopperId` and a
`shipToAddressId` reference and never PII; its stored placement request is
PII-free, so it can be replayed byte for byte with the same
`Idempotency-Key`.

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/storefront/contexts/checkout/business-context) | The problem, actors, decisions, relation to real storefronts, out of scope | (narrative) |
| [Ubiquitous Language](/storefront/contexts/checkout/ubiquitous-language) | Terms, code identifiers, terms not to confuse | [Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas) (UL section) |
| [Core Domain Chart](/storefront/contexts/checkout/core-domain-chart) | Why this context is Supporting | [Core Domain Charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/storefront/contexts/checkout/bounded-context-canvas) | Purpose, classification, roles, inbound and outbound messages, decisions, metrics | [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/storefront/contexts/checkout/context-map) | Every neighbour, direction and pattern | [Context Mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/storefront/contexts/checkout/aggregate-design-canvas) | `CheckoutSession`: states, invariants, commands | [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/storefront/contexts/checkout/domain-events) | Published CloudEvents, with an example envelope | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) (message catalogue) |
| [Domain Message Flow](/storefront/contexts/checkout/domain-message-flow) | The happy path, a decline, a requote, an in-doubt placement | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/storefront/contexts/checkout/eventstorming) | Process-level boards with hotspots | [EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/storefront/contexts/checkout/use-cases) | One section per command: trigger, flow, errors, events, idempotency | (application layer, fleet convention) |
| [Class Diagram](/storefront/contexts/checkout/class-diagram) | Domain model and hexagonal ports and adapters (the model's design, with the as-built packages) | (UML, fleet convention) |
| [Entity Relationship](/storefront/contexts/checkout/entity-relationship) | Postgres schema as built (migration 0001) | (fleet convention) |
| [Sequence Diagrams](/storefront/contexts/checkout/sequence-diagrams) | Adapter to Kafka for every command use case | (UML, fleet convention) |

## Service and operations

- **Service:** [`IQVO/checkout`](https://github.com/IQVO/checkout) on `develop` (`ab4f0e9`, 2026-10-27): binaries `cmd/api`, `cmd/mcp`; REST contract [`apis/openapi.yaml`](https://github.com/IQVO/checkout/blob/develop/apis/openapi.yaml), event contract [`apis/asyncapi.yaml`](https://github.com/IQVO/checkout/blob/develop/apis/asyncapi.yaml), schema in `internal/adapters/outbound/postgres/migrations/` (see [Entity Relationship](/storefront/contexts/checkout/entity-relationship)). 6 ADRs, listed in the [ADR index](/storefront/adr#checkout).
- **Configuration:** mandatory at boot (the service exits naming the missing variable): `DATABASE_URL`, `KAFKA_BROKERS`, `SHOPPING_CART_URL`, `DELIVERY_PROMISE_URL`, `PRICING_URL`, `CUSTOMER_PAYMENTS_URL`, `CUSTOMER_ORDERING_URL`. There is no in-memory mode. Packaging: no Helm chart in the repo yet (`charts/` is absent on develop).
- **Deployment:** not deployed. warehouse-infra `develop` has no `terraform/apps.yaml` entry and no `helm-values/checkout.yaml`, so no database, consumer group or gateway route is provisioned. The kind cluster was not checked in this refresh.
- **Observability:** [service ADR 0006](https://github.com/IQVO/checkout/blob/develop/docs/adr/0006-fleet-observability-standard.md), *Adopt the fleet observability standard (logs, metrics, traces)*, Accepted (2026-10-26). Logs, metrics and traces leave over OTLP/gRPC (`OTEL_EXPORTER_OTLP_ENDPOINT`, code default `localhost:4317`; `OTEL_SERVICE_NAME`); a collector that is down only drops telemetry. The Tier-2 business counter is `checkout.sessions.confirmed` (unit `{session}`, in `internal/adapters/outbound/telemetry/session_metrics.go`), with attribute `outcome` = `completed`, `declined`, `requote-required`, `failed`, `in-doubt` or `refused` and `reason` on the outcomes that are not a success. No warehouse-infra dashboard queries it yet.
- **MCP:** `cmd/mcp` is a read-only MCP server (service ADR 0005) on `MCP_ADDR` (default `:8090`) with one tool, `get_checkout_session`.

## Elsewhere

- REST contract: `storefront/apis/checkout/openapi.yaml` (a copy of the service\'s spec on develop),
  rendered under the [API reference](/storefront/api-reference).
- The storefront-wide [Context Map](/storefront/strategic-design/context-map),
  [Subdomain Classification](/storefront/strategic-design/subdomain-classification)
  and [Ubiquitous Language](/storefront/strategic-design/ubiquitous-language).
- The [Model Gap Register](/storefront/strategic-design/model-gap-register)
  tracks gap S1 (checkout numbers lines 1..n and groups by the quote's
  `groupNo`), gap S2 (the binding total is the session's `PriceQuote`), gap S3
  (requote after authorization: pre-check, then void and `REQUOTE_REQUIRED`)
  and gap S4 (event order across topics, which `customer-payments` parks and
  applies on `CheckoutCompleted`).
- [customer-ordering](/network/contexts/customer-ordering) is the network
  context behind the place-order step;
  [delivery-promise](/network/contexts/delivery-promise) owns the offers the
  session pre-checks. [shopping-cart](/storefront/contexts/shopping-cart)
  supplies the cart the session opens from and closes it on
  `CheckoutCompleted`; [pricing](/storefront/contexts/pricing) issues the
  binding quote; `customer-payments` authorizes, voids and later binds the
  order.
