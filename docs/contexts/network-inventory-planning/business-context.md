---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why moving stock between our own warehouses is its own bounded context — the gap between per-site stock, per-site demand and per-site capacity, and why every recommendation stays advisory until an operator approves it.
---

# Business Context

Sourced from the repository's `README.md` and ADRs
[0001](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0001-network-inventory-planning-boundary.md),
[0002](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0002-phase1-read-models-and-simulation.md),
[0003](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0003-transfer-saga.md) and
[0005](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0005-work-demand-release-and-fact-transitions.md).

## The question nobody answered

When the fleet serves more than one warehouse, each existing context knows a
piece of the picture:

- `inventory-storage` knows what stock exists at a site and holds the
  reservations on it;
- `order-management` knows which customer demand is assigned to which site;
- `facility-layout` knows which sites exist and whether each may send or
  receive transfers;
- `warehouse-planning` knows how much work a site can process in a window;
- `wes-work-planning` and `fulfillment-execution` know how physical work gets done.

None of them answers **"should stock move from this warehouse to that one, and
if the business says yes, who coordinates the move from the origin pick to the
destination stow?"** The repository README states the boundary plainly: it
*recommends* transfers and *never becomes the inventory ledger or moves
physical stock directly*.

## What it does today

- **Keeps local facts.** Three consumers project `SiteCapabilityChanged`,
  `SiteSkuDemandChanged` and `CapacityPlanPublished` into read models owned by
  this context, so a planning decision never waits on a sibling being up.
- **Refuses to guess.** The planning snapshot is built fail-closed: an empty
  read model, a fact older than the staleness budget (10 minutes by default) or
  a participating site that is disabled for a transfer direction makes the
  simulation answer `503`, not a degraded number. A site missing any of the
  three facts is left out rather than zero-filled.
- **Explains proposals.** The planner turns an explicit snapshot of positions,
  policies and lanes into a score-ordered list. Every proposal carries its policy
  version, reason codes and a score breakdown (priority benefit minus handling
  and lead-time penalties), so any recommendation is reproducible. The source
  keeps its safety stock and the destination gets no more than its deficit.
- **Carries an approved transfer to the end.** An operator approves a proposal.
  From that point a saga reserves origin stock through `inventory-storage`,
  releases the pick work and then the dispatch work to `wes-work-planning`,
  and advances on the facts that `fulfillment-execution` and `inventory-storage`
  publish, ending at `RECEIVED` once the destination stow is confirmed. A short
  pick is recorded and the dispatch leg carries only what was picked.
- **Shows where it is stuck.** A transfer that stops advancing is visible
  through REST, MCP, the console and analytics, with per-state thresholds. The
  loop is observe-only: a person decides what to do about it.

## Why a proposal is not a move

Approval is an operator decision with consequences: it reserves origin stock.
Nothing is issued to the floor until `inventory-storage` confirms that
reservation, and a transfer cannot be cancelled once the reservation exists.
That is why REST and MCP stay unauthenticated fleet-wide yet the MCP server is
read-only (ADR 0008): handing the approve action to an unauthenticated agent
endpoint would let any in-cluster caller move stock. The Idempotency-Key header
on `POST /v1/transfers:approve` makes retries safe, and a replay of the same
key and payload returns the original transfer.

## No live cross-context calls

NIP makes no REST or MCP call to a sibling. Everything it needs arrives as a
published CloudEvent and everything it asks of others leaves as one, through the
transactional outbox. Eventual consistency is handled by snapshot freshness and
by the saga's audit trail and stuck detection, not by distributed transactions.

## Honest scope today

- **The planner is only reachable with an explicit snapshot.** Positions,
  safety stock, target stock and lanes are request-body inputs to the diagnostic
  `POST /v1/transfer-proposals:generate`. There is no persisted lane or policy
  catalogue and no stock-position read model yet, so the read-model path
  (`GET /v1/transfer-simulations`) reports per-site demand, capacity and
  headroom rather than quantities to move, and the scheduled rebalance runs
  record zero proposals.
- **Approval validates at site level.** v1 checks that both sites participate
  with fresh facts, the origin may send and the destination may receive, the
  destination still shows in-window demand for the SKU, and the origin's
  published capacity covers its own in-window demand plus the transfer.
- **Single line, fixed expiry.** One SKU per transfer, a 24-hour approval expiry.
- **No forecasting, no optimisation.** Planning is deterministic rules. Demand
  forecasting, multi-echelon optimisation, route choice, auto-approval and
  dynamic order-site assignment are on the design plan's roadmap, not in the code.
- **Deployment prerequisites.** Approval answers `503 config-incomplete` until
  `TRANSFER_PICK_PATH_ID` and `TRANSFER_PICK_CPT_OFFSET` are set. The dispatch
  leg needs `TRANSFER_DISPATCH_PATH_ID` to name a path that exists in
  `wes-work-planning`'s path catalogue. The reference deployment sets `pick`,
  which is seeded, and `transfer-dispatch`, which its own comment says is not
  seeded and must be created in `process-path-management` first.
