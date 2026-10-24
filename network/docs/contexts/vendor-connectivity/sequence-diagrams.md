---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: One proposed UML sequence per Vendor Connectivity command use case, from inbound adapter through aggregate, repository and outbox to Kafka, with error, version and idempotency branches.
---

# Sequence Diagrams

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One UML sequence per command use case on
[Use Cases](/network/contexts/vendor-connectivity/use-cases). Shared conventions:

- `Repo` saves with `WHERE version = :expected`; zero rows updated is a
  version conflict.
- `Outbox` rows are written **in the same database transaction** as the
  aggregate (`UoW`); a separate relay reads unpublished rows and produces
  them to Kafka `retailnetwork.vendor-connectivity.events`, then marks them
  published. The relay is drawn once per diagram as `Relay + Kafka`.
- Consumers claim the CloudEvents `id` in `processed_events` in the same
  transaction as their effect.
- Every `/vendor/...` request passes the rate limiter first (`429` with
  `Retry-After`); it is drawn only in diagram 4.

Event names are short; the full types are on
[Domain Events](/network/contexts/vendor-connectivity/domain-events).

## 1. OnboardVendor

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http POST /vendors
    participant UC as OnboardVendor
    participant A as VendorAccount
    participant R as VendorAccountRepo
    participant OB as Outbox
    participant K as Relay + Kafka
    H->>UC: Execute(vendorId, name, ackWindowMinutes, key)
    UC->>R: FindById(vendorId)
    alt account exists
        R-->>UC: existing account
        UC-->>H: 201 existing account, no event
    else new vendor
        UC->>A: Onboard(vendorId, name, ackWindow)
        alt ackWindow outside 1h to 24h
            A-->>UC: ErrAckWindowOutOfRange
            UC-->>H: 422 ack-window-out-of-range
        else valid
            A-->>UC: VendorAccount ACTIVE
            Note over R,OB: one transaction
            UC->>R: Save(account, version 0)
            UC->>OB: append VendorOnboarded
            UC-->>H: 201 account
            OB->>K: relay publishes VendorOnboarded, key vendorId
        end
    end
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[VendorAccount]`,
`.publishes[VendorOnboarded]`, `.rest` (`POST /vendors`).

Omitted: the `Idempotency-Key` replay (returns the stored `201`); body
validation (`422 validation`).

## 2. SuspendVendor and ReinstateVendor

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant C as caller, no route in the model
    participant UC as SuspendVendor or ReinstateVendor
    participant A as VendorAccount
    participant R as VendorAccountRepo
    C->>UC: Execute(vendorId)
    UC->>R: FindById(vendorId)
    alt unknown
        R-->>UC: not found
        UC-->>C: 404 not-found
    else found
        R-->>UC: account, version n
        UC->>A: Suspend() or Reinstate()
        alt already in the target state
            A-->>UC: no-op
            UC-->>C: unchanged
        else transition
            A-->>UC: SUSPENDED or ACTIVE
            UC->>R: Save(account, expected n)
            alt version conflict
                R-->>UC: stale
                UC-->>C: 409 stale
            else saved
                UC-->>C: ok, no event in the model
            end
        end
    end
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[VendorAccount].transitions`,
`.commands`.

Omitted: outbox and Kafka, because the model gives these commands no
event. The caller is unknown: the model lists no channel (a model gap).

## 3. IssuePurchaseOrder (policy IssueOnRelease)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer order-sourcing
    participant UC as IssuePurchaseOrder
    participant A as PurchaseOrder
    participant R as PurchaseOrderRepo and views
    participant OB as Outbox and inbox
    participant K as Relay + Kafka
    KC->>UC: FulfillmentReleasedToNode, CloudEvents id
    UC->>OB: claim id in processed_events
    alt id already processed
        UC-->>KC: ack, nothing to do
    else new event
        UC->>R: VendorNodeView.Get(nodeId)
        alt node unknown yet
            UC-->>KC: do not ack, retry later
        else not a VENDOR node
            Note over UC,OB: commit inbox row only
            UC-->>KC: ack
        else vendor node
            UC->>R: FindByNumber(poNumber from assignmentId and releaseNo)
            alt PO exists
                UC-->>KC: commit inbox row, ack
            else new release
                UC->>R: VendorAccountRepo.FindById(vendorId)
                UC->>A: Issue(release, ackWindow, handlingTime)
                A-->>UC: ISSUED, ackBy fixed
                Note over R,OB: one transaction
                UC->>R: Save(po, version 0)
                UC->>OB: append PurchaseOrderIssued, commit inbox row
                UC-->>KC: ack
                OB->>K: relay publishes PurchaseOrderIssued, key poNumber
            end
        end
    end
