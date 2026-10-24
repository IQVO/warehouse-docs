---
id: index
title: Last-Mile Delivery
sidebar_label: Last-Mile Delivery
description: "The proposed Last-Mile Delivery context: it runs the network's delivery stations, publishes delivery waves the promise relies on, plans DSP routes and records every delivery attempt."
---

# Last-Mile Delivery

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

<span className="badge-supporting">Supporting</span> &nbsp; tier `logistics` · code `LM`

**Last-Mile Delivery** runs each delivery station of the network. A delivery
station is a network-operated node (see
[ADR 0004](/network/adr/0004-parcel-nodes-are-network-operated)). The context
publishes **delivery waves**: dispatch slots with an induct cutoff, a delivery
window and a stop capacity. `delivery-promise` and `order-sourcing` plan the
last leg of every path on those waves. When a load arrives at a station from
`linehaul-transportation`, the context inducts each package into the earliest
wave that still has room. It plans routes for independent **Delivery Service
Partners** (DSPs) within each van's stop capacity, and it records every
delivery attempt as `DELIVERED` or `FAILED`. A failed package goes into the
next wave. After three failures it goes back to the sender. The context owns three
aggregates: `DeliveryWave`, `Route` and `DeliveryServicePartner`.

:::info[What its own pages describe]
- **Inbound:** REST commands from the station planner (`/waves`, `/routes`)
  and from the DSP driver app (`/routes/{routeId}:start`,
  `/routes/{routeId}/attempts`); `LoadArrived` from
  `linehaul-transportation`; `NodeRegistered` and `ServiceAreaAssigned` from
  `node-topology`.
- **Outbound:** six CloudEvents types on `retailnetwork.last-mile-delivery.events`.
  `delivery-promise` and `order-sourcing` consume the wave events.
  `shipping-and-tracking` consumes the out-for-delivery and attempt events.
  The context makes no synchronous call.
- **Not here:** addresses and other PII (confined to `customer-ordering` and
  `shipping-and-tracking`, [ADR 0006](/network/adr/0006-pii-confinement)), the
  customer-visible timeline, and the promise itself.
:::

## This context's pages

| Page | ddd-crew tool / notation | What it answers |
| --- | --- | --- |
| [Business Context](/network/contexts/last-mile-delivery/business-context) | Business context (DDD Starter Modelling Process, Understand / Discover) | Why the doorstep is its own context, who acts, what is out of scope |
| [Ubiquitous Language](/network/contexts/last-mile-delivery/ubiquitous-language) | Glossary (Bounded Context Canvas, Ubiquitous Language) | Delivery Wave, Induction, Route, DSP, Delivery Attempt and the neighbour terms used here |
| [Core Domain Chart](/network/contexts/last-mile-delivery/core-domain-chart) | [Core Domain Charts](https://github.com/ddd-crew/core-domain-charts) | Why the context is Supporting |
| [Bounded Context Canvas](/network/contexts/last-mile-delivery/bounded-context-canvas) | [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas) | Purpose, roles, every inbound and outbound message, decisions, open questions |
| [Context Map](/network/contexts/last-mile-delivery/context-map) | [Context Mapping](https://github.com/ddd-crew/context-mapping) | Every upstream and downstream neighbour, with pattern and channel |
| [Aggregate Design Canvas](/network/contexts/last-mile-delivery/aggregate-design-canvas) | [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas) | `DeliveryWave`, `Route`, `DeliveryServicePartner`: states, invariants, commands, events |
| [Domain Events](/network/contexts/last-mile-delivery/domain-events) | CloudEvents catalogue ([event standard](/network/strategic-design/event-standard-cloudevents)) | The six published and three consumed events, with full types and payloads |
| [Domain Message Flow](/network/contexts/last-mile-delivery/domain-message-flow) | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) | Arrival to doorstep, and the failed-attempt path |
| [EventStorming](/network/contexts/last-mile-delivery/eventstorming) | [EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) | Process-level boards with policies, read models and hotspots |
| [Use Cases](/network/contexts/last-mile-delivery/use-cases) | Application services (hexagonal) | One section per command: trigger, adapter, flow, errors, events, idempotency |
| [Class Diagram](/network/contexts/last-mile-delivery/class-diagram) | UML class diagram + ports and adapters | The proposed Go domain model and package layout |
| [Entity Relationship](/network/contexts/last-mile-delivery/entity-relationship) | ER diagram | The proposed Postgres schema, outbox and inbox |
| [Sequence Diagrams](/network/contexts/last-mile-delivery/sequence-diagrams) | UML sequence diagrams | Adapter → use case → aggregate → repository → outbox for every command |

## Elsewhere

- REST contract (as built, from the service repository): `apis/last-mile-delivery/openapi.yaml`, listed
  under the [API reference](/network/api-reference).
- Strategic view: [context map](/network/strategic-design/context-map),
  [subdomain classification](/network/strategic-design/subdomain-classification),
  [domain message flows](/network/strategic-design/domain-message-flows).
- How waves enter a promise: [promise model](/network/network-model/promise-model)
  and [ADR 0008](/network/adr/0008-capacity-held-at-promise-time).
- Station nodes and service areas: [node model](/network/network-model/node-model).
