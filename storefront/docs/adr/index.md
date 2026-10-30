---
id: index
title: Architecture Decisions
sidebar_label: ADR index
description: "Every ADR of the nine storefront repos (six context services, storefront-bff, storefront-web, payment-provider-simulator), with the Status line copied from each ADR body and a link to the ADR on develop."
slug: /adr
---

# Architecture Decisions

The storefront section holds no ADRs of its own: each decision lives in the repo
that made it. This index lists every ADR on `develop` of the nine storefront repos
(39 ADRs), with the **Status** copied from the ADR body (first sentence) and
a link to the file. ADR bodies are immutable; read them in their repo.

Per repo: `pricing` 5, `product-content` 5, `product-discovery` 5, `shopping-cart` 5, `checkout` 6, `customer-payments` 4, `storefront-bff` 2, `storefront-web` 5, `payment-provider-simulator` 2.

## pricing

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/pricing/blob/develop/docs/adr/0001-pricing-bounded-context.md) | Pricing is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/pricing/blob/develop/docs/adr/0002-pricing-assumptions.md) | Assumptions where the model is silent or ambiguous | Accepted (2026-10-25). |
| [0003](https://github.com/IQVO/pricing/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-model.md) | Consumed contracts and the local CatalogItemView | Accepted (2026-10-25). |
| [0004](https://github.com/IQVO/pricing/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted (2026-10-25). |
| [0005](https://github.com/IQVO/pricing/blob/develop/docs/adr/0005-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-26). |

## product-content

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/product-content/blob/develop/docs/adr/0001-product-content-bounded-context.md) | Product Content is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/product-content/blob/develop/docs/adr/0002-product-content-assumptions.md) | Aggregates, invariants and assumptions | Accepted (2026-10-25). |
| [0003](https://github.com/IQVO/product-content/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-model.md) | Consumed contracts and the local CatalogItemView | Accepted (2026-10-25). |
| [0004](https://github.com/IQVO/product-content/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted (2026-10-25). |
| [0005](https://github.com/IQVO/product-content/blob/develop/docs/adr/0005-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-26). |

## product-discovery

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0001-product-discovery-bounded-context.md) | Product Discovery is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0002-product-discovery-assumptions.md) | Projections, no aggregates, and assumptions | Accepted (2026-10-25). |
| [0003](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0003-consumed-contracts-and-rebuild.md) | Consumed contracts, per-key guards and the snapshot rebuild | Accepted (2026-10-25). |
| [0004](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted (2026-10-25). |
| [0005](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0005-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-26). |

## shopping-cart

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0001-shopping-cart-bounded-context.md) | Shopping Cart is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0002-shopping-cart-assumptions.md) | Aggregates, invariants and assumptions | Accepted (2026-10-25). |
| [0003](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-model.md) | Consumed contracts and the local read models | Accepted (2026-10-25). |
| [0004](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted (2026-10-25). |
| [0005](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0005-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-26). |

## checkout

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/checkout/blob/develop/docs/adr/0001-checkout-bounded-context.md) | Checkout is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/checkout/blob/develop/docs/adr/0002-checkout-assumptions.md) | Aggregate, invariants and assumptions | Accepted (2026-10-25). |
| [0003](https://github.com/IQVO/checkout/blob/develop/docs/adr/0003-synchronous-contracts-and-the-anti-corruption-layer.md) | Synchronous contracts and the Anti-Corruption Layer | Accepted (2026-10-25). |
| [0004](https://github.com/IQVO/checkout/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted (2026-10-25). |
| [0005](https://github.com/IQVO/checkout/blob/develop/docs/adr/0005-mcp-server.md) | A read-only MCP server | Accepted (2026-10-25). |
| [0006](https://github.com/IQVO/checkout/blob/develop/docs/adr/0006-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-26). |

## customer-payments

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/customer-payments/blob/develop/docs/adr/0001-customer-payments-bounded-context.md) | Customer Payments is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/customer-payments/blob/develop/docs/adr/0002-customer-payments-assumptions.md) | customer-payments assumptions | Accepted (2026-10-25). |
| [0003](https://github.com/IQVO/customer-payments/blob/develop/docs/adr/0003-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted (2026-10-25). |
| [0004](https://github.com/IQVO/customer-payments/blob/develop/docs/adr/0004-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-26). |

## storefront-bff

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/storefront-bff/blob/develop/docs/adr/0001-storefront-bff-bounded-context.md) | Storefront BFF is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/storefront-bff/blob/develop/docs/adr/0002-storefront-bff-assumptions.md) | Storefront BFF design assumptions | Accepted. |

## storefront-web

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/storefront-web/blob/develop/docs/adr/0001-react-router-7-framework-ssr.md) | React Router 7 framework mode with SSR on Node | Accepted. |
| [0002](https://github.com/IQVO/storefront-web/blob/develop/docs/adr/0002-bff-only-and-state-cookie.md) | The web app talks only to the BFF and never invents ids | Accepted. |
| [0003](https://github.com/IQVO/storefront-web/blob/develop/docs/adr/0003-strict-csp.md) | Strict Content-Security-Policy | Accepted. |
| [0004](https://github.com/IQVO/storefront-web/blob/develop/docs/adr/0004-simulated-payment-fields.md) | Simulated hosted payment fields | Accepted. |
| [0005](https://github.com/IQVO/storefront-web/blob/develop/docs/adr/0005-ci-sensors-and-stub-bff.md) | CI sensors and the stub BFF | Accepted. |

## payment-provider-simulator

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/payment-provider-simulator/blob/develop/docs/adr/0001-payment-provider-simulator-bounded-context.md) | Payment Provider Simulator is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/payment-provider-simulator/blob/develop/docs/adr/0002-payment-provider-simulator-assumptions.md) | Payment Provider Simulator assumptions | Accepted. |

Two template artefacts worth knowing when you read them: `storefront-bff` ADR 0001 and
`payment-provider-simulator` ADR 0001 carry the harness title "... is a bounded context of the
storefront domain", while the model and ADR 0002 of each treat them as an edge and a stand-in
with no domain model (see [Edge and supporting components](/storefront/components)). The
`storefront-web` ADRs cite a campaign plan as design source; that plan is not published.
