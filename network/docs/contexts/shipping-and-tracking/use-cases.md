---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: "One section per Shipping & Tracking command: actor and trigger, inbound adapter, preconditions, main flow, errors mapped to HTTP problem types, events and idempotency."
---

# Use Cases

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One application service per command of `model.yaml →
contexts[shipping-and-tracking].aggregates[*].commands`, in the proposed
package `internal/application/usecases`. Step-by-step diagrams are on
[Sequence Diagrams](/network/contexts/shipping-and-tracking/sequence-diagrams); event
payloads are on [Domain Events](/network/contexts/shipping-and-tracking/domain-events).

`GET /journeys/{trackingNumber}` (`GetJourney`) is a read, not a use case: the
HTTP adapter loads the journey through the repository and returns it.

## Triggers at a glance

| Use case | Actor / trigger | Inbound adapter (proposed) |
| --- | --- | --- |
| `IssueLabel` | `vendor-connectivity` | REST `POST /labels` |
| `VoidLabel` | Not named in the model | REST `POST /labels/{labelRef}/voids` |
| `StartJourney` | Inside `IssueLabel` (no trigger named in the model) | none |
| `RecordScan` | Five consumed event types; an unnamed REST caller | Kafka consumers; REST `POST /journeys/{trackingNumber}/scans` |
| `RaiseException` | `ExceptionOnSilence` sweep | internal scheduler |
| `ReturnToSender` | Kafka consumer of `last-mile-delivery`'s `PackageReturnInitiated` (ADR 0002 A8) | Kafka consumer |
| `DeclareLost` | The silence sweep, 48 h after an unanswered `NO_SCAN` (ADR 0002 A8) | internal scheduler |

## How save and publish commit

Every use case that changes an aggregate saves it and writes its events to
`outbox_events` in **one Postgres transaction**. A relay publishes the
outbox rows to `retailnetwork.shipping-and-tracking.events`. Kafka consumers
add the CloudEvents `id` to `processed_events` in the same transaction.
`package_journeys` carries a `version` column; a save whose version moved
since the load is retried from the load (bounded retries; the model names
no `Err...` for it). The one synchronous call, `GetShipTo`, is made **before**
the transaction opens, so no lock is held across the network.

Error mapping for every REST route: validation 422, conflict or state 409,
not found 404, stale 409. Problems are `application/problem+json`
(RFC 9457) with `type` = the slug in the tables below.

## IssueLabel

- **Actor / trigger:** `vendor-connectivity`, while handling a vendor's
  label request (its `RequestLabel`, `POST /vendor/shipping-labels`).
- **Inbound adapter:** REST `POST /labels` (in-org), `Idempotency-Key`
  required.
- **Input (assumed, the model does not list it):** `poNumber`, `packageNo`,
  `assignmentId`, `orderId`, `tier`.
- **Preconditions:** the purchase order is `ACCEPTED` (checked by the caller,
  `ErrLabelBeforeAcceptance` in `vendor-connectivity`); no label exists for
  `(poNumber, packageNo)`.
