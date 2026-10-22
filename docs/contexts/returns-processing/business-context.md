---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why the reverse flow of goods is its own bounded context — RMA authorization against a shipped line, receipt and grading, the disposition decision, the RESTOCK handover, and what the context deliberately does not do.
---

# Business Context

Written here from the context's ADRs under `docs/adr/` in
[IQVO/returns-processing](https://github.com/IQVO/returns-processing) (0001 to
0004), its `.claude/rules/domain-model.md`, and its `apis/openapi.yaml` /
`apis/asyncapi.yaml`, all checked against `develop` on 2026-10-21.

## The gap

`inbound-receiving` owns ASNs, dock appointments and receipts for *supplier*
inbound. `inventory-storage` owns the stock ledger and only learns about new
stock through a staged receipt line followed by an RF stow.
`order-management` owns the order and its promise; `fulfillment-execution`
ships packages. A returned parcel had no owner: no authorization, no receipt,
no grading and no decision — either hand-keyed as a supplier receipt (wrong
provenance, no audit) or lost.

Returns are a decision-driven flow, not a receiving variant: the decision
(restock, refurbish, liquidate, dispose, return to vendor) depends on an
inspection grade, the product's classification and a policy, and only ONE of
those outcomes touches the ledger. That lifecycle and its policy object belong
to a context of their own (ADR 0001). Returns run 20-30 % of e-commerce
volume, so value recovery is material — but the differentiator is the ledger
the flow feeds, which is why the context is **Supporting**, not Core.

## What it owns

| Fact | Value |
| --- | --- |
| Subdomain class | **Supporting** (ADR 0001) |
| Tier | **WMS** (CloudEvents subdomain segment `wms`, the seventh `wms` context) |
| Aggregates | `ReturnAuthorization`, `ReturnReceipt`, `Disposition` and `DispositionPolicy` (ADR 0002) |
| Binaries | two: `cmd/api` (REST, three Kafka consumers, the outbox relay) and `cmd/mcp` (read-only MCP server over the read use cases) |
| Data store | one Postgres database (embedded migrations). `DATABASE_URL` and `KAFKA_BROKERS` are mandatory; real Postgres and real Kafka only, no in-memory runtime |
| Kafka | publishes `warehouse.returns-processing.events` (the analytics mirror is planned, not built); consumes `warehouse.product-master.events`, `warehouse.order-management.events`, `warehouse.fulfillment.events` (ADR 0003) |
| Auth | none (fleet-wide decision) |

## The flow

1. **Authorize.** `POST /returns` asks for an RMA on an (order, line). The
   use case checks its local copies: the line was allocated
   (`OrderAllocated` / `OrderPartiallyAllocated`) AND a package was manifested
   for its work unit (`PackageManifested`, whose `order_ref`
   `{order_id}-line-{line_no}` is reversed into the (order, line) key), the
   return window is open and no other RMA is open for the line. The answer is
   `ReturnAuthorized` (with `window_ends_at`) or `ReturnAuthorizationRejected`
   with `LINE_NOT_MANIFESTED`, `RETURN_WINDOW_EXPIRED`, `OPEN_RMA_EXISTS` or
   `QUANTITY_EXCEEDS_POLICY`. The quantity is capped by
   `DispositionPolicy.max_units_per_line`; order-management's allocated lines
   carry no quantity, so the shipped-quantity check is planned, not built
   (ADR 0003).
2. **Receive.** `POST /returns/{rmaId}/receipts` opens a ReturnReceipt. Every
   line references an RMA line or is explicitly `UNEXPECTED` — there is no
   silent third state — and each `UNEXPECTED` line also raises
   `UnexpectedReturnReceived` for `exception-management`.
3. **Inspect.** `POST /receipts/{receiptId}/lines/{lineNo}/inspect` records
   the grade (`A`, `B`, `C`, `SCRAP`) with reason codes; a line is inspected
   exactly once, and the disposition is decided in the same transaction.
4. **Dispose.** `DispositionDecided` records the pure function
   `Decide(grade, classification, policy version)` — or an operator override
   (`POST /dispositions/{dispositionId}/override`), which creates a
   *superseding* Disposition with a mandatory reason. All five outcomes are
   recorded; only `RESTOCK` has a downstream effect.
5. **Restock.** A `RESTOCK` raises `ReturnLineStaged` exactly once:
   `inventory-storage` books it as staged, not-yet-usable stock through the
   same seam as an inbound receipt line (its ADR 0044), and the stow stays an
   RF action there. The other four outcomes never touch the ledger.

## What it deliberately does not do (v1)

- No carrier label or pickup booking (an external party; would need an ACL
  like network-fulfillment's).
- No refund or credit issuing (finance, not warehouse).
- No refurbishment work orders (if ever, a `fulfillment-execution` task type,
  not this context).
- Never writes `StockUnit` or `Bin` — the ledger stays in
  `inventory-storage`.
- No live REST or MCP lookup of a sibling at request time, ever: everything
  it needs arrives as events into local copies.

## Verification

Mutation gate over every domain package (measured 100/100 per the fleet plan);
a golden exact-JSON test per published type; godog scenarios
(`features/returns.feature`, `features/receipt.feature`,
`features/disposition.feature`) for the RMA -> receipt -> inspect ->
disposition -> staged path and the unexpected-return path; and an end-to-end
integration test on real Postgres + Kafka (testcontainers) driven only through
Kafka and REST, which publishes the producers' exact CloudEvents to prove the
consumers (apply, dedupe, version gate, unknown-type skip, flat-envelope
WARN + commit-past, poison dead-letter).
