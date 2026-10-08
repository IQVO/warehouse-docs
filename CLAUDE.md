# Project: warehouse-docs (fleet-wide documentation aggregator)

Fleet-wide documentation for the **warehouse-systems** ecosystem: strategic
and tactical Domain-Driven Design artifacts, generated REST and AsyncAPI
references, and business context for fifteen backend contexts: fourteen domain
bounded contexts plus `warehouse-ops-agent` (`inbound-receiving` and
`slotting-optimization` are decided, not built: business-context and canvas
pages only).
Built with [Docusaurus](https://docusaurus.io/), published to GitHub Pages.

Live site: https://iqvo.github.io/warehouse-docs/
Repository: https://github.com/IQVO/warehouse-docs (every fleet repo lives
in the `IQVO` org; Go module paths inside the service repos are still
`github.com/claudioed/<repo>` — that is expected, don't "fix" statements
about module paths).

This repo reads FROM every context repo's own `apis/openapi.yaml` /
`apis/asyncapi.yaml` and docs; it lives in none of them, and it never
duplicates a context's own ADR trail (the ADR index here links out, it
never copies).

> **Study project.** `warehouse-systems` is an educational DDD exercise
> using real industry-standard patterns. Not a production system, not
> affiliated with Amazon, Manhattan Associates, Blue Yonder, or any other
> company.

## Project Overview

- Single Docusaurus site, no develop/main split — this repo builds and
  deploys straight off `main` on every push (unlike the fleet's GitFlow
  service repos).
- **Scope**: fifteen backend contexts —
  `order-management`, `inventory-storage`, `wes-work-planning`,
  `fulfillment-execution`, `workforce-management`, `facility-layout`,
  `process-path-management`, `labor-performance`, `warehouse-ops-agent`,
  `network-fulfillment` (the anti-corruption layer to an external retail
  fulfillment network; ships both `apis/openapi.yaml` and
  `apis/asyncapi.yaml`, topics `warehouse.network-fulfillment.events` +
  `.analytics`; its ADRs live under `docs/adr/`, not `docs/docs/adr/`),
  `warehouse-planning` (whether the warehouse can process the demand
  assigned to it; ADRs also under `docs/adr/`),
  `product-master` (the `wms`-tier source of truth for SKU master data:
  handling classification taken over from inventory-storage, and the
  declared vs measured physical profile; topics
  `warehouse.product-master.events` + `.analytics`; ADRs under `docs/adr/`;
  its pack adds a synced `use-cases` page, `CONTEXT_EXTRA_PAGES` in
  `sidebars.ts`),
  `network-inventory-planning` (Core: network-wide inventory position and the
  inter-warehouse transfer saga; topics `warehouse.network-inventory-planning.events`
  + `.analytics`; ADRs under `docs/docs/adr/`; it ships no ddd pack of its own yet,
  so its pages 2-12 are AUTHORED in this repo from its code and ADRs, each noting
  so — the exception to the synced-copies rule below), `inbound-receiving` and
  `slotting-optimization` (Supporting; decided, not built).
  The frontend repos (`warehouse-console`, `warehouse-ui-kit`) and
  `warehouse-infra` are referenced where relevant but are not bounded
  contexts in the Evans/Vernon sense — out of scope for DDD artifacts here.
- **Classification** (must match everywhere on the site):
  Core = `inventory-storage`, `wes-work-planning`, `fulfillment-execution`,
  `warehouse-planning`, `network-inventory-planning`; Supporting =
  `workforce-management`, `labor-performance`, `warehouse-ops-agent`,
  `network-fulfillment`, `product-master`, `inbound-receiving`,
  `slotting-optimization`;
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
  from each other on purpose (see `tools/asyncapi-gen/` below) — a real
  npm dependency conflict between `docusaurus-plugin-openapi-docs` (needs
  React 19) and `@asyncapi/html-template` (needs its own React 18) made a
  shared `node_modules` tree fail intermittently at static-generation time.

