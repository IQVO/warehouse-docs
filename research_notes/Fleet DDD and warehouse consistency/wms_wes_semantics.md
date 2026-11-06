# WMS/WES semantics: is the warehouse-systems fleet consistent with industry literature?

Evidence conventions used throughout:

- Code refs are `repo@origin/develop:path:line`, read with `git show` / `git grep`. Commits read: inventory-storage 964b3bd, fulfillment-execution 7816d25, wes-work-planning f29f062, order-management 90a1ed6, slotting-optimization 225fc76, pick-face-replenishment 3ecb696, task-interleaving cf8f0e5, labor-performance a398b23, workforce-management 7d9e637, warehouse-planning 86248bb, process-path-management f7bb35e, inbound-receiving 3c5d554, returns-processing a7d363f, exception-management 3ec0818. warehouse-docs at main 1fd85274.
- Site refs are paths under `/Users/claudioed/warehouse-systems/warehouse-docs/`.
- Severity tags: **[error]**, **[debatable]**, **[scope gap]**, **[cosmetic]**, and **[right]** for things that hold up.
- **[memory]** marks a claim about a book's content that comes from my own recollection, not from returned text. Treat those as leads to check, not as citations.
- The CloudEvents `wms`/`wes` segment is a fixed contract label. It is not reported as a misclassification anywhere below.

## 1. Sources: what could actually be read

### Takeaway
The O'Reilly tool returns catalogue metadata only, with no book text, so no finding here rests on O'Reilly text. The one full warehouse textbook actually read is Bartholdi & Hackman, *Warehouse & Distribution Science* (free PDF, release 0.98). WES has no book coverage I could reach, so it rests on trade press, an analyst and one vendor paper.

