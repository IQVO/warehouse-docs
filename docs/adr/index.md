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

Ten contexts keep their ADRs under `docs/docs/adr/` (`order-management`, `inventory-storage`, `wes-work-planning`, `fulfillment-execution`, `workforce-management`, `facility-layout`, `process-path-management`, `labor-performance`, `warehouse-ops-agent`, `network-inventory-planning`). The other ten (`network-fulfillment`, `warehouse-planning`, `product-master`, `returns-processing`, `exception-management`, `inbound-receiving`, `slotting-optimization`, `pick-face-replenishment`, `task-interleaving`, `outbound-shipping`) keep them under `docs/adr/`. The counts below cover numbered ADR files on each repository's `develop` branch, re-read on 2026-11-09 against `origin/develop` (every row). `warehouse-ops-agent` has two files numbered 0027, which is why its file count (30) is one more than its highest number.

| Context | ADRs | Newest ADRs | ADR directory |
| --- | --- | --- | --- |
| `order-management` | 51 (0001–0051) | [0051](https://github.com/IQVO/order-management/blob/develop/docs/docs/adr/0051-consume-shipment-confirmed-and-package-missedload.md) Consume ShipmentConfirmed/PackageMissedLoad: the Order ships · [0050](https://github.com/IQVO/order-management/blob/develop/docs/docs/adr/0050-allocation-events-carry-the-orders-fulfillment-site.md) OrderAllocated/OrderPartiallyAllocated carry the order's fulfillment site · [0049](https://github.com/IQVO/order-management/blob/develop/docs/docs/adr/0049-agent-authority-levels-and-complete-mcp-surface.md) Agent authority levels and complete MCP surface | [`docs/docs/adr`](https://github.com/IQVO/order-management/tree/develop/docs/docs/adr) |
| `inventory-storage` | 51 (0001–0051) | [0051](https://github.com/IQVO/inventory-storage/blob/develop/docs/docs/adr/0051-transfer-allocation-release.md) Transfer allocation release — the cancel-after-allocation compensation leg · [0050](https://github.com/IQVO/inventory-storage/blob/develop/docs/docs/adr/0050-deterministic-forward-first-allocation.md) Reservations draw the forward pick face first, in one deterministic order · [0049](https://github.com/IQVO/inventory-storage/blob/develop/docs/docs/adr/0049-adopt-the-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline | [`docs/docs/adr`](https://github.com/IQVO/inventory-storage/tree/develop/docs/docs/adr) |
| `wes-work-planning` | 48 (0001–0048) | [0048](https://github.com/IQVO/wes-work-planning/blob/develop/docs/docs/adr/0048-site-and-forward-pick-face-on-released-work.md) Released work carries its site; pick plans carry a forward pick face · [0047](https://github.com/IQVO/wes-work-planning/blob/develop/docs/docs/adr/0047-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline · [0046](https://github.com/IQVO/wes-work-planning/blob/develop/docs/docs/adr/0046-a2a-inbound-adapter.md) Agent2Agent as an inbound adapter — this context as an A2A agent | [`docs/docs/adr`](https://github.com/IQVO/wes-work-planning/tree/develop/docs/docs/adr) |
| `fulfillment-execution` | 64 (0001–0064) | [0064](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0064-per-stop-work-clock-behind-the-batch.md) The per-stop work clock · [0063](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0063-work-batches-formed-at-assignment-behind-a-mode-gate.md) Work batches form at assignment time, behind a mode gate · [0062](https://github.com/IQVO/fulfillment-execution/blob/develop/docs/docs/adr/0062-pick-tasks-are-announced-to-the-open-task-pool.md) PICK tasks are announced to the open-task pool | [`docs/docs/adr`](https://github.com/IQVO/fulfillment-execution/tree/develop/docs/docs/adr) |
| `workforce-management` | 41 (0001–0041) | [0041](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0041-agent-authority-levels-and-attributable-assignments.md) Agent authority levels and attributable assignments · [0040](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0040-adopt-the-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline · [0039](https://github.com/IQVO/workforce-management/blob/develop/docs/docs/adr/0039-a2a-inbound-adapter.md) A2A inbound adapter (third driving adapter) | [`docs/docs/adr`](https://github.com/IQVO/workforce-management/tree/develop/docs/docs/adr) |
| `facility-layout` | 44 (0001–0044) | [0044](https://github.com/IQVO/facility-layout/blob/develop/docs/docs/adr/0044-adopt-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline · [0043](https://github.com/IQVO/facility-layout/blob/develop/docs/docs/adr/0043-a2a-inbound-adapter.md) A2A inbound adapter (third driving adapter) · [0042](https://github.com/IQVO/facility-layout/blob/develop/docs/docs/adr/0042-case-pick-zone-class-convention.md) The case-pick zone is a convention on the free-form zone class | [`docs/docs/adr`](https://github.com/IQVO/facility-layout/tree/develop/docs/docs/adr) |
| `process-path-management` | 41 (0001–0041) | [0041](https://github.com/IQVO/process-path-management/blob/develop/docs/docs/adr/0041-agent-authority-levels-and-complete-mcp-surface.md) Agent authority levels and complete MCP surface · [0040](https://github.com/IQVO/process-path-management/blob/develop/docs/docs/adr/0040-adopt-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline · [0039](https://github.com/IQVO/process-path-management/blob/develop/docs/docs/adr/0039-a2a-inbound-adapter.md) A2A inbound adapter | [`docs/docs/adr`](https://github.com/IQVO/process-path-management/tree/develop/docs/docs/adr) |
| `labor-performance` | 37 (0001–0037) | [0037](https://github.com/IQVO/labor-performance/blob/develop/docs/docs/adr/0037-adopt-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline · [0036](https://github.com/IQVO/labor-performance/blob/develop/docs/docs/adr/0036-a2a-inbound-adapter.md) A2A inbound adapter (third driving adapter, read-only) · [0035](https://github.com/IQVO/labor-performance/blob/develop/docs/docs/adr/0035-handling-unit-standards-and-team-lift.md) Engineered standards per handling unit and a declared heavy-case team lift | [`docs/docs/adr`](https://github.com/IQVO/labor-performance/tree/develop/docs/docs/adr) |
| `warehouse-ops-agent` | 30 (0001–0029) | [0029](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0029-labor-reallocation-act-slice.md) Labor reallocation act slice (act slice #2) · [0028](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0028-advisory-exception-context-on-release-proposals.md) Advisory exception context on release proposals, asked of exception-management over A2A (read-only) · [0027](https://github.com/IQVO/warehouse-ops-agent/blob/develop/docs/docs/adr/0027-seller-inbound-mcp-client.md) seller-inbound MCP client, wired and golden-pinned | [`docs/docs/adr`](https://github.com/IQVO/warehouse-ops-agent/tree/develop/docs/docs/adr) |
| `network-fulfillment` | 34 (0001–0034) | [0034](https://github.com/IQVO/network-fulfillment/blob/develop/docs/adr/0034-follow-the-vendor-api-page-envelope.md) Follow the Vendor API page envelope, and gate the pinned copy against develop · [0033](https://github.com/IQVO/network-fulfillment/blob/develop/docs/adr/0033-a-full-cutoff-misses-only-its-own-truck.md) A full cutoff misses only its own truck · [0032](https://github.com/IQVO/network-fulfillment/blob/develop/docs/adr/0032-adopt-the-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline | [`docs/adr`](https://github.com/IQVO/network-fulfillment/tree/develop/docs/adr) |
| `warehouse-planning` | 20 (0001–0020) | [0020](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0020-inbound-demand-from-dock-scheduling.md) Inbound demand is read from dock-scheduling's appointment events · [0019](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0019-adopt-the-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline · [0018](https://github.com/IQVO/warehouse-planning/blob/develop/docs/adr/0018-a2a-inbound-adapter.md) A2A inbound adapter (third driving adapter) | [`docs/adr`](https://github.com/IQVO/warehouse-planning/tree/develop/docs/adr) |
| `product-master` | 14 (0001–0014) | [0014](https://github.com/IQVO/product-master/blob/develop/docs/adr/0014-agent-authority-levels-and-complete-mcp-surface.md) Agent authority levels and complete MCP surface · [0013](https://github.com/IQVO/product-master/blob/develop/docs/adr/0013-adopt-the-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline · [0012](https://github.com/IQVO/product-master/blob/develop/docs/adr/0012-a2a-inbound-adapter.md) A2A inbound adapter (third driving adapter) | [`docs/adr`](https://github.com/IQVO/product-master/tree/develop/docs/adr) |
| `network-inventory-planning` | 22 (0001–0022) | [0022](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0022-cancel-after-allocation-compensation.md) Cancel-after-allocation — the transfer saga's compensation leg · [0021](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0021-adopt-the-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline · [0020](https://github.com/IQVO/network-inventory-planning/blob/develop/docs/docs/adr/0020-a2a-inbound-adapter.md) A2A inbound adapter (third driving adapter, read-only) | [`docs/docs/adr`](https://github.com/IQVO/network-inventory-planning/tree/develop/docs/docs/adr) |
| `returns-processing` | 10 (0001–0010) | [0010](https://github.com/IQVO/returns-processing/blob/develop/docs/adr/0010-agent-authority-levels-and-complete-mcp-surface.md) Agent authority levels and complete MCP surface · [0009](https://github.com/IQVO/returns-processing/blob/develop/docs/adr/0009-adopt-the-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline · [0008](https://github.com/IQVO/returns-processing/blob/develop/docs/adr/0008-a2a-inbound-adapter.md) A2A inbound adapter — a read-only Agent2Agent agent over the same read use cases | [`docs/adr`](https://github.com/IQVO/returns-processing/tree/develop/docs/adr) |
| `exception-management` | 11 (0001–0011) | [0011](https://github.com/IQVO/exception-management/blob/develop/docs/adr/0011-package-missed-load-consumer.md) PackageMissedLoad consumer · [0010](https://github.com/IQVO/exception-management/blob/develop/docs/adr/0010-yard-exceptions-consumers-and-routing.md) yard exceptions consumers and routing · [0009](https://github.com/IQVO/exception-management/blob/develop/docs/adr/0009-agent-authority-levels-and-complete-mcp-surface.md) Agent authority levels and complete MCP surface | [`docs/adr`](https://github.com/IQVO/exception-management/tree/develop/docs/adr) |
| `inbound-receiving` | 19 (0001–0019) | [0019](https://github.com/IQVO/inbound-receiving/blob/develop/docs/adr/0019-dockappointment-moves-to-dock-scheduling.md) The DockAppointment moves to dock-scheduling (strangler stages B and C) · [0018](https://github.com/IQVO/inbound-receiving/blob/develop/docs/adr/0018-agent-authority-levels-and-complete-mcp-surface.md) Agent authority levels and complete MCP surface · [0017](https://github.com/IQVO/inbound-receiving/blob/develop/docs/adr/0017-fleet-rest-api-guideline-cutover.md) Fleet REST API guideline cutover | [`docs/adr`](https://github.com/IQVO/inbound-receiving/tree/develop/docs/adr) |
| `slotting-optimization` | 15 (0001–0015) | [0015](https://github.com/IQVO/slotting-optimization/blob/develop/docs/adr/0015-agent-authority-levels-and-complete-mcp-surface.md) Agent authority levels and complete MCP surface · [0014](https://github.com/IQVO/slotting-optimization/blob/develop/docs/adr/0014-adopt-the-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline · [0013](https://github.com/IQVO/slotting-optimization/blob/develop/docs/adr/0013-a2a-inbound-adapter.md) A2A inbound adapter (read-only, unauthenticated, additive) | [`docs/adr`](https://github.com/IQVO/slotting-optimization/tree/develop/docs/adr) |
| `pick-face-replenishment` | 12 (0001–0012) | [0012](https://github.com/IQVO/pick-face-replenishment/blob/develop/docs/adr/0012-agent-authority-levels-and-complete-mcp-surface.md) Agent authority levels and complete MCP surface · [0011](https://github.com/IQVO/pick-face-replenishment/blob/develop/docs/adr/0011-adopt-the-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline · [0010](https://github.com/IQVO/pick-face-replenishment/blob/develop/docs/adr/0010-a2a-inbound-adapter.md) A2A inbound adapter (read-only, unauthenticated, additive) | [`docs/adr`](https://github.com/IQVO/pick-face-replenishment/tree/develop/docs/adr) |
| `task-interleaving` | 12 (0001–0012) | [0012](https://github.com/IQVO/task-interleaving/blob/develop/docs/adr/0012-pick-a-first-class-interleaving-candidate.md) PICK is a first-class interleaving candidate · [0011](https://github.com/IQVO/task-interleaving/blob/develop/docs/adr/0011-agent-authority-levels-and-complete-mcp-surface.md) Agent authority levels and complete MCP surface · [0010](https://github.com/IQVO/task-interleaving/blob/develop/docs/adr/0010-adopt-the-fleet-rest-api-guideline.md) Adopt the fleet REST API guideline | [`docs/adr`](https://github.com/IQVO/task-interleaving/tree/develop/docs/adr) |
| `outbound-shipping` | 6 (0001–0006) | [0006](https://github.com/IQVO/outbound-shipping/blob/develop/docs/adr/0006-yard-contract-pinned.md) The yard-management contract is pinned and tested · [0005](https://github.com/IQVO/outbound-shipping/blob/develop/docs/adr/0005-cloudevents-envelope-and-type-catalogue.md) CloudEvents envelope and type catalogue · [0004](https://github.com/IQVO/outbound-shipping/blob/develop/docs/adr/0004-shipment-confirmed-replaces-the-manual-network-confirmation.md) ShipmentConfirmed replaces the manual network shipment confirmation | [`docs/adr`](https://github.com/IQVO/outbound-shipping/tree/develop/docs/adr) |

`0002-mcp-and-analytics-data-product.md` is `network-fulfillment`'s ADR 0002.

## Cross-cutting decisions worth reading first

Several fleet-wide conventions are recorded once per context, each as that
context's own ADR. The ADR numbers below come from each repository's ADR
titles on `develop`.

- **CloudEvents 1.0 as the mandatory event envelope.** Every context that
  uses Kafka records this decision: order-management 0030,
  inventory-storage 0024, wes-work-planning 0027 (supersedes 0021),
  fulfillment-execution 0032 (supersedes 0027), workforce-management 0026,
  facility-layout 0024, process-path-management 0016, labor-performance
  0021, network-fulfillment 0008, warehouse-planning 0006,
  product-master 0004 and network-inventory-planning 0004.
  `warehouse-ops-agent` uses no Kafka. The [Event Standard](/strategic-design/event-standard-cloudevents)
  page has the fleet-level text, the subdomain table and the cross-service
  `type` catalogue.
- **Transactional outbox.** Every context that publishes events commits them
  in the same database transaction as the aggregate change, and a relay
  sends them to Kafka afterwards. The decision records are
  process-path-management 0003, wes-work-planning 0014,
  labor-performance 0010, workforce-management 0016, inventory-storage
  0017, facility-layout 0018, fulfillment-execution 0020, order-management
  0022, network-fulfillment 0003, warehouse-planning 0007 and
  network-inventory-planning 0003 (with the relay). The
  [Context Map](/strategic-design/context-map) shows how each context
  integrates.
- **Hexagonal ports and adapters.** order-management, inventory-storage,
  wes-work-planning, fulfillment-execution, workforce-management,
  facility-layout and labor-performance record it as their ADR 0001. In
  the other six contexts (process-path-management, warehouse-ops-agent,
  network-fulfillment, warehouse-planning, product-master,
  network-inventory-planning), ADR 0001 records the context's founding
  decision instead.
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
  network-fulfillment 0010 and network-inventory-planning 0010 (the `nip_mfe`
  remote).
- **MCP as an inbound adapter.** Twelve contexts expose an MCP server next to
  REST, over the same use cases: order-management 0010, inventory-storage
  0008, wes-work-planning 0008, fulfillment-execution 0008,
  workforce-management 0008, facility-layout 0007, process-path-management
  0006, labor-performance 0009, network-fulfillment 0002,
  warehouse-planning 0008, product-master 0005 and
  network-inventory-planning 0008 (both read-only tools). Eight of them document their tool surface and
  review gate in `docs/docs/mcp/governance-charter.md`. `warehouse-planning`
  documents its 11 tools in `.claude/rules/mcp.md`. `warehouse-ops-agent` is
  a Customer of several of these MCP surfaces, including `warehouse-planning`'s
  (its ADR 0013, read tools only) and `product-master`'s (its ADR 0020). It also runs its own read-only MCP server
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
