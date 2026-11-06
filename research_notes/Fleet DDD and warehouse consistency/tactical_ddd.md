# Tactical DDD in the warehouse-systems service code: applied or only claimed?

Provenance, read this first.

- **Code ref.** All code evidence is from `origin/develop`, exported read-only with `git archive` to a scratch directory. Citation form is `repo:path:line`. No repo was edited and no branch was switched. Refs: inventory-storage `964b3bd`, wes-work-planning `f29f062`, fulfillment-execution `7816d25`, task-interleaving `cf8f0e5`, pick-face-replenishment `3ecb696`, facility-layout `7f96512`, order-sourcing `9fb1599`, network-inventory-planning `f8ace86`, network-fulfillment `3044a1f`, order-management `90a1ed6`, product-master `c298ee4`. Mechanical scans also covered workforce-management `7d9e637`, labor-performance `a398b23`, process-path-management `f7bb35e`, returns-processing `a7d363f`, exception-management `3ec0818`, inbound-receiving `3c5d554`, slotting-optimization `225fc76`, warehouse-planning `86248bb`, delivery-promise `ee39624`, checkout `1332afc`, shopping-cart `8de6c72`.
- **Depth of reading.** "Read" means I read the source. "Scanned" means a grep or AST script, so it can miss things and can raise false alarms. Scripted counts are approximate unless stated otherwise.
- **Books.** The O'Reilly MCP tool returned **metadata only** (title, author, URL), never book text. Every statement below about what a book says is therefore **[from memory]**, unverified against the text. I give no chapter numbers or quotations. Catalogue entries confirmed: [Vernon, Implementing DDD](https://learning.oreilly.com/library/view/-/9780133039900/?orm_source=mcp); [Vernon, DDD Distilled](https://learning.oreilly.com/library/view/-/9780134434964/?orm_source=mcp); [Evans, DDD](https://learning.oreilly.com/library/view/-/0321125215/?orm_source=mcp); [Khononov, Learning DDD](https://learning.oreilly.com/library/view/-/9781098100124/?orm_source=mcp); [Richardson, Microservices Patterns](https://learning.oreilly.com/library/view/-/9781617294549/?orm_source=mcp); [Boyle, DDD with Golang](https://learning.oreilly.com/library/view/-/9781804613450/?orm_source=mcp) (the author is Matthew Boyle, not "Boyd" as in the brief); [Stopford, Designing Event-Driven Systems](https://learning.oreilly.com/library/view/-/9781492038252/?orm_source=mcp); [Hohpe & Woolf, EIP](https://learning.oreilly.com/library/view/-/0321200683/?orm_source=mcp); [Bellemare, Building Event-Driven Microservices](https://learning.oreilly.com/library/view/-/9781492057888/?orm_source=mcp). Vernon's "Effective Aggregate Design" essays did not appear as a catalogue hit; references to them are from memory.
- **Severity tags.** `[good]`, `[error]`, `[debatable]`, `[cosmetic]`.

## Overall verdict and sampling

### Takeaway
Tactical DDD is genuinely applied in code, not just claimed. Aggregates are encapsulated, they enforce their rules, layering is clean and is enforced by tests, and the docs name real code. The real weaknesses are five: (1) a "saga" with no compensation and an apparently unconnected origin reservation, (2) habitual multi-aggregate transactions in two older Core repos, (3) public setters on `WorkUnit`, (4) several canvas statements that have gone stale, (5) three coexisting template generations.

### Cited Findings
- `[good]` **Sample size.** Source read in 10 repos, in the areas named in each section. AST or grep scans ran over 22 repos. About 13 aggregate roots were measured field by field, and 8 aggregates had their invariants compared to their canvas by reading code. The 22 repos hold 73 to 171 non-test Go files each under `internal/`, so the reading is a sample, not a full audit.
- `[good]` **Domain purity is complete in this scan.** A grep over `internal/domain` non-test code in 22 repos found 0 imports of `database/sql`, `net/http`, pgx, Kafka clients, OpenTelemetry, `encoding/json`, `log/slog`, the CloudEvents SDK, or the repo's own application/adapter packages. A second grep found 0 imports from `internal/application` to adapters, `net/http`, `database/sql` or pgx.
- `[good]` **The layering is a tested rule, not a convention.** `inventory-storage:internal/architecture/architecture_test.go:16` (`TestHexagonalArchitecture`) and `inventory-storage:internal/architecture/events_fitness_test.go:117` (`TestCloudEventsOnly`). All 22 scanned repos have an `internal/architecture` directory. Network-fulfillment's domain events carry no serialisation tags, guarded by a sensor: `network-fulfillment:internal/domain/shared/events.go:8-16`.
- `[good]` **Domain versus application size (LOC, non-test).** inventory-storage 3562/5458, wes-work-planning 2566/3068, fulfillment-execution 3149/2529, task-interleaving 1100/1507, pick-face-replenishment 1256/2213, facility-layout 2996/2381, order-sourcing 1888/1409, network-inventory-planning 2785/2049, network-fulfillment 1037/3424, order-management 2753/2753. Domain test files: 5 to 27 per repo. This is a size signal only, not proof of quality.

### Inferences
- The fleet is closer to the book than most production Go services I would expect. The discipline comes from fitness tests and the harness template, not only from authors' habits.
- Findings below rarely generalize across all repos. Most are per-repo or per-generation. Each one says how many instances were examined.

### Gaps
- Not every context was read. labor-performance, process-path-management and workforce-management were only scanned. The storefront and network repos other than order-sourcing, delivery-promise, checkout and shopping-cart were not covered.

## Aggregates: invariants, boundaries, identity references, docs versus code

### Takeaway
Aggregates are behaviour-rich, not anaemic, and references are by identity. "One aggregate per transaction" is routinely not followed in inventory-storage and wes-work-planning. That is a defensible choice but it is understated in the docs. Canvas names and invariants are real; a few statements are stale.

