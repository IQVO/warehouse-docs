# storefront (digital storefront docs instance)

Domain documentation for the **digital storefront**: an e-commerce storefront
(browse, search, product page with real delivery dates, cart, checkout with
payment, order history and tracking) modelled with Domain-Driven Design as six
bounded contexts in a `storefront` tier, built on top of the
[retail network](/network/)'s published APIs and events, without duplicating
any capability the network already owns.

Served at `/storefront/` inside
[warehouse-docs](https://github.com/IQVO/warehouse-docs); not a standalone
site.

**Status: proposed design, docs only.** Nothing described here is built. The
model is derived from public e-commerce UX research and the retail-network
model; everything else is the design this site proposes.

## Layout

| Path | What |
| --- | --- |
| `model/model.yaml` | The canonical storefront model. Every aggregate, invariant, command, event, consumer and relationship on the site exists here first. |
| `scripts/check_model.py` | Consistency gate: publish/consume symmetry inside the storefront, plus cross-model rules against `network/model/model.yaml` (read-only): consumed network events exist with the fields needed, sync calls hit only OHS storefront routes, never a restricted or in-org route, and every storefront event uses the `storefront` tier. |
| `scripts/gen_pages.py` | Generates the strategic-design pages from the model; `--check` fails when a page and the model disagree. |
| `docs/` | The site pages (Docusaurus instance `storefront`). |
| `apis/<context>/openapi.yaml` | Proposed REST contracts per context, linted with Spectral (`.spectral.yaml`). |

The research citations ledger (verbatim quotes and source URLs) is held
privately, outside this repo.

## Local

```bash
python3 storefront/scripts/check_model.py --pages
python3 storefront/scripts/gen_pages.py --check
spectral lint storefront/apis/<context>/openapi.yaml --ruleset storefront/.spectral.yaml --fail-severity=warn
npm run build
```

## Disclaimer

This project is a domain-driven design study. It is not associated with, endorsed by or affiliated with any company, and it uses no company's code, data, logos or trademarks. All names, figures and examples are illustrative or synthetic.
