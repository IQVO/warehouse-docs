---
paths:
  - "docs/contexts/**"
  - "sidebars.ts"
---

# Per-context page set and the generated sidebar

Moved verbatim from this repo's CLAUDE.md (now a short map). Paths in another repo are written
as words, not backticked: guide-lint resolves every backticked path in THIS repo.

### Per-context page set (`docs/contexts/<context>/`)

Every context directory has the same page set, in this sidebar order:

| Page | Origin |
| --- | --- |
| `index.md` | hand-written here (most carry a custom `slug: /contexts/<ctx>` — use absolute links only) |
| `business-context.md` | hand-written here |
| `ubiquitous-language.md`, `core-domain-chart.md`, `bounded-context-canvas.md`, `context-map.md`, `aggregate-design-canvas.md`, `domain-events.md`, `domain-message-flow.md`, `eventstorming.md`, `class-diagram.md`, `entity-relationship.md`, `sequence-diagrams.md`, `use-cases.md`, and the Operations group `configuration.md`, `runbook.md`, `observability.md`, `troubleshooting.md`, `testing.md` | **SYNCED COPIES** of the context repo's own ddd-crew artifact pack on `develop` (code-grounded). Each starts with a `:::info[Synced from <repo>]` note linking its source. NEVER rewrite them here: fix the content upstream in the context repo, then re-sync. If one breaks the build, make the minimal link/MDX fix and report it as an upstream fix needed |
| `async-api.md` | hand-written Kafka narrative (topics, envelope example from the spec, publishing, consumer/dedupe/DLQ behaviour), only for contexts that have one: inventory-storage, wes-work-planning, fulfillment-execution, workforce-management, process-path-management, labor-performance, network-fulfillment, warehouse-planning, product-master, network-inventory-planning, inbound-receiving, slotting-optimization, pick-face-replenishment, task-interleaving, returns-processing, exception-management, outbound-shipping |

The Bounded Contexts sidebar is GENERATED in `sidebars.ts` from the
`CONTEXTS` array (the twenty contexts) × `CONTEXT_PAGES` (the page order
above, including `use-cases`) plus the `Operations` group from
`CONTEXT_OPS_PAGES` (configuration, runbook, observability, troubleshooting,
testing), any `CONTEXT_EXTRA_PAGES` (empty today) and
`async-api` for the contexts in `ASYNC_NARRATIVE`. Adding a
context or a page = edit those arrays, not hand-written sidebar entries.
