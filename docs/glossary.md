---
id: glossary
title: Glossary
sidebar_label: Glossary
description: One alphabetical index of every ubiquitous-language term across the fleet, with which context defines it.
slug: /glossary
---

# Glossary

This is an alphabetical index of the key terms from the ubiquitous languages
of the seventeen contexts documented on this site. Each term belongs to one context, which holds
its authoritative definition. The short definitions below are condensed from
each context's **Ubiquitous Language** page. That page is synced from the
context's own repository, maps every term to its code identifier, and wins if
the two ever disagree. Open it from the context's name in the second column.
The fleet-level [Ubiquitous Language](/strategic-design/ubiquitous-language)
page covers terms that several contexts reuse with different meanings.
`inbound-receiving` and `slotting-optimization` link to their synced
Ubiquitous Language pages like every other context.

| Term | Owning context | Short definition |
| --- | --- | --- |
| ABC class | [`slotting-optimization`](/contexts/slotting-optimization/ubiquitous-language) | The rank band of a candidate SKU by pick velocity over the plan's window: A while the picks of the SKUs ranked before it are below 80 % of all picks, B below 95 %, else C. Stored on each assignment (`abcClass`). |
| Acknowledgement window | [`network-fulfillment`](/contexts/network-fulfillment/ubiquitous-language) | 24 hours from receipt: a fact about the counterparty, not configuration. `acknowledgeBy` = `receivedAt + 24h`. |
| Aisle | [`facility-layout`](/contexts/facility-layout/ubiquitous-language) | A physical corridor scoped to a Zone, with a walk-order `SequenceHint` and a `OneWay`/`TwoWay` direction. |
| ASN | [`inbound-receiving`](/contexts/inbound-receiving/ubiquitous-language) | Advance ship notice: a supplier's declaration of what is arriving, keyed by `asn_number`, with lines of SKU and expected quantity. |
| AssociateShift | [`workforce-management`](/contexts/workforce-management/ubiquitous-language) | Who is on shift: their certifications, breaks and logged hours. |
| Bin | [`inventory-storage`](/contexts/inventory-storage/ubiquitous-language) | A coded slot with a capacity. Under chaotic storage any SKU may occupy any free bin; it knows nothing of aisles or zones (that is facility-layout's). |
| Blast radius | [`warehouse-ops-agent`](/contexts/warehouse-ops-agent/ubiquitous-language) | The mandatory "what would this write touch" readout (SKU, bin, reservation, quantity freed) that must accompany a `revoke_reservation` recommendation. |
| Bottleneck | [`warehouse-planning`](/contexts/warehouse-planning/ubiquitous-language) | The process-path step limiting end-to-end flow, and the constraint type binding it. |
| Candidate | [`task-interleaving`](/contexts/task-interleaving/ubiquitous-language) | One ranked entry of a hint: `Rank` from 1, `TaskID`, `TaskType`, `Location` and `DetourM`. |
| Capability | [`process-path-management`](/contexts/process-path-management/ubiquitous-language) | A named qualification (`pick`, `pack`, `hazmat`) a station or associate must hold to work a path. Same vocabulary as workforce-management's Certification and fulfillment-execution's station capabilities. |
| CapabilityOffer | [`network-fulfillment`](/contexts/network-fulfillment/ubiquitous-language) | What the fleet would tell the network it can ship for one `(sku, siteId)`: `min(physical available, throughput feasible)`. |
| Capacity outlook | [`warehouse-ops-agent`](/contexts/warehouse-ops-agent/ubiquitous-language) | warehouse-planning's path capacity, bottleneck step and binding constraint shown next to a path in the daily brief. Informational and fail-open. |
| CapacityConstraint | [`warehouse-planning`](/contexts/warehouse-planning/ubiquitous-language) | One named limiting factor (type + rate) on a ProcessCapacity: `LABOR`, `LOCATION`, `EQUIPMENT`, `STATION`, `CONVEYOR`, `BUFFER`, `REPLENISHMENT`. |
| CapacityPlan | [`warehouse-planning`](/contexts/warehouse-planning/ubiquitous-language) | Assigned demand for a site and window compared with the path capacity, giving shortage and bottleneck. Lifecycle `DRAFT` then `PUBLISHED`. |
| CapacityWindow | [`warehouse-planning`](/contexts/warehouse-planning/ubiquitous-language) | The `[start, end)` period a capacity is valid for. A registered window applies when it covers the planning window. |
| Certification | [`workforce-management`](/contexts/workforce-management/ubiquitous-language) | A named qualification an associate holds (`pack`, `hazmat`, `pick`). It gates LaborAssignment. |
| Charge | [`wes-work-planning`](/contexts/wes-work-planning/ubiquitous-language) | The volume that must clear a process path, bucketed by CPT: a set of `(CPT, quantity)` pairs. |
| claimNext | [`fulfillment-execution`](/contexts/fulfillment-execution/ubiquitous-language) | Pull-based dispatch: returns the earliest-CPT pending task a station is certified and equipped for. There is no `assign(task, station)`. |
| Classification source | [`product-master`](/contexts/product-master/ubiquitous-language) | `native` when a classification was authored in product-master, `legacy-import` when its legacy importer took it from inventory-storage during the migration (ADR 0003). A legacy import never overwrites a native one. |
| CPT (Critical Pull Time) | [`wes-work-planning`](/contexts/wes-work-planning/ubiquitous-language) | The last moment a parcel can be manifested and still make its truck. Priority derives from it. |
| DailyBrief | [`warehouse-ops-agent`](/contexts/warehouse-ops-agent/ubiquitous-language) | The synthesized cross-path, cross-site operational summary: each monitored path's facts plus the open exceptions derived from them. |
| Detour (interleaving) | [`task-interleaving`](/contexts/task-interleaving/ubiquitous-language) | Distance in metres from the station's origin to a candidate task's first location (`FromLocation`), rounded to 0.1 m. `ToLocation` never enters the ranking. |
| Direct | [`process-path-management`](/contexts/process-path-management/ubiquitous-language) | A structural, immutable fact about a path's routing shape. It is set at definition and cannot be revised. |
| Discrepancy | [`product-master`](/contexts/product-master/ubiquitous-language) | True when a product's measured unit volume or weight differs from the declared value by more than 10 %. Information for stewards; it never rejects a measurement. |
| Discrepancy (receipt) | [`inbound-receiving`](/contexts/inbound-receiving/ubiquitous-language) | A line of a closed receipt whose count differs from the ASN: `Short`, `Over` or `Damaged`. A different concept from product-master's Discrepancy. |
| Dock appointment | [`inbound-receiving`](/contexts/inbound-receiving/ubiquitous-language) | A booked dock door and time window for a carrier, covering one or more ASNs. Booked, checked in, completed or cancelled. |
| Flow balancing | [`wes-work-planning`](/contexts/wes-work-planning/ubiquitous-language) | A bounded, two-lever correction on one path when backlog deviates from plan: throttle upstream release, or flag labour reassignment. |
| FlowBalanceException | [`warehouse-ops-agent`](/contexts/warehouse-ops-agent/ubiquitous-language) | The E1 correlation of a wes rebalance recommendation, a staffing gap and a stuck-task diagnostic for one path into one ranked recommendation. |
| Forward bin | [`pick-face-replenishment`](/contexts/pick-face-replenishment/ubiquitous-language) | The location code of a pick face: the bin a replenishment request fills. |
| Forward map | [`pick-face-replenishment`](/contexts/pick-face-replenishment/ubiquitous-language) | The site's full SKU-to-slot assignment from the latest approved slot plan, with the plan's `approved_at` stamp. Replaced wholesale by each applied `SlotPlanApproved`. |
| Forward-pick slot | [`slotting-optimization`](/contexts/slotting-optimization/ubiquitous-language) | A storage-role, active slot in a forward zone (default code `FWD`) that holds one SKU for picking in v1. The approved SKU-to-slot map is published on `SlotPlanApproved`. |
| Fragile | [`fulfillment-execution`](/contexts/fulfillment-execution/ubiquitous-language) | A Task-level packing hint stamped at release time from wes-work-planning's local copy of product-master's classification. It does not gate claiming. |
| Fulfillment class | [`order-management`](/contexts/order-management/ubiquitous-language) | A demand-shape classifier (`SINGLE`, `SAME_SKU_MULTI`, `MULTI_LINE_MULTI`), derived from line count and quantity and never stored. |
| Gift wrap | [`fulfillment-execution`](/contexts/fulfillment-execution/ubiquitous-language) | A Task-level packing hint from a caller-stated request, independent of product classification. |
| Handling tag | [`product-master`](/contexts/product-master/ubiquitous-language) | One of the closed set `Hazmat`, `Fragile`, `TemperatureSensitive`, `Oversized`, `HighValue` on a SKU's classification, always in that order on the wire. Moved from inventory-storage. |
| Held order | [`order-management`](/contexts/order-management/ubiquitous-language) | An order received with `releaseOnAllocation=false`. It allocates, then waits for an explicit release or a cancel. Must be ship-complete. `network-fulfillment` raises these. |
| Hint | [`task-interleaving`](/contexts/task-interleaving/ubiquitous-language) | The short ranked list of candidate tasks issued to a station after a completion. Advisory, expiring, never an assignment. States `Active`, `Consumed`, `Expired`, `Superseded`. |
| Inert site | [`task-interleaving`](/contexts/task-interleaving/ubiquitous-language) | A site that never declared an interleaving policy: no hint is issued for it (`404 policy-not-found` on read). |
| InterleavingPolicy | [`task-interleaving`](/contexts/task-interleaving/ubiquitous-language) | The per-site, versioned settings of the hint: max detour, max candidates (1 to 5), hint TTL, eligible task types and vertical weight. |
| InterWarehouseTransfer | [`network-inventory-planning`](/contexts/network-inventory-planning/ubiquitous-language) | The saga aggregate: an operator-approved plan to move a quantity of one SKU between two sites. Eleven states from `DRAFT` to `RECEIVED`; it references the reservation and the physical facts and owns neither. |
| LaborAssignment | [`workforce-management`](/contexts/workforce-management/ubiquitous-language) | One associate on one path for an interval. Exactly one ACTIVE assignment per associate, gated by certification. |
| LaborStandard | [`labor-performance`](/contexts/labor-performance/ubiquitous-language) | The engineered expected duration for one task type, with an effective range. It is frozen onto each scored task at completion time. |
| Lease | [`fulfillment-execution`](/contexts/fulfillment-execution/ubiquitous-language) | A time-boxed claim on a Task. If it is not renewed or completed before expiry, the task returns to Pending. |
| LocationCode | [`facility-layout`](/contexts/facility-layout/ubiquitous-language) | The coded address of a slot: seven typed, hyphen-joined segments (`Site-Area-Zone-Aisle-Bay-Level-Position`). |
| LocationRole | [`facility-layout`](/contexts/facility-layout/ubiquitous-language) | What a LocationType is for, independent of shape: `Storage`, `Dock`, `Yard`, `WorkCenter`, `Drop`, `Staging`, `QC`, `Consolidation`, `Shipping`. |
| LocationSlot | [`facility-layout`](/contexts/facility-layout/ubiquitous-language) | The leaf aggregate: one coded physical slot, whose identity is its LocationCode. |
| LocationType | [`facility-layout`](/contexts/facility-layout/ubiquitous-language) | A reusable classification of slot shape or kind (`PalletRack`, `Shelf`, `ToteWall`, ...), with a default capacity envelope and a LocationRole. |
| MatchPrefix | [`process-path-management`](/contexts/process-path-management/ubiquitous-language) | The lower-case prefix consumers match a caller-supplied id against: an exact match, or the prefix followed by `-`. |
| NetworkOrder | [`network-fulfillment`](/contexts/network-fulfillment/ubiquitous-language) | Demand from the external network with a deadline the fleet did not choose. It is answered exactly once, in full or not at all. |
| NetworkRef | [`network-fulfillment`](/contexts/network-fulfillment/ubiquitous-language) | The network's opaque identity for one unit of demand. It is never parsed. It is the aggregate key, the CloudEvents `subject` and the Kafka key. |
| Open request | [`pick-face-replenishment`](/contexts/pick-face-replenishment/ubiquitous-language) | The one `Requested` replenishment request of a pick face; its quantity counts as inbound stock when the projected level is computed. |
| Open-task pool | [`task-interleaving`](/contexts/task-interleaving/ubiquitous-language) | The event-fed local copy of the tasks still open, with where each starts and ends. An input of the recommender, not aggregate state. |
| OpenException | [`warehouse-ops-agent`](/contexts/warehouse-ops-agent/ubiquitous-language) | One path's flagged, human-gated exception: which correlation rule fired, its severity, and its evidence. Raised only when two or more independent signals fire. |
| Order | [`order-management`](/contexts/order-management/ubiquitous-language) | The aggregate root: one customer's demand, its lines, its delivery promise and its hold/deadline intent. Its status is derived from line statuses, never stored. |
| OrderLine | [`order-management`](/contexts/order-management/ubiquitous-language) | One requested SKU and quantity within an Order, with its resolved process path, gift-wrap flag, line status and reservation id. |
| Package | [`fulfillment-execution`](/contexts/fulfillment-execution/ubiquitous-language) | Pack output: an order's contents becoming a sealed carton, then weigh-checked at SLAM (labelled or diverted). |
| PathId | [`process-path-management`](/contexts/process-path-management/ubiquitous-language) | The canonical identity of a process path (`PICK`, `PACK`, ...). fulfillment-execution, wes-work-planning and workforce-management reference the same identity. |
| PathPlan | [`workforce-management`](/contexts/workforce-management/ubiquitous-language) | One line of a ShiftPlan: `pathId`, `plannedHeads`, `plannedRate`, `plannedHours`. |
| PathUnderstaffed | [`workforce-management`](/contexts/workforce-management/ubiquitous-language) | A flag, not a decision: the planned heads for a path are not currently met by active assignments. |
| Physical profile | [`product-master`](/contexts/product-master/ubiquitous-language) | One unit's declared and latest measured dimensions (mm) and weight (g), the effective values (measured if present, else declared) and the discrepancy flag (ADR 0002). |
| PlanningSnapshot | [`network-inventory-planning`](/contexts/network-inventory-planning/ubiquitous-language) | The fail-closed view built from the local site-capability, site-demand and published-capacity read models. A stale, empty or direction-disabled input refuses it. |
| Pick face | [`pick-face-replenishment`](/contexts/pick-face-replenishment/ubiquitous-language) | A forward bin assigned to one SKU by the site's latest approved slot plan, from which pickers pick. |
| Pick velocity | [`slotting-optimization`](/contexts/slotting-optimization/ubiquitous-language) | Per SKU over the plan's window, from the order-management demand feed: picks = the number of ACTIVE demand lines, units = their summed units. Ranks SKUs for forward slots (picks desc, then units desc, then SKU ascending). |
| PlacementRule | [`facility-layout`](/contexts/facility-layout/ubiquitous-language) | Declares which LocationTypes are legal in which Zones. It is enforced once, at registration time. |
| ProcessCapacity | [`warehouse-planning`](/contexts/warehouse-planning/ubiquitous-language) | The usable throughput of one process at one site for one window: the minimum across its registered constraints. |
| ProcessPath | [`process-path-management`](/contexts/process-path-management/ubiquitous-language) | The aggregate root: the operator-configurable definition of one process path. (`warehouse-planning` keeps its own, differently modelled ProcessPath: an ordered sequence of process steps.) |
| Proposal | [`network-inventory-planning`](/contexts/network-inventory-planning/ubiquitous-language) | An advisory transfer recommendation with a policy version, reason codes and a score breakdown. It reserves and moves nothing. |
| Product (master record) | [`product-master`](/contexts/product-master/ubiquitous-language) | The SKU-level master record: description, classification, physical profile and a `version` that grows by one per accepted change. Downstream copies apply an event only when its `version` is newer. |
| Projected level | [`pick-face-replenishment`](/contexts/pick-face-replenishment/ubiquitous-language) | `available` of the forward bin plus the quantity of its open request (0 without one). A request is raised when it reaches the policy minimum. |
| Promise | [`order-management`](/contexts/order-management/ubiquitous-language) | The CPT window (or lead-time date) an order or shipment group is promised to leave by. It is recomputed (re-promised) on `TaskCPTMissed`/`PackageManifested`. |
| RebalanceRun | [`network-inventory-planning`](/contexts/network-inventory-planning/ubiquitous-language) | One scheduled, observe-only planning pass with its snapshot watermark, counts and outcome. It never approves anything. |
| Receipt | [`inbound-receiving`](/contexts/inbound-receiving/ubiquitous-language) | The record of one delivery being counted against an ASN, line by line, with a condition (`Good` or `Damaged`) per line. Opened, received into, then closed with its discrepancies. |
| rectilinear-v1 | [`task-interleaving`](/contexts/task-interleaving/ubiquitous-language) | The v1 travel model: `\|dx\| + \|dy\| + verticalWeight * \|dz\|` in metres, rounded to 0.1 m. A place without geometry has an unknown distance, never 0. |
| Release | [`wes-work-planning`](/contexts/wes-work-planning/ubiquitous-language) | Continuous, priority-ordered (waveless) admission of work into a work pool. |
| Remaining capacity | [`wes-work-planning`](/contexts/wes-work-planning/ubiquitous-language) | `max(0, wipLimit − WIP)` for a release-fed pool, reported per CPT cutoff on `PathCapacityChanged`. Unknown for a flow-fed pool. |
| Replenishment policy | [`pick-face-replenishment`](/contexts/pick-face-replenishment/ubiquitous-language) | The explicit `MIN_MAX` rule of one (site, SKU): `minQty`, `maxQty`, `multiple` and a `version`, with `0 <= min < max`. Listed as "Policy" on the context's own page. |
| Replenishment relocation | [`pick-face-replenishment`](/contexts/pick-face-replenishment/ubiquitous-language) | A `StockRelocated` with reason `REPLENISHMENT` and `source_ref` equal to the request id; it completes the request. |
| Replenishment request | [`pick-face-replenishment`](/contexts/pick-face-replenishment/ubiquitous-language) | One decision to move `quantity` units of one SKU from one reserve bin to one forward bin, and how it ended: `Requested`, then `Completed` or `Cancelled`. |
| Reservation | [`inventory-storage`](/contexts/inventory-storage/ubiquitous-language) | A revocable binding of a quantity to demand, with a timeout. A revoke returns exactly the allocated quantity. |
| Reserve bin | [`pick-face-replenishment`](/contexts/pick-face-replenishment/ubiquitous-language) | A known, not decommissioned Storage location of the same site in a reserve zone (default code `RSV`): where replenishment stock comes from. Its usable stock is `on_hand - reserved`. |
| Shortage | [`warehouse-planning`](/contexts/warehouse-planning/ubiquitous-language) | `max(0, assigned demand − capacity over window)`, in orders. Equal is not a shortage. |
| ShiftPlan | [`workforce-management`](/contexts/workforce-management/ubiquitous-language) | The committed split of headcount across paths for one building and shift. The software proposes it and a human commits it. |
| Site | [`facility-layout`](/contexts/facility-layout/ubiquitous-language) | A physical facility or building; the root of the location hierarchy. |
| Slot plan | [`slotting-optimization`](/contexts/slotting-optimization/ubiquitous-language) | The aggregate: a proposed SKU-to-forward-slot assignment for a site and demand window, generated as a Draft and then approved or rejected by a human; approving supersedes the site's previous Approved plan. |
| SortLane | [`fulfillment-execution`](/contexts/fulfillment-execution/ubiquitous-language) | The derived sortation decision for a package: `HAZMAT_LANE` beats `FRAGILE_NO_TILT` beats `STANDARD`. |
| Source bin policy | [`pick-face-replenishment`](/contexts/pick-face-replenishment/ubiquitous-language) | The versioned rule that picks the reserve bin of a request; v1 is `fullest-reserve-bin-v1`. |
| Stale map | [`pick-face-replenishment`](/contexts/pick-face-replenishment/ubiquitous-language) | A `SlotPlanApproved` whose `approved_at` is not after the one recorded for the site; it is ignored. |
| Station | [`fulfillment-execution`](/contexts/fulfillment-execution/ubiquitous-language) | A work position with a capability set. One occupant at a time. |
| StationStandard | [`warehouse-planning`](/contexts/warehouse-planning/ubiquitous-language) | The operator-declared throughput of one station of a process at a site. It is multiplied by the tallied station count at read time. |
| StationTrip | [`task-interleaving`](/contexts/task-interleaving/ubiquitous-language) | The aggregate, one per station: where the operator stands and the hint issued there. |
| Stickiness | [`slotting-optimization`](/contexts/slotting-optimization/ubiquitous-language) | The churn limit: a SKU keeps its previous slot if that slot is still eligible and free (a better-ranked SKU may still take it first). |
| StockUnit | [`inventory-storage`](/contexts/inventory-storage/ubiquitous-language) | A quantity of a SKU at a specific bin; the aggregate root of inventory truth. |
| Stow | [`inventory-storage`](/contexts/inventory-storage/ubiquitous-language) | Placing inbound stock into a bin. Invalid without both an item scan and a location scan; the only operation that creates a StockUnit. |
| StrandedReservation | [`warehouse-ops-agent`](/contexts/warehouse-ops-agent/ubiquitous-language) | The E2 correlation of expired or expiring task leases with a usable-stock shortfall, giving a `revoke_reservation` or `hold` recommendation. |
| StuckTransfer | [`network-inventory-planning`](/contexts/network-inventory-planning/ubiquitous-language) | A non-terminal transfer whose last transition is older than its per-state threshold (defaults `ALLOCATING` 1h, `PICKED` 24h, `IN_TRANSIT` 72h). A reading, not a state. |
| Task | [`fulfillment-execution`](/contexts/fulfillment-execution/ubiquitous-language) | A unit of physical work with a type, a CPT, an order reference, required capabilities and two packing hints. At most one active claim. |
| TaskPerformance | [`labor-performance`](/contexts/labor-performance/ubiquitous-language) | One completed task, scored against the standard active at completion and frozen. |
| Tie-break | [`task-interleaving`](/contexts/task-interleaving/ubiquitous-language) | How `fulfillment-execution` may use a hint: only inside one priority band, fail-open. `fulfillment-execution` does not consume the hint yet. |
| Usable inventory | [`inventory-storage`](/contexts/inventory-storage/ubiquitous-language) | Stock immediately available to fulfil: on-hand minus active reservations minus held, damaged or unlocated stock. |
| Utilization | [`labor-performance`](/contexts/labor-performance/ubiquitous-language) | Task time ÷ (task time + idle time) over a trailing window, as a percent. Null when nothing was observed. |
| Verdict | [`pick-face-replenishment`](/contexts/pick-face-replenishment/ubiquitous-language) | The detector's result for one pick face: `Raise`, `Healthy`, `AlreadyOpen`, `NoPolicy` or `NoSource`. |
| Work pool | [`wes-work-planning`](/contexts/wes-work-planning/ubiquitous-language) | The queue for exactly one process path: its entries, feed mode (release-fed or flow-fed), WIP limit and alarm threshold. It does not store arrival or service rates. |
| WorkDemand | [`network-inventory-planning`](/contexts/network-inventory-planning/ubiquitous-language) | One leg of an approved transfer (`<transfer_id>:pick` or `:dispatch`) released to `wes-work-planning` as `WorkDemandReleased`. |
| WorkloadProfile | [`warehouse-planning`](/contexts/warehouse-planning/ubiquitous-language) | Per-warehouse conversion factors (units or packages per order) that normalize different processes' native rates into orders per hour. |
| WorkUnit | [`wes-work-planning`](/contexts/wes-work-planning/ubiquitous-language) | A releasable unit of work (for example one order line). It carries a CPT and is distinct from fulfillment-execution's Task. |
| Zone | [`facility-layout`](/contexts/facility-layout/ubiquitous-language) | A behavioral classification scoped to a Site, carrying a TemperatureClass and a Hazmat flag. |
