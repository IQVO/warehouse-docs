---
id: entity-relationship
title: Entity Relationship
sidebar_label: Entity Relationship
description: "The Postgres schema of Shopping Cart as built: every table of its migration on develop, with keys, the design-time tables each one replaces, and the outbox, inbox and idempotency tables."
---

# Entity Relationship

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `shopping-cart` service is built on develop ([`IQVO/shopping-cart`](https://github.com/IQVO/shopping-cart) at `95bc5bc`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/shopping-cart#service-and-operations) section lists it.
:::

The schema **as built**: [`0001_shopping_cart_schema.up.sql`](https://github.com/IQVO/shopping-cart/blob/develop/internal/adapters/outbound/postgres/migrations/0001_shopping_cart_schema.up.sql) on `develop` (`95bc5bc`), applied at boot with golang-migrate (which adds its own `schema_migrations` table). Shopping Cart owns its database and shares no table with another context.

7 tables. Key markers: PK primary key, FK foreign key, UK unique. Types are the column types of the migration; constraints (CHECK, defaults, partial indexes) are in the file.

```mermaid
erDiagram
    carts {
        text cart_id PK
        text shopper_id
        text state
        text destination
        jsonb lines
        jsonb quote
        jsonb selections
        timestamptz created_at
        timestamptz last_changed_at
        bigint version
    }
    rm_items {
        text catalog_item_id PK
        boolean catalogued
        boolean discontinued
        boolean priced
        bigint price_minor
        text currency
        bigint price_version
        timestamptz updated_at
    }
    rm_current_schedule {
        boolean singleton PK
        bigint version
        jsonb tiers
    }
    rm_current_tax_table {
        boolean singleton PK
        bigint version
        jsonb bands
    }
    processed_events {
        text event_id PK
        text event_type
        timestamptz processed_at
    }
    idempotency_keys {
        text route PK
        text key PK
        text request_hash
        integer status
        text content_type
        bytea body
        timestamptz created_at
    }
    outbox_events {
        bigserial id PK
        text event_id UK
        text topic
        text event_type
        text subject
        bytea key
        text dataschema
        bytea value
        jsonb headers
        timestamptz created_at
        timestamptz published_at
        integer attempts
        text last_error
    }
```

## Tables

| Table | Columns | Primary key | Role |
| --- | --- | --- | --- |
| `carts` | 10 | `cart_id` | aggregate or read-model state |
| `rm_items` | 8 | `catalog_item_id` | aggregate or read-model state |
| `rm_current_schedule` | 3 | `singleton` | aggregate or read-model state |
| `rm_current_tax_table` | 3 | `singleton` | aggregate or read-model state |
| `processed_events` | 3 | `event_id` | inbox: one row per consumed CloudEvents id (dedupe) |
| `idempotency_keys` | 7 | `route, key` | stored REST answers per `Idempotency-Key` and route |
| `outbox_events` | 13 | `id` | transactional outbox the relay publishes to Kafka |

## Design-time schema versus as built

The pack was first written with a proposed, fully normalised schema. The service kept the aggregate boundaries and changed the storage shape:

| Design-time table | As built |
| --- | --- |
| `cart_lines` | `carts.lines` (jsonb column) |
| `cart_quote_groups` | `carts.quote` (jsonb column) |
| `cart_quoted_offers` | `carts.quote` (jsonb column) |
| `cart_selections` | `carts.selections` (jsonb column) |
| `rm_purchasability` | `rm_items` (one row per item: catalogued, discontinued, priced and the price facts) |
| `rm_item_prices` | `rm_items` |

Every other design-time table exists under the same name. The invariants are enforced by the aggregate in `internal/domain` before a row is written; the migration adds CHECK constraints on scalar columns and the indexes listed in the file.
