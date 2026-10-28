---
id: index
title: Shopping Cart
sidebar_label: Shopping Cart
description: "Shopping Cart, the Supporting subdomain of the digital storefront that holds a shopper's intent: one line per item, the destination postal prefix, the delivery quote with an offer per shipment group, the shopper's tier selection, and the labelled, non-binding estimate."
---

# Shopping Cart

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `shopping-cart` service is built on develop ([`IQVO/shopping-cart`](https://github.com/IQVO/shopping-cart) at `95bc5bc`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/shopping-cart#service-and-operations) section lists it.
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
| [Class Diagram](/storefront/contexts/shopping-cart/class-diagram) | Domain model and hexagonal ports and adapters (the model's design, with the as-built packages) | (UML, fleet convention) |
| [Entity Relationship](/storefront/contexts/shopping-cart/entity-relationship) | Postgres schema as built (migration 0001) | (fleet convention) |
| [Sequence Diagrams](/storefront/contexts/shopping-cart/sequence-diagrams) | Adapter to Kafka for every command use case | (UML, fleet convention) |

## Service and operations

- **Service:** [`IQVO/shopping-cart`](https://github.com/IQVO/shopping-cart) on `develop` (`95bc5bc`, 2026-10-27): binaries `cmd/api`; REST contract [`apis/openapi.yaml`](https://github.com/IQVO/shopping-cart/blob/develop/apis/openapi.yaml), event contract [`apis/asyncapi.yaml`](https://github.com/IQVO/shopping-cart/blob/develop/apis/asyncapi.yaml), schema in `internal/adapters/outbound/postgres/migrations/` (see [Entity Relationship](/storefront/contexts/shopping-cart/entity-relationship)). 5 ADRs, listed in the [ADR index](/storefront/adr#shopping-cart).
- **Configuration:** mandatory at boot (the service exits naming the missing variable): `DATABASE_URL`, `KAFKA_BROKERS`, `DELIVERY_PROMISE_URL`, `OFFER_AVAILABILITY_CONSUMER_GROUP`, `PRICING_CONSUMER_GROUP`, `CHECKOUT_CONSUMER_GROUP`. There is no in-memory mode. Packaging: no Helm chart in the repo yet (`charts/` is absent on develop).
- **Deployment:** not deployed. warehouse-infra `develop` has no `terraform/apps.yaml` entry and no `helm-values/shopping-cart.yaml`, so no database, consumer group or gateway route is provisioned. The kind cluster was not checked in this refresh.
- **Observability:** [service ADR 0005](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0005-fleet-observability-standard.md), *Adopt the fleet observability standard (logs, metrics, traces)*, Accepted (2026-10-26). Logs, metrics and traces leave over OTLP/gRPC (`OTEL_EXPORTER_OTLP_ENDPOINT`, code default `localhost:4317`; `OTEL_SERVICE_NAME`); a collector that is down only drops telemetry. The Tier-2 business counter is `cart.lines.added` (unit `{line}`, in `internal/adapters/outbound/telemetry/cart_metrics.go`), with attribute `outcome` = `added` or `rejected` and `reason` on the outcomes that are not a success. No warehouse-infra dashboard queries it yet.

## Elsewhere

- REST contract: `storefront/apis/shopping-cart/openapi.yaml` (a copy of the service\'s spec on develop),
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
