---
id: ubiquitous-language
title: Ubiquitous Language (Fleet Overview)
sidebar_label: Ubiquitous Language
description: How the vocabulary is organised across the fifteen backend contexts, which terms are genuinely shared, and which words mean different things in different contexts.
---

# Ubiquitous Language: Fleet Overview

Each bounded context owns its own ubiquitous language. A term's meaning
holds only inside that context's boundary, which follows Evans' guidance
that a term is scoped to its bounded context and is not global. This page
has three parts:

1. an index of where each context's glossary lives,
2. the few terms that really are **shared**, meaning the same thing
   wherever they appear,
3. the words that mean **different things in different contexts**. These
   are the homonyms and false friends that trip up a reader who moves
   between contexts.

Every definition below is taken from the context glossaries, which are
synced from each repository's `develop` branch and grounded in its code.
Where this page and a context glossary disagree, the context glossary
wins. For one alphabetical index across every context, see
[Glossary](/glossary).

## Per-context ubiquitous language

| Context | Key terms | Glossary |
| --- | --- | --- |
| `order-management` | Order, Order line, Allocation, Backordered, Release, Held order, Ship-complete, Promise, Re-promise, Planned capacity window | [Ubiquitous Language](/contexts/order-management/ubiquitous-language) |
| `inventory-storage` | StockUnit, ProductClassification, Bin, Stow, Usable inventory, Reservation, Allocation, Cycle count, Unlocated, Demand reference | [Ubiquitous Language](/contexts/inventory-storage/ubiquitous-language) |
| `wes-work-planning` | Charge, CPT, Process path, Work pool, Work unit, Shift plan and path plan, Release, Flow balancing, Remaining capacity, Drift | [Ubiquitous Language](/contexts/wes-work-planning/ubiquitous-language) |
| `fulfillment-execution` | Task, Task type, claimNext, Lease, Station, Capability, Package, SLAM, Manifested, CPT missed, OrderRef | [Ubiquitous Language](/contexts/fulfillment-execution/ubiquitous-language) |
| `workforce-management` | ShiftPlan, PathPlan, AssociateShift, LaborAssignment, Certification, PathUnderstaffed, Installed stations and installed capacity, Measured rate, Idle share | [Ubiquitous Language](/contexts/workforce-management/ubiquitous-language) |
| `facility-layout` | Site, Zone, Aisle, LocationType, LocationRole, LocationSlot, PlacementRule, LocationCode, Travel graph | [Ubiquitous Language](/contexts/facility-layout/ubiquitous-language) |
| `process-path-management` | Process Path, Path Id, Match Prefix, Capability, Cycle Time p95, Eligibility, CPT Schedule, Cutoff | [Ubiquitous Language](/contexts/process-path-management/ubiquitous-language) |
| `labor-performance` | LaborStandard, Expected seconds, TaskPerformance, EfficiencyPct, Idle Gap, Utilization, Scorecard, Coaching flag | [Ubiquitous Language](/contexts/labor-performance/ubiquitous-language) |
| `warehouse-ops-agent` | FlowBalanceException, StrandedReservation, DailyBrief, OpenException, Blast radius, PathTarget, Capacity outlook | [Ubiquitous Language](/contexts/warehouse-ops-agent/ubiquitous-language) |
| `network-fulfillment` | NetworkOrder, NetworkRef, NetworkProductId, Product translation, Acknowledgement window, Held order, Shipment confirmation, CapabilityOffer | [Ubiquitous Language](/contexts/network-fulfillment/ubiquitous-language) |
| `warehouse-planning` | ProcessCapacity, CapacityConstraint, CapacityWindow, WorkloadProfile, ProcessPath, StationStandard, CapacityPlan, Shortage, Bottleneck | [Ubiquitous Language](/contexts/warehouse-planning/ubiquitous-language) |
| `product-master` | Product (master record), Classification, Handling tag, TemperatureClass, DOT hazard class, Physical profile, Declared, Measured, Effective, Discrepancy, Version | [Ubiquitous Language](/contexts/product-master/ubiquitous-language) |
| `network-inventory-planning` | InterWarehouseTransfer, Proposal, ScoreBreakdown, PlanningSnapshot, SiteCapability, SiteSkuDemand, WorkDemand, Picked quantity, StuckTransfer, RebalanceRun | [Ubiquitous Language](/contexts/network-inventory-planning/ubiquitous-language) |
| `inbound-receiving` | ASN, Dock appointment, Receipt, Receipt line, Condition (Good or Damaged), Discrepancy (Short, Over, Damaged), Dock door | [Business Context](/contexts/inbound-receiving/business-context) (no separate glossary page yet) |
| `slotting-optimization` | Slot plan, Forward-pick slot, Pick velocity, ABC class, Stickiness, Policy (`abc-velocity-v1`), Assignment, Move (Assign, Relocate, Vacate) | [Business Context](/contexts/slotting-optimization/business-context) (no separate glossary page yet) |

