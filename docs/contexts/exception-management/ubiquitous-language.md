---
id: ubiquitous-language
title: Ubiquitous language
sidebar_label: Ubiquitous language
description: The exact vocabulary of exception-management — problem solve, case, source fact, dedup key, occurrence, queue, severity, SLA clock, escalation, resolution code, root cause, auto-resolve rule.
---

# Ubiquitous language

The terms of the context, from its `.claude/rules/domain-model.md` and
`internal/domain/*` on `develop` (the repository does not ship its own
ddd-crew pack yet; this page is written for this site and follows that rule
file's exact names).

| Term | Meaning |
| --- | --- |
| Problem solve | The floor name of the work this context owns: giving every detected anomaly an owner and an outcome |
| ExceptionCase (case) | One owned anomaly with a lifecycle; exactly one open case per dedup key |
| Source fact | The producer's event that opened or touched the case; its payload is frozen on the case |
| Dedup key | (source type, source subject, site); a repeated fact touches the open case instead of opening another |
| Occurrence | One arrival of the source fact; the case counts them and keeps `lastSeenAt` |
| Queue / severity | Triage outcome, from the policy or an operator (`ps-main`, `ps-expedite` in the examples; `HIGH`, `MEDIUM`, ...) |
| SLA clock | `openedAt + policy.slaMinutes`; breach sets the `ESCALATED` flag |
| Escalation | The breach flag and its `ExceptionEscalated` event; work continues, it is not a state |
| Resolution code / root cause | Mandatory on resolve (e.g. `STOCK_FOUND` / `COUNT_ERROR`); `RESOLVED` is terminal |
| ExceptionPolicy | Per source type: default severity, queue, SLA minutes, auto-resolve rule; append-only versions |
| Auto-resolve rule | Declarative: "close when `<other type>` arrives with the same subject within N minutes"; data, not code |
| rule_id | The derived deterministic form `<sourceType>-><onType>` carried by `ExceptionAutoResolved` |
| Correlated fact | The other type the auto-resolve rule waits for (e.g. `OrderRepromised` for a `TaskCPTMissed` case) |
| Actor | Who made a transition: an operator id, a policy id or `system` |
| Frozen payload | The source event's `data` stored verbatim on the case, never re-fetched |
| Claim | The CloudEvents `id` row (`processed_events`) claimed in the same transaction as a consumer's effect, making it idempotent |
| Outbox | The transactional table of already-encoded CloudEvents waiting for the relay |
| Dead letter | A message moved to `<topic>.dlq` after bounded retries (transient) or at once (poison), with `x-dlq-*` headers |