## Structure

```
docs/
  overview.md, glossary.md      hand-written fleet overview + term index
  strategic-design/            domain vision, Core Domain Chart, subdomain
                                classification, context map, message-flow
                                modelling, fleet ubiquitous language, the
                                fleet Event Standard (CloudEvents 1.0),
                                Big Picture EventStorming
                                (eventstorming-big-picture.md), and the
                                DDD Starter Modelling Process walkthrough
                                (ddd-starter-modelling-process.md)
                                (modelled on ddd-crew's strategic templates;
                                hand-written FROM the synced per-context pages)
  architecture/                 C4 levels 1-3 + fleet summaries of domain
                                model, data models, runtime flows (link to
                                each context's synced class/ER/sequence pages)
  contexts/<context>/          one dir per bounded context (see below)
  api-reference/                GENERATED — REST (docusaurus-plugin-openapi-docs)
                                + AsyncAPI (asyncapi-gen). The REST .mdx files
                                and per-context sidebar.ts ARE committed, and
                                `npm run build` regenerates them first; commit
                                the regenerated output after syncing specs.
                                Hand-written exceptions: index.md,
                                warehouse-ops-agent.md (prose, no spec) and
                                the short intro on each async/<ctx>.md embed
                                page (keep the iframe exactly as is)
  adr/                          index linking to each context's OWN ADR
                                trail (never copied — never drifts)
apis/<context>/
  openapi.yaml                  COPY of that context's apis/openapi.yaml
                                (source of truth lives in the context repo)
  asyncapi.yaml                 COPY of that context's apis/asyncapi.yaml
  openapi-reports.yaml          labor-performance only (its second spec)
tools/asyncapi-gen/              ISOLATED sub-project (own package.json,
                                own node_modules) wrapping @asyncapi/cli +
                                @asyncapi/html-template — see "Why isolated"
scripts/gen-async-docs.mjs      invokes tools/asyncapi-gen's installed
                                binary via execFileSync, never npx (npx
                                re-resolves the whole tree fresh every call,
                                10+ min cold vs <1 min cached). Its CONTEXTS
                                array lists every context with an
                                asyncapi.yaml — all twelve (every context
                                with an asyncapi.yaml; not warehouse-ops-agent
                                nor the two undecided ones; incl.
                                network-fulfillment, product-master and
                                network-inventory-planning)
scripts/validate-mermaid.cjs    renders every Mermaid diagram in a real
                                browser (`npm run validate:mermaid`)
```

### Per-context page set (`docs/contexts/<context>/`)

Every context directory has the same page set, in this sidebar order:

| Page | Origin |
| --- | --- |
| `index.md` | hand-written here (most carry a custom `slug: /contexts/<ctx>` — use absolute links only) |
| `business-context.md` | hand-written here |
| `ubiquitous-language.md`, `core-domain-chart.md`, `bounded-context-canvas.md`, `context-map.md`, `aggregate-design-canvas.md`, `domain-events.md`, `domain-message-flow.md`, `eventstorming.md`, `class-diagram.md`, `entity-relationship.md`, `sequence-diagrams.md` | **SYNCED COPIES** of the context repo's own ddd-crew artifact pack on `develop` (code-grounded). Each starts with a `:::info[Synced from <repo>]` note linking its source. NEVER rewrite them here: fix the content upstream in the context repo, then re-sync. If one breaks the build, make the minimal link/MDX fix and report it as an upstream fix needed |
| `async-api.md` | hand-written Kafka narrative (topics, envelope example from the spec, publishing, consumer/dedupe/DLQ behaviour), only for contexts that have one: inventory-storage, wes-work-planning, fulfillment-execution, workforce-management, process-path-management, labor-performance, network-fulfillment, warehouse-planning, product-master, network-inventory-planning |

