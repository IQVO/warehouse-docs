# retail network (`network/`)

Domain documentation for **retail-network**: a large-scale retail and
logistics network (catalogue, delivery promise, order sourcing, vendor
connectivity, middle mile, last mile, tracking, node performance) modelled
with Domain-Driven Design, and the one seam through which it connects to the
[warehouse-systems](https://iqvo.github.io/warehouse-docs/) WMS/WES fleet.

Merged into [warehouse-docs](https://github.com/IQVO/warehouse-docs) as the
`network/` section (served at `/network/`); this directory is no longer a
standalone site. Full history preserved via the subtree merge.

**Status: as built.** All eleven contexts are built as services (`seller-inbound`
since 2026-10-24), and the model carries their as-built contracts, re-checked
against each repository's `develop` on 2026-10-26. Each service has a
`terraform/apps.yaml` entry and a `helm-values/<context>.yaml` in warehouse-infra
`develop`, and has adopted the fleet observability standard (logs, metrics and
traces over OTLP, one Tier-2 business counter; an ADR in each repository). Each service also ships a read-only MCP server
(`cmd/mcp`, Streamable HTTP on `:8090`, exposed by the gateway at
`/api/mcp/<context>`) and a console Module Federation remote at
`/mfes/<context>/`. The model is derived from public fulfillment-network
benchmarks.

## Layout

| Path | What |
| --- | --- |
| `model/model.yaml` | The canonical model. Every aggregate, invariant, command, event, consumer and relationship on the site exists here first. |
| `scripts/check_model.py` | Consistency gate: publish/consume symmetry, states, routes and reason vocabularies, and every CloudEvents type printed under `docs/`. |
| `scripts/gen_pages.py` | Generates `docs/strategic-design/{context-map,ubiquitous-language,event-standard-cloudevents}.md` from the model; `--check` fails when they are stale. |
| `research/citations-ledger.json` | The grounded-citations ledger (verbatim quotes and source URLs) is held privately, outside this repo. |
| `docs/` | The site (Docusaurus). |
| `apis/<context>/openapi.yaml` | REST contracts of the eleven contexts, copied from each service's `apis/openapi.yaml` on `develop`; `vendor-connectivity` is the Published Language the fleet's `network-fulfillment` conforms to. |

## Local

Run from the warehouse-docs root:

```bash
npm ci
npm run check:model:network
npm run check:pages:network
npx docusaurus gen-api-docs -p network-api all
npm run validate:mermaid
npm start
```

## Disclaimer

This project is a domain-driven design study. It is not associated with, endorsed by or affiliated with any company, and it uses no company's code, data, logos or trademarks. All names, figures and examples are illustrative or synthetic.
