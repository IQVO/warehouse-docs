---
id: index
title: inventory-storage
sidebar_label: Overview
description: The WMS-tier authoritative record of what stock is held where, and what portion of it is usable — chaotic storage, bin-accurate location, and revocable reservations.
---

# inventory-storage

<span className="badge-core">Core Subdomain</span> · WMS tier

**Inventory & Storage** is the WMS-tier authoritative record of *what is held
where, and what portion of it is usable*. It is one of the platform's twelve
domain bounded contexts, and it owns the "storing them under chaotic storage" clause
of the platform's domain vision — the truth that everything downstream
depends on.

The one sentence that explains the whole design:

> Every physical item has exactly one known bin, **or** it is flagged
> `Unlocated`.

Chaotic (random) stow, the item-scan + location-scan rule, cycle counting, and
the `Unlocated` state are all consequences of taking that sentence literally.

## What it owns

| Capability | What that means here |
| --- | --- |
| **Stock ledger** | `StockUnit` aggregates — a quantity of a SKU at a specific bin, with a lifecycle state. |
| **Bin-accurate location** | Chaotic (random) stow: any SKU may occupy any free bin; the system records the exact bin it landed in. |
| **Capacity enforcement** | A `Bin` has a capacity; the sum of stock stowed into it may never exceed it. |
| **Revocable reservations** | Allocation is a `Reservation` with a timeout that can always be revoked and re-satisfied from a different physical holding. |
| **Usable inventory** | The read model that actually constrains release: on-hand minus active reservations minus held/unlocated stock. |
| **Cycle counting** | Verifying a bin's physical contents against system records, reconciling shortfalls by flagging stock `Unlocated`. |
| **Placement and segregation at stow** | Hazmat zone placement and same-bin DOT segregation, enforced at stow time against a version-guarded local copy of `product-master`'s classification ([ADR-0034](https://github.com/IQVO/inventory-storage/blob/develop/docs/docs/adr/0034-product-master-owns-classification.md)). The classification itself (handling tags, temperature class, DOT hazard class) is owned by `product-master` since 2026-10-07. |

## What it deliberately does not own

- does not pick, pack, ship, or route associates — that is `fulfillment-execution` and `wes-work-planning`;
- does not plan labour or headcount — that is `workforce-management`;
- does not model the physical building (site, area, zone, aisle, bay, level, position) — that is `facility-layout`, a separate Generic subdomain;
- does not own product master data — `product-master` is the source of truth for a SKU's classification; `PUT /products/{sku}/classification` here answers `410` (`classification-moved`), and the deprecated `GET` serves the local copy;
- does not own bin existence as a place-in-the-building fact — `facility-layout` owns that; a `Bin` here is a flat, declaratively-registered capacity record, created/resized by inventory control via `PUT /bins/{binId}` (ADR-0025), not a node in the warehouse map.

## Where this fits in the platform

`inventory-storage` is an **Open Host Service** for bin-accurate location and
usable inventory. `wes-work-planning` is a Customer/Supplier downstream,
conforming to its Published Language (REST + the two published Kafka
events) with no write access to any of its aggregates. `order-management`
reserves and revokes stock over REST. `order-management`,
`wes-work-planning` and `fulfillment-execution` no longer call its
`GET /products/{sku}/classification`: each keeps its own local copy of
`product-master`'s `ProductClassified`. `network-fulfillment` reads
`GET /inventory/{sku}/usable` (opt-in) to compute its capability offers.
It consumes `facility-layout`'s `warehouse.facility.events` into a local
location-classification cache
([ADR-0013](https://github.com/IQVO/inventory-storage/blob/develop/docs/docs/adr/0013-location-classification-via-facility-events.md)),
`product-master`'s `warehouse.product-master.events` into its
`product_classifications` copy (`PRODUCT_MASTER_CONSUMER_GROUP`, ADR-0034,
set in the reference deployment), [`network-inventory-planning`](/contexts/network-inventory-planning)'s transfer
allocation commands (ADR-0030) and, off by default,
`fulfillment-execution`'s `TaskCompleted` to confirm picks (ADR-0035). Its
legacy `ProductClassified` is emitted only by the one-shot
`republish-product-classifications` backfill, for `product-master`'s
migration importer.
Every REST and MCP endpoint is unauthenticated by deliberate decision
([ADR-0015](https://github.com/IQVO/inventory-storage/blob/develop/docs/docs/adr/0015-remove-rest-identity-layer.md)). See the
[Bounded Context Canvas](/contexts/inventory-storage/bounded-context-canvas) for the full picture of
who calls in and who is called out to.

## This context's pages

- [Business Context](/contexts/inventory-storage/business-context): the
  domain vision in business language, covering chaotic storage, revocable
  reservations and usable inventory.
- [Ubiquitous Language](/contexts/inventory-storage/ubiquitous-language):
  the exact vocabulary, taken from the domain code.
- [Core Domain Chart](/contexts/inventory-storage/core-domain-chart)
  ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts)):
  why this context is Core.
- [Bounded Context Canvas](/contexts/inventory-storage/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, strategic classification, domain roles, communication, business
  decisions, assumptions and open questions.
- [Context Map](/contexts/inventory-storage/context-map)
  ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)):
  every upstream and downstream relationship with its pattern, technology
  and status.
- [Aggregate Design Canvas](/contexts/inventory-storage/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  `StockUnit` and `Reservation`, both aggregate roots.
- [Domain Events](/contexts/inventory-storage/domain-events): all eleven
  past-tense events this context raises. Two of them (`StockReserved` and
  `ReservationRevoked`) cross the service boundary on the integration topic.
- [Domain Message Flow](/contexts/inventory-storage/domain-message-flow)
  ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling)):
  key scenarios as commands, events and queries.
- [EventStorming](/contexts/inventory-storage/eventstorming)
  ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)):
  process-level boards.
- [Class Diagram](/contexts/inventory-storage/class-diagram): the domain
  model as it exists in the code.
- [Entity Relationship](/contexts/inventory-storage/entity-relationship):
  the persisted tables.
- [Sequence Diagrams](/contexts/inventory-storage/sequence-diagrams): the
  main runtime interactions.
- [Async API](/contexts/inventory-storage/async-api): the Kafka integration
  in narrative form, with a link to the generated AsyncAPI reference.

Every page above except the Business Context and the Async API narrative
is synced from the `inventory-storage` repository.

## Elsewhere

- **Repository:** [github.com/IQVO/inventory-storage](https://github.com/IQVO/inventory-storage)
- **This context's own documentation site** (ADRs, architecture, quickstart, generated OpenAPI/AsyncAPI reference) is built from [`docs/docs/`](https://github.com/IQVO/inventory-storage/tree/develop/docs/docs) in the repository above by its own `docs.yml` workflow.
- **Generated references on this site:** [REST](/api-reference/rest/inventory-storage/inventory-storage-api) and [AsyncAPI](/api-reference/async/inventory-storage).
- [ADR index](/adr): links to this context's own decision records.
