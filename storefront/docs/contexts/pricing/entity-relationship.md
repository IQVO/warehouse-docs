---
id: entity-relationship
title: Entity Relationship
sidebar_label: Entity Relationship
description: The proposed Postgres schema of Pricing, with aggregate tables, the catalogue-item read model, and the outbox, inbox and migration infrastructure tables.
---

# Entity Relationship

:::info[Proposed design, docs only]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model is the canonical design, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

The **proposed** Postgres schema. Pricing owns its database and shares no
table with any other context (`conventions.integration_rules`). Column
names are the model's field names in `snake_case`. A relationship line is
drawn **only** inside one aggregate. No column here holds PII: prices,
charges, rates and ids only.

## Aggregate tables

### ItemPrice

```mermaid
erDiagram
    item_prices ||--o{ item_price_sale_windows : "FK catalog_item_id"
    item_prices {
        TEXT catalog_item_id PK
        BIGINT list_price_minor
        TEXT currency
        TEXT status "ACTIVE or WITHDRAWN"
        TIMESTAMPTZ withdrawn_at "nullable"
        BIGINT version
    }
    item_price_sale_windows {
        TEXT catalog_item_id PK,FK
        TEXT sale_id PK
        BIGINT price_minor
        TIMESTAMPTZ from_at
        TIMESTAMPTZ to_at
        TIMESTAMPTZ cancelled_at "nullable"
    }
```

### DeliveryChargeSchedule and TaxTable

```mermaid
erDiagram
    delivery_charge_schedules ||--|{ delivery_charge_tiers : "FK schedule_id"
    delivery_charge_schedules {
        TEXT schedule_id PK
        BIGINT version UK
        TEXT status "CURRENT or SUPERSEDED"
        TIMESTAMPTZ published_at
    }
    delivery_charge_tiers {
        TEXT schedule_id PK,FK
        TEXT tier PK
        BIGINT charge_minor
        BIGINT free_over_minor "nullable"
    }
```

```mermaid
erDiagram
    tax_tables ||--|{ tax_bands : "FK tax_table_id"
    tax_tables {
        TEXT tax_table_id PK
        BIGINT version UK
        TEXT status "CURRENT or SUPERSEDED"
        TIMESTAMPTZ published_at
    }
    tax_bands {
        TEXT tax_table_id PK,FK
        TEXT postal_prefix_from PK
        TEXT postal_prefix_to
        INTEGER rate_basis_points
    }
```

### PriceQuote

```mermaid
erDiagram
    price_quotes ||--|{ price_quote_lines : "FK quote_id"
    price_quotes ||--o{ price_quote_groups : "FK quote_id"
    price_quotes {
        TEXT quote_id PK
        TEXT cart_id
        TEXT currency
        BIGINT tax_minor
        BIGINT total_minor
        JSONB price_versions
        BIGINT schedule_version
        BIGINT tax_table_version
        TIMESTAMPTZ issued_at
        TIMESTAMPTZ expires_at
        TEXT status "ISSUED or EXPIRED"
    }
    price_quote_lines {
        TEXT quote_id PK,FK
        TEXT catalog_item_id PK
        INTEGER quantity
        BIGINT unit_price_minor
        BIGINT line_total_minor
    }
    price_quote_groups {
        TEXT quote_id PK,FK
        INTEGER group_no PK
        TEXT tier
        BIGINT delivery_charge_minor
    }
```

Derived from: `model.yaml → contexts[pricing].aggregates[*].value_objects`,
`.states`, `.publishes[*].data` (the `version` fields, `tiers(...)`,
`bands(...)`, `cartId`, `totalMinor`, `expiresAt`); the `PriceQuote`
`description` (versions of price, schedule and tax table, `issuedAt`,
`expiresAt`).

Column notes: `item_prices.version` is both the optimistic-concurrency
counter and the monotonic guard consumers apply; `price_quotes` has no
`version` column because a quote is immutable — only `ExpireQuote` flips
its status, guarded by status, not by a counter;
`price_quotes.price_versions` records the `ItemPrice.version` per line so a
confirm-time comparison needs no join; `delivery_charge_tiers` has exactly
four rows per schedule (`ErrIncompleteChargeSchedule`); the unique keys on
`version` back `ErrNonIncreasingVersion`.

