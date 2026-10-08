---
id: bounded-context-canvas
title: Bounded context canvas
sidebar_label: Bounded context canvas
description: The ddd-crew Bounded Context Canvas for slotting-optimization, written from the 2026-10-08 decision log before any code exists.
---

# Bounded context canvas

:::info[Written here, from the decision log]
This canvas is hand-written for this site from the 2026-10-08 plan and its
pinned contracts. `slotting-optimization` has no code yet, so unlike the other
contexts' canvases it is **not** a synced copy and cites no source file.
When the repository ships its own canvas, replace this page with the synced
copy.
:::

Following the ddd-crew [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas).

## Name

**Slotting Optimization** (`slotting-optimization`, Go module
`github.com/claudioed/slotting-optimization`, GitHub
`IQVO/slotting-optimization`).

## Purpose

Decide which SKUs deserve a forward pick slot, and which slot, from how often
each SKU is picked. Propose a slot plan under a replaceable policy
(`abc-velocity-v1` in v1), let a human approve or reject it, and publish the
approved forward-pick map and the moves it implies. It moves no stock.

## Strategic Classification

| Axis | Verdict | Evidence |
| --- | --- | --- |
| Domain | **Supporting** | Decision 3: slotting policy differs per retailer, so it is not generic, and the competitive core stays the WES conductor, so it is not Core. See [Subdomain Classification](/strategic-design/subdomain-classification). |
| Business model | **Cost reduction** | A better forward-pick assignment cuts pick travel and labor. |
| Evolution | **Custom-built** (genesis) | Decided 2026-10-08; no code yet. |

## Domain Roles

| Role | Applies? | Notes |
| --- | --- | --- |
| Analysis context | Yes (primary) | It computes a ranking and an assignment over sets of SKUs and slots. |
| Draft context | Yes | A plan is generated as a `Draft` and only a human approval makes it effective. |
| Specification context | Yes | An approved plan specifies what should sit where. Others act on it. |
| Gateway / Open Host Service | Yes | REST plus the `warehouse.slotting-optimization.events` Published Language. |
| Execution context | No | It never moves goods or work. Execution is planned and not built. |
| Analytics / reporting | Planned | `warehouse.slotting-optimization.analytics` is reserved in the pinned contracts. The read side is a later phase. |

## Inbound Communication

| Collaborator | Message | Type | Channel | Relationship |
| --- | --- | --- | --- | --- |
| Slotting planner | Generate a plan | Command | REST `POST /slot-plans` | This context is the OHS |
| Slotting planner | Approve or reject a plan | Command | REST `POST /slot-plans/{planId}/approve`, `POST /slot-plans/{planId}/reject` | OHS |
| Operator, console, agent | List and get plans, the forward-slot map, SKU velocity | Query | REST `GET /slot-plans`, `GET /slot-plans/{planId}`, `GET /forward-slots`, `GET /sku-velocity` | OHS |
| `order-management` | `SiteSkuDemandChanged` | Event | Kafka `warehouse.order-management.events`, `com.warehouse.wes.order-management.siteskudemand.SiteSkuDemandChanged` | Conformist with a local copy (pick velocity); in progress |
| `product-master` | `ProductClassified`, `ProductDimensionsDeclared`, `ProductMeasured` | Event | Kafka `warehouse.product-master.events`, `com.warehouse.wms.product-master.product.*` | Conformist with a local copy (handling classification, effective physical profile); in progress |
| `facility-layout` | `ZoneRegistered`, `LocationSlotRegistered`, `LocationSlotDecommissioned` | Event | Kafka `warehouse.facility.events`, `com.warehouse.wms.facility-layout.zone.*` and `...locationslot.*` | Conformist with a local copy (zones and eligible slots); in progress |

No REST endpoint is authenticated (the fleet-wide revert). The generate
`POST` takes an `Idempotency-Key`.

## Outbound Communication

The context makes **no** synchronous call to any sibling. Everything outbound
leaves through the transactional outbox.

| Collaborator | Message | Type | Channel | Relationship |
| --- | --- | --- | --- | --- |
| none today; planned: MOVE work execution | `SlotPlanApproved` (the full `assignments` map and the `moves`, kinds `Assign`, `Relocate`, `Vacate`) | Event | Kafka `warehouse.slotting-optimization.events`, `com.warehouse.wms.slotting-optimization.slotplan.SlotPlanApproved` | This context upstream, Published Language; the consumer is not built (decision 8). Also to be read by `warehouse-ops-agent` and the console |
| none today | `SlotPlanGenerated` | Event | same topic, `...slotplan.SlotPlanGenerated` | Published contract |
| none today | `SlotPlanRejected` | Event | same topic, `...slotplan.SlotPlanRejected` | Published contract |

## Ubiquitous Language

Fleet-level terms are in the [Ubiquitous Language](/strategic-design/ubiquitous-language)
overview and the [Glossary](/glossary). Top terms: **Slot plan**,
**Forward-pick slot**, **Pick velocity**, **ABC class**, **Stickiness**,
**Policy** (`abc-velocity-v1`), **Assignment**, **Move** (`Assign`,
`Relocate`, `Vacate`).

## Business Decisions

1. Slotting is its own context, not part of `facility-layout`, `inventory-storage`
   or `inbound-receiving` (decision 1).
2. SKUs are ranked by order-line picks in the lookback window: units first,
   then SKU ascending (decision 7).
3. An eligible forward slot has role `Storage`, is active, sits in a zone whose
   code is in `FORWARD_ZONE_CODES` (default `FWD`), is compatible with the
   SKU's temperature class and hazmat flag, and fits one effective unit by
   volume and weight (decision 7).
4. Slot order is a replaceable `SlotRankingPolicy` port; v1 is the lexical
   location code (decision 7).
5. A SKU that keeps a top-N rank and still fits keeps its slot (stickiness,
   the churn limit) (decision 7).
6. One SKU per forward slot in v1 (decision 7).
7. A human must approve a plan: generate (Draft), then Approve or Reject
   (decision 7).
8. Executing the moves is a planned edge, not built (decision 8).
9. Local copies are event-fed, `permissive` by default and `kafka` in the
   cluster (decision 6).
10. No authentication, a transactional outbox, optimistic concurrency, and
    CloudEvents built through the repository's own helper (decision 10).

## Assumptions

- Pick velocity can be derived from `SiteSkuDemandChanged` (units demanded per
  order line, state `ACTIVE` or `REMOVED`) without a live lookup.
- Ordering slots by location code is an acceptable v1 proxy for closeness,
  because `facility-layout` events carry no travel distance.
- The effective physical profile (measured, else declared) is enough to decide
  whether a unit fits a slot.

## Verification Metrics

None exist yet, because there is no code. The fleet rules the build must meet
are: a golden exact-JSON test per published type, consumers that dedupe on the
CloudEvents `id` in the same transaction as the effect, and
testcontainers-only Kafka and Postgres integration tests. A deterministic
policy also needs a replay test that the same inputs give the same plan. This
section is to be filled from the repository's own canvas.

## Open Questions

- Who executes an approved plan, and through which task type? (MOVE and
  REPLENISH work are their own ADR-gated phase across three contexts.)
- What replaces the lexical slot order once travel distance is available, and
  which context publishes that distance?
- When does a second SKU per forward slot, or an affinity-based policy,
  justify a new policy version?
- What top-N and lookback defaults suit the first site?
