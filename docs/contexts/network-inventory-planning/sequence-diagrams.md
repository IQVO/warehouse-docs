---
id: sequence-diagrams
title: Sequence diagrams
sidebar_label: Sequence diagrams
---

# Sequence diagrams

:::info[Authored in warehouse-docs]
`network-inventory-planning` does not yet ship a `docs/docs/ddd/` pack, so this page was written here from the repository's code and ADRs on `develop` (commit `8d25980`) instead of being synced. When the repository publishes its pack, replace this page with a synced copy.
:::

UML sequence diagrams of the main runtime interactions, derived from the use-case
and adapter code. Replies are shown as notes or dashed returns.

## 1. Project a sibling fact into a read model (Kafka)

All three read-model consumers follow this shape. The example is
`SiteCapabilityChanged`.

```mermaid
sequenceDiagram
  autonumber
  participant K as Kafka warehouse.facility.events
  participant C as SiteCapabilityConsumer
  participant U as UnitOfWork
  participant P as ProcessedEventRepository
  participant R as SiteCapabilityRepository
  K->>C: FetchMessage
  C->>C: cloudevents.Decode, check full type
  Note over C: non-CloudEvents, unknown type, malformed payload or failed validation is logged and committed past
  C->>U: Do(claim and upsert)
  U->>P: Claim(consumer, CloudEvents id)
  P-->>U: claimed or already processed
  U->>R: Upsert(capability), last writer wins on revision
  U-->>C: commit, or roll back and return the error
  C->>K: CommitMessages only after the transaction settled
```

Source: `internal/adapters/inbound/kafka/consumers.go`, `kafka.go` (`consumeLoop`).
Omits: the retry loop. A transient error returns non-nil and the same message is
retried with capped exponential backoff, 200 ms up to 5 s, with no attempt limit. The loop also extracts
the W3C `traceparent` header before handling (ADR 0007).

## 2. Advisory simulation (REST and MCP)

```mermaid
sequenceDiagram
  autonumber
  actor Client as Console or MCP client
  participant H as Handler
  participant S as SimulateTransferOptions
  participant R as SnapshotRepo
  participant D as planning.BuildSnapshot
  Client->>H: GET /v1/transfer-simulations
  H->>S: Execute
  S->>R: Load(capabilities, demands, plans)
  R-->>S: facts
  S->>D: BuildSnapshot(facts, MaxStaleness, now)
  Note over D: refuses on an empty model, a stale fact, or a participating site disabled for a direction
  D-->>S: PlanningSnapshot or error
  S-->>H: per-site demand, capacity, headroom, or error
  H-->>Client: 200 advisory sites, or 503 problem+json read-models-incomplete
```

Source: `internal/adapters/inbound/http/handler.go` (`simulate`),
`internal/application/usecases/simulate_transfer_options.go`,
`internal/domain/planning/snapshot.go`. An instance without `DATABASE_URL` answers
503 `read-models-unavailable` before reaching the use case. The MCP tool
`simulate_transfer_options` calls the same use case.

## 3. Approve a transfer (REST)

```mermaid
sequenceDiagram
  autonumber
  actor Op as Operator
  participant H as Handler
  participant A as ApproveTransfer
  participant D as BuildSnapshot and ValidateApproval
  participant U as UnitOfWork
  participant T as TransferRepo
  participant O as OutboxWriter
  Op->>H: POST /v1/transfers:approve with Idempotency-Key
  H->>A: Execute(input)
  A->>A: validate clock, staleness, work-release config, key, as-of
  Note over A: no TRANSFER_PICK_PATH_ID or offset means 503 config-incomplete, nothing persisted
  A->>D: BuildSnapshot, then ValidateApproval
  Note over D: missing, stale or disabled facts mean 422 facts-incomplete, never a degraded approval
  A->>U: Do
  U->>T: ProposeTransfer, Approve, RequestAllocation in memory
  U->>T: Create(transfer, idempotency key)
  T-->>U: existing transfer or none
  Note over U: an existing transfer with a different payload is 409 idempotency-conflict, with the same payload a replay returns the original
  U->>O: Publish(audit-derived TransferStateAdvanced, TransferPlanApproved, TransferAllocationRequested)
  U-->>A: commit
  A-->>H: transfer in ALLOCATING, replayed false
  H-->>Op: 200 with transferId, state, transferLineId, expiresAt
```

Source: `internal/application/usecases/approve_transfer.go`,
`internal/domain/transfer/saga.go`, `approval.go`,
`internal/adapters/outbound/postgres/transfer_repo.go`, `outbox.go`.
The expiry is a flat 24 hours (`defaultApprovalExpiry`). The three outbox rows
and the aggregate insert commit together or not at all.

## 4. Outbox relay to Kafka

```mermaid
sequenceDiagram
  autonumber
  participant L as OutboxRelay
  participant DB as outbox_events
  participant S as RelaySink
  participant K as Kafka
  loop every relay tick
    L->>DB: claim unpublished rows FOR UPDATE SKIP LOCKED, in id order
    DB-->>L: rows
    L->>S: send one row, with its stored headers and CloudEvents id
    S->>K: write to the row's topic
    K-->>S: ack
    L->>DB: set published_at
    Note over L: on failure record attempts and last_error and stop, so a later row never overtakes an earlier one
  end
```