- **Main flow:**
  1. If the `Idempotency-Key` was seen with the same body, return the stored
     response.
  2. Check that no label exists for `(poNumber, packageNo)`.
  3. Call `customer-ordering` `GetShipTo` (`GET /orders/{orderId}/ship-to`).
  4. Encrypt the ship-to into a snapshot.
  5. Generate a tracking number and a `labelRef`; choose the carrier.
  6. Build the `ShippingLabel` (`ISSUED`) and run `StartJourney` for the
     same tracking number (`LABELLED`).
  7. In one transaction: insert the label, the snapshot, the journey and
     the `LabelIssued` outbox row.
  8. Return `201` with `labelRef`, `trackingNumber`, `carrier` and the label
     metadata, never the address.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrLabelAlreadyIssued` | 409 | `label-already-issued` |
| `ErrTrackingNumberTaken` | 409 | `tracking-number-taken` (a generator collision; the use case retries once with a new number before answering) |
| Request validation (no `Err...` in the model) | 422 | `validation-failed` |
| `GetShipTo` fails or times out (no `Err...` in the model) | 503 | `ship-to-unavailable` |

- **Events:** `LabelIssued`.
- **Idempotency:** the `Idempotency-Key` replays the first response; a new
  key for the same `(poNumber, packageNo)` hits the unique constraint and
  answers `409 label-already-issued`.

## VoidLabel

- **Actor / trigger:** not named in the model.
- **Inbound adapter:** REST `POST /labels/{labelRef}/voids`, body `reason`,
  `Idempotency-Key` required.
- **Preconditions:** the label exists.
- **Main flow:**
  1. Load the label by `labelRef`.
  2. If it is already `VOIDED`, return it unchanged (no second event).
  3. Move it `ISSUED -> VOIDED` with the reason.
  4. In one transaction: save the label and write the `LabelVoided` outbox
     row.
  5. Return `200` with the label.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| Label not found (`ErrNotFound`) | 404 | `not-found` |
| Request validation (`ErrValidation`) | 422 | `validation-failed` |
| The journey is past `LABELLED` and still open (`ErrVoidAfterHandover`) | 409 | `void-after-handover` |
| The journey is closed, for example `DELIVERED` (`ErrJourneyClosed`) | 409 | `journey-closed` |

- **Events:** `LabelVoided`.
- **Journey:** the void closes the `LABELLED` journey of the same tracking
  number as `VOIDED` in the same transaction (ADR 0002 A13). The journey is
  checked first: a delivered, returned, lost or already voided journey answers
  `journey-closed`, an open journey past `LABELLED` `void-after-handover`.
- **Idempotency:** voiding a `VOIDED` label returns it unchanged with `200`
  and publishes nothing.

## StartJourney

- **Actor / trigger:** the `IssueLabel` use case, step 6. The model names
  the command but no trigger; running it inside `IssueLabel` is this pack's
  assumption.
- **Inbound adapter:** none of its own.
- **Preconditions:** no journey exists for the tracking number.
- **Main flow:**
  1. Create `PackageJourney` in `LABELLED` with `trackingNumber`,
     `labelRef`, `poNumber`, `assignmentId` and `orderId`.
  2. Saved in the `IssueLabel` transaction.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrTrackingNumberTaken` (a journey already holds the number) | 409 | `tracking-number-taken` |

- **Events:** none of its own (the model lists no journey-started event;
  `LabelIssued` announces the package).
- **Idempotency:** inherits `IssueLabel`'s.

## RecordScan

- **Actor / trigger:** a consumed event, or an unnamed REST caller.
- **Inbound adapters:**
  - Kafka consumer of `com.retailnetwork.partner.vendor-connectivity.purchaseorder.VendorShipmentConfirmed`;
  - Kafka consumer of `com.retailnetwork.logistics.linehaul-transportation.load.LoadDeparted`
    and `com.retailnetwork.logistics.linehaul-transportation.load.LoadArrived`;
  - Kafka consumer of `com.retailnetwork.logistics.last-mile-delivery.route.PackageOutForDelivery`
    and `com.retailnetwork.logistics.last-mile-delivery.route.DeliveryAttempted`;
  - REST `POST /journeys/{trackingNumber}/scans`, body `scanId`, `nodeId`,
    `scanType`, `at`, `Idempotency-Key` required.
- **Preconditions:** the journey exists and is open.
- **Main flow:**
  1. The adapter turns the fact into one `Scan` per tracking number
     (`scanId` = `<CloudEvents id>:<trackingNumber>` for events; the caller's
     `scanId` for REST).
  2. Load the journey.
  3. `RecordScan`, in this order: refuse on a closed journey
     (`ErrJourneyClosed`); refuse a known `scanId` (`ErrDuplicateScan`); if the
     scan is older than the last applied scan, store it as not applied; a scan
     with no edge from the current state is stored as not applied and answers
     `ErrIllegalTransition`; otherwise apply the transition from the fact (mapping on the
     [Aggregate Design Canvas](/network/contexts/shipping-and-tracking/aggregate-design-canvas)).
  4. On `LABELLED -> HANDED_OVER` raise `PackageHandedOver`
     (`HandoverOnFirstScan`); on `-> DELIVERED` raise `PackageDelivered`;
     on every applied scan raise `PackageScanned`.
  5. In one transaction: save the journey (version check), its new scan,
     the outbox rows and, for a consumer, the `processed_events` row.

