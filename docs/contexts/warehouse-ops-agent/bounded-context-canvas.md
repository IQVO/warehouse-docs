---
id: bounded-context-canvas
title: Bounded Context Canvas
sidebar_label: Bounded Context Canvas
description: The full ddd-crew Bounded Context Canvas for warehouse-ops-agent — a read-side analysis context with no aggregate, no Aggregate Design Canvas, and no domain events of its own.
---

# Bounded Context Canvas

Following the [ddd-crew Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas)
template. Read this canvas alongside its
[Open Questions](#open-questions) section first if you are expecting the
usual aggregate-and-events shape every other context in this fleet has —
this one genuinely does not have it, and that absence is documented here
rather than papered over.

## Name

`warehouse-ops-agent`

## Purpose

To correlate read-only signals fanned out from the fleet's upstream
bounded contexts into three products: a synthesized cross-path,
cross-site **DailyBrief** with ranked open exceptions (plus the on-demand
E1 **FlowBalanceException** and ADR 0009 **explain_travel_factor**
correlations), a stitched **Order Lifecycle** read model and WMS/WES
report dashboards serving the operator console's Backend-for-Frontend,
and a **runtime-signals** report classifying each backend service's
Istio error rate / p99 latency (Prometheus) and error-log counts (Loki). It exists so that no
single upstream context is forced to own cross-context correlation logic
that would blur its own boundary, and so the console's one genuinely
cross-cutting screen has a single, coherent home instead of being
assembled client-side.

This agent's outbound MCP **client** surface covers eight bounded
contexts: the five original ones (`inventory-storage`,
`wes-work-planning`, `fulfillment-execution`, `workforce-management`,
`facility-layout`) plus three second-wave clients — `order-management`,
`labor-performance`, `process-path-management` — wired into the
composition root by
[ADR 0007](https://github.com/claudioed/warehouse-ops-agent/blob/develop/docs/docs/adr/0007-second-wave-outbound-mcp-clients.md) but not,
at that point, called by any use case. (`network-fulfillment`, the
fleet's newest context, exposes no MCP server and is not a collaborator
of this agent.) Since
[ADR 0008](https://github.com/claudioed/warehouse-ops-agent/blob/develop/docs/docs/adr/0008-labor-utilization-advisory-correlation.md),
`labor-performance` is a partial exception: `FlowBalanceAdvisory`
(E1) now also calls its `get_task_type_utilization` tool to correlate
observed idleness with queue depth, so `labor-performance` is both a
"wired but unconsumed" entry (its other three tools) and a live,
consumed one (this one tool) at the same time. See
[Outbound Communication](#outbound-communication) below for the honest
distinction between "wired" and "consumed."

## Strategic Classification

| Aspect | Classification |
| --- | --- |
| Domain Role | **Analysis context** (per Alberto Brandolini's Bounded Context Archetypes) — not Core, Supporting, or Generic in the usual sense, because those labels answer "whose aggregate is this and how differentiating is it," and this context owns no aggregate to classify. See [Domain Roles](#domain-roles) below for the justification. |
| Business Model | Not applicable in the usual "revenue driver" sense — this is internal operator tooling. If forced onto the fleet's Core/Supporting/Generic map for cross-context comparison purposes only, the platform's own [Subdomain Classification](/strategic-design/subdomain-classification) places it as **Supporting**: "valuable operationally but owns no domain aggregate of its own." |
| Evolution (Wardley) | Product (rare) / Custom-built. A fleet-specific correlation and BFF layer, not a commodity capability any WMS vendor ships identically. |

## Domain Roles

`warehouse-ops-agent` is deliberately **not classified** alongside the
fleet's Core/Supporting/Generic bounded contexts, because that
classification answers "whose aggregate is this, and how differentiating
is it" — and this repo owns no aggregate at all.

What it actually is, in DDD vocabulary, is closest to a **CQRS read model
that spans context boundaries** plus a **policy** (in the
tactical-pattern sense: a strategy object encoding a business rule) —
not a bounded context of its own in the aggregate-and-invariant sense.
Per Alberto Brandolini's [Bounded Context Archetypes](https://github.com/ddd-crew/bounded-context-canvas),
the closest fit is an **analysis context**: a context whose job is to
observe and synthesize facts other contexts already own, producing a
diagnosis or recommendation rather than protecting an invariant of its
own. The console-BFF part of this repo (`GET
/console/orders/{id}/lifecycle`, `GET /console/reports/*`) is, in the
same vocabulary, a pure **read model** — assembling other contexts'
published facts into a UI-shaped projection, with zero policy layered on
top.

The justification, directly from the source repo's own reasoning:

- It has no aggregate root, no entity with a lifecycle it enforces.
- It has no invariant a domain-layer method rejects an operation over —
  every rejection in its policy layer (`ParseRebalanceAction`,
  `TaskType.Valid()`) is *input validation at an untrusted boundary*, not
  a business invariant about a domain concept this repo owns.
- It persists no state. Restart it and it has forgotten nothing, because
  it never knew anything that wasn't re-derivable from its upstream
  reads.

If a future slice ever needs one of those three things — an aggregate,
an invariant, persisted state — that repo's own ADR-0001 is explicit
that this is the signal the slice belongs in a different repo (or is
itself a new bounded context), not something to smuggle into this one's
policy layer.

## Inbound Communication

| Collaborator | Contract type | Description |
| --- | --- | --- |
| Console browser (`warehouse-console`) | HTTP REST | `GET /daily-brief` — the full synthesized DailyBrief (the console's floor screen polls it). |
| Console browser (`warehouse-console`) | HTTP REST | `GET /console/orders/{id}/lifecycle` — the console-BFF Order Lifecycle read model, stitched from four upstream contexts' REST APIs. |
| Console browser (`warehouse-console`) | HTTP REST | `GET /console/reports/wms`, `GET /console/reports/wes` — dashboard read models fanned out to seven contexts' `/reports/*` analytics endpoints (optional `from`/`to` RFC3339 window, default trailing 24 h). |
| HTTP client (e.g. the `e2e-tests` harness) | HTTP REST | `GET /flow-balance/{pathId}?buildingId=&shiftId=` — the E1 FlowBalanceException correlation for one path, optionally arbitrated by the ADR 0004 LLM reasoner (`LLM_MODE`, default `off`) and enriched by the ADR 0008 utilization overlay. |
| HTTP client | HTTP REST | `GET /explain-travel-factor?pathId=&fromLocationCode=&toLocationCode=` — ADR 0009 travel-distance classification for two REQUIRED, caller-supplied location codes (400 if either is missing). |
| HTTP client | HTTP REST | `GET /runtime-signals` — per-service Istio 5xx rate / p99 latency (Prometheus) plus error-log counts (Loki) over a 10-minute window, classified `normal`/`warning`/`critical`. |
| Platform (probes) | HTTP REST | `GET /healthz`. |
| Agentic/LLM host | MCP tool call (`get_daily_brief`) | Returns the full synthesized DailyBrief. |
| Agentic/LLM host | MCP tool call (`list_open_exceptions`) | Lists open exceptions, optionally filtered by minimum severity (an unknown severity is rejected, never defaulted). |
| Agentic/LLM host | MCP tool call (`get_flow_balance_exception`) | Correlates E1 signals for one `pathId` into a ranked FlowBalanceException. |
| Agentic/LLM host | MCP tool call (`explain_travel_factor`) | Same as the REST route above: classifies a facility-layout travel-distance reading for two caller-supplied location codes; never infers them. |

REST (eight `GET` routes) and MCP (Streamable HTTP at `/mcp`, four tools)
are both **unauthenticated by deliberate decision** — fleet-wide auth was
removed by
[ADR 0006](https://github.com/claudioed/warehouse-ops-agent/blob/develop/docs/docs/adr/0006-fleet-wide-auth-removal.md), superseding the
static-bearer-key design of ADR 0005, and `TestNoAuthMiddlewareReintroduced`
guards against it creeping back. All four MCP tools are annotated
`ReadOnlyHint: true`. This agent's own inbound MCP server has **zero write
tools** — there is no method to call a write even by mistake, because
none exists in the codebase.

## Outbound Communication

Every outbound call this context makes is read-only. There are two
separate outbound adapter families, deliberately not unified — an MCP
client family for the agentic use cases (E1/E2/E3), and a REST client
family for the console-BFF use cases — because they answer different
callers' different questions and hit different endpoints on the same
upstream services.

| Collaborator | Contract type | Relationship pattern | Description |
| --- | --- | --- | --- |
| `order-management` | HTTP REST (`GET /orders/{id}`) | Conformist, read-only | Console-BFF: order header for the Order Lifecycle screen. |
| `inventory-storage` | MCP tool calls (`check_availability`, `get_bin_occupancy`) | Conformist, read-only — **called only by the E2 use case, which is not wired to any inbound adapter** | E2 correlation inputs: usable-stock and bin-occupancy facts. |
| `inventory-storage` | HTTP REST (`GET /reservations?demandRef=`) | Conformist, read-only | Console-BFF: reservation stage of the Order Lifecycle screen. |
| `wes-work-planning` | MCP tool calls (`get_backlog_telemetry`, `get_rebalance_recommendation`) | Conformist, read-only | E3 (`get_backlog_telemetry`) and E1 (`get_rebalance_recommendation`) correlation inputs. |
| `wes-work-planning` | HTTP REST (`GET /work-units?reference=`) | Conformist, read-only | Console-BFF: work-unit stage; also discovers each line's WorkUnit id to key the fulfillment-execution hop. |
| `fulfillment-execution` | MCP tool calls (`get_queue_status`, `find_claimable_work`, `diagnose_stuck_tasks`) | Conformist, read-only | E3 (`get_queue_status`, `diagnose_stuck_tasks`) and E1 (`diagnose_stuck_tasks`) correlation inputs; `find_claimable_work` is implemented on the client but called by no use case. |
| `fulfillment-execution` | HTTP REST (`GET /tasks?orderRef=`) | Conformist, read-only | Console-BFF: task stage, keyed by each WorkUnit's composite id (`<orderId>-line-<lineNo>`), not the plain order id. |
| `workforce-management` | MCP tool calls (`get_staffing_gap`, `propose_path_heads`) | Conformist, read-only | E1/E3 correlation input: `get_staffing_gap` (`propose_path_heads` is implemented but uncalled). No OLTP REST call; its `/reports/labor` feeds the WES dashboard (row below). |
| `facility-layout` | MCP tool calls (`list_sites`, `get_site_layout`, `get_zone_grid`, `estimate_travel_distance`) | Conformist, read-only | E3 daily-brief site grouping (`list_sites`) and, since [ADR 0009](https://github.com/claudioed/warehouse-ops-agent/blob/develop/docs/docs/adr/0009-explain-travel-factor.md), `explain_travel_factor` (`estimate_travel_distance`). `get_site_layout`/`get_zone_grid` are implemented but uncalled. No OLTP REST call; its `/reports/catalog-growth` feeds the WMS dashboard. |
| `order-management`, `inventory-storage`, `wes-work-planning`, `fulfillment-execution`, `workforce-management`, `facility-layout`, `labor-performance` | HTTP REST (`GET /reports/*`, `GET /reports/*/freshness`) | Conformist, read-only | Console-BFF dashboards (`GET /console/reports/wms`, `/wes`): each context's own analytical reports reader, on a separate base URL from its OLTP API. |
| `order-management` | MCP tool call (`get_order`) | Conformist, read-only — **wired, not yet consumed by any use case** | Client and port added in ADR 0007, mirroring the existing `InventoryStorageClient` precedent of wiring an upstream ahead of any consumer. Not called by `DailyBrief`, `FlowBalanceAdvisory`, or the console-BFF's `GET /orders/{id}` REST fan-out above, which is a separate adapter family. |
| `labor-performance` | MCP tool calls (`get_associate_scorecard`, `get_task_type_performance`, `get_labor_standard`, `get_task_type_utilization`) | Conformist, read-only — **`get_task_type_utilization` live and consumed since ADR 0008; the other three remain wired, not yet consumed** | The first three: same ADR 0007 change, full unit-test coverage, zero callers among existing use cases. `get_task_type_utilization`: added in ADR 0008 — `FlowBalanceAdvisory` now calls it and feeds the result into `internal/domain/policy.CorrelateUtilization`, producing an additive `Decision.Utilization` field (`claim_flow_problem`, `starvation`, or `staffing_gap_confirmed`) alongside the existing `wesSignal`. See [Business Context](./business-context.md#what-flow-balance-exception-correlation-means-operationally). |
| `process-path-management` | MCP tool calls (`get_process_path`, `list_process_paths`) | Conformist, read-only — **wired, not yet consumed by any use case** | Same ADR 0007 change. |
| Prometheus / Loki (`warehouse-infra` observability, not bounded contexts) | HTTP (`/api/v1/query`, `/loki/api/v1/query_range`) | Read-only telemetry source | `GET /runtime-signals`: Istio `istio_requests_total` 5xx fraction and `istio_request_duration_milliseconds_bucket` p99 per service, plus error/fatal lines scoped to `RUNTIME_SIGNALS_NAMESPACE`. A failing query (or unset `LOKI_URL`) is listed in `unavailableSources`, never a request failure; unset `PROMETHEUS_URL` falls back to a stub reader (metrics read as zero). |
| Anthropic Messages API (external, optional) | HTTP (tool use) | Behind the policy layer — **off by default** | ADR 0004 LLM reasoner for `GET /flow-balance/{pathId}` only when `LLM_MODE=shadow` or `on` (requires `ANTHROPIC_API_KEY`). The model's only actuators are the allow-listed MCP read tools (`LLM_TOOL_ALLOWLIST`, default the five read tools the deterministic path already uses); the deterministic `policy.Decide` always runs first and is the fallback. |

Every outbound MCP and REST call carries **no credentials** — the upstream
servers are unauthenticated fleet-wide (ADR 0006).

This agent is a **Conformist** on every bounded-context edge: it accepts
each upstream's published shape exactly as given, translates nothing
into a shared model, and has no negotiating power over any of their
contracts — appropriate for a pure read-side aggregator that must never
become a reason an upstream context can't evolve its own API.

## Ubiquitous Language

See [Ubiquitous Language](./ubiquitous-language.md) for the full glossary
— the terms this agent coins for its own correlation policies
(`DailyBrief`, `FlowBalanceException`, `StrandedReservation`,
`OpenException`, `Evidence trail`, `Blast radius`, `Partial` /
`MissingSignals`, `PathTarget`, `TravelFactorCorrelation`,
`RuntimeSignalsReport`, `Recommended action`) and the terms it borrows
unredefined from its upstream contexts.

## Business Decisions

- **Each fan-out stage degrades independently.** One upstream context
  being unreachable never fails the whole response — the affected
  path's brief (or exception decision, or console-BFF stage, or
  dashboard section) is marked absent/`Partial` with its
  `MissingSignals` listed, never a 500 for the whole request. This is
  the same pattern applied consistently across all three products in
  this repo: the agentic use cases (E1/E2/E3), the Order Lifecycle
  read model, and the report dashboards.
- **Zero write tools, by construction, not by runtime check.** This
  agent's outbound adapters implement only the upstream contexts' *read*
  ports — there is no `AssignLabor`, `ReleaseNextWork`, or
  `RevokeReservation` method anywhere in the codebase to call even by
  mistake — and `internal/architecture/zerowrite/zerowrite_test.go` fails
  CI if an outbound client gains a mutating HTTP method or an inbound MCP
  tool is registered without `ReadOnlyHint: true`. The same discipline that keeps "no cross-repo Go dependency"
  a property `go.mod` enforces by construction is applied to the write
  surface: nothing exists to misuse.
- **Correlate, don't alert on one metric.** The daily-brief rule flags a
  path as an open exception only when two or more independent signals
  fire together; a single reading alone is ordinary operating noise.
- **Untrusted input is validated, never defaulted.** Every enum value
  read back from an upstream tool response is checked against a closed
  set; an unrecognized value is rejected with an error, never silently
  coerced.
- **A write recommendation is never returned without its blast radius.**
  The `revoke_reservation` recommendation is unreachable without
  `inventory-storage.get_bin_occupancy`'s reading already in hand — the
  blast-radius readout is a precondition of the recommendation existing,
  not an optional enrichment.
- **The console-BFF fan-out uses each downstream's actual join key,
  verified against producer code, not assumed from field-name
  similarity** — notably that `fulfillment-execution`'s task is keyed by
  each WorkUnit's derived composite id, not the plain order id.
- **This agent writes to a bounded context only through that context's
  own already-published write MCP tool, never around it** — a rule
  recorded ahead of any write capability actually existing, so that when
  a write-capable slice lands it inherits two already-decided guardrails:
  a **re-introduced authorization gate** distinguishing read-only from
  write-capable callers (the old static-bearer read/read-write scopes were
  removed fleet-wide by ADR 0006, so the act slice must pick a replacement
  mechanism) and mandatory human confirmation before the write executes.
- **Model output never bypasses the policy layer.** The ADR 0004 LLM
  reasoner is off by default; when enabled, it may only call allow-listed
  MCP read tools and answer through a `submit_plan` schema that
  `policy.ValidatePlan` checks against the closed action vocabulary. An
  unrecognized `LLM_MODE` is a startup error, never a silent `off`.
- **Never infer a fact there is no evidence for.** `explain_travel_factor`
  (ADR 0009) requires both location codes from the caller, because no
  published tool anywhere in the fleet binds a stuck task or path to two
  location codes.

## Assumptions

- The upstream contexts' MCP Open Host Services and REST APIs
  remain stable, read-only-safe integration points that this agent can
  poll synchronously at request time without needing its own database.
- The upstream enums this agent hand-mirrors (`RebalanceAction`,
  `TaskType`, and so on) stay in sync with the owning context's own
  definitions; a drift would surface as a validation rejection here, not
  a silent misinterpretation.
- Deployment-time `PathTarget` configuration correctly binds each
  upstream context's own naming for "the same" process path; this
  binding is never inferred by the policy layer.
- The console (`warehouse-console`) is the only consumer of the
  console-BFF routes, and an agentic/LLM host is the only consumer of
  the MCP routes — the two use-case families are not expected to
  converge.
- Prometheus and Loki (from `warehouse-infra`'s observability stack)
  remain reachable for `GET /runtime-signals`; if not, the report
  degrades per source rather than failing.

## Verification Metrics

- **Zero cross-repo Go imports** on any upstream context —
  enforced for the five original contexts' module paths by
  `internal/architecture/architecture_test.go`'s
  `TestNoDirectDependencyOnBoundedContexts`, which fails the build if one
  is ever introduced.
- **Zero write capability**, CI-enforced by
  `internal/architecture/zerowrite/zerowrite_test.go`
  (`TestNoMutatingHTTPMethodInOutboundClients`,
  `TestNoMutatingToolAnnotationInMCPServer`): all four inbound MCP tools
  must be `mcp.ToolAnnotations{ReadOnlyHint: true}`.
- **No auth middleware reintroduced** — `TestNoAuthMiddlewareReintroduced`
  (`internal/architecture/fitness_test.go`) keeps the ADR 0006 removal
  honest.
- **Tier-1 metrics only** — per
  [ADR 0010](https://github.com/claudioed/warehouse-ops-agent/blob/develop/docs/docs/adr/0010-standard-metrics-convention.md), this agent
  carries the fleet's mandatory runtime + HTTP RED baseline but is exempt
  from Tier-2 business metrics (no aggregate to measure against).
- **A decision is never returned without at least one evidence entry** —
  every `Decision`, `StrandedReservationException`, and `OpenException`
  this agent's policy layer produces carries a non-empty evidence trail;
  this is a structural property of the return type, not a lint rule.
- **`Partial`/`MissingSignals` correctness**: when an upstream MCP or
  REST call fails, the affected brief/exception/stage is marked
  `Partial`/absent rather than the request failing outright — exercised
  by this repo's own unit tests simulating upstream unavailability.
- **`make check` / `make check-all`**: the same fast pre-commit bundle
  (fmt-check, vet, build, lint, test) and pre-push coverage (90% gate) +
  architecture-test gate every sibling context in the fleet runs, plus
  `make mutation-fast` (gremlins over `./internal/domain`) as CI's
  blocking mutation job.

## Open Questions

- **Two of three outbound MCP clients wired in ADR 0007 remain genuinely
  unconsumed; the third graduated in ADR 0008.**
  `order-management` and `process-path-management` clients exist in the
  composition root (`internal/adapters/outbound/mcpclient/`), each with a
  typed port interface and full unit-test coverage, since ADR 0007.
  Neither is called by `DailyBrief`, `FlowBalanceAdvisory`, or any
  other existing use case — this documentation pass states that plainly
  rather than implying a T2/T3-style order-lifecycle correlation or
  process-path-aware routing decision already consumes them. The same
  tradeoff the pre-existing `InventoryStorageClient` precedent already
  accepted: two more Go types and two more env vars exist with no current
  caller. `labor-performance`'s client is the exception: ADR 0008
  wired `GetTaskTypeUtilization` into `FlowBalanceAdvisory`, so that
  one specific method is now live and consumed — the other three methods
  on the same client (`get_associate_scorecard`, `get_task_type_performance`,
  `get_labor_standard`) remain unconsumed.
- **StrandedReservation (E2) is a disclosed, real gap.** Its policy
  (`internal/domain/policy.Evaluate`) and application-layer use case
  (`internal/application/usecases.stranded_reservation.go`) exist and are
  covered by unit tests, but **neither is wired to any inbound
  adapter** — there is no REST route and no MCP tool exposing it yet.
  Wiring it to a route and a tool mirroring `get_flow_balance_exception`'s
  shape is open follow-up work, not something this documentation pass
  should imply is shipped.
- **Why this context has no Aggregate Design Canvas.** Every other
  bounded context in this fleet's docs carries an Aggregate Design
  Canvas for its primary aggregate. `warehouse-ops-agent` does not,
  deliberately: it owns no aggregate to design a canvas for. Its own
  read models (the DailyBrief, the FlowBalanceException, the Order
  Lifecycle projection) are not its own domain state reaching a
  consistency boundary — they are ad hoc, in-memory correlations of
  **other contexts'** already-published facts, recomputed fresh on every
  request and forgotten immediately after. There is no state to model
  transitions or invariants over.
- **Why this context has no Domain Events or AsyncAPI page.** This agent
  has no Kafka integration at all — it reads exclusively via synchronous
  MCP tool calls, REST calls, and Prometheus/Loki queries at request
  time. It does not subscribe to any upstream context's domain events,
  and it publishes none of its own. (`internal/adapters/outbound/telemetry`
  is now a real Prometheus HTTP API reader backing `GET /runtime-signals`,
  with a stub fallback when `PROMETHEUS_URL` is unset — a read of
  telemetry, not an event stream.) A Domain Events page or generated
  AsyncAPI reference would therefore describe capabilities that do not
  exist; this canvas records that absence here instead.
- **`explain_travel_factor` cannot resolve location codes itself.** Per
  ADR 0009, no published tool in the fleet binds a slow path's work to
  two location codes (fulfillment-execution's `Station.locationCode` is
  persisted but not published on any MCP tool), so the caller must supply
  both. Automatic resolution is deferred until such a tool exists.
- **The console-BFF's report-dashboard fan-out is sequential vs.
  concurrent, inconsistently, by deliberate choice.** The Order
  Lifecycle fan-out is sequential (each hop's join key depends on the
  previous one); the report-dashboard fan-out is concurrent (the 3–4
  calls per dashboard are independent). Whether this asymmetry should
  ever be unified, or is simply correct as two different shapes for two
  different data-dependency graphs, is left open.
- **Local-dev port assignments for the seven `*-reports` binaries are
  proposed by this repo but not yet adopted fleet-wide** — propagating
  them into `e2e-tests/env.sh` and each sibling repo's
  `docker-compose.yml` is out of scope for a BFF-side change and remains
  unresolved.
- **No caching on the console-BFF routes.** Every dashboard or lifecycle
  load re-fans-out to every upstream on every request. Cheap today
  because upstreams serve pre-aggregated projections; whether a
  short-TTL cache becomes necessary is an open, deferred question.