### Cited Findings
- `[good]` **Encapsulation scan.** At least 35 domain struct types with 3 or more fields have zero exported fields, including `stock.StockUnit`, `reservation.Reservation`, `workunit.WorkUnit`, `release.WorkPool`, `task.Task`, `pack.Package`, `site.Site`, `slot.LocationSlot`, `stationtrip.StationTrip`, `replenishment.Request`, `transfer.InterWarehouseTransfer`, `assignment.Assignment`, `networkorder.NetworkOrder`, `order.Order`. Types with exported fields are events, snapshots, specs and read models.
- `[good]` **Behaviour on the root, read in code.** `inventory-storage:internal/domain/stock/stock_unit.go:204-214` (`Reserve`), `:289-306` (`Pick`), `:314-330` (`RelocateOut`); `fulfillment-execution:internal/domain/task/task_lifecycle.go:51-68` (`Claim`: completed check, lazy lease expiry, double-claim check, capability check); `network-inventory-planning:internal/domain/transfer/saga.go:275-285` ("The only writer of t.state and t.audit"), `:289-325` (reply validation, including totals); `pick-face-replenishment:internal/domain/replenishment/request.go:93-115` (`Complete`).
- **Canvas versus code.** Mechanical check of 10 canvases against `develop` code: all `Err*` names cited are defined (207 of 207), all `Test*` names cited exist as test functions (75 of 75), and `Type.Method` references resolve 53 of 56. Of the 3 misses, two I checked are my regex failing on unnamed receivers (`wes-work-planning:internal/domain/release/release_policy.go:15`, `order-management:internal/domain/order/path_selection.go:96`). The third, `EventSink.PublishPolicyDeclared` in task-interleaving, I assume is an interface method and did not confirm. A name existing does not prove the rule is enforced as written; that is what the next item covers.
- **Eight aggregates read against their canvas.**
  - `[good]` fulfillment-execution `Task`: T2, T3, T4 confirmed in `task_lifecycle.go:51-68`; T5 and T6 partly (`RenewLease` at `:71-79`). T1's `SaveClaim` exists on the port (`fulfillment-execution:internal/application/ports/ports.go:32`).
  - `[good]` facility-layout `Site`: decommission one-way at `facility-layout:internal/domain/site/site.go:218-224`. The canvas honestly places code uniqueness in the use case ("an aggregate cannot see its siblings").
  - `[good]` pick-face-replenishment `Request`: invariant 4 at `request.go:93-115`. `Policy` is declared a value object in the canvas and is one in code (`policy.go:119-121` returns a new value), though the canvas omits `Source`, `Stale`, `NewPackDerived` and `Rederive` (`policy.go:58-67, 90-92, 133`). `[cosmetic]`
  - `[good]` task-interleaving `StationTrip`: the 13 named tests exist; the code itself was only scanned.
  - `[good]` order-sourcing `FulfillmentAssignment` (type `Assignment`): all 6 cited errors defined; `ErrNodeExcluded` and `ErrCancelAfterLock` seen in use at `assignment.go:158`, `commands_lifecycle.go:117`.
  - `[good]` with `[error]` network-inventory-planning `InterWarehouseTransfer`: transitions match. But the canvas says a mismatched reply "returns a plain error and is therefore retried like a transient one (a gap)" (`docs/contexts/network-inventory-planning/aggregate-design-canvas.md:93-95`, same text at `network-inventory-planning:docs/docs/ddd/aggregate-design-canvas.md:88-90`). Code dead-letters it: `network-inventory-planning:internal/adapters/inbound/kafka/transfer_reply_consumer.go:148-155, 385-388`, and the repo's own `docs/docs/operations/troubleshooting.md:35` agrees with the code. The canvas predates ADR 0013.
  - `[error]` inventory-storage `StockUnit`: the canvas says `binID` "never changes after creation" (`docs/contexts/inventory-storage/aggregate-design-canvas.md:57`, source `inventory-storage:docs/docs/ddd/aggregate-design-canvas.md:52`). `StockUnit.MoveTo` assigns `u.binID = binID` (`inventory-storage:internal/domain/stock/stock_unit.go:260-270`, ADR 0045 sealed-case re-stow). Guarded against reserved stock, so allocations stay valid, but the statement is false.
  - `[error]` inventory-storage `Reservation`: R3, R4, R5 confirmed at `reservation.go:171-200, 93`. But the constructor's doc comment says "Allocations must sum to quantity" and nothing checks it (`inventory-storage:internal/domain/reservation/reservation.go:78-108`), nor does it check positive quantity or non-empty `demandRef`. The canvas's R1 and R7 are honestly attributed to the use case and HTTP handler, yet demand-ref emptiness is therefore not protected for non-HTTP callers. Contrast `network-inventory-planning:.../saga.go:305-320`, which does check allocation totals against quantity.
- `[error]` **Canvas count of aggregates.** The inventory-storage canvas claims "one canvas per aggregate root found in `internal/domain/`. There are **six**" (`aggregate-design-canvas.md:18-19`). `internal/domain/transfer` holds three more encapsulated types with their own repositories: `Receipt` (12 fields, 17 methods, `inventory-storage:internal/domain/transfer/receipt.go:60`, `TransferReceiptRepo` at `application/ports/ports.go:227`), `Allocation` (`allocation.go:50`, "not a second stock-holding aggregate") and `Exception` (`exception.go:47`). A grep of the canvas and class diagram found neither `TransferReceipt`, `transfer.Receipt` nor `InventoryException`. Code comments deny they hold stock, not that they are aggregates.
- `[good]` **Identity references.** A scan of cross-package domain imports found no aggregate-to-aggregate field references in the sample. inventory-storage holds `Allocation{StockUnitID, BinID}` values (`reservation.go:49-53`). wes-work-planning's canvas says the pool holds "entry records keyed by work unit id, not `WorkUnit` objects" (`docs/contexts/wes-work-planning/aggregate-design-canvas.md:425-427`). Sibling imports exist but are for pure policies, e.g. `detection->replenishment`, `sourcing->assignment`, `recommend->policy`. Imports such as `relocation->stock` and `relocation->location` in inventory-storage were not read to confirm how they are used.
- `[debatable]` **One aggregate per transaction.** Vernon's rule [from memory]: modify one aggregate instance per transaction, with eventual consistency outside the boundary, and with stated exceptions. Scan of use-case files writing to 2+ repositories in one file:
  - inventory-storage **9 of 33**: `confirm_pick.go` (Locations, Reservations, Stock), `reserve_stock.go`, `stow_stock.go`, `stow_container.go`, `stow_transfer_stock.go`, `break_case.go`, `relocate_stock.go`, `allocate_transfer_stock.go`, `stage_transfer_receipt.go`. Read: `inventory-storage:internal/application/usecases/confirm_pick.go:57-69, 75-110` also touches containers; `reserve_stock.go:121-135` saves N stock units plus the reservation.
  - wes-work-planning **6 of 31**: `release_next_work.go:96-104` (pool and work unit), `enqueue_work_unit.go`, `record_completion.go`, `apply_replenishment_requested.go`, `apply_replenishment_cancelled.go`, `apply_slot_plan_approved.go` (plans, pools, workUnits).
  - pick-face-replenishment 1, facility-layout 1 (bulk import), network-inventory-planning 1 (catalogue). fulfillment-execution, task-interleaving, order-sourcing, network-fulfillment, order-management 0. The regex does not see writes in helpers in another file or under other method names, so zero means "none detected".
  - The justification is real: same process, same database, and stock-ledger rules that a warehouse would want strongly consistent, with optimistic versions on every save (ADR 0019).
