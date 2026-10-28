---
id: model-gap-register
title: Model Gap Register
sidebar_label: Model Gap Register
description: "The storefront model gaps S1-S6, their resolutions decided in Phase 1, and the develop evidence that five of them are built; S6 stays out of scope by design."
---

# Model Gap Register

The storefront model was transcribed from the plan's sections 3-5 strictly.
Where the plan itself named an open question, it was registered here with the
plan's resolution. The network-side gaps the storefront depends on (NG1-NG8)
live in the network's
[Model Gap Register](/network/strategic-design/model-gap-register) as G56-G63.

**Status, 2026-10-27:** S1-S5 are **Built**: each resolution is in
`model/model.yaml` and implemented on the owning service's `develop` branch
(evidence column; none of the services is deployed yet). S6 is out of scope by
design. A new gap is closed only when `model/model.yaml` (or the network model,
for the NG rows) changes, `python3 storefront/scripts/check_model.py --pages`
passes, and the owning service implements it.

Severity:

| Severity | Meaning |
| --- | --- |
| **S1** | A cross-context flow cannot work as modelled. |
| **S2** | A race or failure path has no compensation. |
| **S3** | Incomplete inside one context. |
| **S4** | Out of scope by design; recorded so it is not re-litigated. |

| # | Gap | Severity | Resolution | Status | Evidence on develop |
| --- | --- | --- | --- | --- | --- |
| S1 | Who maps quote groups to checkout lines. | S1 | Cart invariant "one line per item"; quote groups name items; checkout numbers lines 1..n and groups by quote `groupNo`. | **Built** | shopping-cart `internal/domain/cart/cart.go` (adding an item already in the cart merges quantities); checkout `internal/application/usecases/open_session.go` (`LineNo: i + 1`) and checkout ADR 0002 (contracts-delta S1). |
| S2 | Price change between cart and checkout. | S2 | Binding PriceQuote at session open; the review page shows the binding total; a changed total is visible before confirm. | **Built** | pricing `internal/domain/quote/quote.go` (`PriceQuote`, ISSUED/EXPIRED by `expiresAt`); checkout ADR 0002 (confirming after `quoteExpiresAt` is 422 `price-quote-expired`). |
| S3 | Requote after authorization. | S2 | Pre-check offers before authorizing; on a late `offer-not-quotable`, void then REQUOTE_REQUIRED. | **Built** | checkout ADR 0002 (S3: pre-check, then void and REQUOTE_REQUIRED; A9 `GetDeliveryOffer` before the aggregate decides); `internal/adapters/outbound/deliverypromise`. |
| S4 | Event order across topics (payments). | S2 | Park fulfilment facts for an unbound order; apply on `CheckoutCompleted`. | **Built** | customer-payments `internal/application/parked/parked.go` and the `parked_facts` table (migration 0001); facts unknown after 24 h are dead-lettered (`apis/asyncapi.yaml`). |
| S5 | Projection rebuild beyond topic retention. | S3 | Snapshot via the OHS reads (each row carries `updatedAt`, seeded into the per-key guard), then events. | **Built** | product-discovery `cmd/rebuild` and `internal/application/usecases/rebuild.go` (ADR 0003). |
| S6 | Out-of-stock purchase (benchmark [5]). | S4 | Not possible in this network; shown as unavailable; recorded as a future idea. | **Kept by decision** | Out of scope by design. |

## How a gap gets closed

1. Edit `storefront/model/model.yaml`.
2. Run `python3 storefront/scripts/check_model.py --pages` and
   `python3 storefront/scripts/gen_pages.py`.
3. Update the affected pages and OpenAPI files.
4. Mark the row **Built** with the develop evidence once the owning service
   implements it.
