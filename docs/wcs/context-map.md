---
id: context-map
title: WCS context map
sidebar_label: Context map
description: The three WCS bounded contexts and every relationship to the existing fleet and to the emulated equipment, with the context-mapping pattern, the channel and what crosses each one. Designed, not built.
---

{/* drift-allow-file: the WCS tier is designed, not built; every route on this page is a design proposal with no OpenAPI on develop yet */}

# WCS context map

This page is the **Connect** step for the WCS tier: every relationship between
the three WCS contexts, the existing fleet and the emulated equipment, drawn with
ddd-crew's [context-mapping](https://github.com/ddd-crew/context-mapping)
patterns. Upstream (U) is the side whose model the other side depends on.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 16, "rankSpacing": 34, "padding": 6}}}%%
flowchart TB
  subgraph WES["WES tier - existing"]
    direction LR
    FE["fulfillment-execution"]
    WWP["wes-work-planning"]
  end
  subgraph WMS["WMS tier - existing"]
    direction LR
    INV["inventory-storage"]
    FL["facility-layout"]
  end
  EM["exception-management<br/>existing"]
  subgraph WCS["WCS tier - designed, not built"]
    direction LR
    MFC["material-flow-control<br/>Supporting"]
    AMR["amr-fleet-control<br/>Generic"]
    ASRS["asrs-control<br/>Generic"]
  end
  subgraph L1["Levels 1 and 0 - emulated"]
    direction LR
    ROB["robots"]
    PLC["shuttles and lifts"]
  end
  MFC -->|"1 OHS / PL: transport requests and outcomes"| FE
  MFC -->|"2 capacity facts, ACL on the WES side"| WWP
  FL -->|"3 travel graph, ACL"| AMR
  AMR -->|"4 legs"| MFC
  ASRS -->|"5 storage jobs"| MFC
  ROB <-->|"6 VDA 5050 over MQTT"| AMR
  PLC <-->|"7 telegrams over MQTT"| ASRS
  MFC -->|"8 anomalies"| EM
  AMR -->|"8"| EM
  ASRS -->|"8"| EM
  FE -->|"9 TaskCompleted, unchanged"| INV

  classDef wes fill:#dbeafe,stroke:#1e3a8a,color:#172554
  classDef wms fill:#ccfbf1,stroke:#0f766e,color:#042f2e
  classDef wcs fill:#fef3c7,stroke:#b45309,color:#451a03,stroke-dasharray: 4 3
  classDef l1 fill:#e2e8f0,stroke:#475569,color:#0f172a
  class FE,WWP,EM wes
  class INV,FL wms
  class MFC,AMR,ASRS wcs
  class ROB,PLC l1
```

Arrows point from upstream to downstream.

## Relationships

| # | Upstream → downstream | Pattern | Channel | What crosses |
| --- | --- | --- | --- | --- |
| 1 | `material-flow-control` → `fulfillment-execution` | **Customer/Supplier.** The WCS supplies an **Open Host Service** with a **Published Language**; `fulfillment-execution` is the customer, and its `EquipmentCommandPort` (ADR-0015) is the **Anti-Corruption Layer** on its side. | REST command `POST /transport-requests` with `Idempotency-Key`; outcomes as events on `warehouse.material-flow-control.events` | Request: container, source, destination, purpose, priority, due. Facts back: `TransportAccepted`, `TransportRejected`, `ContainerArrivedAtStation`, `TransportCompleted`, `TransportFailed`. |
| 2 | `material-flow-control` → `wes-work-planning` | **Customer/Supplier**, with an **ACL** on the WES side that translates equipment capacity into a release constraint. | Kafka events | `SubsystemCapacityChanged`: AMRs available, AS/RS retrieval rate, station queue depth. |
| 3 | `facility-layout` → `amr-fleet-control` | **Conformist through an ACL**: the travel graph and station and dock locations are translated into a VDA 5050 node and edge map. | `facility-layout`'s existing events and REST reads | Waypoints, edges, stations, dock doors, handoff points. |
| 4 | `amr-fleet-control` → `material-flow-control` | **Customer/Supplier** inside the WCS; `material-flow-control` is the customer. The supplier offers the subsystem-controller interface. | REST command and Kafka events | One transport leg; robot assigned; leg completed or failed; fleet capacity. |
| 5 | `asrs-control` → `material-flow-control` | **Customer/Supplier** inside the WCS, the same subsystem-controller interface. | REST command and Kafka events | Store or retrieve a container; container presented at a port; equipment state; AS/RS capacity. |
| 6 | robots → `amr-fleet-control` | **Conformist** to **VDA 5050 v3**. | MQTT with JSON | `order`, `instantActions`, `state`, `connection`, `factsheet`. |
| 7 | AS/RS PLC → `asrs-control` | **Conformist** to a fleet-defined telegram protocol with a handshake. No public standard exists; SAP EWM's telegrams are the model. | MQTT | Move and storage telegrams and their acknowledgements. |
| 8 | WCS contexts → `exception-management` | **Conformist**: `exception-management` already conforms to every producer it consumes. | Kafka events | Clarification, robot blocked, deadlock, AS/RS fault. |
| 9 | `fulfillment-execution` → `inventory-storage` | **Unchanged.** The stock ledger stays the single writer. | The existing `TaskCompleted` | Picks and putaways, including stows into the AS/RS logical location. |

## Rules the map enforces

- **One door to the WES.** Only `material-flow-control` faces the WES. The WES
  never addresses a robot, a node, a shuttle or a rack position. That is
  ADR-0015's vocabulary rule, enforced from the WCS side.
- **No WCS link to the stock ledger.** There is no relationship from any WCS
  context to `inventory-storage`. The WCS never needs to know what is inside a
  container, and the ledger learns about moves only through
  `fulfillment-execution`'s existing `TaskCompleted`.
- **MQTT stays inside the WCS.** Relationships 6 and 7 are the only MQTT edges.
  Everything that crosses to the WMS or the WES is a CloudEvents 1.0 event on
  Kafka (see [seam decision 5](/wcs/seam-decisions#decision-5-the-cloudevents-segment-is-wes)).
- **Subsystem controllers are interchangeable.** Relationships 4 and 5 use one
  subsystem-controller interface, so a vendor controller behind an adapter can
  replace either context without changing `material-flow-control`.
- **Read-only consumers are not drawn.** `warehouse-ops-agent` and
  `warehouse-console` will read equipment state and container position the way
  they read every other context.

## Why a REST command at relationship 1

`fulfillment-execution` needs an immediate accept or reject: an unknown
container, a busy container or an unreachable destination must fail the request
at once, not minutes later through an event. Progress after acceptance is
asynchronous and goes on events, which is how `order-management` already calls
`inventory-storage` for reservations. Relationships 4 and 5 use the same shape so
that the three WCS contexts follow one pattern.