- `[error]` **Understatement in docs.** The inventory canvas calls this "the one place this context deliberately trades 'one aggregate per transaction'" (`docs/contexts/inventory-storage/aggregate-design-canvas.md:29-31`). It is the norm for write paths in that repo, not one place, and the same canvas's list omits reserve and transfer allocation. Among the 10 canvases checked, only this one names the rule; wes-work-planning states the fact without naming the trade-off (`:425-427`).
- `[error]` **`WorkUnit` public setters.** 12 unguarded `Set*` methods: `wes-work-planning:internal/domain/workunit/work_unit.go:113, 128, 141, 151, 159, 167, 182, 208, 222, 241, 259, 274`. The comment states why: "keeps every existing caller and test fixture compiling unchanged" (`:110-112`). None checks lifecycle state, so `SetQuantity` works on a completed unit. The postgres repo rebuilds aggregates with `NewWorkUnit` plus these setters, so they cannot simply be removed (`wes-work-planning:internal/adapters/outbound/postgres/work_unit_repo.go:125-156`). Lifecycle methods remain guarded (`work_unit.go:283, 301, 315`). The canvas notes the setters only as omissions from a command table (`aggregate-design-canvas.md:349`). This is the most anaemic spot found. Single instance, but in a Core context. Lesser instances: `order-management:internal/domain/order/order.go:160` `SetVersion`, `:185` `SetRequiredShipBy`.
- `[error]` **Internal collection leaked.** `inventory-storage:internal/domain/reservation/reservation.go:149` returns the internal slice; `Allocation` has exported fields (`:49-53`), so a caller can edit an aggregate's allocations in place. `network-fulfillment:internal/domain/networkorder/network_order.go:397-403` copies, and its comment describes this as "the quietest way an aggregate boundary gets breached in Go". `network-inventory-planning:.../saga_snapshot.go:119` also copies. Drift between repos, one mis-instance seen, not audited across all accessors.
- `[debatable]` **Aggregate size.** `Assignment` and `InterWarehouseTransfer` have 22 fields, `WorkUnit` and `Task` 20, `Request` 17. Canvases give size estimates. Fields mostly belong to one lifecycle, so this is breadth rather than a cluster of entities. Vernon's "small aggregates" advice [from memory] is about what must be consistent, not field count.

### Inferences
- Multi-aggregate transactions in inventory-storage are a considered trade, not ignorance. The defect is in how the docs describe the extent, not the choice. A reader would be misled by "the one place".
- The `Bin` being saved on every pick makes `Bin` a likely optimistic-lock contention point, which is what Vernon's rule tries to avoid [from memory]. The canvas says there is no production traffic, so this has not been measured.

### Gaps
- Class diagrams were checked only by grep for the names above, not reconciled per class.
- I did not diff the synced `docs/contexts/*` packs against repo sources in full. A raw diff gave 38 to 52 changed lines for three canvases, and I did not classify how many are mere link rewrites. The two stale statements above exist on both sides.

## Value objects and Go idioms

### Takeaway
The older Core repos and facility-layout use real value objects. Newer small repos more often use raw strings and ints with validation in the aggregate. Go's conversions and zero values are real leaks, and facility-layout shows the strongest mitigation.

### Cited Findings
Primitive-typed fields out of total on aggregate roots, excluding `version`, by AST scan:

| Aggregate | Primitive/total |
| --- | --- |
| `StationTrip` (task-interleaving) | 0/7 |
| `StockUnit` (inventory-storage) | 1/10 |
| `LocationSlot` (facility-layout) | 1/11 |
| `NetworkOrder` (network-fulfillment) | 1/12 |
| `Reservation` (inventory-storage) | 2/11 |
| `Order` (order-management) | 2/11 |
| `Package` (fulfillment-execution) | 2/9 |
| `Site` (facility-layout) | 3/8 |
| `Task` (fulfillment-execution) | 5/20 |
| `Assignment` (order-sourcing) | 6/22 |
| `WorkUnit` (wes-work-planning) | 9/20 |
| `Request` (pick-face-replenishment) | 9/17 |
| `InterWarehouseTransfer` (network-inventory-planning) | 9/22 |

- `[good]` **Strongest VOs.** `facility-layout:internal/domain/shared/location_code.go:28, 39-49` (`LocationCode`, unexported fields, per-segment validation); `facility-layout:internal/domain/shared/geometry.go:30, 56` (`Point3D` has unexported fields and a `set` flag, so its zero value is distinguishable from a real origin). This directly handles the Go zero-value problem Boyle discusses [from memory, general topic only].
- `[good]` **Self-validating arithmetic.** `inventory-storage:internal/domain/shared/quantity.go:11-40`: `NewQuantity`, `NewPositiveQuantity`, and `Sub` returning an error on negatives. A scan found 0 bare `shared.SKU(` conversions in inventory-storage's non-test adapters and application code.
- `[debatable]` **Go leak: named primitives bypass constructors.** `type Quantity int` (`quantity.go:7`) and `type SKU string` (`sku.go:4`) permit `Quantity(-1)` and `SKU("")` anywhere. Constructors therefore re-check them (`stock_unit.go:59-64`), and adapters cast directly in places (`inventory-storage:internal/adapters/outbound/postgres/bin_level_ledger.go:54-55`), although other adapters use `rehydrateQuantity` (`location_repo.go:77-81`). A struct with an unexported field, as in `LocationCode`, closes the gap at the cost of verbosity.
- `[debatable]` **Primitive obsession in newer aggregates.** `pick-face-replenishment:internal/domain/replenishment/request.go:29-44` uses `string` for site, SKU and bins and `int64` for quantities. `network-inventory-planning:.../saga.go:154-159` has a typed `TransferID` but `string` sites and SKU and `int` quantity. `wes-work-planning:.../work_unit.go:63, 67-69`. Validation exists at command boundaries, e.g. `saga.go:293-298`, so these are not unvalidated, but swapped string arguments would compile.
- `[debatable]` **Exported fields on a declared value object.** `pick-face-replenishment:internal/domain/policy/policy.go:58-67`. Value receivers make mutation harmless, and `Restore` validates (`:102-114`), but a `Policy{...}` literal skips validation.
- `[debatable]` **Validation on rebuild differs by generation.** Validating: `pick-face-replenishment:.../policy.go:94-114` ("a corrupt row can never become a live value"), `order-sourcing:internal/domain/assignment/snapshot.go` (22 error returns in the file), `task-interleaving:internal/domain/stationtrip/snapshot.go` (3). Trusting: `inventory-storage:.../stock_unit.go:98-107`, `network-fulfillment:.../network_order.go` ("bypasses every invariant Receive enforces, because the stored row already satisfied them"), `network-inventory-planning:.../saga_snapshot.go` (0 error returns), `order-management:.../order_snapshot.go` (0). Both are defensible; it is an undocumented inconsistency. Some trusting repos validate parts, e.g. `ParseState` at `network-fulfillment:.../network_order.go:53-58`.
- `[cosmetic]` **Naming.** `Id()` in wes-work-planning and fulfillment-execution versus `ID()` elsewhere (scan).

