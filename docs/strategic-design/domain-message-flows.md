---
id: domain-message-flows
title: Domain Message Flow Modelling
sidebar_label: Domain Message Flows
description: Commands, events and queries flowing between the twelve contexts documented on this site for the platform's key business scenarios, in ddd-crew Domain Message Flow notation, with the Kafka topic of every event.
---

# Domain Message Flow Modelling

This page follows ddd-crew's
[Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
It traces the platform's key business scenarios across bounded-context
boundaries. The per-context pages show one context's view. This page joins
them into end-to-end flows.

**Notation.** Participants are bounded contexts, people and external systems.
Every arrow is numbered and prefixed:

- `cmd:` is a command, a request to change state: a REST write, an MCP write
  tool or a port call to the external network.
- `qry:` is a query, a request for data: a REST `GET` or an MCP read tool.
- `evt:` is a domain event, a fact published as a CloudEvents 1.0 message on
  Kafka. Open arrowheads (`-)`) mark asynchronous Kafka hops. The topic is
  named in the message or in a note.

Inside the diagrams, event names are shortened to their last `type` segment.
The full type is
`com.warehouse.<wms|wes>.<bounded-context>.<entity>.<EventName>` (see the
[Event Standard](/strategic-design/event-standard-cloudevents)). Replies are
folded into notes, so that every arrow is a domain message.

**Sources.** Every message comes from a synced spec (`apis/<context>/openapi.yaml`,
`apis/<context>/asyncapi.yaml`) or from that context's own code-grounded
Domain Message Flow page. Those pages are linked under each scenario. The
diagrams leave out the transactional-outbox relay hop and the analytics
copy that every producer also writes to its `warehouse.<ctx>.analytics`
topic.

## Integration topics at a glance

Only the integration topics are listed. The `*.analytics` topics feed each
context's own projector and are never read by a sibling.

| Topic | Producer | Event types consumed by a sibling | Consumers |
| --- | --- | --- | --- |
| `warehouse.order-management.events` | order-management | `OrderAllocated`, `OrderPartiallyAllocated` | wes-work-planning, warehouse-planning |
| `warehouse.inventory.events` | inventory-storage | `StockReserved`, `ReservationRevoked` | wes-work-planning |
| | | legacy `ProductClassified` (emitted only by the one-shot backfill) | product-master's legacy importer (migration only, removed at stage E) |
| `warehouse.work-planning.events` | wes-work-planning | `WorkReleased` | fulfillment-execution |
| | | `PathCapacityChanged` | order-management, network-fulfillment |
| `warehouse.fulfillment.events` | fulfillment-execution | `TaskCompleted` | wes-work-planning, labor-performance |
| | | `TaskCPTMissed`, `PackageManifested` | order-management |
| `warehouse.workforce.events` | workforce-management | `ShiftPlanCommitted` | wes-work-planning, warehouse-planning |
| `warehouse.labor-performance.events` | labor-performance | `TaskPerformanceRecorded` | workforce-management |
| `warehouse.process-path-management.events` | process-path-management | `ProcessPathCreated`, `ProcessPathUpdated`, `ProcessPathDeactivated` | fulfillment-execution, wes-work-planning, workforce-management, order-management, network-fulfillment |
| | | `CPTScheduleChanged` | order-management, network-fulfillment |
| `warehouse.facility.events` | facility-layout | `ZoneRegistered`, `LocationSlotRegistered`, `LocationSlotDecommissioned` | inventory-storage (all three), warehouse-planning (the two slot events) |
| `warehouse.warehouse-planning.events` | warehouse-planning | `CapacityPlanCreated`, `CapacityPlanPublished`, `CapacityShortageDetected` | order-management (`BottleneckDetected` is ignored) |
| `warehouse.network-fulfillment.events` | network-fulfillment | none | no consumer (wired but unused) |
| `warehouse.product-master.events` | product-master | `ProductClassified` | inventory-storage, order-management, wes-work-planning, fulfillment-execution (local copies) |

Several published types have no sibling consumer today. These are
`OrderRepromised`, nine of the eleven `warehouse.work-planning.events`
types (for example `PathPlanDriftDetected` and `WorkUnitCompleted`),
`BottleneckDetected`, every `warehouse.network-fulfillment.events` type and
the four `warehouse.product-master.events` types other than
`ProductClassified`.
They are listed as hotspots on
[Big Picture EventStorming](/strategic-design/eventstorming-big-picture).
`warehouse-ops-agent` has no Kafka I/O at all. It only issues `qry:`
messages over MCP and REST.

## 1. Network order intake and acceptance

The external retail network's purchase order becomes a **held** order in
`order-management`. It is released to the floor only after the network
confirms our acceptance.

```mermaid
sequenceDiagram
    autonumber
    participant RN as retail-network
    participant NF as network-fulfillment
    participant OM as order-management
    participant INV as inventory-storage
    participant WP as wes-work-planning
    participant WPL as warehouse-planning
    NF->>RN: qry: PollDemand since watermark
    Note over NF: translate NetworkProductId to SKU at the ACL
    NF-)NF: evt: NetworkOrderReceived on warehouse.network-fulfillment.events
    NF->>OM: cmd: POST /orders releaseOnAllocation false, ship-complete, requiredShipBy
    OM->>INV: cmd: POST /reservations per line
    INV-)WP: evt: StockReserved on warehouse.inventory.events
    OM-)WP: evt: OrderAllocated with no released lines on warehouse.order-management.events
    OM-)WPL: evt: OrderAllocated on warehouse.order-management.events
    Note over OM,NF: 201 order, promiseDate present means feasible
    NF-)NF: evt: NetworkOrderAcknowledged, raised at SUBMITTED
    NF->>RN: cmd: SubmitAcknowledgement accepted true
    NF->>RN: qry: SubmissionStatus networkRef
    Note over NF,RN: SUCCESS settles the order as ACKNOWLEDGED, no event
    NF->>OM: cmd: POST /orders/{id}/release
    OM->>INV: cmd: POST /reservations again to reconfirm
    OM-)WP: evt: OrderAllocated with released lines
```

Rejection branches: an untranslatable product leads to `NetworkOrderRejected`
`UNTRANSLATABLE_SKU`, with no call to `order-management`. A null
`promiseDate` leads to `DELETE /orders/{id}`, then `NetworkOrderRejected`
`INFEASIBLE_DEADLINE`. A `FAILURE` on reconcile leads to `DELETE /orders/{id}`,
then `NetworkOrderRejected` `SUBMISSION_FAILED`. Each rejection is followed
by `SubmitAcknowledgement accepted false`, except `SUBMISSION_FAILED`.

Sources: [network-fulfillment flows 1 and 2](/contexts/network-fulfillment/domain-message-flow),
[order-management flow 2](/contexts/order-management/domain-message-flow),
[inventory-storage flow 1](/contexts/inventory-storage/domain-message-flow),
[warehouse-planning flow 2](/contexts/warehouse-planning/domain-message-flow).

## 2. Order allocation to released work

A direct-channel order allocates and releases in one request. Release is
**choreographed**. `order-management` does not call `wes-work-planning`. It
announces released lines on `OrderAllocated`, and `wes-work-planning`
derives one `WorkUnit` per line, with the id `orderId-line-n`.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer channel
    participant OM as order-management
    participant INV as inventory-storage
    participant WP as wes-work-planning
    actor Sup as Supervisor or ops agent
    participant FE as fulfillment-execution
    Customer->>OM: cmd: POST /orders
    Note over OM: product attributes read from its local classification copy
    loop every line
        OM->>INV: cmd: POST /reservations
        Note over OM,INV: 201 reserved or 409 insufficient usable stock
    end
    INV-)WP: evt: StockReserved on warehouse.inventory.events
    Note over WP: UsableInventoryObserved updated
    OM-)WP: evt: OrderAllocated on warehouse.order-management.events
    Note over WP: ApplyOrderAllocated enqueues one WorkUnit per released line
    WP-)WP: evt: WorkUnitCreated on warehouse.work-planning.events
    Sup->>WP: cmd: POST /paths/{pathId}/release or MCP release_next_work
    Note over WP: hazmat and fragile hints read from its local classification copy
    WP-)FE: evt: WorkReleased on warehouse.work-planning.events
    Note over FE: CreateTask builds its own Task, orderRef is the work unit id
