---
id: docs-coverage
title: Documentation coverage
sidebar_label: Documentation coverage
description: How completely each application repository documents its own code, measured before and after the October 2026 documentation-coverage campaign, and how the score is computed.
---

# Documentation coverage

Between 2026-10-09 and 2026-10-12 every application repository in the fleet
(15 domain contexts, the console shell and the UI kit) got the same
operational documentation set, written from the code on `develop` and merged
through each repository's normal PR checks. Fleet mean coverage went from
**67 to 100** out of 100. The problems found while writing those pages
are on [Ecosystem gaps](./ecosystem-gaps.md).

## What every repository now documents

| Page | Contents |
|---|---|
| Introduction | What the context owns, its subdomain class and tier, capabilities |
| Architecture | Hexagonal layout, every binary in `cmd/` with ports and probes, data stores, a container diagram |
| Quickstart | Prerequisites, `make` targets, local Postgres and the shared Kafka broker, first calls |
| Configuration | One table per binary: every environment variable, default, whether required, source file |
| Runbook | Helm chart and Deployments, probes, migrations, topics and consumer groups, outbox, DLQ, sweepers, scaling, routine procedures |
| Observability | Every metric instrument, spans, logs, exporters, dashboards, suggested alerts |
| Troubleshooting | Symptom → cause → check → fix, from failure modes visible in the code |
| Testing | Unit, integration (testcontainers), BDD, contract, mutation and architecture tests; `make` targets; CI jobs |
| Integration | Every upstream and downstream edge with protocol, contract and failure behaviour, including absent edges |
| Use cases | Every application use case with trigger, inputs, invariants and events raised |
| MCP tools | Every tool of `cmd/mcp` with inputs and read-only or write annotation (where the context has an MCP server) |