### Cited Findings
- **O'Reilly MCP is metadata only** (title, author, date, URL). Available on the platform: [Richards, Warehouse Management, 5th ed., Kogan Page, 2025](https://learning.oreilly.com/library/view/-/9781398618718/), [Frazelle, World-Class Warehousing and Material Handling, 2nd ed., 2016](https://learning.oreilly.com/library/view/-/9780071842839/), [CSCMP, The Definitive Guide to Warehousing, 2013](https://learning.oreilly.com/library/view/-/9780133448931/), [Rushton et al., Handbook of Logistics and Distribution Management, 8th ed., 2026](https://learning.oreilly.com/library/view/-/9781398625136/), [Devenyi et al., The Warehouse Revolution, 2024](https://learning.oreilly.com/library/view/-/9781637425749/).
- **No results under these author filters:** Emmett, Piasecki, Mulcahy, Ten Hompel. A Bartholdi filter returned only an unrelated title. These are absent from the tool's results, which may not prove absence from the platform.
- **A WES keyword search on O'Reilly returned no WES book:** the only warehouse-specific title in that result set is *The Warehouse Revolution*, and I could not read its contents. The WES book gap is confirmed at the metadata level.
- **Read in full text:** [Bartholdi & Hackman, Warehouse & Distribution Science, release 0.98, ©1998-2017](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf), extracted locally. Section and printed page numbers below are from that text.
- **Blocked (HTTP 403), so not verifiable by me:** Gartner Peer Insights [1], the Gartner 2015 reprint [2], and the oreilly.com chapter previews [10]-[13]. The Frazelle [12], CSCMP [11], POSA [10] and Sustainability [13] quotes on the site therefore remain unchecked.
- **Web search on WES was mostly vendor content and found no academic definition:** [search results included Logistics Viewpoints, Modula, Mecalux, Hopstack, MMH](https://www.mmh.com/article/wms_wes_and_wcs_in_the_automation_era/WES).

### Inferences
- `docs/wms-wes/industry-reference.md:16-24` is honest that O'Reilly text was preview-only. The bigger weakness is that the page has no warehouse-operations book as a backbone: one Frazelle survey line, one CSCMP selection warning and a software-patterns book (POSA) stand in for the process literature. It defines the three acronyms but never sets out a warehouse process model, which is why the coverage gaps in section 4 go unnoticed.

### Gaps
- Richards' and Frazelle's picking, slotting and cycle-count chapters could not be read. Someone with an O'Reilly login should check the [memory] items below against them.
- Web search confirmed Richards has a chapter on order picking methods, through [catalogue listings](https://buecher.de/artikel/buch/warehouse-management/60894631), but no chapter text. Several "Warehouse Management Gwynne Richards" PDF hits look like machine-generated summaries and were discarded.

## 2. Definitions: does industry-reference.md represent the sources faithfully?

### Takeaway
Mostly yes. Every quote I could check is accurate and the WMS/WES/WCS stack is sound. The problems are in what the site infers from those quotes: the APQC citation does not support "above the WMS", the eWES claim stretches Interact Analysis, and the current dispute about whether WES is a distinct category at all goes unmentioned.

### Cited Findings
**Quotes verified against fetched text [right]:**
- Interact Analysis' three criteria, the eWES definition and the waveless passage match `industry-reference.md:136-137,146-155`: "individual orders are released to the warehouse based on the throughput of the downstream order consolidation" — [Interact Analysis, Scriven, Jan 2023](https://interactanalysis.com/insight/de-mystifying-the-warehouse-execution-system-market).
- KNAPP: no ISO/IEC/VDI standard; WMS and WES at ISA-95 level 3, WCS at level 2; a WMS makes no second-level control decisions — [KNAPP](https://www.knapp.com/en/insights/blog/from-term-chaos-to-order-wms-wes-and-wcs-defined). The fetch also returned a rule the site does not use: "For each decision, only one system can be responsible."
- MHI's WCS definition, WES "sometimes incorporates aspects of both WMS and WCS" — [MHI 2021](https://mhi.org/blog/125930/warehouse-software-discerning-the-differences-between-wms-wcs-and-wes). "Sitting between the WMS", "orchestrating the timing and location of order processing" — [MHI 2023](https://mhi.org/blog/126074/cloud-vs-on-prem-wes).
- "WES sits between...", "Not all WES are alike", "load balancing and automation-aware order release" — [MMH, Michel, Jul 2024](http://www.mmh.com/article/warehouse_execution_system_wms_blending_human_centered_workflows_with_automation).
- "grew out of the need...", "never really intended...", "right work to the right employees..." — [MMH, Michel, Oct 2023](http://www.mmh.com/article/warehouse_execution_systems_wes_stretches_to_encompass_labor). The site correctly labels "never really intended" as vendor speech (Ed Romaine, New Dawn, which sells a WES).
- APQC entries 4.4.2.4, 4.4.3.1 and 4.4.3.8, including the odd "4.4.3. 8" spacing, match `industry-reference.md:180-181` — [APQC PCF 7.4](https://solutions.ifrc.org/sites/default/files/2024-10/K014750_APQC%20Process%20Classification%20Framework%20%28PCF%29%20-%20Cross%20Industry%20-%20PDF%20Version%207.4.pdf).

**Citation and inference problems:**
- **[error] APQC is cited against its own structure.** `qualification.md:253-257` and `wes-tier.md` ("Above the WMS") use APQC to justify placing network deployment and transfers above the WMS. But APQC files 4.4.3.1 "Manage and track inventory deployment" and 4.4.3.8 "Manage warehouse transfers" *inside* 4.4.3 "Operate warehousing", next to 4.4.3.4 "Pick, pack, and ship" — [APQC PCF 7.4](https://solutions.ifrc.org/sites/default/files/2024-10/K014750_APQC%20Process%20Classification%20Framework%20%28PCF%29%20-%20Cross%20Industry%20-%20PDF%20Version%207.4.pdf). `industry-reference.md:180` states the filing correctly and then adds "so it is above any single WMS" as its own reasoning, but `qualification.md:255` presents it as support. APQC says nothing about tiers.
- **[debatable] "Above the WMS" as "which no single WMS owns" (`industry-reference.md:196-197`) is contradicted by a textbook.** Bartholdi lists "Multi-DC view" as an advanced WMS feature (§4.3, p.35) and says WMSs "are extending their functionality out along the supply chain" (§4.5, p.36) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf). The cited sources [13][14] do not state the claim.
- **[debatable] eWES is inferred, not sourced.** Interact defines eWES as solutions "that sit above the WCS". `industry-reference.md:156-157` says that with no WCS, any WES behaviour "is necessarily of the eWES kind". A system with no WCS beneath it does not sit above one. "WES-style release logic, no automation layer" would be more accurate.
- **[debatable] Disagreements are only partly acknowledged, despite `industry-reference.md:13-14` ("Where the sources disagree, the page says so").** Covered: MHI's blur; Gartner's short and long lists. Not covered:
  - Whether WES is a real category. Howard Turner (St. Onge) says the WES vision "has really not come to fruition" and that some WCS products were rebranded as WES "because WES was a popular buzzword", while KPI Solutions argues the opposite and another vendor describes WMS and WES converging — [MMH, McCrea, Jul 2026](https://www.mmh.com/article/wms_wes_and_wcs_in_the_automation_era/WES).
  - Feature tiering. Bartholdi puts wave management, task interleaving, replenishment, labor management, yard management, cycle counting, returns and flow-through among high-end WMS features, with SKU slotting as advanced, and places receiving, put-away, picking, packing and shipping in the basic set (§4.3, pp.34-35) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf). Note cycle counting sits at "high-end" here, while the site's Gartner quote treats "count" as core.
  - Whether a WES requires automation. MMH says WES components can be layered over a WMS to manage "lighter automation like mobile robots", while Interact's criterion 1 demands automation utilisation — [MMH 2024](http://www.mmh.com/article/warehouse_execution_system_wms_blending_human_centered_workflows_with_automation).
- **[cosmetic] Stale anchor.** The long Gartner list is from a 2015 reprint (`industry-reference.md:97-103`). A [2026 Magic Quadrant exists per vendor citations](https://www.softeon.com/2025-gartner-magic-quadrant-for-warehouse-management-systems/), and a [secondary summary](https://solutionsreview.com/enterprise-resource-planning/key-takeaways-2024-magic-quadrant-for-warehouse-management-systems) lists wave planning and cycle counting among core functions. I could not read Gartner's own text.
- **[cosmetic] Unattributed vendor quote.** "getting the right work to the right employees" (`industry-reference.md:141-143`, `wes-tier.md:33`) is Dan Gilmore, CMO of Softeon — [MMH 2023](http://www.mmh.com/article/warehouse_execution_systems_wes_stretches_to_encompass_labor). It reads as neutral description, though the site does flag the neighbouring New Dawn quote as vendor speech.

**Independent definitions from the book actually read:**
- WMS: "a large software system that coördinates the activities of the warehouse". It checks orders against inventory, identifies shortages, converts order-lines to pick-lines by unit of measure, organises pick-lines into pick-lists and sequences them (§3.3, pp.25-26) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf).
- The stock locator system is "the most fundamental capability of a WMS", which "supports directed put-away and directed picking" (§4.2, p.34) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf). The site never mentions this.
- A case-sensitive search of the extracted text finds zero hits for "WES", "warehouse execution", "WCS" and "warehouse control". This 2017 textbook does not use the three-layer vocabulary at all, which supports the site's point that these are market categories, not settled theory.

### Inferences
- The site's WMS definition is narrower than the book's on *directing* work. "Directed work activity" appears once (`industry-reference.md:89`) and is never turned into a test. That omission is what lets `index.md:80` declare the core complete (see section 4).

### Gaps
- The Gartner core wording ("receive, put away, store, count and pick, pack and ship") could not be confirmed. Search found only secondary summaries.
- Quotes attributed to Interact ("by controlling the timing and location of order processing") and KNAPP ("The VDI 3601 defines what a WMS is...") were neither confirmed nor contradicted by the summarising fetch tool.

## 3. Qualification: are the verdicts defensible?

### Takeaway
Most individual verdicts are defensible, but the decision diagram does not reproduce them: applied literally it misclassifies at least five contexts. The "embedded WES" conclusion is more generous than the strict test allows, "go beyond one building" is false for warehouse-planning, and four of nineteen contexts are unqualified.

### Cited Findings
**Decision tree against verdict table:**
- **[error] Q2 is over-broad.** Q2 asks "Decides across sites, sales channels or a planning horizon?" (`qualification.md:41`). `slotting-optimization` has horizon "days to weeks" (`qualification.md:79`), identical to `warehouse-planning` (`:87`). A literal reading sends slotting, and `workforce-management` (shift plan), to "Above the WMS", contradicting their WMS-extended verdicts.
- **[error] Q4 is over-broad.** Q4 asks "Owns the definitions a WES decision runs on?" (`:45`) and precedes the WMS questions.
  - `facility-layout` supplies the distance answer wes-work-planning uses (`wms-tier.md:140`).
  - `product-master`'s classification is copied into wes-work-planning (`wms-tier.md:173-174`).
  - `workforce-management`'s committed plan is, per the site, the source of WES path capacity (`qualification.md:228`).
  - All three would stop at "WES configuration", against their table verdicts (`:75,76,85`). The text at `qualification.md:65-69` explains question order but not this.
- **[debatable] "WES configuration" has no source.** No cited source names that category; the "process area" quote (`wes-tier.md:185`) is a vendor CMO's phrase. The verdict for process-path-management is still reasonable as *what it does*: its own CLAUDE.md says catalogue and CPT schedule only (`process-path-management@origin/develop:CLAUDE.md`).

**WES criteria (`qualification.md:224-235`):**
- **[right] Criterion 1 is candidly marked "Partly", and criterion 3 "Modelled, not exercised".** That honesty is what a study project should show.
- **[debatable] Criterion 2 is reinterpreted.** Interact's "orchestrate multiple sub-systems" is about automation subsystems in a market analysis of automation software. The site answers "yes" at process-path and station level. On Interact's strict wording the fleet scores 0 of 3, because there are no equipment subsystems, then concludes "the two contexts together are an embedded WES" (`:230`). Better wording: "implements the WES release and pull pattern; does not meet Interact's automation-based test".
- **[debatable] `qualification.md:226` calls fulfillment-execution's criterion 1 "Not its job. It receives already-released work."** This is stale or incomplete. `fulfillment-execution@origin/develop:apis/openapi.yaml:1541-1551` and its ADR-0058 add `POST /paths/{pathId}/work-requests`: "execution keeps the judgement of when to ask", planning keeps the release decision. No page in `docs/wms-wes/` or `capabilities.py` mentions it (grep for `work-requests` and `0058` is empty). This matters: it is the closest thing the fleet has to the pull Interact describes, and it splits WHEN (execution) from WHAT (planning), which contradicts Q3's "Decides by itself WHEN and WHERE".
- **[error] "Throttles" is overstated.** `qualification.md:226` says "Flow balancing throttles a path" and `wes-tier.md:100` says "recommends or throttles". `wes-work-planning@origin/develop:internal/application/usecases/rebalance_decision.go:88-96` only sets a recommendation and publishes `PathThrottled` or `LaborReassignmentFlagged`; the pool is not changed. A scan of `internal/adapters/inbound` in every sibling repo (excluding `wt-*`, infra and docs) found those names only in wes-work-planning's own inbound adapters, so I found no consumer that acts on them. Flow balancing is advisory.

**Spot checks against code:**

| Context | Site verdict | My judgement | Evidence |
| --- | --- | --- | --- |
| labor-performance | WMS extended | **[right]** Measure-only LMS | `standard/standard.go`, `performance/trend.go:52-67` (coaching flag at 85 %); no sibling calls |
| workforce-management | WMS extended | **[right]**, with a nuance | `CLAUDE.md` "the move itself is a human call"; `shiftplan/shift_plan.go:61-65` heads = ceil(charge/rate). The site merges WFM (who works when) and LMS (standards) under "labor management"; Gartner's "workforce/labor" permits that |
| process-path-management | WES configuration | **[debatable]** Fine as description, unsourced as category | `processpath/process_path.go` header |
| slotting-optimization | WMS extended | **[right]** | Plan, human approval, no execution; Gartner as quoted on the site, and Bartholdi §4.3, treat it as a WMS extension. Tree contradiction above |
| warehouse-planning | Above the WMS | **[debatable]** Single-site planner, see below | `capacityplan/capacity_plan.go`, `processcapacity/*` |
| fulfillment-execution | WES | **[debatable]** Closer to a WMS task-management core, see below | `task/task.go:18-23`, `claim_next.go:19-21,54` |
| wes-work-planning | WES | **[right]** for release logic | `release/work_pool.go`, `release_policy.go` |
| order-management | Above WMS + allocation | **[right]** | `CLAUDE.md:36-38`: allocation and release folded into `POST /orders` |

- **[error] `index.md:103` says "Four contexts go beyond one building", including capacity planning.** `warehouse-planning` plans one warehouse: its own CLAUDE.md asks "can this warehouse process the demand assigned to it", and its aggregate is keyed by process, location and window (`warehouse-planning@origin/develop:internal/domain/processcapacity/process_capacity.go`). It is also inconsistent on level: `qualification.md:87` says "3 to 4", while `index.md` draws the whole "Above the WMS" box as "ISA-95 level 4" and `qualification.md:255` says "(ISA-95 level 4)". **[memory]** ISA-95 level 3 includes detailed operations scheduling and capacity views, which would make "single-site planner at level 3" a defensible alternative.
- **[debatable] fulfillment-execution as "WES".** A queue of waiting tasks that a controller hands out is what Bartholdi attributes to "a supervisor or the warehouse management system" (§6.2.1, p.60), and pick, pack and ship are core WMS for Gartner as quoted on the site. Selection is by type, capability and earliest CPT (`claim_next.go`). The site's rationale ("orchestration is the narrower, rarer property", `qualification.md:65-69`) is the author's own judgement. A fair verdict would be "WMS execution core with WES-style pull dispatch".
- **[error] Coverage counts.** The section qualifies "seventeen contexts" (`index.md:5,14`; `qualification.md:4,12`; `industry-reference.md:12`) while the fleet has nineteen (`overview.md`, CLAUDE.md). `returns-processing` and `exception-management` have no row, count or diagram node in `qualification.md`, and are mentioned only as prose on the tier pages (`wms-tier.md:17-21`, `wes-tier.md:17-20`). `qualification.md:23-26` lists six `wms` contexts and calls `wes` "every other context", yet `returns-processing@origin/develop:apis/asyncapi.yaml` publishes `com.warehouse.wms.returns-processing`. Repo CLAUDE.md has the same conflict between its context list and its Events section. This is a page-consistency issue, not a label dispute.
- **[debatable] Four verdicts still open, and they are easy to close.** Gartner's list and Bartholdi's high-end list both name replenishment and task interleaving; Bartholdi names returns; APQC has 4.4.2.4-5. Suggested: `pick-face-replenishment` = WMS (high-end/extended), `returns-processing` = WMS (extended), `task-interleaving` = WMS extended (advisory; but see section 5), `exception-management` = cross-tier support, for the owner to decide.
- **[cosmetic] Deployment wording conflicts.** `qualification.md:25-26` and `wms-tier.md:15` say "built and deployed in the reference cluster"; `subdomain-classification.md:61-64` says returns and exception are "not registered in warehouse-infra"; `overview.md:21-25` says registered since 2026-10-22 and declines to say what any cluster has applied; CLAUDE.md says none of the four is deployed. `warehouse-infra@origin/develop:terraform/apps.yaml:87,212,259,311` has entries for all four. So `subdomain-classification.md:61-64` and the CLAUDE.md sentence are stale in saying they are unregistered; registry entry still does not prove a cluster runs them.

### Inferences
- Fixing the tree probably takes two wording changes: limit Q2 to "across sites or sales channels" and treat single-site planning separately, and limit Q4 to "process-execution definitions with no other role". The verdict table can then stand.

### Gaps
- I did not independently spot-check network-fulfillment or network-inventory-planning (out of scope per brief) beyond the APQC citation.

## 4. Process coverage: what is missing or thin relative to the books?

### Takeaway
The breadth is impressive for a study project and core transactions exist. However, `index.md:80` ("the core is complete") is too strong: directed put-away, stock holds, FEFO/rotation, pick batching and sequencing and scheduled counting are absent. Yard, VAS and WCS gaps are declared on the site; those above, plus cross-docking, are not.

### Cited Findings
Coverage table. "Stated?" means stated on this site as a scope exclusion.

| Process | State in code | Stated? | Severity |
| --- | --- | --- | --- |
| Receive (ASN, appointment, discrepancies, SSCC/LPN) | Good: `inbound-receiving` domain `asn`, `appointment`, `receipt/carton.go`; GS1 parsing | n/a | **[right]** |
| Directed put-away | **Absent.** Stow is an operator action validated after the fact. `inbound-receiving docs/adr/0001...:67` lists "Putaway directives" as out of scope; `inventory-storage CLAUDE.md:6` chaotic stow | In repo ADR only; `index.md:80` and `wms-tier.md:208-212` say put away exists | **[scope gap]** high |
| QC / quarantine / hold | **Absent** on stock. `inbound-receiving ADR 0001`: "a quarantine flow is a later ADR". Quarantine exists only for rejected transfer scans (`transfer_receipt_handler.go:18,64`) | Repo ADR only | **[scope gap]** |
| Storage, location master, handling segregation | Good: hazmat and DOT segregation at stow and pack | n/a | **[right]** |
| Lot / expiry / rotation (FEFO, FIFO) | Lot and expiry are "carried, not interpreted" on a container (`container/container.go:82-83,101`); keyword search finds no FIFO/FEFO anywhere in `internal/` of the 16 repos scanned | Not stated | **[scope gap]** |
| Replenishment | Good, MIN_MAX; demand-cover declared as not built (`pick-face-replenishment CLAUDE.md:19`) | Yes | **[right]** |
| Order release, waveless | Good; deliberate and documented (`wes-work-planning ADR-0002`) | Yes | **[right]** |
| Wave planning | Deliberately absent | Yes (`wms-tier.md:89-92`) | **[right]**, but see below |
| Allocation | Exists, simple (section 5) | Partly | **[debatable]** |
| Picking: discrete, line-at-a-time | One work unit per order line (`apply_order_allocated.go:55`), one task per claim | Implicit | **[right]** |
| Picking: batch, cluster, zone, pick-path sequencing | **Absent**: keyword search over `internal/` finds none | **Not stated** anywhere in `docs/wms-wes` or the BCA gap table (grep empty) | **[scope gap]** high |
| Goods-to-person, put wall, pick-to-light | **Absent**; only a `ToteWall` location type in facility-layout and the capability-string station model | Covered only generally by "no automation" | **[scope gap]** |
| Case vs each pick lines | Good: `CASE_PICK`, `EACH_PICK`, `BREAK_CASE` (`workunit/work_kind.go`), matching Bartholdi's order-line conversion example (§3.3, p.25). I did not trace who splits a line | n/a | **[right]** |
| Consolidation | `REBIN` fan-in tracker (`consolidation/order_consolidation.go`): tracks line arrivals; no wall or slot position | Partly | **[right]** |
| Packing | Seal, scan and DOT segregation, ship in own container. No cartonization logic found by keyword | Not stated | **[scope gap]** minor |
| Shipping | Stops at SLAM and manifest event | Yes (`wms-tier.md:114`, BCA gap) | **[right]** |
| Cycle counting | Thin and with a semantic flaw (section 5) | Partly | **[error]** |
| Returns | Good: grade, disposition, restock hand-off (`returns-processing internal/domain/disposition`) | **Wrongly reported missing**, see below | **[error]** in docs |
| Exceptions | `exception-management` case lifecycle exists, unqualified | n/a | **[right]**, unqualified |
| Labor management | Good (section 5) | n/a | **[right]** |
| Slotting | Exists, v1 limits documented in repo (section 5) | Partly | **[debatable]** |
| Cross-docking / flow-through | **Absent.** Only `RoleInboundCrossDock` as a site role in facility-layout (`site/role.go:32-33`); no flow in inbound-receiving | **Not stated** in BCA gaps | **[scope gap]** |
| Yard management | Absent; yard locations only | Yes (`heat-maps.md:359`; inbound ADR) | **[right]** |
| VAS / kitting | Absent; `VAS` and `Kit` activities in facility-layout (`slot/functional.go:17,69`) | Yes (`heat-maps.md:358`) | **[right]** |
| MHE / WCS | Absent; `EquipmentCommandPort` deliberately empty (`fulfillment-execution internal/application/ports/equipment.go`) | Yes, clearly | **[right]** |

Book basis for this checklist:
- Basic WMS: appointment scheduling, receiving, QA, put-away, location tracking, work-order management, picking, packing and consolidation, shipping. High-end: RF-directed operation, cycle counting, replenishment, VAS, returns, pick/put to light, yard, wave, labor, task interleaving, flow-through. Advanced: Multi-DC view, SKU slotting, broken-case flow, parcel shipping (§4.3, pp.34-35) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf).
- "Before product can be put away, an appropriate storage location must be determined. This is very important because where you store the product determines to a large extent how quickly and at what cost you later retrieve it" (§3.2, pp.24-25) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf).
- Batching increases pick density; "It is generally economic to batch single-line orders" (§3.3, pp.26-27) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf).
- Crossdock: an item already requested "can move directly from receiving to shipping, without intermediate storage" (ch.13) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf).
- A vendor guide lists the same picking taxonomy: single, batch, cluster, wave, zone — [Unleashed (vendor, not Richards)](https://unleashedsoftware.com/blog/warehouse-order-picking-methods-a-complete-guide).

Documentation errors in this area:
- **[error] `heat-maps.md:355` says of Returns Management: "No returns flow in any context."** `returns-processing` is built, on the fleet list, and in `terraform/apps.yaml`. Source of the stale text: `scripts/capability-map/capabilities.py:631`, so it must be fixed in the model. `--check` cannot catch this because it compares pages to the model, not the model to the code.
- **[error] `heat-maps.md:348` says of its gap table "None of them is built", while its Replenishment row (`:354`) says the owner is built with an execution chain.** Task Interleaving (`:356`) has the same problem. The two rows contradict the page's own lead.
- **[error] `wms-tier.md:89` says "The dotted arrow is the one function this fleet does not run as a WMS would".** Given the table above, it is one of several.
- **[error] `index.md:80-82` says "the core is complete... put away... all exist".** It exists as a recording transaction, not a directed one, and the book calls directed put-away the "most fundamental capability" (§4.2).
- **[error] REST routes on these pages are stale.** Examples checked against `apis/openapi.yaml`:
  - `POST /stock/receive` → `/stock-receipts`
  - `POST /stock/stow` → `/stowages`
  - `/bins/{binId}/cycle-count` → `/cycle-counts`
  - `/reservations/{id}/confirm-pick` → `/pick-confirmations`
  - `/paths/{pathId}/release` → `/work-releases`
  - `/paths/{pathId}/rebalance` → `/rebalance-decisions`
  - `/stations/{stationId}/claim-next` → `/task-claims`
  - `/tasks/{id}/seal-package` → `/package-seals`
  - `/packages/{id}/slam` → `/slam-runs`
  - `/orders/{id}/release` → `/releases` (per order-management `CLAUDE.md:37`)

  A regex scan flags about 30 route strings in `capabilities.py` and about 20 in `wms-tier.md` and `wes-tier.md` combined as absent from every fleet OpenAPI. Treat those counts as approximate: the scan has false positives for path fragments and `:verb` routes. Repo CLAUDE.md says every L3 "cites the REST routes... on develop", and `wms-tier.md`'s lead says the card is "the code that proves it".

### Inferences
- The right fix is one "Deliberately out of scope" list on `docs/wms-wes/` or `docs/overview.md`. Most of the absences are legitimate for an education project and several already have an ADR, but a reader of the site cannot tell them from oversights.
- The WES orchestrates outbound work and stock moves only. Stow and cycle count are not task types (`task/task.go:18-23`, plus `RELOCATE`, `REPLENISH`), so inbound and count labor cannot be released, dispatched, scored against a standard or interleaved. Those are direct limits on labor and WES claims, and the site does not say so.

### Gaps
- Keyword absence is not proof of absence. I searched `internal/` for English terms and read the core domain packages, but did not read every file. Note also that in one scan my `\b` alternations were unreliable; the absences named above were re-confirmed with plain patterns or by reading the relevant code.

## 5. Semantics checked against code

### Takeaway
Waveless release and replenishment triggering are modelled well, and pick-count ABC ranking is valid. Four things are semantically wrong or misleading: task interleaving cannot interleave different task types; cycle counts are per bin, not per SKU; allocation has no forward, rotation or deterministic rule, and it expires in 30 minutes; and glossary "usable" names stock states the code does not have.

### Cited Findings
**Wave vs waveless: [right], with limits.**
- ADR-0002 describes wave shape and trade-offs well, and it openly records "No natural travel batching... a real capability given up" (`wes-work-planning docs/docs/adr/0002-...md:99-102`). Implementation: one unit, earliest CPT first, WIP limit on release-fed pools (`release/work_pool.go`, `release_policy.go`). That matches Interact's pull description — [Interact Analysis](https://interactanalysis.com/insight/de-mystifying-the-warehouse-execution-system-market) — and KNAPP's "Order release and order sequencing in real time" — [KNAPP](https://www.knapp.com/en/insights/blog/from-term-chaos-to-order-wms-wes-and-wcs-defined).
- Bartholdi's "pick wave (scheduled chunk of work)" (p.80) and "wave management" as a high-end feature match the ADR's use of "wave" — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf).
- **[debatable] Pull signal differs from Interact's.** Interact's release follows "the throughput of the downstream order consolidation"; the fleet's signal is a per-path WIP count and execution's own queue draining (ADR-0058). Nothing connects REBIN or consolidation throughput to release, and order lines of one order are released independently, so fan-in completeness is handled only by the consolidation tracker after picking.
- **[error] A promise in ADR-0002 is not kept.** It says travel optimisation "now has to happen downstream in fulfillment-execution". `claim_next.go` has no travel logic beyond the hint tie-break. No batching or pick-path sequencing exists, though the book assigns both to the WMS (§3.3, p.26). Fix the ADR upstream or state the gap.

**Task interleaving: [error] the name does not match the behaviour.**
- Book meaning: "careful interleaving of put-aways and retrievals"; the controller "assigns trips that are pairs of stows and retrievals" to reduce deadheading (§6.2.1, p.60) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf). Gartner lists it as a WMS function (`industry-reference.md:97-100`). The site's own definition is "combine tasks of different types into one trip" (`heat-maps.md:356`, `capabilities.py:633`).
- Code: a hint can never cross types. `claim_next.go:54` calls `FindClaimableByType(ctx, taskType, now)`, and ADR 0051 says the hint only applies inside "one CPT instant — claimNext already scans a single task type" (`fulfillment-execution docs/docs/adr/0051-...md:73`). Also, `STOW` is not a task type in `fulfillment-execution task/task.go:18-23` or in `task-interleaving policy/policy.go:64-69`, so the canonical put-away and retrieval pairing cannot be expressed at all.
- **[right]** The docs do honestly say "advisory tie-break" (`wms-tier.md:107-108`), and the recommender logic (rank by detour; `recommend`) is sound. But `wms-tier.md` maps Gartner's "Task interleaving" to it as owned (`F14 --> TIN`). In effect it is same-type next-task proximity, closer to pick sequencing than to dual-cycle.

**Allocation and reservation: [debatable] to [error].**
- **[right]** Quantity is bound to stock units with a pick bin recorded (`reservation/reservation.go`: `Allocation{StockUnitID, BinID, Quantity}`), revocable, owner-segregated, sealed cases not split. Matches the book's "checks the order against available inventory and identifies any shortages" (§3.3, p.25). Ledger in the WMS tier, request from the order tier: sensible.
- **[error] No allocation rule.** `reserve_stock.go:234-270` walks the units as returned, and `stock_repo.go:73` is `SELECT ... FROM stock_units WHERE sku = $1` with no `ORDER BY`. So picks are not directed to forward slots rather than reserve, there is no FIFO/FEFO, and selection depends on unspecified row order. A keyword check for `forward` or `pick-face` in `reserve*` and `domain/stock` finds nothing. This undercuts slotting and replenishment: the book's forward-reserve economics say a pick from reserve is the more expensive case (§8.4, p.111) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf) — yet the fleet can allocate there even when the pick face has stock. The planner and the replenisher have no effect on which bin a pick uses.
- **[debatable] 30-minute expiry vs waveless pool.** `DefaultReservationTimeout = 30 * time.Minute` (`reserve_stock.go:15`). `cmd/inventory/server.go:23` sets no `Timeout`, and I found no env override. `Confirm` refuses an expired reservation (`docs/docs/adr/0003-revocable-reservations.md:67-70`). Work may legitimately wait in a CPT-ordered pool longer than that, so an allocated order could lose its stock before it is picked. I read this from code and the ADR but did not run it, and I did not trace every recovery path. Owner should check. **[memory]** Commercial WMS allocations normally do not time out while orders are in process.
- **[cosmetic] Terminology.** "Reservation" and "allocation" are used interchangeably (`reservation.go`; ADR 0003 title describes allocation as a revocable claim). **[memory]** Literature and products often separate soft reservation at order level from hard allocation to a location.

**Replenishment: [right].**
- `detection/detector.go`: Available = OnHand − Reserved; Projected adds open inbound; raise when Projected <= MinQty; quantity = Max − Projected rounded down to a multiple and capped at source usable; URGENT when Available <= 0; one open request per face. This is a correct min/max with an inventory-position view, and counting reserved quantity makes it demand-aware in the short term. Execution via WES and task is correctly separated.
- The book frames forward restocking as cost trade-offs and mentions restocking at wave end (p.80) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf). Demand-cover is honestly listed as unbuilt.
- **[debatable]** `fullest-reserve-bin-v1` (`detection/source.go`) minimises trips but ignores rotation and tends to leave partial bins. **[memory]** Common practice favours oldest stock or emptying nearly-empty locations. Documented as v1, so low severity.
- `Multiple` from case level matches the book's point on picking by carton.

**ABC and slotting: [right] on the metric, [debatable] on the method.**
- **[right]** Ranking by order-line picks, not units (`planner.go` `candidates`), matches the book's "each pick-line represents a location to be visited, and... the number of pick-lines is an indication of the labor required" (§3.3, p.26) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf). The 80 % / 95 % thresholds (`docs/adr/0002-...md:108-111`) are a conventional Pareto split, and §14.2.1 of the book covers ABC analysis.
- **[debatable] No cube-per-order index.** COI is space allocated over picks (Q8.53, p.138, citing Heskett) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf). The planner uses size only to check one unit fits. So a bulky, popular SKU and a small one rank by picks alone. Not an error, since popularity-based slotting is valid, but the site does not state it. **[memory]** Frazelle discusses COI and popularity alongside each other.
- **[debatable] Slot "goodness" is alphabetical.** `LexicalRanking` (`planner.go:36`) orders slots by location code, documented as "the v1 stand-in" (ADR 0002). So "best free slot" has no travel or golden-zone meaning, although Bartholdi notes the golden zone (pp.123, 132, 141) and task-interleaving already has a `rectilinear-v1` travel model. `wms-tier.md:303-305` doesn't mention this, and without it the outcome reads as more optimising than it is.
- **[debatable] ABC class is a label only.** `planner_placement.go:55` stores it; placement walks rank order and does not use the class. Any picked SKU gets a forward slot while slots remain, even class C, whereas §8.4 (p.111) says it "does not make sense" to store slow movers in the fast-pick area. No slot-quantity sizing either (§8.3); out of scope per ADR 0002 ("later ADRs").
- **[cosmetic]** Velocity input is demand lines (`SkuVelocity.Picks` counts ACTIVE demand lines), not executed picks. Fine as a proxy.