## Shared terms

These terms carry the **same meaning** in every context that uses them.
Contexts agree on the *value* by convention or through a Published
Language. No context imports another's Go types. This is "same identity,
no Shared Kernel".

| Term | Shared meaning | Owner | Also used by |
| --- | --- | --- | --- |
| **SKU** | Our product identity: a non-empty string. | `product-master` registers it as a product master record (its ADR 0001: "source of truth for SKU-level product master data"); `inventory-storage` keys stock by it | order-management, wes-work-planning, fulfillment-execution, network-fulfillment (a SKU is only ever the *output* of translating a `NetworkProductId`), warehouse-ops-agent |
| **Path id** | The canonical identity of a process path, for example `PICK`, `PACK`, `REBIN` or `SLAM`. A plain string, because the valid set is operator-configurable. | `process-path-management` | fulfillment-execution `task.Type`, wes-work-planning `WorkPool.PathId`, workforce-management `PathPlan.PathId`, order-management `shared.PathId` (each keeps a local catalogue cache) |
| **Match prefix** | A caller-supplied id belongs to a path family when it equals the lower-case prefix, or starts with the prefix plus `-`. The longest prefix wins. | `process-path-management` | workforce-management, wes-work-planning and fulfillment-execution catalogue lookups |
| **Capability / Certification** | A named qualification such as `pick`, `pack` or `hazmat`. `process-path-management` declares which capabilities a path requires. `fulfillment-execution` gates a station's claim with `Station.Capability`, and `workforce-management` gates an associate's assignment with `Certification`. Each enforces its own half independently, and neither reads the other's data. | `process-path-management` (required set) | fulfillment-execution, workforce-management |
| **Work unit id** | `orderId-line-lineNo`, derived the same way by `order-management` and `wes-work-planning` and never transmitted by order-management. `fulfillment-execution` receives it as `work_unit_id` and stores it as `OrderRef`. | `wes-work-planning` | order-management, fulfillment-execution, warehouse-ops-agent |
| **Usable inventory** | On-hand minus active reservations minus held, damaged or unlocated stock. Only usable stock constrains release. | `inventory-storage` | wes-work-planning (`UsableInventoryObserved`, a projection by SKU), network-fulfillment ("physical available") |
| **TemperatureClass** | `Ambient`, `Chilled` or `Frozen`. The concept is deliberately duplicated rather than shared (inventory-storage ADR 0009). It applies to what a zone can hold in facility-layout, and to what a SKU needs on the product side. | facility-layout (zone side) and `product-master` (SKU side, moved from inventory-storage by product-master ADR 0001) | inventory-storage keeps applying it at stow time from its local copy |
| **DOT hazard class** | The top-level US DOT hazard class, 1 to 9, recorded only with the `Hazmat` tag. Compatibility follows a class-level matrix derived from 49 CFR §177.848. product-master records the class but owns no segregation rule: it is checked per **bin** in inventory-storage and per **package** in fulfillment-execution. | `product-master` (product master data, moved from inventory-storage) | inventory-storage (segregation per bin), fulfillment-execution (segregation per package, read from its local copy at seal time) |
| **Handling tags** | The closed set `Hazmat`, `Fragile`, `TemperatureSensitive`, `Oversized`, `HighValue`, in that stable order on the wire. `TemperatureSensitive` requires a TemperatureClass; a DOT hazard class needs `Hazmat`. | `product-master` (moved from inventory-storage) | inventory-storage (stow placement and segregation), order-management, wes-work-planning (`fragile` on `WorkReleased`), fulfillment-execution |
| **Product (master record)** | The SKU-level master record: description, Classification, Physical profile and a `version` that starts at 1 and grows by one per accepted change. A SKU must be registered before it can be classified or dimensioned. It answers no "where" or "how many" question. | `product-master` (ADR 0001) | every consumer of `warehouse.product-master.events` keeps a local copy per SKU, applied only when the event `version` is newer |
| **Classification** | A SKU's handling classification: handling tags, TemperatureClass and DOT hazard class, published as one full-state `ProductClassified`. `classification_source` is `native` (authored in product-master) or `legacy-import` (imported from inventory-storage during the migration). | `product-master`, since product-master ADR 0001 and ADR 0003 (it was inventory-storage's `ProductClassification`) | inventory-storage, order-management, wes-work-planning, fulfillment-execution (local copies, live in the reference deployment) |
| **Physical profile** | One unit's size and weight, in whole millimetres and grams. **Declared**: what the vendor or steward says. **Measured**: the latest reading from a dimensioning device or a manual measurement, with `measuredAt`; an older reading is rejected. **Effective**: measured if present, else declared, else none; consumers act only on effective. **Discrepancy**: true when measured volume or weight differs from declared by more than 10 % of the declared value; information for stewards, never a rejection. | `product-master` (ADR 0002) | no event consumer yet; read over MCP by warehouse-ops-agent's `find_master_data_gaps` and summarised by product-master's own master data quality report |
| **CloudEvents `id`** | The dedupe key for every consumed event. It stays stable across outbox redelivery. labor-performance calls it `KafkaEventId`. | every producer | every consumer |
| **ASN** | Advance ship notice: a supplier's declaration of what is arriving, keyed by `asn_number`, with lines of `sku` and `expected_qty`. The expectation a receipt is counted against. Decided 2026-10-08, in progress. | `inbound-receiving` | no consumer yet (`ASNRegistered` and `ASNCancelled` are a published contract) |
| **Discrepancy** | At receipt close, a line whose count differs from the ASN: **Short** (fewer than expected), **Over** (more than expected) or **Damaged** (damaged units). Carried on `ReceiptClosed` as `kind`, `expected_qty`, `received_qty` and `damaged_qty`. In `product-master` the same word means something else (measured versus declared dimensions); see below. | `inbound-receiving` | no consumer yet |
| **Receipt condition** | `Good` or `Damaged` on `ReceiptLineReceived`. Only `Good` units become receivable stock in `inventory-storage`; damaged units stay on the receipt and quarantine is a later ADR. | `inbound-receiving` | `inventory-storage` (in progress) |
| **Forward-pick slot** | A storage-role, active slot in a forward zone (`FORWARD_ZONE_CODES`, default `FWD`) that holds one SKU for picking. The approved SKU-to-slot map is published on `SlotPlanApproved`. Decided 2026-10-08, in progress. | `slotting-optimization` | planned: MOVE work execution (not built), `warehouse-ops-agent` and the console read it |