```

`OrderPartiallyAllocated` takes the place of `OrderAllocated` when a
partial-shipment order releases only some lines. A ship-complete order with
a backordered line releases nothing. `POST /paths/{pathId}/work-units` is a
REST alternative to the Kafka enqueue. Neither `order-management` nor
`wes-work-planning` asks another context for a SKU's classification at
request time: each reads a local copy fed by product-master's
`ProductClassified` (scenario 10), with `PRODUCT_CLASSIFICATION_MODE=kafka`
in the reference deployment. The binary default, `permissive`, reads no
copy and adds no hint.

Sources: [order-management flow 1](/contexts/order-management/domain-message-flow),
[wes-work-planning scenario 1](/contexts/wes-work-planning/domain-message-flow),
[inventory-storage flow 1](/contexts/inventory-storage/domain-message-flow),
[wes-work-planning context map](/contexts/wes-work-planning/context-map).

## 3. Execution: pick, rebin, pack, SLAM and the completion loop

`fulfillment-execution` dispatches by **pull**. A station claims the next
earliest-CPT task it is equipped for. `TaskCompleted` closes the WIP loop
in `wes-work-planning` and feeds `labor-performance`. `PackageManifested`
reaches `order-management`.

```mermaid
sequenceDiagram
    autonumber
    participant WP as wes-work-planning
    participant FE as fulfillment-execution
    actor Picker as Picker at a Pick station
    actor Packer as Rebin and pack associates
    actor Slam as SLAM line
    participant INV as inventory-storage
    participant LP as labor-performance
    participant OM as order-management
    WP-)FE: evt: WorkReleased on warehouse.work-planning.events
    Picker->>FE: cmd: POST /stations/{stationId}/check-in
    Picker->>FE: cmd: POST /stations/{stationId}/claim-next taskType PICK
    Note over FE: earliest-CPT PICK task leased for 5 minutes
    Picker->>FE: cmd: POST /tasks/{id}/complete
    FE-)WP: evt: TaskCompleted on warehouse.fulfillment.events
    Note over WP: ApplyTaskCompleted frees the WIP slot, WorkUnitCompleted
    FE-)LP: evt: TaskCompleted with associate_id and task_type
    Packer->>FE: cmd: POST /rebin/arrivals per picked line
    Note over FE: last line creates the PACK task once
    Packer->>FE: cmd: POST /stations/{stationId}/claim-next taskType PACK
    Packer->>FE: cmd: POST /tasks/{id}/seal-package
    Note over FE: DOT segregation checked against its local classification copy
    Slam->>FE: cmd: POST /packages/{id}/slam actualWeight and expectedWeight
    FE-)OM: evt: PackageManifested on warehouse.fulfillment.events
    Note over OM: re-promise the line, see scenario 5
