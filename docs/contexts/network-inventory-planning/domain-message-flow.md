---
id: domain-message-flow
title: Domain message flow
sidebar_label: Domain message flow
---

# Domain message flow

:::info[Authored in warehouse-docs]
`network-inventory-planning` does not yet ship a `docs/docs/ddd/` pack, so this page was written here from the repository's code and ADRs on `develop` (commit `8d25980`) instead of being synced. When the repository publishes its pack, replace this page with a synced copy.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Each arrow is numbered and prefixed `cmd:` (command), `evt:` (event) or `qry:`
(query). Only real messages appear: REST routes from the handler, MCP tools from
`tools.go`, and CloudEvents types from the consumers and the encoders. Replies
are shown as notes.

## 1. Facts arrive, an operator approves, stock is reserved, the pick is released

Three siblings publish the facts this context plans from. An operator checks the
advisory simulation and approves. The saga asks `inventory-storage` to reserve
origin stock, and its reply releases the pick work to `wes-work-planning`.

```mermaid
sequenceDiagram
  autonumber
  participant FL as facility-layout
  participant OM as order-management
  participant WPL as warehouse-planning
  actor Op as Operator via nip_mfe
  participant NIP as network-inventory-planning
  participant INV as inventory-storage
  participant WP as wes-work-planning
  FL->>NIP: evt: SiteCapabilityChanged on warehouse.facility.events
  OM->>NIP: evt: SiteSkuDemandChanged on warehouse.order-management.events
  WPL->>NIP: evt: CapacityPlanPublished on warehouse.warehouse-planning.events
  Note over NIP: three local read models updated, each deduplicated on the CloudEvents id
  Op->>NIP: qry: GET /v1/transfer-simulations
  Note over NIP: per-site demand, capacity and headroom, or 503 when facts are missing or stale
  Op->>NIP: cmd: POST /v1/transfers:approve with Idempotency-Key
  Note over NIP: validated against the current snapshot, saga persisted as ALLOCATING, two events in the outbox
  Note over NIP: TransferPlanApproved is published on warehouse.network-inventory-planning.events, no consumer
  NIP->>INV: cmd: TransferAllocationRequested keyed by transfer_line_id
  INV->>NIP: evt: TransferStockAllocated on warehouse.inventory.events
  Note over NIP: ALLOCATING to ALLOCATED, reservation, allocations and expiry persisted
  NIP->>WP: cmd: WorkDemandReleased, demand_id transfer_id:pick, work_kind TRANSFER_PICK
```

Source: `internal/adapters/inbound/kafka/consumers.go`,
`internal/adapters/inbound/http/handler.go`,
`internal/application/usecases/approve_transfer.go`,
`transfer_facts.go`, `internal/adapters/inbound/kafka/transfer_reply_consumer.go`.
Omits: the outbox relay hop and the analytics copy of each transition.

On the read-model path the simulation is per-site; it does not propose quantities.
The `Proposal` list comes from `POST /v1/transfer-proposals:generate` with an
explicit snapshot. See the open question in the
[Bounded Context Canvas](/contexts/network-inventory-planning/bounded-context-canvas).

## 2. The physical tail: pick, dispatch, arrival, stow

Floor work is done by `fulfillment-execution`. Its facts and `inventory-storage`'s
destination facts drive the saga to `RECEIVED`.

```mermaid
sequenceDiagram
  autonumber
  participant WP as wes-work-planning
  participant FE as fulfillment-execution
  participant NIP as network-inventory-planning
  participant INV as inventory-storage
  WP->>FE: evt: WorkReleased for the pick work unit
  FE->>NIP: evt: TransferPicked on warehouse.fulfillment.events
  Note over NIP: ALLOCATED to PICKED, picked quantity recorded even when short
  NIP->>WP: cmd: WorkDemandReleased, demand_id transfer_id:dispatch, quantity = picked quantity
  WP->>FE: evt: WorkReleased for the dispatch work unit
  FE->>NIP: evt: TransferDispatched
  Note over NIP: PICKED to IN_TRANSIT
  INV->>NIP: evt: TransferReceiptStaged on warehouse.inventory.events
  Note over NIP: IN_TRANSIT to ARRIVED. TransferArrived would do the same and may never fire
  INV->>NIP: evt: TransferStockStowed
  Note over NIP: ARRIVED to RECEIVED, stow allocations persisted, terminal
```

Source: `internal/application/usecases/transfer_facts.go`,
`internal/adapters/inbound/kafka/transfer_fact_consumer.go`,
`transfer_reply_consumer.go`; `wes-work-planning`
`internal/adapters/inbound/kafka/consumer.go` (`handleNetworkDemandEvent`).
Omits: how `wes-work-planning` turns a demand into a `WorkReleased` for
`fulfillment-execution` (that is the existing release path, shown here as one
arrow), and how `inventory-storage` produces its destination facts.
The `TRANSFER_ARRIVAL` work kind exists in the contract, but this context does
not release it.

## 3. Allocation is refused

```mermaid
sequenceDiagram
  autonumber
  actor Op as Operator
  participant NIP as network-inventory-planning
  participant INV as inventory-storage
  Op->>NIP: cmd: POST /v1/transfers:approve
  NIP->>INV: cmd: TransferAllocationRequested
  INV->>NIP: evt: TransferStockAllocationRejected with a closed reason
  Note over NIP: ALLOCATING to UNFULFILLABLE, reason ORIGIN_SITE_UNKNOWN or INSUFFICIENT_USABLE or IDEMPOTENCY_CONFLICT. No work is released
  Op->>NIP: qry: GET /v1/transfers/{id}
  Note over NIP: transfer with rejectionReason and the full audit trail
```

Source: `internal/domain/transfer/saga.go` (`MarkUnfulfillable`),
`transfer_reply_consumer.go`, `internal/adapters/inbound/http/transfers_read.go`.
Omits: retry. The saga does not retry or re-plan; a refused transfer is terminal
and the operator approves a new one under a new idempotency key.

## 4. Finding a stuck transfer

```mermaid
sequenceDiagram
  autonumber
  participant NIP as network-inventory-planning
  participant PROJ as nip-projector
  participant OA as warehouse-ops-agent
  actor Op as Operator
  NIP-->>PROJ: evt: TransferStuckDetected on warehouse.network-inventory-planning.analytics
  Note over NIP: observe-only ticker, never changes saga state
  Op->>OA: qry: GET /transfer-watch/stuck
  OA->>NIP: qry: MCP find_stuck_transfers with older_than_minutes
  Note over OA: triage by state alone, with the next read-only check to make
  Op->>NIP: qry: GET /reports/stuck-transfers on nip-reports
  Note over PROJ: detections per state per day plus the latest occurrences
```

Source: `internal/application/usecases/saga_health.go`, `periodic.go`,
`internal/adapters/inbound/mcp/tools.go`, `internal/analytics/report/*.go`;
`warehouse-ops-agent` ADR 0019.
Omits: the projector's dead-letter path and the rule that it never dead-letters a
transient failure (ADR 0009). The `Op` to `nip-reports` query is drawn
against `NIP` for brevity; it is served by the separate `cmd/nip-reports` binary on
`:8092`.
