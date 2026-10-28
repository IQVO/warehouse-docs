---
id: index
title: Product Discovery
sidebar_label: Product Discovery
description: "Product Discovery, the Supporting read side of the digital storefront: one ProductView per catalogue item and one CategoryView per tree, fed by events from offer-availability, product-content and pricing, searched with PostgreSQL full-text search and pg_trgm behind a port."
---

# Product Discovery

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-discovery` service is built on develop ([`IQVO/product-discovery`](https://github.com/IQVO/product-discovery) at `9c2f945`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type of this context named on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-discovery#service-and-operations) section lists it.
:::

<span className="badge-supporting">Supporting</span>

**Product Discovery** (`product-discovery`, code `PD`, tier `storefront`)
is the read side of browsing and search. It keeps one **ProductView** per
catalogue item — title, flags, content, category path, list and effective
price, `inStock`, `purchasable` — and one **CategoryView** — the browsable
tree plus purchasable counts. Both are projections, fed by events from the
network's [offer-availability](/network/contexts/offer-availability) and the
storefront's own [product-content](/storefront/contexts/product-content) and
[pricing](/storefront/contexts/pricing). Search is PostgreSQL full-text
search plus `pg_trgm` similarity (decision D9), behind a port so a dedicated
engine is a later adapter swap. There is **no aggregate in v1**: the
context's own ADR 0002 will say so plainly — projections only — so it
publishes no events and takes no commands, only the three read routes the
[experience layer](/storefront/contexts) calls.

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/storefront/contexts/product-discovery/business-context) | The problem, actors, decisions, relation to real storefronts, out of scope | (narrative) |
| [Ubiquitous Language](/storefront/contexts/product-discovery/ubiquitous-language) | Terms, code identifiers, terms not to confuse | [Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas) (UL section) |
| [Core Domain Chart](/storefront/contexts/product-discovery/core-domain-chart) | Why this context is Supporting, a Core candidate at scale | [Core Domain Charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/storefront/contexts/product-discovery/bounded-context-canvas) | Purpose, classification, roles, inbound and outbound messages, decisions, metrics | [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/storefront/contexts/product-discovery/context-map) | Every neighbour, direction and pattern | [Context Mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/storefront/contexts/product-discovery/aggregate-design-canvas) | No aggregate by decision: the canvas applied to `ProductView` and `CategoryView` | [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/storefront/contexts/product-discovery/domain-events) | The eleven consumed CloudEvents (nothing is published), with an example envelope | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) (message catalogue) |
| [Domain Message Flow](/storefront/contexts/product-discovery/domain-message-flow) | Search, the availability feed, the content and price feeds, the bootstrap rebuild | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/storefront/contexts/product-discovery/eventstorming) | Process-level boards with hotspots | [EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/storefront/contexts/product-discovery/use-cases) | The three queries, the projector and the bootstrap rebuild | (application layer, fleet convention) |
| [Class Diagram](/storefront/contexts/product-discovery/class-diagram) | Read-side model, the search port and the hexagonal adapters (the model's design, with the as-built packages) | (UML, fleet convention) |
| [Entity Relationship](/storefront/contexts/product-discovery/entity-relationship) | Postgres schema as built (migration 0001): projections, search index, inbox | (fleet convention) |
| [Sequence Diagrams](/storefront/contexts/product-discovery/sequence-diagrams) | Adapter to store for every use case, including the ops-only rebuild | (UML, fleet convention) |

## Service and operations

- **Service:** [`IQVO/product-discovery`](https://github.com/IQVO/product-discovery) on `develop` (`9c2f945`, 2026-10-27): binaries `cmd/api`, `cmd/rebuild`; REST contract [`apis/openapi.yaml`](https://github.com/IQVO/product-discovery/blob/develop/apis/openapi.yaml), event contract [`apis/asyncapi.yaml`](https://github.com/IQVO/product-discovery/blob/develop/apis/asyncapi.yaml), schema in `internal/adapters/outbound/postgres/migrations/` (see [Entity Relationship](/storefront/contexts/product-discovery/entity-relationship)). 5 ADRs, listed in the [ADR index](/storefront/adr#product-discovery).
- **Configuration:** mandatory at boot (the service exits naming the missing variable): `DATABASE_URL`, `KAFKA_BROKERS`, `OFFER_AVAILABILITY_CONSUMER_GROUP`, `PRODUCT_CONTENT_CONSUMER_GROUP`, `PRICING_CONSUMER_GROUP`. There is no in-memory mode. Packaging: no Helm chart in the repo yet (`charts/` is absent on develop).
- **Deployment:** not deployed. warehouse-infra `develop` has no `terraform/apps.yaml` entry and no `helm-values/product-discovery.yaml`, so no database, consumer group or gateway route is provisioned. The kind cluster was not checked in this refresh.
- **Observability:** [service ADR 0005](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0005-fleet-observability-standard.md), *Adopt the fleet observability standard (logs, metrics, traces)*, Accepted (2026-10-26). Logs, metrics and traces leave over OTLP/gRPC (`OTEL_EXPORTER_OTLP_ENDPOINT`, code default `localhost:4317`; `OTEL_SERVICE_NAME`); a collector that is down only drops telemetry. The Tier-2 business counter is `discovery.searches.served` (unit `{search}`, in `internal/adapters/outbound/telemetry/search_metrics.go`), with attribute `outcome` = `served`, `empty` or `failed` and `reason` on the outcomes that are not a success. No warehouse-infra dashboard queries it yet.
- **Rebuild:** `cmd/rebuild` is a one-shot ops binary (service ADR 0003): it pages every source over REST (`OFFER_AVAILABILITY_URL`, `PRODUCT_CONTENT_URL`, `PRICING_URL`, all mandatory) and rebuilds the projections; it never serves a shopper request.

## Elsewhere

- REST contract: `storefront/apis/product-discovery/openapi.yaml` (a copy of the service\'s spec on develop),
  rendered under the [API reference](/storefront/api-reference).
- The storefront-wide [Context Map](/storefront/strategic-design/context-map),
  [Subdomain Classification](/storefront/strategic-design/subdomain-classification)
  and [Ubiquitous Language](/storefront/strategic-design/ubiquitous-language).
- The [Model Gap Register](/storefront/strategic-design/model-gap-register)
  tracks gap S6 (out-of-stock purchase): impossible in this network; an item
  with no live listing is shown as currently unavailable (policy
  `UnavailableNotBuyable`).
- The [research](/storefront/research/benchmarks) behind the search decision
  (D9) and the product-type-query rule: search quality is benchmark [6].
- [offer-availability](/network/contexts/offer-availability) owns the item
  master and listing availability this context projects;
  [product-content](/storefront/contexts/product-content) owns descriptions,
  media and the category tree;
  [pricing](/storefront/contexts/pricing) owns the prices.
