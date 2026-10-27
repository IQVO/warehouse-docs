---
id: entity-relationship
title: Entity Relationship
sidebar_label: Entity Relationship
description: "The as-built Postgres schema of Seller Inbound's own database (migrations 0001 and 0002)."
---

# Entity Relationship

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml) and the service's migrations on `develop`. This context's service is built ([`IQVO/seller-inbound`](https://github.com/IQVO/seller-inbound)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

The schema of this context's own Postgres database ("every context owns its
database; no shared tables"), as created by
`internal/adapters/outbound/postgres/migrations/0001_seller_inbound_schema.up.sql`
and `0002_seller_scorecard.up.sql` in the service repository. There are no
foreign keys: each aggregate is one row, and the parts the model draws as
child entities (plan lines, cartons and their contents) are stored as `JSONB`
on that row. Ids of other aggregates are held by value.

The design pack drew separate `inbound_plan_lines`, `cartons` and
`carton_contents` tables; the service stores them as `JSONB` columns instead,
and adds an `sscc_registry` table for network-wide SSCC uniqueness (service
ADR 0002, assumption A5).

Seller and plan aggregates:

```mermaid
erDiagram
    sellers {
        TEXT seller_id PK "ownerRef"
        TEXT name
        TEXT state "ACTIVE, SUSPENDED"
        TIMESTAMPTZ onboarded_at
        TIMESTAMPTZ suspended_at "nullable"
        TEXT suspend_reason
        BIGINT version
    }
    inbound_plans {
        TEXT plan_id PK "pln-uuid"
        TEXT seller_id "by value"
        TEXT destination_node_id "by value"
        TEXT packing_option "INDIVIDUAL, CASE_PACKED"
        TEXT state "DRAFT, CONFIRMED, CANCELLED"
        JSONB lines "catalogItemId, gtin, qtyEaches"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ confirmed_at "nullable"
        TIMESTAMPTZ cancelled_at "nullable"
        BIGINT version
    }
```

Shipment aggregate and the SSCC registry:

```mermaid
erDiagram
    inbound_shipments {
        TEXT shipment_id PK "shp-uuid"
        TEXT plan_id "by value"
        TEXT seller_id "by value"
        TEXT node_id "by value"
        TEXT state "six states"
        JSONB cartons "SSCC cartons with contents and receipt status"
        JSONB unexpected "cartons the manifest did not list"
        BOOLEAN discrepant
        TIMESTAMPTZ created_at
        TIMESTAMPTZ labelled_at "nullable"
        TIMESTAMPTZ shipped_at "nullable"
        TIMESTAMPTZ received_at "nullable"
        BIGINT version
    }
    sscc_registry {
        TEXT sscc PK "unique network-wide"
        TEXT shipment_id
    }
```

The sequence `sscc_serial_seq` supplies the serial of every SSCC the network
issues.

Read models fed by consumed events:

```mermaid
erDiagram
    node_inbound_views {
        TEXT node_id PK
        TEXT node_type
        TEXT status
        INTEGER profile_revision
        JSONB inbound_limits "nullable"
    }
    catalog_pack_levels {
        TEXT catalog_item_id PK
        TEXT level PK "EACH, INNER, CASE, PALLET"
        TEXT gtin PK
        TEXT child_gtin
        INTEGER units_per_pack
        BOOLEAN active
        TIMESTAMPTZ declared_at "nullable"
        TIMESTAMPTZ retired_at "nullable"
    }
```

Seller scorecard facts (migration 0002, service ADR 0005), written in the same
unit of work as the receipt:

```mermaid
erDiagram
    seller_scorecard_receipts {
        TEXT shipment_id PK
        TEXT seller_id
        INTEGER cartons_reported
        INTEGER cartons_received
        TIMESTAMPTZ recorded_at
    }
    seller_scorecard_occurrences {
        BIGSERIAL id PK
        TEXT seller_id
        TEXT shipment_id
        TEXT occurrence_type "DISCREPANCY, VIOLATION"
        TEXT code
        TIMESTAMPTZ recorded_at
    }
```

Outbox, inbox and idempotency (infrastructure tables):

```mermaid
erDiagram
    outbox_events {
        BIGSERIAL id PK
        TEXT event_id "UNIQUE with topic"
        TEXT topic
        TEXT event_type "full CloudEvents type"
        TEXT subject
        BYTEA value "encoded CloudEvent"
        TIMESTAMPTZ published_at "nullable"
        INTEGER attempts
    }
    processed_events {
        TEXT event_id PK "CloudEvents id"
        TEXT event_type
        TIMESTAMPTZ processed_at
    }
    idempotency_keys {
        TEXT route PK
        TEXT key PK
        TEXT request_hash
        INTEGER status_code "nullable"
        TIMESTAMPTZ created_at "purged after 24 hours"
    }
```

Derived from: the two migrations above, model.yaml →
contexts[seller-inbound].aggregates, .read_models, conventions.idempotency.
Eleven tables (nine in 0001, two in 0002) and one sequence.