Source: `internal/adapters/outbound/postgres/outbox.go`,
`internal/adapters/outbound/kafka/publisher.go`, ADR 0003. The relay runs when
`OUTBOX_RELAY_ENABLED` is set and `KAFKA_BROKERS` is configured. Without brokers
the rows wait and the endpoint still works. The trace context was injected at
encode time and is forwarded verbatim (ADR 0007).

## 5. Apply the allocation reply and release the pick (Kafka)

```mermaid
sequenceDiagram
  autonumber
  participant K as Kafka warehouse.inventory.events
  participant C as TransferReplyConsumer
  participant A as ApplyTransferAllocation
  participant U as UnitOfWork
  participant T as TransferRepo
  participant O as OutboxWriter
  K->>C: TransferStockAllocated
  C->>U: Do(claim and apply)
  U->>A: Execute(transfer id, allocation)
  A->>T: Load
  A->>A: MarkAllocated, line origin SKU quantity and reservation checked
  A->>T: UpdateState with optimistic version
  A->>O: Publish(TransferStateAdvanced, WorkDemandReleased pick)
  U-->>C: commit
  C->>K: CommitMessages
```

Source: `internal/application/usecases/transfer_facts.go`,
`internal/adapters/inbound/kafka/transfer_reply_consumer.go`. The pick demand is
`demand_id = <transfer_id>:pick`, quantity the allocated quantity, `path_id` from
`TRANSFER_PICK_PATH_ID`, `site_id` the origin, `cpt` the reply time plus
`TRANSFER_PICK_CPT_OFFSET`. `TransferStockAllocationRejected` uses the same shape
and calls `MarkUnfulfillable` instead, releasing nothing.

## 6. Apply the pick, dispatch, arrival and stow facts (Kafka)

```mermaid
sequenceDiagram
  autonumber
  participant K as Kafka
  participant C as TransferFactConsumer and TransferReplyConsumer
  participant A as Apply use cases
  participant T as TransferRepo
  participant O as OutboxWriter
  K->>C: TransferPicked on warehouse.fulfillment.events
  C->>A: ApplyTransferPick
  A->>T: Load, MarkPicked with the picked quantity, UpdateState
  A->>O: Publish(TransferStateAdvanced, WorkDemandReleased dispatch with the picked quantity)
  K->>C: TransferDispatched
  C->>A: ApplyTransferDispatched
  A->>T: MarkDispatched, UpdateState
  K->>C: TransferReceiptStaged on warehouse.inventory.events
  C->>A: ApplyTransferReceiptStaged
  A->>T: MarkArrived, UpdateState
  K->>C: TransferStockStowed
  C->>A: ApplyTransferStow
  A->>T: MarkStowed with the stow allocations, UpdateState
  Note over A: each fact runs in one transaction with its processed-event claim. Unknown transfer, illegal transition or refused fact is logged and committed past
```

Source: `internal/application/usecases/transfer_facts.go`,
`transfer_fact_consumer.go`, `transfer_reply_consumer.go`. Omits: the reserved
`TransferArrived`, which calls `MarkArrived` with its own event name; the dispatch
leg's `ValidateDispatch` check, which runs after the transition inside the same unit
of work.

## 7. Stuck check and scheduled rebalance (in-process tickers)

```mermaid
sequenceDiagram
  autonumber
  participant R as PeriodicRunner
  participant H as CheckStuckTransfers
  participant Rd as StuckTransferReader
  participant U as RunScheduledRebalance
  participant O as OutboxWriter
  R->>H: tick, first tick immediate
  H->>Rd: ListNonTerminal
  Rd-->>H: id, state, updated_at views
  H->>H: StuckCheck.Evaluate against per-state thresholds
  H->>O: Publish(TransferStuckDetected per stuck transfer)
  Note over H: observe-only, no state change, no cancel, no reservation release
  R->>U: tick of NIP_REBALANCE_SCHEDULE, only when configured
  U->>U: BuildSnapshot, then Planner.Generate
  Note over U: v1 passes no positions, policies or lanes, so a completed run proposes nothing
  U->>O: Publish(RebalanceRunCompleted) after recording a rebalance_runs row
```

Source: `internal/application/usecases/periodic.go`, `saga_health.go`,
`scheduled_rebalance.go`, ADR 0007. A failed tick is logged and retried at the next
interval. A fail-closed snapshot refusal is recorded as a `FAILED` run with its
reason and publishes nothing.

## 8. Analytics projection and reports

```mermaid
sequenceDiagram
  autonumber
  participant K as Kafka warehouse.network-inventory-planning.analytics
  participant P as nip-projector
  participant A as Analytical database
  participant D as DLQ topic
  actor Client as Report reader
  participant R as nip-reports
  K->>P: message
  P->>P: decode, dispatch on the full saga type
  alt not a CloudEvent
    Note over P: rate-limited WARN, committed past
  else known type with an unusable payload
    P->>D: raw bytes with x-dlq headers
  else valid
    P->>A: one transaction, mark event id and append the fact row
  end
  P->>K: commit the offset after Apply returned
  Client->>R: GET /reports/transfer-funnel
  R->>A: read-only query, UTC day buckets
  Note over R: empty results are empty arrays, never errors or null
```

Source: `cmd/nip-projector/main.go`, `internal/adapters/outbound/analyticsstore/*.go`,
`cmd/nip-reports/main.go`, `internal/analytics/report/*.go`, ADR 0009. A transient
failure retries the same message and is never dead-lettered. The five reports are
`transfer-funnel`, `state-dwell`, `stuck-transfers`, `rebalance-runs` and `freshness`.
