---
id: subdomain-classification
title: Subdomain Classification
sidebar_label: Subdomain Classification
description: Core, Supporting, or Generic — the fourteen contexts documented on this site, with the CloudEvents subdomain segment each one publishes under and the justification each context's own Bounded Context Canvas and Core Domain Chart give.
---

# Subdomain Classification

Domain-Driven Design splits a domain into **Core**, **Supporting** and
**Generic** subdomains by how much competitive advantage each one gives. Size,
difficulty and how interesting the code is do not decide it. The table below
gives the fleet verdict for the fourteen contexts documented on this site
(`network-inventory-planning` is not aggregated yet). Each verdict matches
the **Strategic Classification** section of that context's own
[Bounded Context Canvas](/contexts) and its point on its own Core Domain
Chart. The fleet-wide plot is on [Core Domain Chart](/strategic-design/core-domain-chart).
The two newest rows, `inbound-receiving` and `slotting-optimization`
(decided 2026-10-08), have a Bounded Context Canvas written from the
decision log but no Core Domain Chart yet.

The **CloudEvents subdomain** column is the `<subdomain>` segment of every
event `type` the context publishes:
`com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>`. See the
[Event Standard](/strategic-design/event-standard-cloudevents). That segment
groups contexts by **tier**: `wms` is the warehouse-management tier and `wes`
is the execution tier. It is not the same as the Core/Supporting/Generic
classification. For example, `facility-layout` is `wms` and Generic, while
`wes-work-planning` is `wes` and Core.

| Bounded context | Classification | CloudEvents subdomain | Business model (its canvas) | Evolution (its canvas) | Why (its canvas and chart) |
| --- | --- | --- | --- | --- | --- |
| `wes-work-planning` | <span class="badge-core">Core</span> | `wes` (type segment `work-planning`) | Cost reduction / throughput | Custom-built | The release decision is where the operation's speed is won or lost: CPT priority, waveless one-at-a-time admission, WIP backpressure, Drum-Buffer-Rope flow balancing. Replacing it with a vendor WES behind an ACL would drop it to Supporting. [Canvas](/contexts/wes-work-planning/bounded-context-canvas), [chart](/contexts/wes-work-planning/core-domain-chart) |
| `fulfillment-execution` | <span class="badge-core">Core</span> | `wes` | Cost reduction / operational efficiency | Custom-built | Pull-based dispatch with lease semantics is the throughput differentiator. The context's own chart splits it internally: Task dispatch and lease, and Rebin consolidation, are Core. Pack and SLAM are Supporting and kept thin. The analytics read side and WCS equipment control are Generic. [Canvas](/contexts/fulfillment-execution/bounded-context-canvas), [chart](/contexts/fulfillment-execution/core-domain-chart) |
| `inventory-storage` | <span class="badge-core">Core</span> | `wms` | Revenue enabler | Custom-built, moving towards Product | "Inventory & Slotting" is Core in the reference model. Revocable reservations and the chaotic-stow ledger are the differentiators: four aggregates and 30 tested aggregate invariants. Every customer promise rests on its *usable* answer. [Canvas](/contexts/inventory-storage/bounded-context-canvas), [chart](/contexts/inventory-storage/core-domain-chart) |
| `warehouse-planning` | <span class="badge-core">Core</span> | `wes` | Risk reduction / engagement creator | Custom-built, recently out of genesis | ADR 0001 introduces it as a Core Domain. No other context computes a normalized, cross-process effective capacity or a forward-looking capacity shortage. `workforce-management` stops at the path boundary, `facility-layout` knows structure but not throughput, and `inventory-storage` knows stock, which is not capacity. [Canvas](/contexts/warehouse-planning/bounded-context-canvas), [chart](/contexts/warehouse-planning/core-domain-chart) |
| `order-management` | <span class="badge-generic">Generic</span>/<span class="badge-supporting">Supporting</span> | `wes` | Compliance / engagement enabler | Intake: commodity. Allocation and hold/release: product. Capability-derived promise, routing and re-promise: custom | Intake on its own is commodity: the reference model files "Order Management / ERP interface" as Generic. The fulfillment rules layered on top lift it toward Supporting: fail-closed allocation, ship-complete, held network orders, and a promise derived from CPT schedule and path capacity. Its own chart places the context on the Supporting/Generic border. [Canvas](/contexts/order-management/bounded-context-canvas), [chart](/contexts/order-management/core-domain-chart) |
| `workforce-management` | <span class="badge-supporting">Supporting</span> | `wes` | Compliance / cost reduction | Product, with two custom-built parts (the idle-share trim and the installed-capacity ceiling) | Labor management is "important, industry-common". There is no optimiser or scoring function, and rebalancing is a human decision this context only records (ADR 0002). It is not Generic, because it is too tied to the fleet's process-path vocabulary for an off-the-shelf product to fit. [Canvas](/contexts/workforce-management/bounded-context-canvas), [chart](/contexts/workforce-management/core-domain-chart) |
| `labor-performance` | <span class="badge-supporting">Supporting</span> | `wes` | Compliance / cost reduction | Product | It only measures how well finished work matched a standard someone else configures. Engineered labor standards are a standard module in commercial labor-management products (its ADR 0002: "Supporting, not Core"). [Canvas](/contexts/labor-performance/bounded-context-canvas), [chart](/contexts/labor-performance/core-domain-chart) |
| `warehouse-ops-agent` | <span class="badge-supporting">Supporting</span> | `wes` (it publishes no events) | Cost reduction / operator productivity | Custom-built correlation policy. Product BFF shape | It correlates facts other contexts own and only recommends, with zero write tools. Caveat from its own canvas: it owns no aggregate, so it is not a bounded context in the aggregate-and-invariant sense. The fleet map still files it as Supporting. [Canvas](/contexts/warehouse-ops-agent/bounded-context-canvas), [chart](/contexts/warehouse-ops-agent/core-domain-chart) |
| `network-fulfillment` | <span class="badge-supporting">Supporting</span> | `wes` | Revenue-channel enabler | Custom-built ACL and acknowledgement protocol. `CapabilityOffer` is genesis → custom | It lets the building's capability be sold through an external network, but the knowledge it uses is owned elsewhere: feasibility is asked of `order-management`, never recomputed. It is Conformist to the network and an Anti-Corruption Layer for the fleet (its ADR 0001). [Canvas](/contexts/network-fulfillment/bounded-context-canvas), [chart](/contexts/network-fulfillment/core-domain-chart) |
| `product-master` | <span class="badge-supporting">Supporting</span> | `wms` | Compliance and risk reduction | Custom-built (genesis) | It keeps hazmat, temperature and fragile handling correct in every downstream flow, but nobody chooses the warehouse for how it records SKU master data: "necessary for every warehouse flow and specific to this warehouse's handling rules, but it is not where the business differentiates" (its ADR 0001). One aggregate, few rules. It took classification over from `inventory-storage` (ADR 0003). [Canvas](/contexts/product-master/bounded-context-canvas), [chart](/contexts/product-master/core-domain-chart) |
| `inbound-receiving` | <span class="badge-supporting">Supporting</span> | `wms` | Cost reduction / compliance (accurate receipt and discrepancy record) | Custom-built (genesis) | Not generic, because the ASN, dock-appointment and discrepancy rules differ per retailer. Not Core, because nobody chooses a warehouse for how it records a receipt, and the ASN, appointment and discrepancy rules are replaceable policy objects (decision 3 of the 2026-10-08 plan). [Canvas](/contexts/inbound-receiving/bounded-context-canvas) |
| `slotting-optimization` | <span class="badge-supporting">Supporting</span> | `wms` | Cost reduction (pick travel and labor) | Custom-built (genesis) | Not generic, because slotting policy differs per retailer. Not Core, because the competitive core stays the WES conductor, and the v1 policy `abc-velocity-v1` is a deterministic, replaceable policy behind a port (decisions 3 and 7 of the 2026-10-08 plan). [Canvas](/contexts/slotting-optimization/bounded-context-canvas) |
| `facility-layout` | <span class="badge-generic">Generic</span> | `wms` | Compliance / enabler | Product, heading toward commodity | The location hierarchy is the industry's WMS convention, adopted rather than invented, and location roles mirror commercial WMS location masters. It has to be correct, not clever. Its complexity is real (eight aggregate roots and a travel graph), but that complexity serves correctness, not differentiation. [Canvas](/contexts/facility-layout/bounded-context-canvas), [chart](/contexts/facility-layout/core-domain-chart) |
| `process-path-management` | <span class="badge-generic">Generic</span> | `wes` | Compliance / enabler | Custom-built, heading towards product/commodity | A process-path catalogue is well understood and does not differentiate. It declares what a path is and decides nothing about dispatch, routing or assignment. It is extracted because several contexts need the same definition and none of them is its natural owner (its ADR 0001). [Canvas](/contexts/process-path-management/bounded-context-canvas), [chart](/contexts/process-path-management/core-domain-chart) |

