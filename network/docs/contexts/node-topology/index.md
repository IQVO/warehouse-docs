---
id: index
title: Node Topology
sidebar_label: Node Topology
description: "The authoritative registry of the retail network's physical shape: nodes, their declared operational profiles, lanes, regions and service areas."
---

# Node Topology

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

<span class="badge-supporting">Supporting</span>

**Node Topology** (`node-topology`, code `NT`, tier `logistics`) is the
authoritative registry of the network's physical shape. It holds every node:
the vendor fulfillment centres, inbound cross-docks and returns centres, and
the network's own sortation centres, delivery stations and air hubs. For each
node it holds the type, the operator, the region, the time zone and the
declared **operational profile** (handling time, operating hours, cutoffs,
throughput cap). It also holds the directed **lanes** between nodes, the
**regions**, and which delivery station serves which postal prefix (the
**service area**). It decides nothing about a single order. Every promise,
assignment and route in the network rests on the facts it publishes. It
consumes no event and calls no other context. Nine CloudEvents types leave it
on `retailnetwork.node-topology.events`.

## This context's pages

| Page | ddd-crew tool or notation it follows |
| --- | --- |
| [Business Context](/network/contexts/node-topology/business-context) | The "why" behind the context (DDD Starter Modelling Process: Understand) |
| [Ubiquitous Language](/network/contexts/node-topology/ubiquitous-language) | Glossary, plus the fleet translation table |
| [Core Domain Chart](/network/contexts/node-topology/core-domain-chart) | [ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/network/contexts/node-topology/bounded-context-canvas) | [ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas) v5 |
| [Context Map](/network/contexts/node-topology/context-map) | [ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/network/contexts/node-topology/aggregate-design-canvas) | [ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas) v1.1 |
| [Domain Events](/network/contexts/node-topology/domain-events) | CloudEvents 1.0 catalogue ([event standard](/network/strategic-design/event-standard-cloudevents)) |
| [Domain Message Flow](/network/contexts/node-topology/domain-message-flow) | [ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/network/contexts/node-topology/eventstorming) | [ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet), process level |
| [Use Cases](/network/contexts/node-topology/use-cases) | Application services, one per command |
| [Class Diagram](/network/contexts/node-topology/class-diagram) | UML class diagram with DDD stereotypes, plus the hexagonal view |
| [Entity Relationship](/network/contexts/node-topology/entity-relationship) | The proposed Postgres schema |
| [Sequence Diagrams](/network/contexts/node-topology/sequence-diagrams) | UML sequence diagrams, one per command use case |

The REST contract is `apis/node-topology/openapi.yaml`, rendered under the
[API reference](/network/api-reference).

## Elsewhere

- [Node model](/network/network-model/node-model): the network-wide view of node types,
  lane rules and service tiers.
- [ADR 0003: declared and measured capability](/network/adr/0003-declared-and-measured-capability)
  and [ADR 0004: parcel nodes are network-operated](/network/adr/0004-parcel-nodes-are-network-operated).
- [WMS/WES integration](/network/integration/wms-wes-integration): how a
  warehouse-systems site becomes a vendor node, through the Vendor API only.
- The domain-wide [Context Map](/network/strategic-design/context-map).