**Inventory states: [error] in the glossary, [scope gap] in the model.**
- Code states: `AVAILABLE`, `RESERVED`, `PICKED`, `REMOVED`, `UNLOCATED` (`stock/state.go:7-18`). `Usable()` excludes only `UNLOCATED` and `REMOVED` (`stock_unit.go:188-199`).
- `docs/glossary.md:122` defines usable as "on-hand minus active reservations minus held, damaged or unlocated stock"; the synced `docs/contexts/inventory-storage/ubiquitous-language.md:94` says the same. No held or damaged state exists. Glossary is hand-written here; the UL page needs an upstream fix.
- Missing relative to common practice: quarantine or QC hold, damaged, expired, in-transit as stock status. APQC includes "Receive, inspect, and store" (4.4.3.2). Damaged inbound units are kept out of stock per inbound ADR 0001, which is a legitimate simplification, just unstated on the site.

**Cycle counting: [error] on grain, [scope gap] on process.**
- `RunCycleCount.Execute(ctx, binID, countedQty)` (`run_cycle_count.go:40,46`) takes one quantity per bin and compares it to the sum across all located units in that bin. With chaotic storage, where "any SKU may occupy any free bin" (`glossary.md` Bin), a swap of 5 of SKU A for 5 of SKU B reconciles clean. **[memory]** Counting's purpose is SKU-at-location accuracy. The one book I read gives little direct support: it says only "Cycle-counting: What to count and when, to reconcile book and physical inventories" as a topic still confined to class notes (p.285), and lists it as a high-end WMS feature (§4.3) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf). A keyword check of `internal/domain/location` and the stow use cases found no single-SKU-per-bin rule, but I did not read them line by line, so confirm mixed bins are reachable before treating this as a live defect.
- Overage is reported but never adjusted ("requires a separate receiving/audit process", `:66`) and I found no such process; shortfall marks whole units Unlocated (`:78`, documented simplification).
- No count task, schedule, ABC frequency, blind count, recount or approval. `capabilities.py:275` honestly scopes it to "record a physical count and detect discrepancies"; `wms-tier.md:217` presents it as Gartner's "Count". **[memory]** Piasecki's *Inventory Accuracy* centres on these process controls.

