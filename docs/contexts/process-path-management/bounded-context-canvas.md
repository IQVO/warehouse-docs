---
id: bounded-context-canvas
title: Bounded Context Canvas
sidebar_label: Bounded Context Canvas
description: The full ddd-crew Bounded Context Canvas for process-path-management — purpose, strategic classification, roles, inbound/outbound communication, business decisions, open questions.
---

# Bounded Context Canvas

Following the [ddd-crew Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas).

## Name

**Process Path Management**

## Purpose

To be the single, auditable source of truth for the process-path
catalogue — a path's canonical identity (`PathId`), the match rule
(`MatchPrefix`) used to resolve a caller-supplied id to a path family,
whether it is `Direct`, and the capabilities a station/associate must hold
to work it (`RequiredCapabilities`) — replacing a static YAML file that
three separate services each independently boot-loaded a copy of. Since
[ADR 0010](https://github.com/claudioed/process-path-management/blob/develop/docs/docs/adr/0010-fulfillment-capability-contract.md)
it also publishes each path's fulfillment capability (p95 cycle time,
eligibility) and owns the site-scoped CPT schedule, so
`order-management` can derive a delivery promise from path feasibility.

## Strategic Classification

| Axis | Verdict |
| --- | --- |
| Domain | **Generic Subdomain** |
| Business model | Not applicable — this is infrastructure/configuration, not a revenue lever |
| Evolution | Commodity — a process-path catalogue is a well-understood, industry-common concern |

**Justification.** This context sits in the same bucket as `facility-layout`:
well-understood and not a competitive differentiator the way
`fulfillment-execution`'s Pick/Pack/SLAM task lifecycle or
`inventory-storage`'s chaotic-storage inventory truth are, but genuinely
needed, identically, by three different services (`fulfillment-execution`,
`wes-work-planning`, `workforce-management`) — none of which is a more
natural single owner than the others. `facility-layout`'s own ADR made the
argument first for physical location structure; this is the same shape of
decision applied to the process-path catalogue: extract once rather than
duplicate three times or leave it an unowned static file.

## Domain Roles

| Role | Applies here? | Notes |
| --- | --- | --- |
| Published Language | **Yes** | The `ProcessPath` schema, carried field-for-field from the retired YAML file, is the published contract three consumers are expected to conform to. |
| Open Host Service | **Yes** | The service publishes `warehouse.process-path-management.events` as a stable, documented integration point rather than a bespoke per-consumer contract. |
| Analytics / Reporting | **Yes, additive** | A separate analytical read side (`cmd/pathmgmt-projector` + `cmd/pathmgmt-reports`) built from this context's own events, on its own topic (`warehouse.process-path-management.analytics`) and database — the "Process Path Catalogue Growth & Change" report. Landed in ADR 0007, closing the last remaining gap among the fleet's then-existing contexts in the analytics data-mesh rollout. |
| Execution/Workflow | No | This context takes no position on dispatch, routing, or task assignment. |

## Inbound Communication

