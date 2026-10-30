---
id: index
title: Bounded Contexts
sidebar_label: Overview
description: "The six digital-storefront bounded contexts at a glance: classification, aggregates, events, and the service each is built as on develop (not deployed)."
slug: /contexts
---

# Bounded Contexts

The six storefront contexts, all derived from
[`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml)
and each **built on develop, not deployed**. Counts are recomputed from the
model, which the 2026-10-27 as-built check aligned with each repo's
`apis/asyncapi.yaml` (no event added or removed in any context):

| Context | Classification | Tier | Aggregates | Events published | Events consumed |
| --- | --- | --- | --- | --- | --- |
| [`pricing`](/storefront/contexts/pricing) | <span class="badge-core">Core</span> | `storefront` | 4 (ItemPrice, DeliveryChargeSchedule, TaxTable, PriceQuote) | 5 (4 integration, 1 analytics) | 2 |
| [`product-content`](/storefront/contexts/product-content) | <span class="badge-generic">Generic</span> | `storefront` | 2 (ProductContent, CategoryTree) | 3 (3 integration) | 2 |
| [`product-discovery`](/storefront/contexts/product-discovery) | <span class="badge-supporting">Supporting</span> | `storefront` | 0 (read side: ProductView, CategoryView) | 0 | 11 |
| [`shopping-cart`](/storefront/contexts/shopping-cart) | <span class="badge-supporting">Supporting</span> | `storefront` | 1 (Cart) | 4 (4 analytics) | 7 |
| [`checkout`](/storefront/contexts/checkout) | <span class="badge-supporting">Supporting</span> | `storefront` | 1 (CheckoutSession) | 7 (1 integration, 6 analytics) | 0 |
| [`customer-payments`](/storefront/contexts/customer-payments) | <span class="badge-generic">Generic</span> | `storefront` | 2 (PaymentAuthorization, Refund) | 8 (8 integration) | 6 |

Integration events go to `retailnetwork.<context>.events`, analytics-only facts
to `retailnetwork.<context>.analytics`, all as CloudEvents 1.0 in structured mode.

## The services

| Repo | develop | Binaries | Tier-2 business counter | ADRs | Deployment |
| --- | --- | --- | --- | --- | --- |
| [`IQVO/pricing`](https://github.com/IQVO/pricing) | `5a18326` | `cmd/api` | `pricing.quotes.issued` | 5 | not deployed |
| [`IQVO/product-content`](https://github.com/IQVO/product-content) | `2f09dc0` | `cmd/api` | `content.products.published` | 5 | not deployed |
| [`IQVO/product-discovery`](https://github.com/IQVO/product-discovery) | `9c2f945` | `cmd/api`, `cmd/rebuild` | `discovery.searches.served` | 5 | not deployed |
| [`IQVO/shopping-cart`](https://github.com/IQVO/shopping-cart) | `95bc5bc` | `cmd/api` | `cart.lines.added` | 5 | not deployed |
| [`IQVO/checkout`](https://github.com/IQVO/checkout) | `ab4f0e9` | `cmd/api`, `cmd/mcp` | `checkout.sessions.confirmed` | 6 | not deployed |
| [`IQVO/customer-payments`](https://github.com/IQVO/customer-payments) | `530c7cb` | `cmd/api`, `cmd/mcp` | `payments.authorizations.decided` | 4 | not deployed |

None of the six has an entry in warehouse-infra's `terraform/apps.yaml`
(warehouse-infra `develop`, 2026-10-27), so no Helm values, gateway route or
database is provisioned for them yet. The edge (`storefront-bff`), the web app
(`storefront-web`) and the payment provider stand-in
(`payment-provider-simulator`) are on
[Edge and supporting components](/storefront/components); every repo's ADRs are
listed in the [ADR index](/storefront/adr).

**Every storefront context carries its ddd-crew pack.** The 14-page pack
(business context, ubiquitous language, core domain chart, bounded context
canvas, context map, aggregate design canvas, domain events, domain message
flow, EventStorming, use cases, class diagram, entity relationship and
sequence diagrams) that each network context carries under
[network/contexts](/network/contexts) exists for all six contexts:
[`pricing`](/storefront/contexts/pricing),
[`product-content`](/storefront/contexts/product-content),
[`product-discovery`](/storefront/contexts/product-discovery),
[`shopping-cart`](/storefront/contexts/shopping-cart),
[`checkout`](/storefront/contexts/checkout) and
[`customer-payments`](/storefront/contexts/customer-payments). The packs were
written from the model before the services existed; each index page now holds a
*Service and operations* section with the as-built facts, and the pages flag
where the built service differs (the Entity Relationship pages show the
migration's schema). The generated
[strategic-design pages](/storefront/strategic-design) hold the cross-context
view.

Future contexts named by the model but not built in this phase:
`customer-notifications` (adopt the network's future `customer-notification`
once NG7 ships), `promotions`, `identity` (deferred, D4),
`reviews-recommendations`.
