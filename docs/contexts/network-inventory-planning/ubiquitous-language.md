---
id: ubiquitous-language
title: Ubiquitous language
sidebar_label: Ubiquitous language
---

# Ubiquitous language

:::info[Authored in warehouse-docs]
`network-inventory-planning` does not yet ship a `docs/docs/ddd/` pack, so this page was written here from the repository's code and ADRs on `develop` (commit `8d25980`) instead of being synced. When the repository publishes its pack, replace this page with a synced copy.
:::

Use these exact names in code, API and conversation. Each term below is a type,
constant or field in `internal/domain/**`, or a column in the migrations.

## In the model

| Term | Meaning | Where |
| --- | --- | --- |
| **Site** (`SiteID`) | One warehouse in the fulfillment network. The identity is facility-layout's `site_code`; this context keeps a string, not the site hierarchy | `transfer.SiteID`, `planning.SiteCapability.Site` |
| **Position** | The planner's point-in-time view of one SKU at one site: `Available`, `CustomerReservations`, `ConfirmedInbound`, `CommittedOutbound`, `AsOf`. Deliberately not an inventory ledger | `transfer.Position` |
| **Usable** | `Available - CustomerReservations - CommittedOutbound`: the stock planning may consider before a new transfer | `Position.Usable()` |
| **Policy** | Versioned guardrails for a SKU at a site: `SafetyStock`, `TargetStock`, `UnitPriority` | `transfer.Policy` |
| **Deficit** | `TargetStock - (Usable + ConfirmedInbound)`, never negative | `Policy.Deficit` |
| **Lane** | An approved directed route between two sites, with `LeadTime`, `UnitHandlingCost` and `Enabled` | `transfer.Lane` |
| **Proposal** | An advisory recommendation: origin, destination, SKU, quantity, policy version, position as-of, reasons and score breakdown. It reserves and moves nothing | `transfer.Proposal` |
| **ReasonCode** | Why a proposal exists: `DESTINATION_BELOW_TARGET`, `ORIGIN_ABOVE_SAFETY_STOCK`, `APPROVED_LANE` | `transfer.ReasonCode` |
| **ScoreBreakdown** | `PriorityBenefit` minus `HandlingPenalty` minus `LeadTimePenalty`; only a positive total is a valid proposal | `transfer.ScoreBreakdown` |
| **Planner** | The deterministic service that turns positions, policies and lanes into proposals. Equal input gives equal output | `transfer.Planner` |
| **SiteCapability** | A site's transfer capability from facility-layout: origin-enabled, destination-enabled and a `capability_revision` (last writer wins on the revision) | `planning.SiteCapability` |
| **SiteSkuDemand** | One source order line's demand at a site: units, `due_at`, state `ACTIVE` or `REMOVED` (a tombstone), and the assignment-policy version | `planning.SiteSkuDemand` |
| **PublishedCapacityPlan** | A warehouse-planning capacity plan mirrored locally, with a half-open window `[window_start, window_end)` and `capacity_over_window` (last writer wins on the CloudEvents `time`) | `planning.PublishedCapacityPlan` |
| **PlanningSnapshot** | The coherent, fail-closed view the simulation and approval run on. Its `AsOf` is the oldest watermark among the facts it used | `planning.PlanningSnapshot` |
| **Participating site** | A site that has all three facts (capability, demand, capacity plan) fresh within the staleness budget. Others are excluded, never zero-filled | `planning.BuildSnapshot` |
| **InterWarehouseTransfer** | The saga aggregate: an operator-approved plan to move a quantity of one SKU from an origin site to a destination site. References the reservation and the physical facts, owns neither | `transfer.InterWarehouseTransfer` |
| **TransferState** | `DRAFT`, `PROPOSED`, `APPROVED`, `ALLOCATING`, `ALLOCATED`, `PICKED`, `IN_TRANSIT`, `ARRIVED`, `RECEIVED`, `UNFULFILLABLE`, `CANCELLED`. `RECEIVED`, `UNFULFILLABLE` and `CANCELLED` are terminal | `transfer.TransferState` |
| **TransferLine** (`LineID`) | The v1 single line of a transfer, `<transfer_id>:1`. The key inventory-storage's allocation ledger and both replies use | `TransferID.LineID()` |
| **AuditEntry** | One immutable state transition: sequence, from, to, event, reason, time. Insert-only | `transfer.AuditEntry` |
| **Idempotency key** | The approval request's required `Idempotency-Key`, unique per transfer; a replay with the same payload returns the original | `inter_warehouse_transfer.idempotency_key` |
| **Allocation** | One stock unit's contribution to the origin reservation (`stock_unit_id`, `bin_id`, `quantity`) | `transfer.Allocation` |
| **RejectionReason** | inventory-storage's closed reasons: `ORIGIN_SITE_UNKNOWN`, `INSUFFICIENT_USABLE`, `IDEMPOTENCY_CONFLICT`. Anything else is a contract break | `transfer.RejectionReason` |
| **WorkDemand** (`WorkDemandReleased`) | One leg of an approved transfer released as warehouse work. `demand_id` is `<transfer_id>:pick` or `:dispatch` | `transfer.DemandReleased` |
| **WorkKind** | `TRANSFER_PICK`, `TRANSFER_DISPATCH`, `TRANSFER_ARRIVAL`. WES's enum; this context releases only the first two | `transfer.WorkKind` |
| **Picked quantity** | Units the origin pick actually picked. A short pick is recorded, and the dispatch demand carries this quantity | `InterWarehouseTransfer.PickedQuantity` |
| **StowAllocation** | A destination stow location from `TransferStockStowed`, persisted once `RECEIVED` | `transfer.StowAllocation` |
| **StuckTransfer** | A non-terminal transfer whose last transition is older than its per-state threshold. Observe-only | `transfer.Stuck`, `StuckCheck` |
| **StuckThresholds** | Defaults `ALLOCATING=1h`, `PICKED=24h`, `IN_TRANSIT=72h`, flat 24h for other non-terminal states, overridable with `NIP_STUCK_THRESHOLDS` | `transfer.DefaultStuckThresholds` |
| **RebalanceRun** | One scheduled, observe-only planning pass: snapshot watermark, proposal and rejected counts, outcome `COMPLETED` or `FAILED`, and the fail-closed reason when it failed | `transfer.RebalanceRun` |
| **Work release configuration** | Deployment settings for the two origin legs: `TRANSFER_PICK_PATH_ID` and offset, `TRANSFER_DISPATCH_PATH_ID` and offset. Never per-transfer input | `usecases.WorkReleaseConfig` |

## Words used with care

- A **proposal** is advice. A **transfer** exists only after an operator
  approves. Do not call an unapproved proposal a transfer.
- **Allocated** is inventory-storage's reservation of origin stock. It is not
  *picked*, and neither is *received*. Only the destination stow makes stock
  usable at the destination, and that is inventory-storage's fact, not ours.
- **Stuck** is a reading, not a state. No transfer is ever moved to a state
  because it is stuck.

## Vocabulary only (not implemented)

The design plan names more terms than the code has. These appear in the plan
and not in `internal/domain/**`: **NetworkNode**, **SKUPlacementPolicy**,
**DemandForecast**, **NetworkInventoryPosition** as a read model (the `Position`
type exists, but nothing projects it from `inventory-storage` yet), lane
capacity and dispatch calendars, and carbon cost. Treat them as roadmap.
