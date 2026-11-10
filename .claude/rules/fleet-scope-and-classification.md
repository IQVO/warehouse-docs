---
paths:
  - "docs/**"
  - "network/docs/**"
  - "storefront/docs/**"
  - "yard/docs/**"
  - "src/**"
  - "apis/**"
  - "sidebars.ts"
  - "docusaurus.config.ts"
  - "scripts/capability-map/**"
---

# Fleet scope, classification and fleet facts

Moved verbatim from this repo's CLAUDE.md (now a short map). Paths in another repo are written
as words, not backticked: guide-lint resolves every backticked path in THIS repo.

Fleet-wide documentation for the **warehouse-systems** ecosystem: strategic
and tactical Domain-Driven Design artifacts, generated REST and AsyncAPI
references, and business context for twenty backend contexts: nineteen domain
bounded contexts plus `warehouse-ops-agent` (`pick-face-replenishment`,
`task-interleaving`, `returns-processing` and `exception-management` are built
on `develop`, onboarded here and registered in `warehouse-infra` `develop`;
`outbound-shipping` is built on `develop` and onboarded here, but not deployed:
no Helm chart and no `warehouse-infra` entry).
Built with [Docusaurus](https://docusaurus.io/), published to GitHub Pages.

Live site: https://iqvo.github.io/warehouse-docs/
Repository: https://github.com/IQVO/warehouse-docs (every fleet repo lives
in the `IQVO` org; Go module paths inside the service repos are still
`github.com/claudioed/<repo>` — that is expected, don't "fix" statements
about module paths).

This repo reads FROM every context repo's own apis/openapi.yaml /
apis/asyncapi.yaml and docs; it lives in none of them, and it never
duplicates a context's own ADR trail (the ADR index here links out, it
never copies).

> **Study project.** `warehouse-systems` is an educational DDD exercise
> using real industry-standard patterns. Not a production system, not
> affiliated with Manhattan Associates, Blue Yonder, or any other
> company.

## Project Overview

- Single Docusaurus site, no develop/main split — this repo builds and
  deploys straight off `main` on every push (unlike the fleet's GitFlow
  service repos).
- **Scope**: twenty backend contexts —
  `order-management`, `inventory-storage`, `wes-work-planning`,
  `fulfillment-execution`, `workforce-management`, `facility-layout`,
  `process-path-management`, `labor-performance`, `warehouse-ops-agent`,
  `network-fulfillment` (the anti-corruption layer to an external retail
  fulfillment network; ships both apis/openapi.yaml and
  apis/asyncapi.yaml, topics `warehouse.network-fulfillment.events` +
  `.analytics`; its ADRs live under docs/adr/, not docs/docs/adr/),
  `warehouse-planning` (whether the warehouse can process the demand
  assigned to it; ADRs also under docs/adr/),
  `returns-processing` (`wms`, Supporting: RMA, return receipt, grading and
  disposition; hands restockable goods to inventory-storage via
  `ReturnLineStaged`; topics `warehouse.returns-processing.events` +
  `.analytics`),
  `exception-management` (`wes`, Supporting: the problem-solve lifecycle for
  the anomalies other contexts detect; topics
  `warehouse.exception-management.events` + `.analytics`),
  `product-master` (the `wms`-tier source of truth for SKU master data:
  handling classification taken over from inventory-storage, and the
  declared vs measured physical profile; topics
  `warehouse.product-master.events` + `.analytics`; ADRs under docs/adr/;
  every context syncs a `use-cases` page, it is in `CONTEXT_PAGES` in
  `sidebars.ts`),
  `network-inventory-planning` (Core: network-wide inventory position and the
  inter-warehouse transfer saga; topics `warehouse.network-inventory-planning.events`
  + `.analytics`; ADRs under docs/docs/adr/), `inbound-receiving` and
  `slotting-optimization` (Supporting; built, each with a synced pack and
  operations pages), `pick-face-replenishment` (`wms`, Supporting;
  built and wired in `warehouse-infra` `develop`; ADRs under
  docs/adr/) and `task-interleaving` (`wes`, Supporting; the advisory
  next-task hint; built and wired in `warehouse-infra` `develop`; topics
  `warehouse.task-interleaving.events` + `.analytics`; ADRs under
  docs/adr/; read-only MCP server cmd/mcp).
  The frontend repos (`warehouse-console`, `warehouse-ui-kit`) and
  `warehouse-infra` are referenced where relevant but are not bounded
  contexts in the Evans/Vernon sense — out of scope for DDD artifacts here.
- **Classification** (must match everywhere on the site):
  Core = `inventory-storage`, `wes-work-planning`, `fulfillment-execution`,
  `warehouse-planning`, `network-inventory-planning`; Supporting =
  `workforce-management`, `labor-performance`, `warehouse-ops-agent`,
  `network-fulfillment`, `product-master`, `inbound-receiving`,
  `slotting-optimization`, `pick-face-replenishment`, `task-interleaving`,
  `returns-processing`, `exception-management`, `outbound-shipping`;
  Generic = `facility-layout`, `process-path-management`;
  `order-management` = Generic/Supporting.
- **Fleet facts**: REST and MCP are UNAUTHENTICATED fleet-wide (by
  deliberate decision — never document auth as current); one Kafka broker;
  `process-path-management` and `labor-performance` make NO REST/MCP calls
  to siblings (events/declarative only); `warehouse-ops-agent` has no
  database and no Kafka.
  Product classification is owned by `product-master`; inventory-storage,
  order-management, wes-work-planning and fulfillment-execution keep a
  version-guarded local copy from its `ProductClassified` (no live
  `GET /products/{sku}/classification` call; `PRODUCT_CLASSIFICATION_MODE=http`
  is rejected at boot) and the reference deployment runs all four in kafka mode.
- **Two separate OpenAPI-doc-generation toolchains in one repo**, isolated
  from each other on purpose (see `tools/asyncapi-gen/` in `.claude/rules/asyncapi-toolchain.md`) — a real
  npm dependency conflict between `docusaurus-plugin-openapi-docs` (needs
  React 19) and `@asyncapi/html-template` (needs its own React 18) made a
  shared `node_modules` tree fail intermittently at static-generation time.
