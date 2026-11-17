---
id: class-diagram
title: Class Diagram
sidebar_label: Class Diagram
description: "UML class diagrams of the Customer Returns domain model and its hexagonal layout, with the as-built package names."
---

# Class Diagram

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built ([`IQVO/customer-returns`](https://github.com/IQVO/customer-returns), decided by [ADR 0012](/network/adr/0012-customer-returns-is-a-bounded-context)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses. Where the model left a choice open, the service's own ADRs 0001 to 0005 record what it does.
:::

UML class diagrams of the domain model. Fields are shown unexported (`-`),
methods exported (`+`). As built, the service keeps the aggregate in
`internal/domain/returnauthorization` and the read-model value types in
`internal/domain/network`; the class names below are the model's names, the
Go types are on
[Ubiquitous Language](/network/contexts/customer-returns/ubiquitous-language).

## 1. ReturnAuthorization aggregate

```mermaid
classDiagram
    direction TB
    class ReturnAuthorization {
        <<AggregateRoot>>
        -authorizationId string
        -orderId string
        -groupNo int
        -lines ReturnLine[]
        -reason ReturnReason
        -disposition Disposition
        -method ReturnMethod
        -destinationNodeId string
        -originNodeId string
        -pickupWindow PickupWindow
        -trackingNumbers string[]
        -state State
        -authorizedAt Time
        -expiresAt Time
        -closedAt Time
        -version int
        +Authorize(input, now)$ ReturnAuthorization
        +LinkLabel(trackingNumber, now) error
        +MarkInTransit() error
        +ApplyOutcome(lines OutcomeLine[], nodeId, now) error
        +Cancel(reason CancelReason, now) error
        +MarkPickupFailed(now) error
        +Expired(now) bool
    }
    class ReturnLine {
        <<ValueObject>>
        -lineNo int
        -catalogItemId string
        -quantity int
        -unitPriceCents int nullable
        -ownerRef string
    }
    class PickupWindow {
        <<ValueObject>>
        -pickupWindowStart Time
        -pickupWindowEnd Time
    }
    class OutcomeLine {
        <<ValueObject>>
        -catalogItemId string
        -ownerRef string
        -qtyRestockable int
        -qtyUnsellable int
    }
    class Disposition {
        <<Enumeration>>
        KEEP
        NEAREST_RETURNS_CENTER
        ORIGIN_NODE
    }
    class ReturnMethod {
        <<Enumeration>>
        DROP_OFF
        PICKUP
    }
    class ReturnReason {
        <<Enumeration>>
        DEFECTIVE
        NOT_AS_DESCRIBED
        WRONG_ITEM
        NOT_NEEDED
        OTHER
    }
    class CancelReason {
        <<Enumeration>>
        SHOPPER_REQUESTED
        EXPIRED
    }
    ReturnAuthorization "1" *-- "1..50" ReturnLine
    ReturnAuthorization "1" *-- "0..1" PickupWindow
    ReturnAuthorization ..> OutcomeLine : applies
    ReturnAuthorization --> Disposition
    ReturnAuthorization --> ReturnMethod
    ReturnAuthorization --> ReturnReason
    ReturnAuthorization ..> CancelReason
```

Derived from: model.yaml → contexts[customer-returns].aggregates[ReturnAuthorization]
(`value_objects`, `commands`, `states`).

## 2. The decision and the read models

```mermaid
classDiagram
    direction LR
    class Decide {
        <<DomainService>>
        +Decide(lines, method, nearestNodeId, originNodeId)$ Disposition
    }
    class OrderGroupView {
        <<ReadModel>>
        -orderId string
        -groupNo int
        -status GroupStatus
        -destinationPostalPrefix string
        -witnessNodeId string
        -lines GroupLine[]
    }
    class ReturnsNetworkView {
        <<ReadModel>>
        -nodes ReturnsCentre[]
        -prefixes PrefixAssignment[]
        -origins GroupOrigin[]
    }
    class ReturnOutcomeFacts {
        <<ReadModel>>
        -authorizationId string
        -nodeId string
        -receivedAt Time
        -lines OutcomeFactLine[]
    }
    Decide ..> OrderGroupView : the group and its prefix
    Decide ..> ReturnsNetworkView : returns centre and origin node
    ReturnOutcomeFacts ..> Decide : never read by it
```

Derived from: model.yaml → contexts[customer-returns].read_models,
.policies[DispositionDecidedAtAuthorization].

## 3. Hexagonal layout

```mermaid
flowchart LR
    subgraph IN["inbound adapters"]
        H["http: return-authorizations"]
        K["kafka: four consumers"]
        M["mcp and a2a: reads only"]
    end
    subgraph APP["application"]
        U["usecases: AuthorizeReturn, IssueLabel,<br/>CancelReturn, outcome and view consumers,<br/>reads"]
    end
    subgraph DOM["domain"]
        D["returnauthorization: aggregate, Decide,<br/>events, invariants<br/>network: read-model value types"]
    end
    subgraph OUT["outbound adapters"]
        P["postgres: aggregate, read models,<br/>outbox, inbox"]
        L["labels: the reverse-label client"]
        R["kafka: outbox relay"]
    end
    H --> U
    K --> U
    M --> U
    U --> D
    U --> P
    U --> L
    P --> R
```

Derived from: the service's ADRs 0002 to 0006 (package names) and
model.yaml → contexts[customer-returns].inbound, .policies[ReverseLabelCall].
