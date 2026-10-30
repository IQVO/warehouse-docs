---
id: index
title: Inbound Receiving
sidebar_label: Inbound Receiving
description: The Supporting, WMS-tier bounded context for everything before the first stow — the advance ship notice, the dock appointment and the receipt with its discrepancies.
slug: /contexts/inbound-receiving
---

# Inbound Receiving

<span className="badge-supporting">Supporting Subdomain</span>

**Inbound Receiving** is one of the fleet's sixteen domain bounded contexts.
It sits in the `wms` tier of the CloudEvents subdomain taxonomy, the fourth
`wms` context after `facility-layout`, `inventory-storage` and
`product-master`. It owns what happens **before the first stow**: the
supplier's advance ship notice (ASN), the booking of a dock door and time
window, and the receipt that counts a delivery against the ASN and records
any discrepancy. It books no stock itself: good units reach
`inventory-storage` as events.

:::info[What is live and what is planned]
Per this context's own [Context Map](/contexts/inbound-receiving/context-map),
checked against each side's `develop` and `warehouse-infra` `develop`:

**Built:** the service
([IQVO/inbound-receiving](https://github.com/IQVO/inbound-receiving), ADRs
0001 to 0006) ships four binaries: `cmd/api` (REST, the transactional outbox
and two local-copy consumers, `known_skus` from `ProductRegistered` and
`dock_doors` from the facility-layout slot events), `cmd/mcp` (seven read-only
MCP tools, ADR 0005), and the analytics read side `cmd/inbound-projector` and
`cmd/inbound-reports` (receiving performance and freshness reports, ADR 0006).
Its web remote `inbound_mfe` is mounted by `warehouse-console`, and it ships a
Helm chart (`charts/inbound-receiving`).

**Live in the reference deployment (wired in `warehouse-infra` `develop`):**
it runs with `EVENT_PUBLISHER=kafka`, both local copies in `kafka` mode and the
pack-level consumer (`packagingConsumerGroup`, product-master's
`ProductPackLevelDeclared`/`Retired` for carton-level receiving);
`inventory-storage` consumes the handover event `ReceiptLineReceived` (its ADR
0037) and the identity-only `ReceiptCartonReceived` (its ADR 0045/0046, the same
consumer group) and books `Good` lines only; `warehouse-planning` consumes
`DockAppointmentBooked` and `DockAppointmentCancelled` as inbound-labor demand
(its ADR 0017, K28); `exception-management` consumes `CartonDiscrepancyRaised`
(its ADR 0006); `network-fulfillment` consumes `ReceiptCartonReceived`,
`CartonDiscrepancyRaised` and `ReceiptClosed` for its seller inbound loop (its
ADR 0028, live mode); `warehouse-ops-agent` reads it over MCP (its ADR 0021).
Five of the eleven published event types have no consumer today
(`ASNRegistered`, `ASNCancelled`, `DockAppointmentCheckedIn`,
`DockAppointmentCompleted`, `ReceiptOpened`).
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
- [Domain Events](/contexts/inbound-receiving/domain-events): the eleven
  published events and five consumed ones.
- [Domain Message Flow](/contexts/inbound-receiving/domain-message-flow),
  [EventStorming](/contexts/inbound-receiving/eventstorming),
  [Class Diagram](/contexts/inbound-receiving/class-diagram),
  [Entity Relationship](/contexts/inbound-receiving/entity-relationship),
  [Sequence Diagrams](/contexts/inbound-receiving/sequence-diagrams) and
  [Use Cases](/contexts/inbound-receiving/use-cases).
- [Async API](/contexts/inbound-receiving/async-api): the Kafka narrative.
- Generated references: [REST](/api-reference/rest/inbound-receiving/inbound-receiving-api)
  (including the two `reports` paths served by `cmd/inbound-reports`) and
  [AsyncAPI](/api-reference/async/inbound-receiving).

## Elsewhere

- **Repository**: [github.com/IQVO/inbound-receiving](https://github.com/IQVO/inbound-receiving).
  Its ADRs live under `docs/adr/`: 0001 (bounded context), 0002 (aggregates and
  invariants), 0003 (local copies and the handover), 0004 (CloudEvents
  envelope and type catalogue), 0005 (MCP server adoption), 0006 (analytics
  read side).
- **Fleet-level**: [Context Map](/strategic-design/context-map) (K22 to K24
  and K28), the [Event Standard](/strategic-design/event-standard-cloudevents)
  (subdomain table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [Ubiquitous Language](/strategic-design/ubiquitous-language).
