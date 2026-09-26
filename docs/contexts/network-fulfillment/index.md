---
id: index
title: Network Fulfillment
sidebar_label: Network Fulfillment
description: The Anti-Corruption Layer between the fleet and an external retail fulfillment network — a Supporting subdomain that owns NetworkOrder, polls network demand in stub mode, and asks order-management whether each deadline is feasible. No Kafka, no MCP yet.
slug: /contexts/network-fulfillment
---

# Network Fulfillment

<span class="badge-supporting">Supporting Subdomain</span>

**Network Fulfillment** is the fleet's tenth and newest backend bounded
context: the **Anti-Corruption Layer** between `warehouse-systems` and an
external retail fulfillment network. Its learning target is Amazon's
Selling Partner API, Vendor Direct Fulfillment program — the network sends
purchase orders to a warehouse it does not own, and that warehouse must
acknowledge each one **in full or not at all** within 24 hours.

It owns one aggregate, **NetworkOrder**: demand that arrived from outside
carrying a deadline we did not choose, and the answer we owe the network
by a deadline the network set. It is **Conformist** to the network
upstream, an **Anti-Corruption Layer** for the fleet, and a **Customer**
of `order-management`, which it asks — synchronously, over REST — whether
each deadline is feasible.

:::warning[Study project, stub-only, not yet released]
This context is part of a personal DDD learning exercise. It is **not
affiliated with, endorsed by, or representative of Amazon** or any other
company; the Selling Partner API is a public API used as a learning
target. On `develop` it runs **only against a stub network**
(`NETWORK_MODE=stub`); `sandbox` and `live` refuse to boot with "not
implemented yet". It has no `main` branch and no release yet.
:::

:::info[What is built, and what is not]
**Built:** the `NetworkOrder` aggregate; a poller-driven inbound leg feeding
`ReceiveNetworkDemand`; the `SweepAcknowledgementDeadlines` ticker; a
read-only REST surface (`GET /healthz`, `/inbound-status`,
`/network-orders`, `/network-orders/{networkRef}`); Postgres or in-memory
persistence; the product-translation file and stub-demand seed file; a
Helm chart deployed to the kind cluster (Kong route
`/api/network-fulfillment`).

**Not built:** `CapabilityOffer` (throughput-constrained advertised
availability — the headline idea of ADR 0001), the shipment-confirmation
leg, transaction-status reconciliation, `AcknowledgementDeadlineAtRisk`,
customer PII, any Kafka publisher or consumer, an MCP server, a `web/`
remote, and its own docs site. See
[Domain Events](/contexts/network-fulfillment/domain-events).
:::

## On this page set

- **[Business Context](/contexts/network-fulfillment/business-context)** — why "selling capability to a
  network" is a domain problem, not a REST mapping, and why this is its own
  context rather than an adapter inside `order-management`.
- **[Ubiquitous Language](/contexts/network-fulfillment/ubiquitous-language)** — NetworkOrder, NetworkRef,
  NetworkProductId vs. SKU, LocalOrderId, requiredShipBy, acknowledgeBy,
  held order, and the planned CapabilityOffer.
- **[Bounded Context Canvas](/contexts/network-fulfillment/bounded-context-canvas)** — the full ddd-crew
  canvas: purpose, classification, roles, inbound/outbound communication,
  business decisions, open questions.
- **[Aggregate Design Canvas](/contexts/network-fulfillment/aggregate-design-canvas)** — the `NetworkOrder`
  aggregate: states, invariants, commands.
- **[Domain Events](/contexts/network-fulfillment/domain-events)** — honestly: none typed yet, no Kafka
  topic; what ADR 0001 plans and the rules for when Kafka arrives.

## Elsewhere

- **Repository** — [github.com/claudioed/network-fulfillment](https://github.com/claudioed/network-fulfillment)
  (no Docusaurus site of its own; this page set is built from its README,
  `AGENTS.md`, `.claude/rules/*.md`, ADR 0001 and the code on `develop`)
- **[ADR 0001 — Network Fulfillment as a bounded context](https://github.com/claudioed/network-fulfillment/blob/develop/docs/adr/0001-network-fulfillment-bounded-context.md)**
  — and its companion, [order-management ADR 0020](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0020-network-originated-demand-hold-and-deadline-feasibility.md)
- **[Generated REST API Reference](/api-reference/rest/network-fulfillment/network-fulfillment-api)**
  — generated from the real `apis/openapi.yaml` (there is no AsyncAPI
  reference: this context has no Kafka integration)
- Fleet-wide [Context Map](/strategic-design/context-map) — where this
  context sits among the ten backend contexts
