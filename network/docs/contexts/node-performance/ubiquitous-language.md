---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: The terms Node Performance speaks, mapped to proposed code identifiers, plus the neighbour terms it reads.
---

# Ubiquitous Language

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

The terms this context owns come from `contexts[node-performance].ul`. The
metric terms that have no `ul` entry come from the `Metrics` value object of
`NodeScorecard`; their definitions say only what the model says, and the
gaps are listed at the end. Code identifiers are proposed Go names
(`package.Type`).

## This context's terms

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Scorecard** | A node's measured performance over a rolling window, with a grade. One per node and window: `scorecardId = nodeId + ':' + window`. | `scorecard.NodeScorecard` | The **Operational Profile** (`node-topology`): what the vendor declares. A scorecard is never derived from it. |
| **Window** | The rolling period a scorecard covers: 7 days or 30 days. | `scorecard.Window` (part of `scorecardId`) | The **Ack Window** of a purchase order (`vendor-connectivity`), which is hours, not days. |
| **On-Time Handover Rate** | Share of packages handed over before `requiredShipBy`. | `scorecard.Metrics.OnTimeHandoverRate` | Promise-kept rate: on-time handover is judged at the node's door, the promise at the customer's. |
| **Late Ack Rate** | Share of purchase orders acknowledged in the last 10% of the window or expired. | `scorecard.Metrics.LateAckRate` | Expiry rate, which counts only expired purchase orders. |
| **Reject rate** | The `rejectRate` metric: from `PurchaseOrderRejected` observations. | `scorecard.Metrics.RejectRate` (value object field) | A rejection by `order-sourcing` (there is none; only the vendor rejects). |
| **Expiry rate** | The `expiryRate` metric: from `PurchaseOrderExpired` observations. | `scorecard.Metrics.ExpiryRate` (value object field) | Late Ack Rate, which also counts late but in-time acknowledgements. |
| **Promise-kept rate** | The `promiseKeptRate` metric: from `PromiseKept` and `PromiseBroken` observations of the node. | `scorecard.Metrics.PromiseKeptRate` (value object field) | **Promise Kept / Broken** itself, which is `delivery-promise`'s judgement of one promise. |
| **Feed freshness p95** | The `feedFreshnessP95Minutes` metric: from `InventoryFeedApplied` observations of the node. | `scorecard.Metrics.FeedFreshnessP95Minutes` (value object field) | `asOf` on a listing (`offer-availability`), which this context never sees. |
| **Observations** | The number of facts counted in the window; a grade needs `observations >= minObservations`. | `scorecard.Metrics.Observations` | A CloudEvents message: one consumed event may be one observation, and is counted once (`ErrDuplicateObservation`). |
| **Grade** | `A`, `B`, `C` or `D`; `PROVISIONAL` below the observation minimum. | `scorecard.Grade` | Node status (`ACTIVE`, `SUSPENDED`): a `D` grade never suspends a node. |
| **Provisional / Graded** | The two states of a scorecard: below the observation minimum, or graded. | `scorecard.StateProvisional`, `scorecard.StateGraded` | `PROVISIONAL` as a **Promise** state in `delivery-promise` (a promise awaiting order placement). Same word, different context. |
| **Threshold breach** | A metric crossing its threshold downward, reported as `NodeThresholdBreached`. | `scorecard.ThresholdAlert` (policy) | A grade change: a breach is reported per metric, the grade is computed over three metrics. |
| **Declared vs Measured** | What a vendor says (profile) against what the network observes (scorecard). | (principle) | A comparison metric: the model defines no metric that reads the declaration. |

## Neighbour terms this context uses

| Term | Definition (owner's) | Code identifier (owner) | Not to be confused with |
| --- | --- | --- | --- |
| **Node** | One physical building of the network, of exactly one node type. | `node.Node` (`node-topology`) | A vendor: one vendor may operate many nodes. |
| **Operational Profile** | The node's declared operating hours, cutoffs, handling time, throughput cap and time zone, versioned by `profileRevision`. | `node.OperationalProfile` (`node-topology`) | The Scorecard. |
| **Handling Time** | Declared time from order release to a package ready for handover. | `node.OperationalProfile.HandlingTime` (`node-topology`) | Any measured duration; this context does not measure handling time. |
| **Vendor** | An organisation operating fulfillment nodes for the network (the warehouse-systems fleet is vendor V-WS). | `vendor.VendorAccount` (`vendor-connectivity`) | A node. |
| **Purchase Order (PO)** | The instruction to one vendor node to ship one shipment group in full by `requiredShipBy`. | `po.PurchaseOrder` (`vendor-connectivity`) | A customer order (`customer-ordering`). |
| **Acknowledgement** | The vendor's single, whole-order accept or reject. | `po.AckDecision` (`vendor-connectivity`) | A shipment confirmation. |
| **Ack Window / ackBy** | The deadline for the acknowledgement. | `po.PurchaseOrder.AckBy` (`vendor-connectivity`) | The scorecard Window. |
| **Required Ship-By** | The pickup cutoff the PO must be ready for; the fleet calls it the CPT. | `po.PurchaseOrder.RequiredShipBy` (`vendor-connectivity`) | **Ship-By** on a promise, which may be later because of the handicap. |
| **Submission / Transaction** | An asynchronous vendor write and its outcome, reconciled by `transactionId`. | `submission.Submission` (`vendor-connectivity`) | An observation. |
| **Vendor API** | The Open Host Service of `vendor-connectivity`; its JSON schemas are the Published Language. | `apis/vendor-connectivity/openapi.yaml` | This context's API, which only `vendor-connectivity` calls. |
| **Handover** | The instant a vendor node's package enters the network. | `journey.HandedOver` (`shipping-and-tracking`) | Shipment confirmation, which is the vendor's own statement. |
| **Inventory Feed** | One vendor submission of availability for one node, full or partial. | `feed.InventoryFeed` (`offer-availability`) | Its quantities, which this context ignores. |
| **Promise Kept / Broken** | The judgement at delivery against `deliverByLatest`. | `promise.Judgement` (`delivery-promise`) | Promise-kept rate (this context's aggregate of those judgements). |
| **Handicap** | The scorecard-driven delay applied to a node's `shipBy`. | `promise.ScorecardHandicap` (`delivery-promise`) | A suspension. The handicap is owned and applied by `delivery-promise`. |
| **Fulfillment Assignment** | The decision of which node and path fulfil one shipment group. | `assignment.FulfillmentAssignment` (`order-sourcing`) | The grade, which is one input of its `AssignmentCost`. |

## Fleet translation

None. This context has no edge to the warehouse-systems fleet. A vendor
(the fleet included) sees its scorecard only through `vendor-connectivity`'s
Vendor API; the canonical network ↔ fleet term table is on
[WMS/WES integration](/network/integration/wms-wes-integration).

## Terms the model leaves open

| Term | What is missing |
| --- | --- |
| `minObservations` | No value, and no rule for which observations count toward it. |
| Window values | The model says "7-day and 30-day"; the literal used in `scorecardId` is not named. These pages write `7d` and `30d`. |
| "last 10% of the window" | Read here as the purchase order's ack window (issue to `ackBy`), not the scorecard window. The model does not say. |
| Reject, expiry, promise-kept, feed-freshness | No `ul` definition: no denominator and, for feed freshness, no sampling rule. |
| `PROVISIONAL` as a grade | `Grade` is `A`, `B`, `C` or `D` in the value object, but the `ul` entry and the event's `grade` field also carry `PROVISIONAL`. |
