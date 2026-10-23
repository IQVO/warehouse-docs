---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why the network needs one authoritative registry of its nodes, their declared operational profiles, lanes, regions and service areas, and what that registry deliberately does not decide.
---

# Business Context

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

## The problem

A delivery promise is a claim about a path: this node can have the package
ready by this cutoff, a departure leaves on this lane, this delivery station
serves this postal prefix. Every one of those claims depends on facts about
buildings and the connections between them. If two contexts hold two copies
of "which station serves 1010" or "what time is the cutoff at FC-7", the
network will promise from one copy and route from the other.

Node Topology is the single owner of those facts. It answers four questions,
and only these:

| Question | Answered by |
| --- | --- |
| What buildings exist, of what type, run by whom, in which region and time zone? | `Node` |
| What does each building declare it can do: hours, cutoffs, handling time, throughput cap? | `Node`'s versioned `OperationalProfile` |
| Which buildings are connected, in which direction and mode, with what nominal transit time? | `Lane` |
| Which delivery station serves a postal prefix, and so which region? | `ServiceArea` and `Region` |

Every answer is published as an event, and the neighbours keep their own
local read models of it. The promise hot path never calls this context
synchronously (model `conventions.integration_rules`).

Derived from: model.yaml → `contexts[node-topology].purpose`, `.aggregates`,
`conventions.integration_rules`.

## Actors

| Actor | What they do here | Channel |
| --- | --- | --- |
| **Vendor** (through `vendor-connectivity`) | Registers its own `FULFILLMENT_CENTER`, `INBOUND_CROSS_DOCK` or `RETURNS_CENTER` nodes and declares their operational profile. A vendor never calls this context directly: its write lands in the Vendor API, and `vendor-connectivity` calls `POST /nodes` and `PUT /nodes/{nodeId}/operational-profile` in-organization when it processes the submission. | REST (in-org), Customer/Supplier |
| **Network-ops planner** (person) | Registers the network's own parcel nodes, declares their operational profile (`declaredBy` `NETWORK_OPS`), activates, suspends and retires nodes, opens and closes lanes, assigns service areas and defines regions. | REST, UI |
| **Any context** | Reads a node, lists nodes, lists lanes, resolves a postal prefix. | REST queries, Open Host Service |
| **Seven consuming contexts** | Build local read models from the nine published events. | Kafka, Open Host Service + Published Language |

## Decisions this context makes

These are the model's `business_decisions`, unchanged:

1. A parcel node (`SORTATION_CENTER`, `DELIVERY_STATION`, `AIR_HUB`) is always
   network-operated. A vendor may register only `FULFILLMENT_CENTER`,
   `INBOUND_CROSS_DOCK` or `RETURNS_CENTER` nodes
   (`ErrOperatorNotAllowedForNodeType`;
   [ADR 0004](/adr/0004-parcel-nodes-are-network-operated)).
2. A node takes customer demand only while `ACTIVE`, and only if it has the
   `OUTBOUND` capability. Capabilities come from the node type
   (`DefaultCapabilitiesByType`), never typed by hand.
3. An operational profile is versioned. A new declaration never edits an old
   revision (`ErrStaleProfileRevision`).
4. A lane joins two different nodes along an allowed type pair, and both ends
   must be `ACTIVE` to open it (`ErrLaneLoop`, `ErrLaneTypePairNotAllowed`,
   `ErrLaneEndpointNotActive`).
5. Every postal prefix maps to exactly one delivery station per assignment
   version (`ErrNotADeliveryStation`, `ErrStaleAssignmentVersion`).

Derived from: model.yaml → `contexts[node-topology].business_decisions`,
`.policies`, `node_types`, `lane_rules`.

## Node types

| Node type | Operator allowed | Capabilities | Subtypes |
| --- | --- | --- | --- |
| `FULFILLMENT_CENTER` | `VENDOR` | `OUTBOUND` | `SORTABLE`, `NON_SORTABLE`, `XL`, `SOFT_LINES`, `SUB_SAME_DAY`, `FRESH`, `MICRO` |
| `INBOUND_CROSS_DOCK` | `VENDOR` | `INBOUND` | none |
| `RETURNS_CENTER` | `VENDOR` | `RETURNS` | none |
| `SORTATION_CENTER` | `NETWORK` | `SORT` | none |
| `DELIVERY_STATION` | `NETWORK` | `LAST_MILE` | none |
| `AIR_HUB` | `NETWORK` | `SORT`, `AIR` | none |

Allowed lane pairs (origin to destination), in mode `GROUND` or `AIR`:
FC to SC, FC to DS (direct injection), FC to AIR_HUB, SC to SC, SC to DS,
SC to AIR_HUB, AIR_HUB to AIR_HUB, AIR_HUB to SC, AIR_HUB to DS, and
INBOUND_CROSS_DOCK to FC (an inbound lane, never on a customer path).

Derived from: model.yaml → `node_types`, `lane_rules`.

## How it relates to the Amazon-like reality

