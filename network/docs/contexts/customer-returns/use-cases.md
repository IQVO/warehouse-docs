---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: "One application service per Customer Returns command, with preconditions, main flow, errors mapped to HTTP, events and idempotency."
---

# Use Cases

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built ([`IQVO/customer-returns`](https://github.com/IQVO/customer-returns), decided by [ADR 0012](/network/adr/0012-customer-returns-is-a-bounded-context)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses. Where the model left a choice open, the service's own ADRs 0001 to 0005 record what it does.
:::

One application service per command in
`contexts[customer-returns].aggregates[*].commands`, under
`internal/application/usecases`. Runtime views of the key ones are on
[Sequence Diagrams](/network/contexts/customer-returns/sequence-diagrams).
Reads (`GetReturnAuthorization`, `ListReturnAuthorizations`) go to the
repository; a read of an expired, untouched authorization cancels it first
(`LazyExpiry`).

## Conventions for every use case

- **Errors** are RFC 9457 `application/problem+json`: validation and refused
  preconditions `422`, conflict or state `409`, not found `404`, stale version `409`.
- **Idempotency-Key** on every `POST` (1 to 128 printable ASCII characters).
  A repeat with the same key replays the first response; the same key on a
  different request is `409 idempotency-key-reused`.
- **One transaction** per use case: the aggregate change, its outbox rows,
  and (for consumers) the inbox row commit together.
- **Read models are local.** `OrderGroupView` and `ReturnsNetworkView` are
  read inside the use case; the only call that leaves the context is the
  reverse-label call of `IssueLabel`, made before the transaction.

| Model error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrGroupNotShipped` | 422 | `group-not-shipped` |
| `ErrUnknownLine` | 422 | `validation-failed` |
| `ErrNoReturnDestination` | 422 | `no-return-destination` |
| `ErrLabelUnavailable` | 422 | `label-unavailable` |
| `ErrAuthorizationExpired` | 422 | `authorization-expired` |
| `ErrValidation`, `ErrNotFound`, `ErrIllegalTransition`, `ErrConcurrentUpdate` | 422, 404, 409, 409 | the shared slugs from `conventions.errors` |

## AuthorizeReturn

- **Actor / trigger:** the shopper through the storefront. REST `POST /return-authorizations`.
- **Preconditions:** the group is `SHIPPED` or `DELIVERED` in `OrderGroupView`.
- **Flow:**
  1. Read the group from `OrderGroupView`; an unknown or not yet shipped
     group is refused.
  2. Resolve each requested `lineNo` against the placed group; the quantity
     is the quantity placed on that line, the price is the caller's, the
     `ownerRef` comes from the sourcing release fact.
  3. Read the two possible destinations from `ReturnsNetworkView`: the
     `ACTIVE` returns centre of the region of the group's destination prefix,
     and the node that fulfilled the group.
  4. Decide the disposition (`DispositionDecidedAtAuthorization`): `KEEP`,
     else `NEAREST_RETURNS_CENTER`, else `ORIGIN_NODE`, else refuse.
  5. Create the authorization: `AUTHORIZED`, or `CLOSED_KEEP` at once for
     `KEEP`. `expiresAt` is `authorizedAt` plus 30 days. Save it and write
     `ReturnAuthorized` to the outbox.
- **Errors:** `ErrGroupNotShipped`, `ErrUnknownLine`, `ErrNoReturnDestination`,
  `ErrValidation` (line count, method, a `PICKUP` without a valid window).
- **Events:** `ReturnAuthorized`, for every disposition.
- **Idempotency:** the `Idempotency-Key` replays the first answer of a request
  that succeeded. A lagging view is retried with the same key and the same
  body.

## IssueLabel

- **REST:** `POST /return-authorizations/{authorizationId}/labels`, body `packageNo` 1 to 5.
- **Preconditions:** the authorization is `AUTHORIZED`, not expired, and its
  disposition is not `KEEP`.
- **Flow:**
  1. Load the authorization; cancel it if expired (`LazyExpiry`).
  2. Ask `shipping-and-tracking`'s reverse-label route for the label of the
     package, outside the transaction (`ReverseLabelCall`).
  3. In one transaction re-read the aggregate, link the tracking number and
     write `ReturnLabelIssued` to the outbox.
- **Errors:** `ErrLabelUnavailable` (the route is not configured, or answered
  anything but a tracking number), `ErrAuthorizationExpired`,
  `ErrIllegalTransition`, `ErrValidation` (a sixth package), `ErrNotFound`.
- **Events:** `ReturnLabelIssued`, once per package.
- **As built:** the route is not in `shipping-and-tracking`'s `develop`
  contract, so this use case answers `label-unavailable`.

## CancelReturn

- **REST:** `POST /return-authorizations/{authorizationId}/cancellations`.
- **Flow:** `AUTHORIZED → CANCELLED`. The reason is `SHOPPER_REQUESTED`, or
  `EXPIRED` when the authorization is past `expiresAt` at that instant.
- **Errors:** `ErrIllegalTransition` (any state other than `AUTHORIZED`),
  `ErrNotFound`.
- **Events:** `ReturnCancelled`.

## ApplyOutcome

- **Trigger:** the consumer of the vendor's graded outcome (no HTTP). Not
  triggered today: the producer's event is not on `develop`
  (`FirstFittingOutcomeCompletes`).
- **Flow:** split the outcome lines into the ones the authorization covers
  and the ones it never did. When the authorization is open (`AUTHORIZED` or
  `IN_TRANSIT`) and at least one line is covered, apply the covered lines:
  the state becomes `RECEIVED` and `ReturnCompleted` is written to the
  outbox with the authorized lines only. Record the whole outcome on
  `ReturnOutcomeFacts`, the other lines flagged unexpected.
- **Errors:** none returned. An outcome for an unknown or closed
  authorization is recorded and acknowledged.
- **Events:** `ReturnCompleted`.
- **Idempotency:** the CloudEvents `id` in the inbox.

## MarkInTransit / MarkPickupFailed

- **Trigger:** none as built. Both are transitions of the aggregate
  (`AUTHORIZED → IN_TRANSIT`, `AUTHORIZED → PICKUP_FAILED`) with no route and
  no consumer.
- **Events:** none.

## Read-model consumers

- `CustomerOrderPlaced` and `ShopperNoticeDecided` feed `OrderGroupView`.
- `NodeRegistered`, `NodeActivated`, `NodeSuspended`, `NodeRetired` and
  `ServiceAreaAssigned` feed the node and prefix halves of `ReturnsNetworkView`.
- `FulfillmentReleasedToNode` and `FulfillmentLocked` feed its origin half.
- Each is idempotent on the CloudEvents `id`; a stale `assignmentVersion` is
  a no-op.
