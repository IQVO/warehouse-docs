# warehouse-docs

Fleet-wide documentation for the **warehouse-systems** ecosystem. It holds
the strategic and tactical Domain-Driven Design artifacts, the generated REST
and AsyncAPI references, and the business context for seventeen backend
contexts: sixteen domain bounded contexts plus `warehouse-ops-agent`. Built with [Docusaurus](https://docusaurus.io/) and
published to **GitHub Pages** through GitHub Actions. It also hosts the
**retail-network** domain documentation — the large-scale retail and logistics
network, ten bounded contexts — as a second docs section served at `/network/`
(merged from the former `IQVO/retail-network-docs` repository, history
preserved under `network/`).

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
    `sequence-diagrams`, `domain-events`, plus `use-cases` and the five
    operations pages `configuration`, `runbook`, `observability`,
    `troubleshooting` and `testing`). Each synced page has a "Synced from"
    note. Edit those pages
    upstream, never here. Every context ships the pack, so
    `CONTEXT_PAGE_OVERRIDES` stays empty.
  - `async-api.md`, a Kafka narrative written here, for the contexts that
    have one.

  The Bounded Contexts sidebar is generated from the `CONTEXTS`,
  `CONTEXT_PAGES` and `CONTEXT_OPS_PAGES` arrays in `sidebars.ts`, plus
  `CONTEXT_EXTRA_PAGES` and `ASYNC_NARRATIVE` (`async-api`).
  `inbound-receiving`, `slotting-optimization`, `pick-face-replenishment` and
  `task-interleaving` have the full pack, the operations pages and
  `async-api`. `CONTEXT_PAGE_OVERRIDES` is empty: it is only for a context
  whose repository does not ship its pack yet.
- **API Reference** (`docs/api-reference/`): generated REST docs
  ([`docusaurus-plugin-openapi-docs`](https://github.com/PaloAltoNetworks/docusaurus-openapi-docs))
  and generated AsyncAPI docs ([`@asyncapi/html-template`](https://github.com/asyncapi/html-template)),
  both built from specs synced from each context's own repository.
  `warehouse-ops-agent` has no spec, so its surface is documented in prose.
- **ADRs** (`docs/adr/`): an index that links to each context's own ADR
  trail. ADRs are never copied, so the index never drifts.
- **Retail Network** (`network/`): the retail-network domain — research,
  strategic design, node & promise models, WMS/WES integration, ten bounded
  contexts and their REST reference. The source of truth is
  `network/model/model.yaml`; `network/docs/strategic-design/` pages generated
  from it must be regenerated via `network/scripts/gen_pages.py`, never edited.
  The network REST reference is generated at build time (gitignored), unlike
  the committed fleet reference. Gates: `npm run check:model:network` and
  `npm run check:pages:network`.

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
            warehouse-planning product-master inbound-receiving \
            slotting-optimization network-inventory-planning \
            pick-face-replenishment task-interleaving; do
  git -C "$repo" show origin/develop:apis/openapi.yaml \
    > "warehouse-docs/apis/$repo/openapi.yaml" 2>/dev/null
  git -C "$repo" show origin/develop:apis/asyncapi.yaml \
    > "warehouse-docs/apis/$repo/asyncapi.yaml" 2>/dev/null
done
for repo in order-management wes-work-planning fulfillment-execution \
            workforce-management facility-layout process-path-management \
            labor-performance; do
  git -C "$repo" show origin/develop:apis/openapi-reports.yaml \
    > "warehouse-docs/apis/$repo/openapi-reports.yaml" 2>/dev/null
done
```

Seven contexts also ship an `apis/openapi-reports.yaml` for their separate
`*-reports` binary; each has a `<camelCaseId>Reports` entry in
`docusaurus.config.ts` and its generated `sidebar.ts` imported in
`sidebars.ts`. The fleet-ops skill's `sync_docs_pack_to_aggregator.py` copies
all three specs plus the synced context pages in one run.

`warehouse-ops-agent` has no `apis/` directory. Sixteen contexts ship both an
`openapi.yaml` and an `asyncapi.yaml` (`inbound-receiving`,
`slotting-optimization`, `pick-face-replenishment` and `task-interleaving`
were added to the sync
loop above, `docusaurus.config.ts`, `sidebars.ts` and
`scripts/gen-async-docs.mjs` when their contracts merged).

Next, regenerate the API reference pages (see below). Commit the refreshed
specs and the regenerated docs together. If a spec is wrong, fix it in the
owning repository and re-sync. Never hand-edit the copy.

### Alert rules

`alerting/warehouse-alert-rules.json` is a copy of warehouse-infra's
`terraform/alerting/warehouse-alert-rules.json` (the Prometheus rules the
fleet provisions); `alerting/SOURCE` names the commit it came from. The
[Alert catalogue](https://iqvo.github.io/warehouse-docs/fleet-operations/alert-catalogue)
page is generated from it:

```bash
npm run gen-alert-catalogue -- --sync   # copy from ../warehouse-infra origin/develop, then render
npm run gen-alert-catalogue -- --check  # what build-check runs: page matches the copy
```

## Local development

```bash
npm ci
npm run clean-api-docs:all   # drop generated REST pages (needed before a new tag/operation)
npm run gen-api-docs:all     # regenerate REST reference from apis/*/openapi*.yaml
npm run gen-async-docs:all   # regenerate AsyncAPI static HTML from apis/*/asyncapi.yaml
npm run validate:mermaid     # parse and render every Mermaid diagram in a real browser
npm run typecheck            # tsc --noEmit over docusaurus.config.ts, sidebars.ts, src/
npm start                    # dev server at http://localhost:3000
```

`npm run build` runs both generation steps before it builds the static site.

## Deployment

Pushing to `main` triggers `.github/workflows/docs.yml`. The workflow builds
the site and publishes it to GitHub Pages with `actions/deploy-pages`. GitHub
Pages must be set to **Source: GitHub Actions** for this repository
(Settings → Pages).

## Scope

This site documents seventeen backend contexts: the sixteen domain bounded
contexts `order-management`, `inventory-storage`, `wes-work-planning`,
`fulfillment-execution`, `workforce-management`, `facility-layout`,
`process-path-management`, `labor-performance`, `network-fulfillment`,
`warehouse-planning`, `product-master`, `network-inventory-planning`,
`inbound-receiving`, `slotting-optimization`, `pick-face-replenishment` and
`task-interleaving`,
plus `warehouse-ops-agent`.
`inbound-receiving`, `slotting-optimization`, `pick-face-replenishment` and
`task-interleaving` ship their artifact pack and specs.
The frontend repositories (`warehouse-console`, `warehouse-ui-kit`) and the
deployment repository (`warehouse-infra`) are referenced where relevant.
They are not bounded contexts in the Evans/Vernon sense, so they have no DDD
artifacts here.

## Study-project disclosure

`warehouse-systems` is an educational Domain-Driven Design exercise
following real industry-standard patterns. It is not a production system
and is not affiliated with, endorsed by, or representative of
Manhattan Associates, Blue Yonder, or any other company.
