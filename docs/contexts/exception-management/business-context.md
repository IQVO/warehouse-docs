---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why the Problem Solve lifecycle is its own bounded context — cases from facts, dedup by source, triage/assign/resolve with an SLA clock, declarative auto-resolve, and what the context deliberately does not do.
---

# Business Context

Written here from the context's ADRs under `docs/adr/` in
[IQVO/exception-management](https://github.com/IQVO/exception-management)
(0001 to 0005), its `.claude/rules/domain-model.md`, and its
`apis/openapi.yaml` / `apis/asyncapi.yaml`, all checked against `develop` on
2026-10-21.

## The gap

The fleet detects anomalies and publishes them — but detection is not
handling. After a `TaskCPTMissed` or a `DiscrepancyDetected` was raised,
nobody owned it: no triage, no assignee, no SLA, no resolution code, no root
cause. On the floor this work has a name, **Problem Solve**; in the fleet it
had no model.

A case lifecycle is not the producers' concern (they must stay the single
writer of their own aggregates) and not the console's (a screen is not a
system of record). It is a context of its own, consumer-first: every case
starts from a fact another context published (ADR 0001).

## What it owns

| Fact | Value |
| --- | --- |
| Subdomain class | **Supporting** today; candidate Core once auto-resolution policies and agent recommendations run against it (ADR 0001) |
| Tier | **WES** (CloudEvents subdomain segment `wes`; it shapes operator flow and holds no stock, layout or master data) |
| Aggregates | `ExceptionCase` and `ExceptionPolicy` (ADR 0002) |
| Binaries | four: `cmd/api` (REST, seven Kafka consumers, the SLA sweeper, the outbox relay), `cmd/mcp` (read-only MCP server over the four read use cases), `cmd/exceptions-projector` and `cmd/exceptions-reports` (the analytics read side) |
| Data store | one Postgres database (embedded migrations). `DATABASE_URL` and `KAFKA_BROKERS` are mandatory; real Postgres and real Kafka only |
| Kafka | publishes `warehouse.exception-management.events` and its analytics mirror; consumes the exception facts of six sibling contexts (ADR 0003; `inbound-receiving`'s `CartonDiscrepancyRaised` since ADR 0006) plus the `OrderRepromised` correlation feed |
| Auth | none (fleet-wide decision) |

## The lifecycle

1. **Open (consumer-driven).** A source fact arrives; the dedup key is
   (source type, source subject, site). The first occurrence opens a case
   with the policy's severity, queue and SLA clock, and freezes the source
   payload on the case. A repeated fact — `TaskCPTMissed` re-fires on every
   sweep tick by design — **touches** the open case (occurrence + 1,
   `lastSeenAt`) instead of opening another.
2. **Triage / assign (operator, REST).** `POST /exceptions/{caseId}/triage`
   sets severity and queue; `POST /exceptions/{caseId}/assign` sets an owner.
   Every transition records its actor.
3. **Escalate (sweeper).** A bounded ticker (`SLA_SWEEP_INTERVAL`) compares
   `now` with `openedAt + policy.slaMinutes`; a breach sets the `ESCALATED`
   flag — a flag, not a state: work continues — and raises
   `ExceptionEscalated`.
4. **Resolve (operator, terminal).** `POST /exceptions/{caseId}/resolve`
   needs a resolution code and a root cause; `RESOLVED` is terminal. A source
   fact arriving after resolution touches the case (occurrence, `lastSeenAt`)
   and never reopens it.
5. **Auto-resolve (policy rule, consumer-driven).** The policy may declare
   "close when `<type>` arrives with the same subject within N minutes". The
   built-in case: an `OrderRepromised` for the order behind a `TaskCPTMissed`
   case's `order_ref` (a WES work unit id `{order_id}-line-{line_no}`, order-
   level match, inclusive window edge) closes the case with `rule_id` =
   the derived deterministic form `<sourceType>-><onType>`. A mismatch is a
   no-op: the case stays open, fail-soft.

There is deliberately **no `POST /exceptions`**: the router answers `405`
naming `GET`, because every case is a fact and a manual lane would reopen
"who may assert an anomaly" (a v2 decision).

## What it deliberately does not do (v1)

- No manual case creation.
- No agent-initiated writes (`warehouse-ops-agent` stays zero-write; it reads
  cases and recommends).
- No paging or notifying associates (an external channel, would need an ACL).
- No correlation of cases to labor cost (`labor-performance` may read
  `ExceptionResolved` later).
- No generic workflow engine: the state machine is fixed and small on
  purpose.
- No live REST or MCP lookup of a sibling at request time, ever: the source
  payload is frozen on the case, never re-fetched.

## Verification

Mutation gate over every domain package; a golden exact-JSON test per
published type; godog scenarios (`features/exceptions.feature`,
`features/lifecycle.feature`, `features/sla.feature`,
`features/autoresolve.feature`): fact -> open, repeated fact -> touch,
triage/assign/resolve, SLA breach -> escalated, `OrderRepromised` ->
auto-resolved; and an end-to-end integration test on real Postgres + Kafka
(testcontainers) driven only through Kafka and REST, including the
`OrderRepromised` auto-resolve of a `TaskCPTMissed` case end to end across
both topics and groups.
