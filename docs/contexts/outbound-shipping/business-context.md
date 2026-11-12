---
id: business-context
title: Business Context
sidebar_label: Business Context
description: "Why what leaves on which trailer is its own bounded context — load planning from the first manifest, scan-driven staging and loading, ship-confirm on the physical departure, the bill of lading — and what the context deliberately does not do."
---

# Business Context

Written here from the context's ADRs under `docs/adr/` in
[IQVO/outbound-shipping](https://github.com/IQVO/outbound-shipping) (0001 to
0007), its own `docs/docs` pages (introduction, integration, runbook) and its
`apis/openapi.yaml` / `apis/asyncapi.yaml`, checked against `develop`
(`1a071bb`) on 2026-11-09. The ADR set, the deployment status and the pinned
contracts were re-checked against `develop` (`7ce7b14`) and `warehouse-infra`
`develop` (`db829ff`) on 2026-11-11.

## The gap

`fulfillment-execution` stops at `PackageManifested`: the package is packed and
labelled. `yard-management` owns the trailer, the door work, the seal and the
departure, and is the only recorder of physical facts (its YD-0004). Between
the two nothing owned staging, what is on a load, the bill of lading, or the
fact that the goods left. An order's last state was *Released*.

A load is not the yard's concern (the yard knows a trailer and a door, not
which packages are on it) and not the picking floor's (packing ends at the
manifest). It is a context of its own, consumer-first: every state change
starts from a fact another context published, or from a scan by a dock
operator (ADR 0001).

## What it owns

| Fact | Value |
| --- | --- |
| Subdomain class | **Supporting** (ADR 0001) |
| Tier | **WMS** (CloudEvents subdomain segment `wms`) |
| Aggregates | `OutboundLoad`, `ShippingPackage` and `BillOfLading` (ADR 0001) |
| Binaries | two: `cmd/api` (REST, six Kafka consumers, the outbox relay) and `cmd/mcp` (read-only MCP server). No `cmd/a2a`, no separate relay or projector binary |
| Data store | one Postgres database (embedded migrations, one pair). `DATABASE_URL` and `KAFKA_BROKERS` are mandatory; real Postgres and real Kafka only |
| Kafka | publishes thirteen types on `warehouse.outbound-shipping.events` and an analytics twin; consumes nine types from five sibling topics plus its own analytics stream |
| Auth | none (fleet-wide decision) |
| Deployment | released `v0.1.0` (2026-11-11) with its Helm chart merged; registered and image-pinned in `warehouse-infra` `develop` (PR 205); **not applied**: no pod in the reference cluster, so nothing runs and no edge is live |

## The lifecycle

1. **Plan (consumer-driven).** A `PackageManifested` resolves to a cutoff key
   (site, cpt, operating date, ship method) through the local copy of the
   cutoff schedule. The first package of a key plans an `OutboundLoad`
   (`LoadPlanned`); later ones join it. One open load per key is a domain
   invariant. A manifest without `site_id` is ignored and plans nothing: the
   producer omits `site_id` today because the order-work chain has no source
   for it yet (ADR 0003).
2. **Door and loading (facts, not REST).** An outbound `DockAppointmentBooked`
   naming the load's cutoff assigns the door (`LoadDoorAssigned`); a
   `TrailerDocked` at that door attaches the trailer and starts loading
   (`LoadingStarted`). There is no REST route to start loading.
3. **Stage, load, unload (operator, REST).** A package moves to `STAGED` at a
   Staging location of its site, to `LOADED` through its load's door, and back
   to `STAGED`. A `PackageDiverted` short-ships a package with reason
   `DIVERTED`.
4. **Close, reopen, cancel (operator, REST).** A load closes only when every
   package is loaded or short-shipped with a reason. A supervisor can reopen a
   closed load or cancel a planned one that has no packages.
5. **Ship-confirm on the physical departure (consumer-driven, terminal).** A
   `TrailerDeparted` from `yard-management` confirms a `CLOSED` load:
   `ShipmentConfirmed` (carrying the distinct orders), packages `SHIPPED`, and
   one `BillOfLading` issued with the yard's seal. A departure that arrives
   while the load is still `LOADING` never confirms: it flags every package not
   loaded with `PackageMissedLoad` and leaves the load to a supervisor
   (ADR 0002). The two facts travel on different topics, so a departure that
   arrives before the close is handled, flagged, and never confirmed.
6. **Sweep (operator or scheduler, REST).** `POST /missed-load-sweeps` flags,
   exactly once per package, every staged or expected package whose load's
   cutoff has passed.
7. **Report.** `GET /reports/load-adherence` and the MCP tools `loads_at_risk`
   and `missed_loads` read the board and the package store.

## Why ship-confirm follows the departure

Many warehouse systems treat ship-confirm as an operator step at load close.
Here that would make "shipped" true before the truck left, and wrong forever if
it never did: the fleet would again tell the network about a shipment on a
belief (ADR 0002, ADR 0004). `ShipmentConfirmed` is therefore a physical fact.
The price, written in the ADR: no bill of lading exists before departure, so a
carrier that needs the document in hand before leaving is not served by v1.

## What it deliberately does not do (v1)

- No transportation management: no rating, no tendering (the network and the
  carriers own it).
- No pallets, no load sequencing, no master bill of lading (ADR 0001, D4);
  v1 ships packages.
- No sortation or automated loading equipment.
- No retail-network edge: no `retailnetwork.*` topic is consumed or produced.
  `network-fulfillment` stays the only channel to the network.
- No live REST or MCP lookup of a sibling, ever: neighbours' data arrives as
  event-fed local copies.
- It never writes order state: `order-management` marks lines shipped from
  `ShipmentConfirmed`.

## Verification

Per its own pages: godog scenarios under `features/` (including the departure
before close case), architecture fitness tests in `internal/architecture`, a
consumed-type tests against the pinned yard-management and dock-scheduling contracts
(`TestConsumedYardTypesMatchTheProducersIntegrationContract`, ADR 0006, and
`TestDockAppointmentBookedMatchesTheProducersIntegrationContract`, ADR 0007) gated
in CI by `pinned-contracts`, and integration tests on real Postgres and Kafka.
This page states what the repository's documentation says; the aggregator did
not run the binaries.
