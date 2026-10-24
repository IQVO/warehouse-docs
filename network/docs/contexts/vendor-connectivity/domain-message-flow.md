---
id: domain-message-flow
title: Domain Message Flow
sidebar_label: Domain Message Flow
description: Four Vendor Connectivity scenarios as ddd-crew Domain Message Flows - accepted and shipped, refused and reassigned, a vendor node onboarded, and a failed or rate-limited transaction.
---

# Domain Message Flow

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

Following ddd-crew [Domain Message Flow Modelling](https://github.com/ddd-crew/domain-message-flow-modelling).
Participants are contexts and actors. Every arrow is a message from the
model, prefixed `cmd:`, `qry:` or `evt:`. Events travel on
`retailnetwork.<producer>.events`; their full types are on
[Domain Events](/network/contexts/vendor-connectivity/domain-events). Path
parameters are written without braces. The network-wide flows are on
[Domain message flows](/network/strategic-design/domain-message-flows).

## 1. Purchase order accepted, labelled and shipped

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OS as order-<br/>sourcing
    participant VC as vendor-<br/>connectivity
    participant NF as network-fulfillment<br/>vendor V-WS
    participant ST as shipping-and-<br/>tracking
    participant NP as node-<br/>performance
    OS->>VC: evt:<br/>FulfillmentReleasedToNode
    VC->>NP: evt: PurchaseOrderIssued
    NF->>VC: qry: GET<br/>/vendor/purchase-orders<br/>with nextToken
    VC-->>NF: qry: reply purchaseOrders,<br/>nextToken
    NF->>VC: cmd: POST<br/>/vendor/acknowledgements<br/>ACCEPT, every line
    VC-->>NF: cmd: reply 202<br/>transactionId
    Note over VC: after notBefore,<br/>ProcessSubmission SUCCESS,<br/>PO ACCEPTED
    VC->>OS: evt: PurchaseOrderAccepted
    VC->>NP: evt:<br/>PurchaseOrderAccepted,<br/>SubmissionProcessed
    Note over OS: LockOnCommit, the path is<br/>locked
    NF->>VC: qry: GET<br/>/vendor/transactions/<br/>transactionId
    VC-->>NF: qry: reply SUCCESS
    NF->>VC: cmd: POST<br/>/vendor/shipping-labels
    VC->>ST: cmd: POST /labels<br/>IssueLabel
    ST-->>VC: cmd: reply labelRef,<br/>trackingNumber, carrier
    VC-->>NF: cmd: reply labels, no<br/>address
    NF->>VC: cmd: POST<br/>/vendor/shipment-confirmations
    VC-->>NF: cmd: reply 202<br/>transactionId
    Note over VC: after notBefore,<br/>ProcessSubmission SUCCESS,<br/>PO SHIPPED
    VC->>OS: evt:<br/>VendorShipmentConfirmed
    VC->>ST: evt:<br/>VendorShipmentConfirmed
    VC->>NP: evt:<br/>VendorShipmentConfirmed,<br/>SubmissionProcessed
```

Derived from: `model.yaml → contexts[vendor-connectivity].inbound`,
`.publishes`, `.sync_calls`, `.policies[IssueOnRelease]`;
`contexts[order-sourcing].policies[LockOnCommit]`.

Omitted: the vendor's reconciliation of the shipment transaction (same as
steps 9-10); node-performance's own `PackageHandedOver` input from
shipping-and-tracking; the fleet's internal steps behind its ACL
(translation, the held order in order-management). `SubmissionProcessed`
also goes out for every other asynchronous write.

## 2. Purchase order refused, then reassigned

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant OS as order-<br/>sourcing
    participant VC as vendor-<br/>connectivity
    participant NF as network-fulfillment<br/>vendor V-WS
    participant NP as node-<br/>performance
    OS->>VC: evt:<br/>FulfillmentReleasedToNode<br/>releaseNo 1
    VC->>NP: evt: PurchaseOrderIssued
    NF->>VC: qry: GET<br/>/vendor/purchase-orders
    VC-->>NF: qry: reply purchaseOrders
    alt vendor rejects in full
        NF->>VC: cmd: POST<br/>/vendor/acknowledgements<br/>REJECT CANNOT_MEET_SHIP_BY
        VC-->>NF: cmd: reply 202<br/>transactionId
        Note over VC: ProcessSubmission SUCCESS,<br/>PO REJECTED
        VC->>OS: evt: PurchaseOrderRejected<br/>reasonCode
        VC->>NP: evt: PurchaseOrderRejected
    else no acknowledgement before ackBy
        Note over VC: ExpireUnacknowledged<br/>sweep, PO EXPIRED
        VC->>OS: evt: PurchaseOrderExpired
        VC->>NP: evt: PurchaseOrderExpired
    end
    Note over OS: ReassignOnRefusal, node<br/>excluded, group re-queued
    OS->>VC: evt:<br/>FulfillmentReleasedToNode<br/>releaseNo 2, another node
    VC->>NP: evt: PurchaseOrderIssued,<br/>new poNumber
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[PurchaseOrder].transitions`,
`.policies[ExpireUnacknowledged]`; `contexts[order-sourcing].policies[ReassignOnRefusal]`.

Omitted: the second purchase order may go to another vendor, not only to
`V-WS`. If no node can still meet the promise, order-sourcing marks the
group `UNSOURCEABLE` and no second release arrives. An acknowledgement that
arrives after `ackBy` is refused synchronously (scenario 4).

## 3. Vendor onboarded and a node brought into the network

### 3a. Vendor onboarded, node registered

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    actor PM as Partner<br/>manager
    participant VC as vendor-<br/>connectivity
    participant NF as network-fulfillment<br/>vendor V-WS
    participant NT as node-<br/>topology
    participant NP as node-<br/>performance
    PM->>VC: cmd: POST /vendors<br/>V-WS, ackWindow
    VC->>NP: evt: VendorOnboarded
    NF->>VC: cmd: POST /vendor/nodes<br/>vendorNodeCode, nodeType
    VC-->>NF: cmd: reply 202<br/>transactionId
    VC->>NT: cmd: POST /nodes<br/>RegisterNode
    NT-->>VC: cmd: reply registered
    NT->>VC: evt: NodeRegistered
    Note over VC: VendorNodeView now maps<br/>the node to V-WS
    VC->>NP: evt: SubmissionProcessed
```

Derived from: `model.yaml → contexts[vendor-connectivity].inbound`, `.sync_calls[node-topology]`, `.consumes[NodeRegistered]`, `.read_models[VendorNodeView]`, `.publishes[VendorOnboarded]`.

### 3b. Profile declared, inventory sent

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NF as network-fulfillment<br/>vendor V-WS
    participant VC as vendor-<br/>connectivity
    participant NT as node-<br/>topology
    participant OA as offer-<br/>availability
    participant NP as node-<br/>performance
    NF->>VC: cmd: PUT<br/>/vendor/nodes/nodeId/<br/>profile, profileRevision 1
    VC-->>NF: cmd: reply 202<br/>transactionId
    VC->>NT: cmd: PUT<br/>/nodes/nodeId/<br/>operational-profile
    NT-->>VC: cmd: reply declared
    NT->>VC: evt: NodeActivated
    OA->>VC: evt: ListingCreated
    NF->>VC: cmd: POST<br/>/vendor/inventory<br/>fullUpdate, lines
    VC-->>NF: cmd: reply 202<br/>transactionId
    VC->>OA: cmd: POST /inventory-feeds<br/>ApplyInventoryFeed
    OA-->>VC: cmd: reply applied
    VC->>NP: evt: SubmissionProcessed<br/>per write
```

Derived from: `model.yaml → contexts[vendor-connectivity].inbound`,
`.sync_calls`, `.consumes`, `.read_models`; `contexts[node-topology].inbound`;
`contexts[offer-availability].inbound`.

Omitted: who activates the node (a network-ops planner calls
node-topology's `ActivateNode`; not a message of this context); who
creates the listings (network merchandising in offer-availability); the
vendor's reconciliation of each transaction. How the vendor learns its
`nodeId` after step 4 of 3a is an open question (the transaction carries no
result).

## 4. A transaction fails, and a vendor is rate limited

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant NF as network-fulfillment<br/>vendor V-WS
    participant VC as vendor-<br/>connectivity
    participant OS as order-<br/>sourcing
    participant NP as node-<br/>performance
    NF->>VC: cmd: POST<br/>/vendor/acknowledgements<br/>ACCEPT
    VC-->>NF: cmd: reply 429<br/>rate-limited, Retry-After
    Note over NF: waits Retry-After seconds
    NF->>VC: cmd: POST<br/>/vendor/acknowledgements<br/>ACCEPT, same<br/>Idempotency-Key
    VC-->>NF: cmd: reply 202<br/>transactionId
    Note over VC: ProcessSubmission FAILURE<br/>by TX_FAILURE_RATE, PO<br/>back to ISSUED
    VC->>NP: evt: SubmissionProcessed<br/>FAILURE
    NF->>VC: qry: GET<br/>/vendor/transactions/<br/>transactionId
    VC-->>NF: qry: reply FAILURE with<br/>errors
    alt before ackBy
        NF->>VC: cmd: POST<br/>/vendor/acknowledgements<br/>ACCEPT, new key
        VC-->>NF: cmd: reply 202 new<br/>transactionId
        Note over VC: ProcessSubmission SUCCESS,<br/>PO ACCEPTED
        VC->>OS: evt: PurchaseOrderAccepted
    else after ackBy
        NF->>VC: cmd: POST<br/>/vendor/acknowledgements<br/>ACCEPT
        VC-->>NF: cmd: reply 409<br/>ack-window-closed
        Note over VC: ExpireUnacknowledged<br/>sweep, PO EXPIRED
        VC->>OS: evt: PurchaseOrderExpired
    end
```

Derived from: `model.yaml → contexts[vendor-connectivity].business_decisions`,
`.policies[SimulationKnobs]`, `.aggregates[PurchaseOrder].transitions`
(`ACK_PROCESSING` to `ISSUED`), `.aggregates[PurchaseOrder].invariants`
(`ErrAckWindowClosed`).

Omitted: node-performance also receives the accepted or expired event.
The fleet records the failure as `SUBMISSION_FAILED` on its side; whether
it then re-acknowledges is the fleet's choice, not the network's.
