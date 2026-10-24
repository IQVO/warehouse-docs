# retail-network-docs

Domain documentation for **retail-network**: a large-scale retail and
logistics network (catalogue, delivery promise, order sourcing, vendor
connectivity, middle mile, last mile, tracking, node performance) modelled
with Domain-Driven Design, and the one seam through which it connects to the
[warehouse-systems](https://iqvo.github.io/warehouse-docs/) WMS/WES fleet.

Merged into [warehouse-docs](https://github.com/IQVO/warehouse-docs) as the
`network/` section (served at `/network/`); this directory is no longer a
standalone site. Full history preserved via the subtree merge.

**Status: proposed design, docs only.** Nothing described here is built.
The model is derived from public fulfillment-network benchmarks;
everything else is the design this site proposes.

## Layout

| Path | What |
| --- | --- |
| `model/model.yaml` | The canonical model. Every aggregate, invariant, command, event, consumer and relationship on the site exists here first. |
| `scripts/check_model.py` | Consistency gate: publish/consume symmetry, states, and every CloudEvents type printed under `docs/`. |
| `research/citations-ledger.json` | The grounded-citations ledger (verbatim quotes and source URLs) is held privately, outside this repo. |
| `docs/` | The site (Docusaurus). |
| `apis/<context>/openapi.yaml` | REST contracts per context; `vendor-connectivity` is the Published Language the fleet's `network-fulfillment` conforms to. |

## Local

```bash
npm ci
python3 scripts/check_model.py --pages
npm run validate:mermaid
npm start
```

## Disclaimer

This project is a domain-driven design study. It is not associated with, endorsed by or affiliated with any company, and it uses no company's code, data, logos or trademarks. All names, figures and examples are illustrative or synthetic.