## Same word, different model

DDD allows the same English word to mean different things in different
bounded contexts, as long as each context's model is consistent inside
its own boundary and the overlap is written down. The fleet uses this on
purpose. Before you carry a word from one context to another, check this
table.

### "Process path"

The fleet's most overloaded word. Seven contexts use it:

| Context | What a "process path" is |
| --- | --- |
| `process-path-management` | **The authoritative catalogue entry.** An operator-configurable aggregate with an identity, a match prefix, required capabilities, a declared `CycleTimeP95`, eligibility rules and an `ACTIVE` or `DEACTIVATED` status. There is no draft state. |
| `wes-work-planning` | A named station that owns a **queue** (a work pool), with a service rate and a staffed capacity. Not a workflow step. |
| `workforce-management` | A named station type that owns a queue, for example `pack`, `pick`, `stow` or `SLAM`. It is the finest granularity this context staffs. |
| `fulfillment-execution` | A **task type**: `PICK`, `PACK`, `REBIN` or `SLAM`, used as a named queue. It is `taskType` in REST, `task_type` on events and `processPath` in MCP arguments, which accept only `PICK`, `PACK` and `SLAM`. |
| `order-management` | The building workflow a line's work is dispatched to. It is selected per line as the eligible active path with the shortest `CycleTimeP95` (ADR 0021). The default is `pick`. |
| `warehouse-planning` | **A different model.** It is an ordered sequence of process types (for example `PICK`, then `REBIN`, then `PACK`), declared locally by an operator. It does not consume `process-path-management`'s events and shares the `path_id` string only as a loose human cross-reference (warehouse-planning ADR 0001 Addendum). |
| `warehouse-ops-agent` | Has no definition of its own. Its `PathTarget` configuration binds each upstream's name for "the same" path, and is never inferred. |

