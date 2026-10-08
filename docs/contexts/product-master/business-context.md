---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why "what a SKU is" is its own bounded context — classification leaves the stock ledger, the fleet gains a physical profile, and live classification lookups give way to local copies.
---

# Business Context

Sourced from `product-master`'s
[ADR 0001](https://github.com/IQVO/product-master/blob/develop/docs/adr/0001-product-master-bounded-context.md),
[ADR 0002](https://github.com/IQVO/product-master/blob/develop/docs/adr/0002-physical-profile-declared-vs-measured.md),
[ADR 0003](https://github.com/IQVO/product-master/blob/develop/docs/adr/0003-migration-from-inventory-storage.md)
and
[ADR 0004](https://github.com/IQVO/product-master/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md),
all accepted on 2026-10-06, and the later
[ADR 0005](https://github.com/IQVO/product-master/blob/develop/docs/adr/0005-mcp-server-adoption.md)
(MCP) and
[ADR 0006](https://github.com/IQVO/product-master/blob/develop/docs/adr/0006-analytics-read-side.md)
(analytics read side).

## The gap

Before this context, the fleet had no home for product master data. The
only product facts lived inside `inventory-storage`, as a
`ProductClassification` aggregate next to `StockUnit` (inventory-storage ADR
0009 and ADR 0010): handling tags, temperature class and DOT hazard class.
inventory-storage's own ADR 0009 already called classification "a property
of the product, not of any physical holding", but there was nowhere else to
put it. That had three costs (ADR 0001, Context):

- **Three live lookups.** `order-management`, `wes-work-planning` and
  `fulfillment-execution` each called `GET /products/{sku}/classification` on
  `inventory-storage` at request time, each with its own REST client,
  `PRODUCT_CLASSIFICATION_MODE` switch and circuit breaker. The 2026-10-05
  audit flagged this as a hotspot.
- **Nobody knows how big a unit is.** `fulfillment-execution`'s weigh check
  receives the expected weight from its caller, `facility-layout` models
  only what a slot can hold, and no context can answer "how big and how
  heavy is one unit of this SKU".
- **Two different reasons to change in one model.** "What a SKU is" and "how
  many of it sit where" change at different rates and are edited by
  different people: master-data stewards versus floor operations.

## What it owns

One aggregate, `Product`, identified by SKU. Every attribute describes the
same SKU and is edited by the same stewardship role, and no rule spans two
SKUs (ADR 0001):

- **Description**: optional operator text.
- **Classification**: the closed set of handling tags (`Hazmat`, `Fragile`,
  `TemperatureSensitive`, `Oversized`, `HighValue`); a TemperatureClass
  (`Ambient`, `Chilled`, `Frozen`) required if and only if the product is
  `TemperatureSensitive`; an optional DOT hazard class (1 to 9) only with
  `Hazmat`. The rules move unchanged from inventory-storage, so the wire
  contract stays field-compatible.
- **Physical profile** (ADR 0002): **declared** unit dimensions and weight
  (what the vendor or steward says, available early, often wrong) and the
  latest **measured** ones (a dimensioning device or a person with a tape
  and a scale, later and trusted more). The **effective** values are the
  measured ones if present, else the declared ones. A **discrepancy** flag is
  raised when measured volume or weight differs from declared by more than
  10 %; it informs stewards and never rejects the measurement.
- **Version**: starts at 1, grows by one per accepted change, guards the
  write (409 on a race) and travels on every event so downstream copies can
  drop stale or replayed messages.

A product must be registered (`PUT /products/{sku}`) before it can be
classified or dimensioned. Master data has an explicit beginning.

## What it deliberately does not own

- **Segregation rules.** product-master records the DOT hazard class.
  `inventory-storage` (per bin) and `fulfillment-execution` (per package)
  keep applying their own 49 CFR 177.848 segregation matrix to it.
- **Pack hierarchy and units of measure, lot/serial/expiry policy, shelf
  life, kits, velocity class, lifecycle states, barcodes and GTINs**: later
  ADRs.
- **Commercial catalogue data** (title, price, images): that belongs to a
  selling context, not to the warehouse.
- **Deriving tags from dimensions.** `Oversized` stays a steward decision;
  no rule exists yet that the business has agreed to (ADR 0002).

## No live cross-context lookup, in either direction

product-master never calls a sibling context; it has no outbound HTTP client.
Downstream contexts do not call it at request time either: each keeps a
local copy built from `warehouse.product-master.events`, one row per SKU,
applied only when the event `version` is newer than the stored one. The REST
`GET` endpoints are for operators, the console and agents, not for
service-to-service reads (ADR 0001).

## How classification moves over

A strangler migration in five stages, with event-carried state transfer only:
no shared database, no cross-context REST call (ADR 0003).

| Stage | What happens |
| --- | --- |
| A | product-master's legacy importer consumes `inventory-storage`'s `ProductClassified` (consumer group from `LEGACY_IMPORT_CONSUMER_GROUP`). A classification authored in product-master (`native`) is never overwritten by a legacy one. |
| B | inventory-storage re-emits every existing classification once (backfill), so the importer sees the rows that predate its publishing. |
| C | inventory-storage's `PUT /products/{sku}/classification` returns `410 Gone`; it stops raising `ProductClassified` on its write path and keeps its table as a local copy fed by product-master. |
| D | `order-management`, `wes-work-planning` and `fulfillment-execution` swap their lookup adapter for a Kafka-fed local copy. `PRODUCT_CLASSIFICATION_MODE=http` is removed and rejected at boot. |
| E | After the cluster is verified: the deprecated endpoint, the backfill command and the legacy importer are removed, and the inventory-storage `ProductClassified` type is marked retired here. |

## Honest scope today

- The service and the four consumers are merged on their `develop`
  branches: stages A to D are in the code (inventory-storage ADR 0034,
  order-management ADR 0036, wes-work-planning ADR 0035,
  fulfillment-execution ADR 0039). Stage E (removing the legacy importer,
  the backfill command and the deprecated endpoint) is not done.
- The reference deployment runs product-master and all four consumers in
  `kafka` mode (deployed 2026-10-07): `warehouse-infra` has a
  `product-master` entry in `terraform/locals.tf`, sets
  `PRODUCT_CLASSIFICATION_MODE=kafka` for `wes-work-planning` and
  `fulfillment-execution` in `sync_edge_env`, and sets the dedicated chart
  values for `order-management` (`productClassification.mode: kafka`) and
  `inventory-storage` (`productMasterConsumerGroup`). The stage B backfill
  (`inventory republish-product-classifications`) was run once on
  2026-10-07 and republished 6 rows.
- Four of the five published types have no consumer yet. The physical
  profile's intended downstream uses (expected package weight at the weigh
  check, cube-based slot fit, cube-based storage capacity) are later phases.
- There is no measurement history: only the latest measurement is kept
  (ADR 0002). The analytics read side
  ([ADR 0006](https://github.com/IQVO/product-master/blob/develop/docs/adr/0006-analytics-read-side.md))
  copies every event to `warehouse.product-master.analytics` for the master
  data quality report; no other context reads that topic.
