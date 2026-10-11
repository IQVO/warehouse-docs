---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why deciding which SKUs deserve a forward pick slot is its own bounded context — the SlotPlan, the abc-velocity-v1 policy, human approval, stickiness, and the planned (not built) execution of moves.
---

# Business Context

Written here from the context's own
[introduction](https://iqvo.github.io/slotting-optimization/docs/overview/introduction)
and its ADRs 0001 to 0004 (all Accepted, 2026-10-08, under `docs/adr/` in
[IQVO/slotting-optimization](https://github.com/IQVO/slotting-optimization)),
checked against the code on `develop`. Where the code has moved past an ADR's
wording, the code is authoritative.

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
| Binaries | one: `cmd/api` (REST on `HTTP_ADDR`, default `:8080`, plus three Kafka consumers and the outbox relay as goroutines) |
| Data store | one Postgres database (embedded migrations), or in-memory adapters when `DATABASE_URL` is unset |
| Kafka | publishes `warehouse.slotting-optimization.events`; consumes `warehouse.order-management.events`, `warehouse.product-master.events`, `warehouse.facility.events` (ADR 0003, ADR 0004) |
| Auth | none (fleet-wide decision) |
| MCP | none on `develop` (ADR 0001 names MCP read tools as a later phase) |

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
| Read plans | `GET /slot-plans`, `GET /slot-plans/{planId}` | `ListPlans`, `GetPlan` |
| Read the current forward-slot map of a site | `GET /forward-slots` | `ListForwardSlots` |
| Read SKU velocity (the planner's demand input) | `GET /sku-velocity` | `ListSkuVelocity` |
| Keep the demand, product and layout copies current | Kafka consumers (`DEMAND_MODE`, `PRODUCT_MODE`, `LAYOUT_MODE` = `kafka`) | `ApplyDemandChanged`, `ApplyProductClassified`, `ApplyPhysicalProfile`, `ApplyZoneRegistered`, `ApplyLocationSlotRegistered`, `ApplyLocationSlotDecommissioned` |
| Publish plan decisions | transactional outbox + relay (`EVENT_PUBLISHER=kafka`) | every write use case |

The full catalogue is on [Use Cases](/contexts/slotting-optimization/use-cases).

## What it deliberately does not do

- **Own demand, product facts or the slot layout.** It keeps three event-fed
  local copies of them (demand from `order-management`, product
  classification and unit size from `product-master`, zones and slots from
  `facility-layout`) and never calls a sibling at request time.
- **Move any stock.** Approving a plan publishes `SlotPlanApproved`. Executing
  the moves on the floor (MOVE and REPLENISH work through the
  `process-path-management` catalogue, `wes-work-planning` and
  `fulfillment-execution`) is a **planned, not built** edge (ADR 0001,
  ADR 0002) that needs ADRs in those contexts and a new task type.
- **Decide travel distance.** The v1 slot order is lexical on the location
  code.
- **Learn.** No machine-learning policy and no affinity (items bought
  together) in v1.

There is no edge to `inventory-storage` (an approved plan moves no stock and
does not change stow behaviour), `inbound-receiving` or `warehouse-planning`
(ADR 0001).

## Honest scope today

- The service is built on `IQVO/slotting-optimization` `develop`: REST API,
  outbox and relay, and the three local-copy consumers. This site holds its
  `apis/slotting-optimization/` specs, the generated references and the
  synced artifact pack.
- It is **not deployed**: no `Dockerfile`, no `charts/` directory, and no
  values file, Kong route or ArgoCD application in `warehouse-infra`
  `develop`. The planned edge route is Kong `:8000` under
  `/api/slotting-optimization` (ADR 0001).
- **Nothing consumes its events**: a search of `warehouse-ops-agent`,
  `warehouse-console` and `wes-work-planning` on `develop` finds no
  subscriber of `warehouse.slotting-optimization.events`.
- An MCP server, an analytics read side (`warehouse.slotting-optimization.analytics`
  is reserved, nothing publishes there), a `warehouse-ops-agent` client and a
  console remote are later phases. None of them exists yet.