### "CPT"

Every context expands CPT as **Critical Pull Time**, but each one attaches
it to a different subject:

| Context | CPT is attached to |
| --- | --- |
| `process-path-management` | A **site's departure schedule.** A `CPTSchedule` per site holds recurring `Cutoff`s (local time, days of week, ship method, eligible path ids). "A CPT is a property of a departure, not of a path." |
| `order-management` | A **promise window** (`CPTWindow`). A promise may only use a window at or before the caller's `requiredShipBy`. |
| `wes-work-planning` | A **value object on work.** It is the last moment a parcel can be manifested and still make its truck, and release priority derives from it. A **Cutoff** here is the CPT instant that a remaining-capacity report refers to. |
| `fulfillment-execution` | A **task deadline.** A task still open at or past its CPT is *CPT missed*. That is reported on every sweep, never enforced. Its `apis/openapi.yaml` now says "Critical Pull Time" too (it used to say "Committed Processing Time"). |
| `network-fulfillment` | The site's **next cutoff**, and the paths eligible for it. It feeds the capability offer. |

### "Reference"

| Context | Term | What it refers to |
| --- | --- | --- |
| `order-management` | Order reference | Its own real `OrderId`. |
| `wes-work-planning` | **Reference** (`ref` on `WorkReleased`) | The external identifier a work unit points back at, for example an order id. |
| `fulfillment-execution` | **OrderRef** | Despite the name, a work-planning **WorkUnit id** (`orderId-line-n`), not an order id. It appears as `order_ref` on `TaskCPTMissed` and `PackageManifested`. |
| `inventory-storage` | **Demand reference** (`demandRef`) | An opaque string for what a reservation is for. It is stored and echoed, never parsed. That opacity is the anti-corruption boundary. |
| `network-fulfillment` | **NetworkRef** | The external network's own purchase-order number. It is the primary key, never parsed. `LocalOrderId` maps it to order-management's `OrderId`. |

### "ShiftPlan"

- In **`workforce-management`**, `ShiftPlan` is the labor commitment: one
  per building per shift, made of `PathPlan` lines, proposed by the
  software and committed by a human.
- In **`wes-work-planning`**, `ShiftPlan` is **its own aggregate**. It is a
  committed split of rate × heads × hours per path, with the invariant
  `plannedHeads ≤ installedStations`. It is committed through
  `POST /paths/{pathId}/plan`.
- workforce-management's `ShiftPlanCommitted` is **not** fed into
  wes-work-planning's aggregate. It is projected into a separate read model,
  `LaborPlanObserved`. The two are compared (`PathPlanDriftDetected`),
  never merged (wes-work-planning ADR 0006 and ADR 0019).
- Two CloudEvents types share the name:
  `com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted` and
  `com.warehouse.wes.work-planning.plan.ShiftPlanCommitted`. Consumers must
  dispatch on the full `type`.

### "Release"

