---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: "The terms Order Sourcing speaks (assignment, virtual queue, release, path lock, reassignment, unsourceable) and the neighbour terms it borrows, each with its proposed code identifier."
---

# Ubiquitous Language

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

The code identifiers are the proposed Go names (`package.Type`) from the
model's `ul` entries. Where the model gives no `ul` code, the identifier is the
model's value-object, policy or field name and is marked *(model field)*. The
network-wide glossary is on
[Ubiquitous Language](/network/strategic-design/ubiquitous-language).

## This context's terms

The first six rows are the `ul` entries of `contexts[order-sourcing]`, word
for word. The rest name the value objects, policies and fields the model gives
this context.

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Fulfillment Assignment** | The decision of which node and path fulfil one shipment group. | `assignment.FulfillmentAssignment` | The **Promise**, which only proves one feasible path exists. |
| **Virtual Queue** | Where assignments wait, re-optimisable, until their release point. | `assignment.VirtualQueue` | A queue at the vendor node. Nothing has reached any node while an assignment is queued. |
| **Release (to node)** | Sending a group to one node; for a vendor node this issues a purchase order. | `assignment.Release` | Promise **release** (`PromiseReleased`, a provisional hold that expired in `delivery-promise`). |
| **Path Lock** | The point after which an assignment never changes node: the vendor's acceptance. | `assignment.Lock` | The vendor's pick, which the network cannot see. The acceptance stands in for it. |
| **Reassignment** | Moving a group to another node after a refusal, or while still queued. | `assignment.Reassign` | A **Re-promise**, which changes the customer's window. A reassignment never does. |
| **Unsourceable** | No node can still meet the promise; the group goes back to delivery-promise. | `assignment.StateUnsourceable` | A broken promise. Unsourceable is raised before the deadline, so the promise can still be revised. |
| **Promise Constraint** | What the assignment must honour: `promiseId`, `tier`, `deliverByLatest`, `witnessNodeId`. | `PromiseConstraint` *(model value object)* | The full `PromiseTerms` of `delivery-promise`. Only these four fields cross. |
| **Candidate** | One feasible way to fulfil the group: node, pickup departure, legs, delivery wave, `eta`, `cost`. | `Candidate` *(model value object)* | The **Witness Path**. The witness is one candidate; the best candidate may be another. |
| **Release record** | One attempt to send the group to a node: `releaseNo`, `nodeId`, `releasedAt`, `requiredShipBy`, `outcome` (`ACCEPTED`, `REJECTED`, `EXPIRED`, `PENDING`), `reasonCode`. | `Release` *(model value object)* | The purchase order. A release names a PO by `assignmentId` + `releaseNo`; the PO is owned by `vendor-connectivity`. |
| **Release point** | The instant an assignment leaves the queue: best candidate's pickup cutoff minus node handling time minus vendor ack budget; immediately for `SAME_DAY`. | `releaseAt` *(model field, `VirtualQueue` policy)* | `ackBy`, the vendor's acknowledgement deadline, which `vendor-connectivity` computes after the release. |
| **Vendor ack budget** | The time reserved, before handling must start, for the vendor to acknowledge. | *(model term in `VirtualQueue`)* | The vendor's **ack window** (1h to 24h, per vendor account). |
| **Excluded Node** | A node that refused this group, with the reason. Never released to again for the same promise revision. | `ExcludedNode` *(model value object)*; `ErrNodeExcluded` | A **suspended** node (`NodeSuspended`), which is unavailable to every group. |
| **Assignment Cost** | `legs + crossRegionPenalty + scorecardPenalty + bookPressurePenalty`; ties go to the witness node. | `AssignmentCost` *(model policy)* | The scorecard **Handicap** of `delivery-promise`, which delays a promise's `shipBy`. The scorecard penalty only ranks candidates. |
| **Book pressure** | Knowing that a node's promise book for a cutoff is exhausted, used as a cost penalty. | `PromiseBookPressureView` *(model read model)* | Departure capacity, which `linehaul-transportation` owns. |
| **Assignment version** | A counter that strictly increases with every change of the assignment. | `assignmentVersion` *(model field)*; `ErrStaleAssignmentVersion` | `node-topology`'s service-area `assignmentVersion`, an unrelated counter with the same name. |
| **Fill-or-kill** | A group goes to one node in full; a partial answer is not a thing. | *(business decision)* | Shipment grouping, decided earlier by `delivery-promise`. |

## Neighbour terms this context uses

