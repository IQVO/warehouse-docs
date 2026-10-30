---
id: index
title: Seller Inbound
sidebar_label: Seller Inbound
description: "The Supporting partner-tier context where sellers plan, pack, label and ship stock to vendor nodes, including case-packed master cartons identified by SSCC."
---

# Seller Inbound

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built ([`IQVO/seller-inbound`](https://github.com/IQVO/seller-inbound), designed by [ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses. Where the model left a choice open, the service's own ADRs 0002 to 0005 record what it does.
:::

<span className="badge-supporting">Supporting</span>

**Seller Inbound** (`seller-inbound`, code `SI`, tier `partner`) is the
front door for stock that **sellers** send to the network. A seller
declares an **inbound plan** in eaches, packs it into **cartons** that each
carry an **SSCC** and a printed label, and ships it to a vendor node. Cartons
may be **case-packed** (a *master carton* holding one item at the quantity of
its declared case level) or *mixed*. The context checks each plan against the
destination node's declared inbound limits and the item's packaging
hierarchy, hands the vendor a carton manifest through the Vendor API, and
closes the shipment from the vendor's carton-level receipt, recording every
discrepancy instead of correcting it. Stock stays owned by its seller
(`ownerRef`). The warehouse-systems fleet never talks to this context: the
Vendor API of `vendor-connectivity` remains the only channel.

## Pages

| Page | What it covers | ddd-crew tool |
| --- | --- | --- |
| [Business Context](/network/contexts/seller-inbound/business-context) | The problem, the actors, the decisions, what is out of scope | — |
| [Ubiquitous Language](/network/contexts/seller-inbound/ubiquitous-language) | Terms (each, case pack, master carton, GTIN, SSCC...) and code identifiers | — |
| [Core Domain Chart](/network/contexts/seller-inbound/core-domain-chart) | Why this context is Supporting | [core-domain-charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/network/contexts/seller-inbound/bounded-context-canvas) | Purpose, roles, inbound and outbound messages, decisions | [bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/network/contexts/seller-inbound/context-map) | Every neighbour with direction and pattern | [context-mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/network/contexts/seller-inbound/aggregate-design-canvas) | `SellerAccount`, `InboundPlan`, `InboundShipment` with `Carton` | [aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/network/contexts/seller-inbound/domain-events) | Nine published events, eight consumed | — |
| [Domain Message Flow](/network/contexts/seller-inbound/domain-message-flow) | Case-packed happy path, discrepancy, SSCC issuance | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/network/contexts/seller-inbound/eventstorming) | Process-level boards with hotspots | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/network/contexts/seller-inbound/use-cases) | One section per command, errors mapped to HTTP | — |
| [Class Diagram](/network/contexts/seller-inbound/class-diagram) | Domain types (design pack; packages as built are listed on the aggregate canvas) | — |
| [Entity Relationship](/network/contexts/seller-inbound/entity-relationship) | The as-built Postgres schema (migrations 0001 and 0002) | — |
| [Sequence Diagrams](/network/contexts/seller-inbound/sequence-diagrams) | One runtime sequence per key command | — |

## Service and operations

- **Service:** [`IQVO/seller-inbound`](https://github.com/IQVO/seller-inbound) on `develop` (`3a23fb2`,
  2026-10-26): binaries `cmd/api` (REST) and `cmd/mcp` (read-only MCP), and the console
  remote in `web/`.
- **Deployment:** wired in warehouse-infra develop: a `terraform/apps.yaml` entry
  (`database: true`, `frontend_remote: seller_inbound_mfe`) and `helm-values/seller-inbound.yaml`
  (MCP enabled, gateway path `/api/mcp/seller-inbound`). The cluster itself was not checked in this
  refresh.
- **Observability:** [service ADR 0008](https://github.com/IQVO/seller-inbound/blob/develop/docs/adr/0008-fleet-observability-standard.md),
  *Adopt the fleet observability standard*, Accepted 2026-10-26. Logs, metrics and traces leave
  over OTLP to the otel-collector (`OTEL_EXPORTER_OTLP_ENDPOINT`, chart default
  `otel-collector.observability.svc.cluster.local:4317`; `OTEL_SERVICE_NAME`). The Tier-2
  business counter is `seller_inbound.shipment.shipped` (unit `{shipment}`, in
  `internal/adapters/outbound/telemetry/shipment_metrics.go`), with attribute `outcome` = `shipped` or `rejected` and
  `reason` on the outcomes that are not a success. The dashboard queries it as `seller_inbound_shipment_shipped_total` in warehouse-infra's
  `terraform/dashboards/contexts/seller-inbound.json`, by `outcome`.

## Elsewhere

- The decision: [ADR 0009, seller inbound and case-packed shipments](/network/adr/0009-seller-inbound-and-case-packed-shipments).
- The vendor-facing half of this flow: `GET /vendor/inbound-shipments` and
  `POST /vendor/inbound-receipts` in the Vendor API, rendered under
  [API reference](/network/api-reference) and described on
  [Vendor API](/network/integration/vendor-api).
- What this design does not solve:
  [Model gap register](/network/strategic-design/model-gap-register), G41 to G55.
- The seller-facing REST contract (as built, from the service repository):
  `network/apis/seller-inbound/openapi.yaml`, rendered under the
  [API reference](/network/api-reference): 14 operations, including
  `GET /inbound-plans/{planId}` and the informational
  `GET /sellers/{sellerId}/scorecard` (service ADR 0005).
- Read-only MCP server (service ADR 0006): `cmd/mcp`, a second binary serving Streamable HTTP
  on `:8090` with no auth; it sources this context's own reads and nothing that writes. Four
  tools: `get_inbound_plan`, `get_inbound_shipment`, `get_seller_scorecard`,
  `get_shipment_labels`. The gateway (Kong) exposes it at `/api/mcp/seller-inbound`.
- Console remote (service ADR 0007): `web/`, a Vite + React Module Federation remote —
  federation container `seller_inbound_mfe`, gateway mount `/mfes/seller-inbound/`,
  dev/preview port `4022`.
- Where the context sits among the eleven: [Context Map](/network/strategic-design/context-map).
