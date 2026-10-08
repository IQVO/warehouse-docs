---
id: index
title: Inbound Receiving
sidebar_label: Inbound Receiving
description: The Supporting, WMS-tier bounded context decided on 2026-10-08 for everything before the first stow — the advance ship notice, the dock appointment and the receipt with its discrepancies. Not built yet.
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

:::warning[Decided, not built]
The user decided this context on 2026-10-08. Its repository,
[IQVO/inbound-receiving](https://github.com/IQVO/inbound-receiving), exists
(bootstrapped from the harness template, `develop` protected) but has no
domain code yet. Everything below is the decision log and the pinned
contracts. Nothing here is live, and no sibling context consumes any of its
events yet. The consumer on the `inventory-storage` side is in progress
(its handover ADR), and the `warehouse-planning` consumer is planned and
not built. See the [Context Map](/strategic-design/context-map), edges K22
to K24 and K28.
:::

It is planned to own three aggregates, each its own consistency boundary:
**`Asn`**, **`DockAppointment`** and **`Receipt`**. The richest package is
`receipt`.

## This context's pages

- [Business Context](/contexts/inbound-receiving/business-context): the gap
  before the first stow, the decisions taken, and what the context
  deliberately does not own.
- [Bounded Context Canvas](/contexts/inbound-receiving/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, classification, roles, inbound and outbound communication,
  business decisions and open questions.

The synced artifact pack (ubiquitous language, core domain chart, context
map, aggregate design canvas, domain events, message flow, EventStorming,
class diagram, entity relationship, sequence diagrams) and the generated REST
and AsyncAPI references are added when the repository ships them. They are
not stubbed here.

## Elsewhere

- **Repository**: [github.com/IQVO/inbound-receiving](https://github.com/IQVO/inbound-receiving).
  Its ADRs live under `docs/adr/`. The planned first set is 0001 (bounded
  context), 0002 (aggregates and invariants), 0003 (local copies and the
  handover), 0004 (CloudEvents envelope and type catalogue); MCP adoption
  and the analytics read side follow in later phases.
- **Fleet-level**: [Context Map](/strategic-design/context-map) (K22 to K24
  and K28), the [Event Standard](/strategic-design/event-standard-cloudevents)
  (subdomain table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [Ubiquitous Language](/strategic-design/ubiquitous-language).