```

Derived from: `model.yaml → contexts[vendor-connectivity].policies[IssueOnRelease]`,
`.read_models[VendorNodeView]`, `.aggregates[PurchaseOrder]`,
`.publishes[PurchaseOrderIssued]`, `.business_decisions` (`ackBy`).

Omitted: where `handlingTime` comes from (no source in the model, a gap);
`PO_REDELIVERY_RATE`, which acts on the poll, not here.

## 4. SubmitAcknowledgement

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http POST /vendor/acknowledgements
    participant UC as SubmitAcknowledgement
    participant A as PurchaseOrder
    participant R as Repos and views
    participant S as Submission
    participant OB as Outbox
    H->>H: rate limiter, RATE_LIMIT_RPS
    alt over the limit
        H-->>H: 429 rate-limited, Retry-After
    else allowed
        H->>UC: Execute(vendorId, poNumber, decision, lines, key)
        UC->>R: SubmissionRepo.FindByIdempotencyKey(vendorId, key)
        alt key seen
            UC-->>H: 202 same transactionId
        else new key
            UC->>R: FindByNumber(poNumber), VendorNodeView owner
            alt unknown PO or other vendor
                UC-->>H: 404 not-found or node-not-owned-by-vendor
            else owned
                UC->>A: SubmitAcknowledgement(decision, lines, txId, now)
                alt rule broken
                    A-->>UC: ErrPartialAcknowledgement or ErrAlreadyAcknowledged or ErrAckWindowClosed
                    UC-->>H: 422 partial-acknowledgement or 409 already-acknowledged or ack-window-closed
                else valid
                    A-->>UC: ACK_PROCESSING
                    UC->>S: Receive(vendorId, ACKNOWLEDGEMENT, payload, now)
                    Note over R,OB: one transaction, no event yet
                    UC->>R: Save(po, expected version), Save(submission)
                    alt version conflict
                        R-->>UC: stale, rolled back
                        UC-->>H: 409 stale
                    else committed
                        UC-->>H: 202 transactionId
                    end
                end
            end
        end
    end
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[PurchaseOrder]`
(transition `ISSUED` to `ACK_PROCESSING`, invariants),
`.aggregates[Submission]` (`ReceiveSubmission`), `.business_decisions`,
`.policies[SimulationKnobs]`.

Omitted: the relay, because nothing is published at receipt;
`PurchaseOrderAccepted` or `PurchaseOrderRejected` follows in diagram 10.
The version-conflict branch is retried once inside the use case before it
is returned.

