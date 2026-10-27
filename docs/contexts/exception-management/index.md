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
Per this context's ADRs, `apis/` and `cmd/` on `develop` (`2222e44`) and
`warehouse-infra` `develop`, checked 2026-10-26:

**Built on `develop`:** the REST API (eleven path × method pairs in
`apis/openapi.yaml`, including `/healthz`, `/readyz` and `/metrics`, and a
deliberate `405` on `POST /exceptions` — cases are never created over REST),
a transactional outbox with relay (delete-on-publish, attempt cap,
dead-letter topic, its ADR 0005), **seven** Kafka consumers (the exception
facts of six sibling contexts — `inbound-receiving`'s
`CartonDiscrepancyRaised` joined with ADR 0006 — plus the `OrderRepromised`
correlation consumer, always on, group ids from seven mandatory env vars), an
SLA sweep ticker (`SLA_SWEEP_INTERVAL`, default 1m), the analytics read side
(`cmd/exceptions-projector`, `cmd/exceptions-reports`), a read-only MCP
server (`cmd/mcp`: `list_open_exceptions`, `get_exception`, `get_sla_report`,
`get_exception_policies`), the console remote `exceptions_mfe`, a Helm chart
and a Dockerfile.

**Wired in `warehouse-infra` `develop`:** `terraform/apps.yaml` registers it
(database, analytics database, `frontend_remote: exceptions_mfe`), and
`helm-values/exception-management.yaml` pins six of the seven consumer groups
(the carton-discrepancy group comes from the chart default
`exception-management-carton-discrepancy`), the SLA sweep interval, the
analytics projector and the MCP server. `warehouse-ops-agent` has an MCP
client for it (`internal/adapters/outbound/mcpclient/exception_management.go`).
The kind cluster was not checked.

**Around it, checked on each sibling's `develop`:** every consumed type
is published on an integration topic — `TaskCPTMissed`, `PackageDiverted` and
`WeightDiscrepancyDetected` (fulfillment-execution), `OrderRepromised`
(order-management), `BacklogThresholdBreached` (the work-planning topic),
`AcknowledgementDeadlineAtRisk` and `OrphanedHoldCancelled`
(network-fulfillment), `DiscrepancyDetected` and `ItemUnlocated`
(inventory-storage), `UnexpectedReturnReceived` (returns-processing) and
`CartonDiscrepancyRaised` (inbound-receiving).

**Planned, not built:** the `workforce-management` (`PathUnderstaffed`) and
`network-inventory-planning` (`TransferStuckDetected`) fact sources — both are
analytics-only on their producers today and no consumer exists, so those
edges are dashed planned in the fleet [Context Map](/strategic-design/context-map).
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

The [Business Context](/contexts/exception-management/business-context) and
[Async API](/contexts/exception-management/async-api) pages are written for
this site. Every other page in this context's sidebar is synced from the
repository's own `docs/docs` on `develop`: the full ddd-crew pack (ubiquitous
language, core domain chart, canvases, context map, domain events, message
flow, EventStorming, class, entity-relationship and sequence diagrams), the
use cases and the Operations group (configuration, runbook, observability,
troubleshooting, testing). The REST reference is generated from its
`apis/openapi.yaml`
([REST](/api-reference/rest/exception-management/exception-management-api)).

## Elsewhere

- **Repository**: [github.com/IQVO/exception-management](https://github.com/IQVO/exception-management)
  (Go module path `github.com/claudioed/exception-management`). Its ADRs live
  under `docs/adr/`: 0001 (bounded context), 0002 (aggregates and policy),
  0003 (local copies and consumed contracts), 0004 (CloudEvents envelope and
  type catalogue), 0005 (outbox relay attempt cap and DLQ) and 0006 (carton
  discrepancy consumer and routing).
- **Fleet-level**: [Context Map](/strategic-design/context-map) (its producer edges K54 to K59 and K66, built on both ends and wired in
  `warehouse-infra` `develop`, so live, plus the dashed planned
  workforce/NIP edges K60 and K61), the
  [Event Standard](/strategic-design/event-standard-cloudevents)
  (subdomain table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [WES tier](/wms-wes/wes-tier).
