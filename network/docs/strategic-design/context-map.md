---
id: context-map
title: Context Map
sidebar_label: Context Map
description: "Every relationship between the ten retail-network bounded contexts and the one seam to the warehouse-systems fleet, with the ddd-crew context-mapping pattern on each edge."
---

# Context Map

:::info[Generated from the model]
This page is generated from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
:::


Following the ddd-crew [Context Mapping](https://github.com/ddd-crew/context-mapping)
notation. On every edge, **U** is upstream and **D** downstream; the pattern
names how the downstream relates to the upstream's model: **OHS** Open Host
Service, **PL** Published Language, **CF** Conformist, **ACL** Anti-Corruption
Layer, **C/S** Customer/Supplier. Thick arrows are Kafka events (CloudEvents
1.0), thin arrows synchronous in-organization REST calls. The map is split
into four views so each stays readable; an edge label such as `CF 3e +REST`
reads "Conformist, three events, plus a synchronous call". The table under the
views lists every edge with its messages.

## The organizational seam

The network and the warehouse-systems fleet are two organizations. The only
channel between them is the Vendor API of `vendor-connectivity`.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 16, "rankSpacing": 40, "padding": 6}}}%%
flowchart TB
    classDef sup fill:#dbeafe,stroke:#1e40af,color:#172554
    classDef ext fill:#ffe3e3,stroke:#c92a2a,color:#000
    classDef fleet fill:#ccfbf1,stroke:#0f766e,color:#042f2e
    subgraph RN["retail-network organization"]
        VC["vendor-connectivity<br/>OHS + PL<br/>Vendor API"]:::sup
    end
    subgraph WS["warehouse-systems organization"]
        NF["network-fulfillment<br/>CF + ACL"]:::fleet
        OM["order-management"]:::fleet
        PPM["process-path-management"]:::fleet
        WWP["wes-work-planning"]:::fleet
        INV["inventory-storage"]:::fleet
    end
    NF -->|"REST: poll POs, acknowledge,<br/>inventory feed, node profile,<br/>labels, shipment confirmation"| VC
    NF -->|"held order, FeasibleBy,<br/>release, cancel"| OM
    PPM ==>|"CPT schedule,<br/>cycle time p95"| NF
    WWP ==>|"PathCapacityChanged"| NF
    NF -.->|"usable stock"| INV
```

Derived from: `model.yaml` → `meta.hard_boundary`,
`contexts[vendor-connectivity].inbound`; the fleet side from
`IQVO/network-fulfillment` `internal/application/ports/ports.go` on
`origin/develop`. Separate Ways at the messaging level: no Kafka topic is
shared in either direction. Details on
[WMS/WES Integration](/network/integration/wms-wes-integration).

## Commerce view: promise, order, sourcing

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 22, "rankSpacing": 56, "padding": 6}}}%%
flowchart TB
    classDef core fill:#1e3a8a,stroke:#1e3a8a,color:#fff
    classDef sup fill:#dbeafe,stroke:#1e40af,color:#172554
    classDef gen fill:#f1f5f9,stroke:#64748b,color:#0f172a
    classDef ext fill:#ffe3e3,stroke:#c92a2a,color:#000
    CO["customer-ordering"]:::gen
    DP["delivery-promise"]:::core
    OS["order-sourcing"]:::core
    OA["offer-availability"]:::sup
    VC["vendor-connectivity"]:::sup
    OA ==>|"CF 6e"| DP
    OA ==>|"CF 5e"| OS
    OA ==>|"C/S + CF 1e +REST"| VC
    DP ==>|"C/S 4e +REST"| CO
    DP ==>|"C/S 2e"| OS
    CO ==>|"C/S 2e"| OS
    CO ==>|"C/S 2e"| DP
    OS ==>|"C/S 2e"| VC
    OS ==>|"C/S 2e"| DP
    OS ==>|"CF 3e"| CO
    VC ==>|"C/S 4e"| OS
```

Derived from: `model.yaml` → `contexts[*].publishes[*].consumers`, `contexts[*].sync_calls`, `contexts[*].inbound[*].relationship`.

## Logistics view: topology, middle mile, last mile, tracking

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 22, "rankSpacing": 56, "padding": 6}}}%%
flowchart TB
    classDef core fill:#1e3a8a,stroke:#1e3a8a,color:#fff
    classDef sup fill:#dbeafe,stroke:#1e40af,color:#172554
    classDef gen fill:#f1f5f9,stroke:#64748b,color:#0f172a
    classDef ext fill:#ffe3e3,stroke:#c92a2a,color:#000
    NT["node-topology"]:::sup
    LH["linehaul-transportation"]:::sup
    LM["last-mile-delivery"]:::sup
    ST["shipping-and-tracking"]:::gen
    VC["vendor-connectivity"]:::sup
    NT ==>|"CF 7e"| LH
    NT ==>|"CF 2e"| LM
    NT ==>|"C/S + CF 4e +REST"| VC
    VC ==>|"C/S 1e"| ST
    LH ==>|"CF 2e"| ST
    LH ==>|"C/S 1e"| LM
    LM ==>|"CF 2e"| ST
    ST ==>|"CF 1e"| LH
    ST -->|"C/S +REST"| VC
