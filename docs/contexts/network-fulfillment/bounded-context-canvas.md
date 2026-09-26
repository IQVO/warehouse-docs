---
id: bounded-context-canvas
title: Bounded Context Canvas
sidebar_label: Bounded Context Canvas
description: The full ddd-crew Bounded Context Canvas for network-fulfillment — Conformist to an external retail network, Anti-Corruption Layer for the fleet, Customer of order-management over REST; what is built vs. planned.
---

# Bounded Context Canvas

Following the [ddd-crew Bounded Context Canvas](https://github.com/ddd-crew/bounded-context-canvas).

## Name

**Network Fulfillment**

## Purpose

To be the one place where the fleet meets an external retail fulfillment
network (learning target: Amazon's Selling Partner API, Vendor Direct
Fulfillment): receive the network's demand, answer it — acknowledged in
full or rejected in full, inside the network's 24-hour window — on the
basis of `order-management`'s own feasibility verdict, and keep the
network's vocabulary, credentials and (eventually) customer PII from ever
reaching the rest of the fleet. Its planned headline purpose — advertising
availability constrained by throughput, not just stock
(`CapabilityOffer`) — is designed in [ADR 0001](https://github.com/claudioed/network-fulfillment/blob/develop/docs/adr/0001-network-fulfillment-bounded-context.md) but not built.

## Strategic Classification

| Axis | Verdict |
| --- | --- |
| Domain | **Supporting Subdomain** ([ADR 0001](https://github.com/claudioed/network-fulfillment/blob/develop/docs/adr/0001-network-fulfillment-bounded-context.md)) |
| Business model | Revenue channel enabler — sells the building's fulfillment capability to an external network |
| Evolution | Custom-built — the translation and the throughput-constrained offer are fleet-specific; the network's API itself is a product the fleet conforms to |

## Domain Roles

| Role | Applies here? | Notes |
| --- | --- | --- |
| Anti-Corruption Layer / Gateway | **Yes** | The network's vocabulary stops at `internal/adapters/outbound/network/`; `order-management` receives only SKUs, quantities and a deadline. |
| Execution / Workflow | **Yes, narrowly** | Owns the acknowledgement protocol and its clock (`acknowledgeBy`, the deadline sweep) — not the fulfillment work, which it delegates to `order-management`. |
| Analysis | **Planned** | `CapabilityOffer` would compute advertised availability from inventory, CPT schedule and path capacity. Not built. |
| Published Language / Open Host Service | No | Publishes no events and exposes no MCP; its REST surface is read-only operational visibility. |

## Inbound Communication

| Collaborator | Contract type | Description |
| --- | --- | --- |
| External retail network (stub only) | Poll via `ports.NetworkGateway.PollDemand` | The **only** way demand enters. A poller runs every `POLL_INTERVAL` (default `1m`) and feeds `ReceiveNetworkDemand`; its watermark advances only on a fully successful pass, and receipt is idempotent on `networkRef`. Only the stub gateway exists (seeded from `NETWORK_SEED_FILE`); `NETWORK_MODE` `sandbox` and `live` refuse to boot. |
| Operators / tooling (via Kong, `/api/network-fulfillment`) | HTTP REST, read-only | `GET /healthz` (liveness only), `GET /inbound-status` (`networkMode`, poller counters, unanswered/overdue counts), `GET /network-orders` (orders still `NEW`), `GET /network-orders/{networkRef}` (one order with its lines, state, `acknowledgeBy`, `acknowledgementOverdue`, `localOrderId`). RFC 7807 errors. There is **deliberately no write endpoint**: a second intake path would be fictional (ADR 0001 §5). |

The REST surface is **unauthenticated**, like every service in the fleet
since the fleet-wide auth removal; `TestNoAuthMiddlewareReintroduced`
guards against re-adding auth quietly. [ADR 0001](https://github.com/claudioed/network-fulfillment/blob/develop/docs/adr/0001-network-fulfillment-bounded-context.md) records that
this context **cannot stay unauthenticated once it holds network
credentials and real PII** — that is a future decision, not a quiet
middleware. There is no MCP server and no Kafka consumer.

## Outbound Communication

| Collaborator | Relationship pattern | Integration | Status |
| --- | --- | --- | --- |
| `order-management` | **Customer/Supplier** — this context is the Customer; companion [ADR 0020](https://github.com/claudioed/order-management/blob/develop/docs/docs/adr/0020-network-originated-demand-hold-and-deadline-feasibility.md) is the Supplier's side | Synchronous REST: `POST /orders` (held — `releaseOnAllocation: false`, `allowPartialShipment: false`, `requiredShipBy`), `POST /orders/{id}/release`, `DELETE /orders/{id}` | **Live** in the kind cluster (`ORDER_MANAGEMENT_URL` set by `warehouse-infra/terraform/network-fulfillment.tf`). A null `promiseDate` in the response is read as "not feasible by the deadline", never as an error. |
| External retail network | **Conformist** (upstream we cannot influence) | `ports.NetworkGateway.SubmitAcknowledgement(ref, accepted)`; `SubmitShipmentConfirmation` exists on the port but no use case calls it | **Stub only.** The stub records the answer in memory and logs it. No credentialed SP-API client exists; asynchronous submission and transaction-status reconciliation (ADR 0001 §5) are not built. |
| Postgres (own database) | Persistence, not a context | `network_orders` + `network_order_lines` (`migrations/0001_init.up.sql`) | **Live.** Set `DATABASE_URL` = Postgres or refuse to boot; unset = in-memory repository. Migrations run at startup with a ~31s retry budget. |

This context publishes nothing to Kafka and consumes nothing from it:
`ports.EventPublisher` is wired to a log-only publisher that **no use case
calls**. It has no MCP client and no edge to any sibling other than
`order-management`. See [Domain Events](/contexts/network-fulfillment/domain-events).

## Ubiquitous Language

See [Ubiquitous Language](/contexts/network-fulfillment/ubiquitous-language) for the full glossary:
`NetworkOrder`, `NetworkRef`, `NetworkLineRef`, `NetworkProductId`, `SKU`,
`LocalOrderId`, `SiteId`, `requiredShipBy`, `acknowledgeBy`, held order,
`NETWORK_MODE`, and the planned `CapabilityOffer`.

## Business Decisions

1. **Answer once, in full or not at all.** A NetworkOrder is acknowledged
   in full or rejected in full; there is no partial acknowledgement, and a
   second answer is `ErrAlreadyAnswered`.
2. **One unknown product rejects the whole order**, inside the window, and
   the refusal is recorded (`ReceiveUntranslatable`) rather than the demand
   dropped.
3. **Feasibility is asked, never computed here.** `order-management`'s
   `PromisePolicy.FeasibleBy` is the only authority; duplicating its
   promise math would guarantee drift.
4. **Hold before you commit.** Every network order is raised held and
   ship-complete; released only after acknowledgement, cancelled on
   rejection — cancellation stays on the correct side of
   `order-management`'s release boundary (its ADR 0004).
5. **Correlation is a persisted mapping.** `localOrderId` is stored
   explicitly, one-to-one, and only once acknowledged (also enforced by a
   Postgres `CHECK` constraint).
6. **Never acknowledge late.** The sweep rejects an order still `NEW`
   past `acknowledgeBy` and frees its hold; an acknowledgement after the
   SLA instant would commit to a shipment the network has already
   re-sourced.
7. **`NETWORK_MODE` defaults to `stub`**, and the chosen mode is logged
   and exposed on `/inbound-status` so the running value can be verified,
   not assumed. The kind cluster, `e2e-tests` and CI never need a
   credential.

## Assumptions

- `order-management` stays the single authority on delivery promises,
  and its ADR 0020 hold/feasibility contract stays stable.
- The network's inbound model remains poll-only; a poller outage spends a
  deadline the network set, so `POLL_INTERVAL` is kept far below 24h.
- The curated product-translation file is present in every environment
  expected to accept demand (the kind cluster maps two stub products).
- Single-site simplification: which site an order ships from is not
  modelled beyond the `siteId` the demand carries (inherited from
  `order-management` ADR 0014).

## Verification Metrics

- **Hexagonal boundaries**: `TestHexagonalArchitecture` (arch-go) plus the
  fleet fitness tests — `TestNoAuthMiddlewareReintroduced`,
  `TestKafkaConsumerGroupNeverHardcodedInline`,
  `TestKafkaIntegrationTestsUseTestcontainers` — run in CI's `arch-test`
  job.
- **CI gates**: eight jobs on every PR into `develop` — `lint`, `test`,
  `integration` (Postgres via testcontainers), `api-lint` (Spectral),
  `mutation-fast` (gremlins on `./internal/domain/networkorder`, measured
  thresholds `efficacy: 99`, `mutant-coverage: 92`), `vuln`, `arch-test`,
  `helm-lint`. Coverage gate 90%.
- **Operational**: `GET /inbound-status`'s `failed` poll counter and
  `overdue` count — an overdue order is a missed external SLA.

## Open Questions

- **When does `CapabilityOffer` land, and how?** ADR 0001 plans it on
  three Kafka-fed local caches (inventory availability,
  `CPTScheduleChanged`, `PathCapacityChanged`), each needing a consumer
  group unique per process instance. None exists yet.
- **Authentication and PII.** The first context in the fleet that
  genuinely cannot run unauthenticated once it holds credentials and
  ship-to data — which mechanism, and when, is undecided.
- **Asynchronous submission.** Real acknowledgements are
  accepted-for-processing and must be reconciled via a transaction-status
  query; ADR 0001 wants "submitted but unreconciled" as a visible state.
  Not modelled yet.
- **Can an order be left `NEW`?** In the current `ReceiveNetworkDemand`
  flow an order is saved only after it has been answered, so the
  deadline sweep acts only on `NEW` rows persisted by some other path;
  whether intake should persist `NEW` before calling `order-management`
  (to bound an orphaned hold after a crash) is open.
- **At-risk warning.** ADR 0001 §6 designs a sweep that raises
  `AcknowledgementDeadlineAtRisk` *before* the deadline without mutating
  the aggregate; the implemented sweep instead rejects *after* the
  deadline. The warning event is not built.
