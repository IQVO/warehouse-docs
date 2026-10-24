---
id: index
title: Delivery Promise
sidebar_label: Delivery Promise
description: The Core context that quotes a delivery date only from a feasible, capacity-backed witness path, holds that capacity until the order is placed, and judges every promise kept or broken.
---

# Delivery Promise

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

<span className="badge-core">Core</span>

**Delivery Promise** (`delivery-promise`, code `DP`, tier `commerce`) tells a
shopper, before and at purchase, the date a package will arrive, and makes that
date true by construction. A **delivery offer** is quoted only when a feasible
**witness path** exists now: an `ACTIVE` fulfillment node with the item, a
pickup cutoff the node can still make, scheduled departures with room, and a
delivery wave at the destination's delivery station. A **promise** holds
capacity on the node's pickup cutoff (the **PromiseBook**) until the order is
placed or the hold expires. When the path breaks, the context re-promises to a
later window, never an earlier one. At delivery it judges every promise
**kept** or **broken**. It owns three aggregates (`DeliveryOffer`, `Promise`,
`PromiseBook`), seven event-fed read models and six policies. It makes **no
synchronous call** to any other context: every input of the promise hot path is
a local read model fed by events.

## This context's pages

| Page | What it holds | ddd-crew tool it follows |
| --- | --- | --- |
| [Business Context](/network/contexts/delivery-promise/business-context) | The business problem, actors, decisions, the real fulfillment networks and what is out of scope | — (narrative) |
| [Ubiquitous Language](/network/contexts/delivery-promise/ubiquitous-language) | Every term of this context and the neighbour terms it uses | [Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas) (UL section, expanded) |
| [Core Domain Chart](/network/contexts/delivery-promise/core-domain-chart) | Why this is the Core domain | [Core Domain Charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/network/contexts/delivery-promise/bounded-context-canvas) | Purpose, classification, roles, inbound and outbound messages, decisions, metrics, open questions | [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/network/contexts/delivery-promise/context-map) | Every upstream and downstream neighbour, with pattern and channel | [Context Mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/network/contexts/delivery-promise/aggregate-design-canvas) | `DeliveryOffer`, `Promise`, `PromiseBook` and the seven read models | [Aggregate Design Canvas v1.1](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/network/contexts/delivery-promise/domain-events) | The nine published and twenty-seven consumed events, with a full CloudEvents envelope | — (CloudEvents catalogue) |
| [Domain Message Flow](/network/contexts/delivery-promise/domain-message-flow) | Quote, checkout, re-promise and judgement scenarios | [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/network/contexts/delivery-promise/eventstorming) | Process-level boards with hotspots | [EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/network/contexts/delivery-promise/use-cases) | One section per command use case, with errors and idempotency | — (application layer) |
| [Class Diagram](/network/contexts/delivery-promise/class-diagram) | The proposed domain model and the hexagonal ports and adapters | — (UML) |
| [Entity Relationship](/network/contexts/delivery-promise/entity-relationship) | The proposed Postgres schema | — (UML / ER) |
| [Sequence Diagrams](/network/contexts/delivery-promise/sequence-diagrams) | Adapter → use case → aggregate → outbox for every command | — (UML) |

## Elsewhere

- Read-only MCP server (service ADR 0007): `cmd/mcp`, a second binary serving Streamable HTTP
  on `:8090` with no auth; it sources this context's own reads and nothing that writes. Five
  tools: `get_current_policy`, `get_delivery_offer`, `get_promise`, `list_promise_books`,
  `list_promises_by_order`. The gateway (Kong) exposes it at `/api/mcp/delivery-promise`,
  rewritten to the server's `/mcp` mount.
- Console remote (service ADR 0008): `web/`, a Vite + React Module Federation remote —
  federation container `delivery_promise_mfe`, gateway mount `/mfes/delivery-promise/`,
  dev/preview port `4013` — read-only screens over the existing REST reads, calling only this
  context's API.
- The worked promise example (one cart, one destination, every step of the
  search with numbers) lives in [the promise model](/network/network-model/promise-model).
  This pack links to it rather than repeating it.
- Decisions this context rests on:
  [ADR 0002: promise and assignment are separate](/network/adr/0002-promise-and-assignment-are-separate),
  [ADR 0003: declared and measured capability](/network/adr/0003-declared-and-measured-capability),
  [ADR 0008: capacity held at promise time](/network/adr/0008-capacity-held-at-promise-time),
  [ADR 0007: CloudEvents namespace](/network/adr/0007-cloudevents-namespace).
- The REST contract (as built, from the service repository): `apis/delivery-promise/openapi.yaml`, rendered
  under the [API reference](/network/api-reference).
- Where this context sits among the eleven:
  [the domain context map](/network/strategic-design/context-map) and
  [the core domain chart](/network/strategic-design/core-domain-chart).
