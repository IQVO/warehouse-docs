---
id: index
title: Facility Layout
sidebar_label: Introduction
description: The warehouse map — Site, Zone, Aisle and coded LocationSlots, and the rules for what may legally be stored where. A Generic Subdomain, extracted once.
---

# Facility Layout

<span className="badge-generic">Generic Subdomain</span> · WMS-adjacent, extracted once

**Facility Layout** is the bounded context that owns *where things physically
are in the building*: a site's structural hierarchy — Site → Area → Zone →
Aisle → Bay → Level → Position — and the coded storage slots inside it.

It does **not** own occupancy or stock. That stays in `inventory-storage`'s
`Bin` and `StockUnit` aggregates. What this service owns is whether a coded
location **exists**, **is active**, and **is legal for a given kind of
storage unit** — the warehouse map that other contexts read but never write.

```
WH1-STOR-AMB-A07-03-02-B
 |    |    |   |   |  |  `-- Position: left-to-right slot on the level
 |    |    |   |   |  `----- Level:    vertical level / shelf
 |    |    |   |   `-------- Bay:      bay / section along the aisle
 |    |    |   `------------ Aisle:    physical corridor
 |    |    `---------------- Zone:     behavioral class (AMB/CHL/FRZ/HAZ/FWD/RSV)
 |    `--------------------- Area:     coarse functional area (STOR/RCV/PACK/STAGE)
 `-------------------------- Site:     the physical facility
```

## Why it is a Generic Subdomain

Physical-location structure is well understood, has an established industry
pattern, and is not where the platform wins competitively. It is needed by
contexts on both sides of the WMS/WES line — `inventory-storage` needs
location validity to accept a stow, `wes-work-planning` and
`fulfillment-execution` need zone/aisle adjacency for travel-path and
congestion reasoning — and neither owns it. Following the platform's DDD
reference discipline of *"extract generic logic instead of duplicating it,"*
it is extracted once into its own bounded context and its own service,
rather than a package bolted onto `inventory-storage`. See
[Business context](/contexts/facility-layout/business-context) and
[Bounded Context Canvas](/contexts/facility-layout/bounded-context-canvas) for the full argument.

## Integration status

This context is an **Open Host Service** with a Published Language, and it
has no outbound dependency on any other service. It calls no one and
consumes no other context's events. Its relationships, per its own
[Context Map](/contexts/facility-layout/context-map), are:

- **Kafka, `warehouse.facility.events`**: with `EVENT_PUBLISHER=kafka`, all
  twelve domain events are published as CloudEvents 1.0 (structured mode,
  `type` prefix `com.warehouse.wms.facility-layout.`), through a
  transactional outbox when a database is configured (ADR 0018). The
  contract is
  [`apis/asyncapi.yaml`](https://github.com/IQVO/facility-layout/blob/develop/apis/asyncapi.yaml).
  There are two downstream consumers:
  - `inventory-storage` feeds a local location-classification cache from
    `ZoneRegistered`, `LocationSlotRegistered` and
    `LocationSlotDecommissioned` (`LOCATION_LOOKUP_MODE=kafka`) for its
    stow-time placement check.
  - `warehouse-planning` folds `LocationSlotRegistered` and
    `LocationSlotDecommissioned` into a storage-position and station tally.
- **REST**: `wes-work-planning` calls `GET /distance` for travel distance
  (`TRAVEL_DISTANCE_MODE=http`). `fulfillment-execution` has an opt-in
  `GET /locations/{locationCode}` lookup for a slot's functional `role`
  (`LOCATION_ROLE_MODE=http`, default `permissive`). `inventory-storage`
  keeps `GET /locations/{locationCode}/classification` as a wired rollback
  path (`LOCATION_LOOKUP_MODE=http`). The geometry and role features behind
  these calls come from ADR 0016 (location roles) and ADR 0017 (geometry and
  travel graph).
- **MCP and reports**: `warehouse-ops-agent` reads `list_sites`,
  `get_site_layout`, `get_zone_grid` and `estimate_travel_distance`, plus
  the catalog-growth report.
- **Console**: the `facility-mfe` Module Federation remote is this
  context's own operator UI.

`workforce-management` is Separate Ways by design. REST and MCP are
unauthenticated by deliberate decision (ADR 0015).

## This context's pages

- [Business Context](/contexts/facility-layout/business-context): the
  location-code hierarchy, and why this concern is extracted rather than
  duplicated.
- [Ubiquitous Language](/contexts/facility-layout/ubiquitous-language): the
  exact vocabulary this context speaks.
- [Core Domain Chart](/contexts/facility-layout/core-domain-chart)
  ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts)):
  why this context is Generic.
- [Bounded Context Canvas](/contexts/facility-layout/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, classification, communication, decisions and open questions.
- [Context Map](/contexts/facility-layout/context-map)
  ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)):
  every downstream relationship with its pattern, technology and status.
- [Aggregate Design Canvas](/contexts/facility-layout/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  `LocationSlot`, the leaf aggregate, and its place in the Site, Zone and
  Aisle hierarchy.
- [Domain Events](/contexts/facility-layout/domain-events): the twelve
  past-tense events published to `warehouse.facility.events`, and who
  consumes them.
- [Domain Message Flow](/contexts/facility-layout/domain-message-flow)
  ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling)):
  key scenarios as commands, events and queries.
- [EventStorming](/contexts/facility-layout/eventstorming)
  ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)):
  process-level boards.
- [Class Diagram](/contexts/facility-layout/class-diagram): the domain
  model as it exists in the code.
- [Entity Relationship](/contexts/facility-layout/entity-relationship): the
  persisted tables.
- [Sequence Diagrams](/contexts/facility-layout/sequence-diagrams): the main
  runtime interactions.

Every page above except the Business Context is synced from the
`facility-layout` repository. This context has no Async API narrative page.

## Elsewhere

- [Repository](https://github.com/IQVO/facility-layout): source, ADRs, and
  the real `apis/openapi.yaml` and `apis/asyncapi.yaml`.
- [REST API Reference](/api-reference/rest/facility-layout/facility-layout-api)
  and [AsyncAPI Reference](/api-reference/async/facility-layout), generated
  from those specs.
- [ADR index](/adr): links to this context's own decision records.
