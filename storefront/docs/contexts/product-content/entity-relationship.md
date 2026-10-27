---
id: entity-relationship
title: Entity Relationship
sidebar_label: Entity Relationship
description: "The Postgres schema of Product Content as built: every table of its migration on develop, with keys, the design-time tables each one replaces, and the outbox, inbox and idempotency tables."
---

# Entity Relationship

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `product-content` service is built on develop ([`IQVO/product-content`](https://github.com/IQVO/product-content) at `2f09dc0`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/product-content#service-and-operations) section lists it.
:::

The schema **as built**: [`0001_product_content_schema.up.sql`](https://github.com/IQVO/product-content/blob/develop/internal/adapters/outbound/postgres/migrations/0001_product_content_schema.up.sql) on `develop` (`2f09dc0`), applied at boot with golang-migrate (which adds its own `schema_migrations` table). Product Content owns its database and shares no table with another context.

6 tables. Key markers: PK primary key, FK foreign key, UK unique. Types are the column types of the migration; constraints (CHECK, defaults, partial indexes) are in the file.

```mermaid
erDiagram
    product_contents {
        text catalog_item_id PK
        text state
        text retired_reason
        text description
        jsonb bullets
        jsonb attributes
        jsonb media
        text primary_category_id
        integer revision
        integer published_revision
        timestamptz created_at
        timestamptz updated_at
        timestamptz published_at
        timestamptz retired_at
        bigint version
    }
    category_trees {
        text tree_id PK
        bigint version
        jsonb categories
        timestamptz updated_at
    }
    catalog_item_view {
        text catalog_item_id PK
        text state
        timestamptz updated_at
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
| `product_contents` | 15 | `catalog_item_id` | aggregate or read-model state |
| `category_trees` | 4 | `tree_id` | aggregate or read-model state |
| `catalog_item_view` | 3 | `catalog_item_id` | aggregate or read-model state |
| `processed_events` | 3 | `event_id` | inbox: one row per consumed CloudEvents id (dedupe) |
| `idempotency_keys` | 7 | `route, key` | stored REST answers per `Idempotency-Key` and route |
| `outbox_events` | 13 | `id` | transactional outbox the relay publishes to Kafka |

## Design-time schema versus as built

The pack was first written with a proposed, fully normalised schema. The service kept the aggregate boundaries and changed the storage shape:

| Design-time table | As built |
| --- | --- |
| `content_bullets` | `product_contents.bullets` (jsonb column) |
| `content_attributes` | `product_contents.attributes` (jsonb column) |
| `content_media` | `product_contents.media` (jsonb column) |
| `categories` | `category_trees.categories` (jsonb column; the whole tree is one row) |
| `rm_catalog_items` | `catalog_item_view` (renamed; the CatalogItemView read model) |

Every other design-time table exists under the same name. The invariants are enforced by the aggregate in `internal/domain` before a row is written; the migration adds CHECK constraints on scalar columns and the indexes listed in the file.
