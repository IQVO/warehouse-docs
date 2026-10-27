---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: "UML class diagrams of the proposed Seller Inbound domain model and its hexagonal layout."
---

# Class Diagram

:::info[Proposed design]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). Nothing in this context is built yet, and unlike the other ten contexts it has no reference service: it is design only ([ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)). Identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

UML class diagrams of the **proposed** Go domain model in
`internal/domain/seller` and `internal/domain/inbound`. Fields are shown
unexported (`-`), methods exported (`+`).

## 1. InboundShipment aggregate

```mermaid
classDiagram
    direction TB
    class InboundShipment {
        <<AggregateRoot>>
        -id ShipmentId
        -planId PlanId
        -sellerId SellerId
        -nodeId NodeId
        -state State
        -cartons Carton[]
        -version int
        +AddCarton(c Carton, limits InboundLimits, pack CatalogPackaging) error
        +Label(planLines PlanLine[]) error
        +Ship() error
        +RecordReceipt(r Receipt) error
        +PendingEvents() DomainEvent[]
    }
    class Carton {
        <<Entity>>
        -sscc Sscc
        -parentSscc Sscc nullable
        -kind CartonKind
        -contents CartonContent[]
        -grossWeightG int
        -dims Dims
        -sealed bool
        -receiptStatus CartonReceiptStatus nullable
    }
    class CartonContent {
        <<ValueObject>>
        -catalogItemId CatalogItemId
        -gtin Gtin
        -qtyEaches int
        -lot string nullable
        -expiry Date nullable
    }
    InboundShipment "1" *-- "1..*" Carton
    Carton "1" *-- "1..*" CartonContent
```

## 2. Plan, seller and identifiers

```mermaid
classDiagram
    direction LR
    class SellerAccount {
        <<AggregateRoot>>
        -id SellerId
        -name string
        -state State
        +Suspend() error
        +Reinstate() error
    }
    class InboundPlan {
        <<AggregateRoot>>
        -id PlanId
        -sellerId SellerId
        -destinationNodeId NodeId
        -packingOption PackingOption
        -lines PlanLine[]
        -state State
        +Confirm() error
        +Cancel() error
    }
    class PlanLine {
        <<ValueObject>>
        -catalogItemId CatalogItemId
        -gtin Gtin
        -qtyEaches int
    }
    class Gtin {
        <<ValueObject>>
        -digits14 string
        +ParseGtin(s string)$ Gtin
    }
    class Sscc {
        <<ValueObject>>
        -digits18 string
        +ParseSscc(s string)$ Sscc
    }
    InboundPlan "1" *-- "1..*" PlanLine
    PlanLine --> Gtin
    InboundPlan ..> SellerAccount : sellerId
```

`ParseGtin` accepts 8, 12, 13 or 14 digits, checks the mod-10 digit and
returns the 14-digit form; `ParseSscc` accepts exactly 18 digits with a valid
mod-10 digit. A service never trusts a client-supplied check digit.

## 3. Hexagonal layout

```mermaid
flowchart TB
    subgraph IN["inbound adapters"]
        HTTP["http seller API"]
        CONS["kafka consumers"]
    end
    subgraph APP["application"]
        UC["use cases"]
    end
    subgraph DOM["domain"]
        AGG["seller, inbound"]
    end
    subgraph OUT["outbound adapters"]
        PG["postgres repos<br/>outbox, inbox"]
        RELAY["outbox relay to kafka"]
    end
    HTTP --> UC
    CONS --> UC
    UC --> AGG
    UC --> PG
    PG --> RELAY
```
