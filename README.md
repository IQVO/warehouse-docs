# retail-network-docs

Domain documentation for **retail-network**: a marketplace-scale retail and
logistics network (catalogue, delivery promise, order sourcing, vendor
connectivity, middle mile, last mile, tracking, node performance) modelled
with Domain-Driven Design, and the one seam through which it connects to the
[warehouse-systems](https://iqvo.github.io/warehouse-docs/) WMS/WES fleet.

## Disclaimer

This project is a domain-driven design study. It is not associated with, endorsed by or affiliated with any company, and it uses no company's code, data, logos or trademarks. All names, figures and examples are illustrative or synthetic.

Published at https://iqvo.github.io/retail-network-docs/.

**Status: design plus ten reference services.** The model in `model/model.yaml` is the source of truth. Each bounded context has a Go service built on the same harness template in its own repository under https://github.com/IQVO (named after the context). Nothing is deployed anywhere: the services have charts and CI, no cluster.
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
