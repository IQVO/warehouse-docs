---
id: bounded-context-canvas
title: Bounded Context Canvas
sidebar_label: Bounded Context Canvas
description: The ddd-crew Bounded Context Canvas v5 for Node Performance, with every inbound and outbound message taken from model.yaml.
---

# Bounded Context Canvas

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

Following the ddd-crew [Bounded Context Canvas v5](https://github.com/ddd-crew/bounded-context-canvas).
Every message row comes from `contexts[node-performance]` (`inbound`,
`rest`, `publishes`, `consumes`, `sync_calls`) or from a neighbour's entry
that names this context.

## Canvas at a glance

Two pictures of the sections below: first the inbound collaborators feeding
this context (with its purpose, roles and business decisions), then the
outbound collaborators it notifies. Arrows follow the message type:
**solid blue** commands (`cmd`), **dotted green** queries (`qry`), **thick
orange** events (`evt`). Box shapes mark the collaborator kind: blue =
sibling bounded context; grey = this context's own scheduler; dashed = a
caller or consumer the model does not name. Channel names on the arrows
are abbreviated; the tables carry the exact route, topic and CloudEvents
type.

### Inbound

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 40, "padding": 6}}}%%
flowchart LR
    classDef bc fill:#fff3bf,stroke:#e67700,stroke-width:1.5px,color:#000
    classDef card fill:#fff9db,stroke:#f08c00,color:#000,text-align:left
    classDef ctx fill:#e7f5ff,stroke:#1c7ed6,color:#000
    classDef actor fill:#fff4e6,stroke:#e8590c,color:#000
    classDef ext fill:#ffe3e3,stroke:#c92a2a,color:#000
    classDef self fill:#f1f3f5,stroke:#868e96,color:#000
    classDef none fill:#f8f9fa,stroke:#adb5bd,stroke-dasharray:5 5,color:#495057
    subgraph IN["Inbound"]
        direction TB
        in0["vendor-connectivity"]:::ctx
        in1["shipping-and-tracking"]:::ctx
        in2["delivery-promise"]:::ctx
        in3["offer-availability"]:::ctx
        in4["node-topology"]:::ctx
        in5["own recompute<br/>scheduler"]:::self
        in6["caller not named<br/>in the model"]:::none
    end
    subgraph BC["node-performance - Supporting - partner tier"]
        direction TB
        purpose["<b>Purpose</b><br/>Measure every node against what<br/>was asked of it: ack latency,<br/>rejections, on-time handover,<br/>promise-kept rate, feed freshness,<br/>over 7-day and 30-day windows,<br/>and grade it."]:::card
        roles["<b>Domain roles</b><br/>- Analysis - scorecard<br/>- Audit"]:::card
        rules["<b>Business decisions</b><br/>- Observed facts only, never<br/>the declaration<br/>- Below minObservations:<br/>PROVISIONAL, not A<br/>- Grades feed the handicap of<br/>delivery-promise<br/>- Never suspends a node"]:::card
    end
    in0 ==>|"evt - Kafka<br/>VendorOnboarded,<br/>PurchaseOrderIssued,<br/>Accepted, Rejected, Expired,<br/>VendorShipmentConfirmed,<br/>SubmissionProcessed"| BC
    in0 -.->|"qry - REST<br/>GET /scorecards/nodeId<br/>GetScorecard"| BC
    in1 ==>|"evt - Kafka<br/>PackageHandedOver"| BC
    in2 ==>|"evt - Kafka<br/>PromiseKept,<br/>PromiseBroken"| BC
    in3 ==>|"evt - Kafka<br/>InventoryFeedApplied"| BC
    in4 ==>|"evt - Kafka<br/>NodeRegistered,<br/>NodeOperational-<br/>ProfileDeclared"| BC
    in5 -->|"cmd - timer<br/>Recompute"| BC
    in6 -.->|"qry - REST<br/>GET /scorecards?grade="| BC
    linkStyle 0 stroke:#e8590c,stroke-width:2.5px
    linkStyle 1 stroke:#2f9e44,stroke-width:1.5px
    linkStyle 2 stroke:#e8590c,stroke-width:2.5px
    linkStyle 3 stroke:#e8590c,stroke-width:2.5px
    linkStyle 4 stroke:#e8590c,stroke-width:2.5px
    linkStyle 5 stroke:#e8590c,stroke-width:2.5px
    linkStyle 6 stroke:#1971c2,stroke-width:1.5px
    linkStyle 7 stroke:#2f9e44,stroke-width:1.5px
    class BC bc
