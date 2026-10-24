---
id: entity-relationship
title: Entity Relationship
sidebar_label: Entity Relationship
description: "The proposed Postgres schema of Seller Inbound's own database."
---

# Entity Relationship

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet, and unlike the other ten contexts it has no reference service: it is design only ([ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)). Identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

The **proposed** schema of this context's own Postgres database ("every
context owns its database; no shared tables"). A relationship line is drawn
only where a foreign key would exist, and foreign keys exist only inside one
aggregate.

Seller and plan aggregates:

```mermaid
erDiagram
    inbound_plans ||--|{ inbound_plan_lines : "FK plan_id"
    sellers {
        TEXT seller_id PK "ownerRef"
        TEXT name
        TEXT state "ACTIVE, SUSPENDED"
        BIGINT version
    }
    inbound_plans {
        TEXT plan_id PK
        TEXT seller_id "by value"
        TEXT destination_node_id "by value"
        TEXT packing_option "INDIVIDUAL, CASE_PACKED"
        TEXT state "DRAFT, CONFIRMED, CANCELLED"
        BIGINT version
    }
    inbound_plan_lines {
        TEXT plan_id PK,FK
        INTEGER line_no PK
        TEXT catalog_item_id
        CHAR14 gtin
        INTEGER qty_eaches "above 0"
    }
```

Shipment aggregate:

```mermaid
erDiagram
    inbound_shipments ||--|{ cartons : "FK shipment_id"
    cartons ||--|{ carton_contents : "FK sscc"
    inbound_shipments {
        TEXT shipment_id PK
        TEXT plan_id "by value"
        TEXT node_id "by value"
        TEXT state "six states"
        BIGINT version
    }
    cartons {
        CHAR18 sscc PK "UNIQUE network-wide"
        TEXT shipment_id FK
        CHAR18 parent_sscc "nullable"
        TEXT kind "HOMOGENEOUS_CASE, MIXED"
        INTEGER gross_weight_g
        INTEGER dim_mm "l, w, h as three columns"
        BOOLEAN sealed
        TEXT label_ref
        TEXT receipt_status "nullable"
    }
    carton_contents {
        CHAR18 sscc PK,FK
        INTEGER line_no PK
        TEXT catalog_item_id
        CHAR14 gtin
        INTEGER qty_eaches
        TEXT lot "max 20"
        DATE expiry "nullable"
    }
```

Read models, outbox and inbox (all tables of this context only):

```mermaid
erDiagram
    node_inbound_view {
        TEXT node_id PK
        TEXT state "ACTIVE, SUSPENDED, RETIRED"
        BOOLEAN has_inbound
        INTEGER max_carton_weight_g
        BOOLEAN accepts_pallets
        BOOLEAN requires_sscc
    }
```

```mermaid
erDiagram
    catalog_packaging_view {
        TEXT catalog_item_id PK
        TEXT level PK "EACH, INNER, CASE, PALLET"
        CHAR14 gtin
        INTEGER units_per_pack
        DATE effective_to "nullable"
        BOOLEAN item_live
    }
```

```mermaid
erDiagram
    outbox_events {
        BIGSERIAL id PK
        TEXT event_type "full CloudEvents type"
        TEXT event_key
        JSONB payload
    }
```

```mermaid
erDiagram
    processed_events {
        TEXT event_id PK "CloudEvents id"
    }
    idempotency_keys {
        TEXT route PK
        TEXT key PK
        TIMESTAMPTZ expires_at "24 hours"
    }
```

Derived from: model.yaml → contexts[seller-inbound].aggregates,
.read_models, conventions.idempotency. Estimates: one row per shipment, one
per carton and its contents, retained for audit.
