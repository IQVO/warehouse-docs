---
id: index
title: Task Interleaving
sidebar_label: Task Interleaving
description: The Supporting, WES-tier bounded context that, after a station completes a task, ranks the open tasks by how far each one starts from where the operator now stands and issues an advisory, expiring hint of up to five candidates.
slug: /contexts/task-interleaving
---

# Task Interleaving

<span className="badge-supporting">Supporting Subdomain</span>

**Task Interleaving** is one of the fleet's sixteen domain bounded contexts. It
sits in the `wes` tier of the CloudEvents subdomain taxonomy and is the
youngest context of the fleet. When a station completes a task, it looks at
the open tasks of the site, ranks them by the **detour** from the place where the
operator now stands to the place each task starts (a pure function over an
event-fed copy of the open-task pool and of the location geometry), and issues
an **interleaving hint**: a short, ranked, expiring list of candidate tasks.
Operators chain nearby work instead of walking empty.

The hint is **advisory**. `fulfillment-execution` stays pull-based
(`claimNext` remains its only claim path) and would use a hint only as a
tie-break inside one priority band, failing open when the hint is absent,
expired or unknown. This context never assigns work and never writes task
state (its ADR 0001).

:::info[What is built, what is deployed, and what is planned]
Per this context's own [Context Map](/contexts/task-interleaving/context-map)
and [integration page](https://iqvo.github.io/task-interleaving/docs/ecosystem/integration),
checked against `develop` (and, for deployment, `warehouse-infra` `develop`):

**Built on `develop` (`df901f1`):** the REST API (ten path × method pairs in
`apis/openapi.yaml`, including the two analytics report routes, `/healthz` and
`/readyz`), Postgres repositories with embedded migrations, the transactional
outbox and relay, a hint-expiry worker (default sweep 5 s), and **two** Kafka
consumers (open tasks, claims and completions from `fulfillment-execution`;
zones, locations and geometry from `facility-layout`) with retry, a dead-letter
topic and processed-event de-duplication. Postgres and Kafka are the only
runtime (its ADR 0006): `DATABASE_URL` is required, each consumer's mode must be
`kafka` (`permissive` is a boot error) and its group variable must be set. It
ships four binaries: `cmd/api`, a read-only MCP server (`cmd/mcp`, ADR 0007)
and the analytics read side `cmd/ti-projector` + `cmd/ti-reports` (ADR 0008),
plus a Dockerfile, a Helm chart and the console remote
`task_interleaving_mfe`.

**Wired in `warehouse-infra` `develop`:** `terraform/apps.yaml` registers it
(database, analytics database, web remote) and
`helm-values/task-interleaving.yaml` sets both consumer groups and the
analytics projector, so the consumed edges K41, K45 and K46 are live.
`warehouse-ops-agent` has an MCP client for it
(`internal/adapters/outbound/mcpclient/task_interleaving.go`). The kind cluster
was not checked.

**Its one output edge is live too:** `fulfillment-execution` consumes
`InterleavingHintIssued` (its ADR 0051) and uses it only as a tie-break inside
one `claimNext` priority band; `warehouse-infra` sets
`TASK_INTERLEAVING_MODE=kafka` with its own consumer group for it (edge K47).

**Only some tasks reach the pool.** `fulfillment-execution` announces
`TaskAvailable` for `RELOCATE` and `REPLENISH` tasks only, because only those
carry bins. A `PICK`, `PACK`, `SLAM` or `REBIN` task has no location in that
service. The candidate list is therefore made of those two task types, and a
station's position is recorded only when it completes an announced task.

**Planned, not built:** wider pool coverage (tasks without bins are never
announced).
:::

It owns two aggregates, a pure recommender and a travel model:

- **`InterleavingPolicy`** (package `internal/domain/policy`): one per site.
  How far (`MaxDetourM`), how many candidates (`MaxCandidates`, 1 to 5), how
  long (`HintTTL`), which task types are eligible, and how much vertical travel
  weighs. A site with no policy is **inert**: it issues no hint. Declared with
  `PUT /sites/{siteId}/policy` under `If-Match` optimistic concurrency.
- **`StationTrip`** (package `internal/domain/stationtrip`): one per station.
  Where the operator stands (the end of the last completed task) and the most
  recent hint, in the states `Active`, `Consumed`, `Expired` or `Superseded`.
  At most one hint is Active.
- **The recommender** (package `internal/domain/recommend`): the pure function
  that ranks candidates by detour, then task id.
- **The travel model** (package `internal/domain/travel`): the port behind the
  distance, `rectilinear-v1` in v1 (`|dx| + |dy| + verticalWeight * |dz|`, in
  metres). Unknown geometry is *unknown*, never zero.

## This context's pages

- [Business Context](/contexts/task-interleaving/business-context): the gap,
  what it owns, the v1 recommender, and what the context deliberately does not
  do.
- [Ubiquitous Language](/contexts/task-interleaving/ubiquitous-language):
  station trip, hint, candidate, detour, policy, travel model, open-task pool,
  priority band, tie-break.
- [Core Domain Chart](/contexts/task-interleaving/core-domain-chart):
  Supporting, and why.
- [Bounded Context Canvas](/contexts/task-interleaving/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, classification, roles, communication, decisions.
- [Context Map](/contexts/task-interleaving/context-map): every edge with its
  pattern, technology and state.
- [Aggregate Design Canvas](/contexts/task-interleaving/aggregate-design-canvas):
  `InterleavingPolicy` and `StationTrip`.
- [Domain Events](/contexts/task-interleaving/domain-events): the four
  published events and the seven consumed ones.
- [Domain Message Flow](/contexts/task-interleaving/domain-message-flow),
  [EventStorming](/contexts/task-interleaving/eventstorming),
  [Class Diagram](/contexts/task-interleaving/class-diagram),
  [Entity Relationship](/contexts/task-interleaving/entity-relationship),
  [Sequence Diagrams](/contexts/task-interleaving/sequence-diagrams) and
  [Use Cases](/contexts/task-interleaving/use-cases).
- **Operations**: [Configuration](/contexts/task-interleaving/configuration),
  [Runbook](/contexts/task-interleaving/runbook),
  [Observability](/contexts/task-interleaving/observability),
  [Troubleshooting](/contexts/task-interleaving/troubleshooting) and
  [Testing](/contexts/task-interleaving/testing).
- [Async API](/contexts/task-interleaving/async-api): the Kafka narrative.
- Generated references: [REST](/api-reference/rest/task-interleaving/task-interleaving-api)
  and [AsyncAPI](/api-reference/async/task-interleaving).

## Elsewhere

- **Repository**: [github.com/IQVO/task-interleaving](https://github.com/IQVO/task-interleaving),
  with its own docs site at
  [iqvo.github.io/task-interleaving](https://iqvo.github.io/task-interleaving/).
  Its ADRs live under `docs/adr/`: 0001 (bounded context), 0002 (the
  `StationTrip` and policy aggregates and their invariants), 0003 (event-fed
  local copies and the consumed contracts), 0004 (CloudEvents envelope and
  type catalogue), 0005 (persistence and evaluation semantics), 0006
  (Postgres and Kafka are the only runtime), 0007 (MCP server) and 0008
  (analytics read side).
- **Fleet-level**: [Context Map](/strategic-design/context-map) (K41 and K45 to
  K47), the [Event Standard](/strategic-design/event-standard-cloudevents)
  (subdomain table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [Ubiquitous Language](/strategic-design/ubiquitous-language).
