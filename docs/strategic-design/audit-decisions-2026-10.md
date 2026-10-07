---
id: audit-decisions-2026-10
title: Audit decisions, October 2026
sidebar_label: Audit decisions (2026-10)
description: The product and architecture decisions taken on 2026-10-06 for the findings of the October 2026 documentation audit across the eleven backend contexts, with the reason for each and the ADR that records it.
---

# Audit decisions, October 2026

The October 2026 documentation refresh compared every context's docs with its
code on `develop` and found places where the ADRs did not settle the
behaviour. On 2026-10-06 each of those findings was decided and implemented.
This page records the decisions, why they were taken, and where each one is
written down. Each repo's own ADR is the authoritative record; this page is
the fleet-level index.

## Principles applied

1. **Honour the fleet constraints.** REST and MCP stay unauthenticated.
   CloudEvents 1.0 is mandatory. Contracts change additively, and a breaking
   change is a new `.v2` type. Migrations are additive only. Sibling contexts
   that forbid REST/MCP calls to each other (process-path-management,
   labor-performance) keep that rule.
2. **Prefer the production-grade DDD answer.** Event names state facts. An
   invariant that spans aggregates is enforced in one transaction. Master data
   is published as an event instead of polled over REST. A context's data scope
   follows the canonical Site.
3. **Do not invent rules the ADRs forbid.** Where a rule is genuinely open, the
   conservative, reversible option was taken and the reason recorded.
4. **Nothing destructive without explicit approval.** No table or column was
   dropped.

## Changed