## 5. RequestLabel

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http POST /vendor/shipping-labels
    participant UC as RequestLabel
    participant A as PurchaseOrder
    participant R as PurchaseOrderRepo
    participant ST as shipping-and-tracking
    H->>UC: Execute(vendorId, poNumber, packages)
    UC->>R: FindByNumber(poNumber), owner check
    alt unknown PO or other vendor
        UC-->>H: 404
    else owned
        UC->>A: RequestLabel()
        alt not ACCEPTED
            A-->>UC: ErrLabelBeforeAcceptance
            UC-->>H: 409 label-before-acceptance
        else ACCEPTED
            loop each packageNo without a stored label
                UC->>ST: POST /labels IssueLabel poNumber, assignmentId, packageNo
                alt label already issued there
                    ST-->>UC: existing labelRef, trackingNumber, carrier
                else issued
                    ST-->>UC: labelRef, trackingNumber, carrier
                end
            end
            UC->>A: AddLabels(labels)
            UC->>R: Save(po, expected version)
            alt version conflict
                R-->>UC: stale
                UC-->>H: 409 stale, labels are safe to request again
            else saved
                UC-->>H: 200 labels, no address
            end
        end
    end
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[PurchaseOrder]`
(`RequestLabel`, `ErrLabelBeforeAcceptance`, `Label`),
`.sync_calls[shipping-and-tracking]`; `contexts[shipping-and-tracking].aggregates[ShippingLabel].invariants`
(`ErrLabelAlreadyIssued`).

Omitted: outbox and relay, because this context publishes nothing here
(shipping-and-tracking publishes `LabelIssued`). shipping-and-tracking
unavailable answers `503`.

## 6. SubmitShipmentConfirmation

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http POST /vendor/shipment-confirmations
    participant UC as SubmitShipmentConfirmation
    participant A as PurchaseOrder
    participant R as Repos and views
    participant S as Submission
    H->>UC: Execute(vendorId, poNumber, trackingNumbers, shippedAt, key)
    UC->>R: FindByIdempotencyKey(vendorId, key)
    alt key seen
        UC-->>H: 202 same transactionId
    else new key
        UC->>R: FindByNumber(poNumber), owner check
        UC->>A: SubmitShipmentConfirmation(trackingNumbers, shippedAt, txId)
        alt a package has no label
            A-->>UC: ErrConfirmWithoutLabel
            UC-->>H: 409 confirm-without-label
        else not ACCEPTED
            A-->>UC: state refusal, no model Err
            UC-->>H: 409 purchase-order-state
        else valid
            A-->>UC: SHIPMENT_PROCESSING
            UC->>S: Receive(vendorId, SHIPMENT_CONFIRMATION, payload, now)
            Note over R,S: one transaction, no event yet
            UC->>R: Save(po, expected version), Save(submission)
            alt version conflict
                UC-->>H: 409 stale
            else committed
                UC-->>H: 202 transactionId
            end
        end
    end
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[PurchaseOrder]`
(transition `ACCEPTED` to `SHIPMENT_PROCESSING`, `ErrConfirmWithoutLabel`),
`.aggregates[Submission]`.

Omitted: rate limiting and the `404` branch (as in diagram 4);
`VendorShipmentConfirmed` follows in diagram 10.

## 7. ExpireUnacknowledgedOrders (policy ExpireUnacknowledged)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant T as expiry ticker
    participant UC as ExpireUnacknowledgedOrders
    participant A as PurchaseOrder
    participant R as PurchaseOrderRepo
    participant OB as Outbox
    participant K as Relay + Kafka
    T->>UC: Execute(now)
    UC->>R: ListIssuedPastAckBy(now)
    loop each ISSUED PO past ackBy
        UC->>A: Expire(now)
        A-->>UC: EXPIRED
        Note over R,OB: one transaction
        UC->>R: Save(po, expected version)
        alt version conflict, the vendor acknowledged meanwhile
            R-->>UC: stale, rolled back
            Note over UC: skip, the next pass re-reads
        else saved
            UC->>OB: append PurchaseOrderExpired
            OB->>K: relay publishes PurchaseOrderExpired, key poNumber
        end
    end
```

Derived from: `model.yaml → contexts[vendor-connectivity].policies[ExpireUnacknowledged]`,
`.aggregates[PurchaseOrder]` (transition `ISSUED` to `EXPIRED`),
`.publishes[PurchaseOrderExpired]`.

Omitted: a PO in `ACK_PROCESSING` is not listed; it is expired on a later
pass only if its transaction fails and returns it to `ISSUED` after
`ackBy`.

## 8. CancelPurchaseOrder (policy CancelOnSourcingCancel)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer order-sourcing
    participant UC as CancelPurchaseOrder
    participant A as PurchaseOrder
    participant R as PurchaseOrderRepo
    participant OB as Outbox and inbox
    participant K as Relay + Kafka
    KC->>UC: FulfillmentCancelled, CloudEvents id
    UC->>OB: claim id in processed_events
    alt already processed
        UC-->>KC: ack
    else new
        UC->>R: FindOpenByAssignment(assignmentId)
        alt no PO
            UC-->>KC: commit inbox row, ack
        else PO found
            UC->>A: Cancel(reason)
            alt not ISSUED
                A-->>UC: ErrCancelAfterAcknowledgement
                Note over UC: log, commit inbox row, nobody is told
                UC-->>KC: ack
            else ISSUED
                A-->>UC: CANCELLED
                Note over R,OB: one transaction
                UC->>R: Save(po, expected version)
                UC->>OB: append PurchaseOrderCancelled, commit inbox row
                UC-->>KC: ack
                OB->>K: relay publishes PurchaseOrderCancelled, key poNumber
            end
        end
    end
```

