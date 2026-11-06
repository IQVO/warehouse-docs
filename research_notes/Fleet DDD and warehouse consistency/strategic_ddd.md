# Strategic DDD consistency of the warehouse-systems ecosystem

Conventions used in these notes:

- **Severity:** `error` (wrong by the books or self-contradictory), `debatable` (a defensible choice, but the justification is weak or the label stretched), `cosmetic` (stale count, naming, wording).
- **File citations** are repo-relative to `warehouse-docs/` unless a repo is named, as `path:line`. Service repos were read from `origin/develop`; `warehouse-infra` `origin/develop` was at `0a4df3d` (2026-11-02). All repos were read only.
- **Source access.**
  - The O'Reilly MCP returned **metadata only** (title, author, URL) for every query. No book text came back from it. Listings: [Evans 2003](https://learning.oreilly.com/library/view/-/0321125215/?orm_source=mcp), [Khononov 2021](https://learning.oreilly.com/library/view/-/9781098100124/?orm_source=mcp), [Tune & Perrin 2024](https://learning.oreilly.com/library/view/-/9781633438156/?orm_source=mcp).
  - Primary text actually read:
    - Evans, [DDD Reference (2015)](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf), full text extracted from the PDF. Cited as "Reference p.N", using the book's printed page numbers.
    - [ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)
    - [ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts), including its [template image](https://raw.githubusercontent.com/ddd-crew/core-domain-charts/master/resources/core-domain-chart-template.jpg)
    - [ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)
    - [ddd-crew starter process](https://github.com/ddd-crew/ddd-starter-modelling-process)
    - [ddd-crew EventStorming cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
  - **`[MEMORY]`** marks a claim about Vernon, Khononov, Brandolini, Tune, Newman or Skelton & Pais that comes from my own recollection, not from returned text. Those claims carry no chapter numbers and no quotations. Nothing tagged `[MEMORY]` is the sole basis of an `error`.
- **Not re-reported as discoveries:**
  - the `buildingId`/`siteCode` open note (audit-decisions:99-106)
  - short picks not modelled (audit-decisions:91)
  - the K1/K3/K14/K9/K16/K7/A7 pattern disagreements (context-map:647-657)
  - WP's neighbour points on its chart (core-domain-chart:90-107)
  - Open network gaps G41-G65, including G47, G51 and G63, which the register already lists as Open

## Overall verdict

The fleet is much closer to the books than most real systems. Its best work: a declared-homonym section, a verified absence of shared code across 36 repos, CloudEvents as a real Published Language, full canvases, and honest wiring statuses.

The problems fall into four groups:

1. **Core criteria.** Core verdicts lean on arguments the fleet's own page rules out. Two Core contexts have outputs that nothing in the operating loop acts on.
2. **Pattern vocabulary.** Context-map patterns are applied per message and per adapter, not per model relationship. That produces CF+ACL hybrids, "C/S with no influence", Separate Ways on connected pairs, and upstream labels that invert the page's own rule.
3. **Staleness since mid-October.** `returns-processing`/`exception-management` are absent from the fleet UL and glossary. The agent's write slices and all A2A edges are absent from the map. The context map contradicts itself on status.
4. **Workshop labels.** EventStorming and Core Domain Chart are documents wearing workshop labels. The fleet page discloses this; the network page does not. The chart page also misstates ddd-crew's axes.

## Subdomain classification: are the verdicts defensible, and do the pages agree?

### Takeaway

Eight Core of 36 (5/19, 2/11, 1/6) is not "too thin" by any rule in the literature, since Evans gives no number. Only two of the five WMS/WES Core verdicts (`wes-work-planning`, the dispatch slice of `fulfillment-execution`) survive the fleet's own test. `inventory-storage`, `warehouse-planning` and `network-inventory-planning` are argued with necessity, uniqueness or size. The network section has the best statement of the test and does not apply it to the fleet. Page agreement is good across all 36 cards, with four stale exceptions.

### Cited Findings

**Book basis**

- Evans warns that "all complicated and all absolutely necessary to success" components obscure the core, and instructs: "Boil the model down... Make the core small... Justify investment in any other part by how it supports the distilled core." — [DDD Reference p.40](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)
- Evans on generic subdomains: "cohesive subdomains that are not the motivation for your project... Leave no trace of your specialties in them... consider off-the-shelf solutions." — [DDD Reference p.41](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)
- Evans on the vision statement: "a short description (about one page) of the core domain... Ignore those aspects that do not distinguish this domain model from others... Keep it narrow... revise it as you gain new insight." — [DDD Reference p.42](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)
- `[MEMORY]` Khononov classifies by competitive advantage, complexity, volatility and build/buy. Core is high on all of these, generic is complex but solved and bought, supporting is simple and built cheaply. Vernon recommends aligning one bounded context to one subdomain and distinguishes problem space from solution space.

**WMS/WES Core verdicts** (`docs/strategic-design/subdomain-classification.md`)

| Context | Verdict on the verdict | Severity | Evidence |
| --- | --- | --- | --- |
| `wes-work-planning` | **Conforms.** Vision and chart agree; the release decision is what the vision says wins; the chart states what would demote it. | - | subdomain-classification:38; domain-vision:33-35; core-domain-chart:187 |
| `fulfillment-execution` | **Conforms, at slice level.** Dispatch and lease are Core. The context's own chart spans y 0.12 to 0.88. Whole-context Core is a defensible rollup, disclosed. | - | subdomain-classification:39, :111; contexts/fulfillment-execution/core-domain-chart:38-44 |
| `inventory-storage` | **Weak.** See below. | debatable | subdomain-classification:40 |
| `warehouse-planning` | **Weak: aspiration, not present advantage.** See below. | debatable, leaning error | subdomain-classification:41 |
| `network-inventory-planning` | **Weak, and an inconsistent criterion.** See below. | error (criterion) | subdomain-classification:42, :50 |

- **`inventory-storage` evidence is what the page rules out.**
  - The page says "Size, difficulty and how interesting the code is do not decide it" (subdomain-classification:11-12).
  - Its case is then "four aggregates and 30 tested aggregate invariants" and "Every customer promise rests on its usable answer" (:40). That is size plus necessity, the exact trap in Reference p.40.
  - The vision says the edge is "**not** any single warehouse management (WMS) capability in isolation" and that the three loop inputs are "each individually well understood" (domain-vision:23-26).
  - The cited reference line "Inventory & Slotting is Core" (:40; contexts/facility-layout/index.md:35) also names slotting, but slotting is Supporting (:50).
  - Its evolution is "moving towards Product" (:40), which is odd for a Core.
  - A slice reading (revocable reservations Core, ledger Supporting) would match how FE is argued.
- **`warehouse-planning` argument is self-declaration plus uniqueness.** It reads "ADR 0001 introduces it as a Core Domain. No other context computes..." (:41; warehouse-planning `docs/adr/0001-warehouse-planning-bounded-context.md:23`).
  - Being the only owner of a calculation is not differentiation.
  - Its outputs move no operating decision. OM's read model "only annotates orders... No promise moves" (context-map:374). There is no runtime relationship with `wes-work-planning` (context-map:572-573). The vision's orchestration loop omits it (domain-vision:28-35). Observed-capacity variance is "advisory and never changes or republishes a plan" (context-map:405).
- **`network-inventory-planning` is Core despite "no forecasting or optimisation is built yet" (:42).**
  - Its ADR describes "deterministic transfer proposals" (network-inventory-planning `docs/docs/adr/0001*:7`), and proposals need operator approval.
  - The same page demotes slotting because its policy is "a deterministic, replaceable policy behind a port" (:50), and PFR and TI for being "replaceable policy objects" (:51, :52).
  - "Replaceable behind a port" is a design property, not a strategic one. Applied evenly it would demote NIP, or it should not have demoted the others.
  - Same uniqueness argument as WPL ("No other context decides...").
- **The fleet page has no decisive test; the network page does.** Network: "The test for Core is not 'is it hard' but 'would buying it, and conforming to the vendor's model, cost us the reason customers choose us'" (network/docs/strategic-design/subdomain-classification.md:61-63). Applied to the fleet, this test likely keeps WP and FE dispatch and questions the other three. (debatable)

**Other verdicts**

- **`process-path-management` = Generic is inconsistent. Severity: debatable, leaning error.**
  - The page says WFM is "not Generic, because it is too tied to the fleet's process-path vocabulary" (subdomain-classification:44). PPM *owns* that vocabulary and is called Generic (:56).
  - PPM's evolution is "Custom-built", it carries the CPT schedule and the fulfillment-capability contract (core-domain-chart:170-171), and no off-the-shelf equivalent is named. That fails "Leave no trace of your specialties" (Reference p.41).
  - The real reason given is reuse ("several contexts need the same definition", :56). Reuse is not genericity.
  - Its y 0.22 sits at the edge of ddd-crew's Generic band. WP's chart already reads it as Supporting (core-domain-chart:95-97, recorded but not resolved). Supporting fits better.
- **`facility-layout` = Generic conforms.** Adopted industry convention, explicit "complexity is not classification" (core-domain-chart:178-180). Building rather than buying is fine for a study project.
- **`order-management` = Generic/Supporting.** As a *subdomain* label it is not a book category. As shorthand for "one context holds a Generic slice and a Supporting slice" it is legitimate and honest (subdomain-classification:91-104). Three problems:
  1. It is inconsistent with FE and INV, which also span quadrants but take one context-level verdict (:106-120). The page's own rule yields "Supporting, with a Generic intake slice". Severity: debatable.
  2. **The geometry contradicts the prose.** Prose says intake is commodity/Generic and promise rules lift it toward Supporting (:43). Coordinates put intake at (0.15, 0.12), the *Supporting* quadrant by the page's table (core-domain-chart:19), and promise/routing at (0.62, 0.45), the *Generic* quadrant (subdomain-classification:98 even says so). The page does not notice that its evidence inverts its argument. The cause is the quadrant scheme below. Severity: error.
  3. The landing page cannot express it: `tier` type is `'Core'|'Supporting'|'Generic'`, and OM is `'Supporting'` (src/pages/index.tsx:13, :17), while CLAUDE.md:104 and contexts/index.md:80 say Generic/Supporting. Severity: cosmetic.
- **The vision does not match the classification. Severity: error.**
  - The loop that "wins" names OM (Generic/Supporting) and WFM (Supporting) as parts, and omits two Core contexts (domain-vision:28-35).
  - The closing paragraph says everything else exists "never to make decisions on its own" (:37-41), though slotting, PFR, NIP and WPL all decide things.
  - The quoted statement itself includes non-distinguishing aspects (physical structure and workforce measurement, :15-16), against "Ignore those aspects that do not distinguish". The rest of the page is a catalogue and flow table.
  - By contrast the network vision is narrow and conforms (network/docs/strategic-design/domain-vision.md:10-14).
- **Network classification conforms.** Two Core with an explicit test, Problem space separated from Solution space (:22-55), a transport caveat, and reconciliation with the fleet's promise (:70-79). Model, chart and page are generated from one source. The fleet page lacks a problem-space table and classifies contexts directly (`[MEMORY]` Vernon/Khononov separate these). Severity: debatable.
- **Storefront `pricing` = Core is debatable.** The evidence is "Cost is the top abandonment reason" (storefront/docs/strategic-design/subdomain-classification.md Problem space table), which is importance. The section also says the six contexts "map 1:1 onto the composable-commerce capability lists", where pricing is a purchasable capability. Chart (x 0.52, y 0.78) sits just right of the midline.
- **Storefront `product-discovery`** is noted "Core candidate at scale", which is a good disclosed movement.
- **`exception-management`** "candidate Core" (subdomain-classification:54) is a good disclosed movement. WPL and NIP would be better labelled the same way: the ddd-crew template has a "Big-bet sub-domain" marker for this case ([template](https://raw.githubusercontent.com/ddd-crew/core-domain-charts/master/resources/core-domain-chart-template.jpg)).

**Do the pages agree?**

- **Agree (checked):**
  - All 36 `tier` values in src/pages/index.tsx:17-58 match the classification pages and models.
  - All 19 fleet `index.md` badges match.
  - Canvas Domain rows match where parsed (9 tables, others in prose).
  - context-map node colours (:299-305) and contexts/index.md:80-94 match.
  - Network and storefront are generated from `model.yaml`.
- **Disagree:**
  - **`docs/strategic-design/ddd-starter-modelling-process.md:104-105`** omits `network-inventory-planning` from Core and `returns-processing`/`exception-management` from Supporting. It says "seventeen" (:18, :54, :83) and a "thirteen contexts" chart (:95). Severity: error (stale classification table).
  - **`domain-vision.md:43`** "The seventeen contexts" table omits both new contexts (:47-63), and :78 says "seventeen repos". Severity: error (stale).
  - **`subdomain-classification.md:24-25`, :65 and `core-domain-chart.md:5`, :156-164** say the two repos "ship no ddd-crew pack" and "no chart". Both packs are synced: `docs/contexts/returns-processing/` and `exception-management/` each have the full page set including `core-domain-chart.md` and `context-map.md`. Their charts are flowcharts with no coordinates (returns-processing/core-domain-chart.md:20-39), so "not plotted" holds for a different reason. Severity: error (false statement).
  - **CLAUDE.md:97-104: verified, the Classification list omits `returns-processing` and `exception-management`.** It lists 9 Supporting; the site has 11 (subdomain-classification:58, :53-54; index.tsx:34-35). The site has them, so CLAUDE.md is stale, not the site. Severity: error (it says "must match everywhere").
  - **CLAUDE.md:297** says `wms` goes to six named contexts and `wes` to "every other", but `returns-processing` publishes `com.warehouse.wms.returns-processing.*` (git grep on its `origin/develop`), as the site says (subdomain-classification:53). Severity: cosmetic.
- **`warehouse-ops-agent` classification evidence is out of date. Severity: error.** "Only recommends, with zero write tools" (subdomain-classification:46; core-domain-chart:137; contexts/warehouse-ops-agent/bounded-context-canvas.md:169). Agent ADR 0027 (2026-10-29) and ADR 0029 (2026-11-02) added two human-approved write slices delegated over A2A. The chart says the agent "would move up only by adding write capability" (core-domain-chart:189), so a recorded re-classification trigger fired without review. See the context-map section.

**Core Domain Chart technique**

- **`core-domain-chart.md:10-20` misdescribes ddd-crew. Severity: error.**
  - The page says x = complexity, y = differentiation. The [ddd-crew template](https://raw.githubusercontent.com/ddd-crew/core-domain-charts/master/resources/core-domain-chart-template.jpg) has x = Business Differentiation, y = Model Complexity.
  - The template's regions are not four quadrants: Generic is a low-differentiation band at *any* complexity, Supporting wraps the low-complexity band across differentiation, and Core is high/high.
  - On the template, order intake (diff 0.12) is Generic, which would dissolve the OM inversion above. "Decisive - Short-term Core" is not on the template image.
  - `[MEMORY]` Those terms come from Nick Tune's Core Domain Patterns article (fetch returned HTTP 403).
  - The 4-quadrant "complex but undifferentiated = Generic, simple = Supporting" scheme is closer to `[MEMORY]` Khononov's table. It is a reasonable scheme, but attributed to the wrong source. The network chart copies it (network/docs/strategic-design/core-domain-chart.md:10-13).

**Conforming detail**

- `core-domain-chart.md:50-52` marks positions as "judgements... not measurements". ddd-crew says this measurement "is usually quite subjective" ([README](https://github.com/ddd-crew/core-domain-charts)).
- Slice-level charts and the "what would move it" notes (:185-192) match the technique's intent.

### Inferences

- "Is Core spread too thin?" is the wrong framing for the count. The better finding is that Core in WMS/WES means three different things: differentiating now (WP, FE dispatch), load-bearing (INV), and bet on the future (WPL, NIP).
- Across three domains, 8 Core is fine because each domain models a different organisation (network/.../subdomain-classification.md:70-79).
- Suggested repair: adopt the network's test in the fleet page, and mark WPL and NIP as big-bet or candidate Core.
- A slice reading of INV would still give the fleet a Core of WP plus FE dispatch plus INV reservations, which is one orchestration story and matches the vision.

### Gaps

- Khononov's and Vernon's exact criteria could not be read; the O'Reilly MCP returned no text. Evans' Reference has no volatility criterion.
- No business stakeholder input exists to validate differentiation. That is inherent to a study project, not a defect.
- Whether commercial WMSs make reservation logic a commodity is for the industry-semantics researcher.

## Bounded contexts: linguistic boundaries or microservice splits? Is 36 over-decomposed?

### Takeaway

The older WMS/WES contexts have real linguistic boundaries, evidenced by the fleet's own homonym catalogue. The later additions drift toward capability or policy extraction. `task-interleaving` and `pick-face-replenishment` are the clearest thin contexts, and the storefront openly maps to a capability list. 36 is high but defensible for an educational exercise. Merging is a question for TI and possibly PFR plus slotting, not a systemic error.

### Cited Findings

- Evans defines a bounded context as a boundary "within which a particular model is defined and applicable", and says to "Explicitly set boundaries in terms of team organization, usage within specific parts of the application, and physical manifestations such as code bases and database schemas" — [DDD Reference p.2, glossary p.28](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf). So one repo and schema per context **conforms**.
- Evans: "breaking down the system into ever-smaller contexts eventually loses a valuable level of integration and coherency" — [DDD Reference p.5](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf). This is the book basis for the over-decomposition concern.
- `[MEMORY]` Khononov and Newman: a bounded context need not equal a microservice; a microservice is a deployment boundary and a context a model boundary. `[MEMORY]` Skelton & Pais: cognitive load per team is the limit. Here that is one author, and the fleet says it has no teams to organise (ddd-starter-modelling-process.md:136-138).
- **Evidence for real linguistic boundaries (conforming):** docs/strategic-design/ubiquitous-language.md:104-280 shows "Process path", "CPT", "Release", "Capacity", "ShiftPlan" and "Task/Work unit" meaning different things per context. FE explicitly treats WorkUnit as "an opaque correlation key" and does not model Order (contexts/fulfillment-execution/ubiquitous-language.md:97, :100).
- **Evidence for capability or microservice drift:**
  - Storefront: "The six contexts map 1:1 onto the composable-commerce capability lists" (storefront/docs/strategic-design/subdomain-classification.md Solution space intro). That states a capability split as the partitioning rule. Severity: debatable.
  - Fleet: repo = service = context, with no exception in 36. Edge rows on the map: 61 Kafka + 12 REST + 15 agent = 88 (context-map:357-417, :496-507, :519-533).

**Size proxy** (bytes of non-test Go, `git ls-tree -l origin/develop`; `internal/domain` KB / `internal` KB). Crude: size is not a verdict, by the page's own rule.

| Context | Domain/Internal KB | Ratio | ADR files |
| --- | --- | --- | --- |
| `inventory-storage` | 130/824 | 16% | 49 |
| `fulfillment-execution` | 118/704 | 17% | 60 |
| `warehouse-ops-agent` | 113/811 | 14% | 30 |
| `facility-layout` | 108/599 | 18% | 44 |
| `order-management` | 105/655 | 16% | 48 |
| `inbound-receiving` | 104/531 | 20% | 18 |
| `network-inventory-planning` | 101/483 | 21% | 21 |
| `wes-work-planning` | 90/637 | 14% | 47 |
| `warehouse-planning` | 82/548 | 15% | 19 |
| `returns-processing` | 66/445 | 15% | 10 |
| `product-master` | 60/346 | 17% | 14 |
| `slotting-optimization` | 49/448 | 11% | 15 |
| `exception-management` | 44/405 | 11% | 9 |
| `labor-performance` | 41/387 | 11% | 37 |
| `workforce-management` | 41/447 | 9% | 41 |
| `network-fulfillment` | 41/656 | 6% | 32 |
| `process-path-management` | 38/342 | 11% | 41 |
| `pick-face-replenishment` | 38/430 | 9% | 12 |
| `task-interleaving` | 32/404 | 8% | 11 |

Network contexts run 37-104 KB domain (`delivery-promise` 104, `vendor-connectivity` 97, `node-performance` 37). Storefront runs 33-52 KB.

**Thin-context candidates**

- **`task-interleaving`. Severity: debatable (too small).**
  - Smallest domain in the fleet: two aggregates (contexts/task-interleaving/aggregate-design-canvas.md:14-16).
  - Purpose: an advisory hint that FE "may use as a tie-break inside one priority band" (bounded-context-canvas.md:95-97).
  - Its pool sees only RELOCATE and REPLENISH tasks; PICK, PACK, SLAM and REBIN are not announced (context-map:401). So the context does not touch the picking flow that dominates travel.
  - Its consumer restates FE's types "byte-identical to its AsyncAPI" (task-interleaving `internal/adapters/inbound/kafka/fulfillment_consumer.go:16`, :27).
  - New language exists (Hint, Detour, Inert site, Travel model), but Task and Station are FE's. Not anaemic tactically: it has invariants and a tested policy.
  - It reads as a policy module of FE extracted for independence. Defensible as a study of advisory contexts; not defensible on language grounds alone.
- **`pick-face-replenishment`. Severity: debatable.**
  - The glossary admits a pick face is "Not a new location type: it is a Forward-pick slot of slotting-optimization plus the bin level" (ubiquitous-language.md:84).
  - It never creates floor work and never writes the ledger; a request crosses five hops (context-map:400).
  - It holds its own request lifecycle and min/max invariant, so it is a real, small model.
  - `slotting-optimization` and PFR share vocabulary and a separately copied `packlevel` (`internal/domain/packlevel/packlevel.go`, different blobs, also in NIP). A combined "forward pick" context is a credible alternative.
- **Not thin in the problematic sense:** `product-master`, `inbound-receiving`, `returns-processing`, `exception-management`. Each has a distinct vocabulary, lifecycle and owner rationale.

**Contexts carrying two models** (own charts as evidence)

- **`order-management`:** intake and promise/routing, spanning (0.15, 0.12) to (0.62, 0.45) (contexts/order-management/core-domain-chart:30-32). Its chart says intake could be replaced by a bought OMS (subdomain-classification:101-103). That is a statement that two models live here. Severity: debatable; the strongest split candidate.
- **`fulfillment-execution`:** Task dispatch and lease versus Pack and SLAM, y 0.30 to 0.88 (chart:38-44). Disclosed "kept thin". Severity: debatable, defensible.
- **`inventory-storage`:** nine domain packages including `transfer`, `relocation`, `packaging`, y 0.14 to 0.90 (chart:32-38). Severity: debatable.
- **`warehouse-ops-agent`:** console BFF plus decision-support policy plus (new) act slices (chart points at core-domain-chart:74; canvas:176). Severity: debatable.

**`warehouse-ops-agent` is the wrong test for a bounded context. Severity: debatable.**

- Its caveat says "it owns no aggregate, so it is not a bounded context in the aggregate-and-invariant sense" (subdomain-classification:46; canvas:176).
- Evans' definition is about a model and its applicability, not aggregates. The agent has the third-largest `internal/domain` in the fleet (113 KB: `policy`, `approval`, `authority`).
- Storefront `product-discovery` is listed as a bounded context with "(read side only)" and no caveat (storefront subdomain-classification.md:43). Treat both the same way: both are contexts.

### Inferences

- Count alone is not an error. The educational aim, per-repo practice and a real language catalogue justify a large number. Costs to a real team would be high (88 edge rows; five-hop replenishment), and the map's own "Published types with no consumer" list (context-map:433-480) suggests speculative contract surface.
- A useful guard: new contexts since 2026-10-17 are justified on "replaceable policy" and "doesn't write X", not on language. Requiring a language argument in each ADR 0001 would make the boundary evidence comparable.

### Gaps

- No workshop or domain-expert evidence exists for any boundary, so "linguistic" can only be judged from documents and code. Language tests were sampled, not run per context pair.
- `[MEMORY]` claims above could not be checked against book text.

## Context map: patterns against book definitions, and reciprocity

### Takeaway

Reciprocity on direction is good: every sampled pair agrees on who talks to whom. Patterns are less reliable: 6 of 13 pairs disagree on the pattern, several disagreements are not recorded on the page's disagreement list, and the page has real internal status contradictions. Several patterns are used against their definitions (Conformist+ACL, C/S with no influence, Separate Ways, upstream of a receiver-defined command). The absence of a Shared Kernel in code is verified, but some semantics are shared by copy. The network page is generated from the model, yet 13 of 48 rows print a literal `?`.

### Cited Findings

**Book definitions used (Reference pp.28-37)**

- upstream: "may succeed independently of the fate of the downstream"; mutually dependent is the separate category.
- Customer/Supplier: "downstream priorities factor into upstream planning".
- Conformist: "upstream has no motivation to provide for the downstream"; "slavishly adhering"; "Eliminate the complexity of translation".
- ACL: "in terms of your own domain model... translates"; simple translators with "cooperative teams" are distinguished from the "defensive" layer.
- OHS: "This places the provider of the service in the upstream position. Each client is downstream, and typically some of them will be conformist and some will build anticorruption layers"; motivated "When a subsystem has to be integrated with many others".
- Separate Ways: "Declare a bounded context to have no connection to the others at all".
- Shared Kernel: "explicit boundary... Keep this kernel small... shouldn't be changed without consultation".

All from the [DDD Reference](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf).

**Reciprocity sample** (context-map source files are `docs/contexts/<ctx>/context-map.md`)

| Pair | A's page | B's page | Result |
| --- | --- | --- | --- |
| OM ↔ INV reservations | OM:117 OHS+PL / C/S+ACL | INV:111 same | **Consistent, conforms** |
| OM ↔ NF | OM:125 OHS, C/S | NF:74 C/S, NF is Customer | **Consistent, conforms** (OM ADR 0020 changed the Supplier for it) |
| FE → LP | FE:105 OHS+PL/CF | LP:74 same, "Customer/Supplier with no influence" | Consistent, but self-contradictory wording (below) |
| FL → INV | FL:89 CF+ACL | INV:107 CF | Minor difference, recorded at context-map:360 |
| WP → FE | WP:86 C/S, OHS+PL | FE:103 C/S, PL/ACL | **Consistent** |
| FE → WP | FE:104 CF | WP:87 ACL | Disagree, known (context-map:650) |
| OM → WP | OM:119 Conformist | WP:80 ACL | Disagree, known (context-map:650) |
| NIP → INV command | NIP:52 C/S | INV:116 OHS+PL/CF | **Disagree, not on the list** |
| IR → INV | IR:61 OHS+PL | INV:55 CF | Consistent (context-map:380) |
| SLOT → WP | SLOT:56 Conformist | WP:82 ACL | **Disagree, not on the list** |
| PFR → WP | PFR:56 Conformist | WP:83 ACL | **Disagree, not on the list** |
| TI → FE | TI:46 Conformist | FE:112 ACL | **Disagree, not on the list**; TI also says "no consumer" (stale, FE ADR 0051 built it) |
| WPL ↔ PPM | WPL:82 Separate Ways | PPM: no mention | Consistent with silence |

**Pattern findings**

- **`error`: K33 and K35 invert the page's own upstream rule.**
  - The page says arrows run upstream to downstream "the direction the model flows... not always the direction of the network call", with OM downstream of INV even though OM calls `POST /reservations` (context-map:128-131).
  - But K33 has NIP upstream of INV while "the command carries exactly the five fields inventory-storage's consumer defines" (context-map:389). K35 is the same, "mirrors WES's consumed contract" (:391).
  - NIP admits "the receiver defines the command contract" (contexts/network-inventory-planning/context-map.md:60-61). INV's page calls itself Conformist to it (contexts/inventory-storage/context-map.md:57, :116), which cannot be: the receiver defines the shape.
  - By Evans these are NIP downstream of INV and WP over a queue-transported command. WP's page has no NIP row at all, though K35 cites it (grep of contexts/wes-work-planning/context-map.md).
- **`error`: Conformist + ACL used as one pattern.**
  - K17 (context-map:373), R10 (:505), R12 (:507), K4 (:360, FL:89), and network-fulfillment (:738-741; network context-map:240).
  - Evans defines Conformist as eliminating translation and ACL as doing it. OHS's text treats them as alternatives.
  - For NF the real pattern is ACL: "talks to the other system through its existing interface" already includes having no influence.
  - `CF` on the outer API and `ACL` inward is a fair *description*, but not a combination the books define.
- **`debatable`: "ACL" often means a DTO mapping in the adapter.**
  - WP's stated basis: "unexported structs... hold the foreign shape" (context-map:651). That shows decoupled code; it is not by itself translation into a different model.
  - Where a named own model exists (`slotPlanApprovedData` → `relocation.Plan`, WP:82) it conforms. Where a consumer restates "byte-identical" fields (TI fulfillment_consumer:16, :33-52), Conformist is honest.
  - This explains the recurring disagreement: the two sides use different tests. Evans' own distinction (simple translator with cooperative teams versus defensive layer) would resolve most rows.
  - A single page-level criterion would help; only the *status* disagreements are resolved against code (context-map:623-626), and pattern rows are labelled "judgement" (:647).
- **`error` (wording): "Customer/Supplier with no influence"** (K15, context-map:371; LP:74) contradicts C/S ("downstream priorities factor into upstream planning"). It is simply Conformist. Severity is low in effect.
- **`debatable`: Separate Ways used for "no edge".**
  - context-map:552-619 lists pairs with no relationship, including PPM (:568), which is upstream on K8-K10; FE/WFM "at the task level" with live R9 (:560-563); and FL, upstream of many edges (:564).
  - "`inbound-receiving`... ↔ every other context" (:590) and the two similar bullets (:597, :610) are absence, not a decision to cut loose.
  - True Separate Ways, correctly reasoned: WPL ↔ PPM with a deliberately separate `ProcessPath` (:574-577), and INV ↔ WFM (:552).
  - Network pages do the same (contexts/delivery-promise/context-map.md:96-97).
- **`debatable`: Upstream/downstream per message rather than per relationship.**
  - WP↔FE "roles reversed" (WP:87); live two-way pairs on the fleet map: FE↔WP, OM↔WP, OM↔WPL, INV↔NIP, FE↔TI.
  - Network: 12 two-way pairs of 47 directed edges, including DP↔OS ("The two Core contexts form a loop", contexts/order-sourcing/context-map.md:95).
  - Evans's relationship is about influence and has a separate name for two-way need ("mutually dependent"; "something we would generally try to avoid", p.28). Whether FE↔WP is Partnership was already settled (context-map:709-711), so that row is not re-opened.
  - The general practice still deserves a note in the legend: arrows are message-level, not Evans-level.
- **`debatable`: All team-relationship patterns describe teams that do not exist in the fleet.** The fleet says no real teams exist (ddd-starter-modelling-process.md:136-138) yet labels C/S throughout. Fine for study, but say so on the map. The network section does assign teams (network ddd-starter-modelling-process.md:90-96). Its table omits `seller-inbound` (cosmetic), and its "Storefront" team name now collides with the digital storefront section (cosmetic).
- **`cosmetic`:**
  - K20 "PL / local copy" (context-map:376) versus K50 for the same event "OHS + PL / CF" (:406).
  - K19 "OHS" with zero consumers of the order types (:375), against OHS's "many others" motive.
  - Storefront "C/S + CF + OHS + ops-only" (storefront context-map:116), where `ops-only` is not a pattern.

**Shared Kernel claim**

- **Conforms in code, verified.** No `go.mod` of the 36 service repos on `origin/develop` requires a sibling `github.com/claudioed/*` or `IQVO/*` module, matching context-map:99-101 and each per-context claim.
- **`debatable`: Semantics are shared by copy without Evans' discipline.**
  - `pathcatalog` exists in WP, FE and WFM; WP's says it "mirrors fulfillment-execution's own pathcatalog package byte-for-byte in its matching semantics... they must agree" (wes-work-planning `internal/domain/pathcatalog/path_definition.go:10-12`). The files are not identical: 98 and 66 differing lines.
  - The UL lists Match prefix as shared (ubiquitous-language.md:61). The work-unit id is "derived the same way by order-management and wes-work-planning and never transmitted" (:63). `LocationRole`/`SiteId` are "kept in sync by convention" (context-map:567).
  - This is a Shared Kernel in substance with no explicit boundary. It is a defensible price for module isolation, but "no Shared Kernel" should read "no shared code".
- **`error`: an opaque key is parsed.**
  - FE defines OrderRef as "an opaque correlation key, nothing more" (contexts/fulfillment-execution/ubiquitous-language.md:97), and the fleet praises `demandRef` opacity as "the anti-corruption boundary" (ubiquitous-language.md:146).
  - Yet K52 reverses it into "(order, line)" (context-map:408), and K58 matches `{order_id}-line-{line_no}` (context-map:414). Downstream contexts depend on a format owned two hops away.

**Internal status contradictions in `docs/strategic-design/context-map.md` (`error`)**

- K10, K13, R5 are **live** (:366, :369, :500), but the resolution table says **wired-but-unused**, "The reference deployment does not set it" (:630-632), and :721 says none is enabled.
- K58 is **live** (:414), but :441-443 says wired-but-unused and neither service deployed. K53 and K54 are **live** (:409-410), but :472-476 says "built-but-not-deployed, so nothing reads the topic today".
- K37 says REPLENISH work is "off in the reference deployment" (:393), but K44 is **live** (:400).
- A14 is "live in code" (:532), but :640 says "A14 stays absent-planned".
- :67-68 says `returns-processing` has "no context map page yet" and the source list at :79-95 omits both new contexts, yet both `context-map.md` pages are synced.
- Deployment story, three versions:
  - subdomain-classification:60-65: returns and exception "not registered in `warehouse-infra`"
  - context-map:58-59: "registered... since 2026-10-22"
  - CLAUDE.md:7-9: "none of the four is deployed"

  `warehouse-infra` `origin/develop` `terraform/apps.yaml` lists all four (lines 87, 212, 259, 311). It also lists the storefront services (47, 222, 278, 297), against CLAUDE.md's "no warehouse-infra `terraform/apps.yaml` entry" and src/pages/index.tsx:99 "not deployed yet". I did not inspect a running cluster, so "registered" is what is verified, not "running".

**Missing edges (`error`)**

- context-map:511-513 says of the agent "every edge is a read. Its zero-write rule is enforced in CI"; :430 and :619 say the agent has no client for returns or exception-management.
- On `develop`:
  - Agent ADR 0027 and ADR 0029 add `POST /act/...` flows delegating `release_next_work` to WP and `assign_labor` to WFM over A2A.
  - Agent CLAUDE.md states "WRITE CAPABILITY = the two act slices ONLY".
  - ADR 0028 adds advisory A2A reads from exception-management.
  - `warehouse-infra` `helm-values/warehouse-ops-agent.yaml:21`, :25 sets the URLs.
  - `helm-values/fulfillment-execution.yaml:99` sets `WORK_PLANNING_A2A_URL`.
  - `wes-work-planning`, `workforce-management` and `exception-management` each ship `cmd/a2a`.
- `A2A` appears 0 times in context-map.md, subdomain-classification.md and domain-message-flows.md. The page was last changed 2026-10-27, before these ADRs.
- The synced agent pages are also stale (bounded-context-canvas.md:169; index.md:36); the agent's own `docs/docs/ddd/context-map.md` has no act-slice row, so the fix is upstream first.
- Whether these A2A pairs are the same model relationship as the Kafka and REST ones needs a pattern decision.

**Network map versus model**

- **Conforms by construction:** the page is generated (network/docs/strategic-design/context-map.md:3-5) and sampled per-context pages agree with it and each other: DP↔CO (contexts/customer-ordering/context-map.md:67-68; delivery-promise:89-90), NT↔VC (node-topology:87-88; vendor-connectivity:88-89), VC↔OS (vendor-connectivity:86-87; order-sourcing:96-97), DP↔OS (delivery-promise:91-92; order-sourcing:94-95).
- **`error`: 13 of 48 table rows carry a literal `?` pattern** (for example network/docs/strategic-design/context-map.md:196, :199-202, :204, :216, :223-224, :229-232).
  - Source: `rel_of` returns `"?"` in network/scripts/gen_pages.py:47-51 when a `publishes[].consumers` entry has no matching `inbound[].message`.
  - I found 20 such event/consumer pairs in `network/model/model.yaml` (for example `NodeOperationalProfileDeclared`→vendor-connectivity; `DeliveryWaveCancelled`→delivery-promise and order-sourcing; `PackageLost` and `PackageReturned`→delivery-promise and customer-ordering; `LabelVoided`, `BookingMoved`, `BookingFailed`).
  - The legend has no `?`, and the gates pass.
- **A recorded decision not carried through:** `NodeOperationalProfileDeclared` is G4 (Built), `DeliveryWaveCancelled` is G5, `PackageLost`/`PackageReturned` are G6 (model-gap-register). Their resolutions reached `publishes[].consumers` but not `inbound`. The per-context rows also omit `NodeOperationalProfileDeclared` (node-topology:87; vendor-connectivity:88).
- **`cosmetic`: register wording.** "How a gap gets closed" ends "Delete the row here" (model-gap-register.md, last section), while Closed rows are retained and counted (:26-29). `model.yaml` decision RN-0001's title still says "ten bounded contexts" while the model has eleven.

**Conforming areas**

- CloudEvents plus AsyncAPI is a real Published Language ("well-documented shared language", Reference p.36).
- Status categories separate intended from wired, and edges cite code and config.
- Disagreement section exists (:621-657). The Hard Boundary with the retail network, a single seam via NF (:734-741; network/docs/strategic-design/context-map.md:22-58), is textbook.
- The `CheckoutCompleted`/`POST /checkout` ACL in storefront is coherent.

**Audit decisions: carried through or not**

- **Carried through, checked:** H6, H7, H13, H19, H23 shown resolved and struck through (eventstorming-big-picture.md:893-894, :900, :906, :910); H1, H11, H12 kept (:888, :898-899); K37 implements confirm-pick.
- **`debatable`, not fully carried:** principle "Master data is published as an event instead of polled over REST" (audit-decisions:24-27). R8 went **live** on REST `GET /locations/{locationCode}` for station registration (context-map:503) and R7 `GET /distance` is live (:502). Both are low-frequency with fail-open behaviour, so it is minor, but neither row cites the exception.
- **`cosmetic`:** audit row "inventory-storage: `ProductClassified` is published" (audit-decisions:44) was later superseded (product-master took over; K21 retired, context-map:377) with no supersession marker on the audit page.
- **Network register:** known open items were not re-checked. G63 status Open is honest, though `customer-payments` is already built and network classification:39 still says Payments & Invoicing is "Charging customers" (the storefront half is de facto decided).

### Inferences

- Per-message patterning comes naturally from hexagonal, event-carried integration: each adapter gets a label. It describes wiring well and model influence less well. A one-page "how to pick a pattern" with Evans' text would remove the CF+ACL and C/S-no-influence cases and most disagreements.
- Rolling an edge table forward by hand across 19 services created the status contradictions. Corrections were applied to rows but not to the prose lists around them. Generating this page as the network does would remove that class of error; the network's `?` shows generation alone is not enough unless the gate fails on `?`.

### Gaps

- Team-level reality cannot be assessed for patterns defined by teams.
- `[MEMORY]` Whether OHS over an event topic is mainstream usage: Khononov and Vernon both discuss published events as OHS-like, but I could not confirm the text. I treated it as acceptable.
- Not all 61 K edges were checked for reciprocity; 13 pairs were sampled. I also did not read each ACL's code; only TI's consumer, and WP's mapping as cited on its own page.

## Ubiquitous language: conflicting meanings without a declared boundary

### Takeaway

The design conforms: per-context glossaries, an explicit "Same word, different model" section, and a network-to-fleet translation table are exactly Evans' scoping. Real defects are one true homonym inside a single Published Language (`order_ref`), the absence of the two newest contexts from fleet language pages, and a few undeclared collisions (`network`, `Capability`).

### Cited Findings

- Evans: "Within a bounded context, use the same language..."; "Model expressions, like any other phrase, only have meaning in context" — [DDD Reference pp.2, 4](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf). So a term meaning different things across contexts is fine if declared.
- **`error`: `order_ref` has two meanings on one topic.**
  - `TaskCompleted.order_ref` = the order (example `order-8a1f`), "Distinct from work_unit_id" (fulfillment-execution `apis/asyncapi.yaml:250-254`, :327).
  - `TaskCPTMissed.order_ref` and `PackageManifested.order_ref` = a work unit id (example `wu-8a1f`), described only as "The task's order reference" and "The package's order reference" (:425-427, :458, :740-742, :759).
  - FE's glossary admits the split (contexts/fulfillment-execution/ubiquitous-language.md:62). The fleet page says it is a WorkUnit id and lists only the two work-unit cases (ubiquitous-language.md:145), and K52 and K58 depend on it.
  - This homonym was introduced by audit decision FE ADR 0040 (audit-decisions:48, :74-76), which is otherwise sound.
  - Published Language must be "well-documented" (Reference p.36), and here the schema field descriptions do not disambiguate.
- **`error`: fleet language pages omit the two newest contexts.** `returns-processing` and `exception-management` have 0 mentions in docs/strategic-design/ubiquitous-language.md and docs/glossary.md. The index covers 17 contexts (ubiquitous-language.md:32-48) and glossary:12 says "seventeen". Their RMA, disposition, case and SLA terms are in their own synced pages only, and this page's stated scope is all contexts. The word "exception" is also a collision candidate: agent `FlowBalanceException`/exception correlation (glossary:51) versus `ExceptionCase`.
- **`debatable`: `network` is an undeclared fleet homonym.** `network-fulfillment` means the *external* retail network (ubiquitous-language.md:147; domain-vision:56). `network-inventory-planning` means the fleet's *own* set of warehouses (domain-vision:59). No "Network" entry exists under "Same word, different model" (headings at :112-269). The same word also names a whole site section at `/network/`.
- **`debatable`: `Capability` is under "Shared terms" but means several things.** UL:16-17 says shared terms mean "the same thing wherever they appear", and :62 defines it as a named qualification. Yet `SiteCapability` (NIP, :44; K30 `SiteCapabilityChanged`), `CapabilityOffer` (NF; glossary:34) and "fulfillment-capability contract" (core-domain-chart:171) mean what a site can do or offer.
- **`cosmetic`: `shipment group`** is used in the fleet's Promise definition (glossary:93) and has no fleet definition; the network and storefront define it (network UL "Shipment Group").

**Candidate terms**

| Term | Result |
| --- | --- |
| order | **Conforms.** OM Order, NetworkOrder, Customer Order, Purchase Order are distinguished (glossary:72, :77; network UL :33; translation table network UL:139+ maps PO to NetworkOrder). |
| task / work unit | **Conforms.** Declared (UL:240). |
| reservation / allocation | **Conforms** inside the fleet (UL:175-189). Storefront **Allocation** (share of an authorization) has "-" in "Not to be confused with" though it collides across domains (storefront UL table). Cosmetic. |
| promise | **Conforms.** Fleet ship promise versus network delivery promise, explicitly reconciled (network subdomain-classification:70-79; glossary:93; network UL translation "Promise | (none)"). |
| node / site | **Conforms.** Translation table: `vendorNodeCode` to `siteCode`; `fleet_site_role_mapping` in the model. |
| inventory / stock | **Conforms.** Usable inventory (UL:64) versus Available Quantity/Basis (network UL:24-25), with mapping in the translation table. |
| wave | **Cosmetic.** Fleet "waveless" (UL:102, :172) versus network Delivery Wave (network UL:41): a last-mile dispatch slot unrelated to warehouse waves. No note on either side. A reader moving across domains will misread. |
| station | **Cosmetic.** Fleet Station = a work position (glossary:111). Network delivery station = a building (network UL:63, :69). Not in the translation table (network UL:139+). |
| lane | **Cosmetic.** FE SortLane (glossary:108) versus network Lane (network UL:61). |
| shipment | **Cosmetic.** Shipment Group, Inbound Shipment, `VendorShipmentConfirmed`, "Shipment confirmation" (UL:41) are distinct and scoped, but with no cross-domain note. |
| discrepancy | **Conforms, partly.** Declared (UL:205-212). `WeightDiscrepancyDetected` and INV's `DiscrepancyDetected` (K55, K59) are events the section does not mention (it describes cycle-count variances without naming the event). Cosmetic. |
| hold / release | **Conforms** inside the fleet (UL:167-173, :269); storefront Release (customer-payments) and Capacity Hold are scoped by the context column. |

- **Conforming:** network UL's translation table (network/docs/strategic-design/ubiquitous-language.md:139+) is a real boundary artifact: "The translation happens in exactly one place". Storefront's "Not to be confused with" column and "Network terms the storefront relies on" (explicit conformity) are excellent. UL:281 explains why no global glossary is the source of truth.

### Inferences

- Cross-domain collisions are not model defects since each term is scoped. They are a documentation hazard for the one site that presents all three domains. Adding `Wave`, `Station`, `Lane`, `Allocation` and `Network` to one cross-domain note would close them cheaply.

### Gaps

- I did not diff each of the 36 per-context glossaries against code, or against the fleet page, beyond the sampled terms.
- Term meanings were compared at page level; industry-correct meaning is another researcher's scope.

## Process artifacts: technique or documents wearing the label?

### Takeaway

Bounded Context Canvases and the Starter Process index are faithful. Big Picture EventStorming is a reverse-engineered event catalogue in EventStorming notation: the fleet says so, the network does not. Core Domain Charts are one-person judgements with a misattributed layout, and two of them are not charts. For a study project this is acceptable if labelled.

### Cited Findings

- **`debatable`: Big Picture EventStorming (fleet).**
  - The technique: "10-30+ people", individuals place events, group enforces the timeline; hotspots "visualise and capture hot conflicts"; big-picture stickies are events, hotspots, opportunities, actors, systems, value, pivotal events and *emerging* bounded contexts; policies, commands and query models are process level ([cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)). `[MEMORY]` Brandolini frames its value as surfacing unknowns and disagreement across silos.
  - The page: "reconstructed from the code-grounded artifacts... not from a workshop" (eventstorming-big-picture.md:14-15), an honest disclosure. But also "Every hotspot is a gap that is already documented" and "Nothing on this page is a guess" (:21-24), the inverse of the technique's purpose.
  - Hotspot = "A documented gap" (:68). Stickies include commands, policies and read models (:59-68), which is process level. Swimlanes are pre-existing contexts (:74), not emerging ones. No opportunities or value stickies.
  - Verdict: useful as-built timeline; the name oversells. Suggest "As-built event timeline in EventStorming notation".
  - The H-table with sources is genuinely good (:878+).
- **`debatable`: network EventStorming lacks the disclaimer and tells a story.** "The domain was walked... Pivotal events emerged" (network/docs/strategic-design/ddd-starter-modelling-process.md:43-46), with no participants named, while the board says "Every event is one of the model's published events" (network/docs/strategic-design/eventstorming-big-picture.md:12-14) and uses yellow Aggregate stickies (:15), which the cheat sheet calls a legacy term replaced by Constraints. The storefront has no EventStorming, Vision, Chart or Starter page at section level (directory listing), which is honest but asymmetric.
- **Core Domain Chart.**
  - ddd-crew: "The true power of this technique is the conversations that it triggers, especially cross-discipline" ([README](https://github.com/ddd-crew/core-domain-charts)). There is no such conversation in this project, and the page copies coordinates to two decimals. Disclosed as judgement (:50-52).
  - `error`: axes and quadrants misattributed (see first section).
  - `error`: `returns-processing` and `exception-management` `core-domain-chart.md` are classification flowcharts with no differentiation or complexity axes (returns-processing/core-domain-chart.md:20-39; no coordinates in either), wearing the label.
- **Bounded Context Canvas: conforms.**
  - All sections in [ddd-crew's canvas](https://github.com/ddd-crew/bounded-context-canvas) are present: Assumptions, Verification Metrics and Open Questions in 19 of 19 fleet canvases, plus Domain/Business model/Evolution rows using Wardley stages.
  - The strongest artifact.
  - `debatable`: Verification Metrics are mostly test or operational measures (mutation gate, coverage: contexts/task-interleaving/bounded-context-canvas.md:165-176; counters: contexts/wes-work-planning/bounded-context-canvas.md:266-274), whereas the canvas asks for measures that show *whether the boundaries fit the domain*.
  - Stale Open Questions: TI asks when FE will consume hints (:178-183), and FE already does per ADR 0051; agent's "What would an act slice's authorization gate be" (:318) is decided by its ADR 0027. Both are synced, so fix upstream.
- **DDD Starter Modelling Process: conforms, and honest.**
  - "This page uses the eight steps to index the site" (ddd-starter-modelling-process.md:15-19); states the steps are not linear ([ddd-crew](https://github.com/ddd-crew/ddd-starter-modelling-process): "not a linear sequence"); Organise is explicitly "none" (:136-138).
  - The steps and tools named match ddd-crew.
  - Stale: "seventeen", "thirteen", classification table (see first section).
  - `debatable`: it is a retrospective mapping; code in many repos preceded the artifacts. It is presented as an index, so not misleading.
  - Network's "the order this model was built in, with the loop-backs that actually happened" is a stronger, unverifiable claim.
- **Domain Message Flows** was not reviewed in depth; A2A is absent (0 hits). Its notation is out of the assigned question scope.

### Inferences

- Honest labelling is the cheapest fix, and the fleet page already shows how. As a study artifact, generating the board from specs is a good way to learn notation, but it cannot exercise the technique's main benefit: discovering what you don't know.

### Gaps

- `[MEMORY]` Brandolini's own book text was not readable; the cheat sheet stands in for it. The ddd-crew pages are secondary to Brandolini and Tune.
- Tune's "Core Domain Patterns" article could not be read (HTTP 403), and a web search did not return its taxonomy, so "Decisive" and "Short-term" definitions remain unverified.
- Per-context EventStorming pages were not all sampled.