```

Derived from: same sections as above.

## Feedback view: what feeds the two Core contexts

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 22, "rankSpacing": 56, "padding": 6}}}%%
flowchart TB
    classDef core fill:#1e3a8a,stroke:#1e3a8a,color:#fff
    classDef sup fill:#dbeafe,stroke:#1e40af,color:#172554
    classDef gen fill:#f1f5f9,stroke:#64748b,color:#0f172a
    classDef ext fill:#ffe3e3,stroke:#c92a2a,color:#000
    NT["node-topology"]:::sup
    OA["offer-availability"]:::sup
    LH["linehaul-transportation"]:::sup
    LM["last-mile-delivery"]:::sup
    NP["node-performance"]:::sup
    DP["delivery-promise"]:::core
    OS["order-sourcing"]:::core
    NT ==>|"CF 4e"| OA
    NT ==>|"CF 9e"| DP
    NT ==>|"CF 9e"| OS
    NT ==>|"CF 7e"| LH
    NT ==>|"CF 2e"| LM
    NT ==>|"CF 2e"| NP
    OA ==>|"CF 6e"| DP
    OA ==>|"CF 5e"| OS
    OA ==>|"CF 1e"| NP
    DP ==>|"C/S 2e"| OS
    DP ==>|"CF 2e"| NP
    OS ==>|"C/S 4e"| LH
    OS ==>|"C/S 2e"| DP
    LH ==>|"CF 3e"| DP
    LH ==>|"CF 3e"| OS
    LH ==>|"C/S 1e"| LM
    LM ==>|"CF 2e"| DP
    LM ==>|"CF 2e"| OS
    NP ==>|"CF 1e"| DP
    NP ==>|"CF 1e"| OS
```

Derived from: same sections as above. Omitted from all views: analytics-only events, which have no integration consumer.

## Every edge

