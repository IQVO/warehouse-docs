---
title: Consumer Contract Testing
sidebar_label: Consumer Contract Testing
description: "The fleet standard for cross-context contract tests: every consumer pins the producer's native OpenAPI/AsyncAPI spec as a byte-copy, the pinned contract gate fails CI on drift, archetypes R1-R4 and E1-E4 define what a consumer must prove, producers gain oasdiff and Schemathesis parity, and a daily pin-drift report plus a refresh runbook keep the pins current."
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

The SLA is enforced by people, not by the report: the [daily pin-drift
report](#pin-drift-report) is **informational** and never fails a build. Its
practical consequence is simple: **a stale pin must be refreshed before the next
unrelated consumer PR needs to merge**, because that PR is where the pinned
contract gate turns red and the drift gets discovered the expensive way.

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

Update, 2026-11-15: the producer-parity wave has started landing. The gates and
example backfills merged for `facility-layout`, `order-management`,
`inventory-storage`, `fulfillment-execution`, `workforce-management`,
`product-master` (plus Schemathesis), `wes-work-planning`, `dock-scheduling`
(Schemathesis) and `yard-management`; the counts above are the 2026-11-14 audit
baseline, so read the [gap table](/network/integration/contract-gaps) for the
current state.

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

## Pin drift report

Pins go stale the moment a producer's `develop` changes — comment tweaks and
example backfills included — and the consumer's pinned contract gate only runs
when a PR of that consumer runs it. Left alone, drift is found by an unrelated
consumer PR going red; in one afternoon four producer spec merges made pins
stale, two of them features outside the contract campaign.

[`scripts/pin-drift-report.py`](https://github.com/IQVO/warehouse-docs/blob/main/scripts/pin-drift-report.py)
is the fleet sensor. It reads `contracts/pinned.json` on the `develop` of every
repository in the org through `gh api` (no clones: origin truth, not a stale
working tree) and byte-compares each pin's local copy with the producer's file at
`pin.ref`. The Markdown report groups drift by producer (who must refresh after
this spec change) and by consumer (what one refresh PR must cover), flags
**SELF** pins, prints a `+/-` line stat per pin so a comment-only change can be
told from a schema change, and lists **unreadable** pins (a producer path that
was deleted or renamed, a missing pin copy, a malformed `pinned.json`) in their
own section — those need a decision, not a copy. It exits 0 whenever it ran and
2 on an API or auth failure.

The [`Pin drift` workflow](https://github.com/IQVO/warehouse-docs/blob/main/.github/workflows/pin-drift.yml)
runs it daily at 07:00 UTC (and on demand) with the default `GITHUB_TOKEN`,
permissions `contents: read` and `issues: write` only, and keeps **one** tracking
issue titled `Pin drift report`, found by the label `contract-pin-drift`: it is
created or rewritten in place while drift exists, closed when the fleet is clean
and reopened when drift returns. The workflow is deliberately read-only. The
default `GITHUB_TOKEN` cannot open pull requests in other repositories and the
fleet holds no PAT or GitHub App for it (and none is to be added), so the refresh
below stays a human- or agent-triggered runbook.

## Refresh runbook

A **refresh** re-takes the byte-copy of the producer's file from its `develop`
into the consumer's pin path. It is **never hand-edited**: the pin is evidence of
what the producer publishes, and the gate compares bytes.

The order:

1. **A producer PR merges** a change to `apis/openapi.yaml` or
   `apis/asyncapi.yaml` (any change, cosmetic ones too).
2. **The drift report lists the consumers.** Use the issue (or run
   `python3 scripts/pin-drift-report.py` from this repository for a fresh answer)
   — never a consumer list written from memory.
3. **One refresh PR per drifted consumer.** In the consumer repository, from
   `origin/develop`: copy the producer's file over the pin
   (after `git fetch origin` in the producer: `git -C ../<producer> show origin/develop:apis/openapi.yaml > <pin path from contracts/pinned.json>`),
   run the gate with `python3 scripts/harness/pinned_contract_gate.py`, then the
   repo's full gates including `go test ./...`.
4. **Fix the tests the new spec invalidates**, in the same PR: an R2/R3 fixture
   the producer changed, an E1 topic that disappeared, a [tripwire](#tripwire-tests)
   that fired. A red test after a pure re-copy is information about the
   producer's change, not noise.
5. **Re-run the report after merging.** Hot producers move again while a refresh
   PR is open: re-copy the file on the same branch, re-run gate and tests, and
   push; do not argue with the drift.

`python3 scripts/harness/pinned_contract_gate.py` is the check in both
directions: it fails before the refresh and passes after.

**SELF pins.** A repository that pins its **own** `asyncapi.yaml` or
`openapi.yaml` (an analytics projector, a reports binary) is red **after** its
own spec change merges, not before. The gate compares the pin with `develop`, and
until the spec PR merges `develop` still carries the old bytes, so the PR looks
green and `develop` goes red at the merge. Plan the self-pin refresh as a
follow-up PR in the same repository and do it first: it blocks every other PR in
that repository until it merges.

## Tripwire tests

A consumer test may **deliberately** fail when a producer fixes a quirk that the
consumer's tests work around. Such a test is a tripwire: it asserts the quirk
exists so the day the producer fixes it, someone looks.

Example: `network-inventory-planning`'s
`TestGoldenSharedIDIsDedupedAcrossTypes_Fulfillment` replayed the pinned
`fulfillment-execution` examples, which all reused **one** CloudEvents `id`
across event types, to prove the consumer dedupes on `id` across types. When
`fulfillment-execution` diversified its example ids, the test fired on the
consumer's pin refresh.

The right response is to **restate the invariant as the consumer's own**, not to
delete the test: keep asserting that the id gate dedupes across types, but force
the shared id on a clone of the examples instead of inheriting it from the
producer's data, and say so in the refresh PR. A tripwire that is deleted when
it fires protects nothing the next time.

## Lessons

- **`oasdiff` exits 0 on breaking changes.** oasdiff v1.38.0 prints breaking
  changes but its exit code stays 0 unless called with `--fail-on ERR`. A
  producer gate without the flag is decoration.
- **The fleet's `asyncapi.yaml` has four shapes**, and a pin parser must read all
  of them:
  1. 2.6 in channel perspective: the dominant shape, own topics under `subscribe:`
     (see the convention above);
  2. 2.6 in app perspective: own topics under `publish:` (`process-path-management`);
  3. AsyncAPI 3.0: channels keyed by a logical name with the topic in `address`,
     channel-level `messages` maps, and possibly an `operations:` section too
     (`yard-management`, and `network-inventory-planning`'s own spec);
  4. 2.6 with channel-level `messages:` maps and no operations at all.

  Resolve a channel by map key **or** address and read both operation-level
  `oneOf` references and channel-level messages; a channel-perspective-only
  parser fails shapes 3 and 4 with "no channel for topic".
- **Consumer lists come from scanning `contracts/pinned.json`, never from
  memory.** Briefs that named consumers from memory were wrong three times in the
  campaign (for example, `workforce-management`'s real consumers differed from the
  list in its brief). The drift report and the registry are the sources.
- **Hot producers go stale while a refresh PR is open.** A producer several
  teams merge into can move again before the refresh PR lands. Re-copy on the
  same branch and re-run gate and tests; fighting it costs more than redoing it.
- **Run refreshes serially** when they run lefthook and `golangci-lint`: parallel
  runs collide on the single-instance lint lock (`parallel golangci-lint is
  running`), a tool-concurrency failure rather than a code failure. Wait and
  retry.
