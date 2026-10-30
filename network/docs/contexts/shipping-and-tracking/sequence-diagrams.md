---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: "Proposed UML sequence diagrams for every Shipping & Tracking command use case, from inbound adapter to Kafka through the transactional outbox."
---

# Sequence Diagrams

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One UML sequence diagram per command use case of
[Use Cases](/network/contexts/shipping-and-tracking/use-cases). To stay readable,
`DB` stands for one Postgres transaction that holds the repositories, the
`outbox_events` insert and, for consumers, the `processed_events` insert.
`Relay` stands for the outbox relay that publishes committed rows to Kafka
topic `retailnetwork.shipping-and-tracking.events`. The relay always runs
after the commit, never inside it.

## 1. IssueLabel (with StartJourney)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http adapter
    participant UC as IssueLabel
    participant CO as ShipToReader customer-ordering
    participant A as ShippingLabel and PackageJourney
    participant DB as DB transaction
    participant RL as Relay to Kafka
    Note over H: vendor-connectivity calls POST /labels with Idempotency-Key
    H->>DB: find Idempotency-Key
    alt key seen with the same body
        DB-->>H: stored response
        Note over H: replay 201, nothing else runs
    else new key
        H->>UC: Execute poNumber, packageNo, assignmentId, orderId, tier
        UC->>DB: find label by poNumber and packageNo
        alt label exists
            UC-->>H: ErrLabelAlreadyIssued
            Note over H: 409 label-already-issued
        else no label
            UC->>CO: GetShipTo GET /orders/orderId/ship-to
            alt unavailable or non-2xx
                UC-->>H: ship-to unavailable
                Note over H: 503 ship-to-unavailable, nothing stored
            else ship-to returned
                UC->>A: IssueLabel with encrypted snapshot and new trackingNumber
                UC->>A: StartJourney, state LABELLED
                UC->>DB: insert label, snapshot, journey, outbox LabelIssued, idempotency key
                alt unique violation on trackingNumber
                    DB-->>UC: ErrTrackingNumberTaken
                    Note over UC: retry once with a new number, then 409 tracking-number-taken
                else unique violation on poNumber and packageNo
                    DB-->>UC: ErrLabelAlreadyIssued
                    Note over H: 409 label-already-issued, a concurrent request won
                else committed
                    UC-->>H: label
                    Note over H: 201 labelRef, trackingNumber, carrier, no address
                end
            end
        end
    end
    RL->>DB: claim unpublished outbox rows
    Note over RL: publish label.LabelIssued keyed by labelRef, mark published
```

Derived from: `model.yaml → contexts[shipping-and-tracking].aggregates[ShippingLabel]`,
`.aggregates[PackageJourney].commands[StartJourney]`, `.sync_calls[GetShipTo]`,
`.publishes[LabelIssued]`; `conventions.integration_rules`.

Omitted: request validation (422 `validation-failed`); the encryption key
lookup. The call to `customer-ordering` is made before the transaction
opens. The request fields are an assumption (the model does not list them).

## 2. VoidLabel

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http adapter
    participant UC as VoidLabel
    participant A as ShippingLabel
    participant DB as DB transaction
    participant RL as Relay to Kafka
    Note over H: caller not named in the model, POST /labels/labelRef:void
    H->>UC: Execute labelRef, reason
    UC->>DB: load label
    alt not found
        UC-->>H: label not found
        Note over H: 404 label-not-found
    else already VOIDED
        UC-->>H: label unchanged
        Note over H: 200, no second event
    else ISSUED
        UC->>A: VoidLabel reason
        UC->>DB: update label, outbox LabelVoided, idempotency key
        UC-->>H: label VOIDED
        Note over H: 200
    end
    RL->>DB: claim unpublished outbox rows
    Note over RL: publish label.LabelVoided keyed by labelRef
```

Derived from: `model.yaml → contexts[shipping-and-tracking].aggregates[ShippingLabel].transitions`,
`.rest`, `.publishes[LabelVoided]`.

Omitted: the `Idempotency-Key` replay (as in diagram 1). The journey of the
same tracking number is not touched; the model does not say it should be.