| Term | Definition (from the owner's `ul`) | Owner and code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Shipment Group** | The lines of an order promised and shipped together from one node. | `delivery-promise`, `promise.ShipmentGroup`; here `groupNo` | A **package**. A group may ship as several packages (`trackingNumbers`). |
| **Promise** | The network's commitment of a delivery window for one shipment group. | `delivery-promise`, `promise.Promise` | The assignment, which decides how the promise is kept. |
| **Witness Path** | The concrete node, pickup, departures and delivery wave that prove a promise is feasible; order-sourcing may choose a different path later. | `delivery-promise`, `promise.WitnessPath`; here `witnessNodeId` | The assigned path. |
| **Service Tier** | `SAME_DAY`, `NEXT_DAY`, `TWO_DAY` or `STANDARD`. | `delivery-promise`, `promise.Tier` | — |
| **Deliver-By Window** | `deliverByEarliest..deliverByLatest` shown to the customer. | `delivery-promise`, `promise.PromiseTerms` | Only `deliverByLatest` binds this context. |
| **Ship-By** | The pickup cutoff at the witness node the package must be ready for. | `delivery-promise`, `promise.PromiseTerms.ShipBy` | **Required Ship-By**, which is the cutoff of the *assigned* node. |
| **Re-promise** | Revising a confirmed promise to a later window when its path is no longer feasible. | `delivery-promise`, `promise.Promise.Revise`; event `PromiseRevised` | A reassignment. |
| **Promise Book** | Capacity ledger of one node pickup cutoff on the promise side. | `delivery-promise`, `book.PromiseBook`; event `PromiseBookExhausted` | Departure capacity. |
| **Purchase Order (PO)** | The instruction to one vendor node to ship one shipment group in full by requiredShipBy. | `vendor-connectivity`, `po.PurchaseOrder`; `poNumber` | The release. One release produces at most one PO. |
| **Acknowledgement** | The vendor's single, whole-order accept or reject. | `vendor-connectivity`, `po.AckDecision` | The lock. Only an `ACCEPT` that succeeds locks. |
| **Ack Window / ackBy** | The deadline for the acknowledgement. | `vendor-connectivity`, `po.PurchaseOrder.AckBy` | The release point. |
| **Required Ship-By** | The pickup cutoff the PO must be ready for; the fleet calls it the CPT. | `vendor-connectivity`, `po.PurchaseOrder.RequiredShipBy`; here `Release.requiredShipBy` | The promise's **Ship-By** at the witness node. |
| **Vendor** | An organisation operating fulfillment nodes for the network (the warehouse-systems fleet is vendor V-WS). | `vendor-connectivity`, `vendor.VendorAccount` | A node. One vendor may operate many nodes. |
| **Node** | One physical building of the network, of exactly one node type. | `node-topology`, `node.Node` | — |
| **Node Operator** | Who runs the building: NETWORK or a VENDOR. | `node-topology`, `node.Operator` | Every `FULFILLMENT_CENTER`, hence every release target, is `VENDOR`-operated. |
| **Operational Profile** | The node's declared operating hours, cutoffs, handling time, throughput cap and time zone, versioned by profileRevision. | `node-topology`, `node.OperationalProfile` | The measured **Scorecard**. |
| **Cutoff** | A local time by which a node declares packages are ready to be handed over; the network schedules one pickup departure per cutoff. | `node-topology`, `node.CutoffSlot` | — |
| **Handling Time** | Declared time from order release to a package ready for handover. | `node-topology`, `node.OperationalProfile.HandlingTime` | — |
| **Region** | A largely self-sufficient partition of the network. | `node-topology`, `region.Region`; drives `crossRegionPenalty` | — |
| **Service Area** | The postal prefixes one delivery station serves. | `node-topology`, `servicearea.ServiceArea` | — |
| **Lane** | A directed, mode-specific connection between two nodes. | `node-topology`, `lane.Lane` | A departure on that lane. |
| **Listing** | A catalogue item offered from one node. | `offer-availability`, `listing.Listing`; `listingId` | The catalogue item. A release carries both `catalogItemId` and `listingId`. |
| **Available Quantity** | What a node claims it can ship now for one listing. | `offer-availability`, `listing.Availability.AvailableQty` | Stock reserved for this group. This context reserves nothing at a node. |
| **Pickup Departure** | The departure that collects packages at a vendor node at one of its declared cutoffs. | `linehaul-transportation`, `departure.KindPickup`; `pickupDepartureId` | — |
| **Departure** | One scheduled trip on a lane with a cutoff and a capacity. | `linehaul-transportation`, `departure.Departure`; `legs[]` | — |
| **Delivery Wave** | A station's dispatch slot: induct cutoff, delivery window and stop capacity. | `last-mile-delivery`, `wave.DeliveryWave`; `deliveryWaveId` | — |
| **Scorecard** | A node's measured performance over a rolling window, with a grade. | `node-performance`, `scorecard.NodeScorecard` | The declared profile. |
| **Grade** | A, B, C or D; PROVISIONAL below the observation minimum. | `node-performance`, `scorecard.Grade` | — |
| **Tracking Number** | The network-wide unique id of one package. | `shipping-and-tracking`, `journey.TrackingNumber` | The group. |
| **Customer Order** | What the shopper bought, with a promise per shipment group. | `customer-ordering`, `order.CustomerOrder`; `orderId` | The assignment, one per group of the order. |

No fleet translation table is needed here: this context never touches the
warehouse-systems fleet. Only `vendor-connectivity` and `node-topology` do;
the canonical mapping is on
[WMS/WES integration](/network/integration/wms-wes-integration).
