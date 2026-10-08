---
id: bounded-context-canvas
title: Bounded context canvas
sidebar_label: Bounded context canvas
---

# Bounded context canvas

:::info[Authored in warehouse-docs]
`network-inventory-planning` does not yet ship a `docs/docs/ddd/` pack, so this page was written here from the repository's code and ADRs on `develop` (commit `8d25980`) instead of being synced. When the repository publishes its pack, replace this page with a synced copy.
:::

Following the ddd-crew [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas).

## Name

`network-inventory-planning` (NIP). Repository
[IQVO/network-inventory-planning](https://github.com/IQVO/network-inventory-planning).
CloudEvents prefix `com.warehouse.wes.network-inventory-planning.`.

## Purpose

Recommend inter-warehouse stock transfers from fail-closed local facts, and
orchestrate an operator-approved transfer as a saga from origin reservation to
destination stow. It recommends and coordinates; it never becomes the inventory
ledger and never moves physical stock (ADR 0001).

## Strategic Classification

| Axis | Value | Evidence |
| --- | --- | --- |
| Domain | **Core** | ADR 0001 ("WES-core bounded context"); see the [Core Domain Chart](/contexts/network-inventory-planning/core-domain-chart) |
| Business model | Cost reduction and service level: avoid stockouts at one site by using another's surplus | design plan, ADR 0001 |
| Evolution | Custom-built, early | four phases in days; unbuilt parts listed below |

## Domain Roles

- **Execution context** for the transfer saga (it owns a state machine that
  others' facts drive).
- **Decision-support context** for the advisory simulation and the planner.
- **Open Host Service with a Published Language** towards its consumers (REST,
  read-only MCP, Kafka). **Anti-Corruption Layer** towards every producer it
  reads (each payload is mirrored into local structs and read models).

## Inbound Communication

| Counterpart | Message | Kind | Consumed by |
| --- | --- | --- | --- |
| `facility-layout` | `SiteCapabilityChanged` on `warehouse.facility.events` | event | `site_capability` read model |
| `order-management` | `SiteSkuDemandChanged` on `warehouse.order-management.events` | event | `site_sku_demand` read model |
| `warehouse-planning` | `CapacityPlanPublished` (with the additive `site_id`) on `warehouse.warehouse-planning.events` | event | `published_capacity_plan` read model |
| `inventory-storage` | `TransferStockAllocated`, `TransferStockAllocationRejected` on `warehouse.inventory.events` | reply | the saga: `ALLOCATING` to `ALLOCATED` or `UNFULFILLABLE` |
| `inventory-storage` | `TransferReceiptStaged`, `TransferStockStowed` on `warehouse.inventory.events` | fact | the saga: `IN_TRANSIT` to `ARRIVED`, then `ARRIVED` to `RECEIVED` |
| `fulfillment-execution` | `TransferPicked`, `TransferDispatched`, `TransferArrived` on `warehouse.fulfillment.events` | fact | the saga: `ALLOCATED` to `PICKED`, `PICKED` to `IN_TRANSIT`, and the reserved `IN_TRANSIT` to `ARRIVED` |
| operator, console | `POST /v1/transfers:approve` (requires `Idempotency-Key`) | command | the approval use case |
| operator, console, tools | `POST /v1/transfer-proposals:generate`, `GET /v1/transfer-simulations`, `GET /v1/transfers`, `GET /v1/transfers/{id}`, `GET /v1/rebalance-runs` | query and diagnostic | read models and the saga store |
| `warehouse-ops-agent`, other MCP clients | `get_transfer`, `list_transfers`, `find_stuck_transfers`, `simulate_transfer_options` | query | read-only MCP server |

Five consumer groups, each set from the environment with no default
(`SITE_CAPABILITY_CONSUMER_GROUP`, `SITE_SKU_DEMAND_CONSUMER_GROUP`,
`CAPACITY_PLAN_CONSUMER_GROUP`, `TRANSFER_REPLY_CONSUMER_GROUP`,
`TRANSFER_FACT_CONSUMER_GROUP`): an unset group means that consumer does not
exist. The analytics projector has its own group, `ANALYTICS_CONSUMER_GROUP`.

## Outbound Communication

| Counterpart | Message | Kind | Topic |
| --- | --- | --- | --- |
| `inventory-storage` | `TransferAllocationRequested` | command | `warehouse.network-inventory-planning.events` |
| `wes-work-planning` | `WorkDemandReleased` (pick leg, then dispatch leg) | command | `warehouse.network-inventory-planning.events` |
| anyone | `TransferPlanApproved` | event | `warehouse.network-inventory-planning.events` (no consumer in the fleet today) |
| own projector | `TransferStateAdvanced`, `TransferStuckDetected`, `RebalanceRunCompleted` | analytics occurrence | `warehouse.network-inventory-planning.analytics` |

All six are published through the transactional outbox in the same transaction
as the state change that justifies them. A request handler never sends to Kafka.

## Ubiquitous Language

See the [Ubiquitous Language](/contexts/network-inventory-planning/ubiquitous-language)
page: InterWarehouseTransfer, Proposal, ScoreBreakdown, PlanningSnapshot,
SiteCapability, SiteSkuDemand, WorkDemand, StuckTransfer, RebalanceRun.

## Business Decisions

- A proposal is advisory until an operator approves it; approval is the only way
  a transfer comes into existence.
- Unknown or stale data excludes a site or refuses the answer; it is never
  zero-filled (`BuildSnapshot`, `ValidateApproval`).
- The source keeps its safety stock, the destination gets no more than its
  deficit, and only an enabled directed lane carries a proposal with a
  positive score.
- A transfer is cancellable only before the origin reservation exists, and in
  fact no REST route, MCP tool or use case invokes cancel today.
- Approval is idempotent per `Idempotency-Key`; the same key with a different
  payload is `409 idempotency-conflict`.
- Without a configured pick path the approval answers `503 config-incomplete`
  and persists nothing.
- The MCP server stays read-only until the fleet has an authentication model
  (ADR 0008).
- A short pick is recorded, and the dispatch leg carries what was picked.
- Stuck detection and scheduled rebalance runs are observe-only: they never
  mutate saga state, approve, or emit an allocation command (ADR 0007).

## Assumptions

- `facility-layout`, `order-management` and `warehouse-planning` publish the
  payloads mirrored in `apis/asyncapi.yaml`; a legacy `CapacityPlanPublished`
  without `site_id` is excluded, never inferred from `warehouse_id`.
- `inventory-storage` honours the closed rejection reasons and the
  `transfer_line_id` correlation (`<transfer_id>:1`).
- `wes-work-planning` knows the configured `path_id` values; the dispatch path
  must be created in `process-path-management` before a `TransferPicked` can
  release the dispatch demand (the reference deployment's own comment).
- One Kafka broker; REST and MCP are unauthenticated fleet-wide by decision.
- `TransferArrived` may never fire: scan-driven receiving can drive the same
  transition through `TransferReceiptStaged`.

## Verification Metrics

- Integration tests drive the saga end to end against testcontainers Postgres and
  Kafka (`transfer_saga_integration_test.go`, `planning_read_models_integration_test.go`).
- Architecture fitness tests pin the event catalogue against ADR 0004
  (`catalogue_fitness_test.go`) and the layering rules (`internal/architecture`).
- Operationally: transfers by state, transfer funnel and state dwell
  (`/reports/transfer-funnel`, `/reports/state-dwell`), stuck detections per day
  (`/reports/stuck-transfers`), rebalance run outcomes, read-model freshness
  (`/reports/freshness`).

## Open Questions

- **Spec and wire drift.** `apis/openapi.yaml` declares `SimulationResponse` as
  `{asOf, options[]}` with `Proposal` items. The handler and the MCP tool serve
  `{advisory, asOf, sites[]}`. The console remote's `types.ts` declares
  `options: Proposal[]`. One of the three must change.
- **Where do proposals come from on the read-model path?** The planner needs
  positions, policies and lanes, none of which is projected. Until a stock
  position read model and a lane and policy catalogue exist, the scheduled
  rebalance records zero proposals (`RunScheduledRebalance` passes no positions,
  policies or lanes to the planner).
- **Cancellation after allocation.** `Cancel` exists on the aggregate and is legal
  only before `ALLOCATED`; a held reservation needs an explicit revocation path
  that is not designed yet (ADR 0003, ADR 0008).
- **Dispatch-path misconfiguration.** Approval validates the pick path but not the
  dispatch path. `ApplyTransferPick` checks `ValidateDispatch` only after
  applying the transition and returns the error from inside the unit of work. That
  error (`ErrWorkReleaseNotConfigured`) is not in `IsDeterministicFact`, so the consumer
  treats it as transient and retries the same `TransferPicked` indefinitely, which
  blocks that partition, rather than failing at approval time. The code comment says
  the `PICKED` transition should commit regardless; it does not. A question for the
  repository.
- **Per-state dwell.** `TransferStateAdvanced.age_seconds` is age since creation,
  so `/reports/state-dwell` approximates the time spent per state (ADR 0009);
  a `dwell_seconds` field is a deferred contract change.
- **Auto-approval, route optimisation, forecasting, dynamic order-site
  assignment** (the plan's Phase 5) are explicitly not built and need their own
  decisions.
