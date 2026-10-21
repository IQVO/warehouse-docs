---
id: ubiquitous-language
title: Ubiquitous language
sidebar_label: Ubiquitous language
description: The exact vocabulary of returns-processing — RMA, return receipt, grade, disposition, disposition policy, staged line, unexpected return — from its domain code and ADRs.
---

# Ubiquitous language

The terms of the context, from its `.claude/rules/domain-model.md` and
`internal/domain/*` on `develop` (the repository does not ship its own
ddd-crew pack yet; this page is written for this site and follows that rule
file's exact names).

| Term | Meaning |
| --- | --- |
| ReturnAuthorization (RMA) | Permission to send a shipped order line back; one open RMA per (orderRef, lineNo); carries the authorized quantity and the policy window |
| ReturnReceipt | The physical arrival of returned goods; its lines each reference an RMA line or are explicitly `UNEXPECTED` (never a silent third state) |
| Return line | One (line_no, sku, quantity) of a receipt, with its own nullable `rma_id` |
| Grade | Inspection outcome of a return line: `A`, `B`, `C`, `SCRAP`, with reason codes |
| Disposition | The immutable decision for one inspected line: `RESTOCK`, `REFURBISH`, `LIQUIDATE`, `DISPOSE`, `RTV`; an override creates a superseding Disposition |
| Superseding disposition | The replacement an operator override creates; names the original in `supersedes` and carries a mandatory `reason` |
| DispositionPolicy | Versioned operator table (grade x product class -> outcome, return window days, max units per line); append-only versions |
| Return window | The policy's authorization window; `window_ends_at` = authorized_at + return window days, and the goods must arrive before it |
| Staged line | A `RESTOCK` handed to inventory-storage (`ReturnLineStaged`); the stow stays an RF action there |
| Unexpected return | A received line with no matching RMA; it opens a problem-solve case downstream |
| Reason code | Why an RMA was requested (e.g. `DAMAGED`) or why a line was graded (e.g. `CUSTOMER_DAMAGE`, `like-new`) |
| Rejection code | Why an RMA was refused: `LINE_NOT_MANIFESTED`, `RETURN_WINDOW_EXPIRED`, `OPEN_RMA_EXISTS`, `QUANTITY_EXCEEDS_POLICY` |
| Work unit | WES's per-line id `{order_id}-line-{line_no}`, carried as `PackageManifested.order_ref` and reversed into the (order, line) key this context authorizes against |
| Local copy | An event-fed table this context reads instead of calling a sibling: `product_classifications`, `allocated_order_lines`, `manifested_work_units` |
| Claim | The CloudEvents `id` row (`processed_events`) claimed in the same transaction as a consumer's effect, making it idempotent |
| Outbox | The transactional table of already-encoded CloudEvents waiting for the relay |
| Dead letter | A message moved to `<topic>.dlq` after bounded retries (transient) or at once (poison) |
