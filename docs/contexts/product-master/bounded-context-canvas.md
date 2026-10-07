---
id: bounded-context-canvas
title: Bounded context canvas
sidebar_label: Bounded context canvas
description: ddd-crew Bounded Context Canvas for product-master, built from its ADRs 0001-0004 and its pinned OpenAPI and AsyncAPI contracts.
---

# Bounded context canvas

:::info[Written for this site from the ADRs]
`product-master` has no docs site of its own yet, so this canvas is written
here from its ADRs 0001 to 0004 and its pinned `apis/openapi.yaml` and
`apis/asyncapi.yaml`. The service is being built; once its repository has
its own canvas, that copy replaces this page.
:::

Following the ddd-crew [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas).

## Name

**Product Master** (`product-master`, Go module
`github.com/claudioed/product-master`, GitHub `IQVO/product-master`).

## Purpose

Be the single source of truth for SKU-level product master data: what a SKU
**is** for handling purposes (its classification) and physically (declared
and measured unit dimensions and weight). It answers no "where" or "how many"
question; stock lives in `inventory-storage` (ADR 0001). It takes over SKU
classification from `inventory-storage` (ADR 0003) and adds the physical
profile no context had (ADR 0002).

## Strategic Classification

| Axis | Verdict | Evidence |
| --- | --- | --- |
| Domain | **Supporting** | Necessary for every warehouse flow and specific to this warehouse's handling rules, but not where the business differentiates (ADR 0001) |
| Business model | **Compliance and risk reduction**: correct hazmat, temperature and fragile handling depends on it; it earns no revenue itself | Classification feeds stow placement, release-time capabilities and seal-time segregation in four downstream contexts |
| Evolution | **Custom-built** (genesis) | Decided 2026-10-06; being built |
| Tier | **WMS** ("what and where"), CloudEvents subdomain `wms` | The third `wms` context after `facility-layout` and `inventory-storage` |

## Domain Roles

| Role | Applies? | Notes |
| --- | --- | --- |
| Specification context | **Yes** (primary) | Stewards declare what a SKU is: classification and declared dimensions. |
| Gateway / Open Host Service | **Yes** | REST (and MCP read tools, ADR 0001) for operators, the console and agents; the `warehouse.product-master.events` Published Language for sibling contexts. |
| Draft context | No | There is no draft or approval workflow in v1: an accepted write is effective at once. |
| Execution context | No | It never moves, reserves or ships anything. |
| Analytics / reporting | No | No analytics topic in v1 (ADR 0004). |

## Inbound Communication

| Collaborator | Message | Type | Channel | Relationship |
| --- | --- | --- | --- | --- |
| Steward / operator / `warehouse-console` | Register product or change its description | Command | REST `PUT /products/{sku}` | This context is the OHS |
| Steward / operator | Classify product | Command | REST `PUT /products/{sku}/classification` (same body as inventory-storage's former endpoint) | OHS |
| Steward / operator | Declare dimensions | Command | REST `PUT /products/{sku}/dimensions/declared` | OHS |
| Dimensioning device / operator | Record measurement | Command | REST `PUT /products/{sku}/dimensions/measured` | OHS |
| Operator / console / agents | Get product, classification, physical profile; list products (filters `handlingTag`, `classified`) | Query | REST `GET /products/{sku}`, `GET /products/{sku}/classification`, `GET /products/{sku}/physical-profile`, `GET /products` | OHS; not for service-to-service reads |
| `inventory-storage` | Legacy `ProductClassified` | Event | Kafka `warehouse.inventory.events`, `com.warehouse.wms.inventory-storage.product.ProductClassified`, consumer group from `LEGACY_IMPORT_CONSUMER_GROUP` | Conformist, **migration only** (ADR 0003); removed at stage E |

No REST or MCP endpoint is authenticated (fleet-wide decision of 2026-09-11).

## Outbound Communication

The context makes **no** synchronous call to any sibling; it has no outbound
HTTP client (ADR 0001). Everything outbound leaves through the transactional
outbox on `warehouse.product-master.events` (key = SKU, `subject` = SKU,
source `/warehouse/product-master`).

| Collaborator | Message | Type | Channel | Relationship |
| --- | --- | --- | --- | --- |
| `inventory-storage`, `order-management`, `wes-work-planning`, `fulfillment-execution` | `ProductClassified` | Event | `com.warehouse.wms.product-master.product.ProductClassified` | Published Language; each downstream keeps a local copy. **In progress** (ADR 0003 stages C and D) |
| none yet | `ProductRegistered` | Event | `com.warehouse.wms.product-master.product.ProductRegistered` | Published Language (published contract; no consumer yet) |
| none yet | `ProductDescriptionChanged` | Event | `com.warehouse.wms.product-master.product.ProductDescriptionChanged` | Published Language (published contract; no consumer yet) |
| none yet | `ProductDimensionsDeclared` | Event | `com.warehouse.wms.product-master.product.ProductDimensionsDeclared` | Published Language (published contract; no consumer yet) |
| none yet | `ProductMeasured` | Event | `com.warehouse.wms.product-master.product.ProductMeasured` | Published Language (published contract; no consumer yet) |

Every payload carries `sku` and the aggregate `version` after the change.
`ProductClassified` keeps inventory-storage's v1 field names (`sku`,
`handling_tags`, `temperature_class`, `dot_hazard_class`) and adds
`classification_source` and `version`. The two physical-profile events carry
the full profile (`declared`, `measured`, `effective`, `effective_source`,
`discrepancy`, `version`), so a consumer overwrites its copy and never
merges (ADR 0004).

