---
id: entity-relationship
title: Entity Relationship
sidebar_label: Entity Relationship
description: "The Postgres schema of Customer Payments as built: every table of its migration on develop, with keys, the design-time tables each one replaces, and the outbox, inbox and idempotency tables."
---

# Entity Relationship

:::info[Built on develop, not deployed]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). The `customer-payments` service is built on develop ([`IQVO/customer-payments`](https://github.com/IQVO/customer-payments) at `530c7cb`, checked 2026-10-27) and not deployed (no warehouse-infra entry). Every `Err...` name, REST route and CloudEvents type on this page exists in the service; where the built service differs from the model's design, the page says so (**As built**) or the context's [Service and operations](/storefront/contexts/customer-payments#service-and-operations) section lists it.
:::

The schema **as built**: [`0001_customer_payments_schema.up.sql`](https://github.com/IQVO/customer-payments/blob/develop/internal/adapters/outbound/postgres/migrations/0001_customer_payments_schema.up.sql) on `develop` (`530c7cb`), applied at boot with golang-migrate (which adds its own `schema_migrations` table). Customer Payments owns its database and shares no table with another context.

7 tables. Key markers: PK primary key, FK foreign key, UK unique. Types are the column types of the migration; constraints (CHECK, defaults, partial indexes) are in the file.

```mermaid
erDiagram
    payment_authorizations {
        text authorization_id PK
        text order_id
        text payment_method_token
        text currency
        bigint total_minor
        text state
        text terminal
        text decline_reason
        text provider_authorization_id
        timestamptz expires_at
        timestamptz created_at
        integer reauthorizations
        bigint version
    }
    allocations {
        text authorization_id PK,FK
        integer group_no PK
        bigint amount_minor
        text state
        bigint captured_minor
        text_array tracking_numbers
        text provider_capture_id
    }
    refunds {
        text refund_id PK
        text authorization_id FK
        text order_id
        integer group_no
        text currency
        bigint amount_minor
        text reason
        text state
        integer attempts
        text failure_code
        text provider_refund_id
        timestamptz created_at
        bigint version
    }
    parked_facts {
        text event_id PK
        text kind
        text order_id
        integer group_no
        text_array tracking_numbers
        timestamptz occurred_at
        timestamptz parked_at
        timestamptz escalated_at
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
    payment_authorizations ||--o{ allocations : "authorization_id"
    payment_authorizations ||--o{ refunds : "authorization_id"
```

## Tables

| Table | Columns | Primary key | Role |
| --- | --- | --- | --- |
| `payment_authorizations` | 13 | `authorization_id` | aggregate or read-model state |
| `allocations` | 7 | `authorization_id, group_no` | aggregate or read-model state; FK to `payment_authorizations` |
| `refunds` | 13 | `refund_id` | aggregate or read-model state; FK to `payment_authorizations` |
| `parked_facts` | 8 | `event_id` | aggregate or read-model state |
| `processed_events` | 3 | `event_id` | inbox: one row per consumed CloudEvents id (dedupe) |
| `idempotency_keys` | 7 | `route, key` | stored REST answers per `Idempotency-Key` and route |
| `outbox_events` | 13 | `id` | transactional outbox the relay publishes to Kafka |

## Design-time schema versus as built

The pack was first written with a proposed, fully normalised schema. The service kept the aggregate boundaries and changed the storage shape:

| Design-time table | As built |
| --- | --- |
| `authorization_allocations` | `allocations` (renamed) |
| `allocation_tracking_numbers` | `allocations.tracking_numbers` (text[] column) |
| `provider_captures` | `allocations.provider_capture_id` and `captured_minor` (columns) |
| `parked_fulfillment_facts` | `parked_facts` (renamed) |

Every other design-time table exists under the same name. The invariants are enforced by the aggregate in `internal/domain` before a row is written; the migration adds CHECK constraints on scalar columns and the indexes listed in the file.
