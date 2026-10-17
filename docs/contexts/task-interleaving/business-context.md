---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why choosing the next nearby task is its own bounded context — the per-site policy, the station trip and its hint lifecycle, the rectilinear-v1 recommender, and what the context deliberately does not do.
---

# Business Context

Written here from the context's own
[introduction](https://iqvo.github.io/task-interleaving/docs/overview/introduction),
its [integration page](https://iqvo.github.io/task-interleaving/docs/ecosystem/integration)
and its ADRs under `docs/adr/` in
[IQVO/task-interleaving](https://github.com/IQVO/task-interleaving)
(0001 to 0005, all Accepted 2026-10-17), checked against the code on
`develop`. Where the code has moved past an ADR's wording, the code is
authoritative.

## The gap

`fulfillment-execution` hands out work through the pull-based
`claimNext(stationId, capabilities)`: the system selects the task, and a lease
protects a claim. Nothing in the fleet asked which open task is **close to where
this operator now stands**. An operator who finishes in aisle A01 can be sent to
aisle A19 while a task two bins away waits, so travel, the largest share of
picking labour, is spent without a policy. Task interleaving (task chaining,
dual command cycling) is the usual warehouse-execution answer: weigh the travel
from the end of one task to the start of the next.

It could be a rule inside `claimNext`. It is a separate context, by decision,
only while three properties hold (ADR 0001): the output is **advisory**, the
context **never issues an `assign`**, and it **owns no task state**. If any of
them is dropped, the logic belongs back in `fulfillment-execution`.

## What it owns

| Fact | Value |
| --- | --- |
| Subdomain class | **Supporting** (ADR 0001) |
| Tier | **WES** (CloudEvents subdomain segment `wes`) |
| Aggregates | `InterleavingPolicy` (package `internal/domain/policy`, one per site) and `StationTrip` (package `internal/domain/stationtrip`, one per station), ADR 0002 |
| Recommender | the pure function `recommend.Recommend`, with the `travel.Model` port (v1: `rectilinear-v1`) |
| Binaries | one: `cmd/api` (REST on `HTTP_ADDR`, default `:8080`, plus up to two Kafka consumers, the hint-expiry worker and the outbox relay as goroutines). There is **no** `cmd/mcp` |
| Data store | one Postgres database (embedded migrations), or in-memory adapters when `DATABASE_URL` is unset |
| Kafka | publishes `warehouse.task-interleaving.events` and `warehouse.task-interleaving.analytics`; consumes `warehouse.fulfillment.events` and `warehouse.facility.events` (ADR 0003, ADR 0004) |
| Auth | none (fleet-wide decision) |

- **The policy.** Per site: `MaxDetourM` (greater than 0), `MaxCandidates` (1 to
  5), `HintTTL`, `EligibleTaskTypes` (a non-empty subset of `PICK`, `PACK`,
  `REBIN`, `SLAM`, `RELOCATE`, `REPLENISH`), `VerticalWeight` (at least 0) and a
  `version`. Declared with `PUT /sites/{siteId}/policy` under `If-Match`
  optimistic concurrency. A site with no policy is **inert**: no hint, by
  design. Declaring publishes the analytics-only fact `InterleavingPolicyDeclared`.
- **The station trip.** Where the operator stands (the end location of the last
  completed task) and the most recent hint: `Active`, then `Consumed`,
  `Expired` or `Superseded`. At most one hint is Active per station. A hint is
  `Consumed` when the station claims one of its candidates before it expires.
- **The recommender.** From the station's origin, the open-task pool and the
  policy it returns the candidates of the same site, of an eligible type, not
  the task just completed, with known geometry and a detour at most
  `MaxDetourM`, ranked by detour then task id, cut to `MaxCandidates`. The
  result does not depend on the order of the pool. An empty result issues no
  hint.

## The v1 policy

Deterministic and explainable (ADR 0002; see the
[Ubiquitous Language](/contexts/task-interleaving/ubiquitous-language)):

1. **Detour** = the distance from the origin to the candidate's `from_location`,
   `|dx| + |dy| + verticalWeight * |dz|` in metres, rounded to 0.1 m
   (`rectilinear-v1`). A location with no geometry has an **unknown** distance:
   it is never a candidate, and as an origin it yields no hint.
2. **Ranking** is by detour ascending, then task id ascending, so a hint is
   reproducible from the same pool and position.
3. **Expiry**: `expires_at = issued_at + HintTTL`; the expiry worker sweeps
   Active hints past it (default every 5 s, `HINT_EXPIRY_INTERVAL`).
4. A completion that leaves **no** candidate issues no hint and does not retract
   an older Active hint; that one expires at its TTL (ADR 0002).

Aisle geometry, cross-aisle routes and fixed structures are planned refinements
behind the same `travel.Model` port. They do not exist today.

## Main capabilities

| Capability | Interface | Use case |
| --- | --- | --- |
| Declare and read a site policy | `PUT/GET /sites/{siteId}/policy` | `DeclarePolicy`, `GetPolicy`; see [Use Cases](/contexts/task-interleaving/use-cases) |
| Read hints and a station's trip | `GET /hints`, `GET /hints/{hintId}`, `GET /stations/{stationId}` | `ListHints`, `GetHint`, `GetStation` |
| Simulate the recommender, read-only | `POST /recommendations` | `Recommend` |
| Keep the open-task pool current | Kafka consumer (`FULFILLMENT_MODE=kafka`) | `ApplyTaskAvailable`, `ApplyTaskClaimed` |
| Record a completion and issue a hint | the same consumer, on `TaskCompleted` | `ApplyTaskCompleted` |
| Keep the location geometry current | Kafka consumer (`LAYOUT_MODE=kafka`) | `ApplyZone`, `ApplyLocationRegistered`, `ApplyLocationDecommissioned`, `ApplyGeometryUpdated` |
| Expire hints | the expiry worker | `ExpireHints` |
| Publish hints and their outcome | transactional outbox + relay (needs `DATABASE_URL` and `KAFKA_BROKERS`) | every write use case |

The write endpoint takes an `Idempotency-Key` that is enforced with Postgres.
The full catalogue is on [Use Cases](/contexts/task-interleaving/use-cases).

## What it deliberately does not do

- **Own tasks, claims or locations.** It keeps event-fed local copies
  (`task_pool`, `zones`, `locations`) and never calls a sibling at request time.
  It makes no outbound HTTP or MCP call at all, and nothing calls it on the hot
  claim path.
- **Assign work.** There is no `assign`; `claimNext` stays the only claim path.
  A hint that is ignored costs nothing.
- **Interpret priority.** `priority_band` is carried and never read.
- **Know the associate.** Hints are per station.
- **Retract a hint.** An outdated hint expires on its TTL.

It has no edge to `wes-work-planning`, `process-path-management`,
`order-management`, `inventory-storage`, `labor-performance` or
`pick-face-replenishment` (ADR 0001). A `REPLENISH` task reaches it only as an
ordinary `TaskAvailable`.

## Honest scope today

- The service is built on `IQVO/task-interleaving` `develop` (PR #7): REST API,
  Postgres repositories, outbox and relay, the expiry worker, the two consumers
  and the BDD and architecture fitness suites. This site holds its
  `apis/task-interleaving/` specs, the generated references and the synced
  artifact pack and operations pages.
- It is **not deployed in the reference cluster.** `warehouse-infra` `develop`
  has no database, Kong route, ArgoCD application, values file or dashboard for
  it, and the repository has no Dockerfile or Helm chart on `develop` (its
  Runbook says so). It runs only from a locally built binary. Its declared Kong
  path, `/api/task-interleaving`, therefore routes nowhere yet.
- **The inputs are built on both sides.** `fulfillment-execution` publishes
  `TaskAvailable` and `TaskClaimed` (its ADR 0049) and `TaskCompleted`, and
  `facility-layout` publishes the zone, location and geometry events. Both
  consumers here are opt-in and nothing starts them in the cluster.
  `TaskAvailable` is announced for `RELOCATE` and `REPLENISH` tasks only (its
  ADR 0049 and ADR 0050), so the pool, and with it every hint, contains those
  two task types today.
- **The output has no consumer.** `fulfillment-execution` has no code that reads
  `InterleavingHintIssued` (no consumer, no hint table, no tie-break in
  `claimNext`; its ADR 0049 and ADR 0050 list it as out of scope). Until it
  does, nothing on the floor changes.
- Live-data findings owed (ADR 0003): whether the pool's `site_id` values equal
  `facility-layout`'s `siteCode` values, what share of pool task locations has a
  geometry point, and whether the geometry frame is the same for every location
  of a site. None can be answered before the service runs against real rows.
- An analytics read side (`warehouse.task-interleaving.analytics` is written,
  but nothing reads it), a `warehouse-ops-agent` client and a console remote
  are later phases. None of them exists yet.