```

Derived from: model.yaml → contexts[node-performance].purpose, .roles,
.business_decisions, .inbound, .rest, .consumes,
.aggregates[NodeScorecard].throughput_estimate.

### Outbound

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 14, "rankSpacing": 40, "padding": 6}}}%%
flowchart LR
    classDef bc fill:#fff3bf,stroke:#e67700,stroke-width:1.5px,color:#000
    classDef card fill:#fff9db,stroke:#f08c00,color:#000,text-align:left
    classDef ctx fill:#e7f5ff,stroke:#1c7ed6,color:#000
    classDef actor fill:#fff4e6,stroke:#e8590c,color:#000
    classDef ext fill:#ffe3e3,stroke:#c92a2a,color:#000
    classDef self fill:#f1f3f5,stroke:#868e96,color:#000
    classDef none fill:#f8f9fa,stroke:#adb5bd,stroke-dasharray:5 5,color:#495057
    BC["<b>node-performance - Supporting - partner tier</b>"]:::bc
    subgraph OUT["Outbound - whom it notifies"]
        direction TB
        out0["delivery-promise"]:::ctx
        out1["order-sourcing"]:::ctx
        out2["analytics only<br/>no in-org consumer"]:::none
    end
    BC ==>|"evt - Kafka<br/>NodeScorecardUpdated"| out0
    BC ==>|"evt - Kafka<br/>NodeScorecardUpdated"| out1
    BC ==>|"evt - Kafka<br/>NodeThresholdBreached"| out2
    linkStyle 0 stroke:#e8590c,stroke-width:2.5px
    linkStyle 1 stroke:#e8590c,stroke-width:2.5px
    linkStyle 2 stroke:#e8590c,stroke-width:2.5px
```

Derived from: model.yaml → contexts[node-performance].publishes,
.sync_calls (empty).

Both diagrams omit the relationship pattern per message (see the tables),
the assumptions, metrics and open questions below, and Postgres and Kafka
as infrastructure. There is no outbound command or query arrow because
`sync_calls` is empty: the reply to `vendor-connectivity`'s query is drawn
on the inbound side only.

## Name

**Node Performance** (`node-performance`, code `NP`, CloudEvents tier
`partner`).

## Purpose

Measures every node against what it declared and what was asked of it:
acknowledgement latency, rejections, on-time handover against
`requiredShipBy`, promise-kept rate and inventory feed freshness, over
rolling windows, and grades the node. The scorecard is built from observed
facts only. It is published so that `delivery-promise` can handicap a weak
node's promises and `order-sourcing` can price it, and it is readable by
the node's vendor through `vendor-connectivity`.

## Strategic Classification

| Axis | Verdict |
| --- | --- |
| **Domain** | **Supporting.** See the [Core Domain Chart](/network/contexts/node-performance/core-domain-chart) (complexity 0.34, differentiation 0.45). |
| **Business Model** | Risk reducer: promises rest on measured, not just declared, capability. |
| **Evolution** | Custom-built. |

## Domain Roles

| Role | Applies? | Evidence in the model |
| --- | --- | --- |
| **Analysis (scorecard)** | Yes, primary | `NodeScorecard` with `Metrics{onTimeHandoverRate, lateAckRate, rejectRate, expiryRate, promiseKeptRate, feedFreshnessP95Minutes, observations}` and the `Grading` policy. |
| **Audit** | Yes | Every metric is traceable to counted source events (`ErrDuplicateObservation` keys on the source event id). |
| **Enforcer** | No | "This context never suspends a node." The handicap is `delivery-promise`'s. |
| **Gateway** | No | Vendors reach the scorecard only through `vendor-connectivity`. |

## Inbound Communication

