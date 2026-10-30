---
id: index
title: Linehaul Transportation
sidebar_label: Linehaul Transportation
description: The middle mile of the retail network, a proposed Supporting context that turns lanes into scheduled departures, keeps their package capacity and consolidates packages into loads.
---

# Linehaul Transportation

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

<span className="badge-supporting">Supporting</span>

**Linehaul Transportation** (`linehaul-transportation`, code `LH`, tier
`logistics`) runs the **middle mile**: transport between nodes, from a vendor
fulfillment node to a sortation centre, between sortation centres and air
hubs, and on to a delivery station. A lane, owned by `node-topology`, is
static: it says two nodes are connected and how long the trip nominally
takes. This context turns lanes into **scheduled departures**, which are
dynamic: each has a cutoff, a departure and arrival time and a package
capacity that can change days ahead. For every declared cutoff of every
`ACTIVE` vendor fulfillment node it schedules one **pickup departure** per
operating day (policy `PickupFromCutoffs`). That is how a vendor's declared
cutoff becomes the network's real pickup, and the `shipBy` the promise uses.
It keeps `booked <= capacity` on every departure, consolidates packages at
sortation centres into **loads**, and reports when loads depart and arrive:
`LoadArrived` at a delivery station feeds last-mile induction, and
`DepartureCancelled` feeds re-promising in `delivery-promise`.

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/network/contexts/linehaul-transportation/business-context) | The problem, the actors, the decisions, what is out of scope | — (narrative) |
| [Ubiquitous Language](/network/contexts/linehaul-transportation/ubiquitous-language) | Departure, Pickup Departure, Load, Lane Schedule, Middle Mile and the neighbour terms used here | — (glossary) |
| [Core Domain Chart](/network/contexts/linehaul-transportation/core-domain-chart) | Why this context is Supporting | [core-domain-charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/network/contexts/linehaul-transportation/bounded-context-canvas) | Purpose, classification, roles, every inbound and outbound message | [bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas) v5 |
| [Context Map](/network/contexts/linehaul-transportation/context-map) | Every upstream and downstream neighbour with its pattern and channel | [context-mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/network/contexts/linehaul-transportation/aggregate-design-canvas) | `Departure`, `LaneSchedule` and `Load`: states, invariants, commands, events | [aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas) v1.1 |
| [Domain Events](/network/contexts/linehaul-transportation/domain-events) | The eight published and twelve consumed events, with full CloudEvents types | — (event catalogue) |
| [Domain Message Flow](/network/contexts/linehaul-transportation/domain-message-flow) | Cutoff to pickup, booking on lock, load to station, cancellation | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/network/contexts/linehaul-transportation/eventstorming) | Process-level boards with hotspots | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/network/contexts/linehaul-transportation/use-cases) | One section per command: trigger, adapter, flow, errors, events | — (application layer) |
| [Class Diagram](/network/contexts/linehaul-transportation/class-diagram) | Proposed domain types and the hexagonal ports and adapters | — (UML) |
| [Entity Relationship](/network/contexts/linehaul-transportation/entity-relationship) | Proposed Postgres schema | — (ER) |
| [Sequence Diagrams](/network/contexts/linehaul-transportation/sequence-diagrams) | One runtime sequence per command use case | — (UML) |

The REST contract is `apis/linehaul-transportation/openapi.yaml`, rendered
under [API reference](/network/api-reference).

## Service and operations

- **Service:** [`IQVO/linehaul-transportation`](https://github.com/IQVO/linehaul-transportation) on `develop` (`e752832`,
  2026-10-26): binaries `cmd/api` (REST) and `cmd/mcp` (read-only MCP), and the console
  remote in `web/`.
- **Deployment:** wired in warehouse-infra develop: a `terraform/apps.yaml` entry
  (`database: true`, `frontend_remote: linehaul_mfe`) and `helm-values/linehaul-transportation.yaml`
  (MCP enabled, gateway path `/api/mcp/linehaul-transportation`). The cluster itself was not checked in this
  refresh.
- **Observability:** [service ADR 0010](https://github.com/IQVO/linehaul-transportation/blob/develop/docs/adr/0010-fleet-observability-standard.md),
  *Adopt the fleet observability standard*, Accepted 2026-10-26. Logs, metrics and traces leave
  over OTLP to the otel-collector (`OTEL_EXPORTER_OTLP_ENDPOINT`, chart default
  `otel-collector.observability.svc.cluster.local:4317`; `OTEL_SERVICE_NAME`). The Tier-2
  business counter is `linehaul.loads.dispatched` (unit `{load}`, in
  `internal/adapters/outbound/telemetry/load_metrics.go`), with attribute `outcome` = `dispatched` or `rejected` and
  `reason` on the outcomes that are not a success. The dashboard queries it as `linehaul_loads_dispatched_total` in warehouse-infra's
  `terraform/dashboards/contexts/linehaul-transportation.json`, by `outcome`.

## Elsewhere

- Read-only MCP server (service ADR 0008): `cmd/mcp`, a second binary serving Streamable HTTP
  on `:8090` with no auth; it sources this context's own reads and nothing that writes. Two
  tools: `get_departure`, `list_departures`. The gateway (Kong) exposes it at
  `/api/mcp/linehaul-transportation`, rewritten to the server's `/mcp` mount.
- Console remote (service ADR 0009): `web/`, a Vite + React Module Federation remote —
  federation container `linehaul_mfe`, gateway mount `/mfes/linehaul-transportation/`,
  dev/preview port `4015` — read-only screens over the existing REST reads, calling only this
  context's API.
- [Strategic context map](/network/strategic-design/context-map) and
  [subdomain classification](/network/strategic-design/subdomain-classification).
- [Node model](/network/network-model/node-model) (lanes and node types) and
  [promise model](/network/network-model/promise-model) (how departures become a
  witness path).
- [ADR 0008: capacity held at promise time](/network/adr/0008-capacity-held-at-promise-time)
  and [ADR 0004: parcel nodes are network-operated](/network/adr/0004-parcel-nodes-are-network-operated).