## Ubiquitous Language

- **Product**: the master record of one SKU (description, classification,
  physical profile, version). Must be registered before anything else.
- **SKU**: the product identity, 1 to 64 characters, no whitespace, control
  characters or `/`.
- **Classification**: handling tags plus TemperatureClass and DOT hazard
  class, replaced as a whole.
- **Handling tag**: one of `Hazmat`, `Fragile`, `TemperatureSensitive`,
  `Oversized`, `HighValue`, always in that stable order on the wire.
- **TemperatureClass**: `Ambient`, `Chilled` or `Frozen`; required if and
  only if `TemperatureSensitive`.
- **DOT hazard class**: top-level US DOT class 1 to 9; only with `Hazmat`.
- **Classification source**: `native` (authored here) or `legacy-import`
  (imported from inventory-storage during the migration).
- **Physical profile**: declared, measured and effective unit dimensions
  and weight, in whole millimetres and grams, with the volume
  (length x width x height) derived.
- **Declared**: what the vendor or steward says.
- **Measured**: the latest measurement of one unit, with `measuredAt` and an
  optional `deviceId`.
- **Effective**: measured if present, else declared, else none
  (`effectiveSource` = `measured`, `declared` or `none`).
- **Discrepancy**: measured volume or weight differs from declared by more
  than 10 % of the declared value.
- **Version**: starts at 1, plus one per accepted change; never reset or
  reused for a SKU.

## Business Decisions

1. A SKU must be registered before it can be classified or dimensioned; an
   unknown SKU is a 404, never an implicit registration (ADR 0001).
2. Classification rules move unchanged from inventory-storage ADR 0009 and
   ADR 0010: non-empty, duplicate-free tags; TemperatureClass if and only if
   `TemperatureSensitive`; DOT hazard class only with `Hazmat`.
3. Dimensions are whole millimetres (1 to 20 000) and weight whole grams
   (1 to 2 000 000); orientation is stored as given, never normalised
   (ADR 0002).
4. The latest measurement wins by `measuredAt`: an older one is rejected
   with 409 `stale-measurement`, one in the future with 400 (ADR 0002).
5. A discrepancy above 10 % is information for stewards, not a rejection;
   the measurement still becomes effective (ADR 0002).
6. A write that changes nothing raises no event and does not bump the
   version (ADR 0004).
7. A legacy import never overwrites a `native` classification (ADR 0003).
8. Segregation stays with the contexts that co-locate goods
   (inventory-storage per bin, fulfillment-execution per package).
9. No live cross-context lookup in either direction: consumers keep local
   copies, applied by `version` (ADR 0001).
10. A breaking payload change is a new `.v2` type and dataschema, never a
    mutation of v1 (ADR 0004).

## Assumptions

- Classification changes become eventually consistent downstream; a SKU
  classified moments before its first stow is the new risk. Consumers keep
  their existing fail-open or fail-closed rule for an unknown SKU
  (ADR 0001, Consequences).
- The 10 % discrepancy tolerance is fixed for every SKU in v1 (ADR 0002).
- `measuredAt` is supplied by the caller; the service only refuses a future
  one against its own clock (ADR 0002).

## Verification Metrics

- `TestEventCatalogueMatchesContract` checks the ADR 0004 type catalogue
  against `apis/asyncapi.yaml`.
- Migration runbook check (ADR 0003): after the backfill, the number of
  classified products (`GET /products?classified=true`, all pages) equals
  the row count of inventory-storage's `product_classifications`, and a
  Hazmat SKU stows into a hazmat zone (201) and is rejected from a
  non-hazmat zone (409).
- After stage E, every new classification is `native`; remaining
  `legacy-import` rows tell stewards which classifications were never
  reviewed here (ADR 0003).

## Open Questions

- Pack hierarchy and units of measure, lot/serial/expiry tracking policy,
  shelf life, kits, velocity class, lifecycle states and barcodes/GTINs are
  out of scope in v1 and wait for their own ADRs (ADR 0001).
- A per-category discrepancy tolerance instead of the fixed 10 % (ADR 0002).
- A measurement history, if auditing past readings becomes a need
  (ADR 0002).
- Which consumers adopt the physical profile first: expected package weight
  in fulfillment-execution, cube-based slot fit in inventory-storage, or
  cube-based storage capacity in warehouse-planning (ADR 0002,
  Consequences).
- An analytics topic, projector and reports (ADR 0004, "Not published
  (yet)").
