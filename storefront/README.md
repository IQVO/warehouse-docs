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

**Status: built on develop, not deployed** (as-built refresh 2026-10-27). All six
contexts are Go services in their own repos (`IQVO/pricing`,
`IQVO/product-content`, `IQVO/product-discovery`, `IQVO/shopping-cart`,
`IQVO/checkout`, `IQVO/customer-payments`), next to `IQVO/storefront-bff` (the
only storefront edge), `IQVO/storefront-web` (React SSR) and
`IQVO/payment-provider-simulator` (the payment provider stand-in). None has an
entry in warehouse-infra's `terraform/apps.yaml` yet. The model below is the
design the services were built from; the as-built check folds differences
back into it.

## Layout

| Path | What |
| --- | --- |
| `model/model.yaml` | The canonical storefront model. Every aggregate, invariant, command, event, consumer and relationship on the site exists here first. |
| `scripts/check_model.py` | Consistency gate: publish/consume symmetry inside the storefront, plus cross-model rules against `network/model/model.yaml` (read-only): consumed network events exist with the fields needed, sync calls hit only OHS storefront routes, never a restricted or in-org route, and every storefront event uses the `storefront` tier. |
| `scripts/gen_pages.py` | Generates the strategic-design pages from the model; `--check` fails when a page and the model disagree. |
| `docs/` | The site pages (Docusaurus instance `storefront`). |
| `apis/<repo>/openapi.yaml` | Copies of each service's `apis/openapi.yaml` on `develop` (six contexts plus `storefront-bff`), linted with Spectral (`.spectral.yaml`). Refresh with `git -C <repo> show origin/develop:apis/openapi.yaml > storefront/apis/<repo>/openapi.yaml`. The REST reference under `docs/api-reference/rest/` is generated at build time (`npm run gen-api-docs:storefront`) and gitignored. |

The research citations ledger (verbatim quotes and source URLs) is held
privately, outside this repo.

## Local

```bash
python3 storefront/scripts/check_model.py --pages
python3 storefront/scripts/gen_pages.py --check
spectral lint storefront/apis/<repo>/openapi.yaml --ruleset storefront/.spectral.yaml --fail-severity=warn
npm run build
```

## Disclaimer

This project is a domain-driven design study. It is not associated with, endorsed by or affiliated with any company, and it uses no company's code, data, logos or trademarks. All names, figures and examples are illustrative or synthetic.
