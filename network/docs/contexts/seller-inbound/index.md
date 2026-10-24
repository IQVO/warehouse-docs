---
id: index
title: Seller Inbound
sidebar_label: Seller Inbound
description: "The proposed Supporting partner-tier context where sellers plan, pack, label and ship stock to vendor nodes, including case-packed master cartons identified by SSCC."
---

# Seller Inbound

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet, and unlike the other ten contexts it has no reference service: it is design only ([ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)). Identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

<span className="badge-supporting">Supporting</span>

**Seller Inbound** (`seller-inbound`, code `SI`, tier `partner`) is the
proposed front door for stock that **sellers** send to the network. A seller
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
| [Domain Events](/network/contexts/seller-inbound/domain-events) | Nine published events, ten consumed | — |
| [Domain Message Flow](/network/contexts/seller-inbound/domain-message-flow) | Case-packed happy path, discrepancy, SSCC issuance | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/network/contexts/seller-inbound/eventstorming) | Process-level boards with hotspots | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/network/contexts/seller-inbound/use-cases) | One section per command, errors mapped to HTTP | — |
| [Class Diagram](/network/contexts/seller-inbound/class-diagram) | Proposed domain types | — |
| [Entity Relationship](/network/contexts/seller-inbound/entity-relationship) | Proposed Postgres schema | — |
| [Sequence Diagrams](/network/contexts/seller-inbound/sequence-diagrams) | One runtime sequence per key command | — |

## Elsewhere

- The decision: [ADR 0009, seller inbound and case-packed shipments](/network/adr/0009-seller-inbound-and-case-packed-shipments).
- The vendor-facing half of this flow: `GET /vendor/inbound-shipments` and
  `POST /vendor/inbound-receipts` in the Vendor API, rendered under
  [API reference](/network/api-reference) and described on
  [Vendor API](/network/integration/vendor-api).
- What this design does not solve:
  [Model gap register](/network/strategic-design/model-gap-register), G41 to G55.
- There is no OpenAPI file for the seller-facing routes yet; the routes are
  listed in `contexts[seller-inbound].rest` in the model.
- Where the context sits among the eleven: [Context Map](/network/strategic-design/context-map).
