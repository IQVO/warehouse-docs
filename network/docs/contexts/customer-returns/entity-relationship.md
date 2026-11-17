---
id: entity-relationship
title: Entity Relationship
sidebar_label: Entity Relationship
description: "A logical view of the tables of Customer Returns' own database, limited to what the service's ADRs name."
---

# Entity Relationship

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built ([`IQVO/customer-returns`](https://github.com/IQVO/customer-returns), decided by [ADR 0012](/network/adr/0012-customer-returns-is-a-bounded-context)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses. Where the model left a choice open, the service's own ADRs 0001 to 0005 record what it does.
:::

This context owns its Postgres database ("every context owns its database;
no shared tables"). This page is a **logical view**: it shows the tables the
service's ADRs 0002 to 0004 name and the fields the model lists for them.
Physical column names and types live in the service's migrations (`0001`
the schema, `0002` the outbox) and are not copied here. Ids of other
contexts' aggregates are held by value; there are no foreign keys to them.

The aggregate. The ADRs do not name its table, so the entity carries the
aggregate's name:

```mermaid
erDiagram
    ReturnAuthorization {
        string authorizationId PK "ret- prefix, minted by the service"
        string orderId "by value"
        int groupNo
        json lines "lineNo, catalogItemId, quantity, unitPriceCents, ownerRef"
        string reason "enum"
        string disposition "KEEP, NEAREST_RETURNS_CENTER, ORIGIN_NODE"
        string method "DROP_OFF, PICKUP"
        string destinationNodeId "empty for KEEP"
        string originNodeId "empty until a sourcing fact named it"
        timestamp pickupWindowStart "PICKUP only"
        timestamp pickupWindowEnd "PICKUP only"
        json trackingNumbers "at most five"
        string state "six states"
        timestamp authorizedAt
        timestamp expiresAt "authorizedAt plus 30 days"
        timestamp closedAt "set by every terminal state"
        int version
    }
```

Schema checks mirror three invariants (service ADR 0002): a `KEEP` has no
destination, a `PICKUP` has a window inside the validity interval and is not
a `KEEP`, and a terminal state has `closedAt`.

Read models fed by consumed events (service ADR 0003):

```mermaid
erDiagram
    order_group_views {
        string orderId PK
        int groupNo PK
        string status "PROMISED, SHIPPED, DELIVERED, LOST, RETURNED"
        string destinationPostalPrefix "the prefix, never the address"
        string witnessNodeId
        json lines "lineNo, catalogItemId, quantity"
    }
    returns_network_nodes {
        string nodeId PK
        string nodeType "only RETURNS_CENTER matters"
        string lifecycle "only ACTIVE is a candidate"
        string regionId
    }
    service_area_prefixes {
        string postalPrefix PK
        string regionId
        int assignmentVersion "the highest wins"
    }
    group_origins {
        string orderId PK
        int groupNo PK
        string nodeId "the fulfilling node"
        json ownersByItem "catalogItemId to ownerRef"
    }
    order_group_views ||--o| group_origins : "same group, by value"
    service_area_prefixes }o--|| returns_network_nodes : "region, by value"
```

Outcome facts and infrastructure:

```mermaid
erDiagram
    return_outcomes {
        string authorizationId "by value, may be unknown"
        string nodeId
        timestamp receivedAt
        json lines "catalogItemId, ownerRef, qtyRestockable, qtyUnsellable, unexpected"
    }
    processed_events {
        string eventId PK "the CloudEvents id"
    }
    outbox_events {
        string eventId PK "minted when appended"
        json envelope "already encoded"
    }
    ReturnAuthorization ||--o{ return_outcomes : "graded by"
    ReturnAuthorization ||--o{ outbox_events : "raises"
```

Derived from: model.yaml → contexts[customer-returns].aggregates[ReturnAuthorization],
.read_models; the table names from the service's ADRs 0002, 0003 and 0004.

Omitted: the idempotency table every context keeps
(`conventions.idempotency`), and every physical detail (indexes, check
constraint names, column types).
