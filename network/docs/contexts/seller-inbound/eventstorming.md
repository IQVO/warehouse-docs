---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: "Process-level EventStorming boards for Seller Inbound, from a seller's plan to a closed shipment, with hotspots taken from the gap register."
---

# EventStorming

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet, and unlike the other ten contexts it has no reference service: it is design only ([ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)). Identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Process-level boards in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky comes from `model.yaml`; every hotspot is a gap in
the [gap register](/network/strategic-design/model-gap-register). The network-wide
board is [EventStorming big picture](/network/strategic-design/eventstorming-big-picture).

| Sticky | Colour | Meaning here |
| --- | --- | --- |
| Command | blue `#a5d8ff` | `CreateInboundPlan`, `AddCarton`, `LabelShipment`... |
| Aggregate | yellow `#ffec99` | `InboundPlan`, `InboundShipment` |
| Domain Event | orange `#ffc078` | an event published or consumed |
| Policy | lilac `#d0bfff` | a rule from `policies` |
| Read Model | green `#b2f2bb` | `NodeInboundView`, `CatalogPackagingView` |
| External System | pink `#fcc2d7` | another context or an actor |
| Hotspot | red `#ff8787` | an open question |

## 1. Plan and confirm

```mermaid
flowchart TB
    S["seller"]:::external
    C1["CreateInboundPlan"]:::command
    R1["NodeInboundView"]:::readmodel
    R2["CatalogPackagingView"]:::readmodel
    G1["InboundPlan"]:::aggregate
    E1["InboundPlanConfirmed"]:::event
    S --> C1 --> G1 --> E1
    R1 --- G1
    R2 --- G1
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

## 2. Pack, label, ship

```mermaid
flowchart TB
    S["seller"]:::external
    C2["AddCarton"]:::command
    P1["Policy: SsccIssuance"]:::policy
    G2["InboundShipment<br/>Carton"]:::aggregate
    C3["LabelShipment"]:::command
    E2["InboundShipmentLabelled"]:::event
    C4["ShipInboundShipment"]:::command
    E3["InboundShipmentShipped"]:::event
    H1["Hotspot: who creates<br/>owner-scoped listings?"]:::hotspot
    S --> C2 --> G2
    P1 --- C2
    S --> C3 --> G2 --> E2
    S --> C4 --> G2 --> E3
    E3 --- H1
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

## 3. Receipt and reconciliation

```mermaid
flowchart TB
    V["vendor"]:::external
    E1["InboundReceiptSubmitted"]:::event
    P1["Policy: ReceiveOnVendorReceipt"]:::policy
    C1["RecordInboundReceipt"]:::command
    G1["InboundShipment"]:::aggregate
    P2["Policy: RecordDiscrepancies"]:::policy
    E2["InboundShipmentReceived"]:::event
    E3["InboundDiscrepancyRecorded"]:::event
    E4["SellerComplianceViolationRecorded"]:::event
    H1["Hotspot: shipment never<br/>received?"]:::hotspot
    H2["Hotspot: no compliance<br/>score or consumer"]:::hotspot
    V --> E1 --> P1 --> C1 --> G1
    P2 --- G1
    G1 --> E2
    G1 --> E3
    G1 --> E4
    G1 --- H1
    E4 --- H2
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

## Hotspots

| Hotspot | Where it comes from |
| --- | --- |
| Who creates owner-scoped listings from received stock | Gap G51 |
| A shipped shipment that is never received | Gap G50 |
| Violations are recorded and nothing consumes them | Gap G42 |
