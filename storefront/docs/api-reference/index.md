---
id: index
title: API Reference
sidebar_label: Overview
description: "The REST contracts of the six digital-storefront bounded contexts and of the storefront-bff edge, copied from each service repo's develop branch."
slug: /api-reference
---

# API Reference

The REST contracts (OpenAPI 3.0) of the six storefront context services and of
`storefront-bff`, the only storefront edge. Each file under
`storefront/apis/<repo>/openapi.yaml` is a copy of the service repo's
`apis/openapi.yaml` on `develop` (refreshed 2026-10-27) and is linted here with
Spectral (`storefront/.spectral.yaml`, warn-clean). All seven services are
**built on develop, not deployed**: none has an entry in warehouse-infra's
`terraform/apps.yaml` yet.

Shared conventions, as the specs state them: errors are RFC 9457 problem
details (`application/problem+json`); every write accepts an
`Idempotency-Key` header (product-discovery is read-only); one configured
currency with integer minor units; no authentication.

| Service | Contract | Source |
| --- | --- | --- |
| `pricing` | [Pricing API](/storefront/api-reference/rest/pricing/pricing-api) | [`apis/openapi.yaml`](https://github.com/IQVO/pricing/blob/develop/apis/openapi.yaml) |
| `product-content` | [Product Content API](/storefront/api-reference/rest/product-content/product-content-api) | [`apis/openapi.yaml`](https://github.com/IQVO/product-content/blob/develop/apis/openapi.yaml) |
| `product-discovery` | [Product Discovery API](/storefront/api-reference/rest/product-discovery/product-discovery-api) | [`apis/openapi.yaml`](https://github.com/IQVO/product-discovery/blob/develop/apis/openapi.yaml) |
| `shopping-cart` | [Shopping Cart API](/storefront/api-reference/rest/shopping-cart/shopping-cart-api) | [`apis/openapi.yaml`](https://github.com/IQVO/shopping-cart/blob/develop/apis/openapi.yaml) |
| `checkout` | [Checkout API](/storefront/api-reference/rest/checkout/checkout-api) | [`apis/openapi.yaml`](https://github.com/IQVO/checkout/blob/develop/apis/openapi.yaml) |
| `customer-payments` | [Customer Payments API](/storefront/api-reference/rest/customer-payments/customer-payments-api) | [`apis/openapi.yaml`](https://github.com/IQVO/customer-payments/blob/develop/apis/openapi.yaml) |
| `storefront-bff` (edge) | [Storefront BFF API](/storefront/api-reference/rest/storefront-bff/storefront-bff-api) | [`apis/openapi.yaml`](https://github.com/IQVO/storefront-bff/blob/develop/apis/openapi.yaml) |

The customer-payments spec dropped its design-time "(proposed)" title and version on
2026-10-27 (customer-payments#6), so its generated page is at the plain slug.

The event contracts (`apis/asyncapi.yaml` in each context repo) are not
rendered here: the section's events live in the
[model](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml)
and on each context's Domain Events page. `payment-provider-simulator` has its
own REST contract in its repo; it stands in for an external provider and is not
a storefront API, see [Edge and supporting components](/storefront/components).

The network contracts the storefront consumes (only the OHS storefront
routes) are under [network/api-reference](/network/api-reference).
