---
id: entity-relationship
title: Entity Relationship
sidebar_label: Entity Relationship
description: The proposed Postgres schema of Vendor Connectivity - one table per aggregate root with its child tables, the two read-model tables, and the outbox, inbox and migration infrastructure.
---

# Entity Relationship

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

The **proposed** schema of this context's own database. No other context
reads it ("every context owns its database; no shared tables"). A line is
drawn only for a foreign key, and foreign keys exist only inside one
aggregate.

## Aggregates

### VendorAccount

```mermaid
erDiagram
    vendor_accounts {
        TEXT vendor_id PK "for example V-WS"
        TEXT name
        INTEGER ack_window_minutes "CHECK 60 to 1440"
        TEXT state "CHECK ACTIVE, SUSPENDED"
        TIMESTAMPTZ onboarded_at
        INTEGER version "optimistic concurrency"
    }
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[VendorAccount]`, `.publishes[VendorOnboarded].data`.

### PurchaseOrder

```mermaid
erDiagram
    purchase_orders ||--|{ purchase_order_lines : "FK po_number"
    purchase_orders ||--o{ purchase_order_labels : "FK po_number"
    purchase_orders {
        TEXT po_number PK "from assignment_id, release_no"
        TEXT assignment_id UK "UK with release_no"
        INTEGER release_no UK "UK with assignment_id"
        TEXT vendor_id "by value"
        TEXT node_id "by value"
        TIMESTAMPTZ issued_at
        TIMESTAMPTZ required_ship_by
        TIMESTAMPTZ ack_by "fixed at issue"
        TEXT state "CHECK the 8 PO states"
        TEXT ack_decision "nullable, ACCEPT or REJECT"
        TEXT reject_reason "nullable, CHECK the 4 reason codes"
        TEXT ack_transaction_id "nullable, by value"
        TIMESTAMPTZ accepted_at "nullable"
        TIMESTAMPTZ rejected_at "nullable"
        TEXT shipment_transaction_id "nullable, by value"
        TEXT_ARRAY tracking_numbers "confirmed shipped"
        TIMESTAMPTZ shipped_at "nullable"
        TEXT cancel_reason "nullable"
        INTEGER version "optimistic concurrency"
    }
    purchase_order_lines {
        TEXT po_number PK,FK
        INTEGER line_no PK
        TEXT listing_id
        INTEGER quantity "CHECK quantity > 0"
    }
    purchase_order_labels {
        TEXT po_number PK,FK
        INTEGER package_no PK
        TEXT label_ref UK
        TEXT tracking_number UK
        TEXT carrier
    }
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[PurchaseOrder]`, `.publishes[*].data`, `.policies[IssueOnRelease]`.

### Submission

```mermaid
erDiagram
    submissions ||--o{ submission_errors : "FK transaction_id"
    submissions {
        TEXT transaction_id PK
        TEXT vendor_id UK "UK with idempotency_key"
        TEXT idempotency_key UK "UK with vendor_id"
        TEXT kind "CHECK the 5 kinds"
        TEXT status "CHECK PROCESSING, SUCCESS, FAILURE"
        JSONB payload "the write, no ship-to PII"
        TEXT po_number "nullable, by value"
        TEXT node_id "nullable, by value"
        TIMESTAMPTZ received_at
        TIMESTAMPTZ not_before "received_at + TX_PROCESSING_DELAY"
        TIMESTAMPTZ processed_at "nullable"
        INTEGER version "optimistic concurrency"
    }
    submission_errors {
        TEXT transaction_id PK,FK
        INTEGER error_no PK
        TEXT code "own or downstream Err name"
        TEXT message
        TEXT path "nullable"
    }
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[Submission]`
(`root_id`, `states`, `value_objects`, `invariants`), `.publishes[SubmissionProcessed].data`,
`.policies[SimulationKnobs]`.

Omitted from the three aggregate diagrams: indexes (proposed: `purchase_orders (state, ack_by)` for the
expiry sweep, `purchase_orders (node_id, issued_at)` for the poll,
`submissions (status, not_before)` for the processor). `TEXT_ARRAY` stands
for `TEXT[]`, because Mermaid needs one token. `vendor_accounts` has no
child table: the nodes a vendor operates live in `rm_vendor_nodes`.

