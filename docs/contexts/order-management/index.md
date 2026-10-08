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

<span className="badge-generic">Generic</span>/<span className="badge-supporting">Supporting</span> — a rare acknowledgment in this fleet that DDD's
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
[ADR-0014](https://github.com/IQVO/order-management/blob/develop/docs/docs/adr/0014-promise-derived-from-fulfillment-capability.md),
re-promised when fulfillment reports a missed CPT per
[ADR-0018](https://github.com/IQVO/order-management/blob/develop/docs/docs/adr/0018-repromise-order-consumer-and-order-repromised.md)),
release of allocated work (now choreographed over Kafka to `wes-work-planning`, per
[ADR-0005](https://github.com/IQVO/order-management/blob/develop/docs/docs/adr/0005-choreographed-release-via-kafka.md)),
and cancellation up to the release boundary. Since
[ADR-0020](https://github.com/IQVO/order-management/blob/develop/docs/docs/adr/0020-network-originated-demand-hold-and-deadline-feasibility.md)
it also accepts **held**, deadline-constrained orders from
`network-fulfillment` (allocate now, release or cancel later).

Before it existed, "an order" was not a modelled thing anywhere in this
platform — it was an unowned, unvalidated string, independently reinvented
three different ways: `demandRef` on `inventory-storage`'s `Reservation`,
`reference` on `wes-work-planning`'s `WorkUnit`, and `Reference` on
`fulfillment-execution`'s `Task`. This context makes `OrderId` a real
identity and becomes the upstream that supplies it to the others.

## This context's pages

- [Business Context](/contexts/order-management/business-context): the
  domain vision and the problem this context solves, in business language.
- [Ubiquitous Language](/contexts/order-management/ubiquitous-language):
  the exact vocabulary this context uses, including Order, OrderLine,
  Status, Allocation, Release, Promise, Hold, Backordered and
  FulfillmentClass.
- [Core Domain Chart](/contexts/order-management/core-domain-chart)
  ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts)):
  why this context sits between Generic and Supporting.
- [Bounded Context Canvas](/contexts/order-management/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, strategic classification, domain roles, inbound and outbound
  communication, business decisions, assumptions, verification metrics and
  open questions.
- [Context Map](/contexts/order-management/context-map)
  ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)):
  every upstream and downstream relationship with its pattern, technology
  and status.
- [Aggregate Design Canvas](/contexts/order-management/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  the `Order` aggregate, with its state transitions, invariants, commands,
  events, throughput and size.
- [Domain Events](/contexts/order-management/domain-events): the ten
  past-tense events this context declares. Three of them
  (`OrderAllocated`, `OrderPartiallyAllocated` and `OrderRepromised`) go to
  the integration topic `warehouse.order-management.events`. The page also
  covers the CloudEvents types it consumes from sibling contexts. On
  `develop` it also consumes `product-master`'s `ProductClassified` into a
  local `product_classification_copy`
  ([ADR 0036](https://github.com/IQVO/order-management/blob/develop/docs/docs/adr/0036-product-classification-local-copy.md);
  `PRODUCT_CLASSIFICATION_MODE=kafka` in the reference deployment), which
  the synced page does not list yet.
- [Domain Message Flow](/contexts/order-management/domain-message-flow)
  ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling)):
  key scenarios as commands, events and queries.
- [EventStorming](/contexts/order-management/eventstorming)
  ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)):
  process-level boards.
- [Class Diagram](/contexts/order-management/class-diagram): the domain
  model as it exists in the code.
- [Entity Relationship](/contexts/order-management/entity-relationship):
  the persisted tables.
- [Sequence Diagrams](/contexts/order-management/sequence-diagrams): the
  main runtime interactions.

Every page above except the Business Context is synced from the
`order-management` repository. This context has no Async API narrative
page. Its generated AsyncAPI reference is linked below.

## Elsewhere

- **Repository:** [github.com/IQVO/order-management](https://github.com/IQVO/order-management)
- **Own docs site:** [iqvo.github.io/order-management](https://iqvo.github.io/order-management/)
- **Generated references on this site:** [REST](/api-reference/rest/order-management/order-management-api) and [AsyncAPI](/api-reference/async/order-management)
- [ADR index](/adr): links to this context's own decision records.
- **Fleet context map:** [Context Map](/strategic-design/context-map)
