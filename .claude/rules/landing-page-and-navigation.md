---
paths:
  - "src/**"
  - "docusaurus.config.ts"
  - "sidebars.ts"
  - "network-sidebars.ts"
  - "storefront-sidebars.ts"
  - "yard-sidebars.ts"
  - "docs/contexts/**"
  - "network/docs/contexts/**"
  - "storefront/docs/contexts/**"
  - "yard/docs/contexts/**"
---

# Landing page and navigation

Moved verbatim from this repo's CLAUDE.md (now a short map). Paths in another repo are written
as words, not backticked: guide-lint resolves every backticked path in THIS repo.

### The landing page (`src/pages/index.tsx`) — four sections, four grids

The site home page is hand-written React, NOT generated, and no CI gate
covers it, so it is the first thing that silently goes stale when a context
is added. It must always carry, in this order:

1. a hero whose lead names **all four** sections and one `button--lg` link
   per section (`/overview`, `/yard/`, `/network`, `/storefront`);
2. `SECTIONS` — one card per section (WMS/WES, Yard Management, Retail Network,
   Digital Storefront) with four links (Overview, Strategic Design, Context
   Map, and API Reference or ADRs where the section has no committed API
   reference). Each card's description states the context COUNT in
   words — update it when a context lands;
3. one `ContextGrid` per section, in the same order, fed by `WMS_CONTEXTS`,
   `YARD_CONTEXTS`, `NETWORK_CONTEXTS` and `STOREFRONT_CONTEXTS`. Each array
   must match its context directories exactly (20 / 2 / 11 / 6 today — recount
   `<section>/docs/contexts` on every change, never trust the old number);
   each entry's `tier` must match that domain's
   `strategic-design/subdomain-classification.md` verdict, and `slug` is the
   context directory name (links resolve to `/contexts/<slug>`,
   `/yard/contexts/<slug>`, `/network/contexts/<slug>`,
   `/storefront/contexts/<slug>`).

The same four-section shape is mirrored in `docusaurus.config.ts`: one navbar
dropdown per section ending in an ADRs link, and one footer column per section
(`wms / wes`, `yard management`, `retail network`, `digital storefront`) ending in Bounded
Contexts, API Reference and ADRs. **Adding a bounded context is not finished
until it appears in its domain's grid and the section card's count is
corrected.**
