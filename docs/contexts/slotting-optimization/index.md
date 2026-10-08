---
id: index
title: Slotting Optimization
sidebar_label: Slotting Optimization
description: The Supporting, WMS-tier bounded context decided on 2026-10-08 that decides which SKUs deserve a forward pick slot, by pick velocity, with human approval. Not built yet.
slug: /contexts/slotting-optimization
---

# Slotting Optimization

<span className="badge-supporting">Supporting Subdomain</span>

**Slotting Optimization** is one of the fleet's fourteen domain bounded
contexts. It sits in the `wms` tier of the CloudEvents subdomain taxonomy, the
fifth `wms` context after `facility-layout`, `inventory-storage`,
`product-master` and `inbound-receiving`. It answers one question the fleet
could not answer before: **which SKUs deserve a forward pick slot**.
`facility-layout` already models forward and reserve zones, but nothing
decided what belongs in them.

:::warning[Decided, not built]
The user decided this context on 2026-10-08. Its repository,
[IQVO/slotting-optimization](https://github.com/IQVO/slotting-optimization),
exists (bootstrapped from the harness template, `develop` protected) but has
no domain code yet. Everything below is the decision log and the pinned
contracts. Nothing here is live. The local-copy consumers (edges K25 to K27
on the [Context Map](/strategic-design/context-map)) are in progress. The
execution of approved moves (edge K29) is **planned and not built**.
:::

It is planned to own one aggregate, **`SlotPlan`**: a proposed assignment of
SKUs to forward slots for a site and a lookback window. A plan is generated
as a draft by the `abc-velocity-v1` policy and becomes real only when a
human approves it. The package is `slotplan`.

## This context's pages

- [Business Context](/contexts/slotting-optimization/business-context): the
  gap, the v1 policy and the decisions taken, and what the context
  deliberately does not do.
- [Bounded Context Canvas](/contexts/slotting-optimization/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, classification, roles, inbound and outbound communication,
  business decisions and open questions.

The synced artifact pack and the generated REST and AsyncAPI references are
added when the repository ships them. They are not stubbed here.

## Elsewhere

- **Repository**: [github.com/IQVO/slotting-optimization](https://github.com/IQVO/slotting-optimization).
  Its ADRs live under `docs/adr/`. The planned first set is 0001 (bounded
  context), 0002 (aggregates, invariants and the slotting policy), 0003
  (local copies and consumed contracts), 0004 (CloudEvents envelope and type
  catalogue); MCP adoption and the analytics read side follow in later
  phases.
- **Fleet-level**: [Context Map](/strategic-design/context-map) (K25 to K27
  and K29), the [Event Standard](/strategic-design/event-standard-cloudevents)
  (subdomain table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [Ubiquitous Language](/strategic-design/ubiquitous-language).