| Context | What "release" means |
| --- | --- |
| `order-management` | A pure domain transition. Allocated lines are marked `Released` once ship-complete rules allow, and announced on `OrderAllocated` or `OrderPartiallyAllocated`. It is not a call to wes-work-planning (ADR 0005). |
| `wes-work-planning` | Continuous, priority-ordered, waveless admission of a work unit into its pool (`ReleaseNextWork`), which publishes `WorkReleased`. |
| `network-fulfillment` | Committing the held order to the floor (`POST /orders/{id}/release` on order-management) after the network reports `SUCCESS`. |

### "Allocation" and "Reservation"

- **`inventory-storage`**: a `Reservation` is a revocable, time-limited
  aggregate (`ACTIVE`, `CONFIRMED`, `REVOKED` or `EXPIRED`). An
  `Allocation` is a line *inside* it that records which `StockUnit` and
  which bin the units came from.
- **`order-management`**: *Allocation* means reserving stock for one order
  line by calling inventory-storage's `POST /reservations`. No local
  `Reservation` model exists, only the id.
- **`wes-work-planning`** never holds a reservation. It only observes the
  effect through `StockReserved` and `ReservationRevoked`.
- **`network-inventory-planning`**: a transfer is *allocating* while it waits for
  inventory-storage's reply to `TransferAllocationRequested`, and *allocated* once
  `TransferStockAllocated` arrives. The reservation and its allocations are
  inventory-storage's; the transfer only stores their ids and quantities.

### "Capacity"

| Context | What "capacity" means |
| --- | --- |
| `facility-layout` | The **static envelope** of a slot: max weight and max volume. |
| `inventory-storage` | A bin's **dynamic** room: how much of the bin's capacity is still free right now. A full bin rejects a stow. |
| `wes-work-planning` | **Remaining capacity**: `max(0, wipLimit − WIP)` for a release-fed pool, reported per CPT cutoff on `PathCapacityChanged`. It is unknown for a flow-fed pool. |
| `fulfillment-execution` | **Installed capacity**: how many registered stations hold a capability, regardless of occupancy. |
| `workforce-management` | Two ceilings on planned heads. **Installed stations** is caller-supplied. **Installed capacity** is read live from fulfillment-execution at commit time. |
| `warehouse-planning` | **ProcessCapacity**: the usable throughput of one process at one site for one window, which is the minimum across its constraints. A **CapacityPlan** compares assigned demand with it. |
| `order-management` | Remaining path capacity feeds the promise. Planned capacity from warehouse-planning only annotates the order (ADR 0031). |
| `network-fulfillment` | **Throughput feasible**: remaining capacity summed over the paths eligible for the next cutoff. |
| `network-inventory-planning` | Never computes capacity. It reads `warehouse-planning`'s published `capacity_over_window` per site and compares it with that site's in-window demand to get **headroom** (negative means short). |

### "Discrepancy"

| Context | What a "discrepancy" is |
| --- | --- |
| `inbound-receiving` | A **count difference at receipt close**: `Short`, `Over` or `Damaged`, per ASN line, listed on `ReceiptClosed`. It is a fact about a delivery. |
| `product-master` | A **flag on a SKU's physical profile**: true when measured volume or weight differs from declared by more than 10 %. It is a fact about master data, and it never rejects a measurement. |
| `inventory-storage` | Cycle-count variances are recorded against stock; they are not the same record as a receipt discrepancy, and the two are never merged. |

### "Classification"

- **`facility-layout`** classifies **space**. It returns the `hazmat` and
  `temperatureClass` pair of a slot's zone at
  `GET /locations/{locationCode}/classification`.
- **`product-master`** classifies **product** (product-master ADR 0001).
  Its `Classification` is SKU master data with a closed tag set:
  `Hazmat`, `Fragile`, `TemperatureSensitive`, `Oversized`, `HighValue`.
  It took this over from **`inventory-storage`**'s `ProductClassification`
  (product-master ADR 0003). inventory-storage keeps a local copy of it and
  keeps applying placement and segregation at stow time.
- The two meet at stow time, when a placement check validates that a
  hazmat or temperature-sensitive SKU is stowed in a matching zone.
