---
id: index
title: Vendor Connectivity
sidebar_label: Vendor Connectivity
description: "The network's Open Host Service for vendors: a Supporting partner-tier context that publishes the Vendor API, issues purchase orders to vendor nodes and runs the acknowledgement protocol and its clock."
---

# Vendor Connectivity

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
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
| [Business Context](/contexts/vendor-connectivity/business-context) | The problem, the actors, the decisions, what is out of scope | — |
| [Ubiquitous Language](/contexts/vendor-connectivity/ubiquitous-language) | Terms, code identifiers, and the fleet translation table | — |
| [Core Domain Chart](/contexts/vendor-connectivity/core-domain-chart) | Why this context is Supporting | [core-domain-charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/contexts/vendor-connectivity/bounded-context-canvas) | Purpose, roles, inbound and outbound messages, decisions | [bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/contexts/vendor-connectivity/context-map) | Every neighbour with direction and pattern | [context-mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/contexts/vendor-connectivity/aggregate-design-canvas) | `VendorAccount`, `PurchaseOrder`, `Submission` | [aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/contexts/vendor-connectivity/domain-events) | Eight published events, seven consumed | — |
| [Domain Message Flow](/contexts/vendor-connectivity/domain-message-flow) | Happy path, refusal, node onboarding, failed transaction | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/contexts/vendor-connectivity/eventstorming) | Process-level boards with hotspots | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/contexts/vendor-connectivity/use-cases) | One section per command, errors mapped to HTTP | — |
| [Class Diagram](/contexts/vendor-connectivity/class-diagram) | Proposed domain types and the hexagonal layout | — |
| [Entity Relationship](/contexts/vendor-connectivity/entity-relationship) | Proposed Postgres schema | — |
| [Sequence Diagrams](/contexts/vendor-connectivity/sequence-diagrams) | One runtime sequence per command | — |

## Elsewhere

- The Vendor API contract: `apis/vendor-connectivity/openapi.yaml`,
  rendered under [API reference](/api-reference). The protocol in prose is
  on [Vendor API](/integration/vendor-api).
- How the fleet meets this API:
  [WMS/WES integration](/integration/wms-wes-integration) and
  [Fleet changes](/integration/fleet-changes).
- Decisions: [ADR 0005, vendor acceptance is the path lock](/adr/0005-vendor-acceptance-is-the-path-lock),
  [ADR 0006, PII confinement](/adr/0006-pii-confinement),
  [ADR 0003, declared and measured capability](/adr/0003-declared-and-measured-capability),
  [ADR 0004, parcel nodes are network-operated](/adr/0004-parcel-nodes-are-network-operated).
- Where the context sits among the ten: [Context Map](/strategic-design/context-map).
