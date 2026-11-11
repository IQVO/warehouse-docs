---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why everything before the first stow is its own bounded context — ASN, dock appointment and receipt with discrepancies — and how good units reach inventory-storage as events.
---

# Business Context

Sourced from the plan and decision log of 2026-10-08 for the two new WMS-tier
contexts, `inbound-receiving` and `slotting-optimization`, and refreshed
against the code on `develop`. The context's own ADRs 0001 to 0006 (under
`docs/adr/` in
[IQVO/inbound-receiving](https://github.com/IQVO/inbound-receiving)) are the
authority where they differ from this page.

## The gap

The fleet has nothing before the first stow. `inventory-storage` receives
stock through `POST /stock-receipts`, which is a bare quantity acknowledgement:
there is no record of what was announced, which carrier arrived at which door
and when, what was counted, or what did not match. The competitor research
that started this work (Manhattan Active SCE 26.2, Blue Yonder WMS Oct-2025,
SAP EWM 2025 FPS01, Infor WMS, and the Gartner WMS Magic Quadrant of
April 2026) treats labor, slotting, yard and performance as expected
capabilities and converges execution to include inbound. The fleet's own
[Domain Vision](/strategic-design/domain-vision) listed the inbound dock as
not modeled.

## What it owns

Three aggregates, each its own consistency boundary (decision 4):

- **`Asn`**: the advance ship notice, keyed by `asn_number`, with a supplier
  reference, an optional expected arrival and lines of `sku` and
  `expected_qty`. It can be registered and cancelled.
- **`DockAppointment`** (moved out): the booking of a door and time window
  moved to `dock-scheduling` (ADR 0019, plan YD-0002). Here it is a read-only
  `appointments` local copy fed by dock-scheduling's `DockAppointmentBooked`,
  `Cancelled`, `Rescheduled` and `DoorReassigned`, which a receipt validates
  against and takes its door from. The strangler is finished on `develop` for the
  migration code (stage E, ADR 0022, 2026-11-10): the backfill command, the
  legacy encoders and `Replay` are removed and the four `dockappointment` event
  types are no longer published. The deprecated `GET /appointments` reads and the
  three `410` write routes remain until a decision names a date.
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
| 9 | `DockAppointmentBooked` as inbound-labor demand for `warehouse-planning` was decided as a **planned** edge whose consumer needed its own ADR there. That ADR is `warehouse-planning` ADR 0017, which read this context's events until 2026-11-05; `warehouse-planning` ADR 0020 then moved the source to `dock-scheduling` (K28), and this context's four `dockappointment` types are retired (ADR 0022). |
| 10 | No authentication (the fleet revert), no cross-context synchronous calls, a transactional outbox, `Idempotency-Key` on create `POST`s, optimistic concurrency (a version column), CloudEvents 1.0 through the repository's own helper, testcontainers only. |

## What it deliberately does not own

- **Stock.** `inventory-storage` stays the system of record for what is held
  where. Inbound receiving publishes a fact, `ReceiptLineReceived`, and
  `inventory-storage` decides what to do with it.
- **Stow.** Placing an item in a bin remains an RF action in
  `inventory-storage`.
- **Damaged and quarantined stock.** Damaged units are recorded on the
  receipt and never become receivable stock in v1. Quarantine is a later ADR.
- **Inbound labor demand and the appointment.** The appointment, and the
  `DockAppointmentBooked` / `DockAppointmentCancelled` events that
  `warehouse-planning` turns into inbound-labor demand, belong to
  `dock-scheduling` (ADR 0019, `warehouse-planning` ADR 0020); this context
  keeps only a read-only copy.

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
| `receipt.ReceiptOpened` | `asn_number` | none |
| `receipt.ReceiptLineReceived` | `asn_number` | `inventory-storage` (its ADR 0037; opt-in by `INBOUND_RECEIPT_CONSUMER_GROUP`, set in the reference deployment) |
| `receipt.ReceiptCartonReceived` | see the spec | `inventory-storage` (identity only: links the carton's container, its ADR 0045/0046; same consumer group as `ReceiptLineReceived`), `network-fulfillment` (seller inbound loop, its ADR 0028) |
| `receipt.CartonDiscrepancyRaised` | see the spec | `exception-management` (its ADR 0006), `network-fulfillment` (its ADR 0028) |
| `receipt.ReceiptClosed` | `asn_number` | `network-fulfillment` (its ADR 0028) |
| `receipt.ReceiptStowCompleted` | `asn_number` | none yet (ADR 0021; this context's projector folds its analytics copy) |

The four `dockappointment` types (`DockAppointmentBooked`, `CheckedIn`,
`Cancelled`, `Completed`) are **retired**: stage E (ADR 0022) removed the code that
raised them and `apis/asyncapi.yaml` no longer declares them. Appointment events now
come from `dock-scheduling`.

REST, behind Kong at `/api/inbound-receiving` (problem type base
`https://errors.inbound-receiving.warehouse-systems.dev/<slug>`):
`POST /asns`, `GET /asns`, `GET /asns/{asnNumber}`,
`POST /asns/{asnNumber}/cancellations`; the deprecated reads `GET /appointments`
(filters door, state, from, to) and `GET /appointments/{id}`, and the three write routes
`POST /appointments`, `POST /appointments/{id}/check-ins` and
`POST /appointments/{id}/cancellations`, which answer `410` (moved to dock-scheduling or
yard-management);
`POST /receipts` (opened from an ASN number and an optional appointment id),
`GET /receipts`, `GET /receipts/{id}`, `POST /receipts/{id}/lines`,
`POST /receipts/{id}/closures`; and `GET /docks`.

## Honest scope today

- The service is built on `IQVO/inbound-receiving` `develop`: REST API,
  outbox, the two local-copy consumers, a read-only MCP server (`cmd/mcp`,
  ADR 0005), the analytics read side (`cmd/inbound-projector` and
  `cmd/inbound-reports`, ADR 0006), a Helm chart and the web remote
  `inbound_mfe`. This site holds its `apis/inbound-receiving/` specs, the
  generated references and the synced artifact pack.
- The reference deployment (`warehouse-infra` `develop`) runs it behind Kong
  at `/api/inbound-receiving`, with both local copies in `kafka` mode, and
  sets `inventory-storage`'s consumer group, so the `ReceiptLineReceived`
  handover is live end to end. `warehouse-ops-agent` reads it over MCP and
  the console mounts `inbound_mfe` at `/mfes/inbound-receiving/`.
- `warehouse-infra` documents one open issue: requests to
  `/api/inbound-receiving/reports/*` through Kong land on the OLTP route and
  return 404; the reports service works in-cluster.
- The appointment strangler (ADR 0019) is finished on `develop` for the migration
  code (ADR 0022, with dock-scheduling's ADR 0011, 2026-11-10); the deprecated
  appointment reads and the `410` write routes stay pending a decision, and the
  analytics projector still folds the historical `dockappointment` events.