### Inferences
- Primitive usage correlates with repo age and template generation rather than with Core versus Supporting class: `WorkUnit` in a Core context has as many primitives as a small Supporting `Request`.

### Gaps
- VO immutability was read for the types named above, not audited across every type in `domain/shared`.

## Domain events versus integration events, and analytics versus integration topics

### Takeaway
Domain facts and wire contracts are distinct types, and analytics topics are a real internal data product. Names are overwhelmingly past-tense facts. One explicit command-as-event and a handful of CRUD-ish names exist. There is no in-process domain-event dispatch: domain events exist only to feed the outbox, and the way they are raised varies across three styles.

### Cited Findings
- `[good]` **Separation of fact and wire.** `inventory-storage:internal/domain/shared/events.go:5-11` defines `DomainEvent`; wire payload and CloudEvents encoding live in adapters. `isIntegrationEvent` is an explicit allow-list (`inventory-storage:internal/adapters/outbound/kafka/publisher.go:112-120`). `LocationRecorded` is a domain event with no wire form on either topic (`events.go:49-58`, `outbox_publisher.go:48-52`), a true private event. task-interleaving's domain names differ from the contract names: `HintIssued` domain, `InterleavingHintIssued` wire (`task-interleaving:internal/adapters/outbound/events/encoder.go:38-46`). This matches Khononov's private/public event split [from memory, attribute cautiously].
- `[debatable]` **Three ways of raising events.**
  - Use case constructs the event: `inventory-storage:.../confirm_pick.go:68`, `wes-work-planning:.../release_next_work.go:95`. The aggregate cannot guarantee its fact is raised. Scan suggests also fulfillment-execution, facility-layout, order-management, network-fulfillment, labor-performance, process-path-management, product-master.
  - Aggregate records and use case drains: `pick-face-replenishment:.../request.go:85, 107`; `raise`-style methods found by scan in task-interleaving, inbound-receiving, returns-processing, exception-management, warehouse-planning, workforce-management, checkout, shopping-cart.
  - Command returns the event: `network-inventory-planning:.../saga.go:180, 205`, but this repo also builds some events in the use case (`transfer_facts.go:142`, `saga_health.go:53`). order-sourcing also appears to use this style (scan and comments only).
  - All are accepted practice [from memory; Vernon describes publishing from the model]. The canvas "Created events" sections do not tell you which style applies.
- `[good]` **Naming.** Own event types across 22 specs: 186 by regex over each `asyncapi.yaml` (may undercount). None is imperative. A past-tense regex flagged 10; 4 were false alarms (`PromiseMade`, `PromiseKept`, `DockAppointmentCheckedIn`, `FulfillmentReleasedToNode`). The other 6 are state descriptions of a fact, not commands: `PromiseAtRisk`, `PromiseUnkeepable`, `TaskAvailable`, `AcknowledgementDeadlineAtRisk`, `FulfillmentUnsourceable`, `CheckoutPlacementInDoubt`.
- `[debatable]` **Command-like.** `TransferAllocationRequested` is called a "command event" in the code itself (`network-inventory-planning:.../saga.go:203-204`) and has exactly one addressed recipient with a reply (`inventory-storage:internal/adapters/inbound/kafka/transfer_consumer.go:193`). This is a Command Message in EIP terms [from memory] published on an event topic. `ReplenishmentRequested` is milder: request is itself a business fact with lifecycle (`request.go:65-87`), and wes-work-planning creates work from it. These 2 are the only `*Requested` names out of 186.
- `[debatable]` **CRUD-like.** `*Created` 4 (`TaskCreated`, `ProcessPathCreated`, `CapacityPlanCreated`, `WorkUnitCreated`), `*Updated` 3 (`ProcessPathUpdated`, `AisleGeometryUpdated`, `LocationGeometryUpdated`), 0 `*Deleted`. `ProcessPathUpdated` is a full-state revision (`process-path-management:internal/domain/shared/events.go:45-54`), Event-Carried State Transfer rather than a business fact. The 11 `*Registered` events are master-data entries; a master-data context has little else to say. So about 4% of names are CRUD-like, concentrated in process-path-management and facility-layout.
- `[good]` **Analytics separation is meaningful.** The standard calls analytics topics "internal" (`docs/strategic-design/event-standard-cloudevents.md:58-59`), and `dataschema` distinguishes the stream (`:97`). In the specs I listed, every subscribed `.analytics` channel is the context's own. Own projectors consume them (`task-interleaving:internal/adapters/inbound/kafka/analytics_consumer.go:18-22`). Inventory-storage's sets differ deliberately: 15 integration, 9 analytics, 5 on both (`ItemStowed`, `ItemUnlocated`, `StockReserved`, `ReservationRevoked`, `DiscrepancyDetected`). Integration topics are thus not a mirror of internal state, which is what Stopford and Bellemare caution about [from memory].
- `[cosmetic]` **Topic naming.** Real topics are `warehouse.inventory.*`, `warehouse.facility.*`, `warehouse.fulfillment.*`, `warehouse.workforce.*`, and for wes-work-planning `warehouse.work-planning.events` but `warehouse.wes.analytics` (`wes-work-planning:apis/asyncapi.yaml`). The stated pattern `warehouse.<ctx>.*` holds only loosely. Newer repos use the full repo name.

### Inferences
- With no in-process subscribers seen, "domain event" here means "fact bound for the outbox". Reactions inside a context are done by direct use-case calls (`emptyContainerOfUnit`, `BinLevelEmitter`). That suits the project but is narrower than Vernon's model [from memory].
- A consequence of analytics-only placement is covered under Sagas: `ReservationExpired` cannot drive a reaction in another context.

### Gaps
- I did not exhaustively prove no in-process event subscribers exist. No dispatcher was seen in code read. Whether any repo outside the specs reads `.analytics` (for example warehouse-infra sinks) was only grepped lightly and nothing was found.

## Repositories

### Takeaway
Roughly per aggregate, with interfaces on the inner side of the hexagon. Placement is in the application layer rather than in the domain, and paging types have crept into a few domain packages. Partial-save methods exist.

