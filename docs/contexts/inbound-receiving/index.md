---
id: index
title: Inbound Receiving
sidebar_label: Inbound Receiving
description: The Supporting, WMS-tier bounded context for everything before the first stow — the advance ship notice, the dock appointment and the receipt with its discrepancies.
slug: /contexts/inbound-receiving
---

# Inbound Receiving

<span className="badge-supporting">Supporting Subdomain</span>

**Inbound Receiving** is one of the fleet's fourteen domain bounded contexts.
It sits in the `wms` tier of the CloudEvents subdomain taxonomy, the fourth
`wms` context after `facility-layout`, `inventory-storage` and
`product-master`. It owns what happens **before the first stow**: the
supplier's advance ship notice (ASN), the booking of a dock door and time
window, and the receipt that counts a delivery against the ASN and records
any discrepancy. It books no stock itself: good units reach
`inventory-storage` as events.

:::info[What is live, what is not deployed, and what is planned]
Per this context's own [Context Map](/contexts/inbound-receiving/context-map),
checked against each side's `develop`:

**Code merged on both sides:** the service
([IQVO/inbound-receiving](https://github.com/IQVO/inbound-receiving), ADRs
0001 to 0004) ships the REST API, the transactional outbox and two opt-in
local-copy consumers (`known_skus` from `ProductRegistered`, `dock_doors` from
the facility-layout slot events). `inventory-storage` has the consumer for the
handover event `ReceiptLineReceived` on its `develop` (its ADR 0037), started
only when `INBOUND_RECEIPT_CONSUMER_GROUP` is set. It books `Good` lines only.

**Not deployed:** `warehouse-infra` `develop` does not run `inbound-receiving`
yet (no cluster wiring, no consumer group set), so no edge is live end to end.

**Planned, not built:** `warehouse-planning` consuming `DockAppointmentBooked`
as inbound-labor demand (its CapacityPlan has no inbound process path), a
read-only MCP server for `warehouse-ops-agent`, a console remote and the
analytics read side. Eight of the nine published event types have no consumer
today.
:::

It owns three aggregates, each its own consistency boundary: **`Asn`**,
**`DockAppointment`** and **`Receipt`**. The richest package is `receipt`.

## This context's pages

- [Business Context](/contexts/inbound-receiving/business-context): the gap
  before the first stow, the decisions taken, and what the context
  deliberately does not own.
- [Ubiquitous Language](/contexts/inbound-receiving/ubiquitous-language):
  ASN, dock appointment, door, window, receipt, condition, discrepancy
  (Short, Over, Damaged), snapshot, local copy.
- [Core Domain Chart](/contexts/inbound-receiving/core-domain-chart):
  Supporting, and why.
- [Bounded Context Canvas](/contexts/inbound-receiving/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, classification, roles, inbound and outbound communication,
  business decisions and open questions.
- [Context Map](/contexts/inbound-receiving/context-map): every edge with its
  pattern, technology and status, planned edges labelled.
- [Aggregate Design Canvas](/contexts/inbound-receiving/aggregate-design-canvas):
  `Asn`, `DockAppointment` and `Receipt`.
- [Domain Events](/contexts/inbound-receiving/domain-events): the nine
  published events and three consumed ones.
- [Domain Message Flow](/contexts/inbound-receiving/domain-message-flow),
  [EventStorming](/contexts/inbound-receiving/eventstorming),
  [Class Diagram](/contexts/inbound-receiving/class-diagram),
  [Entity Relationship](/contexts/inbound-receiving/entity-relationship),
  [Sequence Diagrams](/contexts/inbound-receiving/sequence-diagrams) and
  [Use Cases](/contexts/inbound-receiving/use-cases).
- [Async API](/contexts/inbound-receiving/async-api): the Kafka narrative.
- Generated references: [REST](/api-reference/rest/inbound-receiving/inbound-receiving-api)
  and [AsyncAPI](/api-reference/async/inbound-receiving).

## Elsewhere

- **Repository**: [github.com/IQVO/inbound-receiving](https://github.com/IQVO/inbound-receiving).
  Its ADRs live under `docs/adr/`: 0001 (bounded context), 0002 (aggregates and
  invariants), 0003 (local copies and the handover), 0004 (CloudEvents
  envelope and type catalogue); MCP adoption and the analytics read side follow
  in later phases.
- **Fleet-level**: [Context Map](/strategic-design/context-map) (K22 to K24
  and K28), the [Event Standard](/strategic-design/event-standard-cloudevents)
  (subdomain table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [Ubiquitous Language](/strategic-design/ubiquitous-language).
