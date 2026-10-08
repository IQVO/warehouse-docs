---
id: index
title: Product Master
sidebar_label: Product Master
description: The Supporting, WMS-tier bounded context that owns SKU-level product master data — handling classification (taken over from inventory-storage) and the declared-versus-measured physical profile.
slug: /contexts/product-master
---

# Product Master

<span className="badge-supporting">Supporting Subdomain</span>

**Product Master** is one of the fleet's twelve domain bounded contexts. It
sits in the `wms` tier of the CloudEvents subdomain taxonomy, the third `wms`
context after `facility-layout` and `inventory-storage`. It is the single source of
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

:::info[What is live, what is migration-only, and what has no consumer]
Per this context's own [Context Map](/contexts/product-master/context-map),
checked against the reference deployment (`warehouse-infra` `develop`):

**Live:** `inventory-storage` (its ADR 0034), `order-management`
(ADR 0036), `wes-work-planning` (ADR 0035) and `fulfillment-execution`
(ADR 0039) each keep a local copy of `ProductClassified` from
`warehouse.product-master.events`, version-guarded, one row per SKU. For
`order-management`, `wes-work-planning` and `fulfillment-execution` that
replaces their former `GET /products/{sku}/classification` calls to
`inventory-storage`; all three now reject `PRODUCT_CLASSIFICATION_MODE=http`
at boot, and `inventory-storage` answers its old classification write with
`410 Gone`
([ADR 0003](https://github.com/IQVO/product-master/blob/develop/docs/adr/0003-migration-from-inventory-storage.md),
stages C and D). Events leave through a transactional outbox. The reference
deployment runs `product-master` and switches every consumer on:
`productMasterConsumerGroup` in `helm-values/inventory-storage.yaml`,
`productClassification.mode: kafka` in `helm-values/order-management.yaml`,
and `PRODUCT_CLASSIFICATION_MODE=kafka` in `terraform/locals.tf`
`sync_edge_env` for `wes-work-planning` and `fulfillment-execution`.

**Read surfaces (no service-to-service reads):** REST behind Kong at
`/api/product-master`, a read-only MCP server (`cmd/mcp`, four tools,
[ADR 0005](https://github.com/IQVO/product-master/blob/develop/docs/adr/0005-mcp-server-adoption.md))
that `warehouse-ops-agent` reads for its `find_master_data_gaps` tool, the
`productmaster_mfe` console remote at `/mfes/product-master/` (the Product
Master tile in `warehouse-console`), and the master data quality report of the
analytics read side (`cmd/product-projector` and `cmd/product-reports`,
[ADR 0006](https://github.com/IQVO/product-master/blob/develop/docs/adr/0006-analytics-read-side.md)).

**Migration only:** a legacy importer reads `inventory-storage`'s own
`ProductClassified` (`LEGACY_IMPORT_CONSUMER_GROUP`, set in the reference
deployment) until the decommission stage (stage E) removes it.
`inventory-storage` now emits that legacy type only from its one-shot
`republish-product-classifications` backfill, which was run once on
2026-10-07.

**Published contract, no consumer yet:** `ProductRegistered`,
`ProductDescriptionChanged`, `ProductDimensionsDeclared` and
`ProductMeasured`.
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
  every relationship with its pattern, technology and status, including the
  migration-only legacy edge.
- [Aggregate Design Canvas](/contexts/product-master/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  the `Product` aggregate.
- [Domain Events](/contexts/product-master/domain-events): the five
  `product.*` events it publishes and the legacy event it consumes.
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
  classify, declare and measure, the legacy import and the outbox relay.
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
