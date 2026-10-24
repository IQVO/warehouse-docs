---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: The two command use cases of Node Performance, RecordObservation and Recompute, with triggers, flows, errors and idempotency.
---

# Use Cases

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One section per command of `aggregates[NodeScorecard].commands`. The use
cases live in the proposed package `internal/application/usecases`. The
step-by-step runtime view is on
[Sequence Diagrams](/network/contexts/node-performance/sequence-diagrams).

Neither command has a REST route: `RecordObservation` is driven by Kafka
and `Recompute` by a timer. The HTTP status and problem `type` in each
errors table are therefore the mapping a future administrative route
must use, and what the error means for the consumer or the timer today.
The two REST routes are reads; they are listed at the end.

## Triggers at a glance

| Use case | Trigger | Inbound adapter | Events emitted |
| --- | --- | --- | --- |
| `RecordObservation` | a consumed fact about a node | `internal/adapters/inbound/kafka` consumers (group `node-performance`) | none |
| `Recompute` | timer, batched per minute | ticker in the composition root `cmd/node-performance` | `NodeScorecardUpdated`, `NodeThresholdBreached` |

## How save and publish commit

Every use case that changes a `NodeScorecard` saves it, writes its events
to `outbox_events`, and (for consumers) writes the `processed_events`
inbox row, all in one Postgres transaction. A relay drains the outbox to
`retailnetwork.node-performance.events`. The aggregate row carries a
`version`; a save with a stale version fails and the whole transaction is
retried.

## RecordObservation

Counts one observed fact on the node's two scorecards.

- **Actor / trigger:** a consumed CloudEvent of one of these types:
  `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderIssued`,
  `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderAccepted`,
  `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderRejected`,
  `com.retailnetwork.partner.vendor-connectivity.purchaseorder.PurchaseOrderExpired`,
  `com.retailnetwork.partner.vendor-connectivity.purchaseorder.VendorShipmentConfirmed`,
  `com.retailnetwork.logistics.shipping-and-tracking.journey.PackageHandedOver`,
  `com.retailnetwork.commerce.delivery-promise.promise.PromiseKept`,
  `com.retailnetwork.commerce.delivery-promise.promise.PromiseBroken`,
  `com.retailnetwork.commerce.offer-availability.inventoryfeed.InventoryFeedApplied`.
- **Inbound adapter:** `internal/adapters/inbound/kafka`, one consumer per
  topic (`retailnetwork.vendor-connectivity.events`,
  `retailnetwork.shipping-and-tracking.events`,
  `retailnetwork.delivery-promise.events`,
  `retailnetwork.offer-availability.events`,
  `retailnetwork.node-topology.events`), dispatching on the full `type`.
  The four types with no use in the model (`VendorOnboarded`,
  `SubmissionProcessed`, `NodeRegistered`,
  `NodeOperationalProfileDeclared`) are written to the inbox and
  acknowledged without calling this use case.
- **Preconditions:** the message is a valid CloudEvent; the `data` carries
  a `nodeId`.
- **Main flow:**
  1. Decode the envelope and map `data` to an `Observation`: the source
     CloudEvents `id`, the `type`, the `nodeId`, the envelope `time`, and
     the source fields a metric reads (for example `poNumber`,
     `requiredShipBy`, `ackBy`, `acceptedAt`, `handedOverAt`, `appliedAt`).
  2. Begin a transaction.
  3. Insert the CloudEvents `id` into `processed_events`. If it is already
     there, commit, acknowledge the offset and stop.
  4. Load the scorecards `nodeId:7d` and `nodeId:30d`. A missing one is
     created `PROVISIONAL` with no observations.
  5. Call `NodeScorecard.RecordObservation(obs)` on each.
  6. Save both with their version check, mark them due for `Recompute`.
  7. Commit, then acknowledge the Kafka offset.
- **Errors:**

  | Error | HTTP status | Problem `type` | Consumer behaviour |
  | --- | --- | --- | --- |
  | `ErrDuplicateObservation` | 409 | `duplicate-observation` | Treated as success: commit the inbox row, acknowledge. |
  | Stale version on save (infrastructure, no `Err...` in the model) | 409 | `concurrent-update` | Roll back and retry the message. |
  | Undecodable message or missing `nodeId` (infrastructure) | 422 | `invalid-observation` | Do not retry; send to the dead-letter path. |

- **Events emitted:** none.
- **Idempotency:** the inbox on the CloudEvents `id`; behind it,
  `ErrDuplicateObservation` on the same source event id inside the
  aggregate.

## Recompute

Recomputes one scorecard's metrics over its window and grades it.

- **Actor / trigger:** the per-minute timer ("recompute batched per
  minute").
- **Inbound adapter:** a ticker started in `cmd/node-performance` (the
  fleet's composition-root pattern), calling the use case once per pass.
- **Preconditions:** the scorecard exists and is due: it received an
  observation since the last pass, or an observation is about to leave its
  window.
- **Main flow:**
  1. List due scorecards.
  2. For each, begin a transaction and load it.
  3. Call `NodeScorecard.Recompute(now, minObservations, grading)`:
     1. drop observations older than the window;
     2. compute `Metrics` (each rate in `[0,1]`, `ErrRateOutOfRange`
        otherwise) and `observations`;
     3. if `observations < minObservations`, set state `PROVISIONAL` and
        grade `PROVISIONAL`; otherwise set state `GRADED` and the grade by
        the `Grading` policy;
     4. compare each metric with the previous one under `ThresholdAlert`
        and record a `NodeThresholdBreached` for each downward crossing.
  4. Save with the version check; write `NodeScorecardUpdated` and any
     `NodeThresholdBreached` to `outbox_events` in the same transaction.
  5. Commit.
- **Errors:**

  | Error | HTTP status | Problem `type` | Timer behaviour |
  | --- | --- | --- | --- |
  | `ErrRateOutOfRange` | 422 | `rate-out-of-range` | A defect: log, skip this scorecard, keep the pass going. |
  | `ErrInsufficientObservations` | 409 | `insufficient-observations` | Not reached by `Recompute`, which chooses `PROVISIONAL` for a thin window; it guards any other path that would set a grade. |
  | Stale version on save (infrastructure) | 409 | `concurrent-update` | Roll back; the scorecard stays due and the next pass retries. |

- **Events emitted:** `NodeScorecardUpdated` after every saved recompute;
  `NodeThresholdBreached` once per metric that crossed its threshold
  downward.
- **Idempotency:** the result is a function of the observations in the
  window and `now`. A pass that runs twice on the same data saves the same
  metrics and republishes the same values with a new CloudEvents `id`;
  consumers keep the latest per `nodeId` and `window`.

## Queries (not use cases)

| Route | Caller | Reads | Errors |
| --- | --- | --- | --- |
| `GET /scorecards/{nodeId}` | `vendor-connectivity` (`GetScorecard`) | both scorecards of the node | 404 `scorecard-not-found` when the node has no scorecard yet (no `Err...` in the model) |
| `GET /scorecards?grade=` | not named in the model | scorecards with that current grade | 422 `invalid-grade` for a value outside `A`, `B`, `C`, `D`, `PROVISIONAL` |

Both are in `apis/node-performance/openapi.yaml`. Neither changes state,
so neither takes an `Idempotency-Key`.
