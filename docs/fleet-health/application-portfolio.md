---
id: application-portfolio
title: Application portfolio assessment
sidebar_label: Application portfolio
description: Executive summary of architecture, clean-code and API quality for every application in the ecosystem, with a detailed per-application page.
---

# Application portfolio assessment

An evidence-based engineering assessment of all 40 applications, measured on each repository's `origin/develop` on 2026-10-31.

:::tip Full executive page
The detailed page, with one profile per application (architecture, clean code, every REST operation, event, MCP tool and A2A skill), is here:
**[Open the application portfolio assessment](pathname:///executive/application-portfolio.html)**.
:::

## At a glance

- **40 applications**: 37 Go services and agents, 3 web frontends
- **556k lines of production code**: 773k lines of test code (1.4 : 1)
- **482 REST operations**: across 36 published OpenAPI contracts
- **270 business event types published**: CloudEvents 1.0 over Kafka, transactional outbox
- **159 MCP tools for AI agents**: 68 A2A agent skills
- **0 layer-boundary violations**: domain and application code import no infrastructure
- **17,895 Go test functions**: 2,389 BDD scenarios, 1,159 architecture fitness tests
- **38/40 green on latest develop CI**: 1 failure, 1 in progress

Average ratings (1-5, hand review): architecture **3.9**, clean code **3.9**, API design **3.6**.

## Fleet-wide risks and gaps

- All REST and MCP endpoints are unauthenticated (authentication was deliberately removed fleet-wide); acceptable for a closed lab, a blocker for any exposed deployment.
- Latest develop CI is red for returns-processing (integration job) and should be fixed before the next release.
- 92 open code-scanning alerts and 252 open Dependabot alerts across the repos that run those scanners.
- 21 repos have no code-scanning (CodeQL) analysis on record, mostly the newer Retail Network and Storefront services.
- 23 repos have no published documentation site of their own; their context docs live only in this central site.
- 42 production Go files exceed 500 lines; the largest use cases and consumers are the main refactoring candidates.

## Scorecard

| Application | Area | Subdomain | Arch. | Code | API | REST ops | Events out / in | MCP tools |
|---|---|---|---|---|---|---|---|---|
| [Facility Layout](pathname:///executive/application-portfolio.html#app-facility-layout) | WMS | Generic | 4 | 3 | 4 | 42 | 15 / 0 | 8 |
| [Inbound Receiving](pathname:///executive/application-portfolio.html#app-inbound-receiving) | WMS | Supporting | 4 | 4 | 4 | 22 | 11 / 5 | 7 |
| [Inventory and Storage](pathname:///executive/application-portfolio.html#app-inventory-storage) | WMS | Core | 4 | 4 | 3 | 22 | 20 / 12 | 7 |
| [Pick-Face Replenishment](pathname:///executive/application-portfolio.html#app-pick-face-replenishment) | WMS | Supporting | 4 | 4 | 4 | 14 | 4 / 8 | 5 |
| [Product Master](pathname:///executive/application-portfolio.html#app-product-master) | WMS | Supporting | 4 | 4 | 4 | 17 | 8 / 0 | 8 |
| [Returns Processing](pathname:///executive/application-portfolio.html#app-returns-processing) | WMS | Supporting | 4 | 4 | 3 | 11 | 7 / 4 | 3 |
| [Slotting Optimization](pathname:///executive/application-portfolio.html#app-slotting-optimization) | WMS | Supporting | 4 | 4 | 4 | 11 | 3 / 11 | 4 |
| [Warehouse Planning](pathname:///executive/application-portfolio.html#app-warehouse-planning) | WMS | Core | 4 | 4 | 3 | 21 | 6 / 8 | 14 |
| [Exception Management](pathname:///executive/application-portfolio.html#app-exception-management) | WES | Supporting | 4 | 4 | 3 | 11 | 7 / 11 | 4 |
| [Fulfillment Execution](pathname:///executive/application-portfolio.html#app-fulfillment-execution) | WES | Core | 3 | 3 | 3 | 25 | 15 / 8 | 7 |
| [Labor Performance](pathname:///executive/application-portfolio.html#app-labor-performance) | WES | Supporting | 4 | 4 | 4 | 11 | 3 / 1 | 5 |
| [Order Management](pathname:///executive/application-portfolio.html#app-order-management) | WES | Supporting | 4 | 4 | 3 | 11 | 12 / 13 | 2 |
| [Process Path Management](pathname:///executive/application-portfolio.html#app-process-path-management) | WES | Generic | 4 | 4 | 4 | 12 | 4 / 0 | 4 |
| [Task Interleaving](pathname:///executive/application-portfolio.html#app-task-interleaving) | WES | Supporting | 4 | 4 | 4 | 10 | 4 / 7 | 4 |
| [WES Work Planning & Release](pathname:///executive/application-portfolio.html#app-wes-work-planning) | WES | Core | 3 | 4 | 2 | 17 | 11 / 17 | 5 |
| [Workforce Management](pathname:///executive/application-portfolio.html#app-workforce-management) | WES | Supporting | 4 | 3 | 3 | 16 | 10 / 4 | 5 |
| [Network Fulfillment](pathname:///executive/application-portfolio.html#app-network-fulfillment) | Network | Supporting | 4 | 4 | 3 | 10 | 7 / 8 | 5 |
| [Network Inventory Planning](pathname:///executive/application-portfolio.html#app-network-inventory-planning) | Network | Core | 4 | 3 | 4 | 16 | 6 / 12 | 4 |
| [Node Performance](pathname:///executive/application-portfolio.html#app-node-performance) | Network | Supporting | 4 | 5 | 4 | 2 | 2 / 15 | 2 |
| [Node Topology](pathname:///executive/application-portfolio.html#app-node-topology) | Network | Supporting | 4 | 4 | 4 | 15 | 9 / 0 | 6 |
| [Last-Mile Delivery](pathname:///executive/application-portfolio.html#app-last-mile-delivery) | Network | Supporting | 4 | 4 | 4 | 12 | 8 / 4 | 3 |
| [Linehaul Transportation](pathname:///executive/application-portfolio.html#app-linehaul-transportation) | Network | Supporting | 4 | 4 | 4 | 11 | 10 / 13 | 2 |
| [Seller Inbound](pathname:///executive/application-portfolio.html#app-seller-inbound) | Network | Supporting | 4 | 4 | 4 | 14 | 9 / 8 | 4 |
| [Vendor Connectivity](pathname:///executive/application-portfolio.html#app-vendor-connectivity) | Network | Supporting | 4 | 4 | 4 | 19 | 11 / 13 | 9 |
| [Shipping & Tracking](pathname:///executive/application-portfolio.html#app-shipping-and-tracking) | Network | Generic | 4 | 4 | 4 | 4 | 8 / 7 | 1 |
| [Order Sourcing](pathname:///executive/application-portfolio.html#app-order-sourcing) | Network | Core | 4 | 4 | 3 | 3 | 10 / 32 | 2 |
| [Offer and Availability](pathname:///executive/application-portfolio.html#app-offer-availability) | Network | Supporting | 4 | 4 | 4 | 10 | 9 / 4 | 4 |
| [Delivery Promise](pathname:///executive/application-portfolio.html#app-delivery-promise) | Network | Core | 4 | 4 | 4 | 10 | 12 / 34 | 5 |
| [Checkout](pathname:///executive/application-portfolio.html#app-checkout) | Storefront | Supporting | 4 | 5 | 4 | 3 | 7 / 0 | 1 |
| [Customer Ordering](pathname:///executive/application-portfolio.html#app-customer-ordering) | Storefront | Generic | 4 | 4 | 4 | 12 | 2 / 17 | 3 |
| [Customer Payments](pathname:///executive/application-portfolio.html#app-customer-payments) | Storefront | Generic | 4 | 4 | 4 | 6 | 8 / 6 | 4 |
| [Pricing](pathname:///executive/application-portfolio.html#app-pricing) | Storefront | Core | 4 | 4 | 4 | 13 | 5 / 2 | 0 |
| [Product Content](pathname:///executive/application-portfolio.html#app-product-content) | Storefront | Generic | 4 | 4 | 4 | 12 | 3 / 2 | 0 |
| [Product Discovery](pathname:///executive/application-portfolio.html#app-product-discovery) | Storefront | Supporting | 4 | 4 | 4 | 3 | 0 / 11 | 0 |
| [Shopping Cart](pathname:///executive/application-portfolio.html#app-shopping-cart) | Storefront | Supporting | 4 | 4 | 4 | 11 | 4 / 7 | 0 |
| [Storefront BFF](pathname:///executive/application-portfolio.html#app-storefront-bff) | Storefront | Generic | 4 | 4 | 4 | 23 | 0 / 0 | 0 |
| [Storefront Web](pathname:///executive/application-portfolio.html#app-storefront-web) | Storefront | Experience | 4 | 4 | 3 | 0 | 0 / 0 | 0 |
| [Warehouse Console](pathname:///executive/application-portfolio.html#app-warehouse-console) | Experience | Experience | 3 | 3 | 3 | 0 | 0 / 0 | 0 |
| [Warehouse Floor Client](pathname:///executive/application-portfolio.html#app-warehouse-floor-client) | Experience | Experience | 4 | 3 | 3 | 0 | 0 / 0 | 0 |
| [Warehouse Ops Agent](pathname:///executive/application-portfolio.html#app-warehouse-ops-agent) | Experience | Supporting | 4 | 3 | 4 | 0 | 0 / 0 | 12 |

## Method

Size, complexity, layering, API, event and gate figures are measured by script over every file of each repository export. Ratings come from a hand review of each repository (README, core aggregates, use cases, adapters, API specifications) against a fixed rubric: 3 = adequate, 4 = strong, 5 = exemplary with nothing material to fix. Every concern on the detailed page cites a file in the repository.
