---
id: index
title: API Reference
sidebar_label: Overview
description: "The proposed REST contracts of the six digital-storefront bounded contexts."
slug: /api-reference
---

# API Reference

Proposed REST contracts per context (OpenAPI 3.0, linted with Spectral).
Nothing is built yet. Shared conventions: RFC 9457 problem details
(`application/problem+json`, type `/problems/<slug>`) with the shared types
`not-found` (404), `illegal-transition` (409), `concurrent-update` (409) and
`validation-failed (422)`; `Idempotency-Key` on every write; one configured
currency with integer minor units; no authentication.

| Context | Contract |
| --- | --- |
| `pricing` | [Pricing API](/storefront/api-reference/rest/pricing/pricing-api-proposed) |
| `product-content` | [Product Content API](/storefront/api-reference/rest/product-content/product-content-api-proposed) |
| `product-discovery` | [Product Discovery API](/storefront/api-reference/rest/product-discovery/product-discovery-api-proposed) |
| `shopping-cart` | [Shopping Cart API](/storefront/api-reference/rest/shopping-cart/shopping-cart-api-proposed) |
| `checkout` | [Checkout API](/storefront/api-reference/rest/checkout/checkout-api-proposed) |
| `customer-payments` | [Customer Payments API](/storefront/api-reference/rest/customer-payments/customer-payments-api-proposed) |

The network contracts the storefront consumes (only the OHS storefront
routes) are under [network/api-reference](/network/api-reference).
