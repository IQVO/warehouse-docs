---
id: containers
title: C4 Level 2 — Containers
sidebar_label: 2. Containers
description: Every separately deployable process in the fleet — four Go binaries per domain bounded context, two databases per context, Kafka, and the two independent localhost gateways.
---

# C4 Level 2 — Containers

Zooming inside the single box from [System Context](/architecture/system-context).
A **container** here is C4's meaning of the word: a separately deployable or
runnable unit, whether that is a Go process, a Postgres database or the
broker. It is unrelated to Docker specifically.

This site covers nineteen backend contexts: eighteen domain contexts and
`warehouse-ops-agent`. All eighteen domain contexts ship **four Go binaries
and two databases** each, plus a Module Federation frontend remote, because
the analytical read side is a separate process family from the operational
one. `fulfillment-execution` also ships `cmd/sweep`, the entrypoint of its two
sweep CronJobs (expire-leases, sweep-cpt-misses), which POSTs the sweep
endpoints of its own Service. `warehouse-ops-agent` is one binary with no
database. Every one of the nineteen has an entry in `warehouse-infra`
`develop`'s application registry (`terraform/apps.yaml`), and each domain
context's entry declares `database: true`, an `analytics:` read side and a
`frontend_remote:`. The five most recent read sides
(`slotting-optimization`, `pick-face-replenishment`, `task-interleaving`,
`returns-processing`, `exception-management`) have `mcp.enabled: true` and
`analytics.enabled: true` in their value files; `returns-processing` and
`exception-management` were registered on 2026-10-22. That is the wiring in
`warehouse-infra` `develop`; this page does not record whether a given
cluster has applied it. Binaries are listed from each repository's `cmd/` on
`origin/develop`, and workloads from its Helm chart's `templates/`.

## The edge: two independent gateways

The most commonly misread part of this architecture, so it is drawn first.
There are exactly two host-facing product entrypoints and **no proxy
relationship between them**:

```mermaid
C4Container
    title Containers — the localhost edge

    Person(user, "Operator / Associate", "Browser")

    Container_Boundary(edge, "Host-facing product edge") {
        Container(nginxgw, "Nginx web gateway", "nginx", "localhost:80 — serves ALL static assets. Contains no /api location and no backend upstream.")
        Container(kong, "Kong", "Kong Gateway, HTTPRoute", "localhost:8000 — routes /api/{context}/** to that context's REST Service and /api/{context}/reports/** to its reports Service. Never serves assets.")
    }

    Container_Boundary(fe, "Frontend workloads — ClusterIP only") {
        Container(shell, "warehouse-console", "React + nginx", "The Module Federation host shell, served at /")
        Container(remotes, "18 x MFE remote", "React + nginx", "Each owned by its context's repo (web/), served at /mfes/{context}/")
    }

    Container_Boundary(api, "API workloads — ClusterIP only") {
        Container(oltp, "18 x OLTP REST service", "Go", "One per domain bounded context, :8080")
        Container(reports, "18 x reports service", "Go", "Read-only analytics API, :8092")
        Container(agent, "warehouse-ops-agent", "Go", ":8095 — console BFF, advisories and its own MCP server")
    }

    Rel(user, nginxgw, "Loads the UI", "HTTP :80")
    Rel(user, kong, "Calls APIs (cross-origin)", "HTTP :8000")
    Rel(nginxgw, shell, "Serves /", "ClusterIP")
    Rel(nginxgw, remotes, "Serves /mfes/{context}/", "ClusterIP")
    Rel(kong, oltp, "Routes /api/{context}/**", "ClusterIP")
    Rel(kong, reports, "Routes /api/{context}/reports/**", "ClusterIP")
    Rel(kong, agent, "Routes /api/warehouse-ops-agent/**", "ClusterIP")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

The hard constraint behind this split: **Kong must never serve HTML, CSS,
JavaScript, fonts or images.** Asset delivery is nginx's job, and
`warehouse-infra`'s exposure-policy test fails any change that adds an `/api`
location to the web gateway. Kong is exposed through the Kubernetes Gateway
API (`HTTPRoute`, rendered by each chart's `httproute.yaml`), with plain
`Ingress` as the fallback when `deploy_gateway_api` is off.

Three consequences follow, and all three are load-bearing:

1. **CORS is not optional.** Assets come from `http://localhost` and APIs
   from `http://localhost:8000`, which are genuinely different origins. Kong
   grants exactly the web gateway's origin, never `*`. The endpoints are
   unauthenticated, so a wildcard would let any page on the internet read the
   warehouse's data through the user's own browser.
