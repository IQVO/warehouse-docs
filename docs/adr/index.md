---
id: index
title: Architecture Decision Records
sidebar_label: ADRs
description: Index of ADRs across the fleet, linking to each context's own repository — never copied, so they never drift.
slug: /adr
---

# Architecture Decision Records

Every ADR lives in its owning context's own repository and is published on
that context's own docs site. This page is only an index. Copying ADR content
here would create a second source of truth that drifts, which is what
[Overview](/overview) says this site avoids.

Nine contexts keep their ADRs under `docs/docs/adr/`. `network-fulfillment`
and `warehouse-planning` keep them under `docs/adr/`. The counts below cover
numbered ADR files on each repository's `develop` branch, read on 2026-10-06.

| Context | ADRs | Newest ADRs | ADR directory |
| --- | --- | --- | --- |
| `order-management` | 33 (0001–0033) | [0033](https://github.com/IQVO/order-management/blob/develop/docs/docs/adr/0033-bootretry-and-kafka-writer-tuning.md) boot-time first-dial retry, writer BatchTimeout/acks, DLQ topic-create retry · [0032](https://github.com/IQVO/order-management/blob/develop/docs/docs/adr/0032-housekeeping-sweeper-idempotency-keys-and-outbox.md) housekeeping sweeper · [0031](https://github.com/IQVO/order-management/blob/develop/docs/docs/adr/0031-consume-warehouse-planning-capacity-plans.md) consume warehouse-planning's capacity plans | [`docs/docs/adr`](https://github.com/IQVO/order-management/tree/develop/docs/docs/adr) |
| `inventory-storage` | 29 (0001–0029) | [0029](https://github.com/IQVO/inventory-storage/blob/develop/docs/docs/adr/0029-extra-architecture-fitness-tests.md) additional architecture fitness tests · [0028](https://github.com/IQVO/inventory-storage/blob/develop/docs/docs/adr/0028-bootretry-boot-time-dial-retry.md) boot-time dial retry · [0027](https://github.com/IQVO/inventory-storage/blob/develop/docs/docs/adr/0027-mcp-eval-and-governance-suite.md) MCP governance gate and eval suite | [`docs/docs/adr`](https://github.com/IQVO/inventory-storage/tree/develop/docs/docs/adr) |
| `wes-work-planning` | 32 (0001–0032) | [0032](https://github.com/IQVO/wes-work-planning/blob/develop/docs/docs/adr/0032-housekeeping-retention-sweeper.md) retention sweeper · [0031](https://github.com/IQVO/wes-work-planning/blob/develop/docs/docs/adr/0031-order-allocated-choreography.md) consume `OrderAllocated`/`OrderPartiallyAllocated` by choreography · [0030](https://github.com/IQVO/wes-work-planning/blob/develop/docs/docs/adr/0030-kafka-sourced-path-catalogue.md) Kafka-sourced process-path catalogue | [`docs/docs/adr`](https://github.com/IQVO/wes-work-planning/tree/develop/docs/docs/adr) |
| `fulfillment-execution` | 35 (0001–0035) | [0035](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0035-kafka-hash-partition-key.md) Kafka hash partition key · [0034](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0034-concurrency-control-for-consolidation-and-claim.md) concurrency for consolidation and claim · [0033](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0033-package-read-model.md) package read model | [`docs/docs/adr`](https://github.com/IQVO/fulfillment-execution/tree/develop/docs/docs/adr) |
| `workforce-management` | 32 (0001–0032) | [0032](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0032-bootretry-first-outbound-dial.md) boot-time retry for the first outbound dial · [0031](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0031-kafka-writer-durability.md) Kafka writer durability · [0030](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0030-kafka-sourced-process-path-catalogue.md) Kafka-sourced process-path catalogue | [`docs/docs/adr`](https://github.com/IQVO/workforce-management/tree/develop/docs/docs/adr) |
| `facility-layout` | 31 (0001–0031) | [0031](https://github.com/IQVO/facility-layout/blob/develop/docs/docs/adr/0031-kafka-writer-durability.md) Kafka writer durability · [0030](https://github.com/IQVO/facility-layout/blob/develop/docs/docs/adr/0030-dlq-bounded-retry-and-slog-otel-bridge.md) DLQ bounded retry and slog-to-OTel bridge · [0029](https://github.com/IQVO/facility-layout/blob/develop/docs/docs/adr/0029-gateway-api-httproute.md) Gateway API HTTPRoute | [`docs/docs/adr`](https://github.com/IQVO/facility-layout/tree/develop/docs/docs/adr) |
| `process-path-management` | 25 (0001–0025) | [0025](https://github.com/IQVO/process-path-management/blob/develop/docs/docs/adr/0025-schemathesis-contract-job.md) Schemathesis contract testing · [0024](https://github.com/IQVO/process-path-management/blob/develop/docs/docs/adr/0024-bootretry-for-istio-native-sidecar-warmup.md) boot-time dial retry · [0023](https://github.com/IQVO/process-path-management/blob/develop/docs/docs/adr/0023-mcp-eval-and-governance-harness.md) MCP eval and governance harness | [`docs/docs/adr`](https://github.com/IQVO/process-path-management/tree/develop/docs/docs/adr) |
| `labor-performance` | 30 (0001–0030) | [0030](https://github.com/IQVO/labor-performance/blob/develop/docs/docs/adr/0030-mcp-eval-and-governance-gates.md) MCP eval suite and governance gate · [0029](https://github.com/IQVO/labor-performance/blob/develop/docs/docs/adr/0029-kafka-writer-durability.md) Kafka writer durability · [0028](https://github.com/IQVO/labor-performance/blob/develop/docs/docs/adr/0028-gateway-api-httproute.md) Gateway API HTTPRoute | [`docs/docs/adr`](https://github.com/IQVO/labor-performance/tree/develop/docs/docs/adr) |
| `warehouse-ops-agent` | 15 (0001–0015) | [0015](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0015-core-flow-balance-and-daily-brief-adoption.md) E1 flow balance and E3 daily brief adoption · [0014](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0014-runtime-signals-and-stranded-reservation-adoption.md) runtime signals and stranded reservation · [0013](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0013-warehouse-planning-mcp-client-and-capacity-outlook.md) warehouse-planning MCP client and capacity outlook | [`docs/docs/adr`](https://github.com/IQVO/warehouse-ops-agent/tree/develop/docs/docs/adr) |
| `network-fulfillment` | 14 (0001–0014), plus a redirect stub | [0014](https://github.com/IQVO/network-fulfillment/blob/develop/docs/adr/0014-explicit-shipment-confirmation-endpoint.md) explicit shipment-confirmation endpoint · [0013](https://github.com/IQVO/network-fulfillment/blob/develop/docs/adr/0013-product-translation-file-acl-dictionary.md) ACL product dictionary · [0012](https://github.com/IQVO/network-fulfillment/blob/develop/docs/adr/0012-network-seed-file-stub-demand-seeding.md) stub demand seeding | [`docs/adr`](https://github.com/IQVO/network-fulfillment/tree/develop/docs/adr) |
| `warehouse-planning` | 11 (0001–0011) | [0011](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0011-standard-metrics-adoption.md) standard metrics adoption · [0010](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0010-migrations-over-direct-connection.md) migrations over a direct Postgres connection · [0009](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0009-hpa-and-pgxpool-tuning.md) HPA and pgxpool tuning | [`docs/adr`](https://github.com/IQVO/warehouse-planning/tree/develop/docs/adr) |

In `network-fulfillment`, the number 0002 is used by two files. The real ADR 0002 is
`0002-mcp-and-analytics-data-product.md`.
`0002-retail-network-not-amazon-counterpart.md` is only a "Moved: see
ADR 0009" stub, and it is not counted above.

## Cross-cutting decisions worth reading first

Several fleet-wide conventions are recorded once per context, each as that
context's own ADR. The ADR numbers below come from each repository's ADR
titles on `develop`.

- **CloudEvents 1.0 as the mandatory event envelope.** Every context that
  uses Kafka records this decision: order-management 0030,
  inventory-storage 0024, wes-work-planning 0027 (supersedes 0021),
  fulfillment-execution 0032 (supersedes 0027), workforce-management 0026,
  facility-layout 0024, process-path-management 0016, labor-performance
  0021, network-fulfillment 0008 and warehouse-planning 0006.
  `warehouse-ops-agent` uses no Kafka. The [Event Standard](/strategic-design/event-standard-cloudevents)
  page has the fleet-level text, the subdomain table and the cross-service
  `type` catalogue.
- **Transactional outbox.** Every context that publishes events commits them
  in the same database transaction as the aggregate change, and a relay
  sends them to Kafka afterwards. The decision records are
  process-path-management 0003, wes-work-planning 0014,
  labor-performance 0010, workforce-management 0016, inventory-storage
  0017, facility-layout 0018, fulfillment-execution 0020, order-management
  0022, network-fulfillment 0003 and warehouse-planning 0007. The
  [Context Map](/strategic-design/context-map) shows how each context
  integrates.
- **Hexagonal ports and adapters.** order-management, inventory-storage,
  wes-work-planning, fulfillment-execution, workforce-management,
  facility-layout and labor-performance record it as their ADR 0001. In
  the other four contexts (process-path-management, warehouse-ops-agent,
  network-fulfillment, warehouse-planning), ADR 0001 records the context's
  founding decision instead.
- **RFC 7807 Problem Details.** This is the shared HTTP error convention,
  recorded by inventory-storage 0005, wes-work-planning 0005,
  fulfillment-execution 0005, workforce-management 0005, facility-layout
  0004, process-path-management 0020 and labor-performance 0025.
- **Micro-frontend console architecture.**
  [`warehouse-ops-agent` ADR 0002](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0002-micro-frontend-console-architecture.md)
  establishes the Module Federation console pattern with a thin BFF.
  Adoption ADRs: order-management 0007, inventory-storage 0012,
  workforce-management 0011, facility-layout 0011, fulfillment-execution
  0013, process-path-management 0022, labor-performance 0024 and
  network-fulfillment 0010.
- **MCP as an inbound adapter.** Ten contexts expose an MCP server next to
  REST, over the same use cases: order-management 0010, inventory-storage
  0008, wes-work-planning 0008, fulfillment-execution 0008,
  workforce-management 0008, facility-layout 0007, process-path-management
  0006, labor-performance 0009, network-fulfillment 0002 and
  warehouse-planning 0008. Eight of them document their tool surface and
  review gate in `docs/docs/mcp/governance-charter.md`. `warehouse-planning`
  documents its 11 tools in `.claude/rules/mcp.md`. `warehouse-ops-agent` is
  a Customer of several of these MCP surfaces, including `warehouse-planning`'s
  (its ADR 0013, read tools only). It also runs its own read-only MCP server
  for agentic callers. See its [API surface](/api-reference/warehouse-ops-agent).
- **REST and MCP identity: adopted, then removed.** Static bearer keys with
  read and read-write scopes were decided fleet-wide in
  [`warehouse-ops-agent` ADR 0005](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0005-rest-identity-static-bearer-scopes.md)
  (2026-09-07). They were removed fleet-wide in
  [`warehouse-ops-agent` ADR 0006](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0006-fleet-wide-auth-removal.md)
  (2026-09-09), with one removal ADR per context, for example
  order-management 0012, inventory-storage 0015, wes-work-planning 0016,
  fulfillment-execution 0022, workforce-management 0018, facility-layout
  0015, process-path-management 0005 and labor-performance 0012. Every
  REST and MCP endpoint in the fleet is unauthenticated by deliberate
  decision. This is a study project, not a production system. Bringing auth
  back would need an explicit new decision from the project owner.
