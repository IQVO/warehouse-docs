---
id: bounded-context-canvas
title: Bounded Context Canvas
sidebar_label: Bounded Context Canvas
description: The full ddd-crew Bounded Context Canvas for workforce-management — purpose, strategic classification, roles, inbound/outbound communication, business decisions, assumptions, open questions.
---

# Bounded Context Canvas

Following the [ddd-crew Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas)
template, filled in from `workforce-management`'s own docs and `CLAUDE.md`.

## Name

**Workforce Management**

Also known as: labor management, headcount planning. Neither synonym is used
in this context's own code or API — see [Ubiquitous Language](./ubiquitous-language).

## Purpose

Make the labor picture of a shift **legible and enforceable**: record who is
on shift and what they are qualified for, let a human commit a split of
headcount across process paths, track where each person actually is as that
split drifts, and surface the gap — without ever deciding what any
individual person should do next.

Three concrete jobs follow from that purpose:

1. Record who is on shift and what they hold certifications for
   (`AssociateShift`).
2. Let a human commit a headcount split across process paths for a shift
   (`ShiftPlan`).
3. Track where each person actually is, and surface when a path falls short
   of its committed heads (`LaborAssignment`, `PathUnderstaffed`).

## Strategic Classification

<span class="badge-supporting">Supporting Subdomain</span>

**Domain: WES-adjacent, Supporting.** The Amazon-fulfillment DDD reference
model classifies Labor & Workforce Management as Supporting: "allocates
workforce to workload; important, industry-common." Two load-bearing
clauses:

- **"Important"** — a shift cannot be planned without headcount. A missing
  certification gate is a safety incident; a double-booked associate
  corrupts every downstream headcount number.
- **"Industry-common"** — every warehouse does this, recognisably the same
  way. Nobody wins the market on break-tracking code.

**Supporting, not Generic:** the model is specific enough to this platform's
process-path vocabulary that an off-the-shelf labor-management product would
need a translation layer wider than the service itself. **Supporting, not
Core:** the platform's differentiators are `wes-work-planning`'s continuous
release and flow balancing, `inventory-storage`'s chaotic stow and revocable
reservations, and `fulfillment-execution`'s pull-based dispatch — not this.

**Business model: Compliance/Cost of doing business.** The invariants this
context enforces (certification gating, no double-booking) exist because
violating them is a safety and correctness failure, not because the
arithmetic itself is a competitive differentiator.

**Evolution: Product (Wardley-style), not Genesis or Custom-built.** Labor
allocation against a fixed path catalogue is a well-understood problem;
investment here goes into correctness (invariants enforced structurally,
tested on their failing paths), not into novel optimisation. There is
deliberately no optimiser, heuristic, or scoring function anywhere in this
codebase.

## Domain Roles

| Role | Applies here? | Why |
| --- | --- | --- |
| **Execution context** | No | It records decisions; it does not execute floor work. |
| **Engagement context** | No | No end-user-facing UX surface beyond an internal `workforce-mfe` dashboard reading its own read model. |
| **Compliance context** | **Yes** | The certification gate and the single-active-assignment invariant exist to prevent a safety/quality failure (an untrained or double-booked associate), not to optimise anything. |
| **Interchange context** | Partial | Publishes `ShiftPlanCommitted` as the interchange fact `wes-work-planning` needs — see Outbound Communication. |

## Inbound Communication

| Collaborator | Message / Contract | Pattern |
| --- | --- | --- |
| `process-path-management` | Kafka, topic `warehouse.process-path-management.events`, events `ProcessPathCreated`/`Updated`/`Deactivated` | Open Host Service + Published Language, Conformist downstream — this context replays the topic from `FirstOffset` into a local `kafkacatalog` read model, replacing a boot-time static-YAML load. **Live**, verified with no restart on both a new path definition and a deactivation. See `process-path-management` ADR 0002 and this repo's own ADR 0013. |
| `labor-performance` | Kafka, topic `warehouse.labor-performance.events`, event `TaskPerformanceRecorded` | Customer/Supplier — this context is a **Conformist** downstream, consuming `labor-performance`'s Published Language into a local, event-fed running-mean cache. **Live** (ADR 0019), the SAME architectural pattern this context's own `kafkacatalog` package already applies to `process-path-management`'s events above: per-process-unique consumer group, `FirstOffset` replay, `Ready()`/`WaitReady()` readiness gate. Since labor-performance ADR 0014 added an additive, nullable `idle_seconds_before` to the SAME message, this context's `laborperformancecache.Consumer` (own ADR 0020) also tracks a running idle share per `TaskType` off the identical stream — no new topic, no new consumer group. `GetStaffingGap` surfaces it as `observedIdlePct`, and `ProposePathPlan` trims proposed heads when it is high (see Business Decisions below). |

