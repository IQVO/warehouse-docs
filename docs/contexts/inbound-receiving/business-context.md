---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why everything before the first stow is its own bounded context — ASN, dock appointment and receipt with discrepancies — and how good units reach inventory-storage as events.
---

# Business Context

Sourced from the plan and decision log of 2026-10-08 for the two new WMS-tier
contexts, `inbound-receiving` and `slotting-optimization`. The context's own
ADRs 0001 to 0004 are being written in the
[IQVO/inbound-receiving](https://github.com/IQVO/inbound-receiving)
repository (`docs/adr/`, none on `develop` when this page was written) and,
once merged, are the authority where they differ from this page.

## The gap

The fleet has nothing before the first stow. `inventory-storage` receives
stock through `POST /stock/receive`, which is a bare quantity acknowledgement:
there is no record of what was announced, which carrier arrived at which door
and when, what was counted, or what did not match. The competitor research
that started this work (Manhattan Active SCE 26.2, Blue Yonder WMS Oct-2025,
SAP EWM 2025 FPS01, Infor WMS, and the Gartner WMS Magic Quadrant of
April 2026) treats labor, slotting, yard and performance as expected
capabilities and converges execution to include inbound. The fleet's own
[Domain Vision](/strategic-design/domain-vision) listed the inbound dock as
not modeled.

## What it plans to own

Three aggregates, each its own consistency boundary (decision 4):

- **`Asn`**: the advance ship notice, keyed by `asn_number`, with a supplier
  reference, an optional expected arrival and lines of `sku` and
  `expected_qty`. It can be registered and cancelled.
- **`DockAppointment`**: a booked door and time window for a carrier, covering
  one or more ASNs. It is booked, checked in, cancelled or completed. It is
  completed when the receipt opened from that appointment closes.
- **`Receipt`**: one delivery counted against an ASN. It is opened (optionally
  from an appointment and a door), receives lines one at a time with a
  condition of `Good` or `Damaged`, and is closed. On close it lists the
  **discrepancies** against the ASN: `Short`, `Over` or `Damaged`.

## The decisions that shape it

| # | Decision (FINAL, from the 2026-10-08 plan) |
| --- | --- |
| 1 | A new repository, `IQVO/inbound-receiving`, from the harness template (v2), module `github.com/claudioed/inbound-receiving`. A receipt is a transactional document workflow; slotting is a planning computation. They fail the same-aggregate test, so they are not merged. |
| 2 | CloudEvents subdomain **`wms`**: receiving books stock into the WMS stock ledger, so it sits with stock, layout and master data, not task execution. Same precedent as `product-master`. |
| 3 | Strategic classification **Supporting**: not generic (ASN, appointment and discrepancy rules differ per retailer), not the competitive core (the WES conductor stays Core). Those rules are replaceable policy objects. |
| 5 | The handover to `inventory-storage` is **event-driven**: `inventory-storage` consumes `ReceiptLineReceived` (condition `Good`) and runs its existing `ReceiveStock` use case. No synchronous REST or MCP call in either direction. Stow stays an RF action (item scan plus location scan). Damaged units are **not** booked as receivable stock in v1: they are recorded on the receipt, and quarantine is a later ADR. |
| 6 | Local copies, event-fed and convergent: `ProductRegistered` from `product-master` (does the SKU exist) and `LocationSlotRegistered` and `LocationSlotDecommissioned` from `facility-layout` (inbound dock doors). Each local-copy mode defaults to `permissive`; the cluster sets `kafka`. |
| 9 | `DockAppointmentBooked` as inbound-labor demand for `warehouse-planning` is a documented **planned** edge. `warehouse-planning`'s `CapacityPlan` has no inbound process path, and adding one is its own ADR there. |
| 10 | No authentication (the fleet revert), no cross-context synchronous calls, a transactional outbox, `Idempotency-Key` on create `POST`s, optimistic concurrency (a version column), CloudEvents 1.0 through the repository's own helper, testcontainers only. |

## What it deliberately does not own

- **Stock.** `inventory-storage` stays the system of record for what is held
  where. Inbound receiving publishes a fact, `ReceiptLineReceived`, and
  `inventory-storage` decides what to do with it.
- **Stow.** Placing an item in a bin remains an RF action in
  `inventory-storage`.
- **Damaged and quarantined stock.** Damaged units are recorded on the
  receipt and never become receivable stock in v1. Quarantine is a later ADR.
- **Inbound labor demand.** The event exists (`DockAppointmentBooked`), but
  nothing consumes it. That edge is planned, not built.

## No live cross-context lookup

Like `product-master`, this context makes no synchronous call to a sibling.
It validates a SKU against a local copy of `ProductRegistered` and a dock door
against a local copy of the facility-layout location events. Events leave
through a transactional outbox only.

## Contract summary

Pinned in the plan, producers and consumers build against these exact strings.
Every event is CloudEvents 1.0 in structured mode with
`source=/warehouse/inbound-receiving`, topic
`warehouse.inbound-receiving.events` and, for analytics,
`warehouse.inbound-receiving.analytics`. The type prefix is
`com.warehouse.wms.inbound-receiving.`.

| Type (after the prefix) | Kafka key | Consumer today |
| --- | --- | --- |
| `asn.ASNRegistered` | `asn_number` | none |
| `asn.ASNCancelled` | `asn_number` | none |
| `dockappointment.DockAppointmentBooked` | `appointment_id` | none; planned: `warehouse-planning` (not built) |
| `dockappointment.DockAppointmentCheckedIn` | `appointment_id` | none |
| `dockappointment.DockAppointmentCancelled` | `appointment_id` | none |
| `dockappointment.DockAppointmentCompleted` | `appointment_id` | none |
| `receipt.ReceiptOpened` | `asn_number` | none |
| `receipt.ReceiptLineReceived` | `asn_number` | `inventory-storage` (in progress) |
| `receipt.ReceiptClosed` | `asn_number` | none |

REST, behind Kong at `/api/inbound-receiving` (problem type base
`https://errors.inbound-receiving.warehouse-systems.dev/<slug>`):
`POST /asns`, `GET /asns`, `GET /asns/{asnNumber}`,
`POST /asns/{asnNumber}/cancel`; `POST /appointments`, `GET /appointments`
(filters door, state, from, to), `GET /appointments/{id}`,
`POST /appointments/{id}/check-in`, `POST /appointments/{id}/cancel`;
`POST /receipts` (opened from an ASN number and an optional appointment id),
`GET /receipts`, `GET /receipts/{id}`, `POST /receipts/{id}/lines`,
`POST /receipts/{id}/close`; and `GET /docks`.

## Honest scope today

- The repository is bootstrapped with `develop` protected and the template
  instantiated. There is no domain code, no published AsyncAPI and no OpenAPI
  yet, so this site holds no `apis/inbound-receiving/` specs and no generated
  reference. A later change adds them once the contract PRs merge.
- The `inventory-storage` consumer is in progress. Until it merges and the
  reference deployment sets its consumer group, `ReceiptLineReceived` has no
  live consumer.
- The planned build waves also cover an MCP server, an analytics read side, a
  `warehouse-ops-agent` MCP client, a console remote with a tile and the
  `warehouse-infra` wiring. None of them exists yet.