**Labor standards: [right] overall, [cosmetic] on "engineered".**
- Effective-dated standard frozen at completion, optional travel component, handling-unit variants, team lift, efficiency percent, coaching flag at 85 % for 3 tasks (`standard/standard.go`, `performance/trend.go:52-67`). Matches "track picker productivity... picks per person-hour" (§3.3.1, p.28) — [Bartholdi & Hackman](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf); the book also reports pick rate as a fraction of the "work-standard" (Fig. 11.6, p.185). Standard per task type is defensible since one task is one line.
- **[debatable]** "Engineered" is a label on a human-declared number ("a PICK should take 45s"); no elemental or travel computation from location. Quantity is not scaled, and `TaskCompleted` carries quantity only on stock moves (labor-performance ADR 0035:53-59). **[memory]** Engineered standards are usually built from elements (MTM/MOST) with computed travel. Also stow and count work have no standards because they are not tasks.
- **UPH** exists only as `rateUnitsPerHour` on the path plan and `plannedRate`. The formula `heads = ceil(charge / rate)` (`shift_plan.go:61-65`) is the standard labor calculation, and is consistent with §3.3.1.

**warehouse-planning capacity model: [right] on structure, [debatable] on demand.**
- Process capacity is the minimum across constraints (LABOR, LOCATION, EQUIPMENT, STATION, CONVEYOR, BUFFER, REPLENISHMENT); path capacity is the minimum across steps with the bottleneck named and normalised to ORDER (`process_path_capacity.go`, `process_capacity.go:20-29`); station count × declared standard (`station_standard.go`). This is sound bottleneck logic.
- **[debatable]** Default demand is a read model from already-placed orders with a promise instant (`demand/order.go`, `DemandSourceOrders`), or a caller-stated figure. A "days to weeks" horizon (`qualification.md:87`) cannot be filled by placed orders, and no forecast exists.
- **[debatable]** Ownership duplication: it keeps its own `processpath` and "nothing is consumed from process-path-management" (`process_capacity.go:13`), so two catalogues describe process paths.

