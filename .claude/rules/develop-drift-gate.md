---
paths:
  - "scripts/check-develop-drift.py"
  - "scripts/test_check_develop_drift.py"
  - "scripts/develop-drift-allow.json"
  - ".github/workflows/**"
  - "apis/**"
  - "docs/**"
  - "network/docs/**"
  - "storefront/docs/**"
  - "yard/docs/**"
  - "network/model/**"
  - "storefront/model/**"
---

# The gate against develop

Moved verbatim from this repo's CLAUDE.md (now a short map). Paths in another repo are written
as words, not backticked: guide-lint resolves every backticked path in THIS repo.

## Gate against develop (`scripts/check-develop-drift.py`)

`build-check` runs it on every PR and `.github/workflows/develop-drift.yml` runs it
nightly (it also catches `develop` moving after a docs PR merged). It reads the
`apis/*.yaml` of every context repo's `develop` through the GitHub API and fails on
(1) a spec copy that is not byte-equal to develop (`spec-drift`), (2) a REST route a
page cites (`METHOD /path` in code spans, tables, Mermaid, curl) that is not in the
owning context's develop OpenAPI (`route-missing`), (3) retired REST-guideline
vocabulary: `:verb` routes, `X-Action-Id`, `nextToken`, `purchaseOrders` /
`inboundShipments` envelopes (`retired-shape`). Fix a hit at its source: re-sync a
copy, edit a hand-written page, edit `network/model/model.yaml`,
`storefront/model/model.yaml` or `scripts/capability-map/capabilities.py` for a
generated page, fix the service repo for a synced copy. Deliberate citations take
`{/* drift-allow: reason */}` (end of line, or alone above a block), a
` ```http historical ` fence, or a reasoned entry in
`scripts/develop-drift-allow.json` (an entry that stops matching fails the gate).
ADR bodies and `docs/api-reference/**` are never scanned. Exit 2 means a producer
could not be read: the gate fails closed.