There is no Kafka consumer of another context's topic in this context —
it is the SOURCE of the process-path published language, never a consumer
of anyone else's (its only Kafka consumer, `cmd/pathmgmt-projector`, reads
its own analytics topic). Inbound traffic is limited to callers issuing
REST commands/queries against the two aggregates (8 operations in
`apis/openapi.yaml`, all unauthenticated by deliberate decision —
[ADR 0005](https://github.com/claudioed/process-path-management/blob/develop/docs/docs/adr/0005-remove-rest-auth.md)
removed the REST auth layer ADR 0004 had added) and read-only MCP calls:

| Command | Sent by | Delivery |
| --- | --- | --- |
| `Define path` (`POST /process-paths`) | Operator (or the `process_path_mfe` remote mounted by `warehouse-console`) | Synchronous REST |
| `Revise path` (`PUT /process-paths/{pathId}`) | Operator (or operator-facing SPA) | Synchronous REST |
| `Deactivate path` (`DELETE /process-paths/{pathId}`) | Operator (or operator-facing SPA) | Synchronous REST |
| `List` / `Get` (`GET /process-paths`, `GET /process-paths/{pathId}`) | Operator SPA, audit tooling | Synchronous REST (read-only) |
| `Define CPT schedule` (`PUT /sites/{siteId}/cpt-schedule`) / `Get CPT schedule` | Operator | Synchronous REST (ADR 0010) |
| `get_process_path`, `list_process_paths` | `warehouse-ops-agent` | MCP (read-only, ADR 0006) |

## Outbound Communication

Two relationships in the fleet: the integration Published Language
(four live consumers) and, since ADR 0007, a separate, additive analytics
surface. This context makes **no outbound call** to any sibling —
`TestNoSiblingContextOutboundCalls` fails the build if
`internal/adapters/outbound/**` ever imports `net/http`.

| Collaborator(s) | Relationship pattern | Integration | Status |
| --- | --- | --- | --- |
| `fulfillment-execution`, `wes-work-planning`, `workforce-management` | Open Host Service + Published Language (this context is upstream Supplier; all three are downstream Conformists) | Kafka topic `warehouse.process-path-management.events` — `ProcessPathCreated`, `ProcessPathUpdated`, `ProcessPathDeactivated` | **Live.** All three consumers now replay this topic into a local catalogue cache (verified live, no-restart propagation); the predecessor static YAML file is frozen and superseded. These three decode `ProcessPath*` only (no `cycle_time_p95`/`eligibility`/`destination_location_role`/`CPTScheduleChanged`). Their catalogue source is opt-in (`PATH_CATALOGUE_SOURCE`, binary default `file`); the cluster sets `kafka`. |
| `order-management` | Open Host Service + Published Language (downstream Conformist) | Same topic — `ProcessPath*` (decoding `cycle_time_p95`, `eligibility`) plus `CPTScheduleChanged` | **Live** (ADR 0010). Two consumers (`kafkacatalog`, `kafkacptschedule`), each with a per-process-unique group; this is the fulfillment capability contract from which it derives its delivery promise. Opt-in via `PATH_CATALOGUE_SOURCE=kafka` (binary default `none`); the cluster sets `kafka`. |
| Analytics consumers (WES Dashboard, console-BFF) | Open Host Service, separate analytics surface | REST — `GET /reports/catalogue-growth`, `GET /reports/catalogue-growth/freshness` via `cmd/pathmgmt-reports`, fed by a dedicated `warehouse.process-path-management.analytics` Kafka topic | **Live** (ADR 0007). Fleet-parity analytical data product — a separate writer (`cmd/pathmgmt-projector`)/reader (`cmd/pathmgmt-reports`)/database triad, never touching the OLTP path. The "Process Path Catalogue Growth & Change" report is bucketed by **day** (no spatial dimension — a process path is a single flat identity, unlike facility-layout's site/zone hierarchy) with fields `dayBucket`, `pathsDefined`, `pathsRevised`, `pathsDeactivated`. Verified live: real `/healthz` 200 and `/reports/catalogue-growth/freshness` returning `{"lagSeconds":0}` against the running pod. |

This context has **zero REST dependency** on any of the four catalogue
consumers, in either direction, and no synchronous dependency exists
today from any of them back onto this service. The analytics topic is
strictly additive and does not touch the integration topic's contract —
one domain event now enqueues two outbox rows (one per topic) in the
same transaction as the aggregate change (ADR 0003, extended by ADR
0007).

## MCP tools

Since PR #26/#27, this context also publishes a read-only MCP tool
surface (port 8090, Streamable HTTP, unauthenticated — ADR 0005), a
Customer of which is `warehouse-ops-agent` (its client calls
`get_process_path`/`list_process_paths`, but the client is wired and not
yet used by any agent use case — see the
[Context Map](/strategic-design/context-map)'s MCP surface section):

| Tool | Reads |
| --- | --- |
| `get_process_path` | One `ProcessPath` by id, over the OLTP read path |
| `list_process_paths` | The full catalogue, over the OLTP read path |
| `get_cpt_schedule` | One site's CPT schedule, over the OLTP read path (ADR 0010) |
| `get_catalogue_growth_report` | The analytics data product's "Process Path Catalogue Growth & Change" report, over the reports read path — registered only when `REPORTS_BASE_URL` is set; verified with a real `tools/call` against the live pod |

## Ubiquitous Language

See [Ubiquitous Language](./ubiquitous-language) for the full glossary:
`ProcessPath`, `PathId`, `Capability`, `MatchPrefix`, `Direct`,
`DestinationLocationRole`, `CycleTimeP95`, `Eligibility`, `CPTSchedule`,
`Status`.

## Business Decisions

Five decisions, enforced by the domain model (or, for the CPT
cross-aggregate rule, the use case), not by convention:

1. **`MatchPrefix` must be non-empty and lower-case.** Enforced identically
   at `Define` and at `Revise` time by a single shared validation function.
   Rejected with a typed sentinel error rather than silently coerced —
   persisted data is exactly what was validated.
2. **`RequiredCapabilities` must contain at least one capability.** A
   process path with zero required capabilities is not a meaningful
   business fact. Enforced by the same shared validation function, at both
   `Define` and `Revise` time.
3. **Deactivation is terminal and idempotent.** Once `Deactivated`, a path
   is a closed historical record: `Revise` on it is rejected (no path back
   to `Active`), and re-using a deactivated id is refused, never silently
   reopened. Calling `Deactivate` again is a no-op success, not an error —
   and does not republish `ProcessPathDeactivated` a second time.
4. **`CycleTimeP95` must be strictly positive** (ADR 0010). It is a
   declared standard, not a measurement; `DestinationLocationRole`, when
   set, must be one of `Drop`/`WorkCenter`/`Shipping` (ADR 0009) and is
   never validated live against facility-layout.
5. **A CPT schedule may only name Active paths.** Every cutoff's
   `eligiblePathIds` must reference an Active `ProcessPath` (422
   otherwise), checked at write time in `DefineCPTSchedule` — a CPT is a
   property of a departure, so it is modelled once per site, not per path
   (ADR 0010).

## Assumptions

- The capability vocabulary (`pick`, `pack`, `hazmat`, …) is owned
  elsewhere (this context is the authoritative *source of which
  capabilities a path requires*, not the definer of the vocabulary itself).
- Consumers that eventually wire a Kafka consumer will maintain their own
  local read model/cache, not query this service synchronously on every
  dispatch decision.
- A process path is live the instant it is defined; there is no "draft" or
  approval workflow to model.
- Deactivation carries no position on work already in flight against a
  path in a downstream context — that remains each consumer's own
  operational concern.

## Verification Metrics

- **Invariant enforcement**: 100% of `Define`/`Revise` calls pass through
  the single shared `validate` function — no divergent validation path.
- **No-op correctness**: repeated `Deactivate` calls against an
  already-deactivated path never republish `ProcessPathDeactivated`; a
  byte-for-byte-identical `Revise` never republishes `ProcessPathUpdated`.
- **Consumer wiring**: the count of downstream services with a live Kafka
  consumer on `warehouse.process-path-management.events`. Now 4 — the
  three original catalogue consumers (verified live: a newly-defined path
  reached all three running consumers with no restart, and a deactivation
  propagated the same way) plus `order-management` (ADR 0010).
- **Analytics freshness**: `GET /reports/catalogue-growth/freshness`
  target p95 event-to-report lag under 30 seconds, matching the fleet's
  sibling contexts (ADR 0007). Verified live against the running pod
  returning `{"lagSeconds":0}`.

## Open Questions

- Should this service ever need a synchronous read path (e.g. for
  first-boot backfill in a new consumer), or is "replay the event stream
  from offset zero" always sufficient?
- Does `Direct`'s reserved multi-hop-topology meaning need to be modeled
  further before any consumer actually needs it, or should it stay an
  opaque, immutable flag until a concrete need appears?
