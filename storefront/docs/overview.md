---
id: overview
title: digital storefront
sidebar_label: Overview
description: "An e-commerce storefront on top of the retail network, modelled with Domain-Driven Design as six bounded contexts in a storefront tier, plus a Go BFF and a React SSR web experience."
slug: /
---

# digital storefront

**digital storefront** is a model of an e-commerce storefront: browse and
search, a product page that shows a real delivery date the network has a
feasible, capacity-held path for (priced per delivery tier), a cart, checkout
with payment, and order history with tracking. Its differentiator is **honest
speed**: money moves only when a shipment group actually ships.

It is a **separate domain inside the
[retail-network](/network/) organisation** (in-org, decision D1): it may
consume `retailnetwork.*` topics and call the network's Open Host Service
storefront routes, and it never produces or consumes a `warehouse.*` topic,
never calls an in-org or restricted network route, and never stores PII or
card data (only `shopperId`, `shipToAddressId` and PSP tokens). The network
owns what can be promised and how it is fulfilled; the storefront owns what a
shopper sees and pays.

:::info[Proposed design, docs only]
Nothing on this site is built. The canonical model is
[`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml);
every page is derived from it, and CI gates fail the build when a page names a
message the model does not have or a call the network does not allow.
:::

## The six bounded contexts

| Context | One sentence |
| --- | --- |
| `pricing` | Item prices, sale windows, the delivery charge per tier, a synthetic tax table, and the binding PriceQuote. **Core.** |
| `product-discovery` | The read side of browsing and search (PostgreSQL FTS + pg_trgm): ProductView and CategoryView projections. |
| `shopping-cart` | Holds intent, the delivery quote and the tier choice per shipment group, with a labelled up-front estimate. |
| `checkout` | The purchase saga: authorize before placing, place through the network, settle in-doubt placements by replay. |
| `product-content` | Descriptions, media, attributes and the category tree for items the network already knows. Generic. |
| `customer-payments` | Authorize, capture per shipment group, release, refund and re-authorize through a payment provider. Generic. |

The experience layer — `storefront-bff` (Go, the only storefront edge under
`/api/storefront`) and `storefront-web` (React SSR) — carries no domain model.
`payment-provider-simulator` stands in for the external payment provider.

## How to read this site

1. [Benchmarks](/storefront/research/benchmarks): the third-party research the
   design rules rest on.
2. [Strategic Design](/storefront/strategic-design): subdomain classification,
   context map, ubiquitous language, event standard (generated from the
   model), and the [Model Gap Register](/storefront/strategic-design/model-gap-register)
   (S1-S6).
3. [Bounded Contexts](/storefront/contexts): the six contexts at a glance; the
   14-page ddd-crew packs are a later wave.
4. [API Reference](/storefront/api-reference): the proposed REST contracts.

## Disclaimer

This project is a domain-driven design study. It is not associated with, endorsed by or affiliated with any company, and it uses no company's code, data, logos or trademarks. All names, figures and examples are illustrative or synthetic.