| Error | HTTP (REST only) | Problem `type` | Consumer behaviour |
| --- | --- | --- | --- |
| `ErrDuplicateScan` | 409 | `duplicate-scan` | treated as done, acknowledged |
| `ErrScanOutOfOrder` | 409 | `scan-out-of-order` | scan stored, not applied, acknowledged |
| `ErrJourneyClosed` | 409 | `journey-closed` | logged, acknowledged |
| `ErrIllegalTransition` (no edge from the current state) | 409 | `illegal-transition` | scan stored, not applied, acknowledged |
| Journey not found (no `Err...` in the model) | 404 | `not-found` | logged, counted, acknowledged |
| Request validation (no `Err...` in the model) | 422 | `validation-failed` | not applicable |

- **Events:** `PackageScanned`, plus `PackageHandedOver` or
  `PackageDelivered` on those transitions.
- **Idempotency:** the inbox on the CloudEvents `id`, and `ErrDuplicateScan`
  on `scanId` for a partly applied multi-package load event.

## RaiseException

- **Actor / trigger:** the `ExceptionOnSilence` sweep, on a timer.
- **Inbound adapter:** internal scheduler.
- **Preconditions:** the journey is open and no scan arrived within the
  expected leg time plus tolerance. The model does not give this context the
  expected leg time (no departure, lane or wave event is consumed); see the
  [canvas open questions](/network/contexts/shipping-and-tracking/bounded-context-canvas).
- **Main flow:**
  1. Select open journeys whose next scan is overdue.
  2. For each, `RaiseException` with reason `NO_SCAN`; the state does not
     change.
  3. In one transaction per journey: record the exception and write the
     `PackageExceptionRaised` outbox row.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrJourneyClosed` | none (internal) | the journey closed between select and save; skipped |

- **Events:** `PackageExceptionRaised`.
- **Idempotency:** one exception per silence: the journey records when it
  last raised one, and the sweep skips it until a new scan arrives.

## ReturnToSender

- **Actor / trigger:** the consumed `PackageReturnInitiated` of
  `last-mile-delivery` (raised on the third failed attempt; ADR 0002 A8).
- **Inbound adapter:** Kafka consumer of
  `com.retailnetwork.logistics.last-mile-delivery.packageattempthistory.PackageReturnInitiated`
  (the `route` entity spelling is accepted).
- **Preconditions:** the journey is `AT_STATION`.
- **Main flow:** move `AT_STATION -> RETURNED`; save with the
  `PackageReturned` outbox row in one transaction; `returnedAt` is the event's
  CloudEvents `time`.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrJourneyClosed` | 409 (if a route is added) | `journey-closed` |

- **Events:** `PackageReturned`.
- **Idempotency:** the inbox on the CloudEvents `id`; a second call on a
  `RETURNED` journey hits `ErrJourneyClosed`.

## DeclareLost

- **Actor / trigger:** the silence sweep (ADR 0002 A8): an `IN_TRANSIT`
  journey whose `NO_SCAN` exception stayed unanswered (no applied scan since)
  for 48 hours is declared lost. The model names no other trigger.
- **Inbound adapter:** internal scheduler.
- **Preconditions:** the journey is `IN_TRANSIT` (the only state with a
  `LOST` edge).
- **Main flow:** move `IN_TRANSIT -> LOST`; save with the `PackageLost`
  outbox row in one transaction.

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrJourneyClosed` | 409 (if a route is added) | `journey-closed` |

- **Events:** `PackageLost`.
- **Idempotency:** a second call on a `LOST` journey hits
  `ErrJourneyClosed`.