```

Outside the 5 % weight tolerance, the package is `DIVERTED`. That raises
`WeightDiscrepancyDetected` and `PackageDiverted` on the analytics topic
only, and nothing reaches `order-management`. No sibling calls
`inventory-storage`'s `POST /reservations/{id}/confirm-pick`. The physical
pick therefore never consumes the reservation in the live flow. Only the
`e2e-tests` simulator calls it.

Sources: [fulfillment-execution scenarios 1 and 2](/contexts/fulfillment-execution/domain-message-flow),
[wes-work-planning context map, "The loop"](/contexts/wes-work-planning/context-map),
[labor-performance flow 1](/contexts/labor-performance/domain-message-flow),
[inventory-storage context map](/contexts/inventory-storage/context-map).

## 4. Shipment confirmation back to the network

The network order is closed by an **explicit** shipment confirmation,
which an operator or an upstream caller sends. It is not derived from
`PackageManifested`. `network-fulfillment` keeps no mapping from a work
unit or package to a `NetworkRef`, and its ADR 0014 records that choice.

```mermaid
sequenceDiagram
    autonumber
    participant FE as fulfillment-execution
    participant OM as order-management
    actor OP as Operator or upstream caller
    participant NF as network-fulfillment
    participant RN as retail-network
    FE-)OM: evt: PackageManifested on warehouse.fulfillment.events
    Note over FE,NF: no event or call links the package to the NetworkOrder
    OP->>NF: cmd: POST /network-orders/{networkRef}/shipment-confirmation
    NF-)NF: evt: NetworkOrderShipmentConfirmed on warehouse.network-fulfillment.events
    NF->>RN: cmd: SubmitShipmentConfirmation networkRef
    Note over OP,NF: 204 No Content, order CONFIRMED
    OP->>NF: qry: GET /network-orders/{networkRef}
