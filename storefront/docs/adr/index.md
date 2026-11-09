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
(64 ADRs), with the **Status** copied from the ADR body (first sentence) and
a link to the file. ADR bodies are immutable; read them in their repo.

Per repo: `pricing` 8, `product-content` 7, `product-discovery` 8, `shopping-cart` 8, `checkout` 9, `customer-payments` 7, `storefront-bff` 6, `storefront-web` 7, `payment-provider-simulator` 4.

## pricing

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/pricing/blob/develop/docs/adr/0001-pricing-bounded-context.md) | Pricing is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/pricing/blob/develop/docs/adr/0002-pricing-assumptions.md) | Assumptions where the model is silent or ambiguous | Accepted (2026-10-25). |
| [0003](https://github.com/IQVO/pricing/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-model.md) | Consumed contracts and the local CatalogItemView | Accepted (2026-10-25). |
| [0004](https://github.com/IQVO/pricing/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted (2026-10-25). |
| [0005](https://github.com/IQVO/pricing/blob/develop/docs/adr/0005-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-26). |
| [0006](https://github.com/IQVO/pricing/blob/develop/docs/adr/0006-dataschema-stream-segment-names-the-actual-stream.md) | The dataschema stream segment names the actual stream | Accepted (2026-10-27). |
| [0007](https://github.com/IQVO/pricing/blob/develop/docs/adr/0007-a2a-inbound-adapter.md) | A2A inbound adapter | Accepted (2026-10-30). |
| [0008](https://github.com/IQVO/pricing/blob/develop/docs/adr/0008-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted (2026-11-01). |

## product-content

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/product-content/blob/develop/docs/adr/0001-product-content-bounded-context.md) | Product Content is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/product-content/blob/develop/docs/adr/0002-product-content-assumptions.md) | Aggregates, invariants and assumptions | Accepted (2026-10-25). |
| [0003](https://github.com/IQVO/product-content/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-model.md) | Consumed contracts and the local CatalogItemView | Accepted (2026-10-25). |
| [0004](https://github.com/IQVO/product-content/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted (2026-10-25). |
| [0005](https://github.com/IQVO/product-content/blob/develop/docs/adr/0005-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-26). |
| [0006](https://github.com/IQVO/product-content/blob/develop/docs/adr/0006-a2a-inbound-adapter.md) | A2A inbound adapter | Accepted (2026-10-30). |
| [0007](https://github.com/IQVO/product-content/blob/develop/docs/adr/0007-adopt-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted (2026-11-01). |

## product-discovery

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0001-product-discovery-bounded-context.md) | Product Discovery is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0002-product-discovery-assumptions.md) | Projections, no aggregates, and assumptions | Accepted (2026-10-25). |
| [0003](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0003-consumed-contracts-and-rebuild.md) | Consumed contracts, per-key guards and the snapshot rebuild | Accepted (2026-10-25). |
| [0004](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted (2026-10-25). |
| [0005](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0005-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-26). |
| [0006](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0006-rebuild-as-default-off-helm-job.md) | The rebuild binary ships as an optional, default-off Helm Job | Accepted (2026-10-27). |
| [0007](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0007-a2a-inbound-adapter.md) | A2A inbound adapter | Accepted (2026-10-30). |
| [0008](https://github.com/IQVO/product-discovery/blob/develop/docs/adr/0008-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted (2026-11-01). |

## shopping-cart

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0001-shopping-cart-bounded-context.md) | Shopping Cart is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0002-shopping-cart-assumptions.md) | Aggregates, invariants and assumptions | Accepted (2026-10-25). |
| [0003](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0003-consumed-contracts-and-local-read-model.md) | Consumed contracts and the local read models | Accepted (2026-10-25). |
| [0004](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted (2026-10-25). |
| [0005](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0005-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-26). |
| [0006](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0006-a2a-inbound-adapter.md) | A2A inbound adapter (read-only agent) | Accepted (2026-10-30). |
| [0007](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0007-delivery-dates-in-the-destinations-local-calendar.md) | Delivery dates are days of the destination's local calendar | Accepted (2026-10-30). |
| [0008](https://github.com/IQVO/shopping-cart/blob/develop/docs/adr/0008-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted (2026-11-01). |

## checkout

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/checkout/blob/develop/docs/adr/0001-checkout-bounded-context.md) | Checkout is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/checkout/blob/develop/docs/adr/0002-checkout-assumptions.md) | Aggregate, invariants and assumptions | Accepted (2026-10-25). |
| [0003](https://github.com/IQVO/checkout/blob/develop/docs/adr/0003-synchronous-contracts-and-the-anti-corruption-layer.md) | Synchronous contracts and the Anti-Corruption Layer | Accepted (2026-10-25). |
| [0004](https://github.com/IQVO/checkout/blob/develop/docs/adr/0004-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted (2026-10-25). |
| [0005](https://github.com/IQVO/checkout/blob/develop/docs/adr/0005-mcp-server.md) | A read-only MCP server | Accepted (2026-10-25). |
| [0006](https://github.com/IQVO/checkout/blob/develop/docs/adr/0006-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-26). |
| [0007](https://github.com/IQVO/checkout/blob/develop/docs/adr/0007-a2a-inbound-adapter.md) | A2A inbound adapter | Accepted (2026-10-30). |
| [0008](https://github.com/IQVO/checkout/blob/develop/docs/adr/0008-requoted-dates-in-the-destination-time-zone.md) | Requoted delivery dates in the destination's time zone | Accepted (2026-10-30). |
| [0009](https://github.com/IQVO/checkout/blob/develop/docs/adr/0009-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted (2026-11-01). |

## customer-payments

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/customer-payments/blob/develop/docs/adr/0001-customer-payments-bounded-context.md) | Customer Payments is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/customer-payments/blob/develop/docs/adr/0002-customer-payments-assumptions.md) | customer-payments assumptions | Accepted (2026-10-25). |
| [0003](https://github.com/IQVO/customer-payments/blob/develop/docs/adr/0003-cloudevents-envelope-and-type-catalogue.md) | CloudEvents envelope and type catalogue | Accepted (2026-10-25). |
| [0004](https://github.com/IQVO/customer-payments/blob/develop/docs/adr/0004-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-26). |
| [0005](https://github.com/IQVO/customer-payments/blob/develop/docs/adr/0005-a2a-inbound-adapter.md) | A2A inbound adapter | Accepted (2026-10-30). |
| [0006](https://github.com/IQVO/customer-payments/blob/develop/docs/adr/0006-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted (2026-11-01). |
| [0007](https://github.com/IQVO/customer-payments/blob/develop/docs/adr/0007-agent-authority-levels-and-complete-mcp-surface.md) | Agent authority levels and complete MCP surface | Accepted (2026-11-02). |

## storefront-bff

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/storefront-bff/blob/develop/docs/adr/0001-storefront-bff-bounded-context.md) | Storefront BFF is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/storefront-bff/blob/develop/docs/adr/0002-storefront-bff-assumptions.md) | Storefront BFF design assumptions | Accepted. |
| [0003](https://github.com/IQVO/storefront-bff/blob/develop/docs/adr/0003-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-29). |
| [0004](https://github.com/IQVO/storefront-bff/blob/develop/docs/adr/0004-bff-relays-the-category-tree.md) | The BFF relays the category tree | Accepted (2026-10-29). |
| [0005](https://github.com/IQVO/storefront-bff/blob/develop/docs/adr/0005-delivery-dates-carry-the-window-time-zone.md) | Delivery dates carry the window's time zone | Accepted (2026-10-30). |
| [0006](https://github.com/IQVO/storefront-bff/blob/develop/docs/adr/0006-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted (2026-11-01). |

## storefront-web

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/storefront-web/blob/develop/docs/adr/0001-react-router-7-framework-ssr.md) | React Router 7 framework mode with SSR on Node | Accepted. |
| [0002](https://github.com/IQVO/storefront-web/blob/develop/docs/adr/0002-bff-only-and-state-cookie.md) | The web app talks only to the BFF and never invents ids | Accepted. |
| [0003](https://github.com/IQVO/storefront-web/blob/develop/docs/adr/0003-strict-csp.md) | Strict Content-Security-Policy | Accepted. |
| [0004](https://github.com/IQVO/storefront-web/blob/develop/docs/adr/0004-simulated-payment-fields.md) | Simulated hosted payment fields | Accepted. |
| [0005](https://github.com/IQVO/storefront-web/blob/develop/docs/adr/0005-ci-sensors-and-stub-bff.md) | CI sensors and the stub BFF | Accepted. |
| [0006](https://github.com/IQVO/storefront-web/blob/develop/docs/adr/0006-promise-windows-in-the-destination-time-zone.md) | Promise windows are shown in the destination's time zone | Accepted. |
| [0007](https://github.com/IQVO/storefront-web/blob/develop/docs/adr/0007-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted. |

## payment-provider-simulator

| ADR | Title | Status |
| --- | --- | --- |
| [0001](https://github.com/IQVO/payment-provider-simulator/blob/develop/docs/adr/0001-payment-provider-simulator-bounded-context.md) | Payment Provider Simulator is a bounded context of the storefront domain | Accepted (bootstrap). |
| [0002](https://github.com/IQVO/payment-provider-simulator/blob/develop/docs/adr/0002-payment-provider-simulator-assumptions.md) | Payment Provider Simulator assumptions | Accepted. |
| [0003](https://github.com/IQVO/payment-provider-simulator/blob/develop/docs/adr/0003-fleet-observability-standard.md) | Adopt the fleet observability standard (logs, metrics, traces) | Accepted (2026-10-29). |
| [0004](https://github.com/IQVO/payment-provider-simulator/blob/develop/docs/adr/0004-adopt-the-fleet-rest-api-guideline.md) | Adopt the fleet REST API guideline | Accepted (2026-11-01). |

Two template artefacts worth knowing when you read them: `storefront-bff` ADR 0001 and
`payment-provider-simulator` ADR 0001 carry the harness title "... is a bounded context of the
storefront domain", while the model and ADR 0002 of each treat them as an edge and a stand-in
with no domain model (see [Edge and supporting components](/storefront/components)). The
`storefront-web` ADRs cite a campaign plan as design source; that plan is not published.
