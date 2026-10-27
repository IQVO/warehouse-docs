---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: "One UML sequence per key Seller Inbound command use case, from inbound adapter through aggregate, repository and outbox."
---

# Sequence Diagrams

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built ([`IQVO/seller-inbound`](https://github.com/IQVO/seller-inbound), designed by [ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses. Where the model left a choice open, the service's own ADRs 0002 to 0005 record what it does.
:::

Shared conventions: `Repo` saves with `WHERE version = :expected`; `Outbox`
rows are written in the same database transaction as the aggregate; a relay
produces them to Kafka `retailnetwork.seller-inbound.events` (the six
analytics-only events to `retailnetwork.seller-inbound.analytics`). Consumers claim
the CloudEvents `id` in `processed_events` in the same transaction as their
effect. Event names are short; the full types are on
[Domain Events](/network/contexts/seller-inbound/domain-events).

## 1. AddCarton

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http POST cartons
    participant UC as AddCarton
    participant V as read models
    participant A as InboundShipment
    participant R as ShipmentRepo
    H->>UC: Execute(shipmentId, carton, key)
    UC->>R: FindById(shipmentId)
    UC->>V: node limits and CASE level
    UC->>A: AddCarton(carton, limits, pack)
    alt rule broken
        A-->>UC: ErrCaseQtyMismatchesGtin or ErrCartonOverweight<br/>or ErrSsccNotUnique
        UC-->>H: 422 or 409 problem+json
    else accepted
        A-->>UC: carton with SSCC and label
        UC->>R: Save(expected version)
        UC-->>H: 201 carton and label
    end
```

## 2. ShipInboundShipment

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http POST ship
    participant UC as ShipInboundShipment
    participant A as InboundShipment
    participant R as ShipmentRepo
    participant OB as Outbox
    participant K as Relay + Kafka
    H->>UC: Execute(shipmentId, key)
    UC->>R: FindById(shipmentId)
    UC->>A: Ship()
    alt not LABELLED
        A-->>UC: ErrShipmentNotLabelled
        UC-->>H: 409 shipment-not-labelled
    else LABELLED
        A-->>UC: SHIPPED and InboundShipmentShipped
        UC->>R: Save(expected version)
        UC->>OB: write event in the same transaction
        UC-->>H: 200 shipment
        OB->>K: relay publishes later
    end
```

## 3. RecordInboundReceipt (consumer)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant K as Kafka
    participant C as consumer
    participant IB as processed_events
    participant UC as RecordInboundReceipt
    participant A as InboundShipment
    participant OB as Outbox
    K->>C: InboundReceiptSubmitted
    C->>IB: claim event id
    alt already processed
        IB-->>C: duplicate
        C-->>K: ack and skip
    else new
        C->>UC: Execute(receipt)
        UC->>A: RecordReceipt(receipt)
        A-->>UC: statuses, discrepancies,<br/>RECEIVING or closed
        UC->>OB: discrepancy and violation events
        UC->>OB: InboundShipmentReceived when closed
        C-->>K: ack after commit
    end
```