Derived from: `model.yaml → contexts[vendor-connectivity].policies[CancelOnSourcingCancel]`,
`.aggregates[PurchaseOrder]` (`ErrCancelAfterAcknowledgement`),
`.publishes[PurchaseOrderCancelled]`; `contexts[order-sourcing].publishes[FulfillmentCancelled].data`.

Omitted: a version conflict rolls back the whole transaction, including
the inbox row, so Kafka redelivers the event and the cancel is retried.

## 9. ReceiveSubmission (node registration, profile, inventory)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http POST /vendor/nodes, PUT .../profile, POST /vendor/inventory
    participant UC as ReceiveSubmission
    participant V as VendorNodeView
    participant S as Submission
    participant R as SubmissionRepo
    H->>UC: Execute(vendorId, kind, payload, key)
    UC->>R: FindByIdempotencyKey(vendorId, key)
    alt key seen
        UC-->>H: 202 same transactionId
    else new key
        opt kind NODE_PROFILE or INVENTORY
            UC->>V: owner of nodeId
            alt unknown or other vendor
                UC-->>H: 404 not-found or node-not-owned-by-vendor
            end
        end
        UC->>S: Receive(vendorId, kind, payload, now, TX_PROCESSING_DELAY)
        S-->>UC: PROCESSING, notBefore
        UC->>R: Save(submission)
        UC-->>H: 202 transactionId
    end
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[Submission]`,
`.inbound` (`RegisterVendorNode`, `DeclareNodeProfile`, `SubmitInventory`),
`.policies[SimulationKnobs]`.

Omitted: rate limiting and body validation (`422 validation`); outbox and
relay, because nothing is published at receipt.

## 10. ProcessSubmission

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant UC as ProcessSubmission, on processor tick
    participant A as Submission and PurchaseOrder
    participant R as Repos
    participant NB as node-topology or offer-availability
    participant OB as Outbox
    participant K as Relay + Kafka
    UC->>R: ListDue(now)
    loop each PROCESSING submission
        alt now before notBefore
            A-->>UC: ErrSubmissionNotDue, skip
        else due
            alt drawn by TX_FAILURE_RATE
                Note over UC: outcome FAILURE, simulated error
            else NODE_REGISTRATION, NODE_PROFILE or INVENTORY
                UC->>NB: POST /nodes, PUT operational-profile or POST /inventory-feeds
                alt 2xx
                    NB-->>UC: outcome SUCCESS
                else 4xx
                    NB-->>UC: outcome FAILURE, code is the owner's Err name
                else 5xx or timeout
                    Note over UC: stay PROCESSING, next tick
                end
            else ACKNOWLEDGEMENT or SHIPMENT_CONFIRMATION
                Note over UC: outcome SUCCESS
            end
            UC->>A: Submission.Process(status, errors)
            alt outcome already set
                A-->>UC: ErrSubmissionAlreadyProcessed, skip
            else set
                opt PO kinds
                    UC->>A: PurchaseOrder outcome, ACCEPTED, REJECTED, ISSUED, SHIPPED or ACCEPTED
                end
                Note over R,OB: one transaction for both aggregates
                UC->>R: Save(submission, po, expected versions)
                alt version conflict
                    R-->>UC: rolled back, retried next tick
                else committed
                    UC->>OB: append SubmissionProcessed and the PO event if any
                    OB->>K: relay publishes, key transactionId or poNumber
                end
            end
        end
    end
```

Derived from: `model.yaml → contexts[vendor-connectivity].aggregates[Submission]`,
`.aggregates[PurchaseOrder].transitions` (`ProcessSubmission`),
`.sync_calls`, `.policies[SimulationKnobs]`, `.publishes`.

Omitted: the PO event is `PurchaseOrderAccepted`, `PurchaseOrderRejected`
or `VendorShipmentConfirmed` on success, and none on failure. Changing two
aggregates in one transaction is a proposed exception, listed as an open
question on [Use Cases](/network/contexts/vendor-connectivity/use-cases).
