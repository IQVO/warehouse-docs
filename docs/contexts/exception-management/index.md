---
id: index
title: Exception Management
sidebar_label: Exception Management
description: The Supporting, WES-tier bounded context that owns the Problem Solve lifecycle — every case opened by a fact another context published, with dedup, triage, assignment, an SLA clock and declarative auto-resolve.
slug: /contexts/exception-management
---

# Exception Management

<span className="badge-supporting">Supporting Subdomain</span>

**Exception Management** is one of the fleet's domain bounded contexts. It
sits in the `wes` tier of the CloudEvents subdomain taxonomy. On the floor
this work is called **Problem Solve**: the fleet already detects operational
anomalies and publishes them as facts (`TaskCPTMissed`,
`BacklogThresholdBreached`, `AcknowledgementDeadlineAtRisk`,
`OrphanedHoldCancelled`, `DiscrepancyDetected`, `ItemUnlocated`,
`PackageDiverted`, `WeightDiscrepancyDetected`, `UnexpectedReturnReceived`),
but none of them had an owner after it was raised: no triage, no assignee, no
SLA, no resolution, no root cause (its ADR 0001, which quotes
fulfillment-execution's ADR 0033: "the only signal was the domain events").

This context is that owner, consumer-first: every case starts from a fact
another context published. It owns the **ExceptionCase** (exactly one open
case per dedup key — source type, source subject, site — with a fixed status
machine, an SLA clock and an audit trail of every transition) and the
**ExceptionPolicy** (per source type: severity, queue, SLA minutes, and a
declarative auto-resolve rule). It never writes to a producer.

:::info[What is built, what is deployed, and what is planned]
Per this context's ADRs and `apis/asyncapi.yaml` on `develop`, checked
2026-10-21:

**Built on `develop`:** the REST API (eight operations plus a deliberate
`405` stub on `POST /exceptions` — cases are never created over REST), a
transactional outbox with relay (delete-on-publish, attempt cap, dead-letter
topic, its ADR 0005), **six** Kafka consumers (the exception facts of six
sibling contexts plus the `OrderRepromised` correlation consumer, always on,
group ids from six mandatory env vars), an SLA sweep ticker
(`SLA_SWEEP_INTERVAL`, default 1m), a read-only MCP server (`cmd/mcp`:
`list_open_exceptions`, `get_exception`, `get_sla_report`,
`get_exception_policies`), a Helm chart and a Dockerfile. Both service PRs
are merged: `feature/service` (#2) and `feature/packaging-and-mcp` (#3).

**Not deployed.** `warehouse-infra` `develop` has no entry for it, so nothing
runs in the reference cluster.

**Built around it, checked on each sibling's `develop`:** every consumed type
is published on an integration topic — `TaskCPTMissed` (K16), `OrderRepromised`
(K16), `BacklogThresholdBreached` (the work-planning topic),
`AcknowledgementDeadlineAtRisk` and `OrphanedHoldCancelled`
(network-fulfillment), and, promoted on 2026-10-21,
`PackageDiverted` and `WeightDiscrepancyDetected` (fulfillment-execution)
plus `DiscrepancyDetected` and `ItemUnlocated` (inventory-storage).
`returns-processing`, the sixth producer, merged the same day.

**Planned, not built:** the `workforce-management` (`PathUnderstaffed`) and
`network-inventory-planning` (`TransferStuckDetected`) fact sources — both are
analytics-only on their producers today, so those edges are dashed planned in
the fleet [Context Map](/strategic-design/context-map). Also planned: a
`warehouse-ops-agent` client and the console `exceptions_mfe` remote.
:::

Its two aggregates:

- **ExceptionCase** (`internal/domain/exceptioncase`, the richest aggregate
  and the mutation-gate package): `OPEN -> TRIAGED -> ASSIGNED -> RESOLVED`,
  with `ESCALATED` a flag, not a state; `RESOLVED` is terminal and needs a
  resolution code; every transition records its actor (operator, policy id or
  `system`); the case holds a frozen copy of the source payload, never a
  reference to re-fetch.
- **ExceptionPolicy** (`internal/domain/exceptionpolicy`): per source type,
  versioned and append-only; the auto-resolve rule is data, not code —
  "close when `<other type>` arrives with the same subject within N minutes".

Read models (projections, never aggregates): open cases by queue, the SLA
report, root-cause frequency.

## This context's pages

- [Business Context](/contexts/exception-management/business-context): the
  gap, what it owns, the lifecycle, and what the context deliberately does
  not do.
- [Ubiquitous Language](/contexts/exception-management/ubiquitous-language):
  problem solve, case, source fact, dedup key, occurrence, queue, SLA clock,
  auto-resolve rule.
- [Bounded Context Canvas](/contexts/exception-management/bounded-context-canvas):
  purpose, classification, roles, communication, decisions.
- [Aggregate Design Canvas](/contexts/exception-management/aggregate-design-canvas):
  the two aggregates with their invariants.
- [Domain Events](/contexts/exception-management/domain-events): the seven
  published events and the eleven consumed types.
- [Async API](/contexts/exception-management/async-api): the Kafka narrative,
  with the generated reference.

These pages are written for this site from the context's own ADRs (0001 to
0005), `.claude/rules/domain-model.md` and `apis/asyncapi.yaml` /
`apis/openapi.yaml` on its `develop`; the repository does not yet ship its own
ddd-crew artifact pack, so there is nothing to sync. When it ships one, these
pages are replaced by synced copies like every other context's.

## Elsewhere

- **Repository**: [github.com/IQVO/exception-management](https://github.com/IQVO/exception-management)
  (Go module path `github.com/claudioed/exception-management`). Its ADRs live
  under `docs/adr/`: 0001 (bounded context), 0002 (aggregates and policy),
  0003 (local copies and consumed contracts), 0004 (CloudEvents envelope and
  type catalogue) and 0005 (outbox relay attempt cap and DLQ), all Accepted
  (2026-10-20/21).
- **Fleet-level**: [Context Map](/strategic-design/context-map) (its six
  producer edges K54 to K59, built on both ends, wired-but-unused, plus the
  dashed planned workforce/NIP edges), the
  [Event Standard](/strategic-design/event-standard-cloudevents)
  (subdomain table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [WES tier](/wms-wes/wes-tier).