### Cited Findings
- `[good]` **Per aggregate.** `inventory-storage:internal/application/ports/ports.go:22, 36, 43, 50` (`StockRepo`, `LocationRepo`, `RelocationRepo`, `ReservationRepo`), and comparable in the others read.
- `[debatable]` **Interfaces outside the domain.** 0 `Repo`/`Repository` interfaces under any scanned `internal/domain`. They are in `application/ports` or `application/repository`. Evans places repository abstractions with the model [from memory]; hexagonal practice places them on the application's port side. The harness enforces that `ports` contains only interfaces (`network-fulfillment:internal/application/contract/contract.go:5-9`). Consistent and deliberate, so not an error.
- `[debatable]` **Query concerns in the domain.** Paging: `inventory-storage:internal/domain/reservation/page.go`, `wes-work-planning:internal/domain/workunit/cursor.go`. Listing: `network-inventory-planning:internal/domain/transfer/query.go:79-99` (`ListFilter` with `Limit`, `Offset`, `After`, and REST paging wording in its comment). Purely structural leakage of the REST guideline into domain packages; order-sourcing's `internal/application/views` shows the cleaner home.
- `[debatable]` **Partial saves.** `fulfillment-execution:internal/application/ports/ports.go:32` `SaveClaim` (compare-and-set, ADR-0034) and `network-inventory-planning:internal/application/ports/transfer_repositories.go` `UpdateState`. Justified by concurrency, but they diverge from "load whole, save whole" [from memory].
- `[cosmetic]` **Package location differs.** A separate `application/repository` package exists only in newer repos. See template drift.

### Inferences
- There is real read/write separation emerging in newer repos (`application/views`, `analytics/report`), while older ones overload the aggregate repo with `FindBy*` query methods, e.g. `ReservationRepo.FindByDemandRefAfter`.

### Gaps
- Repository implementations were read only where cited.

## Domain services versus application services

### Takeaway
Pure domain services are common and well placed. The clearest misplacement is inventory-storage's stock allocation rule, which is repeated across use cases.

### Cited Findings
- `[good]` **Pure domain services.** `wes-work-planning:internal/domain/release/release_policy.go:15`; `pick-face-replenishment:internal/domain/detection/detector.go`; `task-interleaving:internal/domain/recommend/recommend.go` and its canvas section "The recommender is not an aggregate"; `order-sourcing:internal/domain/sourcing/sourcing.go`; `network-inventory-planning:internal/domain/transfer/planner.go`; `facility-layout:internal/domain/travel/graph.go`; `order-management:internal/domain/order/path_selection.go:96`. Their application wrappers only gather inputs: `task-interleaving:internal/application/usecases/ranker.go:16-21`, `pick-face-replenishment:internal/application/usecases/evaluator.go:16, 55-56`.
- `[error]` **Allocation rule in the application layer, repeated.** The greedy draw from usable units is in `inventory-storage:internal/application/usecases/reserve_stock.go:234-275` and again in `allocate_transfer_stock.go:328-352`, with a third variant around `reserve_full_cases.go:101`. It spans aggregates, has no I/O, and decides business outcomes, which is Evans's description of a domain service [from memory]. `isReplayOf` (`reserve_stock.go:216-225`) is similar. Canvas invariant R1 openly records it in the use case. Note `StockUnit.Reserve` still re-checks per unit, so the invariant cannot be broken by this placement.
- `[debatable]` **Thin domain in network-fulfillment** (1037 domain versus 3424 application LOC). That suits an ACL/translation Supporting context, where Khononov would accept simpler models [from memory].
- `[good]` **Correct use of application services for orchestration:** `inventory-storage:.../confirm_picks_for_order.go:159-190` handles claim plus transaction and delegates rules.

### Inferences
- A single `domain/stock` allocator would remove duplication without changing transaction shape.

### Gaps
- Only 3 to 5 use cases per repo were read closely, so more misplacement may exist in large files such as `apply_slot_plan_approved.go` or `approve_transfer.go`.

## Anti-corruption layers and the `ProductClassified` local copies

### Takeaway
network-fulfillment is a real ACL, and upstream wire types stop at adapters elsewhere too. The four `ProductClassified` copies agree on the mechanism (idempotent claim, strict version guard, one transaction) and disagree on how strictly they validate. Inventory-storage's stricter check creates a silent divergence path if the upstream vocabulary grows.

### Cited Findings
- `[good]` **network-fulfillment.** Port speaks only own vocabulary: `network-fulfillment:internal/application/ports/ports.go:59-112` (`NetworkGateway` uses `contract.*` and `shared.NetworkRef`). The contract package states it holds no network wire fields: `internal/application/contract/contract.go:11-14`. Wire DTOs and mapping live in `internal/adapters/outbound/retailnetwork` (`wire.go`, `inbound.go:28-51`, `gateway_live_demand.go:64`). A grep for "seller, amazon, fba, mcf, spapi" under domain and application found only comments plus the `ownerRef` meaning of seller. Foreign identifiers stay typed and separated from SKUs: `network_order.go:112`. The narrow exit is explicit: `SKUQuantities` at `network_order.go:372-384`. Translation dictionary: ADR 0013; `ports.ProductTranslation` at `ports.go:136`; there is even a `ReceiveUntranslatable` path (`network_order.go:241`). This is close to textbook Evans [from memory].
- `[good]` **order-sourcing.** Foreign JSON decodes to local anonymous structs at the adapter, then becomes domain values: `order-sourcing:internal/adapters/inbound/kafka/handlers_partner.go:15-27`. task-interleaving "restated here, never imported": `fulfillment_consumer.go:27`.
- `[debatable]` **Conformist leakage in a domain.** `network-inventory-planning:.../saga.go:47-62` carries inventory-storage's line-id format and closed rejection vocabulary; `:115-125` "mirrored from inventory-storage's payload"; audit entries carry wire event names (`:188, 236, 253`). As a Conformist to a Published Language this is acceptable, but it is not an ACL, and a saga in the Core domain knows its upstream's wire format.
- **The four local copies, read.**

| Concern | inventory-storage | wes-work-planning | fulfillment-execution | order-management |
| --- | --- | --- | --- | --- |
| Full `type` check | `product_master_consumer.go:142-149` | `product_classification_consumer.go:183` | `product_classified_consumer.go:222` | `product_classification_consumer.go:~185` (`ceTypeProductClassified`, const at `:55`) |
| Claim + upsert in one UoW | yes, `apply_product_classification.go:76-94` | yes, `observe_product_classification.go:90-94` | yes, `apply_product_classified.go:45-58` | yes, `product_classification.go:68-86` |
| Version guard, strict `<` | `product_classification_repo.go:54` | `productclassificationcopy/postgres.go:55` | `productclassificationcopy/postgres.go:60` | `productclassificationcopy/postgres.go:114` |
| Tag validation | closed set, duplicates and cross-field rules via `product.New`, `apply_product_classification.go:104-131` | none | none | none |
| DOT class check | 1 to 9 with hazmat rule | 0 to 9, `:36-47` | 1 to 9 only when present, `:235-241` | none, `product_classification.go:49-59` |
| `classification_source` | stored | not requested | not stored | decoded, not stored, `:60-62` |
| Invalid message | log, commit past | log, skip | log, skip | log, commit past |
| Start offset | explicit first, `:120` | explicit first, `:105` | explicit first, `:88` | unset; kafka-go's consumer group defaults to first (`consumergroup.go:243-244` in v0.4.51) |
| Dedupe store | `(consumer, event_id)` | `processed` via `onceAtomically` | `MarkProcessed(id)` | dedicated table `product_classification_processed_events`, `postgres.go:141` |

