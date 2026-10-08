---
id: class-diagram
title: Class diagrams
sidebar_label: Class diagrams
---

# Class diagrams

:::info[Authored in warehouse-docs]
`network-inventory-planning` does not yet ship a `docs/docs/ddd/` pack, so this page was written here from the repository's code and ADRs on `develop` (commit `8d25980`) instead of being synced. When the repository publishes its pack, replace this page with a synced copy.
:::

UML class diagrams of `internal/domain/**`, split by package, then the ports and
adapters around them. Only types and methods that exist on `develop` are drawn;
trivial getters are summarised. Fields of `InterWarehouseTransfer` are unexported
in the code and shown as attributes for readability.

## Package `transfer`: the saga aggregate

```mermaid
classDiagram
  class InterWarehouseTransfer {
    -TransferID id
    -string idempotencyKey
    -string originSiteID
    -string destinationSiteID
    -string sku
    -int quantity
    -string policyVersion
    -string operatorReason
    -TransferState state
    -string reservationID
    -int pickedQuantity
    -RejectionReason rejectionReason
    -int64 version
    +Approve(now) PlanApproved
    +RequestAllocation(now) AllocationRequested
    +MarkAllocated(StockAllocation, now) error
    +MarkUnfulfillable(lineID, reason, now) error
    +MarkPicked(Picked, now) error
    +MarkDispatched(now) error
    +MarkArrived(event, now) error
    +MarkStowed(Stowed, now) error
    +Cancel(reason, now) error
    +DispatchQuantity() int
    +StateAdvancedSince(version) StateAdvanced[]
  }
  class TransferState {
    <<enumeration>>
    DRAFT
    PROPOSED
    APPROVED
    ALLOCATING
    ALLOCATED
    PICKED
    IN_TRANSIT
    ARRIVED
    RECEIVED
    UNFULFILLABLE
    CANCELLED
    +NonTerminal() bool
  }
  class AuditEntry {
    +int64 Seq
    +TransferState From
    +TransferState To
    +string Event
    +string Reason
    +Time OccurredAt
  }
  class Allocation {
    +string StockUnitID
    +string BinID
    +int Quantity
  }
  class StowAllocation {
    +string StockUnitID
    +string BinID
    +int Quantity
  }
  class RejectionReason {
    <<enumeration>>
    ORIGIN_SITE_UNKNOWN
    INSUFFICIENT_USABLE
    IDEMPOTENCY_CONFLICT
  }
  class IllegalTransitionError
  class PlanApproved
  class AllocationRequested
  class DemandReleased {
    +string DemandID
    +WorkKind WorkKind
    +string PathID
    +string SiteID
    +Time CPT
    +int Quantity
  }
  class StateAdvanced
  InterWarehouseTransfer --> TransferState
  InterWarehouseTransfer "1" *-- "many" AuditEntry : audit
  InterWarehouseTransfer "1" *-- "many" Allocation : allocations
  InterWarehouseTransfer "1" *-- "many" StowAllocation : stowAllocations
  InterWarehouseTransfer --> RejectionReason
  InterWarehouseTransfer ..> IllegalTransitionError : returns
  InterWarehouseTransfer ..> PlanApproved : raises
  InterWarehouseTransfer ..> AllocationRequested : raises
  InterWarehouseTransfer ..> StateAdvanced : derives
```

Source: `internal/domain/transfer/saga.go`, `workflow.go`, `events.go`,
`analytics.go`. `DemandReleased` is built by the use cases from a loaded transfer,
not raised by the aggregate. Omits: `ProposalInput`, `Snapshot`/`Rehydrate`
(persistence support) and the plain getters.

## Package `transfer`: planner, approval, stuck detection and runs

