# HARNESS.md — warehouse-docs

What agent harness this repo has, what each piece runs, and when. Model (from
`warehouse-harness-template`, after Böckeler, "Harness engineering for coding agent users"):
**guides** steer an agent before it acts (feedforward), **sensors** report after it acts (feedback);
each is **computational** (deterministic) or **inferential** (LLM). This is the fleet's Docusaurus
documentation site (base branch `main`, published to GitHub Pages), not a Go bounded context: there is
no coverage gate, arch-test, bdd, mutation, api-lint (except the storefront Spectral step below) or
helm chart here. Only what is listed below exists.

harness-template: v4

## Guides (feedforward)

| File | Type | Purpose |
|---|---|---|
| `CLAUDE.md` (`AGENTS.md` is a symlink to it) | computational | Entry point: the four docs instances, structure, spec sync, CloudEvents, key commands, the develop-drift gate, MDX pitfalls, the verification checklist. |
| `agents/fleet/*.md` | computational | CANONICAL fleet rules (CloudEvents, Kafka testing, no-auth and MCP, A2A, agent authority, context boundaries, GitFlow and CI, idempotency and outbox, README standard). `warehouse-harness-template` copies them byte-identical into every repo's `.claude/rules/fleet/`; `scripts/harness/fleet_drift.py` in each repo compares. Edit here first. |
| `agents/retailnetwork/*.md` | computational | The same rule set for the retail-network services. |
| `INCIDENTS.md` | computational | Fleet incident log: every escape with its fix and the sensor that now guards it. |

## Sensors (feedback)

| Sensor | Where | What it runs | Lifecycle | Blocking? |
|---|---|---|---|---|
| `build-check` | `.github/workflows/docs.yml` | `npm run typecheck`; `gen-alert-catalogue --check`; `scripts/capability-map/generate.py --check`; `scripts/a2a-cards.py --check-page`; `scripts/test_agent_catalogue.py` + `scripts/agent-catalogue.py --check-page`; develop-drift gate (`scripts/test_check_develop_drift.py`, then `scripts/check-develop-drift.py`: spec copies byte-equal to each context's develop, cited REST routes exist, no retired REST-guideline shapes); `check:model:*` and `check:pages:*` for network, storefront and yard; Spectral on the storefront OpenAPI contracts; `npm run build` | every PR into main | yes |
| `build` + `deploy` | docs.yml | `npm run build`, GitHub Pages upload and deploy | push to main | delivery |
| `drift` | `.github/workflows/develop-drift.yml` | the develop-drift gate (tests + live check) | nightly + manual | scheduled signal |
| CodeQL | `.github/workflows/codeql.yml` | JavaScript analysis | PR, push, weekly | yes |
| Mermaid render check | `npm run validate:mermaid` | parse and render every Mermaid diagram in a real browser (`docusaurus build` does not) | by hand, per the verification checklist | no (local) |
| Live Pages probe | `curl` of the published URLs (checklist in `CLAUDE.md`) | by hand after a deploy | no |

`check-develop-drift.py` reads the producers' develop through the GitHub API, so `build-check` can go
red on a PR that did not touch the drifted page when a producer moves meanwhile: fix the hit at its
source, never relax the gate.

## Agent runtime harness

Not installed in this repo: no `scripts/harness/hook.py`, no `.claude/settings.json`, no `guide-lint` job.
`CLAUDE.md` is a 400+ line hub document that cites other repositories' paths on purpose, so the
template's `guide_lint.py` (which resolves every cited path in THIS repo and budgets the guide at 150
lines) would fail it by design; adopting the runtime hooks here first needs that guide split into a
short map plus path-scoped rules. GitFlow protection is the branch protection on `main`.

## Incident protocol

Every failure that was not caught before CI ends with the fix, a sensor or guide that would have
caught it, that sensor rolled out fleet-wide, and a row in [INCIDENTS.md](INCIDENTS.md). A row with
no guard is an open gap and says so.
