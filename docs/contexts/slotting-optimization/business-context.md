---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why deciding which SKUs deserve a forward pick slot is its own bounded context — the abc-velocity-v1 policy, human approval, stickiness, and the planned (not built) execution of moves.
---

# Business Context

Sourced from the plan and decision log of 2026-10-08 for the two new WMS-tier
contexts, `inbound-receiving` and `slotting-optimization`. The context's own
ADRs 0001 to 0004 are being written in the
[IQVO/slotting-optimization](https://github.com/IQVO/slotting-optimization)
repository (`docs/adr/`, none on `develop` when this page was written) and,
once merged, are the authority where they differ from this page.

## The gap

`facility-layout` already models forward (`FWD`) and reserve (`RSV`) zones,
but nothing in the fleet decides **which SKUs deserve a forward pick slot**.
Without that decision, the fast movers sit wherever chaotic storage put them
and pickers walk further than they need to. The competitor research behind
this work (Manhattan Active SCE 26.2, Blue Yonder WMS Oct-2025, SAP EWM 2025
FPS01, Infor WMS, and the Gartner WMS Magic Quadrant of April 2026) treats
slotting and labor as expected capabilities.

## What it plans to own

One aggregate, **`SlotPlan`** (decision 4): a proposed SKU-to-forward-slot
assignment for one site and one lookback window. It moves through
**generate** (a `Draft`), then **approve** or **reject**. Approval is always a
human act (decision 7). An approved plan can supersede an earlier one.

## The v1 policy: `abc-velocity-v1`

Decision 7, deterministic and explainable:

1. **Rank** SKUs by order-line picks in the lookback window: units first, then
   SKU ascending as the tie-breakers.
2. **Eligible forward slots** are those with role `Storage`, active, in a zone
   whose code is in `FORWARD_ZONE_CODES` (default `FWD`), compatible with the
   SKU's temperature class and hazmat flag, and large enough that one
   effective unit fits the slot's volume and weight.
3. **Order the slots** by a replaceable `SlotRankingPolicy` port. In v1 that is
   the lexical location code, because `facility-layout` events carry no travel
   distance.
4. **Stickiness**: a SKU that keeps a top-N rank and still fits its current
   slot **keeps** that slot. This is the churn limit.
5. **One SKU per forward slot** in v1.

A machine-learning or affinity policy is a later version behind the same
port.

An approved plan carries the full forward-pick map (`assignments`) and the
list of `moves`, each of kind `Assign`, `Relocate` or `Vacate`, so a consumer
needs no lookup.

## The decisions that shape it

| # | Decision (FINAL, from the 2026-10-08 plan) |
| --- | --- |
| 1 | A new repository, `IQVO/slotting-optimization`, from the harness template (v2), module `github.com/claudioed/slotting-optimization`. Slotting is a planning computation, receiving is a transactional document workflow, so they are not merged. |
| 2 | CloudEvents subdomain **`wms`**: slotting plans storage locations, so it sits with stock, layout and master data. |
| 3 | Strategic classification **Supporting**: slotting policy differs per retailer, and the competitive core stays the WES conductor. The policy is a replaceable object. |
| 6 | Local copies, event-fed: `SiteSkuDemandChanged` from `order-management`; `ProductClassified`, `ProductDimensionsDeclared` and `ProductMeasured` from `product-master`; `ZoneRegistered`, `LocationSlotRegistered` and `LocationSlotDecommissioned` from `facility-layout`. Declarative inputs only, no calls to siblings. Each local-copy mode defaults to `permissive`; the cluster sets `kafka`. |
| 7 | The `abc-velocity-v1` policy above, with human approval: generate (Draft) then Approve or Reject. |
| 8 | **Execution of approved moves is a documented PLANNED edge, not built.** Moving stock (MOVE and REPLENISH work through the `process-path-management` catalogue, `wes-work-planning` and `fulfillment-execution`) touches three Core and Generic contexts and a new task type, so it is its own ADR-gated phase. |
| 10 | No authentication (the fleet revert), no cross-context synchronous calls, a transactional outbox, `Idempotency-Key` on create `POST`s, optimistic concurrency, CloudEvents 1.0 through the repository's own helper, testcontainers only. |

## What it deliberately does not do

- **Move any stock.** Approving a plan publishes `SlotPlanApproved`. Nothing in
  the fleet executes the moves yet.
- **Decide travel distance.** The v1 slot order is lexical on the location code
  because the facility events carry no distance.
- **Own product or layout facts.** It reads product-master and
  facility-layout data through local copies and publishes none of it.
- **Learn.** No machine-learning policy and no affinity (items bought
  together) in v1.

## No live cross-context lookup

Like `product-master`, this context makes no synchronous call to a sibling.
Pick velocity comes from the `order-management` demand feed, SKU physical and
handling facts from `product-master`, and zones and slots from
`facility-layout`, each as a local copy. Events leave through a transactional
outbox only.

## Contract summary

Pinned in the plan. Every event is CloudEvents 1.0 in structured mode with
`source=/warehouse/slotting-optimization`, topic
`warehouse.slotting-optimization.events` and, for analytics,
`warehouse.slotting-optimization.analytics`. The type prefix is
`com.warehouse.wms.slotting-optimization.` and the Kafka key is `plan_id` for
every type.

| Type (after the prefix) | Consumer today |
| --- | --- |
| `slotplan.SlotPlanGenerated` | none |
| `slotplan.SlotPlanApproved` | none; planned: MOVE work execution (not built); to be read by `warehouse-ops-agent` and the console |
| `slotplan.SlotPlanRejected` | none |

REST, behind Kong at `/api/slotting-optimization` (problem type base
`https://errors.slotting-optimization.warehouse-systems.dev/<slug>`):
`POST /slot-plans` (generate, body `siteId` and `lookbackDays`, both
optional), `GET /slot-plans`, `GET /slot-plans/{planId}`,
`POST /slot-plans/{planId}/approve`, `POST /slot-plans/{planId}/reject`,
`GET /forward-slots` (the current approved assignment map) and
`GET /sku-velocity` (`limit`, `windowDays`).

## Honest scope today

- The repository is bootstrapped with `develop` protected and the template
  instantiated. There is no domain code, no published AsyncAPI and no OpenAPI
  yet, so this site holds no `apis/slotting-optimization/` specs and no
  generated reference. A later change adds them once the contract PRs merge.
- Nothing consumes `SlotPlanApproved`. Executing the moves, and any change to
  `process-path-management`, `wes-work-planning` or `fulfillment-execution`
  to do so, is not started.
- The planned build waves also cover an MCP server, an analytics read side, a
  `warehouse-ops-agent` MCP client, a console remote with a tile and the
  `warehouse-infra` wiring. None of them exists yet.
