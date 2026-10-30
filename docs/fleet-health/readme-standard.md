---
id: readme-standard
title: README standard
sidebar_label: README standard
description: The one README skeleton every repository in the fleet follows — reference implementation, required-by-facts sections, and how compliance is scored.
---

# README standard

Adopted 2026-10-26. Every repository's README follows one section skeleton;
the reference implementation is
[facility-layout's README](https://github.com/IQVO/facility-layout/blob/develop/README.md),
with inventory-storage and order-management as compliant seconds. The canonical
agent rule lives in `agents/fleet/readme-standard.md` (and its byte-identical
`agents/retailnetwork/` twin); each repository carries a copy under
`.claude/rules/fleet/readme-standard.md`.

## The skeleton (order is normative)

1. Title, then ONE identity paragraph: the bounded context, what it owns, what
   it explicitly does not own, and its strategic classification.
2. `## Disclaimer` — immediately after the identity paragraph, canonical text
   verbatim (see the rule). The older study-project blockquote was replaced by
   this section; there is no third wording.
3. `## Documentation` — the repository's own docs site when it has one, else
   its warehouse-docs context pages, plus a page-map table.
4. `## Architecture` — the real hexagonal layering tree and the fitness test
   that enforces it.
5. `## Domain events` or `## Integration` — topic names, the CloudEvents type
   convention with real examples, publishes/consumes per sibling.
6. `## Running it` — real commands, and a `### Configuration` env-var table
   per binary covering every variable the binary reads.
7. `## Observability` — the three OpenTelemetry signals and what is exported.
8. `## API` — every route, the error shape, idempotency, spec link.
9. Conditional sections: analytics data product (when a projector or analytics
   migrations exist), Helm chart (when a chart exists, with the MCP deployment
   subsection when an mcp binary exists), operator micro-frontend (when a web
   remote exists).
10. `## Local development / quality gate`, `## Tests` (real suite names and the
    CI job names the workflow actually runs), `## Architecture Decision
    Records` (index plus count), `## License` when a LICENSE file exists.

## Required by facts

A section is mandatory exactly when the repository has the fact it documents —
a runnable service, an OpenAPI or AsyncAPI contract, a chart, an mcp binary, a
web remote, analytics migrations, ADRs, a license. Document what exists; never
claim what does not; never leave a fact undocumented. Frontend and
infrastructure repositories follow the same skeleton with the service-only
sections dropped.

## Enforcement

The docs-coverage audit (see [Documentation coverage](./docs-coverage.md))
scores a `readme-sections` check per repository: the fact-derived required
sections above, presence scored from the README on the default branch. The
check gates documentation campaigns and is advisory in CI.
