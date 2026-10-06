---
id: context-map
title: Context Map
sidebar_label: Context Map
description: Fleet-wide ddd-crew context map of the eleven bounded contexts — every edge with upstream/downstream, context-mapping pattern, technology and wiring status (live, wired-but-unused, absent-planned), reconciled against each context's own context map and code.
---

# Context Map

This is the fleet-wide [ddd-crew Context Map](https://github.com/ddd-crew/context-mapping)
of the eleven backend bounded contexts. Each context's repository has its own
context map, synced to this site and grounded in that repo's code. This page
puts those maps together. Where two contexts' maps describe the same edge
differently, this page checked the code and the reference deployment
(`warehouse-infra` on `develop`) and records the difference under
[Where the per-context maps disagree](#where-the-per-context-maps-disagree).

Per-context maps (the source for every row below):
[order-management](/contexts/order-management/context-map) ·
[inventory-storage](/contexts/inventory-storage/context-map) ·
[wes-work-planning](/contexts/wes-work-planning/context-map) ·
[fulfillment-execution](/contexts/fulfillment-execution/context-map) ·
[workforce-management](/contexts/workforce-management/context-map) ·
[facility-layout](/contexts/facility-layout/context-map) ·
[process-path-management](/contexts/process-path-management/context-map) ·
[labor-performance](/contexts/labor-performance/context-map) ·
[warehouse-ops-agent](/contexts/warehouse-ops-agent/context-map) ·
[network-fulfillment](/contexts/network-fulfillment/context-map) ·
[warehouse-planning](/contexts/warehouse-planning/context-map)

**Pattern legend:** **U/D** upstream/downstream · **OHS** Open Host Service ·
**PL** Published Language · **CF** Conformist · **ACL** Anti-Corruption Layer ·
**C/S** Customer/Supplier · **SW** Separate Ways. No Partnership and no
Shared Kernel exist anywhere in the fleet. Every context is its own Go module,
no context imports a sibling's types, and every per-context map says so.

**Status legend:**

- **live**: real producer and real consumer (or a real client calling a real
  endpoint), switched on in the reference deployment.
- **wired-but-unused**: the code exists on both sides, but nothing exercises
  it today. Either the client sits behind a flag the reference deployment
  leaves off, or it is a rollback path, or a publisher has no consumer, or a
  client is built but no use case calls it.
- **absent-planned**: a relationship the domain needs or an ADR names, with
  no wire yet.
- **deliberately absent**: no relationship, by decision (Separate Ways).

Many consumers ship with a `permissive` / `file` / `log` binary default and
are switched on per deployment. When a per-context page calls an edge
"opt-in", this page marks it **live** if the reference deployment switches it
on (`warehouse-infra` `terraform/locals.tf` `sync_edge_env`,
`terraform/services.tf`, `helm-values/*.yaml`) and **wired-but-unused** if it
does not.

## The whole map

Arrows point from **upstream to downstream**, the direction the model flows.
That is not always the direction of the network call. For example,
`order-management` calls `POST /reservations`, but it is downstream of
`inventory-storage`.

```mermaid
flowchart LR
    subgraph EXTERNAL["Outside the fleet"]
        RN["retail-network<br/>external network role<br/>stub only"]
        WCS["WCS / equipment<br/>not built"]
    end

    subgraph WMS["wms subdomain"]
        FL["facility-layout<br/>Generic"]
        INV["inventory-storage<br/>Core"]
    end

    subgraph WES["wes subdomain"]
        OM["order-management<br/>Generic/Supporting"]
        PPM["process-path-management<br/>Generic"]
        WP["wes-work-planning<br/>Core"]
        FE["fulfillment-execution<br/>Core"]
        WFM["workforce-management<br/>Supporting"]
        LP["labor-performance<br/>Supporting"]
        WPL["warehouse-planning<br/>Core"]
        NF["network-fulfillment<br/>Supporting"]
        OA["warehouse-ops-agent<br/>Supporting"]
    end

    CON["warehouse-console<br/>frontend shell, not a context"]
    NOSUB(["no consumer"])

    OM ==>|"Kafka OrderAllocated,<br/>OrderPartiallyAllocated"| WP
    OM ==>|"Kafka OrderAllocated,<br/>OrderPartiallyAllocated"| WPL
    INV ==>|"Kafka StockReserved,<br/>ReservationRevoked"| WP
    FL ==>|"Kafka ZoneRegistered,<br/>LocationSlot events"| INV
    FL ==>|"Kafka LocationSlot events"| WPL
    WFM ==>|"Kafka ShiftPlanCommitted"| WP
    WFM ==>|"Kafka ShiftPlanCommitted"| WPL
    PPM ==>|"Kafka ProcessPath events"| FE
    PPM ==>|"Kafka ProcessPath events"| WP
    PPM ==>|"Kafka ProcessPath events"| WFM
    PPM ==>|"Kafka ProcessPath events,<br/>CPTScheduleChanged"| OM
    WP ==>|"Kafka WorkReleased"| FE
    WP ==>|"Kafka PathCapacityChanged"| OM
    FE ==>|"Kafka TaskCompleted"| WP
    FE ==>|"Kafka TaskCompleted"| LP
    FE ==>|"Kafka TaskCPTMissed,<br/>PackageManifested"| OM
    LP ==>|"Kafka TaskPerformanceRecorded"| WFM
    WPL ==>|"Kafka CapacityPlan events"| OM

    INV -->|"REST reservations"| OM
    INV -->|"REST product classification"| WP
    INV -->|"REST product classification"| FE
    FL -->|"REST distance"| WP
    FE -->|"REST installed capacity"| WFM
    OM -->|"REST held orders, release, cancel"| NF

    INV -->|"MCP, REST, reports"| OA
    WP -->|"MCP, REST, reports"| OA
    FE -->|"MCP, REST, reports"| OA
    WFM -->|"MCP, reports"| OA
    LP -->|"MCP, reports"| OA
    FL -->|"MCP, reports"| OA
    WPL -->|"MCP"| OA
    OM -->|"REST, reports"| OA
    OA -->|"REST console BFF"| CON

    PPM -.->|"Kafka, opt-in cache"| NF
    WP -.->|"Kafka PathCapacityChanged,<br/>opt-in cache"| NF
    INV -.->|"REST usable inventory, opt-in"| NF
    FL -.->|"REST classification, rollback"| INV
    FL -.->|"REST location role, opt-in"| FE
    LP -.->|"REST task-type performance"| WFM
    OM -.->|"MCP get_order, wired only"| OA
    PPM -.->|"MCP, wired only"| OA
    NF -.->|"Kafka networkorder events"| NOSUB
    RN -.->|"Vendor API, planned"| NF
    FE -.-x|"deliberately absent"| WCS

    classDef core fill:#1e3a8a,stroke:#1e293b,color:#fff;
    classDef supp fill:#6d28d9,stroke:#4c1d95,color:#fff;
    classDef gen fill:#475569,stroke:#94a3b8,color:#fff;
    classDef ext fill:#f1f5f9,stroke:#64748b,color:#334155,stroke-dasharray: 5 5;
    class INV,WP,FE,WPL core;
    class OM,WFM,LP,NF,OA supp;
    class FL,PPM gen;
    class RN,WCS,CON,NOSUB ext;
```

**How to read it.** Thick arrows are live Kafka edges (CloudEvents 1.0
structured mode on one shared broker). Thin solid arrows are live synchronous
REST or MCP reads. Every REST and MCP surface in the fleet is unauthenticated.
Dotted arrows are wired-but-unused or absent-planned, as the table states.
The crossed edge is deliberately absent. `order-management` is coloured with
the Supporting contexts because it is classified Generic/Supporting (see
[Subdomain Classification](/strategic-design/subdomain-classification)).
Separate Ways relationships are not drawn. They are listed in
[Separate Ways](#separate-ways).

Omitted from the diagram:

- each context's own analytics topic (`warehouse.<ctx>.analytics`) and
  projector, which are internal to that context;
- the `.dlq` topics;
- every context's own Module Federation remote in `warehouse-console`
  (see [The console](#the-console));
- `warehouse-ops-agent`'s two non-context upstreams: Prometheus/Loki (live)
  and the Anthropic Messages API, which is off by default (`LLM_MODE=off`).

## Edge table

### Kafka (integration topics)

| # | Upstream → Downstream | Pattern (U / D) | Technology | Status | Source |
| --- | --- | --- | --- | --- | --- |
| K1 | `order-management` → `wes-work-planning` | PL / CF per OM, ACL per WP; C/S | `warehouse.order-management.events`: `OrderAllocated`, `OrderPartiallyAllocated` | **live** | [OM](/contexts/order-management/context-map), [WP](/contexts/wes-work-planning/context-map) |
| K2 | `order-management` → `warehouse-planning` | OHS + PL / ACL | same topic and types, read into an expected-demand model | **live**. It is opt-in (`DEMAND_CONSUMER_GROUP`, WPL ADR 0004), and the reference deployment sets it (`helm-values/warehouse-planning.yaml`, `demand.consumerGroup`) | [WPL](/contexts/warehouse-planning/context-map) |
| K3 | `inventory-storage` → `wes-work-planning` | OHS + PL / CF per INV, ACL per WP | `warehouse.inventory.events`: `StockReserved`, `ReservationRevoked` | **live**. Projected, but per WP the projection feeds no decision yet | [INV](/contexts/inventory-storage/context-map), [WP](/contexts/wes-work-planning/context-map) |
| K4 | `facility-layout` → `inventory-storage` | OHS + PL / CF (+ ACL per FL) | `warehouse.facility.events`: `ZoneRegistered`, `LocationSlotRegistered`, `LocationSlotDecommissioned` | **live** with `LOCATION_LOOKUP_MODE=kafka`, which the reference deployment sets | [FL](/contexts/facility-layout/context-map), [INV](/contexts/inventory-storage/context-map) |
| K5 | `facility-layout` → `warehouse-planning` | OHS + PL / ACL (folded into a position and station tally) | `warehouse.facility.events`: `LocationSlotRegistered`, `LocationSlotDecommissioned` | **live** | [FL](/contexts/facility-layout/context-map), [WPL](/contexts/warehouse-planning/context-map) |
| K6 | `workforce-management` → `wes-work-planning` | C/S, PL / ACL (translated into `LaborPlanObserved`) | `warehouse.workforce.events`: `ShiftPlanCommitted` | **live** | [WFM](/contexts/workforce-management/context-map), [WP](/contexts/wes-work-planning/context-map) |
| K7 | `workforce-management` → `warehouse-planning` | C/S, PL / ACL (a LABOR capacity constraint) | `warehouse.workforce.events`: `ShiftPlanCommitted` | **live** | [WFM](/contexts/workforce-management/context-map), [WPL](/contexts/warehouse-planning/context-map) |
| K8 | `process-path-management` → `fulfillment-execution`, `wes-work-planning`, `workforce-management` | OHS + PL / CF | `warehouse.process-path-management.events`: `ProcessPathCreated`, `ProcessPathUpdated`, `ProcessPathDeactivated` | **live**. Each consumer's binary default is a YAML file (`PATH_CATALOGUE_SOURCE=file`), and the reference deployment injects `PATH_CATALOGUE_SOURCE=kafka` (`deploy_process_path_kafka_source`, default `true`) | [PPM](/contexts/process-path-management/context-map), [FE](/contexts/fulfillment-execution/context-map), [WP](/contexts/wes-work-planning/context-map), [WFM](/contexts/workforce-management/context-map) |
| K9 | `process-path-management` → `order-management` | OHS + PL / ACL (local read model) | same topic: the three `processpath.*` types plus `CPTScheduleChanged` | **live** with `PATH_CATALOGUE_SOURCE=kafka` (`deploy_order_management_path_catalogue_kafka`, default `true`) | [PPM](/contexts/process-path-management/context-map), [OM](/contexts/order-management/context-map) |
| K10 | `process-path-management` → `network-fulfillment` | OHS + PL / CF | same topic: `processpath.*` plus `CPTScheduleChanged`, read into the `processpathcache` | **wired-but-unused**. Started only when `CAPABILITY_OFFER_ENABLED=true`, which the reference deployment does not set | [PPM](/contexts/process-path-management/context-map), [NF](/contexts/network-fulfillment/context-map) |
| K11 | `wes-work-planning` → `fulfillment-execution` | C/S; OHS + PL / ACL | `warehouse.work-planning.events`: `WorkReleased` | **live** | [WP](/contexts/wes-work-planning/context-map), [FE](/contexts/fulfillment-execution/context-map) |
| K12 | `wes-work-planning` → `order-management` | C/S; OHS + PL / ACL | `warehouse.work-planning.events`: `PathCapacityChanged` | **live** | [WP](/contexts/wes-work-planning/context-map), [OM](/contexts/order-management/context-map) |
| K13 | `wes-work-planning` → `network-fulfillment` | OHS + PL / CF | `warehouse.work-planning.events`: `PathCapacityChanged` | **wired-but-unused**, behind the same `CAPABILITY_OFFER_ENABLED` gate as K10 | [WP](/contexts/wes-work-planning/context-map), [NF](/contexts/network-fulfillment/context-map) |
| K14 | `fulfillment-execution` → `wes-work-planning` | C/S feedback edge; OHS + PL / CF per FE, ACL per WP | `warehouse.fulfillment.events`: `TaskCompleted` | **live**. This edge closes the release/complete control loop | [FE](/contexts/fulfillment-execution/context-map), [WP](/contexts/wes-work-planning/context-map) |
| K15 | `fulfillment-execution` → `labor-performance` | OHS + PL / CF (C/S with no influence) | `warehouse.fulfillment.events`: `TaskCompleted`, same fan-out topic, own consumer group | **live** | [FE](/contexts/fulfillment-execution/context-map), [LP](/contexts/labor-performance/context-map) |
| K16 | `fulfillment-execution` → `order-management` | OHS + PL / CF per FE, ACL per OM | `warehouse.fulfillment.events`: `TaskCPTMissed`, `PackageManifested` (re-promise loop) | **live** | [FE](/contexts/fulfillment-execution/context-map), [OM](/contexts/order-management/context-map) |
| K17 | `labor-performance` → `workforce-management` | OHS + PL / CF + ACL | `warehouse.labor-performance.events`: `TaskPerformanceRecorded` (measured rate and idle share) | **live** with `LABOR_PERFORMANCE_MODE=kafka-cache`, which the reference deployment sets | [LP](/contexts/labor-performance/context-map), [WFM](/contexts/workforce-management/context-map) |
| K18 | `warehouse-planning` → `order-management` | OHS + PL / ACL (local read model) | `warehouse.warehouse-planning.events`: `CapacityPlanCreated`, `CapacityPlanPublished`, `CapacityShortageDetected`. `BottleneckDetected` is ignored | **live**. It is opt-in (`PLANNED_CAPACITY_CONSUMER_GROUP`, OM ADR 0031), and the reference deployment sets it (`helm-values/order-management.yaml`, `plannedCapacity.consumerGroup`). The read model only annotates orders and serves `GET /planned-capacity`. No promise moves | [WPL](/contexts/warehouse-planning/context-map), [OM](/contexts/order-management/context-map) |
| K19 | `network-fulfillment` → any subscriber | OHS + PL / — | `warehouse.network-fulfillment.events`: `networkorder.*` | **wired-but-unused**. Published only with `EVENT_PUBLISHER=kafka` (chart default `log`), and no consumer exists in the fleet | [NF](/contexts/network-fulfillment/context-map) |

Published types with no consumer, as stated by their owners:

- nine of the eleven types on `warehouse.work-planning.events` (all except
  `WorkReleased` and `PathCapacityChanged`);
- nine of the twelve types on `warehouse.facility.events`;
- `OrderRepromised` on `warehouse.order-management.events`;
- `BottleneckDetected` on `warehouse.warehouse-planning.events`.

### REST (context to context)

| # | Upstream → Downstream (caller) | Pattern (U / D) | Technology | Status | Source |
| --- | --- | --- | --- | --- | --- |
| R1 | `inventory-storage` → `order-management` | OHS + PL / C/S + ACL | `POST /reservations` (with `Idempotency-Key`), `DELETE /reservations/{id}` | **live** (`INVENTORY_STORAGE_MODE=http`) | [INV](/contexts/inventory-storage/context-map), [OM](/contexts/order-management/context-map) |
| R2 | `inventory-storage` → `order-management` | OHS + PL / C/S + ACL | `GET /products/{sku}/classification` (fail-open routing hint) | **wired-but-unused**. `PRODUCT_CLASSIFICATION_MODE` defaults to `permissive`, and the reference deployment sets it for WP and FE but not for OM | [OM](/contexts/order-management/context-map), [INV](/contexts/inventory-storage/context-map) |
| R3 | `inventory-storage` → `wes-work-planning` | OHS / CF | `GET /products/{sku}/classification` at release | **live** (`PRODUCT_CLASSIFICATION_MODE=http` in `sync_edge_env`) | [INV](/contexts/inventory-storage/context-map), [WP](/contexts/wes-work-planning/context-map) |
| R4 | `inventory-storage` → `fulfillment-execution` | OHS / ACL | `GET /products/{sku}/classification` at seal time | **live** (`PRODUCT_CLASSIFICATION_MODE=http` in `sync_edge_env`) | [INV](/contexts/inventory-storage/context-map), [FE](/contexts/fulfillment-execution/context-map) |
| R5 | `inventory-storage` → `network-fulfillment` | OHS / CF | `GET /inventory/{sku}/usable` | **wired-but-unused**. The client is built only inside the `CAPABILITY_OFFER_ENABLED` wiring | [NF](/contexts/network-fulfillment/context-map), [INV](/contexts/inventory-storage/context-map) |
| R6 | `facility-layout` → `inventory-storage` | OHS / ACL | `GET /locations/{locationCode}/classification` | **wired-but-unused**. This is the rollback for K4 (`LOCATION_LOOKUP_MODE=http`) | [FL](/contexts/facility-layout/context-map), [INV](/contexts/inventory-storage/context-map) |
| R7 | `facility-layout` → `wes-work-planning` | OHS + PL / CF | `GET /distance?from=&to=` at shift-plan commit | **live** (`TRAVEL_DISTANCE_MODE=http` in `sync_edge_env`) | [FL](/contexts/facility-layout/context-map), [WP](/contexts/wes-work-planning/context-map) |
| R8 | `facility-layout` → `fulfillment-execution` | OHS / ACL | `GET /locations/{locationCode}` (station role check) | **wired-but-unused** (`LOCATION_ROLE_MODE` not set in the reference deployment) | [FL](/contexts/facility-layout/context-map), [FE](/contexts/fulfillment-execution/context-map) |
| R9 | `fulfillment-execution` → `workforce-management` | OHS / CF | `GET /capacity/{capability}` (fail-loud ceiling on committed heads) | **live** (`INSTALLED_CAPACITY_MODE=http`) | [FE](/contexts/fulfillment-execution/context-map), [WFM](/contexts/workforce-management/context-map) |
| R10 | `labor-performance` → `workforce-management` | OHS / CF + ACL | `GET /task-types/{taskType}/performance` | **wired-but-unused**. `LABOR_PERFORMANCE_MODE=http` is the alternative to K17 | [LP](/contexts/labor-performance/context-map), [WFM](/contexts/workforce-management/context-map) |
| R11 | `order-management` → `network-fulfillment` | OHS / C/S (NF is the Customer, and OM ADR 0020 changed the Supplier for it) | `POST /orders` (held, `requiredShipBy`), `POST /orders/{id}/release`, `DELETE /orders/{id}` | **live** | [OM](/contexts/order-management/context-map), [NF](/contexts/network-fulfillment/context-map) |
| R12 | `retail-network` → `network-fulfillment` | OHS / CF + ACL | `ports.NetworkGateway`: `PollDemand`, `SubmitAcknowledgement`, `SubmissionStatus`, `SubmitShipmentConfirmation` | **absent-planned**. Only `StubGateway` exists, and `NETWORK_MODE=live` refuses to boot. See [retail-network](#upstream-retail-network-planned) | [NF](/contexts/network-fulfillment/context-map) |

### warehouse-ops-agent (MCP Customer and console BFF)

`warehouse-ops-agent` is downstream of every edge below. It is the Customer and
the Conformist, and every edge is a read. Its zero-write rule is enforced in
CI. It has no Kafka integration at all. The per-tool split between live and
wired comes from the agent's own map and was re-checked against which client
methods its use cases call on `develop`.

| # | Upstream | MCP tools: live (called by a use case) | MCP tools: wired-but-unused | REST | Status |
| --- | --- | --- | --- | --- | --- |
| A1 | `inventory-storage` | `check_availability`, `get_bin_occupancy` | — | `GET /reservations?demandRef=`, flow-accuracy report | **live** |
| A2 | `wes-work-planning` | `get_backlog_telemetry`, `get_rebalance_recommendation` | — | `GET /work-units?reference=`, throughput report | **live** |
| A3 | `fulfillment-execution` | `get_queue_status`, `diagnose_stuck_tasks` | `find_claimable_work` | `GET /tasks?orderRef=`, throughput report | **live** |
| A4 | `workforce-management` | `get_staffing_gap` | `propose_path_heads` | labor report | **live** |
| A5 | `labor-performance` | `get_task_type_utilization` | `get_associate_scorecard`, `get_task_type_performance`, `get_labor_standard` | performance report | **live** |
| A6 | `facility-layout` | `list_sites`, `estimate_travel_distance` | `get_site_layout`, `get_zone_grid` | catalog-growth report | **live** |
| A7 | `warehouse-planning` | `get_process_path_capacity` | `get_capacity_plan`, `get_storage_capacity`, `list_station_standards` | — | **live** (`WAREHOUSE_PLANNING_MCP_ENDPOINT`, set in the reference deployment) |
| A8 | `order-management` | — | `get_order` | `GET /orders/{id}`, funnel report | REST **live**, MCP **wired-but-unused** |
| A9 | `process-path-management` | — | `get_process_path`, `list_process_paths` | — | **wired-but-unused** |
| A10 | `network-fulfillment` | — | — | — | **deliberately absent**. NF serves read-only MCP tools, but the agent has no client for them |
| A11 | `warehouse-ops-agent` → `warehouse-console` | C/S: the agent is the BFF Supplier | — | `/console/orders/{id}/lifecycle`, `/console/reports/wms`, `/console/reports/wes`, `/daily-brief` | **live** |

The Order Lifecycle screen fans out to four contexts' OLTP APIs: OM, INV, WP
and FE. The `/console/reports/*` endpoints read seven contexts' `*-reports`
binaries.

### Deliberately absent edges with a named seam

| # | Edge | Why | Source |
| --- | --- | --- | --- |
| X1 | `fulfillment-execution` → WCS / equipment | `ports.EquipmentCommandPort` declares no methods and has no adapter (FE ADR-0015) | [FE](/contexts/fulfillment-execution/context-map) |
| X2 | `fulfillment-execution` → `network-fulfillment` (`PackageManifested`) | No persisted `WorkUnitId -> NetworkRef` mapping exists, so shipment confirmation is an explicit REST call to NF instead (NF ADR 0014) | [NF](/contexts/network-fulfillment/context-map) |
| X3 | `order-management` → `wes-work-planning` synchronous `POST /paths/{pathId}/work-units` | Replaced by K1 choreography (OM ADR 0005, WP ADR-0031). No reply event exists | [OM](/contexts/order-management/context-map), [WP](/contexts/wes-work-planning/context-map) |
| X4 | `fulfillment-execution`, `wes-work-planning`, `network-fulfillment` → `warehouse-planning` | Observed capacity and network demand were intended by WPL ADR 0001 but are **absent-planned**: there is no consumer | [WPL](/contexts/warehouse-planning/context-map) |

## Separate Ways

The context maps declare these pairs as having no relationship, by decision:

- **`inventory-storage` ↔ `workforce-management`.** Worker identity must
  never leak into the stock system of record. `inventory-storage` also has no
  relationship with `process-path-management`, `labor-performance` or
  `warehouse-planning`, and it does not consume `warehouse.fulfillment.events`.
  Its `POST /reservations/{id}/confirm-pick` has no sibling caller.
- **`workforce-management` ↔ `fulfillment-execution` at the task level**
  (WFM ADR 0002, "stop at the path boundary"). The one live edge between them
  is R9, which carries capacity, not tasks. WFM also has no edge to
  `facility-layout` ("Conformist, unexercised").
- **`facility-layout` calls nobody and consumes nothing.** It has no
  relationship with `order-management`, `process-path-management`,
  `labor-performance` or `network-fulfillment`. `process-path-management`
  keeps local copies of `LocationRole` and `SiteId`, kept in sync by convention.
- **`process-path-management` and `labor-performance` make no REST or MCP
  call to any sibling.** PPM's build fails if an outbound adapter imports
  `net/http` (`TestNoSiblingContextOutboundCalls`). LP has no outbound client
  package (its ADR 0003). PPM consumes no sibling topic. LP's only input is K15.
- **`wes-work-planning` ↔ `labor-performance`** and
  **`wes-work-planning` ↔ `warehouse-planning`** have no runtime relationship.
- **`warehouse-planning` ↔ `process-path-management`** (WPL ADR 0001
  Addendum): WPL declares its own `ProcessPath` and shares the `path_id`
  string only as a human cross-reference. **`warehouse-planning` ↔
  `inventory-storage`**: "stock is not capacity".
- **`fulfillment-execution` does not consume the inventory, facility or order
  topics.** Those facts reach it only through what `wes-work-planning`
  releases, plus R4 and R8.
- **`network-fulfillment` ↔ `facility-layout`, `workforce-management`,
  `labor-performance`, `warehouse-planning`, `warehouse-ops-agent`.**

## Where the per-context maps disagree

The rows above follow the code and the reference deployment. These are the
places where two synced pages describe the same edge differently.

**Status disagreements**, resolved against code:

| Edge | Page A says | Page B says | Resolution |
| --- | --- | --- | --- |
| K10 `process-path-management` → `network-fulfillment` | PPM: **Live** | NF: **Wired, opt-in** | NF is correct. `network-fulfillment`'s `cmd/netfulfil/main.go` starts the cache only inside `wireCapabilityOffer`, which returns early unless `CAPABILITY_OFFER_ENABLED=true` (default false). The reference deployment does not set it |
| K13 `wes-work-planning` → `network-fulfillment` | WP: **Live** (behind NF's `CAPABILITY_OFFER_ENABLED`) | NF: **Wired, opt-in** | Same gate as K10, so **wired-but-unused** |
| R5 `inventory-storage` → `network-fulfillment` | INV: **Live**, "no mode switch" | NF: **Wired, opt-in** | NF is correct. `wireInventoryClient()` is called only from `wireCapabilityOffer` |
| R2 OM product-classification lookup | INV: **Live** in the cluster. OM: live when `PRODUCT_CLASSIFICATION_MODE=http` | — | `warehouse-infra` sets `PRODUCT_CLASSIFICATION_MODE=http` only for `wes-work-planning` and `fulfillment-execution`, and OM's chart does not render the variable. OM's binary default is `permissive`, so this edge is **wired-but-unused** in the reference deployment. The reservation calls (R1) are live |
| R3, R7 (WP's classification and distance lookups) | WP: **Wired**, the default `permissive` never calls out | INV: live when the caller sets `http`. FL: **Live** | Both are **live** in the reference deployment (`sync_edge_env["wes-work-planning"]`). WP's page describes the binary default |
| R4 (FE's classification lookup), K8 for FE | FE: **Opt-in** | INV, PPM: live | Both are **live** in the reference deployment. FE's page describes the binary default |
| A3–A6 per-tool status | FE, WFM, FL, LP each list all their tools as consumed by the agent | OA: some tools are wired only | OA is correct. On `develop`, its use cases call only the tools listed as live in A1–A9 |
| K2 `order-management` → `warehouse-planning` | WPL: wired, opt-in | OM's map does not list WPL as a consumer of its topic | WPL's consumer exists and the reference deployment enables it, so **live** |

**Pattern disagreements** (judgement, not code). The two pages name a
different pattern for the downstream side. The edge table shows both:

- K1 OM → WP, K3 INV → WP, K14 FE → WP: the upstream page says Conformist.
  `wes-work-planning` says it has an ACL: unexported structs in its Kafka
  consumer hold the foreign shape and never leave the adapter.
- K9 PPM → OM and K16 FE → OM: the upstream page says Conformist.
  `order-management` says ACL (a local read model).
- K7 WFM → WPL: WFM says C/S + PL. WPL says ACL and states that it has no
  Conformist relationship with anyone.
- A7 WPL → OA: WPL says "Customer with an ACL". OA says Conformist.

**Corrections to this page's previous version:**

- FE → WP was labelled **Partnership**. Both FE's and WP's maps call it
  Customer/Supplier with a feedback edge. FE's page explains why the WES
  tier is deliberately not a Partnership.
- `warehouse-planning` → `order-management` was "planned, not live". The OM
  consumer exists (OM ADR 0031) and is enabled in the reference deployment
  (K18).
- `warehouse-ops-agent` was said to have no `warehouse-planning` client. It
  has one (OA ADR 0013, A7).
- `network-fulfillment` was said to publish no events. It ships an outbox
  publisher to `warehouse.network-fulfillment.events` behind
  `EVENT_PUBLISHER=kafka` (K19), and nothing consumes it.
- `network-fulfillment` was missing as a downstream of PPM, WP and INV
  (K10, K13, R5). Those edges exist, but none is enabled.
- OM → WPL demand (K2) and LP → WFM REST (R10) were missing.
- The retail-network ADR is `network-fulfillment` ADR **0009**. It was
  renumbered from 0002, and 0002 is now a "Moved" stub.

## Upstream: retail-network (planned)

`retail-network` is not one of the eleven bounded contexts. It plays the role
of an external retail fulfillment network. `network-fulfillment` is
**Conformist** to it and acts as an **Anti-Corruption Layer** for the fleet:
the network's vocabulary stops at `internal/adapters/outbound/network/`, and
the rest of the fleet sees only SKUs, quantities and a deadline. Today only
`StubGateway` exists, and `NETWORK_MODE=live` refuses to boot because there is
no adapter. The reference deployment pins `networkMode = "stub"`. The
relationship is decided in
[`network-fulfillment` ADR 0009](https://github.com/IQVO/network-fulfillment/blob/develop/docs/adr/0009-retail-network-not-amazon-counterpart.md)
(Accepted). Its companion `retail-network` ADR 0001 is still a draft at
`docs/planning/retail-network-adr-0001-DRAFT-for-new-repo.md` in
`network-fulfillment`, and no `retail-network` repository exists yet.

## The console

`warehouse-console` is a Module Federation shell, not a bounded context. Most
contexts ship their own remote in their `web/` directory: `order-mgmt-mfe`,
`inventory-mfe`, `facility-mfe`, `workforce_mfe`, `labor_mfe`,
`process_path_mfe`, `capacity_mfe` (warehouse-planning), and the
network-fulfillment, fulfillment-execution and wes-work-planning remotes.
Each remote calls only its own context's REST API. That is presentation
composition, not a domain edge, so the diagram leaves it out. The one
cross-context read path for the console is `warehouse-ops-agent`'s BFF (A11).