| Collaborator | Message | Type | Channel | Relationship |
| --- | --- | --- | --- | --- |
| `vendor-connectivity` | `VendorOnboarded` | Event | Kafka `retailnetwork.vendor-connectivity.events`, `com.retailnetwork.partner.vendor-connectivity.vendoraccount.VendorOnboarded` | Conformist |
| `vendor-connectivity` | `PurchaseOrderIssued` | Event | Kafka `retailnetwork.vendor-connectivity.events`, `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderIssued` | Conformist |
| `vendor-connectivity` | `PurchaseOrderAccepted` | Event | Kafka `retailnetwork.vendor-connectivity.events`, `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderAccepted` | Conformist |
| `vendor-connectivity` | `PurchaseOrderRejected` | Event | Kafka `retailnetwork.vendor-connectivity.events`, `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderRejected` | Conformist |
| `vendor-connectivity` | `PurchaseOrderExpired` | Event | Kafka `retailnetwork.vendor-connectivity.events`, `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderExpired` | Conformist |
| `vendor-connectivity` | `VendorShipmentConfirmed` | Event | Kafka `retailnetwork.vendor-connectivity.events`, `com.retailnetwork.partner.vendor-connectivity.purchaseorder.VendorShipmentConfirmed` | Conformist |
| `vendor-connectivity` | `SubmissionProcessed` | Event | Kafka `retailnetwork.vendor-connectivity.events`, `com.retailnetwork.partner.vendor-connectivity.submission.SubmissionProcessed` | Conformist |
| `vendor-connectivity` | `InboundReceiptSubmitted` | Event | Kafka `retailnetwork.vendor-connectivity.events`, `com.retailnetwork.partner.vendor-connectivity.inboundreceipt.InboundReceiptSubmitted` | Conformist |
| `seller-inbound` | `InboundShipmentShipped` | Event | Kafka `retailnetwork.seller-inbound.events`, `com.retailnetwork.partner.seller-inbound.inboundshipment.InboundShipmentShipped` | Conformist |
| `vendor-connectivity` | `GetScorecard` | Query | REST `GET /scorecards/{nodeId}` (in-org), serving the Vendor API's `GET /vendor/nodes/{nodeId}/scorecard` | Customer/Supplier (this context is the Supplier) |
| `shipping-and-tracking` | `PackageHandedOver` | Event | Kafka `retailnetwork.shipping-and-tracking.events`, `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageHandedOver` | Conformist |
| `delivery-promise` | `PromiseKept` | Event | Kafka `retailnetwork.delivery-promise.events`, `com.retailnetwork.commerce.delivery-promise.promise.PromiseKept` | Conformist |
| `delivery-promise` | `PromiseBroken` | Event | Kafka `retailnetwork.delivery-promise.events`, `com.retailnetwork.commerce.delivery-promise.promise.PromiseBroken` | Conformist |
| `offer-availability` | `InventoryFeedApplied` | Event | Kafka `retailnetwork.offer-availability.events`, `com.retailnetwork.commerce.offer-availability.inventoryfeed.InventoryFeedApplied` | Conformist |
| `node-topology` | `NodeRegistered` | Event | Kafka `retailnetwork.node-topology.events`, `com.retailnetwork.logistics.node-topology.node.NodeRegistered` | Conformist |
| `node-topology` | `NodeOperationalProfileDeclared` | Event | Kafka `retailnetwork.node-topology.events`, `com.retailnetwork.logistics.node-topology.node.NodeOperationalProfileDeclared` | Conformist |
| Own scheduler | `Recompute` | Command | In-process timer, batched per minute (`throughput_estimate`) | Internal |
| Not named in the model | List scorecards by grade (the model gives no message name) | Query | REST `GET /scorecards?grade=` | Open Host (read-only) |

Every consumed event becomes, at most, one `RecordObservation` command on
the node's scorecards. Which events actually produce an observation is in
[Domain Events](/network/contexts/node-performance/domain-events).

## Outbound Communication

| Collaborator | Message | Type | Channel | Relationship |
| --- | --- | --- | --- | --- |
| `delivery-promise` | `NodeScorecardUpdated` | Event | Kafka `retailnetwork.node-performance.events`, `com.retailnetwork.partner.node-performance.scorecard.NodeScorecardUpdated` | Conformist (`delivery-promise` conforms; feeds its `ScorecardView` and `ScorecardHandicap`) |
| `order-sourcing` | `NodeScorecardUpdated` | Event | Kafka `retailnetwork.node-performance.events`, `com.retailnetwork.partner.node-performance.scorecard.NodeScorecardUpdated` | Conformist (`order-sourcing` conforms; feeds its `ScorecardView` and `AssignmentCost`) |
| Analytics only | `NodeThresholdBreached` | Event | Kafka `retailnetwork.node-performance.events`, `com.retailnetwork.partner.node-performance.scorecard.NodeThresholdBreached` | Published Language, no in-org consumer |

No synchronous outbound call: `sync_calls` is empty. Full payloads:
[Domain Events](/network/contexts/node-performance/domain-events). Relationship
reasoning: [Context Map](/network/contexts/node-performance/context-map).

