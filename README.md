# retail-network-docs

Domain documentation for **retail-network**: a marketplace-scale retail and
logistics network (catalogue, delivery promise, order sourcing, vendor
connectivity, middle mile, last mile, tracking, node performance) modelled
with Domain-Driven Design, and the one seam through which it connects to the
[warehouse-systems](https://iqvo.github.io/warehouse-docs/) WMS/WES fleet.

## Disclaimer

This project is a domain-driven design study. It is not associated with, endorsed by or affiliated with any company, and it uses no company's code, data, logos or trademarks. All names, figures and examples are illustrative or synthetic.

Published at https://iqvo.github.io/retail-network-docs/.

**Status: proposed design, docs only.** Nothing described here is built.
Facts about a large e-commerce operator, its seller APIs and other benchmarks are on the
Research pages with numbered citations; everything else is the model derived
from them.

## Layout

| Path | What |
| --- | --- |
| `model/model.yaml` | The canonical model. Every aggregate, invariant, command, event, consumer and relationship on the site exists here first. |
| `scripts/check_model.py` | Consistency gate: publish/consume symmetry, states, and every CloudEvents type printed under `docs/`. |
| `docs/` | The site (Docusaurus). |
| `apis/<context>/openapi.yaml` | REST contracts per context; `vendor-connectivity` is the Published Language the fleet's `network-fulfillment` conforms to. |

## Local

```bash
npm ci
python3 scripts/check_model.py --pages
npm run validate:mermaid
npm start
```