```

The synced `apis/network-fulfillment/openapi.yaml` does not yet list the
`shipment-confirmation` route. It is drawn here from the context's
code-grounded flow page. `NetworkOrderShipmentConfirmed` has no Kafka
consumer in the fleet.

Sources: [network-fulfillment flow 1](/contexts/network-fulfillment/domain-message-flow),
[network-fulfillment EventStorming, section 3](/contexts/network-fulfillment/eventstorming),
[network-fulfillment context map](/contexts/network-fulfillment/context-map).

## 5. CPT miss and re-promise

The **CPT** (Critical Pull Time) is a site's carrier cutoff. An external
scheduler drives `fulfillment-execution`'s sweep. Every open task at or
past its CPT is reported, and `order-management` recomputes the affected
line's shipment-group promise from its local read models.

```mermaid
sequenceDiagram
    autonumber
    actor Op as Operator
    participant PPM as process-path-management
    participant WP as wes-work-planning
    participant SCH as Scheduler, external
    participant FE as fulfillment-execution
    participant OM as order-management
    participant NF as network-fulfillment
    Op->>PPM: cmd: PUT /sites/{siteId}/cpt-schedule
    PPM-)OM: evt: CPTScheduleChanged on warehouse.process-path-management.events
    PPM-)NF: evt: CPTScheduleChanged
    WP-)OM: evt: PathCapacityChanged on warehouse.work-planning.events
    Note over OM: catalogue, CPT schedule and path-capacity caches feed PromisePolicy
    SCH->>FE: cmd: POST /tasks/sweep-cpt-misses
    Note over FE: open tasks at or past CPT, no state change
    FE-)OM: evt: TaskCPTMissed order_ref orderId-line-n on warehouse.fulfillment.events
    OM->>OM: cmd: RepromiseOrder for that line's shipment group
    alt promise moved
        OM-)OM: evt: OrderRepromised on warehouse.order-management.events
        Note over OM: no sibling consumes OrderRepromised
    else unchanged
        Note over OM: no event
    end
```

Nothing in `fulfillment-execution` runs the sweep on a timer. The same
overdue task is reported again on every later pass. `order-management`
dedupes on the CloudEvents `id` and sends a message to the DLQ after three
failed attempts.

Sources: [order-management flow 3](/contexts/order-management/domain-message-flow),
[fulfillment-execution scenario 3](/contexts/fulfillment-execution/domain-message-flow),
[process-path-management flow 3](/contexts/process-path-management/domain-message-flow).

## 6. Capacity planning feed

Three planning signals feed promising. `warehouse-planning` composes
**planned** capacity from labor, stations and demand. `wes-work-planning`
publishes **remaining** path capacity. `network-fulfillment` turns both
stock and remaining capacity into a capability offer. Planned capacity
only annotates an order. It never moves a promise (order-management
ADR 0031).

```mermaid
sequenceDiagram
    autonumber
    participant WFM as workforce-management
    participant FL as facility-layout
    participant OM as order-management
    actor Planner as Planner
    participant WPL as warehouse-planning
    actor Sched as Supervisor or scheduler
    participant WP as wes-work-planning
    participant NF as network-fulfillment
    participant INV as inventory-storage
    WFM-)WPL: evt: ShiftPlanCommitted on warehouse.workforce.events
    FL-)WPL: evt: LocationSlotRegistered role WorkCenter on warehouse.facility.events
    OM-)WPL: evt: OrderAllocated and OrderPartiallyAllocated on warehouse.order-management.events
    Planner->>WPL: cmd: PUT /station-standards/{location}/{process_type}
    Planner->>WPL: qry: GET /demand
    Planner->>WPL: cmd: POST /capacity-plans
    WPL-)OM: evt: CapacityPlanCreated on warehouse.warehouse-planning.events
    Planner->>WPL: cmd: POST /capacity-plans/{id}/publish
    WPL-)OM: evt: CapacityPlanPublished
    WPL-)OM: evt: CapacityShortageDetected, only when shortage is above 0
    WPL-)OM: evt: BottleneckDetected, ignored by order-management
    Planner->>OM: qry: GET /planned-capacity
    Sched->>WP: qry: GET /paths/{pathId}/telemetry with cutoffAt
    Note over WP: SampleBacklog computes max of 0 and wipLimit minus WIP
    WP-)OM: evt: PathCapacityChanged on warehouse.work-planning.events
    WP-)NF: evt: PathCapacityChanged
    loop every RECOMPUTE_INTERVAL, per known SKU
        NF->>INV: qry: GET /inventory/{sku}/usable
    end
    Note over NF: advertised quantity is min of physical and summed remaining capacity