The Bounded Contexts sidebar is GENERATED in `sidebars.ts` from the
`CONTEXTS` array (the fifteen contexts) × `CONTEXT_PAGES` (the page order
above), plus any `CONTEXT_EXTRA_PAGES` (product-master's `use-cases`) and
`async-api` for the contexts in `ASYNC_NARRATIVE`. Adding a
context or a page = edit those arrays, not hand-written sidebar entries.

## Syncing API specs from the fleet (do this before every content refresh)

The `apis/<context>/{openapi,asyncapi}.yaml` files here are **copies**, not
the source of truth. Refresh them from each context repo's own `develop`
(or `main`, once released) before regenerating docs:

```bash
cd ..   # warehouse-systems/ (siblings checked out)
for repo in order-management inventory-storage wes-work-planning \
            fulfillment-execution workforce-management facility-layout \
            process-path-management labor-performance network-fulfillment \
            warehouse-planning product-master network-inventory-planning; do
  git -C "$repo" show origin/develop:apis/openapi.yaml \
    > "warehouse-docs/apis/$repo/openapi.yaml" 2>/dev/null
  git -C "$repo" show origin/develop:apis/asyncapi.yaml \
    > "warehouse-docs/apis/$repo/asyncapi.yaml" 2>/dev/null
done
git -C labor-performance show origin/develop:apis/openapi-reports.yaml \
  > "warehouse-docs/apis/labor-performance/openapi-reports.yaml" 2>/dev/null
```

All twelve contexts in the loop ship BOTH files (network-fulfillment and
order-management included). `warehouse-ops-agent` has neither — it's a
Customer, not an Open Host Service, with no `apis/` dir of its own (see its
own CLAUDE.md); its surface is documented in prose at
`docs/api-reference/warehouse-ops-agent.md`, sourced from its
`docs/docs/api-surface.md`. The REST spec list lives in
`docusaurus.config.ts` (the `docusaurus-plugin-openapi-docs` config); the
async list is the `CONTEXTS` array in `scripts/gen-async-docs.mjs`.

The per-context ddd-crew pages (`docs/contexts/<ctx>/<page>.md`, see the
table above) are synced the same way, from each repo's own docs on
`develop`; never hand-edit those copies either.

## Events: CloudEvents 1.0 is MANDATORY

Every Kafka message any warehouse-systems service produces or consumes
(integration `warehouse.<ctx>.events` AND analytics `warehouse.<ctx>.analytics`)
is a CloudEvents 1.0 event in structured content mode. This is a hard fleet
rule, and every page on this site must document it that way:

- Never document a flat envelope (`event_id`/`event_type`/`occurred_at`/
  `source`/`data`), a dual-write/dual-read migration, an analytics
  `schema_version`, or an envelope toggle env var (`EVENT_ENVELOPE_MODE` is
  gone) as current behaviour. No "the AsyncAPI is the target, the wire is
  still flat" caveats — the wire IS CloudEvents.
- Wire format to show in examples: Kafka header
  `content-type: application/cloudevents+json; charset=UTF-8`; attributes
  `specversion=1.0`, `id` (UUID, stable across outbox redelivery),
  `source=/warehouse/<repo>`, `type`, `subject` (aggregate id), `time`
  (occurred-at, UTC), `datacontenttype=application/json`,
  `dataschema=urn:warehouse:<repo>:<events|analytics>:<EventName>:v<N>`;
  payload under `data`, unchanged.
- `type` = `com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>`
  (`wms` for facility-layout / inventory-storage / product-master, `wes`
  for every other context; wes-work-planning's segment is `work-planning`).
  Breaking payload
  change => new `.v2` type + new dataschema version.
- Consumers dispatch on the FULL `type`, ignore unknown types, dedupe on
  `id`, and DLQ/skip (never parse a legacy shape) anything that fails
  CloudEvents validation.
- `apis/<ctx>/asyncapi.yaml` here are COPIES: fix envelope drift in the
  owning service repo, then re-sync — never hand-edit the copy.

Full standard, subdomain table and the fleet's cross-service type
catalogue: `docs/strategic-design/event-standard-cloudevents.md`. Each of
the twelve Kafka-using service repos documented here also records it as its
own ADR (under `docs/docs/adr/`, or `docs/adr/` for network-fulfillment,
warehouse-planning and product-master — product-master's is ADR 0004;
network-inventory-planning's is ADR 0004 under `docs/docs/adr/`);
`warehouse-ops-agent` uses no Kafka.

## Key Commands

```bash
npm ci
npm run gen-api-docs:all     # regenerate REST reference from apis/*/openapi.yaml
npm run gen-async-docs:all   # regenerate AsyncAPI static HTML from apis/*/asyncapi.yaml
npm run validate:mermaid     # parse + render every Mermaid diagram in a real browser
npm run build                 # runs both generation steps, then docusaurus build
npm start                     # dev server at http://localhost:3000
```

`postinstall` runs `npm --prefix tools/asyncapi-gen install` automatically
on `npm install`/`npm ci` at the repo root — but CI (`.github/workflows/docs.yml`)
also runs `npm --prefix tools/asyncapi-gen ci` explicitly as a separate
step, because a plain `npm ci` at the repo root does NOT recurse into it.

## Why the AsyncAPI toolchain is isolated (`tools/asyncapi-gen/`)

`docusaurus-plugin-openapi-docs` needs React 19 (current Docusaurus).
`@asyncapi/html-template` (the official AsyncAPI Generator template) pulls
in its own React 18 renderer as a transitive dependency. Installing both in
ONE `node_modules` tree causes an intermittent, hard-to-diagnose failure
during static generation ("Objects are not valid as a React child"). This
is a real npm hoisting/dedup collision, not a bug in either package.

Fix in place: `tools/asyncapi-gen/package.json` contains ONLY
`@asyncapi/cli` + `@asyncapi/html-template`, installed into its own
`node_modules`. `scripts/gen-async-docs.mjs` invokes its installed binary
via `execFileSync(..., {cwd: 'tools/asyncapi-gen'})` so the generator
process resolves React from ITS OWN tree. Never `npx @asyncapi/cli` — it
re-resolves and downloads the whole dependency tree fresh every invocation
(10+ minutes cold vs under a minute once installed).

## Deployment

Pushing to `main` triggers `.github/workflows/docs.yml` directly — no
develop/main split for this repo (unlike every service repo in the fleet).
Builds the site, publishes via `actions/deploy-pages`. GitHub Pages must be
configured with **Source: GitHub Actions** (Settings > Pages) — see the
fleet ops skill's `github-pages-first-enable.md` if Pages was never turned
on for a repo before.

## Docusaurus pitfall: relative links break under a custom `slug`

A page with `slug: /some-path` in its frontmatter resolves relative
markdown links (`./sibling`) relative to the FOLDER path, not the slug,
even though the page renders at the slug URL. Symptom: `Docusaurus found
broken links!` naming one index page, even when several deeper pages have
the same issue and would break too if reached another way. Fix: any page
with a custom `slug` must use absolute site-rooted links
(`/strategic-design/domain-vision`), never relative ones. Pages WITHOUT a
custom `slug` can keep relative links safely.

Other MDX traps: `{` and `<` in prose break MDX (wrap in backticks);
admonition titles are `:::note[Title]`, never `:::note Title`; Mermaid
diagrams that render client-side are NOT checked by `docusaurus build` —
run `npm run validate:mermaid`.

## Verification checklist after a content refresh

Don't report "the site is built" from a green `npm run build` alone.

1. `npm run build` locally, fix every broken link before pushing;
   `npm run validate:mermaid` must end with `0 failed`.
2. Commit + push, then confirm the `docs.yml` run actually completed green
   (not just "workflow started").
3. `curl -s -o /dev/null -w "%{http_code}"` the live GitHub Pages URL
   (https://iqvo.github.io/warehouse-docs/) — homepage, one deep content
   page per major section, one generated REST reference page, one generated
   AsyncAPI static page. All must be 200.
