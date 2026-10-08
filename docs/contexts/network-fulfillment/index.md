---
id: index
title: Network Fulfillment
sidebar_label: Network Fulfillment
description: The Anti-Corruption Layer between the fleet and an external retail fulfillment network — a Supporting subdomain that owns NetworkOrder and CapabilityOffer, polls network demand (stub only), asks order-management whether each deadline is feasible, and publishes five CloudEvents types.
slug: /contexts/network-fulfillment
---

# Network Fulfillment

<span className="badge-supporting">Supporting Subdomain</span>

**Network Fulfillment** is the fleet's **Anti-Corruption Layer** between
`warehouse-systems` and an external retail fulfillment network. The
network sends purchase orders to a warehouse it does not own, and that
warehouse must acknowledge each one **in full or not at all** within 24
hours. Since
[ADR 0009](https://github.com/IQVO/network-fulfillment/blob/develop/docs/adr/0009-retail-network-not-amazon-counterpart.md)
the counterpart is the fleet's own `retail-network` service, which plays
the network's role. The original learning target was a large retailer's
public Selling Partner API.

It owns the **NetworkOrder** aggregate: demand that arrived from outside
with a deadline we did not choose, and the answer we owe the network by a
deadline the network set. It also owns **CapabilityOffer**, the
throughput-constrained quantity it would advertise (opt-in with
`CAPABILITY_OFFER_ENABLED=true`). It is **Conformist** to the network
upstream and an **Anti-Corruption Layer** for the fleet. It is also a
**Customer** of `order-management`, which it asks over REST whether each
deadline is feasible.

:::warning[Study project, stub network only]
This context is part of a DDD learning exercise. It is **not affiliated
with, endorsed by, or representative of** any real retailer. The network
gateway runs only against a stub: `NETWORK_MODE` defaults to `stub`, and
`live` refuses to boot until a real adapter exists.
:::

:::info[What its own pages describe]
- **Inbound:** a poller feeds network demand to `ReceiveNetworkDemand`. A
  read-only REST surface (`/network-orders`, `/inbound-status`, and
  `/capability-offers` when enabled), a shipment-confirmation command
  (`POST /network-orders/{networkRef}/shipment-confirmation`, ADR 0014),
  read-only MCP tools, and a `web/` remote in `warehouse-console`
  (ADR 0010).
- **Outbound:** REST to `order-management` (raise, release and cancel a
  held order; live), and an opt-in REST read of `inventory-storage` usable
  stock.
- **Events:** with `EVENT_PUBLISHER=kafka`, five CloudEvents types
  (`com.warehouse.wes.network-fulfillment.networkorder.*`) go to
  `warehouse.network-fulfillment.events` and to
  `warehouse.network-fulfillment.analytics`, through a transactional outbox
  when a database is configured. No other fleet context consumes the
  integration topic yet. The context consumes
  `process-path-management`'s catalogue and CPT schedule and
  `wes-work-planning`'s `PathCapacityChanged` into opt-in caches.

See the [Bounded Context Canvas](/contexts/network-fulfillment/bounded-context-canvas)
and [Context Map](/contexts/network-fulfillment/context-map) for every
edge and its status.
:::

## This context's pages

- [Business Context](/contexts/network-fulfillment/business-context): why
  "selling capability to a network" is a domain problem rather than a REST
  mapping, and why this is its own context rather than an adapter inside
  `order-management`.
- [Ubiquitous Language](/contexts/network-fulfillment/ubiquitous-language):
  NetworkOrder, NetworkRef, NetworkProductId vs. SKU, LocalOrderId,
  requiredShipBy, acknowledgeBy, held order, CapabilityOffer.
- [Core Domain Chart](/contexts/network-fulfillment/core-domain-chart)
  ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts)):
  why this context is Supporting.
- [Bounded Context Canvas](/contexts/network-fulfillment/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, classification, roles, inbound and outbound communication,
  business decisions and open questions.
- [Context Map](/contexts/network-fulfillment/context-map)
  ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)):
  every upstream and downstream relationship with its pattern, technology
  and status.
- [Aggregate Design Canvas](/contexts/network-fulfillment/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  the `NetworkOrder` aggregate, with its states, invariants and commands.
- [Domain Events](/contexts/network-fulfillment/domain-events): the five
  published events (`NetworkOrderReceived`, `NetworkOrderAcknowledged`,
  `NetworkOrderRejected`, `NetworkOrderShipmentConfirmed`,
  `AcknowledgementDeadlineAtRisk`), the three consumed topics, and the
  spec-vs-code discrepancies found.
- [Domain Message Flow](/contexts/network-fulfillment/domain-message-flow)
  ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling)):
  key scenarios as commands, events and queries.
- [EventStorming](/contexts/network-fulfillment/eventstorming)
  ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)):
  process-level boards.
- [Class Diagram](/contexts/network-fulfillment/class-diagram): the domain
  model as it exists in the code.
- [Entity Relationship](/contexts/network-fulfillment/entity-relationship):
  the persisted tables.
- [Sequence Diagrams](/contexts/network-fulfillment/sequence-diagrams):
  the main runtime interactions.
- [Async API](/contexts/network-fulfillment/async-api): the Kafka
  integration in narrative form.

Every page above except the Business Context and the Async API narrative
is synced from the `network-fulfillment` repository (its `docs/ddd/`
directory).

## Elsewhere

- **Repository**: [github.com/IQVO/network-fulfillment](https://github.com/IQVO/network-fulfillment).
  Its ADRs live under `docs/adr/`, not `docs/docs/adr/`.
- **[ADR 0001: Network Fulfillment as a bounded context](https://github.com/IQVO/network-fulfillment/blob/develop/docs/adr/0001-network-fulfillment-bounded-context.md)**,
  and its companion
  [order-management ADR 0020](https://github.com/IQVO/order-management/blob/develop/docs/docs/adr/0020-network-originated-demand-hold-and-deadline-feasibility.md).
- [ADR index](/adr): links to this context's own decision records.
- Generated references on this site:
  [REST](/api-reference/rest/network-fulfillment/network-fulfillment-api)
  and [AsyncAPI](/api-reference/async/network-fulfillment), generated from
  the real `apis/openapi.yaml` and `apis/asyncapi.yaml`.
- The fleet-wide [Context Map](/strategic-design/context-map) shows where
  this context sits among the fleet's contexts.