### Inferences
- The most valuable single fix for domain credibility is making allocation forward-first with a deterministic rule. It would make slotting and replenishment actually affect picking.

### Gaps
- No end-to-end run was done. Findings describe code and ADRs, not observed behaviour. `warehouse-docs` itself says the replenishment and interleaving chains have not been exercised on the cluster (`wms-tier.md:111`).
- Printed page numbers for Bartholdi are derived from the PDF offset (PDF page minus 22), checked against the table of contents and index at several points.

## 6. Terminology and ownership allocation

### Takeaway
Core terms are used correctly, but much of the vocabulary is fulfilment-centre jargon with no industry synonym given. Responsibility placement is mostly sensible, with work origination and inbound as the weak spots.

### Cited Findings
**Terms:**

| Term | Fleet meaning | Verdict |
| --- | --- | --- |
| SKU, bin, location code | Standard | **[right]** |
| Pick face / forward bin | Forward slot assigned to one SKU, refilled from reserve (`glossary.md`) | **[right]**; matches [Bartholdi's forward/reserve framing](https://www2.isye.gatech.edu/~jjb/wh/book/editions/wh-sci-0.98.pdf) |
| Task | Unit of physical work with lease | **[right]**, but outbound-only (no STOW, COUNT) |
| Wave | Used correctly in ADR-0002, not modelled | **[right]** |
| LPN | Sealed case only; "cases is 1 in v1" (`container/container.go`), SSCC or internal | **[debatable]**: **[memory]** LPN normally spans pallet, tote and carton; acceptable v1 |
| Zone | "A behavioral classification... TemperatureClass and a Hazmat flag" | **[debatable]**: narrower than a pick or area zone, and is why zone picking has no hook |
| Station | "A work position... one occupant"; roaming pickers claim tasks as "stations", and `StationTrip` tracks "where the operator stands" | **[debatable]**: industry station is a fixed workstation; conflates picker with place |
| Rebin | Fan-in ledger; no put wall term anywhere | **[cosmetic]**: **[memory]** closest industry term is put wall / sort-to-order |
| Stow | Put-away. Bartholdi uses "stow" too | **[right]** |
| CPT, Charge, SLAM, process path | FC-specific jargon, defined in glossary (`glossary.md`), e.g. CPT "Critical Pull Time" | **[cosmetic]**: no synonym such as carrier cutoff, workload or print-and-apply/manifest; grep for "also called"/"known as" in `glossary.md` finds none |
| Usable | See section 5 | **[error]** |
| Reservation / allocation | Interchangeable | **[cosmetic]** |

**Ownership:**
- **[right]** Release and sequencing in the WES tier: KNAPP assigns "Order release and order sequencing in real time" to the WES — [KNAPP](https://www.knapp.com/en/insights/blog/from-term-chaos-to-order-wms-wes-and-wcs-defined). Wave replaced deliberately.
- **[right]** Stock ledger, reservations and counts in inventory-storage, with order-management only requesting. Slot plans decided by slotting and executed via WES. Replenishment requested by a `wms` context, executed via WES. A clean decide/execute separation, in line with KNAPP's "For each decision, only one system can be responsible".
- **[debatable]** Task generation. KNAPP lists translating orders into executable warehouse tasks as a WMS task, and `industry-reference.md:56` draws WMS → WES "warehouse tasks and order pool". In the fleet, order-management hands `OrderAllocated` to wes-work-planning, which creates work units, and fulfillment-execution creates tasks; the WMS tier supplies neither. So the stack diagram does not describe this fleet. Harmless if said; the site doesn't say it.
- **[debatable]** Work queues in a `wes` context hold core WMS transactions (pick, pack, ship). The site states this openly (`wms-tier.md:28-30`).
- **[scope gap]** Put-away and count work have no owner in any queue, so no tier directs them.

### Inferences
- A small "fleet term → common industry term" column in `docs/glossary.md` would address most of the terminology findings at low cost, and suits an educational site.

### Gaps
- "Critical Pull Time", "charge" and "SLAM" appear to be practitioner terms from large e-commerce fulfilment. I found no neutral published definition in the sources read, and did not research their origin.

## 7. What is right (summary for the report writer)

### Takeaway
For a study project, the domain modelling is well above average, and the WMS & WES section's central move, separating an industry category from a contract label and citing it, is sound and honestly caveated.

### Cited Findings
- Stack and placement of WMS, WES and WCS agree across [MHI](https://mhi.org/blog/126074/cloud-vs-on-prem-wes), [MMH](http://www.mmh.com/article/warehouse_execution_system_wms_blending_human_centered_workflows_with_automation) and [KNAPP](https://www.knapp.com/en/insights/blog/from-term-chaos-to-order-wms-wes-and-wcs-defined), and the site reproduces them faithfully.
- Equipment absence is stated plainly and enforced by an empty port with an ADR (`fulfillment-execution internal/application/ports/equipment.go`; `qualification.md:232-235`).
- Yard, VAS/kitting, outbound transportation, billing and WCS are declared as gaps (`heat-maps.md:348-362`).
- Waveless is a documented decision with costs admitted (ADR-0002).
- Min/max replenishment, pick-line-based ABC, case/each handling, GS1/SSCC identity, hazmat segregation, frozen labor standards and min-of-constraints capacity all match industry or book practice (section 5).
- `not yet qualified` is an honest label rather than an invented verdict.

### Inferences
- Priority order for corrections:
  1. Docs errors, all cheap: `heat-maps.md:355`, `:348`; stale REST routes; `index.md:103`; "seventeen"; glossary usable; "throttles"; the tree's Q2 and Q4.
  2. Add an explicit out-of-scope list: directed put-away, QC holds, FEFO, batch/cluster/zone/G2P, cross-dock, cartonization, count scheduling.
  3. Domain fixes only if wanted: forward-first deterministic allocation; per-SKU cycle count; reservation expiry; real cross-type interleaving or a rename.

### Gaps
- General DDD conformance and the network domain were out of scope and not assessed.