The synced copies of the operational pages are under each context's
**Operations** group in the [Bounded Contexts](/contexts) section. The
frontends keep theirs in their repositories: the console on its
[docs site](https://iqvo.github.io/warehouse-console/), the UI kit as
Markdown under [`docs/`](https://github.com/IQVO/warehouse-ui-kit/tree/develop/docs)
(no Pages site).

## Before and after

Scores are from the same audit run on two commits per repository: the first
parent of the merge of the campaign PR (**before**) and `develop` after the
last campaign PR merged (**after**). "Pages" counts hand-written pages
(README and `docs/**`, excluding ADRs and generated API reference).

| Repository | Before | After | Pages | Missing before | PRs |
|---|---:|---:|---|---|---|
| `order-management` | 77 | 100 | 22 → 29 | configuration, operations, observability, testing, integration, troubleshooting | [#176](https://github.com/IQVO/order-management/pull/176) |
| `inventory-storage` | 83 | 100 | 27 → 33 | configuration, operations, observability, testing, troubleshooting | [#177](https://github.com/IQVO/inventory-storage/pull/177) |
| `wes-work-planning` | 80 | 100 | 37 → 44 | configuration, operations, observability, testing, troubleshooting, use-cases | [#169](https://github.com/IQVO/wes-work-planning/pull/169) |
| `fulfillment-execution` | 84 | 100 | 29 → 35 | configuration, operations, observability, testing, troubleshooting | [#184](https://github.com/IQVO/fulfillment-execution/pull/184) |
| `workforce-management` | 77 | 100 | 32 → 39 | configuration, operations, observability, testing, troubleshooting, use-cases | [#160](https://github.com/IQVO/workforce-management/pull/160) |
| `facility-layout` | 80 | 100 | 26 → 32 | configuration, operations, observability, testing, troubleshooting, use-cases | [#167](https://github.com/IQVO/facility-layout/pull/167) |
| `process-path-management` | 64 | 100 | 17 → 28 | introduction, architecture, quickstart, configuration, operations, observability, testing, integration, troubleshooting, use-cases, subdomain-classification | [#122](https://github.com/IQVO/process-path-management/pull/122) |
| `labor-performance` | 66 | 100 | 18 → 28 | introduction, architecture, quickstart, configuration, operations, observability, testing, integration, troubleshooting, use-cases | [#134](https://github.com/IQVO/labor-performance/pull/134), [#144](https://github.com/IQVO/labor-performance/pull/144) |
| `warehouse-ops-agent` | 70 | 100 | 20 → 30 | architecture, configuration, operations, observability, testing, integration, troubleshooting, use-cases | [#129](https://github.com/IQVO/warehouse-ops-agent/pull/129) |
| `network-fulfillment` | 66 | 100 | 17 → 29 | introduction, architecture, quickstart, configuration, observability, testing, integration, troubleshooting, use-cases, subdomain-classification | [#67](https://github.com/IQVO/network-fulfillment/pull/67) |
| `warehouse-planning` | 74 | 100 | 20 → 29 | quickstart, configuration, operations, observability, testing, troubleshooting, subdomain-classification | [#41](https://github.com/IQVO/warehouse-planning/pull/41) |
| `product-master` | 72 | 100 | 21 → 30 | quickstart, configuration, operations, observability, testing, troubleshooting, subdomain-classification | [#16](https://github.com/IQVO/product-master/pull/16) |
| `network-inventory-planning` | 18 | 100 | 1 → 25 | site-or-docs-dir, introduction, architecture, quickstart, configuration, operations, observability, testing, integration, troubleshooting, use-cases, subdomain-classification, pack, adr-index | [#28](https://github.com/IQVO/network-inventory-planning/pull/28), [#29](https://github.com/IQVO/network-inventory-planning/pull/29) |
| `inbound-receiving` | 76 | 100 | 22 → 30 | quickstart, configuration, operations, observability, testing, troubleshooting, subdomain-classification | [#14](https://github.com/IQVO/inbound-receiving/pull/14) |
| `slotting-optimization` | 29 | 100 | 1 → 25 | site-or-docs-dir, introduction, architecture, quickstart, configuration, operations, observability, testing, integration, troubleshooting, use-cases, subdomain-classification, pack, adr-index | [#6](https://github.com/IQVO/slotting-optimization/pull/6) |
| `warehouse-console` | 74 | 100 | 8 → 13 | configuration, operations, testing, troubleshooting | [#76](https://github.com/IQVO/warehouse-console/pull/76) |
| `warehouse-ui-kit` | 56 | 100 | 1 → 10 | site-or-docs-dir, introduction, architecture, quickstart, configuration, operations, testing, troubleshooting | [#44](https://github.com/IQVO/warehouse-ui-kit/pull/44) |

Two contexts started without a documentation site at all:
`network-inventory-planning` and `slotting-optimization` each got a
Docusaurus site, mirroring `inbound-receiving`'s tooling, in their campaign PR.

## How the score is computed

The audit reads a repository's tree at a git ref (read-only) and scores two
halves equally:

- **Structure (50%)**: whether the hand-written docs contain an
  introduction, architecture, quickstart, configuration, operations
  (runbook), observability, testing, integration, troubleshooting, use-case
  and subdomain-classification page, the 11-page ddd-crew pack and a complete
  ADR index. Frontends are checked for the subset that applies to them; for a
  library with no deployment, a release page counts as its operations page.
- **Content (50%)**: the share of code facts that the hand-written docs name:
  every environment variable read in `cmd/` and `internal/` (non-test), every
  binary, every CloudEvents `type`, every MCP tool, every Kafka topic, every
  OpenTelemetry instrument, every table a migration creates, and every HTTP
  route that is not in `apis/openapi.yaml`. For frontends: every
  `src/features` module, every component and every `VITE_*` variable.

The audit is a floor, not proof of quality: a page that names a fact can
still describe it wrongly. Every campaign PR was therefore also checked
mechanically against its own branch's code (every CloudEvents type in the
docs exists in the code, every ER relationship has a real foreign key, every
Mermaid diagram renders, no page describes authentication that does not
exist), and the claims that drive the gaps page were re-verified by hand.

## Keeping it at 100

- The operational pages are hand-written: nothing regenerates them. A code
  change that adds an environment variable, topic, instrument or route must
  update the matching page in the same PR. labor-performance's `.claude`
  rules already say so; the other repositories' agent rules do not yet.
- Re-run the audit before a release; a drop below 100 names the exact fact
  that is undocumented.
- New docs reach the published per-repo sites only with each repository's
  next develop → main release, because the Docs workflows deploy from `main`.
