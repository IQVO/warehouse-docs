---
paths:
  - "apis/**"
  - "docs/contexts/**"
  - "docs/api-reference/**"
  - "docusaurus.config.ts"
  - "scripts/gen-async-docs.mjs"
  - "scripts/check-develop-drift.py"
---

# Syncing API specs and context pages from the fleet

Moved verbatim from this repo's CLAUDE.md (now a short map). Paths in another repo are written
as words, not backticked: guide-lint resolves every backticked path in THIS repo.

## Syncing API specs from the fleet (do this before every content refresh)

The `apis/<context>/{openapi,asyncapi}.yaml` files here are **copies**, not
the source of truth. Refresh them from each context repo's own `develop`
(or `main`, once released) before regenerating docs:

```bash
cd ..   # warehouse-systems/ (siblings checked out)
for repo in order-management inventory-storage wes-work-planning \
            fulfillment-execution workforce-management facility-layout \
            process-path-management labor-performance network-fulfillment \
            warehouse-planning product-master network-inventory-planning \
            inbound-receiving slotting-optimization pick-face-replenishment \
            task-interleaving returns-processing exception-management \
            outbound-shipping; do
  git -C "$repo" show origin/develop:apis/openapi.yaml \
    > "warehouse-docs/apis/$repo/openapi.yaml" 2>/dev/null
  git -C "$repo" show origin/develop:apis/asyncapi.yaml \
    > "warehouse-docs/apis/$repo/asyncapi.yaml" 2>/dev/null
done
git -C labor-performance show origin/develop:apis/openapi-reports.yaml \
  > "warehouse-docs/apis/labor-performance/openapi-reports.yaml" 2>/dev/null
```

All nineteen domain contexts in the loop ship BOTH files (network-fulfillment and
order-management included). `warehouse-ops-agent` has no copy here: its
`develop` ships an apis/openapi.yaml, but this site documents it in prose at
`docs/api-reference/warehouse-ops-agent.md`, sourced from its
docs/docs/api-surface.md; `scripts/check-develop-drift.py` reads that spec
only to resolve routes cited on its pages. The one transformation a copy may
carry: root-relative `](/docs/..)` links in a description become absolute
`https://iqvo.github.io/<repo>/docs/..` links (fulfillment-execution), which the
gate applies before comparing. The REST spec list lives in
`docusaurus.config.ts` (the `docusaurus-plugin-openapi-docs` config); the
async list is the `CONTEXTS` array in `scripts/gen-async-docs.mjs`.

The per-context ddd-crew pages (`docs/contexts/<ctx>/<page>.md`, see the
table in `.claude/rules/context-pages-and-sidebar.md`) are synced the same way, from each repo's own docs on
`develop`; never hand-edit those copies either.
