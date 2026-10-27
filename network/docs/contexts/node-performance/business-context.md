---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why the network grades every node from what it observes rather than from what the vendor declares, who uses the grade, and what this context deliberately does not do.
---

# Business Context

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

## The problem

The retail network does not run its fulfillment centres. Vendors do. A
vendor registers a node and declares its operational profile: operating
hours, cutoffs, handling time and a throughput cap (owned by
`node-topology`). Every promise the network makes rests on that
declaration. A declaration is a claim, and claims drift: a node that says
it ships by the 18:00 cutoff may in practice hand packages over late, let
purchase orders run to the end of their acknowledgement window, reject
them, or send inventory feeds hours apart.

If the network trusted declarations alone, a weak node would keep
receiving demand at the same terms as a strong one, and the broken
promises would land on the shopper. If the network instead punished nodes
by hand, the decision would be slow, inconsistent and hard to explain to
the vendor.

**Node Performance** answers one question in a repeatable way: *how has
this node actually behaved over the last 7 and 30 days?* It answers it from
observed facts only, never from what the vendor said about itself. The
model calls this principle **Declared vs Measured**: the operational
profile is what the vendor says; the scorecard is what the network
observes. Both feed the promise, and neither overwrites the other
([ADR 0003](/network/adr/0003-declared-and-measured-capability)).

## What it observes

| Fact | Producer | Feeds metric |
| --- | --- | --- |
| A purchase order was issued, accepted, rejected or expired | `vendor-connectivity` | Late Ack Rate, reject rate, expiry rate |
| A vendor confirmed a shipment | `vendor-connectivity` | links tracking numbers to the PO's `requiredShipBy` |
| A package was handed over to the network | `shipping-and-tracking` | On-Time Handover Rate |
| A promise was kept or broken | `delivery-promise` | promise-kept rate |
| An inventory feed was applied | `offer-availability` | feed freshness (p95, minutes) |
| A node was registered, a profile declared, a vendor onboarded, a submission processed | `node-topology`, `vendor-connectivity` | no metric (see [open questions](/network/contexts/node-performance/bounded-context-canvas)) |

## Actors

| Actor | What they do with this context |
| --- | --- |
| `delivery-promise` | Reads the grade from `NodeScorecardUpdated` and applies its `ScorecardHandicap` policy to the node's `shipBy`. A poor grade makes promises from the node later; it never removes the node silently. |
| `order-sourcing` | Reads the grade from `NodeScorecardUpdated` into its `AssignmentCost` policy (`scorecardPenalty`). |
| `vendor-connectivity` | Calls `GET /scorecards/{nodeId}` to serve a vendor's `GET /vendor/nodes/{nodeId}/scorecard` on the Vendor API. |
| A vendor (for example the warehouse-systems fleet, vendor V-WS) | Sees its own scorecard through the Vendor API only. It never calls this context and never sees another vendor's grade. |
| Analytics | Receives `NodeThresholdBreached` (no in-organization consumer). |

## Decisions it makes

1. **A scorecard is computed only from observed facts**, never from the
   vendor's declaration.
2. **A node with fewer than the minimum observations in the window is
   graded `PROVISIONAL`, not `A`.** A quiet new node is not a good node yet.
3. **Grades are `A`, `B`, `C` or `D`** by the `Grading` policy, which reads
   the on-time handover rate, the promise-kept rate and the late
   acknowledgement rate.
4. **A metric that crosses its threshold downward raises
   `NodeThresholdBreached`** (`ThresholdAlert` policy).
5. **Grades drive the promise handicap, owned by `delivery-promise`.** This
   context never suspends a node; suspension is a `node-topology` command
   issued by people.

## How it relates to the real fulfillment networks

The facts this context observes are the signals a vendor already exchanges
with the network in a direct-fulfillment protocol: inventory submissions,
a whole-order acknowledgement inside a window, and a shipment confirmation
against a ship-by. The the vendor platform API surface map
shows where each of those signals sits in the public vendor interfaces, and
public fulfillment-network research describes
the operating model in which the node chosen at assignment may differ from
the one that backed the promise. The research does not cite how the
reference network grades its vendors internally, so nothing on this page
claims it. The windows (7 and 30 days), the grades and the thresholds of
the `Grading` policy are this model's own proposal, in this model's own
vocabulary. See Sources for what is cited.

## Deliberately out of scope

- **Suspending, retiring or blocking a node.** That is `node-topology`'s
  `SuspendNode`, decided by people.
- **Changing the promise.** The handicap is `delivery-promise`'s
  `ScorecardHandicap` policy. This context publishes a grade and stops.
- **Choosing a node.** That is `order-sourcing`.
- **Penalties, chargebacks and invoicing.** `payments-and-invoicing` is a
  future, Generic context in the model.
- **Correcting the vendor's declaration.** A low on-time rate does not
  rewrite the operational profile; the vendor re-declares it through
  `vendor-connectivity`.
- **Measuring network-operated nodes on vendor metrics.** Sortation
  centres, delivery stations and air hubs receive no purchase orders and
  send no feeds, so most metrics are empty for them.

See the [Bounded Context Canvas](/network/contexts/node-performance/bounded-context-canvas)
for every message and the [Context Map](/network/contexts/node-performance/context-map)
for every relationship.
