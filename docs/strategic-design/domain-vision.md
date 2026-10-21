---
id: domain-vision
title: Domain Vision
sidebar_label: Domain Vision
description: What the warehouse-systems platform does, and where it wins.
---

# Domain Vision

> Fulfill customer orders from many disparate SKUs at scale by accepting
> demand, holding stock under chaotic (random) storage with bin-accurate
> location tracking, and reliably orchestrating pick/pack/ship work across a
> mix of human and (future) robotic capacity — continuously balancing flow so
> no single process path becomes a bottleneck, while measuring both the
> physical warehouse structure and the workforce's own performance as
> first-class, independently evolvable concerns.

## Where this platform wins

Following the platform's reference research into how large fulfillment
operations actually differentiate (`amazon-fulfillment-ddd.md`, the shared
DDD reference document cited across every context's `CLAUDE.md`, §3.1–3.2),
the platform's competitive edge is **not** any single warehouse management (WMS)
capability in isolation — it is the **real-time orchestration loop** that
continuously reconciles three things that are each individually well
understood, but rarely reconciled well together in practice:

1. **What work exists** — orders accepted, allocated, and released
   (`order-management`, `inventory-storage`).
2. **What capacity exists** — staffed, certified, path-eligible labor
   (`workforce-management`) and installed station/equipment capacity
   (`fulfillment-execution`).
3. **How work should flow right now** — waveless release and flow balancing
   across process paths, re-planned continuously rather than computed once
   (`wes-work-planning`).

Everything else in the platform — physical location structure
(`facility-layout`), the operator-configurable path catalogue
(`process-path-management`), and actual-vs-standard performance scoring
(`labor-performance`) — exists to feed that orchestration loop trustworthy,
current facts, never to make decisions on its own.

## The seventeen contexts on this site, one sentence each

| Context | One-sentence purpose |
| --- | --- |
| `order-management` | Accepts orders, allocates stock, and releases work — the missing upstream front door. |
| `inventory-storage` | The authoritative source of stock truth under chaotic storage; owns reservations and applies hazmat placement and DOT segregation from a local copy of product-master's classification. |
| `wes-work-planning` | The conductor: waveless release and continuous flow balancing across process paths. |
| `fulfillment-execution` | The Pick/Pack/SLAM task lifecycle; claims, executes, and completes floor work. |
| `workforce-management` | Certifies, assigns, and tracks labor against process-path capability requirements. |
| `facility-layout` | The physical warehouse structure — site, zone, aisle, coded location — as a Generic subdomain. |
| `process-path-management` | The operator-configurable catalogue of process paths (PICK/PACK/REBIN/SLAM), extracted once instead of duplicated. |
| `labor-performance` | Scores actual-vs-standard task performance per associate; a pure downstream observer. |
| `warehouse-ops-agent` | An agentic read-side aggregator (daily brief, exception correlation) and the console's BFF; owns no domain aggregate. |
| `network-fulfillment` | The anti-corruption layer to an external retail fulfillment network: polls network demand, places it with `order-management` as a held order, and owns the acknowledgement deadline. |
| `warehouse-planning` | Answers whether the warehouse can process the demand assigned to it: composes labor, station and other constraints into path capacity and records capacity plans with shortage and bottleneck detection. |
| `product-master` | The single source of truth for what a SKU is: its handling classification (taken over from `inventory-storage`) and its declared and measured physical profile, published as events that four contexts keep local copies of. |
| `network-inventory-planning` | Recommends inter-warehouse stock transfers from fail-closed local facts and carries an operator-approved transfer through reservation, floor work and destination stow as a saga, without ever moving stock itself. |
| `inbound-receiving` | Everything before the first stow: the advance ship notice, the dock appointment and the receipt with its discrepancies (Short, Over, Damaged); hands good units to `inventory-storage` as events. Decided 2026-10-08, built and deployed in the reference cluster. |
| `slotting-optimization` | Decides which SKUs deserve a forward pick slot: ranks SKUs by pick velocity, proposes a slot plan under the `abc-velocity-v1` policy, and publishes the approved forward-pick map after a human approves it; the moves are then executed as `RELOCATE` work by `wes-work-planning` and `fulfillment-execution` and recorded by `inventory-storage`, and this context reads the progress back. Decided 2026-10-08, built and deployed in the reference cluster. |
| `pick-face-replenishment` | Keeps every forward pick face stocked: holds a min/max policy per site and SKU, watches bin levels through event-fed local copies and, when a face reaches its minimum, requests a move from the fullest reserve bin; it closes the request when `inventory-storage` records the relocation. It never creates floor work and never writes the ledger. Decided and merged 2026-10-17; deployed in the reference cluster since 2026-10-20/21. The `inventory-storage` ends of the chain behind it (the `BinStockLevelChanged` producer, the `REPLENISHMENT` relocation of a completed `REPLENISH` task) and the `fulfillment-execution` `REPLENISH` task are built, and `wes-work-planning` plans `REPLENISH` work from its requests (its ADR 0042, with the `REPLENISH` path from `process-path-management`'s ADR 0036), so the whole chain exists on `develop`; the planner's consumer is opt-in and `REPLENISHMENT_MODE=kafka` is set in the reference deployment, but no request has been traced through the chain there yet. |
| `task-interleaving` | After a station completes a task, ranks the nearby open tasks by travel distance and issues an advisory, expiring hint of up to five candidates; it never assigns work and owns no task state. Decided and merged 2026-10-17; deployed in the reference cluster since 2026-10-20/21, and `fulfillment-execution` consumes the hint as a tie-break inside one priority band (its ADR 0051). |

See [Subdomain Classification](./subdomain-classification) for the
Core/Supporting/Generic verdict on each, and [Context Map](./context-map)
for how they actually integrate today.

## The real Amazon fulfillment flow, mapped to what's built here

The platform's reference research (`amazon-fulfillment-ddd.md` §1, cited
above) documents the real, physical station-to-station flow inside an
Amazon fulfillment center — not an idealized textbook diagram, but the
actual inbound and outbound value streams described in Amazon's own public
material and industry trade coverage. This table is that flow, stage by
stage, against what this platform actually implements — so "which of these
is real code, and which is deliberately out of scope" is answerable in one
place instead of scattered across seventeen repos' own docs.

| Real Amazon FC stage | What physically happens | Built here? |
| --- | --- | --- |
| **Inbound dock** | Supplier/inter-FC trucks arrive; a receiving team unloads pallets onto the dock floor (first-come, first-served scheduling). | **Yes.** `inbound-receiving`'s `DockAppointment` aggregate books a door and a window, checks the carrier in and completes when the receipt closes. The truck and the unloading themselves stay physical and are not modeled. |
| **Receive** | Boxes are scanned and opened; goods are checked and staged (originally into totes/carts). | **Yes, in two steps.** `inventory-storage`'s `receiveStock` use case (item-scan staging, no bin yet) is live. `inbound-receiving` adds the step before it: an ASN, a `Receipt` with line-by-line counts and discrepancies, then a `ReceiptLineReceived` event that `inventory-storage` consumes to run `receiveStock`. |
| **Stow** | An associate (or robot) places each item into a coded bin. Storage is **chaotic/random** — no fixed product location; the item goes wherever there's free space, and the system records the exact bin scanned. | **Yes, and genuinely Amazon-accurate.** `inventory-storage`'s `stowStock` use case implements real chaotic stow (ADR-0002) with hazmat-zone segregation — not a simplification, the actual model. |
| **Pick** | On order placement the system identifies the bin; a robot brings the pod to the station (or the picker walks to it); the item is retrieved into a tote. | **Yes.** A `PICK` task in `fulfillment-execution`'s pull-dispatched (`claimNext`) task lifecycle, one of `process-path-management`'s four operator-configurable path types. |
| **Consolidate / convey** | A full tote is routed to packing; for a multi-line order, independently-picked lines converge before packing can start. | **Yes.** `fulfillment-execution`'s `REBIN` task type + its `OrderConsolidation` aggregate (ADR-0016) — the fan-in tracker that waits for every line of an order before creating its `PACK` task. Single-line orders skip this, matching the reference material's own note that "single-item shipments skip Induct and Rebin." |
| **Pack** | The tote is scanned; a box/bag size is suggested; the associate builds, tapes, and barcodes the carton. | **Yes.** A `PACK` task; sealing produces a `Package` aggregate (`POST /tasks/{id}/seal-package`), gated on scanned contents. Cartonization (box-size selection) is explicitly NOT implemented — flagged as its own future Generic Subdomain rather than duplicated logic. |
| **SLAM** (Scan, Label, Apply, Manifest) | Packages are weighed against expected weight, labeled, and manifested to a carrier; a mismatch diverts the package rather than shipping it. | **Yes.** `POST /packages/{id}/slam` in `fulfillment-execution`, with the weigh-check invariant enforced (`pack.WeightTolerance`) and a real diversion path (`WeightDiscrepancyDetected` + `PackageDiverted`). |
| **Ship sort** | A scanner assigns each package a chute by destination, routing it to the correct outbound trailer. | **Deliberately not built.** `fulfillment-execution` ADR-0015 draws this exact boundary as a structural anti-corruption-layer seam: WCS/equipment (conveyors, sorters, print-and-apply heads) is documented Customer/Supplier + Conformist, "buy don't build," with an `EquipmentCommandPort` outbound port that exists specifically so equipment vocabulary never leaks into task-dispatch domain code before a real WCS integration is ever scoped. |
| **Outbound / load** | Trucks are loaded; shipments leave for a sortation center, then a delivery station, then the customer. | Not modeled — same reasoning as inbound dock: physical logistics outside any bounded context's boundary. |

Two things worth being explicit about, since both are easy to get wrong by
skimming the catalogue alone:

- **`process-path-management`'s four path types (`PICK`/`PACK`/`REBIN`/`SLAM`)
  are not an arbitrary subset of the real flow — they are exactly the
  stages that are genuinely *labor/task* queues** (pull-dispatched,
  claimable, completable by a station) in this platform's model. Receive
  and Stow are real, Amazon-accurate stages too, but they are OLTP writes
  owned by `inventory-storage` against its stock aggregate, not
  pull-dispatched task types — a receiving/stowing associate's unit of
  work is "record this stock fact," not "claim the next task off a
  queue," so they were never candidates for the path catalogue in the
  first place. This is a modeling distinction, not a gap.
- **Ship sort is the one real Amazon stage with zero corresponding code**,
  and that absence is a first-class, load-bearing architectural decision
  (ADR-0015 in `fulfillment-execution`), not an oversight or a TODO. Adding
  it as a `process-path-management` catalogue entry or a `fulfillment-execution`
  task type would contradict that decision — sortation is equipment
  control (WCS), and this platform's own strategic classification treats
  "buy, don't build" for the equipment tier as settled, not open.