```mermaid
classDiagram
  class Planner {
    +Generate(positions, policies, lanes) Proposal[]
  }
  class Position {
    +SiteID Site
    +SKU SKU
    +int Available
    +int CustomerReservations
    +int ConfirmedInbound
    +int CommittedOutbound
    +Time AsOf
    +Usable() int
  }
  class Policy {
    +string Version
    +int SafetyStock
    +int TargetStock
    +int UnitPriority
    +Deficit(Position) int
  }
  class Lane {
    +SiteID Origin
    +SiteID Destination
    +Duration LeadTime
    +int UnitHandlingCost
    +bool Enabled
    +Allows(origin, destination) bool
  }
  class Proposal {
    +SiteID Origin
    +SiteID Destination
    +int Quantity
    +string PolicyVersion
    +ReasonCode[] Reasons
    +Score() int
    +Valid() bool
  }
  class ScoreBreakdown {
    +int PriorityBenefit
    +int HandlingPenalty
    +int LeadTimePenalty
    +Total() int
  }
  class ReasonCode {
    <<enumeration>>
    DESTINATION_BELOW_TARGET
    ORIGIN_ABOVE_SAFETY_STOCK
    APPROVED_LANE
  }
  class ApprovalFacts
  class StuckCheck {
    +Evaluate(views, now) Stuck[]
  }
  class StuckThresholds {
    +ThresholdFor(state) Duration
  }
  class StuckView
  class RebalanceRun {
    +int64 ID
    +Time StartedAt
    +int ProposalCount
    +RebalanceOutcome Outcome
    +string FailClosedReason
  }
  Planner ..> Position : reads
  Planner ..> Policy : reads
  Planner ..> Lane : reads
  Planner ..> Proposal : produces
  Proposal *-- ScoreBreakdown
  Proposal --> ReasonCode
  StuckCheck --> StuckThresholds
  StuckCheck ..> StuckView : reads
```

Source: `internal/domain/transfer/model.go`, `planner.go`, `approval.go`,
`stuck.go`, `analytics.go`. `ValidateApproval` is a package function over
`ProposalInput` and `ApprovalFacts`, not a type. Omits: the `Snapshot` and `Stuck`
result structs.

## Package `planning`: local read-model facts and the snapshot

```mermaid
classDiagram
  class SiteCapability {
    +string Site
    +bool TransferOriginEnabled
    +bool TransferDestinationEnabled
    +int64 Revision
    +Time AsOf
    +Supersedes(other) bool
    +OriginAllowed() bool
    +DestinationAllowed() bool
  }
  class SiteSkuDemand {
    +string SourceOrderID
    +int LineNo
    +string Site
    +string SKU
    +int DemandedUnits
    +Time DueAt
    +DemandState State
    +string AssignmentVersion
    +Active() bool
    +DueIn(start, end) bool
  }
  class PublishedCapacityPlan {
    +string PlanID
    +string SiteID
    +Time WindowStart
    +Time WindowEnd
    +float64 CapacityOverWindow
    +float64 Shortage
    +Time PublishedAt
    +Covers(dueAt) bool
    +Supersedes(other) bool
  }
  class SnapshotInput {
    +Duration MaxStaleness
  }
  class PlanningSnapshot {
    +Time AsOf
    +Map Capabilities
    +Map DemandBySiteSKU
    +Map CapacityBySite
  }
  class DemandState {
    <<enumeration>>
    ACTIVE
    REMOVED
  }
  SnapshotInput o-- SiteCapability
  SnapshotInput o-- SiteSkuDemand
  SnapshotInput o-- PublishedCapacityPlan
  SiteSkuDemand --> DemandState
  SnapshotInput ..> PlanningSnapshot : BuildSnapshot
```

Source: `internal/domain/planning/capability.go`, `demand.go`, `capacity_plan.go`,
`snapshot.go`. `BuildSnapshot` is a package function. Omits: the constructors with
their validation (`NewSiteCapability`, `NewSiteSkuDemand`,
`NewPublishedCapacityPlan`).

## Ports and adapters

