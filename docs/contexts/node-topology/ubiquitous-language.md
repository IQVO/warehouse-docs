---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: The terms Node Topology speaks, their proposed code identifiers, the neighbour terms it uses, and how each maps to the warehouse-systems fleet's vocabulary.
---

# Ubiquitous Language

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

The terms this context speaks, each with the proposed Go identifier an
implementation must use. The domain-wide glossary is on
[Ubiquitous Language](/strategic-design/ubiquitous-language).

## Context terms

Every `ul` entry of `node-topology` in the model.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Node** | One physical building of the network, of exactly one node type. | `node.Node` | A fleet **site** (`siteCode`): the fleet's own record of a building it runs. One vendor node corresponds to one fleet site only through the fleet's persisted mapping. |
| **Node Type** | `FULFILLMENT_CENTER`, `INBOUND_CROSS_DOCK`, `RETURNS_CENTER`, `SORTATION_CENTER`, `DELIVERY_STATION` or `AIR_HUB`. | `node.Type` | The fleet's `siteRole` (finer grained, for example `ROBOTICS_SORTABLE_FC`); it maps to a node type plus a subtype. |
| **Node Operator** | Who runs the building: `NETWORK` or a `VENDOR`. | `node.Operator` | **Declared by** (`VENDOR` or `NETWORK_OPS`): who declared one profile revision. |
| **Operational Profile** | The node's declared operating hours, cutoffs, handling time, throughput cap and time zone, versioned by `profileRevision`. | `node.OperationalProfile` | The **Scorecard** (`node-performance`): measured, not declared. |
| **Cutoff** | A local time by which a node declares packages are ready to be handed over; the network schedules one pickup departure per cutoff. | `node.CutoffSlot` | **Required Ship-By** (`vendor-connectivity`): the one cutoff instant a purchase order must meet. The fleet's **CPT**: see the fleet translation below. |
| **Handling Time** | Declared time from order release to a package ready for handover. | `node.OperationalProfile.HandlingTime` | Nominal transit (a lane's travel time) and the fleet's `cycleTimeP95` (a measured per-path figure). |
| **Sort Dwell** | Declared minutes a package normally spends inside a sortation centre or air hub between arrival and departure; declared only by those node types. | `node.OperationalProfile.SortDwellMinutes` | Handling Time. |
| **Throughput Cap** | Declared maximum orders per time unit (`HOUR` or `DAY`) a node accepts. | `node.ThroughputCap` | A departure's package capacity (`linehaul-transportation`) and a promise book's share (`delivery-promise`). |
| **Lane** | A directed, mode-specific connection between two nodes. | `lane.Lane` | A **Departure** (one scheduled trip on a lane) and a **Lane Schedule** (the weekly template), both owned by `linehaul-transportation`. |
| **Region** | A largely self-sufficient partition of the network. | `region.Region` | A `region` line of a ship-to address in `customer-ordering` (an address field, not a network partition). |
| **Service Area** | The postal prefixes one delivery station serves. | `servicearea.ServiceArea` | A delivery wave's window (`last-mile-delivery`); a service area says *who* serves a prefix, not *when*. |

Derived from: model.yaml → `contexts[node-topology].ul`.

## Further model terms

Terms that appear in this context's value objects, invariants and events in
the model, but have no `ul` entry of their own.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Node Subtype** | A refinement of `FULFILLMENT_CENTER`: `SORTABLE`, `NON_SORTABLE`, `XL`, `SOFT_LINES`, `SUB_SAME_DAY`, `FRESH`, `MICRO`. | `node.Subtype` (proposed) | Node Type. |
| **Node Capabilities** | `outbound`, `inbound`, `returns`, `sort`, `lastMile`, `air`, derived from the node type by `DefaultCapabilitiesByType`. | `node.NodeCapabilities` | A vendor's claimed availability (`offer-availability`). |
| **Parcel node** | A `SORTATION_CENTER`, `DELIVERY_STATION` or `AIR_HUB`; always operator `NETWORK`. | `node.Type` values | A vendor node. |
| **Profile Revision** | The strictly increasing version of a node's operational profile. | `OperationalProfile.profileRevision` | The aggregate's optimistic-concurrency version (a persistence detail). |
| **Operating Hours by Day** | The hours a node works on each day of the week, in its time zone: `{monday … sunday: {start, end}}` with `HH:mm` times; a missing day is closed. | `OperationalProfile.operatingHoursByDay` | Holidays (`holidays[]`): ISO dates on which the node is closed all day. |
| **Vendor Node Code** | The vendor's own code for one of its nodes, unique per vendor. | `node.VendorRef.vendorNodeCode` | `nodeId`, which the network mints. |
| **Lane Mode** | `GROUND` or `AIR`. | `lane.LaneMode` | Departure kind (`PICKUP`, `LINEHAUL`, `AIR`) in `linehaul-transportation`. |
| **Nominal Transit** | A lane's nominal travel time in minutes. Only `STANDARD` promises may fall back on it. | `lane.NominalTransit` | A scheduled departure's real `departsAt` to `arrivesAt`. |
| **Assignment Version** | The strictly increasing version of a postal prefix's service-area assignment. | `servicearea.ServiceArea.assignmentVersion` | `assignmentVersion` of a `FulfillmentAssignment` in `order-sourcing`, which shares the name and the error `ErrStaleAssignmentVersion` but nothing else. |

Derived from: model.yaml → `contexts[node-topology].aggregates[*].value_objects`,
`.publishes[*].data`, `node_types`, `lane_rules`, `service_tiers`.

## Neighbour terms used here

| Term | Definition | Owner and code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Vendor** | An organisation operating fulfillment nodes for the network (the warehouse-systems fleet is vendor `V-WS`). | `vendor-connectivity`, `vendor.VendorAccount` | Node Operator `VENDOR`, the value on a node. |
| **Vendor API** | The Open Host Service of `vendor-connectivity`; its JSON schemas are the Published Language. | `vendor-connectivity`, `apis/vendor-connectivity/openapi.yaml` | This context's own REST API, which only `vendor-connectivity` and network roles call. |
| **Submission / Transaction** | An asynchronous vendor write and its outcome, reconciled by `transactionId`. | `vendor-connectivity`, `submission.Submission` | A synchronous `POST /nodes` here, which a submission triggers. |
| **Required Ship-By** | The pickup cutoff a purchase order must be ready for; the fleet calls it the CPT. | `vendor-connectivity`, `po.PurchaseOrder.RequiredShipBy` | Cutoff (the recurring local time declared here). |
| **Pickup Departure** | The departure that collects packages at a vendor node at one of its declared cutoffs. | `linehaul-transportation`, `departure.KindPickup` | Cutoff, which it is generated from. |
| **Departure** | One scheduled trip on a lane with a cutoff and a capacity. | `linehaul-transportation`, `departure.Departure` | Lane. |
| **Delivery Wave** | A station's dispatch slot: induct cutoff, delivery window and stop capacity. | `last-mile-delivery`, `wave.DeliveryWave` | Service Area. |
| **Scorecard** | A node's measured performance over a rolling window, with a grade. | `node-performance`, `scorecard.NodeScorecard` | Operational Profile. |
| **Declared vs Measured** | What a vendor says (profile) against what the network observes (scorecard). | `node-performance`, principle | |
| **Service Tier** | `SAME_DAY`, `NEXT_DAY`, `TWO_DAY` or `STANDARD`. | `delivery-promise`, `promise.Tier` | Node subtype `SUB_SAME_DAY`, which is one input to the `SAME_DAY` path. |
| **Listing** | A catalogue item offered from one node. | `offer-availability`, `listing.Listing` | Node. |

Derived from: model.yaml → `contexts[vendor-connectivity|linehaul-transportation|last-mile-delivery|node-performance|delivery-promise|offer-availability].ul`.

## Fleet translation

Network term against the warehouse-systems fleet term. The canonical table
for the whole seam is on [WMS/WES integration](/integration/wms-wes-integration);
these rows are the ones this context owns. The fleet never sees this
context: every row crosses through the Vendor API of `vendor-connectivity`,
and the fleet's `network-fulfillment` translates.

| Network term (this context) | warehouse-systems term | How they relate |
| --- | --- | --- |
| `nodeId` | `siteCode` (`facility-layout`) | The network mints `nodeId` when it registers the node. The fleet's `network-fulfillment` holds the `nodeId` to `siteCode` correspondence as a **persisted mapping**, never as a string convention. |
| `vendorNodeCode` | chosen by `network-fulfillment` for the site | The vendor's own code for the node, unique per vendor. The network never parses it and never derives a `siteCode` from it. |
| Node Type + Subtype | `siteRole` (`facility-layout`) | Mapped by the fleet-site-role table on [Business Context](/contexts/node-topology/business-context) (model `fleet_site_role_mapping`). |
| Parcel node (`SORTATION_CENTER`, `DELIVERY_STATION`, `AIR_HUB`) | `siteRole` `SORTATION_CENTER`, `DELIVERY_STATION`, `AIR_HUB_GATEWAY` | Network-operated. The fleet's rows are reference mirrors only and are never registered. |
| Cutoff | CPT (Critical Pull Time) | A network cutoff is the local time a vendor node declares packages ready for a pickup departure. The fleet plans its floor against its CPT schedule. A purchase order's `requiredShipBy` is one cutoff instant, which the fleet reads as a CPT. |
| Handling Time | `cycleTimeP95` (`process-path-management`) | Handling Time is one declared node-level figure. `cycleTimeP95` is a measured per-path percentile inside the fleet. The fleet may base its declaration on it; the network never sees `cycleTimeP95`. |
| Operational Profile | the fleet's declaration through `PUT /vendor/nodes/{nodeId}/profile` | The fleet composes the profile; this context stores each revision as declared (`declaredBy` `VENDOR`). |

Derived from: model.yaml → `fleet_site_role_mapping`, `meta.hard_boundary`,
`contexts[vendor-connectivity].ul`, `contexts[vendor-connectivity].rest`.
