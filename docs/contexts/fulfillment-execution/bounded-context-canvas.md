---
id: bounded-context-canvas
title: Bounded Context Canvas
sidebar_label: Bounded Context Canvas
description: The full ddd-crew Bounded Context Canvas for Fulfillment Execution — purpose, strategic classification, domain roles, inbound/outbound communication, business decisions, assumptions, verification metrics, open questions.
---

# Bounded Context Canvas

Following the [ddd-crew Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas)
template.

## Name

**Fulfillment Execution**

## Purpose

Turn released work into completed physical operations, and make it
impossible to lose a unit of work in the process. Owns the **task
lifecycle** for Pick, Pack, Rebin, and SLAM — from a released work unit
becoming a claimable `Task`, through a station claiming and completing it,
to the completion fact flowing back to the context that released the work.

## Strategic Classification

| Dimension | Verdict | Justification |
| --- | --- | --- |
| **Domain** | Core | This platform builds and tunes its own execution layer — there is no vendor WES behind an anti-corruption layer here. The reference model is explicit: the WES tier is Core *if* operational efficiency is your differentiator, Supporting/Generic if you consume a vendor WES at arm's length. This platform chose to build `claimNext`, which is only justified under a Core classification. |
| **Model maturity** | Established | Twenty-six ADRs (one superseded), a documented ubiquitous language, invariant-level failing-path tests, and an executable architecture-fitness suite (`arch-go`) — the deepest decision trail of any context in this fleet. |
| **Business risk / criticality** | High | Every invariant here — at-most-once claiming, capability matching, lease expiry ordering, no double-complete, seal-requires-contents, SLAM weigh-check tolerance — has a real, expensive-to-unwind failure mode (a duplicate physical pick, a mis-shipped package) if it is wrong. |
| **Team topology** | Stream-aligned, sole owner | One team owns `internal/domain/`, `internal/application/`, and both inbound/outbound adapters end to end. No shared aggregate with any other context. |

The reference model gives a second, independent line of reasoning that also
lands on Core: `amazon-fulfillment-ddd.md`'s subdomain table classifies
**Picking** (task generation, pick-to-light, robot-to-picker) as Core
outright — "directly drives throughput and accuracy at scale" — while
classifying Packing and Shipping/SLAM as Supporting. This context spans
Picking (Core) plus the execution slices of Packing and SLAM (Supporting),
and is classified by its most valuable part: the task lifecycle and
dispatch that drive throughput.

## Domain Roles

| Role | This context's fit |
| --- | --- |
| **Execution engine** | Owns a real-time dispatch and claim mechanism (`claimNext`, lease-based at-most-once claiming) — not a passthrough, not a CRUD layer. |
| **Anti-corruption gateway** | Translates `WorkReleased` at its inbound boundary into its own vocabulary (`task.Type`, `shared.OrderRef`, `shared.CPT`, `shared.CapabilitySet`) — no upstream struct crosses the line. |
| **Feedback publisher** | Closes the drum-buffer-rope loop back to `wes-work-planning` via `TaskCompleted` — without this edge the conductor releases work into a void — and feeds `order-management`'s promise loop via `TaskCPTMissed` / `PackageManifested`. |

## Inbound Communication

| From | Event / Call | Effect here |
| --- | --- | --- |
| `wes-work-planning` | `WorkReleased` (Kafka, `warehouse.work-planning.events`) | Translated via the Anti-Corruption Layer and passed to the existing `CreateTask` use case — a released unit becomes a `Task` in the pool. Idempotent on `event_id` via `ProcessedEvents.MarkProcessed`. |
| `warehouse-ops-agent` | `GET /tasks?orderRef=` (HTTP, read-only) | A read-only fan-out query backing the fleet's cross-service Order Lifecycle console screen. Side-effect-free; this service is one of several the agent stitches together per order, and each stage degrades independently. |
| `workforce-management` | `GET /capacity/{capability}` (HTTP, read-only) | Returns how many registered stations can serve a capability, so shift plans are bounded by physical station count ([ADR-0018](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0018-installed-capacity-read-endpoint.md)). An Open Host read of the `Station` pool — no shared type, no roster. |
| `process-path-management` | `ProcessPathCreated` / `Updated` / `Deactivated` (Kafka, `warehouse.process-path-management.events`) — **only with `PATH_CATALOGUE_SOURCE=kafka`** (default `file` loads the same catalogue from YAML) | Replayed into the in-memory process-path catalogue the `WorkReleased` ACL resolves `path_id` against ([ADR-0017](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0017-process-path-catalogue-as-configuration.md)). |
| Any REST / MCP caller | REST API and MCP tools (e.g. `find_claimable_work`, `get_queue_status`, `diagnose_stuck_tasks`, `complete_task`, `get_fulfillment_throughput_report`, `get_on_time_to_cpt`) | **Unauthenticated by deliberate decision** — the static-bearer layer was removed and ADR-0021 superseded ([ADR-0022](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0022-remove-rest-mcp-auth.md)). |

