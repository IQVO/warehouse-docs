---
id: index
title: Vendor Connectivity
sidebar_label: Vendor Connectivity
description: "The network's Open Host Service for vendors: a Supporting partner-tier context that publishes the Vendor API, issues purchase orders to vendor nodes and runs the acknowledgement protocol and its clock."
---

# Vendor Connectivity

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

<span className="badge-supporting">Supporting</span>

**Vendor Connectivity** (`vendor-connectivity`, code `VC`, tier `partner`)
is the retail network's **Open Host Service** for the vendors that operate
its fulfillment nodes. It publishes the **Vendor API**, whose JSON schemas
are the **Published Language**: vendors register nodes, declare their
operational profile, send inventory feeds, poll purchase orders,
acknowledge each one in full before `ackBy`, request labels and confirm
shipment. Every asynchronous write returns `202` with a `transactionId`
that the vendor reconciles. Inside the network the context turns an
order-sourcing release into a **PurchaseOrder**, runs its clock, and
reports the vendor's answer back as events. The warehouse-systems fleet is
vendor `V-WS`; its `network-fulfillment` context calls this API as a
Conformist with an Anti-Corruption Layer, and this API is the only channel
between the two organizations.

## Pages

| Page | What it covers | ddd-crew tool |
| --- | --- | --- |
| [Business Context](/network/contexts/vendor-connectivity/business-context) | The problem, the actors, the decisions, what is out of scope | — |
| [Ubiquitous Language](/network/contexts/vendor-connectivity/ubiquitous-language) | Terms, code identifiers, and the fleet translation table | — |
| [Core Domain Chart](/network/contexts/vendor-connectivity/core-domain-chart) | Why this context is Supporting | [core-domain-charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/network/contexts/vendor-connectivity/bounded-context-canvas) | Purpose, roles, inbound and outbound messages, decisions | [bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/network/contexts/vendor-connectivity/context-map) | Every neighbour with direction and pattern | [context-mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/network/contexts/vendor-connectivity/aggregate-design-canvas) | `VendorAccount`, `PurchaseOrder`, `Submission` | [aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/network/contexts/vendor-connectivity/domain-events) | Eleven published events, eleven consumed, including the proposed inbound ones ([ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)) | — |
| [Domain Message Flow](/network/contexts/vendor-connectivity/domain-message-flow) | Happy path, refusal, node onboarding, failed transaction | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/network/contexts/vendor-connectivity/eventstorming) | Process-level boards with hotspots | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/network/contexts/vendor-connectivity/use-cases) | One section per command, errors mapped to HTTP | — |
| [Class Diagram](/network/contexts/vendor-connectivity/class-diagram) | Proposed domain types and the hexagonal layout | — |
| [Entity Relationship](/network/contexts/vendor-connectivity/entity-relationship) | Proposed Postgres schema | — |
| [Sequence Diagrams](/network/contexts/vendor-connectivity/sequence-diagrams) | One runtime sequence per command | — |

## Service and operations

- **Service:** [`IQVO/vendor-connectivity`](https://github.com/IQVO/vendor-connectivity) on `develop` (`0253f45`,
  2026-10-26): binaries `cmd/api` (REST) and `cmd/mcp` (read-only MCP), and the console
  remote in `web/`.
- **Deployment:** wired in warehouse-infra develop: a `terraform/apps.yaml` entry
  (`database: true`, `frontend_remote: vendor_connectivity_mfe`) and `helm-values/vendor-connectivity.yaml`
  (MCP enabled, gateway path `/api/mcp/vendor-connectivity`). The cluster itself was not checked in this
  refresh.
- **Observability:** [service ADR 0008](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0008-fleet-observability-standard.md),
  *Adopt the fleet observability standard*, Accepted 2026-10-26. Logs, metrics and traces leave
  over OTLP to the otel-collector (`OTEL_EXPORTER_OTLP_ENDPOINT`, chart default
  `otel-collector.observability.svc.cluster.local:4317`; `OTEL_SERVICE_NAME`). The Tier-2
  business counter is `vendor.submissions.processed` (unit `{submission}`, in
  `internal/adapters/outbound/telemetry/submission_metrics.go`), with attribute `outcome` = `succeeded` or `failed` and
  `reason` on the outcomes that are not a success. The dashboard queries it as `vendor_submissions_processed_total` in warehouse-infra's
  `terraform/dashboards/contexts/vendor-connectivity.json`, by `outcome`.

## Elsewhere

- Read-only MCP server (service ADR 0006): `cmd/mcp`, a second binary serving Streamable HTTP
  on `:8090` with no auth; it sources this context's own reads and nothing that writes. Nine
  tools: `get_inbound_shipment`, `get_node_scorecard`, `get_purchase_order`,
  `get_transaction`, `get_vendor`, `get_vendor_node`, `list_vendor_nodes`,
  `poll_inbound_shipments`, `poll_purchase_orders`. The gateway (Kong) exposes it at
  `/api/mcp/vendor-connectivity`, rewritten to the server's `/mcp` mount.
- Console remote (service ADR 0007): `web/`, a Vite + React Module Federation remote —
  federation container `vendor_connectivity_mfe`, gateway mount `/mfes/vendor-connectivity/`,
  dev/preview port `4021` — read-only screens over the existing REST reads, calling only this
  context's API.
- The Vendor API contract: `apis/vendor-connectivity/openapi.yaml`,
  rendered under [API reference](/network/api-reference). The protocol in prose is
  on [Vendor API](/network/integration/vendor-api).
- How the fleet meets this API:
  [WMS/WES integration](/network/integration/wms-wes-integration) and
  [Fleet changes](/network/integration/fleet-changes).
- Decisions: [ADR 0005, vendor acceptance is the path lock](/network/adr/0005-vendor-acceptance-is-the-path-lock),
  [ADR 0006, PII confinement](/network/adr/0006-pii-confinement),
  [ADR 0003, declared and measured capability](/network/adr/0003-declared-and-measured-capability),
  [ADR 0004, parcel nodes are network-operated](/network/adr/0004-parcel-nodes-are-network-operated).
- Where the context sits among the eleven: [Context Map](/network/strategic-design/context-map).
