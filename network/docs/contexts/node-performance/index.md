---
id: index
title: Node Performance
sidebar_label: Node Performance
description: The Supporting context that grades every node from observed facts over 7-day and 30-day windows, never from what the vendor declared.
---

# Node Performance

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

<span class="badge-supporting">Supporting</span>

**Node Performance** (`node-performance`, code `NP`, tier `partner`) measures
every node against what was asked of it. It listens to observed facts only:
purchase orders issued, accepted, rejected and expired, shipments confirmed,
packages handed over against `requiredShipBy`, promises kept or broken, and
inventory feeds applied. From them it computes, per node and per rolling
window (7 days and 30 days), an on-time handover rate, a late
acknowledgement rate, a reject rate, an expiry rate, a promise-kept rate and
the p95 feed freshness, and grades the node `A` to `D`. Below the
observation minimum the scorecard stays `PROVISIONAL`. The grade feeds
`delivery-promise`'s handicap and `order-sourcing`'s assignment cost through
the `NodeScorecardUpdated` event. This context never suspends a node and
never reads the vendor's declaration into a metric: the declaration is what
the vendor says, the scorecard is what the network observes
([ADR 0003](/network/adr/0003-declared-and-measured-capability)). Vendors see their
own scorecard only through `vendor-connectivity`
(`GET /vendor/nodes/{nodeId}/scorecard`), which calls this context's
`GET /scorecards/{nodeId}`.

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/network/contexts/node-performance/business-context) | The business problem, actors, decisions and what is out of scope | (narrative; feeds the canvas) |
| [Ubiquitous Language](/network/contexts/node-performance/ubiquitous-language) | Scorecard, Grade, On-Time Handover Rate, Late Ack Rate, Declared vs Measured, plus neighbour terms | [Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas) (Ubiquitous Language section) |
| [Core Domain Chart](/network/contexts/node-performance/core-domain-chart) | Why this context is Supporting | [core-domain-charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/network/contexts/node-performance/bounded-context-canvas) | Purpose, classification, roles, inbound and outbound messages, decisions, assumptions, metrics, open questions | [bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas) v5 |
| [Context Map](/network/contexts/node-performance/context-map) | Every upstream and downstream neighbour with its pattern and channel | [context-mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/network/contexts/node-performance/aggregate-design-canvas) | The `NodeScorecard` aggregate | [aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas) v1.1 |
| [Domain Events](/network/contexts/node-performance/domain-events) | The 2 published and 13 consumed CloudEvents types | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) (message catalogue) |
| [Domain Message Flow](/network/contexts/node-performance/domain-message-flow) | Scenarios as commands, events and queries across contexts | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/network/contexts/node-performance/eventstorming) | Process-level boards with policies, read models and hotspots | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/network/contexts/node-performance/use-cases) | `RecordObservation` and `Recompute`, their errors and idempotency | (application layer; complements the aggregate canvas) |
| [Class Diagram](/network/contexts/node-performance/class-diagram) | The proposed domain model and its hexagonal ports and adapters | (UML; complements the aggregate canvas) |
| [Entity Relationship](/network/contexts/node-performance/entity-relationship) | The proposed Postgres schema | (persistence view; complements the aggregate canvas) |
| [Sequence Diagrams](/network/contexts/node-performance/sequence-diagrams) | Adapter → use case → aggregate → outbox → Kafka per use case | (UML; complements the message flow) |

The REST contract is `apis/node-performance/openapi.yaml` in the repository
root: two read-only routes, `GET /scorecards/{nodeId}` and
`GET /scorecards?grade=`.

## Service and operations

- **Service:** [`IQVO/node-performance`](https://github.com/IQVO/node-performance) on `develop` (`22497b7`,
  2026-10-26): binaries `cmd/api` (REST) and `cmd/mcp` (read-only MCP), and the console
  remote in `web/`.
- **Deployment:** wired in warehouse-infra develop: a `terraform/apps.yaml` entry
  (`database: true`, `frontend_remote: node_performance_mfe`) and `helm-values/node-performance.yaml`
  (MCP enabled, gateway path `/api/mcp/node-performance`). The cluster itself was not checked in this
  refresh.
- **Observability:** [service ADR 0010](https://github.com/IQVO/node-performance/blob/develop/docs/adr/0010-fleet-observability-standard.md),
  *Adopt the fleet observability standard*, Accepted 2026-10-26. Logs, metrics and traces leave
  over OTLP to the otel-collector (`OTEL_EXPORTER_OTLP_ENDPOINT`, chart default
  `otel-collector.observability.svc.cluster.local:4317`; `OTEL_SERVICE_NAME`). The Tier-2
  business counter is `nodeperformance.scorecards.recomputed` (unit `{scorecard}`, in
  `internal/adapters/outbound/telemetry/scorecard_metrics.go`), with attribute `outcome` = `recomputed` or `failed` and
  `reason` on the outcomes that are not a success. The dashboard queries it as `nodeperformance_scorecards_recomputed_total` in warehouse-infra's
  `terraform/dashboards/contexts/node-performance.json`, by `outcome`.

## Elsewhere

- Read-only MCP server (service ADR 0007): `cmd/mcp`, a second binary serving Streamable HTTP
  on `:8090` with no auth; it sources this context's own reads and nothing that writes. Two
  tools: `get_scorecard`, `list_scorecards_by_grade`. The gateway (Kong) exposes it at
  `/api/mcp/node-performance`, rewritten to the server's `/mcp` mount.
- Console remote (service ADR 0008): `web/`, a Vite + React Module Federation remote —
  federation container `node_performance_mfe`, gateway mount `/mfes/node-performance/`,
  dev/preview port `4016` — read-only screens over the existing REST reads, calling only this
  context's API.
- [Domain vision](/network/strategic-design/domain-vision) and the network-wide
  [Context Map](/network/strategic-design/context-map).
- [ADR 0003: capability is declared and measured](/network/adr/0003-declared-and-measured-capability):
  why the scorecard sits next to the operational profile and never replaces it.
- [Promise model](/network/network-model/promise-model) and
  [Order assignment model](/network/network-model/order-assignment-model): where the
  grade is used.
- [Vendor API](/network/integration/vendor-api): how a vendor reads its own scorecard.