Omitted: indexes (for example on `item_price_sale_windows.to_at` for the
boundary scan, and on `price_quotes.expires_at` for the expiry scan) and
`CHECK` constraints (`charge_minor >= 0`, `rate_basis_points` within the
configured range, non-overlapping bands enforced by the aggregate, not the
database).

## Read model tables

```mermaid
erDiagram
    rm_catalog_items {
        TEXT catalog_item_id PK
        BOOLEAN discontinued
        TIMESTAMPTZ last_event_at
    }
```

Derived from: `model.yaml → contexts[pricing].read_models[CatalogItemView]`
and the consumed events' declared fields (`catalogItemId`).

`rm_catalog_items` is disposable: it can be truncated and rebuilt by
replaying `retailnetwork.offer-availability.events`. It stores exactly what
`ErrUnknownCatalogItem` needs — known, and not discontinued — and none of
the item's attributes, which the consumed field lists do not declare.

## Infrastructure tables

```mermaid
erDiagram
    outbox_events {
        BIGSERIAL id PK "infrastructure"
        UUID event_id UK
        TEXT topic
        TEXT event_type
        TEXT kafka_key
        JSONB envelope
        TIMESTAMPTZ created_at
        TIMESTAMPTZ published_at "nullable"
        INTEGER attempts
    }
    processed_events {
        UUID event_id PK "infrastructure"
        TEXT event_type
        TEXT source
        TIMESTAMPTZ processed_at
    }
```

```mermaid
erDiagram
    idempotency_keys {
        TEXT idempotency_key PK "infrastructure"
        TEXT route
        TEXT request_hash
        INTEGER response_status
        JSONB response_body
        TIMESTAMPTZ created_at
    }
    schema_migrations {
        BIGINT version PK "infrastructure"
        BOOLEAN dirty
    }
```

Derived from: `model.yaml → conventions.integration_rules` (transactional
outbox, idempotent consumers, Idempotency-Key on every write route);
`conventions.cloudevents` (topic, type, key).

**All four tables are infrastructure, not domain tables.**
`outbox_events` is the transactional outbox, drained by the relay to
`retailnetwork.pricing.events` (or `retailnetwork.pricing.analytics` for
`PriceQuoteIssued`); `event_id` is the CloudEvents `id`, `event_type` the
full type, `kafka_key` the aggregate root id. `processed_events` is the
inbox, one row per consumed CloudEvents `id`.
`idempotency_keys` stores the response of every state-changing `POST` for
replay. `schema_migrations` is the migration tool's bookkeeping.

## Why there are no foreign keys across aggregates or contexts

- `item_prices.catalog_item_id` → `rm_catalog_items.catalog_item_id` is a
  reference **by value**: the view is a projection of another context's
  facts and may briefly lag; an FK would enforce a lie during the lag. The
  invariant is checked in the aggregate against the store, not by the
  database.
- `price_quotes.cart_id` points into `shopping-cart`'s database: values
  copied from messages, never joined.
- `price_quote_lines.catalog_item_id` and `price_quote_groups.tier` are
  values from pricing's own aggregates and the network's tier enum,
  captured at issue time; a quote must not change when the price later
  does.
- The read-model table has no FK at all. It is rebuilt from events.

## Table ≠ aggregate

| Table | Aggregate / role | Notes |
| --- | --- | --- |
| `item_prices` | **ItemPrice** (root) | One row per priced catalogue item, with `version`. |
| `item_price_sale_windows` | **ItemPrice** (`SaleWindow` value objects) | The boundary scheduler scans `from_at` / `to_at`. |
| `delivery_charge_schedules`, `delivery_charge_tiers` | **DeliveryChargeSchedule** | One `CURRENT`; history kept `SUPERSEDED`. |
| `tax_tables`, `tax_bands` | **TaxTable** | One `CURRENT`; history kept `SUPERSEDED`. |
| `price_quotes`, `price_quote_lines`, `price_quote_groups` | **PriceQuote** | Immutable content; only `status` moves to `EXPIRED`. Retained for the order's lifetime via the checkout session reference. |
| `rm_catalog_items` | none (read model `CatalogItemView`) | Serves `ErrUnknownCatalogItem`. |
| `outbox_events` | none (infrastructure) | Transactional outbox. |
| `processed_events` | none (infrastructure) | Inbox for idempotent consumers. |
| `idempotency_keys` | none (infrastructure) | `Idempotency-Key` replay store. |
| `schema_migrations` | none (infrastructure) | Migration bookkeeping. |
