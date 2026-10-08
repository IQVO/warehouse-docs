---
id: bounded-context-canvas
title: Bounded context canvas
sidebar_label: Bounded context canvas
description: The ddd-crew Bounded Context Canvas for inbound-receiving, written from the 2026-10-08 decision log before any code exists.
---

# Bounded context canvas

:::info[Written here, from the decision log]
This canvas is hand-written for this site from the 2026-10-08 plan and its
pinned contracts. `inbound-receiving` has no code yet, so unlike the other
contexts' canvases it is **not** a synced copy and cites no source file.
When the repository ships its own canvas, replace this page with the synced
copy.
:::

Following the ddd-crew [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas).

## Name

**Inbound Receiving** (`inbound-receiving`, Go module
`github.com/claudioed/inbound-receiving`, GitHub `IQVO/inbound-receiving`).

## Purpose

Record what is expected, when it arrives and what was actually received,
before any stock exists: take a supplier's advance ship notice, book a dock
door and window, count the delivery line by line against the ASN, and report
the discrepancies when the receipt closes. Hand good units to
`inventory-storage` as events. It books no stock and answers no stock
question.

## Strategic Classification

| Axis | Verdict | Evidence |
| --- | --- | --- |
| Domain | **Supporting** | Decision 3: the ASN, appointment and discrepancy rules differ per retailer, so they are not generic, and nobody chooses a warehouse for how it records a receipt, so they are not Core. See [Subdomain Classification](/strategic-design/subdomain-classification). |
| Business model | **Cost reduction and compliance** | An accurate receipt and discrepancy record is what later stock and supplier disputes rest on. |
| Evolution | **Custom-built** (genesis) | Decided 2026-10-08; no code yet. |

## Domain Roles

| Role | Applies? | Notes |
| --- | --- | --- |
| Specification context | Yes | The ASN states what is expected. |
| Execution context | Yes (primary) | It records what physically happened at the dock: check-in, counts, condition. |
| Gateway / Open Host Service | Yes | REST plus the `warehouse.inbound-receiving.events` Published Language. |
| Analysis context | No | A discrepancy is a per-line comparison, not a computation over sets. |
| Analytics / reporting | Planned | `warehouse.inbound-receiving.analytics` is reserved in the pinned contracts. The read side is a later phase. |

## Inbound Communication

| Collaborator | Message | Type | Channel | Relationship |
| --- | --- | --- | --- | --- |
| Supplier-facing operator or integration | Register or cancel an ASN | Command | REST `POST /asns`, `POST /asns/{asnNumber}/cancel` | This context is the OHS |
| Dock planner | Book, check in, cancel an appointment | Command | REST `POST /appointments`, `POST /appointments/{id}/check-in`, `POST /appointments/{id}/cancel` | OHS |
| Receiving associate | Open a receipt, receive a line, close it | Command | REST `POST /receipts`, `POST /receipts/{id}/lines`, `POST /receipts/{id}/close` | OHS |
| Operator, console, agent | List and get ASNs, appointments, receipts, docks | Query | REST `GET /asns`, `GET /appointments`, `GET /receipts`, `GET /docks` and the `{id}` variants | OHS |
| `product-master` | `ProductRegistered` | Event | Kafka `warehouse.product-master.events`, `com.warehouse.wms.product-master.product.ProductRegistered` | Conformist with a local copy (SKU exists); in progress |
| `facility-layout` | `LocationSlotRegistered`, `LocationSlotDecommissioned` | Event | Kafka `warehouse.facility.events`, `com.warehouse.wms.facility-layout.locationslot.*` | Conformist with a local copy (inbound dock doors); in progress |

No REST endpoint is authenticated (the fleet-wide revert). Create `POST`s take
an `Idempotency-Key`.

## Outbound Communication

The context makes **no** synchronous call to any sibling. Everything outbound
leaves through the transactional outbox.

| Collaborator | Message | Type | Channel | Relationship |
| --- | --- | --- | --- | --- |
| `inventory-storage` | `ReceiptLineReceived` (condition `Good` becomes `ReceiveStock(sku, quantity)`) | Event | Kafka `warehouse.inbound-receiving.events`, `com.warehouse.wms.inbound-receiving.receipt.ReceiptLineReceived` | This context upstream, Published Language; the consumer is in progress |
| none today; planned: `warehouse-planning` | `DockAppointmentBooked` | Event | same topic, `...dockappointment.DockAppointmentBooked` | Planned inbound-labor demand; not built |
| none today | `ASNRegistered`, `ASNCancelled` | Event | same topic, `...asn.*` | Published contract |
| none today | `DockAppointmentCheckedIn`, `DockAppointmentCancelled`, `DockAppointmentCompleted` | Event | same topic, `...dockappointment.*` | Published contract |
| none today | `ReceiptOpened`, `ReceiptClosed` | Event | same topic, `...receipt.*` | Published contract |

## Ubiquitous Language

Fleet-level terms are in the [Ubiquitous Language](/strategic-design/ubiquitous-language)
overview and the [Glossary](/glossary). Top terms: **ASN**, **Dock
appointment**, **Dock door**, **Receipt**, **Receipt line**, **Condition**
(`Good` or `Damaged`), **Discrepancy** (`Short`, `Over`, `Damaged`).

## Business Decisions

1. Receiving is its own context, not part of `inventory-storage` and not
   merged with slotting (decision 1).
2. The handover to `inventory-storage` is event-driven. There is no
   synchronous call in either direction (decision 5).
3. Only condition `Good` becomes receivable stock in v1. Damaged units are
   recorded on the receipt, and quarantine is a later ADR (decision 5).
4. Stow stays an RF action with an item scan and a location scan
   (decision 5).
5. Local copies are event-fed and convergent, and their modes default to
   `permissive` with the cluster setting `kafka` (decision 6).
6. A discrepancy is one of `Short`, `Over` or `Damaged`, reported when the
   receipt closes.
7. The appointment completes when the receipt opened from it closes.
8. Inbound-labor demand from `DockAppointmentBooked` is a planned edge, not
   built (decision 9).
9. No authentication, a transactional outbox, optimistic concurrency, and
   CloudEvents built through the repository's own helper (decision 10).

## Assumptions

- A SKU on an ASN line can be checked against a local copy of
  `ProductRegistered` without a live lookup.
- Dock doors can be taken from facility-layout location events (the `role`
  and `dockFlow` fields) without a live lookup.
- `inventory-storage` can accept the receipt line as a staged receipt (its
  `StockReceived` seam, unlocated until stow).

## Verification Metrics

None exist yet, because there is no code. The fleet rules the build must
meet are: a golden exact-JSON test per published type, consumers that dedupe
on the CloudEvents `id` in the same transaction as the effect, and
testcontainers-only Kafka and Postgres integration tests. This section is to
be filled from the repository's own canvas.

## Open Questions

- How are damaged units quarantined, and does that become its own aggregate?
  (A later ADR; v1 only records them.)
- What inbound process path would `warehouse-planning` need to turn
  `DockAppointmentBooked` into labor demand? (A separate ADR there.)
- Which `role` and `dockFlow` values on a `LocationSlotRegistered` event
  identify an inbound dock door? The pinned contract carries both fields;
  the rule belongs in the context's ADR 0003.
- Which of ASN lines, appointments and receipts need a per-supplier policy
  object first?