## Ubiquitous Language

Full glossary: [Ubiquitous Language](/network/contexts/node-performance/ubiquitous-language).
Top terms: **Scorecard**, **Grade** (`A`-`D`, `PROVISIONAL`), **On-Time
Handover Rate**, **Late Ack Rate**, **Declared vs Measured**, **Window**
(7-day, 30-day).

## Business Decisions

1. **Observed facts only.** A scorecard is computed only from observed
   facts, never from the vendor's declaration.
2. **Provisional below the minimum.** A node with fewer than the minimum
   observations in the window is graded `PROVISIONAL`, not `A`
   (`ErrInsufficientObservations` guards a grade without enough
   observations).
3. **Grading thresholds** (`Grading` policy):

   | Grade | onTimeHandoverRate | promiseKeptRate | lateAckRate |
   | --- | --- | --- | --- |
   | `A` | `>= 0.98` | `>= 0.97` | `<= 0.01` |
   | `B` | `>= 0.95` | `>= 0.94` | `<= 0.03` |
   | `C` | `>= 0.90` | `>= 0.90` | `<= 0.05` |
   | `D` | otherwise | otherwise | otherwise |

4. **Count once.** An observation is counted once, idempotent on the
   source event id (`ErrDuplicateObservation`).
5. **Report crossings.** `NodeThresholdBreached` is published when a metric
   crosses its threshold downward (`ThresholdAlert`).
6. **Never suspend.** Grades drive the promise handicap (owned by
   `delivery-promise`); this context never suspends a node.

## Assumptions

- `vendor-connectivity`, `shipping-and-tracking`, `delivery-promise` and
  `offer-availability` publish every fact once per occurrence through their
  outboxes, and a redelivery carries the same CloudEvents `id`.
- `poNumber` joins a handover (`PackageHandedOver`) to the purchase order's
  `requiredShipBy` (from `PurchaseOrderIssued` or `VendorShipmentConfirmed`).
- `nodeId` is the same identifier in every producer (it is minted by
  `node-topology`).
- A per-minute recompute is fresh enough for the handicap; nothing on the
  promise hot path waits for it.

## Verification Metrics

- **Freshness:** time from a consumed event's CloudEvents `time` to the
  `NodeScorecardUpdated` that includes it; target under two recompute
  periods.
- **Coverage:** share of `ACTIVE` vendor nodes with a `GRADED` 30-day
  scorecard.
- **Duplicates:** count of `ErrDuplicateObservation` per hour (expected
  non-zero under redelivery, never counted into a metric).
- **Correlation gaps:** `PackageHandedOver` observations whose `poNumber`
  has no known `requiredShipBy`; should trend to zero.
- **Predictive value:** promise-kept rate of the following 7 days per
  grade; a `D` node should keep fewer promises than an `A` node, or the
  thresholds need tuning.
- **Breach rate:** `NodeThresholdBreached` per node per week.

## Open Questions

Each comes from a gap in the model; none is answered on these pages.

- **What is `minObservations`, and what counts toward it?** The model
  names the invariant but no value.
- **What are the literal window values?** These pages use `7d` and `30d`.
- **Which window drives the handicap and the cost?** Both windows publish
  `NodeScorecardUpdated`; neither consumer says which it reads.
- **How does `delivery-promise` treat `PROVISIONAL`?** `ScorecardHandicap`
  defines `A`-`D` and "no scorecard yet", not `PROVISIONAL`.
- **What are the `ThresholdAlert` thresholds per metric**, and what does
  "downward" mean for metrics where higher is worse (`lateAckRate`,
  `rejectRate`, `expiryRate`, `feedFreshnessP95Minutes`)?
- **Which `PromiseBroken` causes count against the node?** The event
  carries `cause`, but no rule attributes a late linehaul to the network
  rather than the node.
- **How is feed freshness sampled?** `InventoryFeedApplied` carries
  `appliedAt` but no `asOf`.
- **What do `VendorOnboarded`, `SubmissionProcessed`, `NodeRegistered` and
  `NodeOperationalProfileDeclared` feed?** They are consumed, but no metric
  reads them, `SubmissionProcessed` and `VendorOnboarded` carry no `nodeId`,
  and the context declares no read model.
- **Who calls `GET /scorecards?grade=`?** No inbound row names a caller.
- **How is the issue instant of a purchase order known?**
  `PurchaseOrderIssued` has `ackBy` but no `issuedAt`; these pages read the
  CloudEvents `time`.