## 3. RecordScan (Kafka consumer)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant KC as kafka consumer
    participant UC as RecordScan
    participant A as PackageJourney
    participant DB as DB transaction
    participant RL as Relay to Kafka
    Note over KC: LoadDeparted, LoadArrived, PackageOutForDelivery, DeliveryAttempted or VendorShipmentConfirmed
    KC->>DB: is CloudEvents id in processed_events
    alt already processed
        Note over KC: acknowledge, skip
    else new
        loop each trackingNumber in the event
            KC->>UC: Execute scanId = ce id plus trackingNumber, nodeId, scanType, at
            UC->>DB: load journey and version
            alt journey not found
                Note over UC: log, count, skip this tracking number
            else found
                UC->>A: RecordScan
                alt ErrDuplicateScan
                    Note over UC: already applied, skip
                else ErrJourneyClosed
                    Note over UC: log, skip
                else ErrScanOutOfOrder
                    UC->>DB: insert scan applied false, no event
                else applied
                    UC->>DB: update journey where version matches, insert scan, outbox PackageScanned plus PackageHandedOver or PackageDelivered
                    alt version moved
                        DB-->>UC: zero rows updated
                        Note over UC: reload and retry RecordScan
                    else committed
                        DB-->>UC: ok
                    end
                end
            end
        end
        KC->>DB: insert processed_events id
        Note over KC: acknowledge offset
    end
    RL->>DB: claim unpublished outbox rows
    Note over RL: publish journey events keyed by trackingNumber
```

Derived from: `model.yaml → contexts[shipping-and-tracking].consumes`,
`.aggregates[PackageJourney].invariants`, `.policies[HandoverOnFirstScan]`,
`.publishes`; `conventions.integration_rules` (inbox on the CloudEvents id).

Omitted: the REST path `POST /journeys/{trackingNumber}/scans` runs the same
`RecordScan` for one scan and answers `200`, `404 journey-not-found`,
`409 duplicate-scan`, `409 scan-out-of-order`, `409 journey-closed` or
`422 validation-failed`. For a one-package event the `processed_events`
insert shares the journey's transaction; for a load event it is written
after the last journey, and a redelivery in between is absorbed by
`ErrDuplicateScan`.

## 4. RaiseException (silence sweep)

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant T as scheduler
    participant UC as RaiseException
    participant A as PackageJourney
    participant DB as DB transaction
    participant RL as Relay to Kafka
    T->>UC: Execute now
    UC->>DB: list open journeys silent past expected leg time plus tolerance
    loop each silent journey
        UC->>A: RaiseException NO_SCAN
        alt ErrJourneyClosed
            Note over UC: closed since the list, skip
        else raised
            UC->>DB: update last_exception_at where version matches, outbox PackageExceptionRaised
            alt version moved
                Note over UC: a scan arrived, skip this pass
            else committed
                DB-->>UC: ok
            end
        end
    end
    RL->>DB: claim unpublished outbox rows
    Note over RL: publish journey.PackageExceptionRaised keyed by trackingNumber
```

Derived from: `model.yaml → contexts[shipping-and-tracking].policies[ExceptionOnSilence]`,
`.aggregates[PackageJourney].commands`, `.publishes[PackageExceptionRaised]`.

Omitted: how the expected leg time is known; the model gives this context no
departure, lane or wave data (an open question on the
[canvas](/network/contexts/shipping-and-tracking/bounded-context-canvas)). The state
does not change.

## 5. ReturnToSender

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant C as caller not named
    participant UC as ReturnToSender
    participant A as PackageJourney
    participant DB as DB transaction
    participant RL as Relay to Kafka
    C->>UC: Execute trackingNumber
    UC->>DB: load journey and version
    UC->>A: ReturnToSender
    alt ErrJourneyClosed
        UC-->>C: journey-closed
    else not AT_STATION
        UC-->>C: no edge from this state
    else AT_STATION
        UC->>DB: update state RETURNED where version matches, outbox PackageReturned
        alt version moved
            Note over UC: reload and retry
        else committed
            UC-->>C: RETURNED
        end
    end
    RL->>DB: claim unpublished outbox rows
    Note over RL: publish journey.PackageReturned keyed by trackingNumber
```

Derived from: `model.yaml → contexts[shipping-and-tracking].aggregates[PackageJourney].transitions`,
`.publishes[PackageReturned]`.

Omitted: the trigger. The model names none; `last-mile-delivery`'s
`RetryNextWave` returns a package after three failures but publishes no
event. The model also names no `Err...` for "no edge from this state".

## 6. DeclareLost

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant C as caller not named
    participant UC as DeclareLost
    participant A as PackageJourney
    participant DB as DB transaction
    participant RL as Relay to Kafka
    C->>UC: Execute trackingNumber
    UC->>DB: load journey and version
    UC->>A: DeclareLost
    alt ErrJourneyClosed
        UC-->>C: journey-closed
    else not IN_TRANSIT
        UC-->>C: no edge from this state
    else IN_TRANSIT
        UC->>DB: update state LOST where version matches, outbox PackageLost
        alt version moved
            Note over UC: reload and retry
        else committed
            UC-->>C: LOST
        end
    end
    RL->>DB: claim unpublished outbox rows
    Note over RL: publish journey.PackageLost keyed by trackingNumber
```

Derived from: `model.yaml → contexts[shipping-and-tracking].aggregates[PackageJourney].transitions`,
`.publishes[PackageLost]`.

Omitted: the trigger, which the model does not name; `LOST` is reachable
only from `IN_TRANSIT`.