Both consumers above are **opt-in** (`PATH_CATALOGUE_SOURCE=kafka`,
`LABOR_PERFORMANCE_MODE=kafka-cache`; the defaults are a file and
`permissive`), rebuild an in-memory cache only, and write nothing to
Postgres. The `warehouse-infra` kind cluster turns both on.

The one inbound *caller* from another bounded context is read-only:
`warehouse-ops-agent` calls this context's MCP tools `get_staffing_gap` and
`propose_path_heads` (ADR-0008) and reads the labor report
(`GET /reports/labor` on `cmd/workforce-reports`, ADR-0010). The MCP server
also exposes a write tool, `assign_labor`, annotated destructive; no sibling
calls it. Every command — the ten REST operations in `apis/openapi.yaml` —
is otherwise invoked by a human operator (via `workforce-mfe` or a REST
client). No sibling invokes a command here. REST and MCP are
**unauthenticated** by deliberate decision: the static-bearer-key layer of
ADR-0017 was removed by
[ADR 0018](https://github.com/claudioed/workforce-management/blob/develop/docs/docs/adr/0018-remove-fleet-rest-identity.md).

`installedStations` — a fact `wes-work-planning` also holds — still
arrives **in the `CommitShiftPlan` request payload** from the caller
rather than being fetched from Work Planning, so this context takes no
dependency on Work Planning. `CommitShiftPlan` is no longer free of
synchronous dependencies, though: since
[ADR 0014](https://github.com/claudioed/workforce-management/blob/develop/docs/docs/adr/0014-installed-capacity-ceiling.md)
it also reads `fulfillment-execution`'s live installed capacity — see
Outbound Communication below.

## Outbound Communication

| Collaborator | Message / Contract | Pattern |
| --- | --- | --- |
| `wes-work-planning` | `ShiftPlanCommitted` on topic `warehouse.workforce.events` (Kafka, asynchronous, one message per `PathPlan` line) | Open-Host Service + Published Language — this context is the supplier, one-way, publish-and-forget |
| own analytics projector (`cmd/workforce-projector`) | Every domain event on topic `warehouse.workforce.analytics` (ADR 0010) | Internal data product, not a sibling contract |
| `fulfillment-execution` | Synchronous query `GET /capacity/{capability}` for every line of every `CommitShiftPlan` ([ADR 0014](https://github.com/claudioed/workforce-management/blob/develop/docs/docs/adr/0014-installed-capacity-ceiling.md)) | Conformist on a **count** — fail-LOUD: any failure rejects the whole commit with `503 installed-capacity-unavailable`. `INSTALLED_CAPACITY_MODE=http` + `FULFILLMENT_EXECUTION_BASE_URL`; the `permissive` default fails every commit. The kind cluster sets `http`. |
| `labor-performance` | Synchronous query `GET /task-types/{taskType}/performance` when `ProposePathPlan` gets no caller rate (ADR 0012) | Conformist, fail-open, **alternative** to the Kafka cache above — only when `LABOR_PERFORMANCE_MODE=http` (the kind cluster uses `kafka-cache` instead) |

The `warehouse-ops-agent` reads described under Inbound Communication —
MCP `get_staffing_gap` (whose REST twin, `GET /paths/{pathId}/staffing-gap`,
now also carries `observedIdlePct` — ADR 0020), `propose_path_heads`, the
`staffing://{buildingId}/{shiftId}/{pathId}/gap` MCP resource, and
`GET /reports/labor` — are read-only fan-out: never a write, never a
dependency this service must honor.

Publishing is still publish-and-forget: events are written to an
`outbox_events` table in the same Postgres transaction as the aggregate and
relayed to Kafka by a goroutine in `cmd/workforce` (transactional outbox,
[ADR 0016](https://github.com/claudioed/workforce-management/blob/develop/docs/docs/adr/0016-transactional-outbox.md)),
so a commit never fails because a downstream consumer is unavailable. The
one exception to "no runtime dependency on a sibling" is the deliberate,
fail-loud installed-capacity read above: a commit mutates real state, so
this context would rather reject it than commit headcount it cannot verify
against physical stations. Neither outbound query sends an `Authorization`
header (ADR 0018).

## Ubiquitous Language

See the full [Ubiquitous Language](./ubiquitous-language) page. The load-bearing
terms for this canvas: **ShiftPlan**, **PathPlan**, **AssociateShift**,
**LaborAssignment**, **Certification**, **PathUnderstaffed**, **Process
path**. Terms this context deliberately excludes — **Task**, **Station** (as
an occupiable position) — belong to `fulfillment-execution` and mark the
path boundary explicitly.

## Business Decisions

- **Certification-gated assignment.** An assignment requires the associate
  hold the path's required certification, checked in the domain before any
  state changes. A path's required certification is, by convention, the
  `Certification` with the same name as the `PathId` (`pack` requires
  `pack`) — a documented naming convention, not a modelled relationship.
- **Exactly one ACTIVE assignment per associate — enforced structurally.**
  `LaborAssignment` is keyed by `AssociateId` and holds a single optional
  active interval, so a second active assignment has nowhere to exist. This
  is not a checked rule that could be bypassed by a race or a repair script;
  it is unrepresentable.
- **Assignment supersedes rather than rejects.** Assigning an associate who
  already has an active assignment closes the old interval (logging its
  hours) and opens the new one, raising `LaborReassigned` instead of
  `LaborAssigned`. This matches the floor: a supervisor moves someone; they
  do not first "unassign" them. The accepted cost: a client expecting a
  conflict error instead gets a `201` and a reassignment event.
- **`plannedHeads(path) ≤ installedStations(path)` is enforced here,
  independently of `wes-work-planning`.** Not duplication by accident — this
  is the aggregate that actually commits headcount, so it validates its own
  commitment rather than trusting an upstream check it does not control.
- **A second, live ceiling: `plannedHeads(path) ≤ installedCapacity(path)`.**
  Since [ADR 0014](https://github.com/claudioed/workforce-management/blob/develop/docs/docs/adr/0014-installed-capacity-ceiling.md),
  every line is also checked against the registered-station count
  `fulfillment-execution` reports for the path's capability, fetched fresh
  on every commit. Exceeding it is a `409 exceeds-installed-capacity`;
  failing to fetch it rejects the whole commit with `503` — no fallback,
  because a commit mutates real state.
- **`PathUnderstaffed` is a flag, not a decision.** When active assignments
  fall below a path's committed `plannedHeads`, this context raises the
  flag and stops. It never picks a victim path, never ranks associates, and
  never writes a `LaborAssignment` on anyone's behalf — rebalancing depends
  on facts (a blocked aisle, a promise made ten minutes ago) that this
  context structurally cannot see. A human responds and records the
  response via `AssignLabor`.
- **Software proposes, humans commit.** `ProposePathPlan` is pure arithmetic
  (`heads = ceil(charge ÷ plannedRate)`) with no persisted state and no
  identity. `CommitShiftPlan` is the human act of commitment, validated as
  one atomic all-or-nothing decision across every `PathPlan` line.
- **Idle share trims a proposal, but never past a floor of 1 head, and
  never as a hard cap.** Since [ADR 0020](https://github.com/claudioed/workforce-management/blob/develop/docs/docs/adr/0020-idle-share-staffing-signal.md),
  `ProposePathPlan` reduces its proposed heads (`ceil(heads * (1 −
  idleShare))`, floored at 1) when the path's task type's observed idle
  share — fed from `labor-performance` via the same
  `laborperformancecache.Consumer` used for the measured-rate signal —
  strictly exceeds `IDLE_SHARE_TRIM_THRESHOLD` (default `0.30`), and returns
  an auditable `trimReason` naming the observed share, the threshold, and
  the before/after head counts. Every non-trim outcome (no idle-share
  signal wired, no data observed yet, or the share at-or-below threshold)
  returns the unchanged, pre-idle-share heads — this is a proposal input, a
  human still commits via `CommitShiftPlan`, exactly as before.

## Assumptions

- `wes-work-planning` is the only party that needs to know committed labor
  per path, and needs it asynchronously, not synchronously.
- The caller of `CommitShiftPlan` — a human, via the HTTP adapter —
  already knows each path's `installedStations` count and supplies it
  correctly; this context does not verify that number against any other
  system. It does, separately, check each line against
  `fulfillment-execution`'s live installed capacity (ADR 0014), which
  bounds the damage of a wrong caller-supplied count.
- A path's required certification always has the same name as the `PathId`.
  This convention is documented in three places (README, OpenAPI, this docs
  site) but is invisible in the type system — renaming a path with no
  matching certification breaks assignment at runtime, not compile time.
- Rebalancing authority is, and will remain, human. If an automated
  `AssignmentOptimizer` is ever built, this is the first assumption — and
  the whole non-relationship with `fulfillment-execution` — that needs
  revisiting.
- No sibling context currently needs `AssociateShift` roster/break events or
  individual `LaborAssigned`/`LaborReassigned` moves; they stay in-process
  until a real downstream need appears, and the honest answer to that need
  is a scoped read-model endpoint, not an event firehose.

## Verification Metrics

| Metric | Target / actual | Source |
| --- | --- | --- |
| Domain + application test coverage | ≥ 90% gate; 98.2% achieved | `make check-all` (`coverage`) |
| Failing-path tests for the four named invariants | 1 dedicated test per invariant per layer (domain/application/HTTP) | `ADR 0003`, `ddd/invariants.md` |
| Mutation testing (`gremlins`) on `internal/domain/...` | Blocking CI subset + full scheduled run | `make mutation` / `make mutation-full` |
| Acceptance specs over the real HTTP surface | `godog`/Gherkin BDD suite | `make check-all` (`bdd`) |
| Architecture fitness (hexagonal layering) | `arch-go` fitness tests, blocking CI | ADR-0007 |
| Vulnerability scanning | `govulncheck ./...`, blocking CI on `go.mod`/`go.sum` changes | `make vuln` |
| Events published to the integration topic vs. cataloged | 1 of 10 (`ShiftPlanCommitted` only); all 10 also go to the internal `warehouse.workforce.analytics` topic | `ddd/domain-events.md`, ADR 0010 |

## Open Questions

- **Is the deliberate task-level non-integration with `fulfillment-execution`
  still correct as the platform grows?** No task, claim, associate identity
  or assignment crosses between this context and `fulfillment-execution`, in
  either direction, and there is no shared table. The only edge is the
  installed-capacity read (a count, ADR 0014). This is a stated, ADR-backed decision
  ([ADR 0002](https://github.com/claudioed/workforce-management/blob/develop/docs/docs/adr/0002-stop-at-the-path-boundary.md)),
  not a gap in the diagram: the two contexts change at cadences three orders
  of magnitude apart (shifts vs. seconds), are decided by different actors
  (a human supervisor vs. a pull-based dispatch policy), and have
  incompatible lifecycles (a shift-length interval vs. an at-most-once,
  leased claim). Fusing them would force every task-dispatch policy change
  to touch workforce-planning code and vice versa, for no domain reason.
  The open question is not "should we wire this?" but "does the cost of
  *not* wiring it — you cannot answer 'what is Alice doing right now?' from
  this service alone, and utilization reporting spanning task-level detail
  has to join two services — remain the cheaper trade as reporting needs
  grow?" If and when a real downstream need for task-level detail appears,
  the documented answer is a read model in whichever service already owns
  the join, not a new field or edge here.
- If an automated `AssignmentOptimizer` is ever built for rebalancing, this
  context's entire non-decision-making posture (`PathUnderstaffed` as a
  flag) and its non-relationship with `fulfillment-execution` are the first
  things that would need revisiting.
- CloudEvents 1.0 is the only envelope on the wire (the
  [Event Standard](/strategic-design/event-standard-cloudevents); see
  [Async API](./async-api)); consumers route on the full `type`.