2. **Frontends cannot bake in their API base URL.** The console fetches
   `/config.json` from a ConfigMap before it mounts and publishes `apiOrigin`
   on `window.__WAREHOUSE_CONFIG__`. Every remote reads it from there.
3. **"All APIs through Kong" is a north-south rule only.** Service-to-service
   calls stay on direct ClusterIP and Kafka and never hairpin through either
   gateway.

The console registers eighteen WMS and WES remotes, one per domain context:
`order_mgmt_mfe`, `inventory_mfe`,
`planning_mfe`, `fulfillment_mfe`, `workforce_mfe`, `facility_mfe`,
`process_path_mfe`, `labor_mfe`, `netfulfil_mfe` (keyed
`network_fulfillment_mfe` in the console's federation config),
`capacity_mfe` (warehouse-planning), `productmaster_mfe`
(product-master), `nip_mfe` (network-inventory-planning), `inbound_mfe`
(inbound-receiving), `slotting_mfe`, `replenishment_mfe`
(pick-face-replenishment), `task_interleaving_mfe`, `returns_mfe`
(returns-processing) and `exceptions_mfe` (exception-management). Each is
served at `/mfes/<context>/`. The same web gateway also serves the eleven
remotes of the [retail network](/network/) services, which are outside this
section. The console's
cross-cutting screens (the order lifecycle and the WMS and WES dashboards)
do not call every service
from the browser. They call `warehouse-ops-agent`'s BFF routes
`/console/orders/{id}/lifecycle`, `/console/reports/wms` and
`/console/reports/wes`, which fan out server-side.

## Inside one bounded context: four binaries, two databases

Every persisting bounded context follows the same internal shape.
`labor-performance` is drawn here as the representative example. Substitute
the names and the diagram holds for all eighteen.

```mermaid
C4Container
    title Containers — inside one bounded context (labor-performance shown)

    Container_Boundary(ctx, "labor-performance — one bounded context") {
        Container(oltp, "cmd/labor", "Go, :8080", "OLTP: REST API, Kafka consumer and outbox relay. Owns the OLTP database.")
        Container(mcp, "cmd/mcp", "Go, :8090", "MCP server, Streamable HTTP. Tools for AI and agent consumers.")
        Container(proj, "cmd/labor-projector", "Go, admin :8091", "Analytics WRITER. Consumes the analytics topic and is the ONLY writer of the analytical database.")
        Container(rep, "cmd/labor-reports", "Go, :8092", "Analytics READER. Read-only sessions, serves GET /reports/**.")

        ContainerDb(oltpdb, "OLTP database", "Postgres via PgBouncer", "Aggregates, outbox_events, processed_events, idempotency_keys")
        ContainerDb(anadb, "Analytical database", "Postgres, direct", "Report projections. A separate database from the OLTP one.")
    }

    System_Ext(kafka, "Kafka", "One broker, platform-wide")

    Rel(oltp, oltpdb, "Reads / writes", "pgx")
    Rel(oltp, kafka, "Consumes TaskCompleted, relays the outbox", "Kafka")
    Rel(mcp, oltpdb, "Reads", "pgx")
    Rel(proj, kafka, "Consumes the analytics topic", "Kafka")
    Rel(proj, anadb, "Writes projections", "pgx")
    Rel(rep, anadb, "Reads only", "default_transaction_read_only=on")

    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

### Why the read side is separate processes

This is the estate-level CQRS split. Each context owns its analytical read
model as a **data product** built from its own analytics stream, rather than
every context feeding one central warehouse.

| Process | Database access | Guarantee it buys |
| --- | --- | --- |
| OLTP binary | Read-write on the OLTP database | Report queries run against a different database, so they never lock or block operational tables. |
| Projector | Read-write on the analytical database | Exactly one writer, so two racing writers can never corrupt the projection. |
| Reports binary | Sessions opened with `default_transaction_read_only=on` | A bug in the reader cannot mutate the read model. |

The report is rebuilt purely from events, with no second write from the
OLTP side. That makes it clean but **eventually consistent**: the contract
is a freshness lag, not real time, which is why every report has a
`/freshness` endpoint and the console's dashboard cards show it.

## The whole fleet at a glance

| Context | OLTP binary | MCP | Projector | Reports | MFE remote | Databases |
| --- | --- | --- | --- | --- | --- | --- |
| `order-management` | `cmd/order` | `cmd/mcp` | `cmd/order-projector` | `cmd/order-reports` | `order_mgmt_mfe` | 2 |
| `inventory-storage` | `cmd/inventory` | `cmd/mcp` | `cmd/inventory-projector` | `cmd/inventory-reports` | `inventory_mfe` | 2 |
| `wes-work-planning` | `cmd/wes` | `cmd/mcp` | `cmd/wes-projector` | `cmd/wes-reports` | `planning_mfe` | 2 |
| `fulfillment-execution` | `cmd/execution` (plus `cmd/sweep`, the CronJob entrypoint) | `cmd/mcp` | `cmd/fulfillment-projector` | `cmd/fulfillment-reports` | `fulfillment_mfe` | 2 |
| `workforce-management` | `cmd/workforce` | `cmd/mcp` | `cmd/workforce-projector` | `cmd/workforce-reports` | `workforce_mfe` | 2 |
| `facility-layout` | `cmd/facility` | `cmd/mcp` | `cmd/facility-projector` | `cmd/facility-reports` | `facility_mfe` | 2 |
| `process-path-management` | `cmd/pathmgmt` | `cmd/mcp` | `cmd/pathmgmt-projector` | `cmd/pathmgmt-reports` | `process_path_mfe` | 2 |
| `labor-performance` | `cmd/labor` | `cmd/mcp` | `cmd/labor-projector` | `cmd/labor-reports` | `labor_mfe` | 2 |
| `network-fulfillment` | `cmd/netfulfil` | `cmd/mcp` | `cmd/netfulfil-projector` | `cmd/netfulfil-reports` | `netfulfil_mfe` | 2 |
| `warehouse-planning` | `cmd/api` | `cmd/mcp` | `cmd/planning-projector` | `cmd/planning-reports` | `capacity_mfe` | 2 |
| `product-master` | `cmd/api` | `cmd/mcp` | `cmd/product-projector` | `cmd/product-reports` | `productmaster_mfe` | 2 |
| `network-inventory-planning` | `cmd/network-inventory-planning` | `cmd/mcp` | `cmd/nip-projector` | `cmd/nip-reports` | `nip_mfe` | 2 |
| `inbound-receiving` | `cmd/api` | `cmd/mcp` | `cmd/inbound-projector` | `cmd/inbound-reports` | `inbound_mfe` | 2 |
| `slotting-optimization` | `cmd/api` | `cmd/mcp` | `cmd/slotting-projector` | `cmd/slotting-reports` | `slotting_mfe` | 2 |
| `pick-face-replenishment` | `cmd/api` | `cmd/mcp` | `cmd/pfr-projector` | `cmd/pfr-reports` | `replenishment_mfe` | 2 |
| `task-interleaving` | `cmd/api` | `cmd/mcp` | `cmd/ti-projector` | `cmd/ti-reports` | `task_interleaving_mfe` | 2 |
| `returns-processing` | `cmd/api` | `cmd/mcp` | `cmd/returns-projector` | `cmd/returns-reports` | `returns_mfe` | 2 |
| `exception-management` | `cmd/api` | `cmd/mcp` | `cmd/exceptions-projector` | `cmd/exceptions-reports` | `exceptions_mfe` | 2 |
| `warehouse-ops-agent` | `cmd/agent` | in-process at `/mcp` | none | none | none | **0** |

Per-context table counts are in [Data Models](/architecture/data-models),
and aggregate counts are in [Domain Model](/architecture/domain-model).

`warehouse-ops-agent` is the deliberate exception on every axis. It has one
binary and **no database**, and holds no persisted state: every fact it
reasons over is re-derived from upstream MCP and REST reads at request time.
It is a Customer of the other contexts' Open Host Services, with no aggregate
of its own. It is also the only context whose MCP server shares a process and
port with its main binary.

### The port convention

| Workload | Listen address | Env var | Kubernetes Service |
| --- | --- | --- | --- |
| OLTP | `:8080` | `HTTP_ADDR` | `:80` to 8080 |
| MCP | `:8090` | `MCP_ADDR` | `:8090` to 8090 |
| Projector | `:8091` | `ADMIN_ADDR` | none: admin and health only |
| Reports | `:8092` | `HTTP_ADDR` | `<context>-reports`, `:80` to 8092 |
| Frontend (nginx) | `:8080` | — | `:80` to 8080 |
| `warehouse-ops-agent` | `:8095` | `AGENT_ADDR` | REST and `/mcp` on one port |

Each chart's Services select on `app.kubernetes.io/component` as well as the
name and instance labels, so the OLTP, MCP, projector and reports pods of one
release are addressed separately.

### Where the databases actually live

The logical separation is real, but the physical deployment has less
isolation than the diagram might suggest. **One Postgres release**
(`postgres`, in the data namespace) hosts forty-seven databases in
`warehouse-infra` `develop`'s registry: an OLTP database and a
`<service>_analytics` database for each of the eighteen domain contexts
(thirty-six), plus the OLTP-only databases of the eleven
[retail network](/network/) services registered in the same
`terraform/apps.yaml`. Each database has its own generated role. OLTP
connections go through PgBouncer. Analytics connections go to Postgres
directly.

In the local cluster a single generated analytics role serves both the
projector and the reports binary (each chart's `reportsUrl` falls back to
`projectorUrl`; the registry entries of `network-fulfillment`,
`pick-face-replenishment`, `task-interleaving`, `returns-processing` and
`exception-management` provision only `ANALYTICS_DATABASE_URL`, which both
binaries read). The read-only guarantee therefore comes from the reports
binary's read-only sessions. A distinct read-only role is the documented
promotion path in `warehouse-infra`.

## MCP servers

Every domain context ships a `cmd/mcp` binary that serves MCP over
Streamable HTTP on `:8090`, and `warehouse-ops-agent` serves its own read-only
tools in-process at `/mcp`. Like REST, **MCP is unauthenticated
fleet-wide**.

The main MCP consumer inside the fleet is `warehouse-ops-agent`, which calls
upstream tools such as `get_rebalance_recommendation`,
`get_backlog_telemetry`, `get_staffing_gap`, `diagnose_stuck_tasks`,
`get_task_type_utilization`, `check_availability`, `estimate_travel_distance`
`get_process_path_capacity`, product-master's `list_products` (for
`find_master_data_gaps`) and network-inventory-planning's `get_transfer`,
`find_stuck_transfers` and `simulate_transfer_options` (its transfer watch), and inbound-receiving's
`list_asns`, `list_appointments` and `list_receipts` (its inbound outlook). Several more are wired but unused.
labor-performance and process-path-management call no sibling over REST or
MCP. The per-tool status is on each context's
[Context Map](/strategic-design/context-map) page.

## Kafka: one broker, two topic families

There is exactly **one Kafka broker platform-wide**: a single combined
controller and broker in KRaft mode. Business topics are auto-created with
eight partitions. Most consumers dead-letter messages they cannot process to
`<topic>.dlq`. The exception is network-inventory-planning, whose five OLTP
consumers log and commit past deterministic failures and have no dead-letter topic;
only its analytics projector dead-letters.

Two distinct topic families run over it, and conflating them is a common
misreading:

- **Integration topics** are the published language between bounded
  contexts. They are the edges on the
  [Context Map](/strategic-design/context-map).
- **Analytics topics** feed only that context's own projector. They are kept
  off the integration topics so that adding a report never changes a contract
  another context depends on.

Both families carry exactly one envelope: **CloudEvents 1.0 in structured
content mode**, with `content-type: application/cloudevents+json;
charset=UTF-8` on every message and `type` of the form
`com.warehouse.<wms|wes>.<context>.<entity>.<EventName>`. See the
[Event Standard](/strategic-design/event-standard-cloudevents).

### Integration topics

Who publishes what, and who consumes it, from each context's
`apis/asyncapi.yaml` and Kafka adapters on `origin/develop` and its context
map. Each topic is drawn once, on the left, with its producer; its consumers
are on the right. A dashed edge marks an opt-in consumer, one that stays
off unless its mode or consumer group is configured; solid edges are the
rest. Which types travel on each edge is in the table below the diagram, and
the per-edge status (live, wired-but-unused) is on the
[Context Map](/strategic-design/context-map).

```mermaid
flowchart LR
    subgraph topics["Integration topics, by producer"]
        tOM(["order-management<br/>warehouse.order-management.events"])
        tINV(["inventory-storage<br/>warehouse.inventory.events"])
        tWWP(["wes-work-planning<br/>warehouse.work-planning.events"])
        tFE(["fulfillment-execution<br/>warehouse.fulfillment.events"])
        tWFM(["workforce-management<br/>warehouse.workforce.events"])
        tFL(["facility-layout<br/>warehouse.facility.events"])
        tPPM(["process-path-management<br/>warehouse.process-path-management.events"])
        tLP(["labor-performance<br/>warehouse.labor-performance.events"])
        tWPL(["warehouse-planning<br/>warehouse.warehouse-planning.events"])
        tNF(["network-fulfillment<br/>warehouse.network-fulfillment.events"])
        tPM(["product-master<br/>warehouse.product-master.events"])
        tNIP(["network-inventory-planning<br/>warehouse.network-inventory-planning.events"])
        tIR(["inbound-receiving<br/>warehouse.inbound-receiving.events"])
        tSO(["slotting-optimization<br/>warehouse.slotting-optimization.events"])
        tPFR(["pick-face-replenishment<br/>warehouse.pick-face-replenishment.events"])
        tTI(["task-interleaving<br/>warehouse.task-interleaving.events"])
        tRP(["returns-processing<br/>warehouse.returns-processing.events"])
        tEM(["exception-management<br/>warehouse.exception-management.events"])
    end
    subgraph consumers["Consumers"]
        cOM[order-management]
        cINV[inventory-storage]
        cWWP[wes-work-planning]
        cFE[fulfillment-execution]
        cWFM[workforce-management]
        cLP[labor-performance]
        cWPL[warehouse-planning]
        cNF[network-fulfillment]
        cNIP[network-inventory-planning]
        cIR[inbound-receiving]
        cSO[slotting-optimization]
        cPFR[pick-face-replenishment]
        cTI[task-interleaving]
        cRP[returns-processing]
        cEM[exception-management]
    end
    tOM --> cWWP
    tINV --> cWWP
    tWWP --> cFE
    tWWP --> cOM
    tFE --> cWWP
    tFE --> cLP
    tFE --> cOM
    tFE --> cWPL
    tWFM --> cWWP
    tWFM --> cWPL
    tFL --> cINV
    tFL --> cWPL
    tPPM --> cFE
    tPPM --> cWWP
    tPPM --> cWFM
    tPPM --> cOM
    tLP --> cWFM
    tPM --> cINV
    tPM --> cOM
    tPM --> cWWP
    tPM --> cFE
    tNIP --> cWWP
    tIR --> cWPL
    tSO --> cWWP
    tPM --> cRP
    tOM --> cRP
    tFE --> cRP
    tRP --> cINV
    tRP --> cEM
    tFE --> cEM
    tWWP --> cEM
    tNF --> cEM
    tOM --> cEM
    tINV --> cEM
    tIR --> cEM
    tOM -.-> cWPL
    tWWP -.-> cNF
    tPPM -.-> cNF
    tWPL -.-> cOM
    tOM -.-> cNIP
    tFL -.-> cNIP
    tWPL -.-> cNIP
    tINV -.-> cNIP
    tFE -.-> cNIP
    tNIP -.-> cINV
    tPM -.-> cIR
    tFL -.-> cIR
    tIR -.-> cINV
    tPM -.-> cSO
    tFL -.-> cSO
    tOM -.-> cSO
    tFE -.-> cINV
    tINV -.-> cSO
    tINV -.-> cPFR
    tSO -.-> cPFR
    tFL -.-> cPFR
    tPM -.-> cPFR
    tPM -.-> cNIP
    tFE -.-> cTI
    tFL -.-> cTI
    tIR -.-> cNF
    tPFR -.-> cWWP
    tTI -.-> cFE
```

| Topic | Producer | Integration types | Consumers |
| --- | --- | ---: | --- |
| `warehouse.order-management.events` | order-management | 4 | wes-work-planning (`OrderAllocated`, `OrderPartiallyAllocated`); warehouse-planning, opt-in; network-inventory-planning (`SiteSkuDemandChanged`), opt-in; slotting-optimization (`SiteSkuDemandChanged`, opt-in); returns-processing (`OrderAllocated`, `OrderPartiallyAllocated`, into its allocated-lines copy); exception-management (`OrderRepromised`, correlation only: it auto-resolves an open `TaskCPTMissed` case) |
| `warehouse.inventory.events` | inventory-storage | 15 | wes-work-planning (`StockReserved`, `ReservationRevoked`); slotting-optimization (`StockRelocated`, opt-in: the plan execution progress); pick-face-replenishment (`StockRelocated`, acted on only for reason `REPLENISHMENT`, and `BinStockLevelChanged`, both opt-in); `network-inventory-planning` (the two allocation replies and the two destination facts, opt-in); exception-management (`DiscrepancyDetected`, `ItemUnlocated`, promoted onto this topic 2026-10-21) |
| `warehouse.work-planning.events` | wes-work-planning | 11 | fulfillment-execution (`WorkReleased`, including `RELOCATE` and `REPLENISH` work); order-management and network-fulfillment (`PathCapacityChanged`); order-management (`WorkUnitCreated`, the release confirmation, opt-in and not set in the reference deployment); exception-management (`BacklogThresholdBreached`) |
| `warehouse.fulfillment.events` | fulfillment-execution | 10 | wes-work-planning and labor-performance (`TaskCompleted`); warehouse-planning (`TaskCompleted`, the observed-capacity read model, its ADR 0017); inventory-storage (`TaskCompleted`, opt-in: confirms picks and applies `RELOCATE` and `REPLENISH` moves); task-interleaving (`TaskAvailable`, `TaskClaimed`, `TaskCompleted`, opt-in); order-management (`TaskCPTMissed`, `PackageManifested`); network-inventory-planning (the three transfer facts, opt-in); returns-processing (`PackageManifested`); exception-management (`TaskCPTMissed`, `PackageDiverted`, `WeightDiscrepancyDetected`) |
| `warehouse.workforce.events` | workforce-management | 1 | wes-work-planning, warehouse-planning (`ShiftPlanCommitted`) |
| `warehouse.facility.events` | facility-layout | 15 | inventory-storage, warehouse-planning, network-inventory-planning (`SiteCapabilityChanged`, opt-in), inbound-receiving (the two slot events, opt-in); slotting-optimization (zone and slot events, opt-in); pick-face-replenishment (`ZoneRegistered`, `LocationSlotRegistered`, `LocationSlotDecommissioned`, opt-in); task-interleaving (the same three plus `LocationGeometryUpdated`, opt-in) |
| `warehouse.process-path-management.events` | process-path-management | 4 | fulfillment-execution, wes-work-planning, workforce-management, order-management, network-fulfillment |
| `warehouse.labor-performance.events` | labor-performance | 1 | workforce-management (`TaskPerformanceRecorded`) |
| `warehouse.warehouse-planning.events` | warehouse-planning | 6 | order-management, opt-in; network-inventory-planning (`CapacityPlanPublished`), opt-in |
| `warehouse.network-fulfillment.events` | network-fulfillment | 7 | exception-management (`AcknowledgementDeadlineAtRisk`, `OrphanedHoldCancelled`); the `networkorder.*` types have no consumer |
| `warehouse.network-inventory-planning.events` | network-inventory-planning | 3 | inventory-storage (`TransferAllocationRequested`, opt-in); wes-work-planning (`WorkDemandReleased`); `TransferPlanApproved` has no consumer |
| `warehouse.product-master.events` | product-master | 8 | inventory-storage, order-management, wes-work-planning, fulfillment-execution (`ProductClassified`, into local copies); the pack-level events (`ProductPackLevelDeclared`, `ProductPackLevelRetired`), into a local packaging view, have consumers built in seven contexts: inventory-storage, wes-work-planning, fulfillment-execution, inbound-receiving, slotting-optimization, network-inventory-planning and pick-face-replenishment (the per-edge status is on the context map); inbound-receiving (`ProductRegistered`, opt-in); slotting-optimization (`ProductClassified`, `ProductDimensionsDeclared`, `ProductMeasured`, opt-in); returns-processing (`ProductClassified`) |
| `warehouse.inbound-receiving.events` | inbound-receiving | 11 | inventory-storage (`ReceiptLineReceived`, opt-in, its ADR 0037, and `ReceiptCartonReceived`); warehouse-planning (`DockAppointmentBooked`, `DockAppointmentCancelled`, its ADR 0017); network-fulfillment (the receipt events of the ASNs it registered, live mode only, its ADR 0028); exception-management (`CartonDiscrepancyRaised`) |
| `warehouse.slotting-optimization.events` | slotting-optimization | 3 | wes-work-planning (`SlotPlanApproved`, plans one `RELOCATE` work unit per move, its ADR-0040); pick-face-replenishment (`SlotPlanApproved`, opt-in); `SlotPlanGenerated` and `SlotPlanRejected` have no consumer |
| `warehouse.pick-face-replenishment.events` | pick-face-replenishment | 3 | wes-work-planning (`ReplenishmentRequested` and `ReplenishmentCancelled`, plans one `REPLENISH` work unit per request, its ADR-0042; opt-in `REPLENISHMENT_MODE=kafka`, set in the reference deployment); `ReplenishmentCompleted` has no consumer (wes-work-planning ignores it) |
| `warehouse.task-interleaving.events` | task-interleaving | 1 | fulfillment-execution (`InterleavingHintIssued`, an advisory tie-break inside one `claimNext` priority band, its ADR 0051; `TASK_INTERLEAVING_MODE=kafka`) |
| `warehouse.returns-processing.events` | returns-processing | 7 | inventory-storage (`ReturnLineStaged`, once per `RESTOCK` disposition, into its staged-receipt use case, its ADR 0044); exception-management (`UnexpectedReturnReceived`, one case per receipt line); the other five types have no consumer |
| `warehouse.exception-management.events` | exception-management | 7 | none: no context consumes any of its seven types |

The type counts are the messages each producer's `asyncapi.yaml` declares on
its integration channel (counted on `origin/develop`, 2026-10-27). The
consumers come from each consumer's own `asyncapi.yaml` plus its Kafka
adapters on `develop`: several consumers' specs omit a type their code
consumes (the pack-level consumers of wes-work-planning, fulfillment-execution,
slotting-optimization and network-inventory-planning, and
network-fulfillment's receipt consumer). Several consumers are themselves behind a mode
switch (for example `PATH_CATALOGUE_SOURCE=kafka` or
`LOCATION_LOOKUP_MODE=kafka`). The per-edge status is on each context's
context map page.

### Analytics topics

One per domain context, consumed only by that context's own projector:
`warehouse.order-management.analytics`, `warehouse.inventory.analytics`,
`warehouse.wes.analytics` (wes-work-planning), `warehouse.fulfillment.analytics`,
`warehouse.workforce.analytics`, `warehouse.facility.analytics`,
`warehouse.process-path-management.analytics`,
`warehouse.labor-performance.analytics`,
`warehouse.network-fulfillment.analytics`,
`warehouse.warehouse-planning.analytics`,
`warehouse.product-master.analytics`,
`warehouse.network-inventory-planning.analytics`,
`warehouse.inbound-receiving.analytics`,
`warehouse.slotting-optimization.analytics`,
`warehouse.pick-face-replenishment.analytics` (its three request events plus
the analytics-only `ReplenishmentPolicyDeclared`),
`warehouse.task-interleaving.analytics` (the hint, its outcomes and the
policy event), `warehouse.returns-processing.analytics` and
`warehouse.exception-management.analytics` (seven types each, mirroring
their integration topics). Each of the eighteen has a projector binary on
`develop` (`cmd/<prefix>-projector`, see the fleet table above).

## What this diagram does not show

- **Replica counts and autoscaling.** Those live in each chart's `hpa.yaml`
  and `warehouse-infra`'s values. Drawing them here would go stale
  immediately.
- **The observability stack.** Every binary exports OTLP traces and metrics
  to a collector, with Jaeger, Prometheus/Grafana and Loki behind it. It is
  drawn at [level 1](/architecture/system-context) and omitted here to keep
  the product topology readable.
- **Any authentication container**, because there is none. Every REST and
  MCP endpoint in the fleet is unauthenticated.

Zoom in one more level to see inside a single Go process:
[Components](/architecture/components).
