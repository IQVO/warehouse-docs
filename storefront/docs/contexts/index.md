---
id: index
title: Bounded Contexts
sidebar_label: Overview
description: "The six digital-storefront bounded contexts at a glance, each with its ddd-crew pack."
slug: /contexts
---

# Bounded Contexts

The six storefront contexts, all derived from
[`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml):

| Context | Classification | Tier | Aggregates | Events published | Events consumed |
| --- | --- | --- | --- | --- | --- |
| [`pricing`](/storefront/contexts/pricing) | <span class="badge-core">Core</span> | `storefront` | 4 (ItemPrice, DeliveryChargeSchedule, TaxTable, PriceQuote) | 5 | 2 |
| [`product-content`](/storefront/contexts/product-content) | <span class="badge-generic">Generic</span> | `storefront` | 2 (ProductContent, CategoryTree) | 3 | 2 |
| [`product-discovery`](/storefront/contexts/product-discovery) | <span class="badge-supporting">Supporting</span> | `storefront` | 0 (read side: ProductView, CategoryView) | 0 | 11 |
| [`shopping-cart`](/storefront/contexts/shopping-cart) | <span class="badge-supporting">Supporting</span> | `storefront` | 1 (Cart) | 4 (analytics) | 7 |
| [`checkout`](/storefront/contexts/checkout) | <span class="badge-supporting">Supporting</span> | `storefront` | 1 (CheckoutSession) | 5 | 0 |
| [`customer-payments`](/storefront/contexts/customer-payments) | <span class="badge-generic">Generic</span> | `storefront` | 2 (PaymentAuthorization, Refund) | 7 | 5 |

**Every storefront context carries its ddd-crew pack.** The 14-page pack
(business context, ubiquitous language, core domain chart, bounded context
canvas, context map, aggregate design canvas, domain events, domain message
flow, EventStorming, use cases, class diagram, entity relationship and
sequence diagrams) that each network context carries under
[network/contexts](/network/contexts) exists for all six contexts, each
written strictly from the model:
[`pricing`](/storefront/contexts/pricing),
[`product-content`](/storefront/contexts/product-content),
[`product-discovery`](/storefront/contexts/product-discovery),
[`shopping-cart`](/storefront/contexts/shopping-cart),
[`checkout`](/storefront/contexts/checkout) and
[`customer-payments`](/storefront/contexts/customer-payments). The generated
[strategic-design pages](/storefront/strategic-design) hold the cross-context
view.

Future contexts named by the model but not built in this phase:
`customer-notifications` (adopt the network's future `customer-notification`
once NG7 ships), `promotions`, `identity` (deferred, D4),
`reviews-recommendations`.