- `[good]` **Mechanism agrees in all four.** Full type, one transaction, strict version guard, unknown types ignored.
- `[debatable]` **Validation disagrees.** A message carrying a tag outside inventory-storage's closed set is rejected there (`ErrMalformedProductClassification`, logged and committed past, version not advanced) while the other three store it. Today upstream enforces the same closed set of 5 tags (`product-master:internal/domain/product/classification.go:31-35`, `inventory-storage:internal/domain/product/classification.go:58-62`) and the same cross-field errors, so **no live divergence exists**. If product-master adds a tag, inventory-storage freezes that SKU at its old classification, and no DLQ exists in any of the four (grep for DLQ in these four consumers found none).
- `[debatable]` **Inventory-storage's copy still modelled as an aggregate.** Canvas lists `ProductClassification` among six aggregates although its owner is now product-master. The local copy is really a read model, as wes-work-planning names it (`productclassificationview`). The fleet uses four names for one concept: `ProductClassification`, `ProductClassificationView`, `ClassificationInfo`, `ProductClassificationRecord`.
- `[cosmetic]` **Boot rejection claim.** CLAUDE.md says `PRODUCT_CLASSIFICATION_MODE=http` is rejected at boot across the four. A grep found the variable in order-management (`cmd/order/product_classification.go:29`), wes-work-planning (`cmd/a2a/main.go:10`) and fulfillment-execution (`cmd/execution/config.go:96`), but no reference in inventory-storage's `cmd` or `internal`. Inventory-storage is the origin of the copy and has no client to switch off, so the claim is only loosely worded.
- `[cosmetic]` **Stale comment.** `fulfillment-execution:internal/domain/task/task.go:306-308` still attributes `Fragile` to "inventory-storage's ProductClassification".

### Inferences
- Tolerant-reader versus strict-model is a reasonable choice per consumer. It should be a stated contract rule, and the standard's "ignore unknown" guidance covers types, not values within a closed enum.

### Gaps
- I did not read how each repo behaves on lookups of an unknown SKU, except fulfillment-execution's fail-open per item (`seal_package.go:150-163`) and `Known: false` for no row.

## Sagas and process managers

### Takeaway
`InterWarehouseTransfer` is a solid orchestrated, forward-only process manager, but it is **not** a compensating saga as Richardson defines one. The project says so openly in ADRs. More seriously, from code reading, the origin reservation looks disconnected from the pick, which needs checking.

### Cited Findings
- `[good]` **Process-manager qualities.** Aggregate acts as the orchestrator, correlating by transfer id. State machine with single writer and audit trail: `network-inventory-planning:internal/domain/transfer/saga.go:10-24, 275-285`. Replies validated: `:289-325`. State change and outbox in one transaction: `internal/application/usecases/transfer_facts.go:100-104, 120-145`. Dedupe and DLQ: `transfer_reply_consumer.go:145-155`. Partner side is replay-safe: `inventory-storage:internal/domain/transfer/allocation.go:47-50`, `allocate_transfer_stock.go:~105-110`. Timeout observation: `internal/domain/transfer/stuck.go:15-26`, `saga_health.go:38-65`.
- `[error]` **No compensation.** Richardson's saga is local transactions plus compensating transactions on failure [from memory]. Here:
  - `Cancel` is illegal after `ALLOCATING` (`saga.go:260-265`).
  - `Cancel` has no route, no use case and no event: canvas table says "none (tests only)" (`docs/contexts/network-inventory-planning/aggregate-design-canvas.md:~110`), and a grep of `internal/application` and `internal/adapters` found no call.
  - `network-inventory-planning:docs/docs/adr/0015-rebalance-policy-and-lane-catalogue.md:~130-138`: "Until then no transfer reaches CANCELLED". ADR 0003 records that a revocation command is still needed.
  - Stuck detection only observes: "nothing cancels, retries or releases automatically" (canvas `:~96`).
  - `UNFULFILLABLE` needs no compensation since nothing was held, so the simple failure branch is sound. The state is disclosed honestly, so the error is one of label versus literature, and the deferred work is on record.
- `[error]` **Reservation expiry versus saga timeout. Traced by reading, not by running.**
  - Reservation for the transfer uses `DefaultReservationTimeout` of 30 minutes (`inventory-storage:.../reserve_stock.go:15`, `allocate_transfer_stock.go:112-115`). The wiring sets no `Timeout` (`inventory-storage:cmd/inventory/transfer.go:63-71`).
  - The saga stays `ALLOCATED` with a 24-hour default stuck threshold (`stuck.go:13-25`).
  - "`allocation_expires_at` is stored but no policy acts on it" (canvas `:~97`).
  - `ReservationExpired` is only on the analytics topic (`inventory-storage:apis/asyncapi.yaml`, channel listing), so network-inventory-planning cannot react to it even in principle, and a grep found no handling.
- `[error]` **Possibly disconnected origin reservation. Confidence: medium.** The reservation's demand reference is `transfer:<id>:<line>` (`allocate_transfer_stock.go:189, 358-363`). A grep found no other user of that format across inventory-storage, wes-work-planning, fulfillment-execution and network-inventory-planning. The pick demand carries no reservation id and uses `DemandID = <id>:pick` (`transfer_facts.go:68-79`). `ConfirmPicksForOrder` treats a missing demand reference as a no-op and its comment names transfers explicitly (`confirm_picks_for_order.go:56-58`). Inventory-storage consumes only `TaskCompleted` from fulfillment (spec channel listing). If this reading holds, the origin stock of a transfer is never decremented by the pick, and the reservation simply lapses. This needs verifying in `e2e-tests/transfer_test.go` and `features/inter_warehouse_transfer.feature`, which I did not read. It may also belong to the domain-semantics researcher.
- `[debatable]` **Short pick asymmetry.** The saga records a short pick and dispatches only the picked quantity (`transfer_facts.go:82-84, 154-157`). Inventory-storage says "Short picks are not modelled" and confirms the whole allocation (`confirm_picks_for_order.go:124`, `confirm_pick.go:58-59`). Unsure whether the two meet in practice given the previous item.
- `[good]` **Other process logic with real compensation.**
  - `network-fulfillment:internal/application/usecases/sweep_orphaned_holds.go:1-10`: timeout-driven cancel of holds through an existing command, the clock explicitly owned here.
  - `order-management:internal/application/usecases/cancel_order.go:~50-56` revokes reservations and fails closed.
  - `checkout:internal/domain/checkoutsession/session.go:2, 43-48`: a stated "purchase saga" with a "semantic lock" and "void pending" rules, naming Richardson's countermeasure vocabulary. Only those lines were read.
  - order-sourcing `Assignment` handles node refusal, re-queue and revised promises (canvas), a process manager without the name. Read only via canvas and error names.
