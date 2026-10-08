---
id: index
title: Network Inventory Planning
sidebar_label: Network Inventory Planning
description: The Core bounded context that recommends and orchestrates inter-warehouse stock transfers — fail-closed local read models, an advisory simulation, and an operator-approved transfer saga from approval to destination stow that never moves stock itself.
slug: /contexts/network-inventory-planning
---

# Network Inventory Planning

<span className="badge-core">Core Subdomain</span>

**Network Inventory Planning** (NIP) is the fleet's twelfth domain bounded
context and sits in the `wes` tier of the CloudEvents subdomain taxonomy
(`com.warehouse.wes.network-inventory-planning.*`). It answers one question:
**which stock should move between our warehouses, and how do we carry an
approved move through to the destination without ever editing stock ourselves.**
[ADR 0001](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0001-network-inventory-planning-boundary.md)
creates it as a WES-core context and fixes the boundary: `inventory-storage`
stays the authority for physical stock and reservations, `order-management` for
order allocation, `facility-layout` for site topology, and the WES contexts for
work execution. NIP integrates with all of them through CloudEvents 1.0 facts
and commands, never synchronous calls.

It owns two things. First, **local read models** of sibling facts (site
transfer capability, per-site demand, published capacity plans) and a
**fail-closed planning snapshot** built from them
([ADR 0002](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0002-phase1-read-models-and-simulation.md)).
Second, the **`InterWarehouseTransfer` saga**: an operator-approved plan that
asks `inventory-storage` to reserve origin stock, releases the pick and dispatch
legs to `wes-work-planning` as work demands, and follows the physical facts
until the destination stow closes it
([ADR 0003](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0003-transfer-saga.md),
[ADR 0005](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0005-work-demand-release-and-fact-transitions.md)).

:::info[What is built, and what is only designed]
Per the code on this context's `develop` branch:

**Built:** three Kafka read-model consumers (`facility-layout`,
`order-management`, `warehouse-planning`); the fail-closed snapshot and the
per-site advisory simulation (`GET /v1/transfer-simulations`); the diagnostic
planner endpoint with explicit positions, policies and lanes
(`POST /v1/transfer-proposals:generate`); the idempotent approval endpoint
(`POST /v1/transfers:approve`); the eleven-state saga with an immutable audit
trail; the transactional outbox and relay; the inventory-storage reply and fact
consumers and the fulfillment-execution fact consumer; `WorkDemandReleased` for
the pick and dispatch legs; read-only transfer REST and a read-only MCP server;
the saga-health analytics stream with its projector and `nip-reports`; the
observe-only scheduled rebalance runs; and the `nip_mfe` console remote.