- **`wes-work-planning`**'s `ProductClassificationView` is read once at
  release, to stamp `fragile` on `WorkReleased`. Since wes-work-planning ADR
  0035 it reads a local copy of product-master's `ProductClassified`
  (product-master ADR 0003 stage D) instead of calling inventory-storage, as
  do order-management (ADR 0036) and fulfillment-execution (ADR 0039).

### "Location", "Site" and "Zone"

| Word | facility-layout | Elsewhere |
| --- | --- | --- |
| **Location** | A `LocationSlot`: one coded slot (`Site-Area-Zone-Aisle-Bay-Level-Position`) with a type, role and status. This covers structural identity and legality, not contents. | inventory-storage: a `Bin`, which is an id, a capacity and an occupancy. fulfillment-execution: an optional opaque `locationCode` on a station. warehouse-planning: a planning `location` that is a site code such as `SIM1`. |
| **Site** | `Site`, the physical building, identified by `SiteCode`. | process-path-management: `SiteId` on a CPT schedule, never validated against facility-layout. workforce-management: `BuildingId`. network-fulfillment: `SiteId` is the destination site. |
| **Zone** | A behavioural classification of space (temperature class and hazmat flag) and the source of truth for placement rules. | The WES ubiquitous language uses zone for congestion and travel reasoning, consumed as a read-only fact. |

### "Task" and "Work unit"

- **`wes-work-planning`**'s `WorkUnit` is *releasable volume with a
  deadline*. It is assigned at most once and cannot complete twice.
- **`fulfillment-execution`**'s `Task` is *claimable work with a lease*. It
  is created **from** a consumed `WorkReleased`, but it is a different
  aggregate with its own claim, lease and completion lifecycle. The
  `WorkReleased` consumer is the translation point.
- `inventory-storage`, `workforce-management` and `facility-layout` have no
  task model at all.

### "Pick"

- **`fulfillment-execution`**: the physical PICK task lifecycle of claim,
  lease and complete.
- **`inventory-storage`**: `ConfirmPick` is the *accounting* consequence.
  It consumes the reservation and removes on-hand quantity. No sibling
  context calls it today.

### "Standard" and "Rate"

| Context | Term | Meaning and unit |
| --- | --- | --- |
| `labor-performance` | **LaborStandard** | The engineered expected **duration** of one task type, in seconds, with an effective range. Its revisions never re-score past tasks (ADR 0004). |
| `warehouse-planning` | **StationStandard** | The operator-declared **throughput** of one station of a process at a site, in `UNIT`, `PACKAGE` or `ORDER` per period. |
| `process-path-management` | **Cycle Time p95** | An operator-declared end-to-end **cycle time** from release to manifest. It is a declared standard, not a measured value. |
| `wes-work-planning` | **Rate** | A service rate in units per hour. |
| `workforce-management` | **Planned rate** and **Measured rate** | Planned rate is throughput per head per hour. Measured rate is labor-performance's `MeanActualSeconds`, a duration in seconds, converted to a per-hour rate (3600 / seconds, ADR 0033) before the headcount proposal uses it. |

### "Held order" and "Acknowledge"

- **`order-management`**: a *held order* is received with
  `releaseOnAllocation=false`. It allocates, must be ship-complete, and
  waits for `POST /orders/{id}/release` or a cancel. It is not a status.
- **`network-fulfillment`** sees the same order through its
  `FulfillmentPlanner` port and calls the order-management id its
  `LocalOrderId`. Its own "acknowledged" has a trap: the
  `NetworkOrderAcknowledged` event is raised at **submission** (state
  `SUBMITTED`), not when the network confirms and the order reaches
  `ACKNOWLEDGED`.

## Why there is no single global glossary as the source of truth

A single global glossary would do one of two things. It would force every
context into one model and destroy the local precision each context's own
page gives. Or it would become a lowest-common-denominator summary that
nobody writes code against. For example, fulfillment-execution separates
`Fragile`, a product-derived hint, from `Gift wrap`, a caller-stated
request. A shared "handling flag" type would erase that difference.

Each context's own ubiquitous-language page stays the source of truth for
that context. This page and the [Glossary](/glossary) only help a
fleet-wide reader find their way, and they flag the places where shared
words could confuse someone who moves between contexts.
