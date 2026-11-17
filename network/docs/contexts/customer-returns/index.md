---
id: index
title: Customer Returns
sidebar_label: Customer Returns
description: "The Supporting commerce-tier context that authorizes a shopper's return of a shipped or delivered order group, decides the disposition at authorization and closes on the graded outcome."
---

# Customer Returns

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built ([`IQVO/customer-returns`](https://github.com/IQVO/customer-returns), decided by [ADR 0012](/network/adr/0012-customer-returns-is-a-bounded-context)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses. Where the model left a choice open, the service's own ADRs 0001 to 0005 record what it does.
:::

<span className="badge-supporting">Supporting</span>

**Customer Returns** (`customer-returns`, code `CR`, tier `commerce`) is the
shopper-facing returns front door of the network. After an order group has
shipped or been delivered, the shopper asks to return it. The context
creates a **return authorization**, decides the **disposition** itself (keep
the goods, bring them to the nearest returns centre of the region, or send
them back to the node that fulfilled the group), links the **reverse labels**
and closes the authorization when a returns centre grades what came back.
It holds no money, no address and no free text: the reason is an enum, unit
prices are the caller's facts and never leave the context, and only the
postal prefix of the group's destination is kept.

Two of its seams are built on this side only. The reverse-label route of
`shipping-and-tracking` and the return advices and outcomes of
`vendor-connectivity` are decided in those services' ADRs but are not in
their `develop` contracts, so the model draws neither. Until they ship, a
label request answers `label-unavailable` and no authorization reaches
`RECEIVED`. See [Context Map](/network/contexts/customer-returns/context-map).

## Pages

| Page | What it covers | ddd-crew tool |
| --- | --- | --- |
| [Business Context](/network/contexts/customer-returns/business-context) | The problem, the actors, the decisions, what is out of scope | — |
| [Ubiquitous Language](/network/contexts/customer-returns/ubiquitous-language) | Terms (return authorization, disposition, returnless return, graded outcome...) and code identifiers | — |
| [Core Domain Chart](/network/contexts/customer-returns/core-domain-chart) | Why this context is Supporting | [core-domain-charts](https://github.com/ddd-crew/core-domain-charts) |
| [Bounded Context Canvas](/network/contexts/customer-returns/bounded-context-canvas) | Purpose, roles, inbound and outbound messages, decisions | [bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas) |
| [Context Map](/network/contexts/customer-returns/context-map) | Every neighbour with direction and pattern, and the two seams not drawn yet | [context-mapping](https://github.com/ddd-crew/context-mapping) |
| [Aggregate Design Canvas](/network/contexts/customer-returns/aggregate-design-canvas) | `ReturnAuthorization` and the three read models | [aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas) |
| [Domain Events](/network/contexts/customer-returns/domain-events) | Four published events, nine consumed | — |
| [Domain Message Flow](/network/contexts/customer-returns/domain-message-flow) | A physical return, a returnless return, cancellation and expiry | [domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling) |
| [EventStorming](/network/contexts/customer-returns/eventstorming) | Process-level boards with hotspots | [eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet) |
| [Use Cases](/network/contexts/customer-returns/use-cases) | One section per command, errors mapped to HTTP | — |
| [Class Diagram](/network/contexts/customer-returns/class-diagram) | Domain types and the hexagonal layout | — |
| [Entity Relationship](/network/contexts/customer-returns/entity-relationship) | The tables the service's ADRs name, as a logical view | — |
| [Sequence Diagrams](/network/contexts/customer-returns/sequence-diagrams) | One runtime sequence per key command | — |

## Service and operations

- **Service:** [`IQVO/customer-returns`](https://github.com/IQVO/customer-returns) on `develop` (`e89daed`,
  2026-11-16): binaries `cmd/api` (REST, the outbox relay and the four consumers), `cmd/mcp`
  (read-only MCP) and `cmd/a2a` (read-only A2A agent). The repository carries no console remote.
- **Deployment:** wired in warehouse-infra develop: a `terraform/apps.yaml` entry and
  `helm-values/customer-returns.yaml` (gateway path `/api/customer-returns`, MCP at
  `/api/mcp/customer-returns`). The cluster itself was not checked in this refresh.
- **Observability:** [service ADR 0008](https://github.com/IQVO/customer-returns/blob/develop/docs/adr/0008-fleet-observability-standard.md),
  *Adopt the fleet observability standard*. The Tier-2 business counter is
  `customer_returns.return.authorized` (unit `{return}`), with attribute `outcome` =
  `authorized` or `rejected`.

## Elsewhere

- The decision: [ADR 0012, customer returns is a bounded context](/network/adr/0012-customer-returns-is-a-bounded-context).
- The REST contract (as built, from the service repository):
  `network/apis/customer-returns/openapi.yaml`, rendered under the
  [API reference](/network/api-reference): five operations on
  `/return-authorizations`, plus liveness and readiness.
- Read-only MCP server (service ADR 0006): `cmd/mcp`, Streamable HTTP, no auth, its own reads
  only. Two tools: `get_return_authorization` and `list_return_authorizations`. Authorizing,
  labelling and cancelling stay REST-only.
- What the model does not carry yet for this context:
  [Context Map](/network/contexts/customer-returns/context-map#the-two-seams-the-model-does-not-draw).
- Where the context sits among the twelve: [Context Map](/network/strategic-design/context-map).