## Outbound Communication

| To | Event / Call | Status |
| --- | --- | --- |
| `wes-work-planning` | `TaskCompleted` (Kafka, `warehouse.fulfillment.events`) | **Wired.** Enriched at the adapter with `work_unit_id` (via a `TaskRepo` lookup of `OrderRef()`) so Work Planning can call `RecordCompletion(workUnitId)` directly. |
| `labor-performance` | `TaskCompleted` (Kafka, **same** `warehouse.fulfillment.events` fan-out topic) | **Wired**, as a second, independent Conformist consumer of the identical event — enriched additionally with `associate_id` and `duration_seconds`, resolved at publish time via `StationRepo` and `Task.ClaimedAt()`, plus `task_type` read off the task ([ADR-0023](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0023-task-type-on-wire.md)). |
| `order-management` | `TaskCPTMissed`, `PackageManifested` (Kafka, **same** topic) | **Wired.** Its `RepromiseOrder` consumer closes the promise feedback loop. `TaskCPTMissed` is raised by `POST /tasks/sweep-cpt-misses` for every task still open at or past its CPT; `PackageManifested` alongside `LabelApplied` on a SLAM pass ([ADR-0025](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0025-cpt-missed-sweep-and-package-manifested.md)). |
| `inventory-storage` | `GET /products/{sku}/classification` (HTTP, at seal time) | **Opt-in** (`PRODUCT_CLASSIFICATION_MODE=http`; default `permissive` skips the lookup). Supplies each scanned SKU's DOT hazard class for package segregation ([ADR-0010](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0010-package-segregation-and-sort-lane.md)). |
| `facility-layout` | `GET /locations/{locationCode}` (HTTP, at `RegisterStation`) | **Opt-in** (`LOCATION_ROLE_MODE=http`; default `permissive` records a supplied `locationCode` unchecked). Rejects a station whose location resolves to a **known** non-WorkCenter role; fails open on everything else ([ADR-0024](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0024-station-location-code-and-workcenter-role-check.md)). |
| WCS / equipment | Device commands (divert, label-print, weigh-check) | **Planned, not wired.** `ports.EquipmentCommandPort` exists as a structural, deliberately empty outbound port — no adapter, no callable methods — so the documented refusal to drive equipment directly is a compile-time seam, not only prose in `openapi.yaml` and the context map. |

## Ubiquitous Language

See the dedicated [Ubiquitous Language](/contexts/fulfillment-execution/ubiquitous-language) page for the
full glossary (Task, `claimNext`, Lease, Station, Fragile, Gift wrap, and
the rest). The single most important entry on that page is the careful,
deliberate distinction between **Fragile** (sourced from
`inventory-storage`'s `ProductClassification`, stamped by `wes-work-planning`
at release time) and **Gift wrap** (a caller-stated fact about the released
work itself, with no product-classification origin at all) — both are
packing-care hints that never gate claiming, and both are explicitly unlike
**Hazmat**, which is a real station-capability gate.

## Business Decisions

- **Lease-based at-most-once claiming, not a hard lock.** A claim is a
  time-boxed, renewable lease rather than a database row lock held for the
  duration of physical work. A hard lock's lifetime would be a
  transaction's lifetime, and the work here takes minutes of physical
  activity — holding a transaction open across a human walking down an
  aisle is not viable, and it fails outright under the in-memory adapter.
  Default duration 5 minutes; renewal is a first-class operation, not an
  escape hatch.
- **Pull dispatch (`claimNext`), never push (`assign`).** The system never
  names a station in advance. Selection policy — earliest-CPT-first,
  filtered by capability match — lives entirely in one repository query,
  which is deliberate: it is the one place any future dispatch
  sophistication has to be expressed.
- **Fragile / Hazmat / Gift wrap handling flags, each a different category
  of concern.** Fragile and Gift wrap are packing-care hints that never
  gate claiming. Hazmat is a real capability gate enforced through the
  existing, unmodified `CapabilitySet.HasAll` mechanism — no new structural
  code path was needed for it. Package-level DOT hazard segregation is
  looked up **live**, per scanned SKU, at seal time — not stamped on `Task`
  at release time — because a Pack task's actual contents are only known at
  the scan station.
