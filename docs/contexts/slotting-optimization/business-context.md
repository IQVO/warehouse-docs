---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why deciding which SKUs deserve a forward pick slot is its own bounded context — the SlotPlan, the abc-velocity-v1 policy, human approval, stickiness, and the execution of approved moves as WES relocation work.
---

# Business Context

Written here from the context's own
[introduction](https://iqvo.github.io/slotting-optimization/docs/overview/introduction)
and its ADRs under `docs/adr/` in
[IQVO/slotting-optimization](https://github.com/IQVO/slotting-optimization):
0001 to 0004 and 0005 (Accepted, 2026-10-08) and 0010 (Accepted, 2026-10-14),
which supersedes 0007, checked against the code on `develop`. Where the code
has moved past an ADR's wording, the code is authoritative.

## The gap

`facility-layout` models forward (`FWD`) and reserve (`RSV`) zones, but
nothing else in the fleet decided **which SKUs deserve a forward pick slot**.
Without that decision, the fast movers sit wherever chaotic storage put them
and pickers walk further than they need to. The competitor research behind
this work (Manhattan Active SCE 26.2, Blue Yonder WMS Oct-2025, SAP EWM 2025
FPS01, Infor WMS, and the Gartner WMS Magic Quadrant of April 2026) treats
slotting and labor as expected capabilities.

## What it owns

| Fact | Value |
| --- | --- |
| Subdomain class | **Supporting** (ADR 0001) |
| Tier | **WMS** (CloudEvents subdomain segment `wms`) |
| Aggregate | `SlotPlan` (package `internal/domain/slotplan`, ADR 0002) |
| Policy | `abc-velocity-v1` (package `internal/domain/planning`, ADR 0002) |
| Binaries | four: `cmd/api` (REST on `HTTP_ADDR`, default `:8080`, plus five Kafka consumers and the outbox relay as goroutines), the read-only `cmd/mcp` (ADR 0005), `cmd/slotting-projector` and `cmd/slotting-reports` (the analytics read side, ADR 0006) |
| Data store | one Postgres database (embedded migrations) plus a separate analytics database written only by the projector. `DATABASE_URL` is required (no in-memory mode, ADR 0011) |
| Kafka | publishes `warehouse.slotting-optimization.events` and its analytics mirror `warehouse.slotting-optimization.analytics`; consumes `warehouse.order-management.events`, `warehouse.product-master.events` (incl. pack levels, ADR 0012), `warehouse.facility.events` (ADR 0003, ADR 0004) and `warehouse.inventory.events` (`StockRelocated`, ADR 0010) |
| Auth | none (fleet-wide decision) |
| MCP | read-only `cmd/mcp` (ADR 0005): `get_slot_plan` (with `execution`), `list_slot_plans`, `get_forward_slots`, `get_sku_velocity` |

- **The SlotPlan.** A proposal for one site and one demand window
  (`[windowFrom, windowTo)`, default 28 days back from now): the assignments
  `{sku, slot, abcClass, picks, units}`, the moves against the site's
  currently Approved plan (`Assign`, `Relocate`, `Vacate`) and the SKUs it
  could not place, with a reason (`NoPhysicalProfile`, `NoEligibleSlot`,
  `NoCapacityFit`).
- **The decision on it.** `Draft` then `Approved` or `Rejected`. Approving a
  plan supersedes the site's previous Approved plan in the same transaction,
  so a site has at most one Approved plan (`Superseded` is the fourth state).
  Approval is always a human act.
- **The published forward-slot map.** `SlotPlanApproved` carries every
  `{sku, slot}` of the plan and the moves, so a consumer needs no lookup.
- **The execution progress.** For each Approved or Superseded plan, how many
  of its moves have been carried out on the floor: moves total and executed,
  last executed at, and per move an executed flag and quantity. It is a read
  model derived from `inventory-storage`'s `StockRelocated`
  (`slot_plan_move_executions`, one row per relocation), shown as `execution`
  on `GET /slot-plans/{planId}` and the MCP `get_slot_plan` tool. It is
  advisory: it does not gate generating or approving the next plan (ADR 0010).

## The v1 policy: `abc-velocity-v1`

Deterministic and explainable (ADR 0002; see the
[Ubiquitous Language](/contexts/slotting-optimization/ubiquitous-language)
for the exact rules):

1. **Velocity**: per SKU over the window, picks = number of ACTIVE demand
   lines, units = their summed units. Candidates are ordered picks desc,
   units desc, SKU asc, and get an ABC class (A while the picks of the
   candidates ranked before a SKU are below 80 % of all picks, B below 95 %,
   else C).
2. **Forward slots** are active location slots with role `Storage` in a zone
   of the site whose code is in `FORWARD_ZONE_CODES` (default `FWD`).
3. **Eligibility**: compatible (hazmat and temperature class) and one
   effective unit fits the slot's volume and weight.
4. **Slot ranking** is a replaceable `SlotRankingPolicy` port. In v1 that is
   the lexical location code, because `facility-layout` events carry no travel
   distance.
5. **Stickiness**: a SKU keeps its previous slot if that slot is still
   eligible and free. This is the churn limit.
6. **One SKU per forward slot** in v1.

A machine-learning or affinity policy would be a later version behind the
same port.

## Main capabilities

| Capability | Interface | Use case |
| --- | --- | --- |
| Generate a Draft plan for a site | `POST /slot-plans` (requires `Idempotency-Key` with Postgres) | `GeneratePlan` |
| Approve a Draft (supersedes the previous Approved plan) | `POST /slot-plans/{planId}/approve` | `ApprovePlan` |
| Reject a Draft with an optional reason | `POST /slot-plans/{planId}/reject` | `RejectPlan` |
| Read plans (with the `execution` progress on `GET /slot-plans/{planId}`) | `GET /slot-plans`, `GET /slot-plans/{planId}` | `ListPlans`, `GetPlan` |
| Read the current forward-slot map of a site | `GET /forward-slots` | `ListForwardSlots` |
| Read SKU velocity (the planner's demand input) | `GET /sku-velocity` | `ListSkuVelocity` |
| Keep the demand, product and layout copies current | Kafka consumers (`DEMAND_MODE`, `PRODUCT_MODE`, `LAYOUT_MODE` = `kafka`) | `ApplyDemandChanged`, `ApplyProductClassified`, `ApplyPhysicalProfile`, `ApplyZoneRegistered`, `ApplyLocationSlotRegistered`, `ApplyLocationSlotDecommissioned` |
| Record which moves of a plan have been executed | Kafka consumer (`RELOCATION_MODE=kafka`, `RELOCATION_CONSUMER_GROUP`) on `StockRelocated` | `RecordRelocation` |
| Publish plan decisions | transactional outbox + relay (`EVENT_PUBLISHER=kafka`) | every write use case |

The full catalogue is on [Use Cases](/contexts/slotting-optimization/use-cases).

## What it deliberately does not do

- **Own demand, product facts or the slot layout.** It keeps three event-fed
  local copies of them (demand from `order-management`, product
  classification and unit size from `product-master`, zones and slots from
  `facility-layout`) and never calls a sibling at request time.
- **Move any stock, or create floor work.** Approving a plan publishes
  `SlotPlanApproved`, nothing more. The moves are executed as `RELOCATE` work
  by the WES chain: `wes-work-planning` plans one work unit per move
  (sequenced inside the plan, and not-yet-released work of a superseded plan
  is cancelled), `process-path-management` routes it on the `RELOCATE` path
  (intake `SLOT_RELOCATION`), `fulfillment-execution` runs it with an operator
  who counts the quantity and scans the open bin, and `inventory-storage`
  moves the stock on its ledger. This context only reads the outcome back
  (ADR 0010, which supersedes the options laid out in ADR 0007). v1 moves the
  whole on-hand quantity of the SKU at the source bin; partial quantities and
  min/max replenishment are out of scope (ADR 0002).
- **Decide travel distance.** The v1 slot order is lexical on the location
  code.
- **Learn.** No machine-learning policy and no affinity (items bought
  together) in v1.

There is no command edge to `inventory-storage` (an approved plan changes no
stow behaviour, and this context never calls it): the only edge is the
consumed `StockRelocated`. There is no edge to `inbound-receiving` or
`warehouse-planning` (ADR 0001).

## Honest scope today

- The service is built on `IQVO/slotting-optimization` `develop`: REST API,
  outbox and relay, the five consumers (demand, product, pack levels, layout
  and relocation), the read-only MCP server, the analytics projector and
  reports, and the console remote. This site holds its
  `apis/slotting-optimization/` specs, the generated references and the
  synced artifact pack.
- It is **wired in `warehouse-infra` `develop`**: `terraform/apps.yaml`
  registers it (database, analytics database, web remote `slotting_mfe`) and
  `helm-values/slotting-optimization.yaml` sets `EVENT_PUBLISHER=kafka` and
  `DEMAND_MODE`, `PRODUCT_MODE`, `LAYOUT_MODE`, `RELOCATION_MODE` and
  `PACK_LEVEL_MODE` to `kafka`, each with a fixed consumer group, and enables
  the MCP server, which `warehouse-ops-agent` calls through its MCP client. The
  kind cluster was not checked for this page.
- **The execution chain is live end to end**, given the `RELOCATE` process
  path in `process-path-management` (the `warehouse-infra` post-deploy seed)
  and `inventory-storage`'s `TaskCompleted` consumer
  (`taskCompletedConsumerMode: kafka`). Without that path
  `wes-work-planning` retries a `SlotPlanApproved` and dead-letters it to
  `warehouse.slotting-optimization.events.dlq`. Without that consumer the
  completed moves never reach the ledger and the plan's `execution` stays at
  zero.
- **Progress is advisory.** A newer plan can be generated and approved while
  the previous one is half executed; `wes-work-planning` cancels the older
  plan's work that has not been released yet.
- The analytics topic `warehouse.slotting-optimization.analytics` is read only
  by this context's own projector (ADR 0006).
