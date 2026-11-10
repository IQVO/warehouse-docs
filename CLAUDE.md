# Project: warehouse-docs (fleet-wide documentation aggregator)

<!-- harness-template: v4 -->

`warehouse-docs` is the [Docusaurus](https://docusaurus.io/) hub of the **warehouse-systems** fleet
(GitHub org `IQVO`): strategic and tactical DDD artifacts, generated REST and AsyncAPI references and
business context for every bounded context, in four docs instances: the WMS/WES fleet at `/` (twenty
backend contexts), the retail network at `/network/`, the digital storefront at `/storefront/` and
the yard at `/yard/`. It is not a bounded context and owns no contract: it reads FROM each context
repo's own specs and docs on `develop` and keeps copies under `apis/` and `docs/contexts/`. It also
holds the canonical fleet rule sets (`agents/fleet/`, `agents/retailnetwork/`). Base branch is `main`;
every push to `main` builds and publishes the site to GitHub Pages: https://iqvo.github.io/warehouse-docs/

> **Study project.** `warehouse-systems` is an educational DDD exercise
> using real industry-standard patterns. Not a production system, not
> affiliated with Manhattan Associates, Blue Yonder, or any other
> company.

## Hard rules

1. **GitFlow on `main` only.** No develop/main split here: a feature branch, then a PR into `main`
   (required check `build-check`). Never push `main` directly, never `--no-verify`.
2. **Copies are never edited here.** `apis/<context>/*.yaml`, `storefront/apis/<repo>/openapi.yaml` and
   the synced ddd-crew pages under `docs/contexts/<context>/` come from each context repo's `develop`:
   fix the source repo, then re-sync (`.claude/rules/spec-sync.md`,
   `.claude/rules/context-pages-and-sidebar.md`). The develop-drift gate fails a copy that is not
   byte-equal to develop (`.claude/rules/develop-drift-gate.md`).
3. **Generated pages are edited through their model.** The four Business Capability Architecture pages
   come from `scripts/capability-map/capabilities.py`; the network, storefront and yard strategic pages
   from `network/model/model.yaml`, `storefront/model/model.yaml` and `yard/model/model.yaml`; the alert
   catalogue from `alerting/`; the REST and AsyncAPI references from `apis/`. Every one has a `--check`
   gate in `build-check`.
4. **CloudEvents 1.0 is the only envelope** any page documents, for integration and analytics topics
   alike; never a flat envelope or a migration caveat (`.claude/rules/events-cloudevents.md`).
5. **REST and MCP are unauthenticated fleet-wide** by deliberate decision: never document auth as
   current. Go module paths inside the service repos are still `github.com/claudioed/<repo>`: expected.
6. **Deployment status is stated as it is**: "built on develop, not deployed" or "registered in
   warehouse-infra, not applied", never "running" without pods to prove it
   (`.claude/rules/docs-instances.md`, `.claude/rules/fleet-scope-and-classification.md`).
7. **The ADR index links out, never copies** a context's ADR trail.
8. **Adding a bounded context is not finished** until it appears in its domain's grid on the landing
   page and the section card's count is corrected (`.claude/rules/landing-page-and-navigation.md`).
9. **`agents/fleet/` and `agents/retailnetwork/` are the canonical fleet rule sets**: the harness template
   copies them byte-identical into every repo's fleet rules and each repo's fleet_drift.py compares
   against them on `main`. Never move or rename them; edit a rule here first, then sync the template.
10. **Never `npx @asyncapi/cli`**; the AsyncAPI toolchain is isolated in `tools/asyncapi-gen/` on purpose
    (`.claude/rules/asyncapi-toolchain.md`).

## Commands

```bash
make install       # npm ci + npm --prefix tools/asyncapi-gen ci
make gen-check     # every generated page matches its model / registry (offline)
make drift-test    # offline tests of the develop-drift gate
make drift-gate    # live gate against develop (needs GITHUB_TOKEN)
make check         # gen-check + drift-test + typecheck
make check-all     # check + drift-gate + build
make check-fast    # gen-check + drift-test: the agent Stop-hook gate
make guide-lint    # these guides: skills load, references resolve, context budget
make harness-test  # unit-test the agent hooks
```

```bash
npm ci
npm run gen-api-docs:all     # regenerate REST reference from apis/*/openapi.yaml
npm run gen-async-docs:all   # regenerate AsyncAPI static HTML from apis/*/asyncapi.yaml
npm run validate:mermaid     # parse + render every Mermaid diagram in a real browser
python3 scripts/capability-map/generate.py          # regenerate the 4 BCA pages from the model
python3 scripts/capability-map/generate.py --check  # exit 1 if a page drifted (CI build-check runs it)
python3 scripts/check-develop-drift.py   # gate against develop (needs GITHUB_TOKEN; exit 2 = producer unreadable)
python3 scripts/test_check_develop_drift.py   # its offline tests
npm run build                 # runs both generation steps, then docusaurus build
npm start                     # dev server at http://localhost:3000
```

## Where things are written down

- `README.md`: layout and contributing. `HARNESS.md`: every sensor and hook this repo runs, and when.
  `INCIDENTS.md`: the fleet incident log (fix + guard per escape).
- `.claude/rules/fleet-scope-and-classification.md`: the twenty contexts, their Core / Supporting /
  Generic classification (must match everywhere) and the fleet facts.
- `.claude/rules/docs-instances.md`: the network, storefront and yard instances and their status.
- `.claude/rules/site-structure.md`: the directory map; `.claude/rules/mdx-pitfalls.md`: slug links, MDX
  traps; `.claude/rules/verification-and-deploy.md`: the Pages deploy and the post-refresh checklist.
- `docs/strategic-design/event-standard-cloudevents.md`: the fleet Event Standard.
- `scripts/develop-drift-allow.json`: reasoned exceptions to the develop-drift gate.
- `agents/fleet/README.md`: how the canonical fleet rules are consumed.
- `.claude/memory/MEMORY.md`: durable repo heuristics that are not incidents.

The detailed sections that used to live in this file are the scoped rules below, moved verbatim.

<!-- harness:scoped-rules:start (generated by tools/migrate_v3.py in warehouse-harness-template; do not hand-edit) -->
## Scoped rules and harness

Claude Code loads each rule below automatically when you touch the matching paths. OpenCode and Codex do NOT: read the rule BEFORE editing matching files.

| When touching | Read |
|---|---|
| `tools/asyncapi-gen/**`, `scripts/gen-async-docs.mjs`, `package.json` ... | `.claude/rules/asyncapi-toolchain.md` |
| `docs/contexts/**`, `sidebars.ts` | `.claude/rules/context-pages-and-sidebar.md` |
| `scripts/check-develop-drift.py`, `scripts/test_check_develop_drift.py`, `scripts/develop-drift-allow.json` ... | `.claude/rules/develop-drift-gate.md` |
| `network/**`, `storefront/**`, `yard/**` ... | `.claude/rules/docs-instances.md` |
| `apis/**`, `docs/**`, `network/docs/**` ... | `.claude/rules/events-cloudevents.md` |
| `docs/**`, `network/docs/**`, `storefront/docs/**` ... | `.claude/rules/fleet-scope-and-classification.md` |
| `src/**`, `docusaurus.config.ts`, `sidebars.ts` ... | `.claude/rules/landing-page-and-navigation.md` |
| `docs/**`, `network/docs/**`, `storefront/docs/**` ... | `.claude/rules/mdx-pitfalls.md` |
| `docs/**`, `apis/**`, `tools/**` ... | `.claude/rules/site-structure.md` |
| `apis/**`, `docs/contexts/**`, `docs/api-reference/**` ... | `.claude/rules/spec-sync.md` |
| `docs/**`, `network/docs/**`, `storefront/docs/**` ... | `.claude/rules/verification-and-deploy.md` |

Hooks (`scripts/harness/hook.py`, wired for Claude Code, Codex and OpenCode) block pushes to develop/main, `--no-verify`, bare `rm -rf`, and edits to generated files, and feed gofmt/vet findings back after each edit. Before saying "done" run `make check-fast`; the full gate is `make check-all`. `HARNESS_OFF=1` disables the hooks when debugging the harness itself.
<!-- harness:scoped-rules:end -->