```mermaid
classDiagram
  class TransferRepository {
    <<interface>>
    +Create(transfer, key) existing
    +Load(id) transfer
    +UpdateState(transfer)
  }
  class TransferQuery {
    <<interface>>
    +Get(id)
    +List(filter)
  }
  class TransferEventPublisher {
    <<interface>>
    +Publish(events)
  }
  class PlanningSnapshotRepository {
    <<interface>>
    +Load() facts
  }
  class ProcessedEventRepository {
    <<interface>>
    +Claim(consumer, eventID) bool
  }
  class UnitOfWork {
    <<interface>>
    +Do(fn) error
  }
  class RebalanceRunRepository {
    <<interface>>
    +Record(run) id
    +List(limit)
  }
  class StuckTransferReader {
    <<interface>>
    +ListNonTerminal()
  }
  class ApproveTransfer
  class SimulateTransferOptions
  class GenerateTransferProposals
  class RunScheduledRebalance
  class CheckStuckTransfers
  class GetTransfer
  class ListTransfers
  class FindStuckTransfers
  class TransferRepo
  class TransferQueryRepo
  class OutboxWriter
  class OutboxRelay
  class SnapshotRepo
  class RebalanceRunRepo
  class Handler
  class Deps
  class TransferReplyConsumer
  class TransferFactConsumer
  ApproveTransfer --> TransferRepository
  ApproveTransfer --> TransferEventPublisher
  ApproveTransfer --> PlanningSnapshotRepository
  ApproveTransfer --> UnitOfWork
  SimulateTransferOptions --> PlanningSnapshotRepository
  RunScheduledRebalance --> RebalanceRunRepository
  RunScheduledRebalance --> TransferEventPublisher
  CheckStuckTransfers --> StuckTransferReader
  GetTransfer --> TransferQuery
  ListTransfers --> TransferQuery
  FindStuckTransfers --> TransferQuery
  TransferRepo ..|> TransferRepository
  TransferQueryRepo ..|> TransferQuery
  OutboxWriter ..|> TransferEventPublisher
  SnapshotRepo ..|> PlanningSnapshotRepository
  RebalanceRunRepo ..|> RebalanceRunRepository
  Handler --> ApproveTransfer
  Handler --> SimulateTransferOptions
  Handler --> GenerateTransferProposals
  Handler --> GetTransfer
  Handler --> ListTransfers
  Deps --> GetTransfer
  Deps --> ListTransfers
  Deps --> FindStuckTransfers
  Deps --> SimulateTransferOptions
  TransferReplyConsumer --> UnitOfWork
  TransferFactConsumer --> UnitOfWork
```

Source: `internal/application/ports/*.go`, `internal/application/usecases/*.go`,
`internal/adapters/**`. Class names are the code's identifiers; the adapters live in
`inbound/http` (`Handler`), `inbound/mcp` (`Deps`, which carries the tool use
cases), `inbound/kafka` and `outbound/postgres`. `OutboxWriter` and `OutboxRelay`
both work on the `outbox_events` table: the writer inserts inside the use case's
transaction, the relay drains it afterwards. Omits: the analytics store, projector and reports (they are a
separate read side, see below), the consumers for the three read models and the
use cases that apply replies and facts.

## Hexagonal view

```mermaid
flowchart LR
  subgraph IN[Inbound adapters]
    HTTP["HTTP handler :8080"]
    MCP["MCP server :8090"]
    KAFKA["Kafka consumers x5"]
    REP["nip-reports :8092"]
    PROJ["nip-projector"]
  end
  subgraph APP[Application]
    UC["Use cases and ports"]
  end
  subgraph DOM[Domain]
    TR["transfer"]
    PL["planning"]
  end
  subgraph OUT[Outbound adapters]
    PG["Postgres OLTP, outbox, runs"]
    RELAY["Outbox relay to Kafka"]
    AN["Analytical store"]
  end
  HTTP --> UC
  MCP --> UC
  KAFKA --> UC
  UC --> TR
  UC --> PL
  UC --> PG
  PG --> RELAY
  PROJ --> AN
  REP --> AN
```

Source: `cmd/network-inventory-planning/main.go`, `cmd/mcp/main.go`,
`cmd/nip-projector/main.go`, `cmd/nip-reports/main.go`. The domain imports no
adapter; the architecture fitness tests in `internal/architecture` enforce the
layering. The reports and the projector are a separate read side over a second
database and use no OLTP use case.
