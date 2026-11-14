---
title: Consumer Contract Testing
sidebar_label: Consumer Contract Testing
description: "The fleet standard for cross-context contract tests: every consumer pins the producer's native OpenAPI/AsyncAPI spec as a byte-copy, the pinned contract gate fails CI on drift, archetypes R1-R4 and E1-E4 define what a consumer must prove, and producers gain oasdiff and Schemathesis parity."
---

# Consumer Contract Testing

Status: accepted. Date: 2026-11-14. Scope: every context in the fleet that calls another context over REST or subscribes to another context's Kafka topics.

Phase 0 of the contract wave audited every consumer-to-producer edge in the fleet, derived from each repository's `origin/develop` (Helm charts for REST wiring, `apis/asyncapi.yaml` for topics) by `network/scripts/fleet_contract_edges.py`. The registry is authoritative:

- [`network/model/contract-edges.json`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/contract-edges.json) — the edge registry: 33 cross-repo REST edges, 7 intra-repo reports edges, 103 cross-repo event topic edges (+4 self-topic loops), 15 external URL envs, and zero subscribed topics without a publishing repo.
- [`network/model/pin-lists.json`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/pin-lists.json) — for each of the 26 consumers, the exact producer specs it must pin.
- [Producer readiness gaps](/network/integration/contract-gaps) — what the 29 producers with at least one consumer still lack.
- Regenerate with `fleet_contract_edges.py --ws ~/warehouse-systems --out DIR`; every fact comes from `origin/develop`, never from working trees.

## CCT-1 Every consumer pins the producer's native spec

Every cross-context consumer keeps a **pin**: a byte-copy of each producer's
native spec — `apis/openapi.yaml` for REST, `apis/asyncapi.yaml` for events —
taken from the producer repository, committed in the consumer repository, and
registered in the consumer's `contracts/pinned.json` (producer repo, spec kind,
path, hash). The pin is the single source the consumer's tests run against; the
consumer never tests against a live producer. Intra-repo reports edges
(`REPORTS_BASE_URL`, the repo's own `:8092` reports binary) are same-repo and
need no pin.

## CCT-2 CI fails on drift: the pinned contract gate

The consumer's CI runs `scripts/harness/pinned_contract_gate.py` (the kit lives
in `warehouse-harness-template` and lands in each repo with the harness). The
gate re-hashes every pinned spec against the copy in the producer repository's
`develop` and **fails on drift**: a producer change is not real for a consumer
until the consumer re-pins it and its archetype tests pass against the new
spec. Drift older than the SLA below is a broken build, not a ticket.

## CCT-3 Consumer test archetypes

| Id | Archetype | What it proves | It fails when |
|---|---|---|---|
| R1 | spec covers call sites | every route the consumer's outbound adapter calls exists in the pinned OpenAPI with the right method and path | the producer removed or reshaped a route the consumer still calls |
| R2 | examples satisfy the spec | every example in the pinned spec validates against its own schema | the producer ships an example its own schema rejects (the examples are the consumer's fixtures) |
| R3 | gateway decodes examples | the consumer's HTTP client decodes every pinned response example into its DTOs | a producer example no longer parses through the consumer's decoding layer |
| R4 | fields-we-read are specified | every response field the consumer reads is declared in the pinned spec | the consumer reads an undeclared field the producer may drop without breaking its own spec |
| E1 | subscription coverage | every topic the consumer subscribes to appears in the pinned AsyncAPI | the consumer's dispatcher subscribes a topic the producer spec no longer declares |
| E2 | golden decode | golden CloudEvents payloads (envelope and data) decode through the consumer's types | the producer's payload shape drifted from the golden files |
| E3 | envelope invariants | CloudEvents 1.0 invariants hold: dispatch on the full `type`, dedupe on `id`, reject non-CloudEvents input to the DLQ | the consumer starts dispatching on a prefix, tolerating a flat envelope, or parsing legacy shapes |
| E4 | unknown-attribute tolerance | a payload with unknown attributes and unknown `data` fields passes through the consumer | the consumer breaks on additive producer change (forward compatibility) |

R1-R4 apply to every REST pin, E1-E4 to every event pin. A consumer meets the
standard when every archetype row that applies to its pins has a test.

## CCT-4 Drift SLA: 2 business days

From the moment the pinned contract gate fails (producer merged a spec change
on `develop`), the consumer has **two business days** to re-pin and pass, or to
agree a rollback with the producer. After that the consumer's `main` is red and
the producer may cut a release without it.

## CCT-5 Producer obligations: oasdiff and Schemathesis parity

Pinning makes drift loud; it does not make the producer's spec testable. Every
producer with at least one consumer must add to its own CI:

- an **oasdiff breaking-change gate** on `apis/openapi.yaml` — removing or
  reshaping a route or response field that a consumer pins is a build failure
  in the producer first;
- **Schemathesis parity** — the producer's implementation satisfies its own
  OpenAPI, so R2/R3 fixtures are honest.

Today **none of the 29 producers runs oasdiff, 22 of 29 lack Schemathesis, and
6 specs (`customer-payments`, `pricing`, `product-content`,
`product-discovery`, `shipping-and-tracking`, `shopping-cart`) ship zero
OpenAPI examples** — see the [gap table](/network/integration/contract-gaps).
A spec without examples cannot satisfy R2/R3 at all; those six are first in
the queue.

## The AsyncAPI channel-perspective convention

:::warning[Read every pinned AsyncAPI in channel perspective]
The fleet's `asyncapi.yaml` files document their OWN topics under `subscribe:`
and the counterparty topics they consume under `publish:` (tagged `consumed`) —
**inverted from the AsyncAPI 2.6 application perspective**. All tooling — pin
scanners, E1 coverage checks, anything that asks "what does this app publish?"
— must read `subscribe:` as publish and `publish:` as consume. Reading it the
spec way silently swaps producers for consumers.
:::

## Banned edges

Two contexts are event-only by design: **`process-path-management` and
`labor-performance` may never pin REST specs**. They make no sibling REST or
MCP calls (their only sync surface is their own intra-repo reports binary and
their own MCP server); they consume sibling facts exclusively over Kafka. A
REST pin appearing in either repository is an architecture violation, not a
contract gap. The registry enforces this: both appear in
`pin-lists.json` with empty REST lists.

## Using the registry

`contract-edges.json` is derived, not curated: REST edges come from chart env
wiring (`*_URL`, `*_BASE_URL`, `*_ENDPOINT` resolved to in-cluster service
hosts), event edges from each spec's subscribed topics matched to the repo
that publishes them. Edges the scanner could only infer from a topic name are
flagged `inferred: true` — five today, all `warehouse.yard-management.events`
consumers plus `wes-work-planning` on `warehouse.network-inventory-planning.events`
— and err on the side of pinning. When a chart and reality disagree, fix the
chart and regenerate; never hand-edit the JSON.
