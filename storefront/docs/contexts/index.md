---
id: index
title: Bounded Contexts
sidebar_label: Overview
description: "The six digital-storefront bounded contexts at a glance; the per-context ddd-crew packs are a later wave."
slug: /contexts
---

# Bounded Contexts

The six storefront contexts, all derived from
[`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml):

| Context | Classification | Tier | Aggregates | Events published | Events consumed |
| --- | --- | --- | --- | --- | --- |
| `pricing` | <span class="badge-core">Core</span> | `storefront` | 4 (ItemPrice, DeliveryChargeSchedule, TaxTable, PriceQuote) | 5 | 2 |
| `product-content` | <span class="badge-generic">Generic</span> | `storefront` | 2 (ProductContent, CategoryTree) | 3 | 2 |
| `product-discovery` | <span class="badge-supporting">Supporting</span> | `storefront` | 0 (read side: ProductView, CategoryView) | 0 | 11 |
| `shopping-cart` | <span class="badge-supporting">Supporting</span> | `storefront` | 1 (Cart) | 4 (analytics) | 7 |
| `checkout` | <span class="badge-supporting">Supporting</span> | `storefront` | 1 (CheckoutSession) | 5 | 0 |
| `customer-payments` | <span class="badge-generic">Generic</span> | `storefront` | 2 (PaymentAuthorization, Refund) | 7 | 5 |

**The per-context packs are not in this wave.** The 14-page ddd-crew pack
(business context, ubiquitous language, core domain chart, bounded context
canvas, context map, aggregate design canvas, domain events, domain message
flow, EventStorming, use cases, class diagram, entity relationship and
sequence diagrams) that each network context carries under
[network/contexts](/network/contexts) lands for the storefront contexts in a
later wave, written strictly from the model. Until then the canonical detail
is the model itself plus the generated
[strategic-design pages](/storefront/strategic-design).

Future contexts named by the model but not built in this phase:
`customer-notifications` (adopt the network's future `customer-notification`
once NG7 ships), `promotions`, `identity` (deferred, D4),
`reviews-recommendations`.
