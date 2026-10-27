---
id: index
title: Product Master
sidebar_label: Product Master
description: The Supporting, WMS-tier bounded context that owns SKU-level product master data — handling classification (taken over from inventory-storage) and the declared-versus-measured physical profile.
slug: /contexts/product-master
---

# Product Master

<span className="badge-supporting">Supporting Subdomain</span>

**Product Master** is one of the fleet's sixteen domain bounded contexts. It
sits in the `wms` tier of the CloudEvents subdomain taxonomy, the third `wms`
context after `facility-layout` and `inventory-storage` (`inbound-receiving`
and `slotting-optimization` have since become the fourth and fifth). It is the single source of
truth for **what a SKU is**: for handling (its classification) and physically
(its unit dimensions and weight). It answers no "where" or "how many"
question; stock stays in `inventory-storage`
([ADR 0001](https://github.com/IQVO/product-master/blob/develop/docs/adr/0001-product-master-bounded-context.md)).

It owns one aggregate, **`Product`**, identified by SKU, with an optional
description, an optional **Classification** (the closed handling-tag set,
TemperatureClass and DOT hazard class), a **Physical profile** (declared,
measured and effective values, with a discrepancy flag,
[ADR 0002](https://github.com/IQVO/product-master/blob/develop/docs/adr/0002-physical-profile-declared-vs-measured.md))
and a `version` carried on every published event.

:::info[What is live, what is retired, and what has no consumer]
Per this context's own [Context Map](/contexts/product-master/context-map),
checked against the reference deployment (`warehouse-infra` `develop`):

**Live (wired in `warehouse-infra` `develop`):** six contexts keep a
version-guarded local copy of `ProductClassified` from
`warehouse.product-master.events`, one row per SKU: `inventory-storage` (its
ADR 0034), `order-management` (ADR 0036), `wes-work-planning` (ADR 0035),
`fulfillment-execution` (ADR 0039), `slotting-optimization` and
`returns-processing`. For `order-management`, `wes-work-planning` and
`fulfillment-execution` that replaced their former
`GET /products/{sku}/classification` calls to `inventory-storage`
([ADR 0003](https://github.com/IQVO/product-master/blob/develop/docs/adr/0003-migration-from-inventory-storage.md),
stages C and D); `inventory-storage` has since removed its own classification
surface (stage E, its PR #218). The GS1 packaging hierarchy
([ADR 0011](https://github.com/IQVO/product-master/blob/develop/docs/adr/0011-packaging-hierarchy-with-gs1-gtin.md):
pack levels with a GTIN, `ProductPackLevelDeclared`, `ProductPackLevelMeasured`,
`ProductPackLevelRetired`, `GET /gtins/{gtin}`) feeds seven local pack views:
`inbound-receiving`, `inventory-storage`, `pick-face-replenishment`,
`slotting-optimization`, `wes-work-planning`, `fulfillment-execution` and
`network-inventory-planning` (`ProductPackLevelMeasured` is read only by
`wes-work-planning` and `slotting-optimization`). `inbound-receiving` reads
`ProductRegistered`, and `slotting-optimization` reads
`ProductDimensionsDeclared` and `ProductMeasured`. Events leave through a
transactional outbox. Every consumer group is set in `warehouse-infra`
`develop` (`helm-values/<consumer>.yaml` or the consumer chart's default).

**Read surfaces (no service-to-service reads):** REST behind Kong at
`/api/product-master`, a read-only MCP server (`cmd/mcp`, four tools,
[ADR 0005](https://github.com/IQVO/product-master/blob/develop/docs/adr/0005-mcp-server-adoption.md))
that `warehouse-ops-agent` reads for its `find_master_data_gaps` tool, the
`productmaster_mfe` console remote at `/mfes/product-master/` (the Product
Master tile in `warehouse-console`), and the master data quality report of the
analytics read side (`cmd/product-projector` and `cmd/product-reports`,
[ADR 0006](https://github.com/IQVO/product-master/blob/develop/docs/adr/0006-analytics-read-side.md)).

**Retired:** the legacy importer of `inventory-storage`'s own
`ProductClassified` (stage E of ADR 0003): neither the importer nor the
legacy type exists on either `develop` (fleet edge K21, retired).

**Published contract, no consumer yet:** `ProductDescriptionChanged`.
:::

## This context's pages

- [Business Context](/contexts/product-master/business-context): why
  "what a SKU is" needed its own context, and how classification moves out
  of the stock ledger.
- [Ubiquitous Language](/contexts/product-master/ubiquitous-language):
  Product, SKU, Classification, handling tags, TemperatureClass, DOT hazard
  class, Physical profile (declared, measured, effective, discrepancy),
  version.
- [Core Domain Chart](/contexts/product-master/core-domain-chart)
  ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts)):
  why this context is Supporting.
- [Bounded Context Canvas](/contexts/product-master/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, classification, roles, inbound and outbound communication,
  business decisions and open questions.
- [Context Map](/contexts/product-master/context-map)
  ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)):
  every relationship with its pattern, technology and status.
- [Aggregate Design Canvas](/contexts/product-master/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  the `Product` aggregate.
- [Domain Events](/contexts/product-master/domain-events): the eight
  `product.*` events it publishes and who consumes each.
- [Domain Message Flow](/contexts/product-master/domain-message-flow)
  ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling)):
  key scenarios as commands, events and queries.
- [EventStorming](/contexts/product-master/eventstorming)
  ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)):
  design-level process flows and hotspots.
- [Class Diagram](/contexts/product-master/class-diagram): the domain
  model and the hexagonal ports as they exist in the code.
- [Entity Relationship](/contexts/product-master/entity-relationship):
  the persisted tables.
- [Sequence Diagrams](/contexts/product-master/sequence-diagrams): register,
  classify, declare and measure, and the outbox relay.
- [Use Cases](/contexts/product-master/use-cases): the application use
  cases and the endpoint or consumer that drives each.
- [Async API](/contexts/product-master/async-api): the Kafka integration
  in narrative form.

Every page above except the Business Context and the Async API narrative
is synced from the `product-master` repository.

## Elsewhere

- **Repository**: [github.com/IQVO/product-master](https://github.com/IQVO/product-master).
  Its ADRs live under `docs/adr/`, not `docs/docs/adr/`: six on `develop`,
  [0001](https://github.com/IQVO/product-master/blob/develop/docs/adr/0001-product-master-bounded-context.md)
  (the bounded context),
  [0002](https://github.com/IQVO/product-master/blob/develop/docs/adr/0002-physical-profile-declared-vs-measured.md)
  (physical profile),
  [0003](https://github.com/IQVO/product-master/blob/develop/docs/adr/0003-migration-from-inventory-storage.md)
  (migration from inventory-storage),
  [0004](https://github.com/IQVO/product-master/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md)
  (CloudEvents envelope and type catalogue),
  [0005](https://github.com/IQVO/product-master/blob/develop/docs/adr/0005-mcp-server-adoption.md)
  (read-only MCP server) and
  [0006](https://github.com/IQVO/product-master/blob/develop/docs/adr/0006-analytics-read-side.md)
  (analytics read side).
- [ADR index](/adr): links to this context's own decision records.
- **Generated references on this site**: [REST](/api-reference/rest/product-master/product-master-api)
  and [AsyncAPI](/api-reference/async/product-master), generated from the
  real `apis/openapi.yaml` and `apis/asyncapi.yaml`.
- **Fleet-level**: [Context Map](/strategic-design/context-map) (K20, K21),
  the [Event Standard](/strategic-design/event-standard-cloudevents) and the
  [Ubiquitous Language](/strategic-design/ubiquitous-language).
