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

:::info[What is built, released, registered, applied and planned]
Per this context's ADRs, `apis/` and `cmd/` on `develop` (`fea067b`, the merge
of its applied-status docs PR 27; the `v0.1.0` tag is `857edfd`) and
`warehouse-infra` `develop` (`db829ff`), checked 2026-11-11, the cluster
re-read read-only on 2026-11-13:

**Built on `develop`:** the REST API (13 routes plus `/healthz` and
`/readyz` in `apis/openapi.yaml`), a transactional outbox with relay, **six**
Kafka consumers inside `cmd/api` (fulfillment-execution, dock-scheduling,
yard-management, process-path-management cutoffs, facility-layout and its own
analytics stream, group ids from six mandatory env vars), a read-only MCP
server (`cmd/mcp`: `loads_at_risk` and `missed_loads`, one resource, one
prompt), a Dockerfile, a Helm chart (`charts/outbound-shipping`, its PR 17),
and its own documentation site.

**Released:** `v0.1.0` on 2026-11-11, cut from `main` (Go 1.27.4).

**Applied and running:** `warehouse-infra` `develop`
registers it (PR 205): a `terraform/apps.yaml` entry (a database, no analytics
read side), `helm-values/outbound-shipping.yaml` (one API replica, the six
consumer groups set, the MCP server off for pod capacity, no relay
Deployment because the API relays the outbox inline), a context dashboard and
alert rules (both registered in the repo and not yet loaded on the cluster:
the platform apply is pending) and the image pin `857edfd-arm64` in
`terraform/targets/k3s.images.yaml`. Applied to the k3s cluster on 2026-11-12:
one `api` replica runs at `857edfd-arm64` on `k3s-agent`, the Argo CD
application is Synced/Healthy and the Kong route `/api/outbound-shipping`
answers 200 (read-only `kubectl`, context `k3s-multipass`, re-read
2026-11-13). The seven Kafka topics were pre-created before the first sync
(8 partitions, replication factor 1), the MCP server is off and there is no
relay Deployment. Seven edges on the
[Context Map](/strategic-design/context-map) are **live** (both ends run):
the five inbound feeds (K67 to K71), its own analytics fold and
`exception-management` (K73, its live ConfigMap carries
`OUTBOUND_SHIPPING_EXCEPTIONS_CONSUMER_GROUP`). Not live: `order-management`
(K72 — both ends run but its consumer is dark: `OUTBOUND_SHIPPING_CONSUMER_MODE`
defaults to `off` and no variable is set), `network-fulfillment` (K74 — its
consumer landed on `develop` on 2026-11-12, PR 165, but the running image
`49587d0` predates the merge) and `yard-management`'s handler for
`LoadingStarted`, `LoadClosed` and `LoadReopened` (K75, not built). The
neighbours `fulfillment-execution`, `dock-scheduling`, `yard-management`,
`process-path-management`, `facility-layout`, `order-management` and
`exception-management` all run.

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
  confirmation), 0005 (CloudEvents envelope and type catalogue), 0006 (the
  yard-management contract is pinned) and 0007 (the dock-scheduling contract is
  pinned). It also has its own documentation site
  with the same pack plus architecture, quickstart, integration and MCP pages.
- **Fleet-level**: [Context Map](/strategic-design/context-map) (its edges
  K67 to K75: seven live since the 2026-11-12 apply — the five inbound feeds,
  the analytics fold and `exception-management`; three not — K72's consumer is
  dark, K74's running image predates its just-merged consumer, K75's handler
  is unbuilt), the
  [Event Standard](/strategic-design/event-standard-cloudevents) (subdomain
  table and type catalogue),
  [Subdomain Classification](/strategic-design/subdomain-classification) and
  the [WMS and WES tiers](/wms-wes).
- **Yard section**: its two yard neighbours, `dock-scheduling` and
  `yard-management`, are documented in the [yard section](/yard/).