```

`GET /orders/{id}` carries a `capacityConstraint` when the order's promise
overlaps a published shortage. The capability offer is computed only when
`CAPABILITY_OFFER_ENABLED=true`. It is readable through
`GET /capability-offers` and the MCP tool `list_capability_offers`, but is
not yet submitted to the network: `SubmitAvailability` is unused. That
route is also missing from the synced network-fulfillment `openapi.yaml`.
`warehouse-ops-agent` reads `get_process_path_capacity` over MCP for its
daily brief.

Sources: [warehouse-planning flows 1 to 3](/contexts/warehouse-planning/domain-message-flow),
[order-management flow 4](/contexts/order-management/domain-message-flow),
[wes-work-planning scenario 3](/contexts/wes-work-planning/domain-message-flow),
[network-fulfillment flow 4](/contexts/network-fulfillment/domain-message-flow).

## 7. Staffing and labor feedback

Measured performance flows back into staffing proposals, and committed
staffing flows forward into release planning and capacity planning.
Moving people stays a human decision.

```mermaid
sequenceDiagram
    autonumber
    participant FE as fulfillment-execution
    participant LP as labor-performance
    actor Lead as Shift lead
    participant WFM as workforce-management
    participant WP as wes-work-planning
    participant WPL as warehouse-planning
    participant OA as warehouse-ops-agent
    FE-)LP: evt: TaskCompleted on warehouse.fulfillment.events
    Note over LP: score against the standard active at completion, derive idle gap
    LP-)WFM: evt: TaskPerformanceRecorded on warehouse.labor-performance.events
    Note over WFM: laborperformancecache keeps measured mean and idle share
    Lead->>WFM: cmd: POST /paths/{pathId}/plan/propose
    Lead->>WFM: cmd: POST /shift-plans
    WFM->>FE: qry: GET /capacity/{capability} per required capability
    WFM-)WP: evt: ShiftPlanCommitted on warehouse.workforce.events, one per PathPlan line
    WFM-)WPL: evt: ShiftPlanCommitted, the same messages
    Note over WP: LaborPlanObserved compared with its own ShiftPlan
    WP-)WP: evt: PathPlanDriftDetected on warehouse.work-planning.events, no consumer
    Note over WPL: LABOR constraint registered per process type
    OA->>WFM: qry: MCP get_staffing_gap
    OA->>WP: qry: MCP get_rebalance_recommendation
    Lead->>WFM: cmd: POST /associates/{id}/assignments
```

`labor-performance` makes no REST or MCP call to a sibling. It only
consumes `TaskCompleted`. The measured-rate feed into `workforce-management`
uses Kafka when `LABOR_PERFORMANCE_MODE=kafka-cache`. The REST client for
`GET /task-types/{taskType}/performance` is still wired as the alternative.
`wes-work-planning` publishes its own, different
`com.warehouse.wes.work-planning.plan.ShiftPlanCommitted` when a planner
calls `POST /paths/{pathId}/plan`. Consumers must dispatch on the full type.

Sources: [labor-performance flow 1](/contexts/labor-performance/domain-message-flow),
[workforce-management flows 1, 2 and 4](/contexts/workforce-management/domain-message-flow),
[wes-work-planning scenario 2](/contexts/wes-work-planning/domain-message-flow),
[warehouse-planning flow 1](/contexts/warehouse-planning/domain-message-flow),
[warehouse-ops-agent flow 2](/contexts/warehouse-ops-agent/domain-message-flow).

## 8. Facility layout changes

`facility-layout` is the source of truth for physical structure. Its
events maintain local caches in `inventory-storage` and a station tally in
`warehouse-planning`. Other contexts query it only on demand.

```mermaid
sequenceDiagram
    autonumber
    actor Op as Operator
    participant FL as facility-layout
    participant INV as inventory-storage
    participant WPL as warehouse-planning
    participant FE as fulfillment-execution
    participant WP as wes-work-planning
    Op->>FL: cmd: POST /sites/{siteCode}/zones
    FL-)INV: evt: ZoneRegistered on warehouse.facility.events
    Op->>FL: cmd: POST /locations/import
    FL-)INV: evt: LocationSlotRegistered per accepted row
    FL-)WPL: evt: LocationSlotRegistered, added to the tally
    FL-)FL: evt: FacilityLayoutImported once per call
    Op->>FL: cmd: POST /locations/{locationCode}/decommission
    FL-)INV: evt: LocationSlotDecommissioned, slot dropped from the cache
    FL-)WPL: evt: LocationSlotDecommissioned, tally decremented
    FE->>FL: qry: GET /locations/{locationCode}, opt-in role check
    WP->>FL: qry: GET /distance at shift-plan commit, opt-in
