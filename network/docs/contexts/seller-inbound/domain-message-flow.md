---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: "Domain Message Flow diagrams for Seller Inbound: a case-packed shipment end to end, a receipt with a discrepancy, and SSCC issuance."
---

# Domain Message Flow

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet, and unlike the other ten contexts it has no reference service: it is design only ([ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)). Identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Every arrow is a message from the model, prefixed `cmd:`, `evt:` or `qry:`.
Quantities and identifiers in the notes are illustrative. Full types are on
[Domain Events](/network/contexts/seller-inbound/domain-events).

## 1. A case-packed shipment, plan to close

### 1a. Plan and pack

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant S as seller
    participant OA as offer-<br/>availability
    participant NT as node-<br/>topology
    participant SI as seller-inbound
    OA->>SI: evt: CatalogItemPackagingDeclared<br/>CASE level holds 12 eaches
    NT->>SI: evt: NodeOperationalProfileDeclared<br/>inbound limits
    S->>SI: cmd: CreateInboundPlan<br/>CASE_PACKED, 36 eaches
    S->>SI: cmd: ConfirmInboundPlan
    SI-->>S: InboundPlanConfirmed
    S->>SI: cmd: CreateInboundShipment
    S->>SI: cmd: AddCarton x3<br/>12 eaches each
    SI-->>S: SSCC and label per carton
    S->>SI: cmd: LabelShipment
```

### 1b. Ship and receive

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant S as seller
    participant SI as seller-inbound
    participant VC as vendor-<br/>connectivity
    participant V as vendor
    participant NP as node-<br/>performance
    S->>SI: cmd: ShipInboundShipment
    SI->>VC: evt: InboundShipmentLabelled<br/>carton manifest
    SI->>VC: evt: InboundShipmentShipped
    V->>VC: qry: PollInboundShipments
    V->>VC: cmd: SubmitInboundReceipt<br/>3 cartons RECEIVED
    VC-->>V: 202 and transactionId
    VC->>SI: evt: InboundReceiptSubmitted
    VC->>NP: evt: InboundReceiptSubmitted
    Note over SI: RecordInboundReceipt<br/>nothing differs
    Note over SI: InboundShipmentReceived<br/>status CLOSED
```

## 2. A receipt with a discrepancy

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant V as vendor
    participant VC as vendor-<br/>connectivity
    participant SI as seller-inbound
    V->>VC: cmd: SubmitInboundReceipt<br/>1 MISSING, 1 DAMAGED,<br/>complianceCodes on one
    VC->>SI: evt: InboundReceiptSubmitted
    Note over SI: RecordDiscrepancies<br/>the manifest is not edited
    Note over SI: InboundDiscrepancyRecorded<br/>per carton
    Note over SI: SellerComplianceViolation-<br/>Recorded per code
    Note over SI: InboundShipmentReceived<br/>CLOSED_WITH_DISCREPANCY
```

## 3. SSCC issuance

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant S as seller
    participant SI as seller-inbound
    S->>SI: cmd: AddCarton with sscc
    alt valid and unique
        SI-->>S: accepted, label returned
    else invalid or already used
        SI-->>S: ErrInvalidSscc or ErrSsccNotUnique
    end
    S->>SI: cmd: AddCarton without sscc
    SI-->>S: SSCC issued from the<br/>network GS1 prefix, label returned
```

Derived from: model.yaml → contexts[seller-inbound].policies (`SsccIssuance`,
`ReceiveOnVendorReceipt`, `RecordDiscrepancies`), .publishes, .consumes;
contexts[vendor-connectivity].publishes[InboundReceiptSubmitted].
