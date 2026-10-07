---
id: index
title: Product Master
sidebar_label: Product Master
description: The Supporting, WMS-tier bounded context that owns SKU-level product master data — handling classification (taken over from inventory-storage) and the declared-versus-measured physical profile.
slug: /contexts/product-master
---

# Product Master

<span className="badge-supporting">Supporting Subdomain</span>

**Product Master** is the fleet's twelfth backend bounded context. It sits in
the `wms` tier of the CloudEvents subdomain taxonomy, the third `wms` context
after `facility-layout` and `inventory-storage`. It is the single source of
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

:::warning[Decided 2026-10-06, being built]
Everything on this page comes from the four ADRs and the pinned
`apis/openapi.yaml` and `apis/asyncapi.yaml` contracts. The service is
being built now and is not yet deployed in the reference deployment.

**In progress:** `inventory-storage`, `order-management`,
`wes-work-planning` and `fulfillment-execution` each get a local copy of
`ProductClassified` from `warehouse.product-master.events`, which replaces
today's live `GET /products/{sku}/classification` calls to
`inventory-storage`
([ADR 0003](https://github.com/IQVO/product-master/blob/develop/docs/adr/0003-migration-from-inventory-storage.md)).

**Published contract, no consumer yet:** `ProductRegistered`,
`ProductDescriptionChanged`, `ProductDimensionsDeclared` and
`ProductMeasured`.

**Migration only:** a legacy importer reads `inventory-storage`'s own
`ProductClassified` until the decommission stage (stage E) removes it.
:::

## This context's pages

- [Business Context](/contexts/product-master/business-context): why
  "what a SKU is" needed its own context, and how classification moves out
  of the stock ledger.
- [Bounded Context Canvas](/contexts/product-master/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, classification, roles, inbound and outbound communication,
  ubiquitous language, business decisions and open questions.

Both pages are written for this site from the ADRs. The rest of the
ddd-crew page set (glossary, aggregate design canvas, synced context map,
diagrams) is not written yet; it will be synced from the `product-master`
repository once its own docs site exists.

## Elsewhere

- **Repository**: [github.com/IQVO/product-master](https://github.com/IQVO/product-master).
  Its ADRs live under `docs/adr/`: 0001 (the bounded context), 0002
  (physical profile), 0003 (migration from inventory-storage) and
  [0004](https://github.com/IQVO/product-master/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md)
  (CloudEvents envelope and type catalogue).
- **Generated references on this site**: [REST](/api-reference/rest/product-master/product-master-api)
  and [AsyncAPI](/api-reference/async/product-master), generated from the
  real `apis/openapi.yaml` and `apis/asyncapi.yaml`.
- **Fleet-level**: [Context Map](/strategic-design/context-map) (K20, K21),
  the [Event Standard](/strategic-design/event-standard-cloudevents) and the
  [Ubiquitous Language](/strategic-design/ubiquitous-language).