- `[cosmetic]` **Doc versus code within the saga.** See the canvas retry statement under Aggregates.

### Inferences
- The strongest compensation design is in network-fulfillment and checkout, not in the one context labelled Core with an explicit "transfer saga". For teaching, naming it a process manager with deferred compensation would be more accurate.

### Gaps
- Checkout, order-sourcing and delivery-promise process logic was not read in depth. End-to-end behaviour of transfer reservations was not executed.

## Outbox, idempotency and consumer behaviour

### Takeaway
The docs' claims hold in code for every sampled consumer: stable ids through stored bytes, dedupe in the same transaction as the effect, dispatch on full type, unknown types ignored. Small drift exists in id-per-occurrence and DLQ policy.

### Cited Findings
- `[good]` **`id` stable across redelivery.** It is minted once at encode time and the encoded bytes are stored; the relay resends them: `inventory-storage:internal/adapters/outbound/kafka/encoded.go:17-22`, `internal/adapters/outbound/postgres/outbox_publisher.go:53-80`, row read at `outbox_relay.go:266`. Same design with an id column: `task-interleaving:internal/application/outbox/outbox.go:1-5, 18-21`. network-inventory-planning mints at encode: `internal/adapters/outbound/kafka/publisher.go:82, 132`. Standard: `docs/strategic-design/event-standard-cloudevents.md:91`. All 13 repos checked have `outbox_events` tables and outbox references in their wiring. Publish joins the aggregate's transaction in all read cases, matching Richardson's Transactional Outbox [from memory].
- `[cosmetic]` **"Minted ONCE per domain event" is not literally uniform.** inventory-storage mints separately per encoder, so the integration and analytics copies of one occurrence have different ids (`publisher.go:164`, `analytics_publisher.go:105`). network-inventory-planning and order-management are similar (`order-management:.../publisher.go:290`, `analytics_publisher.go:134-138`). task-interleaving shares one id (`outbox.go:18-20`), and pick-face-replenishment uses one `mintID()` per fact (`events/sink.go:73`). Harmless since separate topics have separate consumers, but the standard and the code differ.
- `[good]` **Full-type dispatch.** Scan of inbound Kafka adapters in 21 repos: 0 suffix, prefix or contains matching on the type. Sample read: `inventory-storage:.../product_master_consumer.go:142-150`; `network-inventory-planning:.../transfer_reply_consumer.go:237-243`, `transfer_fact_consumer.go:165-169`; `pick-face-replenishment:.../consumer.go:120`; `order-management:.../product_classification_consumer.go:55`. Unknown types are ignored in each.
- **Consumer comparison, read.**

| Consumer | Dedupe | Same tx as effect | Refused or malformed |
| --- | --- | --- | --- |
| inventory-storage `TaskCompleted` | `ProcessedEvents.Claim`, `confirm_picks_for_order.go:175-182` | yes | `ErrMalformedPickCompletion`, dead-lettered per canvas R8 (canvas statement, not traced) |
| inventory-storage `TransferAllocationRequested` | **business key** `transfer_line_id` ledger, no CE-id claim, `allocate_transfer_stock.go:~105-110` | yes | skip with log; `IDEMPOTENCY_CONFLICT` reply |
| network-inventory-planning replies and facts | `Claim`, `transfer_reply_consumer.go:145-146, 171-173` | yes | DLQ, `:385-388` |
| task-interleaving fulfillment | `Intake.apply`, `intake.go:46-60` | yes | `ErrInvalidEvent` |
| pick-face-replenishment | handler map, `consumer.go:120-132` | yes by template | DLQ or skip |
| ProductClassified copies | see previous table | yes | log and skip |

- `[debatable]` **Business-key dedupe in `AllocateTransferStock` departs from "dedupe on id"** in the standard (`event-standard-cloudevents.md:281`), yet is arguably stronger: it also replays the original answer and detects a different payload for the same line (`allocate_transfer_stock.go:226-246`). Standard text could allow it.
- `[debatable]` **Skip versus DLQ differs per consumer.** Newer repos and network-inventory-planning DLQ poison messages; inventory-storage's product-master consumer logs and commits past (`product_master_consumer.go:138-140`). The rule allows "DLQ/skip", so it is not a violation, but operational visibility differs.
- `[good]` **Atomic claim as a recurring lesson.** `wes-work-planning:.../observe_product_classification.go:16-18` (ADR-0028), `fulfillment-execution:.../apply_product_classified.go:19-23`, `task-interleaving:.../intake.go:38-40`, all roll the claim back with the effect.
- `[debatable]` **Idempotency primitive naming and keys vary.** `Claim(consumer, id)`, `MarkProcessed(id)`, `onceAtomically(...)`, a per-purpose table in order-management. The standard's key is `(source, id)` (`:91`), and code keys differ. No collision was shown; ids are UUIDs.
- `[debatable]` **Best-effort HTTP retry guard.** `inventory-storage:.../reserve_stock.go:172-176` admits a race on first attempts without a DB constraint. Disclosed.

### Inferences
- This is the most consistently implemented part of the fleet. The harness rule file `warehouse-harness-template:.claude/rules/fleet/idempotency-and-outbox.md` and the template's fitness tests explain why.

### Gaps
- Analytics projector dedupe was not read in detail. Only about 8 consumers in 6 repos were read directly; the rest rests on the scan.

## AsyncAPI specs versus published code

### Takeaway
In the sampled contexts, specs and code match on event sets and payload field names. There is a template sensor for part of it. The check here was on names, not on full schema semantics.

