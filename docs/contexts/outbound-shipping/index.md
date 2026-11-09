---
id: index
title: Outbound Shipping
sidebar_label: Outbound Shipping
description: "The Supporting, WMS-tier bounded context that owns what leaves on which trailer: load planning from the first manifested package, staging, loading, the bill of lading and the ship-confirm on the trailer's physical departure."
slug: /contexts/outbound-shipping
---

# Outbound Shipping

<span className="badge-supporting">Supporting Subdomain</span>

**Outbound Shipping** is one of the fleet's domain bounded contexts. It sits
in the `wms` tier of the CloudEvents subdomain taxonomy (type segment
`com.warehouse.wms.outbound-shipping.<entity>.<EventName>`). It gets every
manifested package onto the right load before its cutoff, proves what left on
which trailer, and tells the fleet that an order has actually shipped.

`fulfillment-execution` stops at `PackageManifested`: the package is packed
and labelled. `yard-management` owns the trailer, the door work, the seal and
the departure. Between them nothing owned staging, what is on a load, the
bill of lading, or the fact that the goods left; an order's last state was
*Released* (its ADR 0001). This context is that owner. It reacts to the yard's
physical facts and never to a person's say-so: **ship-confirm follows the
trailer's physical departure** (its ADR 0002).

:::info[What is built, what is deployed, and what is planned]
Per this context's ADRs, `apis/` and `cmd/` on `develop` (`1a071bb`, the merge
of its own docs site) and `warehouse-infra` `develop` (`c42c475`), checked
2026-11-09:

**Built on `develop`:** the REST API (13 routes plus `/healthz` and
`/readyz` in `apis/openapi.yaml`), a transactional outbox with relay, **six**
Kafka consumers inside `cmd/api` (fulfillment-execution, dock-scheduling,
yard-management, process-path-management cutoffs, facility-layout and its own
analytics stream, group ids from six mandatory env vars), a read-only MCP
server (`cmd/mcp`: `loads_at_risk` and `missed_loads`, one resource, one
prompt), a Dockerfile, and its own documentation site.

**Not deployed:** the repository has **no Helm chart**, and
`warehouse-infra` `develop` has no `outbound-shipping` entry in
`terraform/apps.yaml` and no `helm-values/outbound-shipping.yaml`. Nothing of
this context runs in the reference cluster, so every edge of it on the
[Context Map](/strategic-design/context-map) is *built, not deployed*
(wired-but-unused where the other end is built too), never live.

**Around it, checked on each sibling's `develop`:** the nine consumed types
are published by their five producers in code. `order-management` (its ADR
0051, dark behind `OUTBOUND_SHIPPING_CONSUMER_MODE`, default `off`) and
`exception-management` (its ADR 0011, `PackageMissedLoad` only) have a
consumer for what this context publishes. `network-fulfillment` and
`yard-management` are named as consumers in ADR 0004 and ADR 0005 but have
**no handler** for these types on their `develop`.
:::

Its three aggregates:

- **OutboundLoad** (`internal/domain/outboundload`): the packages planned to
  leave together for one `(site, cpt, operating date, ship method)`, planned
  from the first manifested package. `PLANNED -> LOADING -> CLOSED ->
  SHIP_CONFIRMED`, with `CANCELLED` for a planned load that has no packages.
  One open load per key is a domain invariant backed by a partial unique index.
- **ShippingPackage** (`internal/domain/shippingpackage`): one manifested
  package on its way to the truck (v1 ships packages, not pallets).
  `EXPECTED`, `STAGED`, `LOADED`, `SHIPPED`, `SHORT_SHIPPED`.
- **BillOfLading** (`internal/domain/billoflading`): the shipping document of
  one confirmed load, issued exactly once per load with carrier, trailer,
  seal, package count and total weight. `ISSUED`, `VOIDED`.

It keeps event-fed **local copies** of what it needs from neighbours (cutoff
schedule, staging locations, dock appointments, door-work completions), never
a live lookup, and one read model, the load board behind the load-adherence
report and the `loads_at_risk` MCP tool.

## This context's pages

The [Business Context](/contexts/outbound-shipping/business-context) and
[Async API](/contexts/outbound-shipping/async-api) pages are written for this
site. Every other page in this context's sidebar is synced from the
repository's own `docs/docs` on `develop`: the full ddd-crew pack (ubiquitous
language, core domain chart, canvases, context map, domain events, message
flow, EventStorming, class, entity-relationship and sequence diagrams), the
use cases and the Operations group (configuration, runbook, observability,
troubleshooting, testing). The REST reference is generated from its
`apis/openapi.yaml`
([REST](/api-reference/rest/outbound-shipping/outbound-shipping-api)).

## Elsewhere

- **Repository**: [github.com/IQVO/outbound-shipping](https://github.com/IQVO/outbound-shipping).
  Its ADRs live under `docs/adr/`: 0001 (bounded context), 0002 (ship-confirm
  follows the physical departure), 0003 (`PackageManifested` carries the ship
  correlation), 0004 (`ShipmentConfirmed` replaces the manual network
  confirmation), 0005 (CloudEvents envelope and type catalogue) and 0006 (the
  yard-management contract is pinned). It also has its own documentation site
  with the same pack plus architecture, quickstart, integration and MCP pages.
- **Fleet-level**: [Context Map](/strategic-design/context-map) (its edges
  K67 to K75, all built, not deployed), the
  [Event Standard](/strategic-design/event-standard-cloudevents) (subdomain
  table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [WMS and WES tiers](/wms-wes).
- **Yard section**: its two yard neighbours, `dock-scheduling` and
  `yard-management`, are documented in the [yard section](/yard/).