- **Domain events stay deliberately thin.** Almost every event carries only
  aggregate identifiers (the ADR-0025 pair add just the `order_ref`,
  `task_type` and `cpt` order-management needs). Integration-specific enrichment (`work_unit_id`,
  `associate_id`, `duration_seconds`) happens in the outbound Kafka adapter
  via repository lookups, never on the domain event itself — so a
  downstream consumer's correlation need never reshapes the domain model.
- **A structural, unimplemented ACL seam for WCS**, rather than either
  leaving the boundary as prose-only or speculatively designing a rich
  equipment command API with no real hardware to validate it against.

## Assumptions

- `wes-work-planning` continues to be the sole producer of `WorkReleased`
  on `warehouse.work-planning.events`, and continues to encode `path_id`,
  `work_unit_id`, and `cpt` in the documented shapes.
- The shared platform broker (in the `warehouse-infra` kind cluster,
  `localhost:9092` from the host) is reachable at `KAFKA_BROKERS`; this
  repository's own `docker-compose.yml` intentionally provisions only
  Postgres.
- `labor-performance` and `order-management` read the same
  `warehouse.fulfillment.events` topic `wes-work-planning` already consumes
  from, each filtering by `event_type` — this service publishes once, to one
  topic, for all three consumers.
- Every `path_id` on `WorkReleased` resolves in the process-path catalogue
  (longest `matchPrefix` wins); an unknown id is a hard error, not a silent
  `PICK` ([ADR-0017](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0017-process-path-catalogue-as-configuration.md)).
- Both outbound HTTP lookups default to `permissive` (no network call); the
  deployed cluster sets the real modes.
- With `EVENT_PUBLISHER=kafka` and a `DATABASE_URL`, published events are
  written to an outbox table in the same transaction as the aggregate and
  relayed to both the integration and analytics topics by an in-process
  relay ([ADR-0020](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0020-transactional-outbox.md)).

## Verification Metrics

| Discipline | Where enforced |
| --- | --- |
| Every invariant has a failing-path unit test | `internal/domain/**/*_test.go` |
| The hexagonal dependency rule is executable, not just documented | `internal/architecture/architecture_test.go` (arch-go, 5 rules) |
| Business rules are readable by non-developers | `features/*.feature`, run by godog |
| Both published contracts (`openapi.yaml`, `asyncapi.yaml`) are linted in CI | Spectral, `api-lint` CI job |
| Mutation testing on the domain | `gremlins`, on the claim/dispatch path |
| Idempotent redelivery on the `WorkReleased` consumer | A unit test feeds the same `event_id` twice and asserts exactly one task exists |

## Open Questions

- **The WCS anti-corruption layer is not built.** `ports.EquipmentCommandPort`
  exists but has no adapter and no callable methods — the boundary is real
  in the type system, but no equipment integration has been scoped yet.
- **The AsyncAPI contract and the live publisher diverge.** `apis/asyncapi.yaml`
  specifies a CloudEvents 1.0 structured envelope on channel
  `warehouse.fulfillment-execution.events`; the running Kafka publisher
  writes the older flat platform envelope to
  `warehouse.fulfillment.events`. Both the channel name and the envelope
  shape differ, and migrating is outstanding work both producer and
  consumer sides would need to do together.
- **No dead-letter queue on the inbound consumer.** A message that fails to
  process is logged and dropped; because idempotency is marked *before*
  task creation, an event whose task creation fails is treated as
  already-processed on redelivery.
- **Nothing schedules the sweeps.** `POST /tasks/expire-leases` and
  `POST /tasks/sweep-cpt-misses` are Clock-driven but externally
  triggered; their cadence is whatever caller invokes them, and
  `TaskCPTMissed` re-fires on every pass while a task stays overdue
  ([ADR-0025](https://github.com/claudioed/fulfillment-execution/blob/develop/docs/docs/adr/0025-cpt-missed-sweep-and-package-manifested.md)).
- **`POST /rebin/arrivals` is on the router but not in `apis/openapi.yaml`**,
  so generated API docs and drift checks cannot see it — a spec gap still
  to close.
- **`AssociateId` on `TaskCompleted` can be stale.** It reflects whichever
  occupant is checked in *at publish time*, not necessarily whoever
  performed the task's entire duration — a worker could check out mid-task
  and a replacement could check in, and the replacement would get
  attributed. Accepted as a known limitation of a best-effort fact.