### Cited Findings
- `[good]` **inventory-storage, event set.** Spec has 15 on `warehouse.inventory.events` and 9 on `warehouse.inventory.analytics`. Code: allow-list of the same 15 (`publisher.go:112-120`) and 9 analytics `case` branches (`analytics_publisher.go:197-252`). `LocationRecorded` is deliberately in neither.
- `[good]` **task-interleaving, event set.** Spec: 1 on `.events`, 4 on `.analytics`. Encoder constants and topic comment match (`encoder.go:22-27, 41-46`).
- `[good]` **Payload field names, scripted.** Spec `data` field names found among encoder JSON tags or map keys. inventory-storage 124 of 124; task-interleaving 35 of 35; pick-face-replenishment 52 of 52; fulfillment-execution 87 of 91, and the other 4 are map keys my script's regex missed, present at `fulfillment-execution:internal/adapters/outbound/kafka/analytics_publisher.go:335-337`. This is presence across the whole encoder package, not per message and not type or required-ness. Golden tests exist too (`fulfillment-execution:.../golden_test.go`).
- `[good]` **Cross-repo pair.** `ReplenishmentRequested`: pick-face-replenishment encoder has `request_id, site_id, sku, forward_bin, source_bin, quantity, priority, policy_min, policy_max, requested_at`; wes-work-planning reads all but the policy fields. A tolerant reader subset.
- `[good]` **Catalogue fitness test.** Every own type in the spec must appear in a CloudEvents ADR: `inventory-storage:internal/architecture/catalogue_fitness_test.go:1-12, 58`. Note this ties spec to ADR, not spec to code.
- `[cosmetic]` **Stale consumer comment.** `task-interleaving:internal/adapters/inbound/kafka/fulfillment_consumer.go:16-20` says `TaskAvailable` and `TaskClaimed` "await producer change". fulfillment-execution's spec now lists both on `warehouse.fulfillment.events`.
- `[debatable]` **AsyncAPI versions differ.** 2.6.0 in inventory-storage, 3.0.0 in network-inventory-planning. Not a defect, but tooling must handle both.

### Inferences
- There appears to be no automated check in the sample that links spec to encoder output in general, apart from golden tests where they exist. The match found appears to be held by discipline and golden tests.

### Gaps
- network-inventory-planning's AsyncAPI 3 structure defeated my payload script, so only event names were compared there, not fields. Golden test coverage across repos was not surveyed. Pair check for `TransferStockAllocated` did not extract the producer's struct and so was not completed.

## Uniformity, template drift, hidden Shared Kernel

### Takeaway
Shared code is real, and much of it is an **explicit** Shared Kernel by copy, managed by `warehouse-harness-template` with drift sensors, including domain code (`gs1`). The domain layer itself shows at least three visible generations of the template. Some duplication of domain concepts is declared and some is not.

### Cited Findings
- `[good]` **Explicit kernel.** `inventory-storage:internal/domain/shared/gs1/doc.go:1-12`: "DO NOT EDIT a copy of this package inside a service. The canonical source is warehouse-harness-template… copies must stay byte-identical and are checked by the template's drift sensors." Byte-identical in 4 repos: inventory-storage, fulfillment-execution, product-master, inbound-receiving. Template holds `internal/domain/shared/gs1/*` and `templates/cloudevents/cloudevents.go.tmpl`. Fitness tests marked "MANAGED by warehouse-harness-template": `catalogue_fitness_test.go:1-2`. Evans's Shared Kernel requires an explicit agreement and coordinated change [from memory]; here the agreement is mechanical. Trade-off: no runtime or module dependency, and a fleet-wide change means re-sync everywhere.
- `[good]` **CloudEvents.** `cloudevents.go` in 22 repos, declared "the fleet's shared reference implementation; only the four constants marked 'per repo' differ" (`inventory-storage:.../cloudevents.go:7-8`). Diff of logic after the constants, 5 repos against inventory-storage: order-management, wes-work-planning and task-interleaving identical; labor-performance differs in comments only.
- `[debatable]` **One meaningful fork.** `network-fulfillment:.../cloudevents.go` adds `TypeVersioned`, so only it applies the standard's `.v2` type suffix. In the other 4 diffed, `New` calls `Type(...)` with no version, so a v2 payload would change `dataschema` but not `type`, unless written by hand. This contradicts "breaking change means a new `.v2` type" as a generally available mechanism.
- `[debatable]` **Identical infrastructure files, after normalising module path:** `adapters/inbound/http/page/page.go` in 17 repos, `bootretry` in 8, `readiness.go` in 7, Kafka `health.go` clusters of 6 and 5, `processed_event_repository.go` 5 in memory and 3 in postgres, `unit_of_work.go` 4, `writer_config.go` 5, `analytics/report/timing.go` 4. Whether all are template-managed was not checked file by file. This is generic infrastructure, not domain, so not a Shared Kernel in Evans's sense.
- `[debatable]` **Domain concepts duplicated without a declared kernel.**
  - `packlevel` in pick-face-replenishment and network-inventory-planning, 118 and 114 lines, 26 differing lines; slotting-optimization has a 205-line variant; also `inventory-storage:internal/domain/packaging/pack_level.go`, `inbound-receiving:internal/domain/shared/packlevel.go`. These are local read models of a published event, so Separate Ways by design is plausible.
  - DOT segregation matrix: `fulfillment-execution:internal/domain/package/segregation.go` says "DELIBERATE, DOCUMENTED duplication" of inventory-storage's. Declared, and written differently (280 diff lines).
  - `pathcatalog` in wes-work-planning and fulfillment-execution, 98 diff lines. CPT in the same two, 15 diff lines.
- **Generations, by scan.**

| Trait | Older (inventory-storage, wes-work-planning, fulfillment-execution, facility-layout, order-management, network-fulfillment, labor-performance, process-path-management) | Newer (task-interleaving, pick-face-replenishment, order-sourcing, returns-processing, exception-management, slotting-optimization) |
| --- | --- | --- |
| Raising events | use case builds | aggregate records, or command returns |
| Rebuild | `Rehydrate`, mostly trusting | `Restore`, validating |
| Persistence shape | getters or per-repo | `Snapshot` struct |
| Packages | `application/ports`, `application/usecases` | adds `application/outbox`, `application/repository` |
| UoW method | `Execute` | `Do` |

  Not a clean split: network-inventory-planning mixes both (`Do`, `Rehydrate` and `Restore`, returned events) and product-master, inbound-receiving, warehouse-planning and workforce-management are hybrids. wes-work-planning has no function matching the scan's rebuild names (`Rehydrate`, `Restore`, `Reconstitute`, `FromSnapshot`, `Hydrate`); its work-unit repo uses `NewWorkUnit` plus setters.
- `[cosmetic]` **Layout oddities.** Package `pack` in directory `package` (`fulfillment-execution:internal/domain/package`).

### Inferences
- Older repos are not defective for having an older style. The cost is for a learner: the same tactical question gets different answers depending on repo age, and no fleet ADR found says which is preferred. The newer generation (validating `Restore`, aggregate-recorded events, `application/views`) looks closer to the literature.
- The template governs infrastructure and fitness rules tightly, but does not reach tactical style inside `domain/`, apart from `gs1`.

### Gaps
- I did not read the template's drift sensors to confirm which files are enforced. The generation table is scan-based, and I did not search systematically for a fleet ADR on domain-event raising style.