```

`inventory-storage` checks a stow against its cache only when
`LOCATION_LOOKUP_MODE=kafka`. With `http`, it calls
`GET /locations/{locationCode}/classification` instead. The default,
`permissive`, enforces no placement rule. Decommission is one-way.
Re-registering the code returns `409`.

Sources: [facility-layout flows 1 to 4](/contexts/facility-layout/domain-message-flow),
[inventory-storage flow 3](/contexts/inventory-storage/domain-message-flow),
[inventory-storage EventStorming](/contexts/inventory-storage/eventstorming).

## 9. Process-path catalogue propagation

`process-path-management` defines the canonical process paths. Five
contexts replay its events into a local catalogue cache. None of them
calls it synchronously.

```mermaid
sequenceDiagram
    autonumber
    actor Op as Operator
    participant PPM as process-path-management
    participant FE as fulfillment-execution
    participant WP as wes-work-planning
    participant WFM as workforce-management
    participant OM as order-management
    participant NF as network-fulfillment
    Op->>PPM: cmd: POST /process-paths
    PPM-)FE: evt: ProcessPathCreated on warehouse.process-path-management.events
    PPM-)WP: evt: ProcessPathCreated
    PPM-)WFM: evt: ProcessPathCreated
    PPM-)OM: evt: ProcessPathCreated
    PPM-)NF: evt: ProcessPathCreated
    Op->>PPM: cmd: PUT /process-paths/{pathId}
    PPM-)OM: evt: ProcessPathUpdated, same five consumers
    Op->>PPM: cmd: DELETE /process-paths/{pathId}
    PPM-)OM: evt: ProcessPathDeactivated, same five consumers
```

`wes-work-planning` and `workforce-management` read the topic only with
`PATH_CATALOGUE_SOURCE=kafka`. Their default is a YAML file.
`warehouse-planning` does not consume these events. Its `ProcessPath` is a
different, locally declared model (see
[Ubiquitous Language](/strategic-design/ubiquitous-language)).

Sources: [process-path-management flows 1 and 2](/contexts/process-path-management/domain-message-flow),
[workforce-management flow 4](/contexts/workforce-management/domain-message-flow),
[wes-work-planning context map](/contexts/wes-work-planning/context-map).

## 10. Product master data propagation

`product-master` is the single source of truth for what a SKU is. A steward
registers and classifies a product there. Four contexts keep a local,
version-guarded copy of the classification. Nobody calls `product-master`
at request time, and `product-master` calls nobody.

```mermaid
sequenceDiagram
    autonumber
    actor Steward as Master-data steward
    participant PM as product-master
    participant INV as inventory-storage
    participant OM as order-management
    participant WP as wes-work-planning
    participant FE as fulfillment-execution
    participant OA as warehouse-ops-agent
    Steward->>PM: cmd: PUT /products/{sku}
    PM-)PM: evt: ProductRegistered on warehouse.product-master.events
    Steward->>PM: cmd: PUT /products/{sku}/classification
    PM-)INV: evt: ProductClassified on warehouse.product-master.events
    PM-)OM: evt: ProductClassified
    PM-)WP: evt: ProductClassified
    PM-)FE: evt: ProductClassified
    Note over INV,FE: each applies the event only when its version is newer than the stored row
    Steward->>PM: cmd: PUT /products/{sku}/dimensions/measured
    PM-)PM: evt: ProductMeasured, no sibling consumer
    OA->>PM: qry: MCP list_products for find_master_data_gaps
```

`inventory-storage` answers its old `PUT /products/{sku}/classification`
with `410` (`classification-moved`) and keeps applying hazmat placement and
DOT segregation at stow time from its copy. During the migration,
`product-master`'s legacy importer also reads `inventory-storage`'s legacy
`ProductClassified` from `warehouse.inventory.events`, which only the
one-shot `republish-product-classifications` backfill still emits; both are
removed at stage E (product-master ADR 0003).

Sources: [product-master domain message flow](/contexts/product-master/domain-message-flow),
[product-master Async API](/contexts/product-master/async-api),
[product-master context map](/contexts/product-master/context-map),
[warehouse-ops-agent context map](/contexts/warehouse-ops-agent/context-map).
