---
paths:
  - "docs/**"
  - "network/docs/**"
  - "storefront/docs/**"
  - "yard/docs/**"
  - "src/**"
  - "docusaurus.config.ts"
  - ".github/workflows/**"
  - "scripts/validate-mermaid.cjs"
---

# Deployment and the verification checklist

Moved verbatim from this repo's CLAUDE.md (now a short map). Paths in another repo are written
as words, not backticked: guide-lint resolves every backticked path in THIS repo.

## Deployment

Pushing to `main` triggers `.github/workflows/docs.yml` directly — no
develop/main split for this repo (unlike every service repo in the fleet).
Builds the site, publishes via `actions/deploy-pages`. GitHub Pages must be
configured with **Source: GitHub Actions** (Settings > Pages) — see the
fleet ops skill's `github-pages-first-enable.md` if Pages was never turned
on for a repo before.

## Verification checklist after a content refresh

Don't report "the site is built" from a green `npm run build` alone.

1. `npm run build` locally, fix every broken link before pushing;
   `npm run validate:mermaid` must end with `0 failed`, and
   `python3 scripts/capability-map/generate.py --check` and
   `python3 scripts/check-develop-drift.py` must pass. Keep
   every diagram on the WMS & WES and capability pages <= ~1020 px wide
   (github.com renders Mermaid in a ~1010 px frame).
2. Commit + push, then confirm the `docs.yml` run actually completed green
   (not just "workflow started").
3. `curl -s -o /dev/null -w "%{http_code}"` the live GitHub Pages URL
   (https://iqvo.github.io/warehouse-docs/) — homepage, one deep content
   page per major section (incl. `/wms-wes` and
   `/business-capability-architecture`), one generated REST reference page, one generated
   AsyncAPI static page. All must be 200.