| Upstream | Downstream | Pattern | Events (Kafka) | Synchronous calls |
| --- | --- | --- | --- | --- |
| `customer-ordering` | `delivery-promise` | C/S | `CustomerOrderPlaced`, `CustomerOrderCancelled` | - |
| `customer-ordering` | `order-sourcing` | C/S | `CustomerOrderPlaced`, `CustomerOrderCancelled` | - |
| `customer-ordering` | `shipping-and-tracking` | C/S | - | qry GetShipTo (`REST GET /orders/{orderId}/ship-to`) |
| `delivery-promise` | `customer-ordering` | C/S | `PromiseAtRisk`, `PromiseRevised`, `PromiseKept`, `PromiseBroken` | qry QuoteDeliveryOffers (`REST POST /delivery-offers:quote`); cmd MakePromise (`REST POST /promises`) |
| `delivery-promise` | `node-performance` | CF | `PromiseKept`, `PromiseBroken` | - |
| `delivery-promise` | `order-sourcing` | C/S | `PromiseRevised`, `PromiseBookExhausted` | - |
| `last-mile-delivery` | `delivery-promise` | CF | `DeliveryWaveScheduled`, `DeliveryWaveCapacityChanged` | - |
| `last-mile-delivery` | `order-sourcing` | CF | `DeliveryWaveScheduled`, `DeliveryWaveCapacityChanged` | - |
| `last-mile-delivery` | `shipping-and-tracking` | CF | `PackageOutForDelivery`, `DeliveryAttempted` | - |
| `linehaul-transportation` | `delivery-promise` | CF | `DepartureScheduled`, `DepartureCapacityChanged`, `DepartureCancelled` | - |
| `linehaul-transportation` | `last-mile-delivery` | C/S | `LoadArrived` | - |
| `linehaul-transportation` | `order-sourcing` | CF | `DepartureScheduled`, `DepartureCapacityChanged`, `DepartureCancelled` | - |
| `linehaul-transportation` | `shipping-and-tracking` | CF | `LoadDeparted`, `LoadArrived` | - |
| `node-performance` | `delivery-promise` | CF | `NodeScorecardUpdated` | - |
| `node-performance` | `order-sourcing` | CF | `NodeScorecardUpdated` | - |
| `node-performance` | `vendor-connectivity` | C/S | - | qry GetScorecard (`REST GET /scorecards/{nodeId}`) |
| `node-topology` | `delivery-promise` | CF | `NodeRegistered`, `NodeOperationalProfileDeclared`, `NodeActivated`, `NodeSuspended`, `NodeRetired`, `LaneOpened`, `LaneClosed`, `ServiceAreaAssigned`, `RegionDefined` | - |
| `node-topology` | `last-mile-delivery` | CF | `NodeRegistered`, `ServiceAreaAssigned` | - |
| `node-topology` | `linehaul-transportation` | CF | `NodeRegistered`, `NodeOperationalProfileDeclared`, `NodeActivated`, `NodeSuspended`, `NodeRetired`, `LaneOpened`, `LaneClosed` | - |
| `node-topology` | `node-performance` | CF | `NodeRegistered`, `NodeOperationalProfileDeclared` | - |
| `node-topology` | `offer-availability` | CF | `NodeRegistered`, `NodeActivated`, `NodeSuspended`, `NodeRetired` | - |
| `node-topology` | `order-sourcing` | CF | `NodeRegistered`, `NodeOperationalProfileDeclared`, `NodeActivated`, `NodeSuspended`, `NodeRetired`, `LaneOpened`, `LaneClosed`, `ServiceAreaAssigned`, `RegionDefined` | - |
| `node-topology` | `vendor-connectivity` | C/S + CF | `NodeRegistered`, `NodeActivated`, `NodeSuspended`, `NodeRetired` | cmd RegisterNode, DeclareOperationalProfile (`REST POST /nodes, PUT /nodes/{nodeId}/operational-profile`) |
| `offer-availability` | `delivery-promise` | CF | `CatalogItemCreated`, `CatalogItemDiscontinued`, `ListingCreated`, `ListingAvailabilityChanged`, `ListingSuppressed`, `ListingRestored` | - |
| `offer-availability` | `node-performance` | CF | `InventoryFeedApplied` | - |
| `offer-availability` | `order-sourcing` | CF | `CatalogItemDiscontinued`, `ListingCreated`, `ListingAvailabilityChanged`, `ListingSuppressed`, `ListingRestored` | - |
| `offer-availability` | `shipping-and-tracking` | CF | `CatalogItemCreated` | - |
| `offer-availability` | `vendor-connectivity` | C/S + CF | `ListingCreated` | cmd ApplyInventoryFeed (`REST POST /inventory-feeds`) |
| `order-sourcing` | `customer-ordering` | CF | `FulfillmentLocked`, `FulfillmentShipped`, `FulfillmentUnsourceable` | - |
| `order-sourcing` | `delivery-promise` | C/S | `FulfillmentLocked`, `FulfillmentUnsourceable` | - |
| `order-sourcing` | `linehaul-transportation` | C/S | `FulfillmentReleasedToNode`, `FulfillmentReassigned`, `FulfillmentLocked`, `FulfillmentCancelled` | - |
| `order-sourcing` | `vendor-connectivity` | C/S | `FulfillmentReleasedToNode`, `FulfillmentCancelled` | - |
| `shipping-and-tracking` | `customer-ordering` | CF | `LabelIssued`, `PackageScanned`, `PackageDelivered`, `PackageExceptionRaised` | - |
| `shipping-and-tracking` | `delivery-promise` | CF | `PackageDelivered`, `PackageExceptionRaised` | - |
| `shipping-and-tracking` | `linehaul-transportation` | CF | `LabelIssued` | - |
| `shipping-and-tracking` | `node-performance` | CF | `PackageHandedOver` | - |
| `shipping-and-tracking` | `order-sourcing` | CF | `PackageDelivered` | - |
| `shipping-and-tracking` | `vendor-connectivity` | C/S | - | cmd IssueLabel (`REST POST /labels`) |
| `vendor-connectivity` | `node-performance` | CF | `VendorOnboarded`, `PurchaseOrderIssued`, `PurchaseOrderAccepted`, `PurchaseOrderRejected`, `PurchaseOrderExpired`, `VendorShipmentConfirmed`, `SubmissionProcessed` | - |
| `vendor-connectivity` | `order-sourcing` | C/S | `PurchaseOrderAccepted`, `PurchaseOrderRejected`, `PurchaseOrderExpired`, `VendorShipmentConfirmed` | - |
| `vendor-connectivity` | `shipping-and-tracking` | C/S | `VendorShipmentConfirmed` | - |
| `vendor-connectivity` | `network-fulfillment` (warehouse-systems) | OHS + PL / CF + ACL | none (no shared topic) | Vendor API, called by the downstream |

## Why these patterns

- **`node-topology`, `linehaul-transportation`, `last-mile-delivery`,
  `offer-availability` and `node-performance` are upstream of the two Core
  contexts, which conform to their events.** Their facts (a node's profile, a
  departure's remaining capacity, a wave's stops) are not negotiable by the
  promise; the promise keeps local, event-fed copies and makes no synchronous
  call on its hot path.
- **`customer-ordering` → `delivery-promise` is Customer/Supplier.** Checkout
  needs an answer inside the shopper's request, so it calls the promise API;
  the promise context sets the contract.
- **`order-sourcing` ↔ `vendor-connectivity` is Customer/Supplier in both
  directions by event.** Sourcing decides (release, cancel); the vendor
  protocol reports what the vendor did (accepted, rejected, expired, shipped).
- **`vendor-connectivity` is a customer of `node-topology`,
  `offer-availability` and `shipping-and-tracking`.** It is a gateway: it
  validates and times a vendor's write, then hands it to the owner of the
  fact. It never owns node profiles, availability or labels itself.
- **`shipping-and-tracking` → `customer-ordering` is a restricted
  Customer/Supplier read.** The label needs the address; nothing else does.

