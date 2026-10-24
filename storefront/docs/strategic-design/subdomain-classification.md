---
id: subdomain-classification
title: Subdomain Classification
sidebar_label: Subdomain Classification
description: "Core, Supporting or Generic: the six storefront bounded contexts, the deferred and later subdomains, and the verdict rationale for each."
---

# Subdomain Classification

:::info[Generated from the model]
This page is generated from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml) by `scripts/gen_pages.py`. Edit the model, then regenerate; CI fails when the page and the model disagree.
:::


Domain-Driven Design splits a domain into **Core**, **Supporting** and
**Generic** subdomains by how much competitive advantage each gives, not by
size or difficulty. The evidence for the verdicts is on
[Benchmarks](/storefront/research/benchmarks).

## Problem space: the subdomains

| Subdomain | What the business must be good at | Verdict | Why |
| --- | --- | --- | --- |
| Pricing & Delivery Charges | Item prices, sale windows, the price of speed per tier, a binding total at purchase | Core | Cost is the top abandonment reason [1]; the tier charge is where the network's promise becomes revenue. |
| Product Discovery | Finding the right purchasable item fast | Supporting | Core candidate at scale; the engine itself is generic. |
| Cart | Holding intent, delivery quote and tier choice per shipment group | Supporting | - |
| Checkout | One purchase transaction across price, payment and the network's promise confirmation | Supporting | - |
| Product Content | Descriptions, media, attributes, categories for an item the network already knows | Generic | Buy a PIM in production. |
| Customer Payments | Authorize, capture, release, refund through a payment provider | Generic | Buy a PSP. |
| Customer Identity | Sign-in, credentials | Generic, deferred | D4: authentication stays off; sign-in is a synthetic shopper lookup by e-mail. |
| Notifications / Returns / Promotions / Reviews / Recommendations | - | Later | Notifications and returns are already network future contexts; promotions, reviews and recommendations are later phases. |

## Solution space: the bounded contexts

Order management and customer accounts are deliberately absent: the network
already owns them (`customer-ordering`). The six contexts map 1:1 onto the
composable-commerce capability lists [18] minus those two.

| Bounded context | Classification | Tier | Business model | Evolution | Aggregates |
| --- | --- | --- | --- | --- | --- |
| `pricing` | <span class="badge-core">Core</span> | `storefront` | Revenue (the price of speed per tier is where the network's promise becomes revenue) | Custom-built | ItemPrice, DeliveryChargeSchedule, TaxTable, PriceQuote |
| `product-content` | <span class="badge-generic">Generic</span> | `storefront` | Engagement enabler (buy a PIM in production) | Commodity | ProductContent, CategoryTree |
| `product-discovery` | <span class="badge-supporting">Supporting</span> | `storefront` | Conversion enabler (finding the right purchasable item fast) | Custom-built | (read side only) |
| `shopping-cart` | <span class="badge-supporting">Supporting</span> | `storefront` | Conversion (holding intent without losing the total-cost-up-front rule) | Custom-built | Cart |
| `checkout` | <span class="badge-supporting">Supporting</span> | `storefront` | Conversion (the purchase transaction) | Custom-built | CheckoutSession |
| `customer-payments` | <span class="badge-generic">Generic</span> | `storefront` | Revenue collection (buy a PSP) | Commodity | PaymentAuthorization, Refund |

Count: 3 Supporting, 2 Generic, 1 Core.

Future contexts named by the model but not built in this phase:

| Context | Classification | Note |
| --- | --- | --- |
| `customer-notifications` | Generic | Adopt the network's future context customer-notification (needs NG7: group status facts as customer-order events) rather than building a storefront twin; it would consume PaymentCaptured, PaymentReleased and RefundIssued. |
| `promotions` | Supporting (candidate) | Coupons and promotions inside pricing; a later phase (D10). |
| `identity` | Generic | Sign-in and credentials; deferred by D4 (no auth). Revisit only if auth is re-adopted for the storefront edge. |
| `reviews-recommendations` | Supporting (candidate) | Reviews and recommendations; later (plan section 7). |

The experience layer (`storefront-bff`, `storefront-web`) and the
`payment-provider-simulator` stand-in carry no domain model and are not
bounded contexts.

