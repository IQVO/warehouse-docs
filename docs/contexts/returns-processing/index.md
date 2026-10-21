---
id: index
title: Returns Processing
sidebar_label: Returns Processing
description: The Supporting, WMS-tier bounded context that owns the reverse flow of goods — RMA authorization against a shipped order line, return receipt and inspection grading, the disposition decision, and the staged handover of restockable units back to inventory-storage.
slug: /contexts/returns-processing
---

# Returns Processing

<span className="badge-supporting">Supporting Subdomain</span>

**Returns Processing** is one of the fleet's domain bounded contexts. It sits
in the `wms` tier of the CloudEvents subdomain taxonomy, the seventh `wms`
context after `facility-layout`, `inventory-storage`, `product-master`,
`inbound-receiving`, `slotting-optimization` and `pick-face-replenishment`.
Before it existed, no context owned goods coming back: a returned parcel had
no authorization, no receipt, no grading and no decision about what happens to
it (its ADR 0001). This context owns that reverse flow end to end:

- the **ReturnAuthorization** (RMA): permission to send a *shipped* order line
  back, authorized against local copies of what was allocated and what was
  manifested, inside a policy return window;
- the **ReturnReceipt**: the physical arrival, every line matched to an RMA or
  explicitly `UNEXPECTED`;
- the inspection **grade** (`A`, `B`, `C`, `SCRAP`) and the **Disposition**:
  the immutable policy outcome per inspected line (`RESTOCK`, `REFURBISH`,
  `LIQUIDATE`, `DISPOSE`, `RTV`), recorded with the policy version used.

It never writes the stock ledger: a `RESTOCK` disposition hands the goods to
`inventory-storage` as a staged line (`ReturnLineStaged`, the same shape as
inbound-receiving's `ReceiptLineReceived` plus three return fields), and the
stow stays an RF action there. An `UNEXPECTED` receipt line is published as
`UnexpectedReturnReceived`, which `exception-management` turns into a
problem-solve case.

:::info[What is built, what is deployed, and what is planned]
Per this context's ADRs and `apis/asyncapi.yaml` on `develop`, checked
2026-10-21:

**Built on `develop`:** the REST API (ten operations), a transactional outbox
with relay, **three** Kafka consumers (product classifications, allocated
order lines, manifested work units — always on, each group id from a mandatory
env var), a read-only MCP server (`cmd/mcp`: `get_return`,
`list_returns_by_order`, `get_disposition_policy`), a Helm chart and a
Dockerfile. Both service PRs are merged: `feature/service` (#2) and
`feature/packaging-and-mcp` (#3).

**Not deployed.** `warehouse-infra` `develop` has no entry for it (no values
file, Kong route or ArgoCD application), so nothing runs in the reference
cluster and no edge to or from it is exercised.

**Built around it, checked on each sibling's `develop`:** all three consumed
types are published by live producers (`ProductClassified` is K20,
`OrderAllocated`/`OrderPartiallyAllocated` is K1, `PackageManifested` is K16),
and the two output edges are built on both ends: `inventory-storage` ADR 0044
consumes `ReturnLineStaged` into the same staged-receipt seam as inbound
receipts (`BookReturnLine` in front of `ReceiveStock`), and
`exception-management` (merged the same day) consumes
`UnexpectedReturnReceived` as a problem-solve fact.

**Planned, not built:** the analytics mirror
(`warehouse.returns-processing.analytics`, declared planned in its ADR 0004),
the shipped-quantity check (order-management released lines carry no
`quantity`; v1 caps by `DispositionPolicy.max_units_per_line`), a
`warehouse-ops-agent` client, and a console remote.
:::

It owns four aggregates:

- **ReturnAuthorization** (`internal/domain/returnauthorization`): status
  machine `REQUESTED -> AUTHORIZED | REJECTED -> RECEIVED -> CLOSED`, one open
  RMA per (orderRef, lineNo), authorizable only against a manifested work unit
  inside the window, quantity capped by policy.
- **ReturnReceipt** (`internal/domain/returnreceipt`): every line references
  an RMA line or is `UNEXPECTED`; inspected quantity never exceeds received; a
  line is inspected exactly once.
- **Disposition** (`internal/domain/disposition`, the richest aggregate):
  outcome = the pure function `Decide(grade, classification, policy)`,
  immutable — an operator override creates a *superseding* Disposition with a
  mandatory reason; `RESTOCK` only for grades A/B and never for a
  `DISPOSE`-classified SKU.
- **DispositionPolicy** (`internal/domain/disposition`): the versioned
  operator table (grade x product class -> outcome, return window days, max
  units per line), append-only.

Read models (projections, never aggregates): allocated order lines,
manifested work units, product classifications.

## This context's pages

- [Business Context](/contexts/returns-processing/business-context): the gap,
  what it owns, the v1 policy, and what the context deliberately does not do.
- [Ubiquitous Language](/contexts/returns-processing/ubiquitous-language):
  RMA, return receipt, grade, disposition, staged line, unexpected return.
- [Bounded Context Canvas](/contexts/returns-processing/bounded-context-canvas):
  purpose, classification, roles, communication, decisions.
- [Aggregate Design Canvas](/contexts/returns-processing/aggregate-design-canvas):
  the four aggregates with their invariants.
- [Domain Events](/contexts/returns-processing/domain-events): the seven
  published events and the four consumed types.
- [Async API](/contexts/returns-processing/async-api): the Kafka narrative,
  with the generated reference.

These pages are written for this site from the context's own ADRs (0001 to
0004), `.claude/rules/domain-model.md` and `apis/asyncapi.yaml` /
`apis/openapi.yaml` on its `develop`; the repository does not yet ship its own
ddd-crew artifact pack, so there is nothing to sync. When it ships one, these
pages are replaced by synced copies like every other context's.

## Elsewhere

- **Repository**: [github.com/IQVO/returns-processing](https://github.com/IQVO/returns-processing)
  (Go module path `github.com/claudioed/returns-processing`). Its ADRs live
  under `docs/adr/`: 0001 (bounded context), 0002 (aggregates and policy),
  0003 (local copies and consumed contracts) and 0004 (CloudEvents envelope
  and type catalogue), all Accepted (2026-10-20/21).
- **Fleet-level**: [Context Map](/strategic-design/context-map) (its inbound
  edges K50 to K52 and outbound edges K53 and K54, all built on both ends,
  wired-but-unused), the
  [Event Standard](/strategic-design/event-standard-cloudevents)
  (subdomain table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [WMS tier](/wms-wes/wms-tier).
