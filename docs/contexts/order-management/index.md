---
id: index
title: order-management
sidebar_label: Overview
slug: /contexts/order-management
description: Order Management — the missing upstream Open Host Service for the warehouse-systems fleet. Order intake, allocation, and release.
---

# order-management

`CLAUDE.md` titles this repository directly: **"Order Management
(Generic/Supporting Bounded Context — order intake, allocation,
release)."**

<span class="badge-generic">Generic</span>/<span class="badge-supporting">Supporting</span> — a rare acknowledgment in this fleet that DDD's
three-way split is a spectrum. The reference model's **Order Management /
ERP interface** capability is Generic (a commodity integration surface most
WMS platforms ship similarly), but this context also plays a Supporting
**operational** role as the platform's previously-missing upstream front
door. See [Subdomain Classification](/strategic-design/subdomain-classification)
for the fleet-wide verdict and [Bounded Context Canvas](/contexts/order-management/bounded-context-canvas)
for the full justification.

## What it does

Order Management is the **missing upstream Open Host Service** for the
`warehouse-systems` fleet. It owns **Order** and **OrderLine** as
first-class, validated aggregates: intake, per-line stock allocation (via
`inventory-storage`), a delivery promise derived from fulfillment capability
(a CPT window, per
[ADR-0014](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0014-promise-derived-from-fulfillment-capability.md),
re-promised when fulfillment reports a missed CPT per
[ADR-0018](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0018-repromise-order-consumer-and-order-repromised.md)),
release of allocated work (now choreographed over Kafka to `wes-work-planning`, per
[ADR-0005](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0005-choreographed-release-via-kafka.md)),
and cancellation up to the release boundary. Since
[ADR-0020](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0020-network-originated-demand-hold-and-deadline-feasibility.md)
it also accepts **held**, deadline-constrained orders from
`network-fulfillment` (allocate now, release or cancel later).

Before it existed, "an order" was not a modelled thing anywhere in this
platform — it was an unowned, unvalidated string, independently reinvented
three different ways: `demandRef` on `inventory-storage`'s `Reservation`,
`reference` on `wes-work-planning`'s `WorkUnit`, and `Reference` on
`fulfillment-execution`'s `Task`. This context makes `OrderId` a real
identity and becomes the upstream that supplies it to the others.

## On this page's siblings

- **[Business Context](/contexts/order-management/business-context)** — the domain vision and
  problem this context solves, in business language.
- **[Ubiquitous Language](/contexts/order-management/ubiquitous-language)** — the exact vocabulary
  this context uses: Order, OrderLine, Status, Allocation, Release, Promise,
  Hold, Backordered, FulfillmentClass.
- **[Bounded Context Canvas](/contexts/order-management/bounded-context-canvas)** — the full
  [ddd-crew Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas):
  purpose, strategic classification, domain roles, inbound/outbound
  communication, business decisions, assumptions, verification metrics,
  open questions.
- **[Aggregate Design Canvas](/contexts/order-management/aggregate-design-canvas)** — the full
  [ddd-crew Aggregate Design Canvas](https://github.com/ddd-crew/aggregate-design-canvas)
  for the `Order` aggregate: state transitions, invariants, commands,
  events, throughput, size.
- **[Domain Events](/contexts/order-management/domain-events)** — the ten past-tense events this
  context raises, and which three are forwarded to Kafka as integration events.

## Elsewhere

- **Repository:** [github.com/claudioed/order-management](https://github.com/claudioed/order-management)
- **Own docs site:** [claudioed.github.io/order-management](https://claudioed.github.io/order-management/)
- **Fleet context map:** [Context Map](/strategic-design/context-map)
