# warehouse-docs

Fleet-wide documentation for the **warehouse-systems** ecosystem. It holds
the strategic and tactical Domain-Driven Design artifacts, the generated REST
and AsyncAPI references, and the business context for fourteen backend
contexts: thirteen domain bounded contexts plus `warehouse-ops-agent`. Built with [Docusaurus](https://docusaurus.io/) and
published to **GitHub Pages** through GitHub Actions.

Live site: https://iqvo.github.io/warehouse-docs/

## What's here

- **Strategic Design** (`docs/strategic-design/`): the fleet-wide artifacts,
  modelled on the open [ddd-crew](https://github.com/ddd-crew) templates.
  - The DDD Starter Modelling Process walkthrough (`ddd-starter-modelling-process.md`)
  - Domain vision
  - Core Domain Chart
  - Subdomain classification
  - Big Picture EventStorming (`eventstorming-big-picture.md`)
  - Context map
  - Domain message flows
  - The fleet CloudEvents 1.0 Event Standard
  - Fleet ubiquitous language
- **Architecture** (`docs/architecture/`): C4 levels 1–3 plus fleet
  summaries of the domain model, data model and runtime flows. These link to
  each context's detailed pages.
- **Bounded Contexts** (`docs/contexts/<context>/`): one directory per
  context.
  - `business-context.md` and `index.md`, written here.
  - The ddd-crew artifact pack, **synced** from the context repository's
    `develop` (`core-domain-chart`, `bounded-context-canvas`, `context-map`,
    `aggregate-design-canvas`, `domain-message-flow`, `eventstorming`,
    `ubiquitous-language`, `class-diagram`, `entity-relationship`,
    `sequence-diagrams`, `domain-events`; `product-master` also has
    `use-cases`). Each synced page has a "Synced from" note. Edit those pages
    upstream, never here.
  - `async-api.md`, a Kafka narrative written here, for the contexts that
    have one.

  The Bounded Contexts sidebar is generated from the `CONTEXTS` and
  `CONTEXT_PAGES` arrays in `sidebars.ts`. `inbound-receiving` and
  `slotting-optimization` (decided 2026-10-08) list only `business-context`
  and `bounded-context-canvas` through `CONTEXT_PAGE_OVERRIDES`, because
  their repositories have no artifact pack, `apis/` specs or Async API
  narrative yet.
- **API Reference** (`docs/api-reference/`): generated REST docs
  ([`docusaurus-plugin-openapi-docs`](https://github.com/PaloAltoNetworks/docusaurus-openapi-docs))
  and generated AsyncAPI docs ([`@asyncapi/html-template`](https://github.com/asyncapi/html-template)),
  both built from specs synced from each context's own repository.
  `warehouse-ops-agent` has no spec, so its surface is documented in prose.
- **ADRs** (`docs/adr/`): an index that links to each context's own ADR
  trail. ADRs are never copied, so the index never drifts.

Every Kafka message in the fleet is a CloudEvents 1.0 event in structured
content mode. REST and MCP surfaces are unauthenticated fleet-wide. All
source repositories live in the [IQVO](https://github.com/IQVO) organization.

## Syncing API specs from the fleet

The `apis/<context>/{openapi,asyncapi}.yaml` files in this repository are
**copies**. The source of truth is `apis/openapi.yaml` / `apis/asyncapi.yaml`
on each context repository's `develop` branch. Refresh the copies with:

```bash
cd ..   # warehouse-systems/ (siblings checked out)
for repo in order-management inventory-storage wes-work-planning \
            fulfillment-execution workforce-management facility-layout \
            process-path-management labor-performance network-fulfillment \
            warehouse-planning product-master; do
  git -C "$repo" show origin/develop:apis/openapi.yaml \
    > "warehouse-docs/apis/$repo/openapi.yaml" 2>/dev/null
  git -C "$repo" show origin/develop:apis/asyncapi.yaml \
    > "warehouse-docs/apis/$repo/asyncapi.yaml" 2>/dev/null
done
git -C labor-performance show origin/develop:apis/openapi-reports.yaml \
  > "warehouse-docs/apis/labor-performance/openapi-reports.yaml" 2>/dev/null
```

`warehouse-ops-agent` has no `apis/` directory. All eleven other contexts
ship both an `openapi.yaml` and an `asyncapi.yaml`. `inbound-receiving` and
`slotting-optimization` are not in the sync loop above yet: add them to the
loop, to the `docusaurus.config.ts` plugin config, to `sidebars.ts` and to
`scripts/gen-async-docs.mjs` when their contracts merge.

Next, regenerate the API reference pages (see below). Commit the refreshed
specs and the regenerated docs together. If a spec is wrong, fix it in the
owning repository and re-sync. Never hand-edit the copy.

## Local development

```bash
npm ci
npm run gen-api-docs:all     # regenerate REST reference from apis/*/openapi.yaml
npm run gen-async-docs:all   # regenerate AsyncAPI static HTML from apis/*/asyncapi.yaml
npm run validate:mermaid     # parse and render every Mermaid diagram in a real browser
npm start                    # dev server at http://localhost:3000
```

`npm run build` runs both generation steps before it builds the static site.

## Deployment

Pushing to `main` triggers `.github/workflows/docs.yml`. The workflow builds
the site and publishes it to GitHub Pages with `actions/deploy-pages`. GitHub
Pages must be set to **Source: GitHub Actions** for this repository
(Settings → Pages).

## Scope

This site documents fourteen backend contexts: the thirteen domain bounded
contexts `order-management`, `inventory-storage`, `wes-work-planning`,
`fulfillment-execution`, `workforce-management`, `facility-layout`,
`process-path-management`, `labor-performance`, `network-fulfillment`,
`warehouse-planning`, `product-master`, `inbound-receiving` and
`slotting-optimization`, plus `warehouse-ops-agent`.
The fleet's fourteenth domain context, `network-inventory-planning`, is not
aggregated here yet.
The frontend repositories (`warehouse-console`, `warehouse-ui-kit`) and the
deployment repository (`warehouse-infra`) are referenced where relevant.
They are not bounded contexts in the Evans/Vernon sense, so they have no DDD
artifacts here.

## Study-project disclosure

`warehouse-systems` is an educational Domain-Driven Design exercise
following real industry-standard patterns. It is not a production system
and is not affiliated with, endorsed by, or representative of Amazon,
Manhattan Associates, Blue Yonder, or any other company.