| Context | Decision | Record |
| --- | --- | --- |
| workforce-management | The staffing gap can be scoped to one Site. `StartAssociateShift` takes an optional canonical `siteCode`; the gap queries take an optional `siteCode` filter; `PathUnderstaffed` carries an optional `site_code`. Unscoped callers are unchanged. | [ADR 0034](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0034-site-scoped-staffing-gap.md) |
| wes-work-planning | A new `ConfigurePool` command (`PUT /paths/{pathId}/pool`) sets a path's pool mode and WIP limit. Lowering the limit below current WIP never evicts work: releases pause until WIP is below the limit. | [ADR 0034](https://github.com/IQVO/wes-work-planning/blob/develop/docs/docs/adr/0034-configure-pool-command.md) |
| network-fulfillment | `NetworkOrderSubmitted` is raised at SUBMITTED. `NetworkOrderAcknowledged` is raised only when the order settles ACKNOWLEDGED, published as the breaking `v2`. The projector still recognises historic v1 messages. | [ADR 0016](https://github.com/IQVO/network-fulfillment/blob/develop/docs/adr/0016-cloudevents-submitted-and-settle-time-acknowledged.md) |
| network-fulfillment | A path is eligible for a cutoff only if its P95 cycle time fits before it. Missing cycle time stays eligible. | [ADR 0017](https://github.com/IQVO/network-fulfillment/blob/develop/docs/adr/0017-cycle-time-p95-path-eligibility.md) |
| process-path-management | Defining a CPT schedule locks the referenced paths in the same transaction, so a schedule can no longer commit against a path being deactivated. | [ADR 0028](https://github.com/IQVO/process-path-management/blob/develop/docs/docs/adr/0028-close-path-cpt-schedule-race-with-row-locks.md) |
| fulfillment-execution | The lease-expiry and CPT-miss sweeps run as chart CronJobs, on by default (every minute and every five minutes). | [ADR 0037](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0037-sweeps-scheduled-by-cronjob-default-on.md) |
| fulfillment-execution | Sealing a package with a missing or expired lease returns "not claimed", like complete and renew-lease. Another station's active lease stays "not owner". | [ADR 0038](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0038-seal-package-expired-lease-is-not-claimed.md) |
| inventory-storage | `ProductClassified` is published through the outbox on both topics, as a full-state replacement with no PII. `LocationRecorded` stays in-process. | [ADR 0031](https://github.com/IQVO/inventory-storage/blob/develop/docs/docs/adr/0031-publish-product-classified.md) |
| facility-layout | Every MCP tool error is `<slug>: detail`, using the REST problem slug; unmapped errors become `internal-error`. This is the convention warehouse-planning already used. | [ADR 0033](https://github.com/IQVO/facility-layout/blob/develop/docs/docs/adr/0033-slug-prefixed-mcp-tool-errors.md) |
| warehouse-ops-agent | A facility-layout validation rejection (a slug such as `missing-location-code` or `invalid-*`) is a 400 instead of a 502. Old slug-less messages stay 502. | [ADR 0018](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0018-mcp-tool-error-slug-classification.md) |
| warehouse-ops-agent | `DAILY_BRIEF_PATH_TARGETS` set to `[]` or `null` fails startup with a config error naming the variable. | [ADR 0017](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0017-empty-path-targets-is-a-config-error.md) |
| fulfillment-execution | `TaskCompleted` v1 carries an optional `order_ref` (the order id), additive on both topics. | [ADR 0040](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0040-task-completed-carries-order-ref.md) |
| inventory-storage | A new consumer confirms an order's reservations on its last completed PICK (default off). | [ADR 0035](https://github.com/IQVO/inventory-storage/blob/develop/docs/docs/adr/0035-confirm-pick-from-task-completed.md) |
| inventory-storage | The flaky transfer-allocation integration test was fixed at its root cause (a cold Kafka broker's fixed 5 s join backoff), and the Docs site is now built on pull requests. | [inventory-storage #146](https://github.com/IQVO/inventory-storage/pull/146) |

## Decided and kept

| Context | Decision | Why |
| --- | --- | --- |
| warehouse-ops-agent | The order-management stage of the order lifecycle degrades to `null` when that service is down (ADR 0002). | The agent is an advisory read-side aggregator; one dependency outage must not fail the whole view. |
| labor-performance | The open gap stays per associate (ADR 0014); at task-type scope `openGapSeconds` is always 0, by design. | The idle gap is an Associate-level concept; attributing it to a task type would invent semantics. |
| workforce-management | One task equals one unit of charge, so `3600 / MeanActualSeconds` is the correct per-hour rate. | Verified in code: a `WorkUnit` has no quantity, and one `WorkReleased` creates exactly one task. |
| wes-work-planning, fulfillment-execution, workforce-management | The unused `events`, `domain_events` and `domain_event` tables are kept, documented as legacy. | Dead schema is harmless; a drop is destructive and needs explicit approval. |
| inventory-storage | `LOCATION_LOOKUP_MODE` stays permissive by default. | ADRs 0013 and 0020 chose it so a cold facility cache cannot reject every receipt; the cluster already injects kafka mode. |
| inventory-storage | Reservation expiry stays lazy (ADR 0003). | Reads are correct without a sweeper. |
| wes-work-planning | `RateDeviationDetected` stays declared but unraised, marked "reserved" in the AsyncAPI. `UsableInventoryObserved` stays read-only context. | Detection and gating are business rules nobody has specified; reservations already guard availability. |
| facility-layout | `FacilityLayoutImported` stays keyed by its CloudEvents id ([ADR 0034](https://github.com/IQVO/facility-layout/blob/develop/docs/docs/adr/0034-facility-layout-imported-stays-keyed-by-cloudevents-id.md)). | No consumer needs import ordering; keying by site would be a contract change for no benefit. |

## Confirm-pick: built, switched off by default

Nothing called `POST /reservations/{id}/confirm-pick`, so reserved stock was
never confirmed as picked. The decision was event-driven, with no synchronous
cross-context call, and building it corrected the first design:

- A **PICK task is per order line**, not per order, and a Reservation stores only
  its SKU, quantity and the order id (`demand_ref`). A task therefore cannot be
  mapped to one reservation.
- fulfillment-execution now publishes the order id as an optional `order_ref` on
  `TaskCompleted` v1 (additive; [ADR 0040](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0040-task-completed-carries-order-ref.md)).
  The task keeps the order id from `WorkReleased.ref` in a new nullable column;
  transfer work is excluded.
- inventory-storage counts an order's completed picks and confirms its active
  reservations only when the **last** pick completes
  ([ADR 0035](https://github.com/IQVO/inventory-storage/blob/develop/docs/docs/adr/0035-confirm-pick-from-task-completed.md),
  which supersedes the earlier Proposed ADR 0032). Confirming on the first pick
  would mark unpicked lines as picked with no undo; confirming late is safe
  because a reservation keeps the stock unavailable meanwhile. The count, the
  event-id claim and the confirmations commit in one transaction, and the
  counter rows are swept after 30 days.

The consumer is **off by default** (`TASK_COMPLETED_CONSUMER_MODE`). Turning it
on needs the producer released first and `eventPublisher=kafka`; watch the
`expired` outcome of `inventory.pick_confirmations`.

Known limits, recorded in the ADR: **short picks are not modelled** (a task has
no per-line quantity); tasks created before the migration, or through REST or
MCP, carry no order id and are never confirmed this way; and the count matches
by number, not identity, so a line already revoked or expired while its task
still completes can make an order confirm one pick early. The per-line answer
is for order-management to send a line number, the Reservation to store it and
the event to carry it.

## Open modelling note

workforce-management now has two identifiers that look alike. `buildingId` keys
the shift plan, and the new `siteCode` is the canonical facility-layout Site.
[ADR 0034](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0034-site-scoped-staffing-gap.md)
deliberately leaves the mapping between them undecided, so callers pass a
consistent pair. The clean long-term answer is to converge on `siteCode` and
deprecate `buildingId` in a later, breaking ADR.

## Effect on the Big Picture EventStorming

The [Big Picture hotspot table](/strategic-design/eventstorming-big-picture#hotspots-and-their-sources)
now shows H6, H7, H13, H19 and H23 as resolved by the decisions above, and
records H1, H11 and H12 as decided and kept.