## Read models and infrastructure

### Read models

```mermaid
erDiagram
    rm_vendor_nodes {
        TEXT node_id PK
        TEXT vendor_id "nullable for network nodes"
        TEXT vendor_node_code
        TEXT node_type
        TEXT subtype "nullable"
        TEXT operator "VENDOR or NETWORK"
        TEXT status "PROPOSED, ACTIVE, SUSPENDED, RETIRED"
        TEXT region_id
        TEXT timezone
        TIMESTAMPTZ updated_at "last applied event time"
    }
    rm_listings {
        TEXT listing_id PK
        TEXT catalog_item_id
        TEXT node_id
    }
```

Derived from: `model.yaml → contexts[vendor-connectivity].read_models`; `contexts[node-topology].publishes[NodeRegistered].data`; `contexts[offer-availability].publishes[ListingCreated].data`.

### Infrastructure

```mermaid
erDiagram
    outbox_events {
        BIGSERIAL id PK
        TEXT topic "retailnetwork.vendor-connectivity.events"
        TEXT event_type "full CloudEvents type"
        TEXT event_key "aggregate root id"
        BYTEA value "CloudEvents JSON"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ published_at "nullable"
        INTEGER attempts
    }
```

Derived from: `model.yaml → conventions.integration_rules` (transactional outbox), `conventions.cloudevents`.

```mermaid
erDiagram
    processed_events {
        TEXT event_id PK "CloudEvents id"
        TEXT event_type
        TIMESTAMPTZ processed_at
    }
    schema_migrations {
        BIGINT version PK
        BOOLEAN dirty
    }
```

Derived from: `model.yaml → conventions.integration_rules` ("every
consumer is idempotent on the CloudEvents id (inbox table)"); migration
bookkeeping is a convention of the fleet's Go services, not a model item.

**Infrastructure tables:** `outbox_events` (the transactional outbox, one
row per published event, drained by the relay), `processed_events` (the
consumer inbox, idempotent on the CloudEvents `id`), `schema_migrations`
(migration bookkeeping). They hold no domain state.

## Why there are no foreign keys across aggregates or contexts

- `purchase_orders.vendor_id` and `.node_id`, `submissions.po_number`,
  `.node_id` and `.vendor_id`, and the transaction ids on
  `purchase_orders` are **by-value** links. Each aggregate is loaded and
  saved on its own, with its own version; a foreign key would couple their
  lifecycles and their locks.
- `node_id`, `listing_id`, `assignment_id` and the `rm_` tables point at
  facts **owned by other contexts**. Those live in other databases; the
  local copies arrive by events and can lag. A foreign key would turn an
  event-ordering race into a failed write.
- `purchase_order_labels.label_ref` and `.tracking_number` are
  shipping-and-tracking's identifiers, held by value. The ship-to address
  is not stored anywhere in this database.

## Table ≠ aggregate

| Table | Aggregate / role | Notes |
| --- | --- | --- |
| `vendor_accounts` | **VendorAccount** (root) | One row per vendor. |
| `purchase_orders` | **PurchaseOrder** (root) | One row per release to a vendor node; `UK (assignment_id, release_no)` is the idempotency of `IssueOnRelease`. |
| `purchase_order_lines` | **PurchaseOrder** (`PoLine` value objects) | Written once at issue. |
| `purchase_order_labels` | **PurchaseOrder** (`Label` value objects) | One per package, added by `RequestLabel`. |
| `submissions` | **Submission** (root) | Retained 30 days; `UK (vendor_id, idempotency_key)` backs the `Idempotency-Key` header for asynchronous writes. |
| `submission_errors` | **Submission** (`SubmissionError` value objects) | Written once with the outcome. |
| `rm_vendor_nodes` | none (read model `VendorNodeView`) | Fed by node-topology events. |
| `rm_listings` | none (read model `ListingView`) | Fed by offer-availability `ListingCreated`. |
| `outbox_events` | none (infrastructure) | Same transaction as the aggregate change. |
| `processed_events` | none (infrastructure) | Same transaction as the consumer's effect. |
| `schema_migrations` | none (infrastructure) | Migration tool bookkeeping. |