The node types follow the public description of a large retailer's network:
fulfillment centres, sortation centres, delivery stations and air hubs, a
regionalized network, and middle-mile lanes between buildings. The facts and
their sources are on [Amazon logistics network](/research/amazon-logistics-network);
this page does not repeat them.

The **operational profile** is modelled after the `operationalConfiguration`
of the Selling Partner API's Supply Sources: a handling time, operating hours
by day, a throughput configuration expressed as a cap in orders per hour or per day,
and a time zone. The mapping of that API surface to this model is on the
[SP-API surface map](/research/sp-api-surface-map). Two fields are this
model's own additions, whatever that surface offers: the **cutoffs** a node
declares (one pickup departure per cutoff, scheduled by
`linehaul-transportation`), and the **sort dwell**, declared only by sortation centres and air hubs.

What a node *declares* is only half of its capability. What it actually does
is measured by `node-performance`, and both feed the promise
([ADR 0003](/adr/0003-declared-and-measured-capability)). This context holds
the declared half only.

## The warehouse-systems fleet as a vendor

The warehouse-systems fleet is vendor `V-WS`, one vendor among potentially
many. Its `facility-layout` classifies each site with a `siteRole`. A site
registers in the network only through the Vendor API of
`vendor-connectivity`, which the fleet's `network-fulfillment` calls. No
fleet service calls this context, and this context never reads fleet data
(model `meta.hard_boundary`).

| Fleet `facility-layout` siteRole | Registers in the network as | Subtype | Via |
| --- | --- | --- | --- |
| `ROBOTICS_SORTABLE_FC` | `FULFILLMENT_CENTER` | `SORTABLE` | `vendor-connectivity` |
| `TRADITIONAL_SORTABLE_FC` | `FULFILLMENT_CENTER` | `SORTABLE` | `vendor-connectivity` |
| `SOFT_LINES_SORTABLE_FC` | `FULFILLMENT_CENTER` | `SOFT_LINES` | `vendor-connectivity` |
| `NON_SORTABLE_FC` | `FULFILLMENT_CENTER` | `NON_SORTABLE` | `vendor-connectivity` |
| `XL_FC` | `FULFILLMENT_CENTER` | `XL` | `vendor-connectivity` |
| `SUB_SAME_DAY_FC` | `FULFILLMENT_CENTER` | `SUB_SAME_DAY` | `vendor-connectivity` |
| `FRESH_GROCERY_FC` | `FULFILLMENT_CENTER` | `FRESH` | `vendor-connectivity` |
| `MICRO_FC` | `FULFILLMENT_CENTER` | `MICRO` | `vendor-connectivity` |
| `SIMULATED_FC` | `FULFILLMENT_CENTER` | `SORTABLE` | `vendor-connectivity` |
| `INBOUND_CROSS_DOCK` | `INBOUND_CROSS_DOCK` | none | `vendor-connectivity` |
| `NATIONAL_INBOUND_CROSS_DOCK` | `INBOUND_CROSS_DOCK` | none | `vendor-connectivity` |
| `RETURNS_CENTER` | `RETURNS_CENTER` | none | `vendor-connectivity` |
| `SORTATION_CENTER` | not registered | none | none: a network-operated node; the fleet's `facility-layout` row is a reference mirror only |
| `DELIVERY_STATION` | not registered | none | none: a network-operated node; the fleet's `facility-layout` row is a reference mirror only |
| `AIR_HUB_GATEWAY` | not registered | none | none: a network-operated node (`AIR_HUB`); the fleet's `facility-layout` row is a reference mirror only |

Derived from: model.yaml → `fleet_site_role_mapping`, `meta.hard_boundary`.

The parcel nodes (`SORTATION_CENTER`, `DELIVERY_STATION`, `AIR_HUB`) are
network-operated. The network's planner registers them here with operator
`NETWORK`. If the fleet keeps rows for such buildings in `facility-layout`,
those rows describe the network's buildings for the fleet's own reference;
they are never registered, and a vendor that tries to register one is refused
with `ErrOperatorNotAllowedForNodeType`.

The fleet's `network-fulfillment` keeps the correspondence between a network
`nodeId` and its own `siteCode` as a **persisted mapping**, never as a string
convention. Term-by-term translation is on the
[Ubiquitous Language](/contexts/node-topology/ubiquitous-language) page and on
[WMS/WES integration](/integration/wms-wes-integration).

## Deliberately out of scope

| Not here | Owner |
| --- | --- |
| Scheduled departures on a lane, their capacity and loads | `linehaul-transportation` (a `Lane` holds only the nominal transit time) |
| Delivery waves and routes inside a station's service area | `last-mile-delivery` |
| Measured performance and grades of a node | `node-performance` |
| What a node can sell, and in what quantity | `offer-availability` |
| Vendor accounts, ack windows, rate limits, and the Vendor API itself | `vendor-connectivity` |
| Which node should hold which item before demand arrives | future context `inventory-placement` (vendors place their own stock) |
| Suspending a node because of poor performance | nobody automatically: `node-performance` never suspends a node; a planner decides |

Derived from: model.yaml → `contexts[*].purpose`, `future_contexts`,
`contexts[node-performance].business_decisions`.