Count: four Core, seven Supporting, two Generic, and one Generic/Supporting.

## The "extract once, don't duplicate" pattern

`facility-layout` and `process-path-management` are Generic contexts that
exist so that no Core or Supporting context has to own a concern several of
them need:

- **Process paths.** Before `process-path-management`, three contexts each
  loaded the same static YAML catalogue at boot: `fulfillment-execution`,
  `wes-work-planning` and `workforce-management`. That catalogue,
  `warehouse-infra`'s `config/process-paths/sortable-fc.yaml`, is now frozen
  and kept only as a rollback payload. All three consumers, plus
  `order-management`, read the catalogue from
  `warehouse.process-path-management.events` instead (see the
  [Context Map](/strategic-design/context-map)). PPM's ADR 0001 records the
  argument.
- **Physical location.** The WMS tier needs it for stow validity, and the WES
  tier needs it for travel and capacity, but neither tier owns it.
  `facility-layout`'s context map cites the platform reference's rule:
  "Extract generic logic instead of duplicating it."

Both contexts keep that role cheap to depend on. Neither calls a sibling:
`facility-layout` has no outbound adapter to another service, and
`process-path-management`'s build fails if one is added.

## Why `order-management` is both Generic and Supporting

`order-management`'s own `CLAUDE.md` title line, Bounded Context Canvas and
Core Domain Chart all say **Generic/Supporting**. Its chart shows why with
three points:

- order intake alone is deep in commodity territory (0.15, 0.12);
- its promise and routing policies sit in the Generic quadrant (0.62, 0.45);
- the context as a whole lands on the border between the two (0.46, 0.36).

Its chart also predicts that the context will move down the chart as the
promise inputs settle, and that intake could be replaced by a bought OMS
without touching the Core contexts. This page records both labels rather
than forcing one that would hide half of that.

## Classification is per context; slices can differ

Two Core contexts classify their own internal slices separately on their
charts:

- **`fulfillment-execution`:** Packing and SLAM are Supporting, while dispatch
  and lease are Core.
- **`inventory-storage`:**
  - The usable-inventory read is Decisive, a short-term Core.
  - Hazmat placement and DOT segregation are Supporting.
  - The Flow & Accuracy report and bin registration are Generic.

The context-level verdict in the table above is the one that drives fleet
decisions. The slice verdicts explain where investment inside a context
concentrates.
