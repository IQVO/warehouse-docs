---
id: model-gap-register
title: Model Gap Register
sidebar_label: Model Gap Register
description: "The storefront model gaps S1-S6 with their proposed resolutions, decided in Phase 1; a gap closes only when model/model.yaml changes and the gates pass."
---

# Model Gap Register

The storefront model was transcribed from the plan's sections 3-5 strictly.
Where the plan itself names an open question, it is registered here with the
plan's proposed resolution, marked **Proposed**. The network-side gaps the
storefront depends on (NG1-NG8) live in the network's
[Model Gap Register](/network/strategic-design/model-gap-register) as G56-G63.

**Nothing on this page is settled code.** Each "Proposed resolution" is the
plan's recommendation. A gap is closed only when `model/model.yaml` (or the
network model, for the NG rows) changes and
`python3 storefront/scripts/check_model.py --pages` passes.

Severity:

| Severity | Meaning |
| --- | --- |
| **S1** | A cross-context flow cannot work as modelled. |
| **S2** | A race or failure path has no compensation. |
| **S3** | Incomplete inside one context. |
| **S4** | Out of scope by design; recorded so it is not re-litigated. |

| # | Gap | Severity | Proposed resolution |
| --- | --- | --- | --- |
| S1 | Who maps quote groups to checkout lines. | S1 | **Proposed.** Cart invariant "one line per item"; quote groups name items; checkout numbers lines 1..n and groups by quote `groupNo`. |
| S2 | Price change between cart and checkout. | S2 | **Proposed.** Binding PriceQuote at session open; the review page shows the binding total; a changed total is visible before confirm. |
| S3 | Requote after authorization. | S2 | **Proposed.** Pre-check offers before authorizing; on a late `offer-not-quotable`, void then REQUOTE_REQUIRED. |
| S4 | Event order across topics (payments). | S2 | **Proposed.** Park fulfilment facts for an unbound order; apply on `CheckoutCompleted`. |
| S5 | Projection rebuild beyond topic retention. | S3 | **Proposed.** Snapshot via OHS reads, then events. |
| S6 | Out-of-stock purchase (benchmark [5]). | S4 | **Proposed.** Not possible in this network; shown as unavailable; recorded as a future idea. |

## How a gap gets closed

1. Edit `storefront/model/model.yaml`.
2. Run `python3 storefront/scripts/check_model.py --pages` and
   `python3 storefront/scripts/gen_pages.py`.
3. Update the affected pages and OpenAPI files.
4. Delete the row here.
