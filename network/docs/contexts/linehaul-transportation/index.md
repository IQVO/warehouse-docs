---
id: index
title: Linehaul Transportation
sidebar_label: Linehaul Transportation
description: The middle mile of the retail network, a proposed Supporting context that turns lanes into scheduled departures, keeps their package capacity and consolidates packages into loads.
---

# Linehaul Transportation

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
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
| [Business Context](/contexts/linehaul-transportation/business-context) | The problem, the actors, the decisions, what is out of scope | — (narrative) |
| [Ubiquitous Language](/contexts/linehaul-transportation/ubiquitous-language) | Departure, Pickup Departure, Load, Lane Schedule, Middle Mile and the neighbour terms used here | — (glossary) |
| [Core Domain Chart](/contexts/linehaul-transportation/core-domain-chart) | Why this context is Supporting | [core-domain-charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/contexts/linehaul-transportation/bounded-context-canvas) | Purpose, classification, roles, every inbound and outbound message | [bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas) v5 |
| [Context Map](/contexts/linehaul-transportation/context-map) | Every upstream and downstream neighbour with its pattern and channel | [context-mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/contexts/linehaul-transportation/aggregate-design-canvas) | `Departure`, `LaneSchedule` and `Load`: states, invariants, commands, events | [aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas) v1.1 |
| [Domain Events](/contexts/linehaul-transportation/domain-events) | The eight published and twelve consumed events, with full CloudEvents types | — (event catalogue) |
| [Domain Message Flow](/contexts/linehaul-transportation/domain-message-flow) | Cutoff to pickup, booking on lock, load to station, cancellation | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/contexts/linehaul-transportation/eventstorming) | Process-level boards with hotspots | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/contexts/linehaul-transportation/use-cases) | One section per command: trigger, adapter, flow, errors, events | — (application layer) |
| [Class Diagram](/contexts/linehaul-transportation/class-diagram) | Proposed domain types and the hexagonal ports and adapters | — (UML) |
| [Entity Relationship](/contexts/linehaul-transportation/entity-relationship) | Proposed Postgres schema | — (ER) |
| [Sequence Diagrams](/contexts/linehaul-transportation/sequence-diagrams) | One runtime sequence per command use case | — (UML) |

The REST contract is `apis/linehaul-transportation/openapi.yaml`, rendered
under [API reference](/api-reference).

## Elsewhere

- [Strategic context map](/strategic-design/context-map) and
  [subdomain classification](/strategic-design/subdomain-classification).
- [Node model](/network-model/node-model) (lanes and node types) and
  [promise model](/network-model/promise-model) (how departures become a
  witness path).
- [ADR 0008: capacity held at promise time](/adr/0008-capacity-held-at-promise-time)
  and [ADR 0004: parcel nodes are network-operated](/adr/0004-parcel-nodes-are-network-operated).