**Not built (roadmap, from the design plan and the ADRs):** dynamic order-site
assignment (the plan's Phase 5), auto-approval, route or lane optimisation,
demand forecasting and safety-stock models, a persisted lane and policy
catalogue (the scheduled rebalance therefore records zero proposals today),
multi-line transfers (v1 is one line per transfer), cancelling or revoking a
transfer after the origin reservation exists, the `TRANSFER_ARRIVAL` work leg,
and a variance disposition workflow.
:::

:::caution[Spec and wire disagree on one response]
`apis/openapi.yaml` declares the `GET /v1/transfer-simulations` response as
`{asOf, options[]}`, but the handler serves `{advisory, asOf, sites[]}` with
per-site demand, capacity and headroom (and so does the MCP tool). The
generated REST reference on this site follows the spec; the pages here follow
the code. See the [Domain Message Flow](/contexts/network-inventory-planning/domain-message-flow)
and the [Bounded Context Canvas](/contexts/network-inventory-planning/bounded-context-canvas)
for the open question.
:::

## This context's pages

- [Business Context](/contexts/network-inventory-planning/business-context): why
  moving stock between warehouses needed its own context, and what stays
  advisory.
- [Ubiquitous Language](/contexts/network-inventory-planning/ubiquitous-language):
  InterWarehouseTransfer, Proposal, ScoreBreakdown, PlanningSnapshot, SiteCapability,
  SiteSkuDemand, WorkDemand, StuckTransfer, RebalanceRun.
- [Core Domain Chart](/contexts/network-inventory-planning/core-domain-chart)
  ([ddd-crew core-domain-charts](https://github.com/ddd-crew/core-domain-charts)):
  why this context is Core.
- [Bounded Context Canvas](/contexts/network-inventory-planning/bounded-context-canvas)
  ([ddd-crew bounded-context-canvas](https://github.com/ddd-crew/bounded-context-canvas)):
  purpose, roles, inbound and outbound communication, decisions and open questions.
- [Context Map](/contexts/network-inventory-planning/context-map)
  ([ddd-crew context-mapping](https://github.com/ddd-crew/context-mapping)):
  every relationship with its pattern, technology and status.
- [Aggregate Design Canvas](/contexts/network-inventory-planning/aggregate-design-canvas)
  ([ddd-crew aggregate-design-canvas](https://github.com/ddd-crew/aggregate-design-canvas)):
  the `InterWarehouseTransfer` saga aggregate.
- [Domain Events](/contexts/network-inventory-planning/domain-events): the six
  CloudEvents types it emits and the ten it consumes.
- [Domain Message Flow](/contexts/network-inventory-planning/domain-message-flow)
  ([ddd-crew domain-message-flow-modelling](https://github.com/ddd-crew/domain-message-flow-modelling)):
  key scenarios as commands, events and queries.
- [EventStorming](/contexts/network-inventory-planning/eventstorming)
  ([ddd-crew eventstorming-glossary-cheat-sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)):
  process-level boards.
- [Class Diagram](/contexts/network-inventory-planning/class-diagram): the domain
  model as it exists in the code.
- [Entity Relationship](/contexts/network-inventory-planning/entity-relationship):
  the persisted tables, OLTP and analytical.
- [Sequence Diagrams](/contexts/network-inventory-planning/sequence-diagrams): the
  main runtime interactions.
- [Async API](/contexts/network-inventory-planning/async-api): the Kafka
  integration in narrative form.

Unlike most contexts, the pages from Ubiquitous Language to Sequence Diagrams are
**not synced**: the repository has no `docs/docs/ddd/` pack yet, so they were
written here from its code and ADRs (develop `8d25980`) and each says so. The
Business Context and the Async API narrative are hand-written for this site, as
everywhere.

## Surfaces

| Surface | Where | Notes |
| --- | --- | --- |
| REST | `cmd/network-inventory-planning`, `:8080` | seven operations including `/healthz`; Kong route `/api/network-inventory-planning` in the reference deployment; unauthenticated |
| MCP | `cmd/mcp`, `:8090` | four read-only tools: `get_transfer`, `list_transfers`, `find_stuck_transfers`, `simulate_transfer_options`; opt-in in the chart (`mcp.enabled`); unauthenticated |
| Reports | `cmd/nip-reports`, `:8092` | five read-only analytics reports over a separate analytical database, fed by `cmd/nip-projector` (`:8091` admin) |
| Kafka | `warehouse.network-inventory-planning.events` and `.analytics` | CloudEvents 1.0 structured mode through the transactional outbox |
| Console | `nip_mfe` Module Federation remote | gateway path `/mfes/network-inventory-planning/`, dev port 5192; console route `/network-inventory/*` |

## Elsewhere

- **Repository**: [github.com/IQVO/network-inventory-planning](https://github.com/IQVO/network-inventory-planning).
  Its ADRs live under `docs/docs/adr/`, 0001 to 0010 on `develop`.
- [ADR index](/adr): links to this context's own decision records.
- **Generated references on this site**: [REST](/api-reference/rest/network-inventory-planning/network-inventory-planning-api)
  and [AsyncAPI](/api-reference/async/network-inventory-planning), generated from
  the real `apis/openapi.yaml` and `apis/asyncapi.yaml`.
- **Fleet-level**: [Context Map](/strategic-design/context-map) and the
  [Event Standard](/strategic-design/event-standard-cloudevents).
