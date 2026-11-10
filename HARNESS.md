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
| `CLAUDE.md` (`AGENTS.md` is a symlink to it) | computational | Always-loaded map (<= 150 lines): identity, hard rules, commands, where things are written down, and the generated scoped-rules table. |
| `.claude/rules/*.md` | computational | Path-scoped detail (`paths:` frontmatter; Claude Code loads each when a matching file is touched, other runtimes read it from the CLAUDE.md table): fleet scope and classification, the network/storefront/yard instances, site structure, landing page and navigation, per-context pages and sidebar, spec sync, CloudEvents, the develop-drift gate, the AsyncAPI toolchain, MDX pitfalls, deploy and verification. |
| `.claude/agents/*.md` | inferential | Template-managed review subagents (code, architecture, domain), invoked explicitly. |
| `.claude/memory/MEMORY.md` | computational | Durable repo heuristics that are not incidents (this repo's own file). |
| `agents/fleet/*.md` | computational | CANONICAL fleet rules (CloudEvents, Kafka testing, no-auth and MCP, A2A, agent authority, context boundaries, GitFlow and CI, idempotency and outbox, README standard). `warehouse-harness-template` copies them byte-identical into every repo's `.claude/rules/fleet/`; `scripts/harness/fleet_drift.py` in each repo compares. Edit here first. |
| `agents/retailnetwork/*.md` | computational | The same rule set for the retail-network services. |
| `INCIDENTS.md` | computational | Fleet incident log: every escape with its fix and the sensor that now guards it. |

## Sensors (feedback)

| Sensor | Where | What it runs | Lifecycle | Blocking? |
|---|---|---|---|---|
| `guide-lint` | `.github/workflows/ci.yml` | `scripts/harness/guide_lint.py` (skills load, every backticked path in the guides resolves, CLAUDE.md budget), `scripts/harness/repo_lint.py` (config sensors), and the hook, red-issue and repo-lint unit tests | every PR into main, push to main | yes |
| `build-check` | `.github/workflows/docs.yml` | `npm run typecheck`; `gen-alert-catalogue --check`; `scripts/capability-map/generate.py --check`; `scripts/a2a-cards.py --check-page`; `scripts/test_agent_catalogue.py` + `scripts/agent-catalogue.py --check-page`; develop-drift gate (`scripts/test_check_develop_drift.py`, then `scripts/check-develop-drift.py`: spec copies byte-equal to each context's develop, cited REST routes exist, no retired REST-guideline shapes); `check:model:*` and `check:pages:*` for network, storefront and yard; Spectral on the storefront OpenAPI contracts; `npm run build` | every PR into main | yes |
| `build` + `deploy` | docs.yml | `npm run build`, GitHub Pages upload and deploy | push to main | delivery |
| `drift` | `.github/workflows/develop-drift.yml` | the develop-drift gate (tests + live check) | nightly + manual | scheduled signal |
| `specs-refresh` (healer) | `.github/workflows/specs-refresh.yml` | `scripts/test_sync_spec_copies.py`, `scripts/sync-spec-copies.py` (every copy the gate compares, from the producers' develop), then `clean-api-docs` + `npm run build` and the gate; on drift opens/updates the bot PR `chore/specs-refresh` and dispatches its `build-check` and `guide-lint` | 4x a day + manual | no (it fixes what the gate reports) |
| CodeQL | `.github/workflows/codeql.yml` | JavaScript analysis | PR, push, weekly | yes |
| `make check-fast` | `Makefile` (`gen-check` + `drift-test`) | every generated page matches its model or registry, and the offline develop-drift tests | agent Stop hook, when the turn changed code or config files | blocks "done" |
| Mermaid render check | `npm run validate:mermaid` | parse and render every Mermaid diagram in a real browser (`docusaurus build` does not) | by hand, per the verification checklist | no (local) |
| Live Pages probe | `curl` of the published URLs (checklist in `.claude/rules/verification-and-deploy.md`) | by hand after a deploy | no |

`check-develop-drift.py` reads the producers' develop through the GitHub API, so `build-check` can go
red on a PR that did not touch the drifted page when a producer moves meanwhile: fix the hit at its
source, never relax the gate. Spec-copy drift fixes itself: the `specs-refresh` workflow opens the bot
PR `chore/specs-refresh` within hours (merge it on green, then `update-branch` the red PRs). Flow and the
token/setting it needs: `.claude/rules/spec-sync.md`.

## Agent runtime harness

Installed from `warehouse-harness-template` (platform profile: `tools/migrate_v3.py --profile platform`,
then `tools/migrate_v4.py`); the managed files are byte copies refreshed by the template's sync, never
edited here.

- `scripts/harness/hook.py`, wired for Claude Code (`.claude/settings.json`), Codex (`.codex/hooks.json`)
  and OpenCode (`.opencode/plugins/harness.ts`). Pre-tool: blocks pushes to `main`/`develop`, `--no-verify`,
  bare `rm -rf`, and hand edits to the copied specs and generated pages listed in
  `scripts/harness/protected-paths.txt`. Stop: `make check-fast` must be green before the agent says done.
  The post-edit gofmt/vet feedback is a no-op here (no Go). `HARNESS_OFF=1` disables the hooks.
- `scripts/harness/guide_lint.py` + `repo_lint.py`, run by the blocking `guide-lint` job.
- `.github/workflows/ai-review.yml` is template-managed and triggers only on PRs into `develop`, so it never
  runs in this `main`-based repo.
- `scripts/harness/fleet_drift.py` is a no-op here: this repo has no `.claude/rules/fleet/` copy, because
  it OWNS the canonical sets (`agents/fleet/`, `agents/retailnetwork/`) every other repo is compared against.

Go-service sensors (coverage, arch-test, bdd, mutation, api-lint, helm-lint, trivy-scan) do not apply:
there is no Go code, chart or image here. GitFlow protection is the branch protection on `main`.

## Incident protocol

Every failure that was not caught before CI ends with the fix, a sensor or guide that would have
caught it, that sensor rolled out fleet-wide, and a row in [INCIDENTS.md](INCIDENTS.md). A row with
no guard is an open gap and says so.
