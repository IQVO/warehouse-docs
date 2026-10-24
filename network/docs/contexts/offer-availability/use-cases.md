---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: "The proposed application use cases of Offer & Availability, one per command: trigger, adapter, flow, errors with HTTP mapping, events and idempotency."
---

# Use Cases

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

One section per command in `contexts[offer-availability].aggregates[*].commands`.
The proposed Go package is `internal/application/usecases`. Step-by-step
diagrams are on [Sequence Diagrams](/network/contexts/offer-availability/sequence-diagrams);
payloads are on [Domain Events](/network/contexts/offer-availability/domain-events).

Error mapping rule (proposed contract): validation → `422`, conflict or
state → `409`, not found → `404`, stale → `409`. Every error body is
`application/problem+json` (RFC 9457) whose `type` is the slug shown.
Reads (`GET /catalog`, `GET /catalog/{catalogItemId}`,
`GET /listings?nodeId=&catalogItemId=`, `GET /inventory-feeds/{feedId}`)
are not use cases: they read the repositories directly.

## Triggers at a glance

| Use case | Aggregate | Actor / trigger | Inbound adapter |
| --- | --- | --- | --- |
| `CreateCatalogItem` | `CatalogItem` | Network merchandising | REST `POST /catalog-items` |
| `DiscontinueItem` | `CatalogItem` | Network merchandising | REST `POST /catalog-items/{catalogItemId}:discontinue` |
| `CreateListing` | `Listing` | Network merchandising | REST `POST /listings` |
| `ApplyInventoryFeed` | `InventoryFeed` (+ `Listing`) | `vendor-connectivity` | REST `POST /inventory-feeds` (in-org) |
| `ApplyAvailability` | `Listing` | `ApplyInventoryFeed` | none of its own |
| `SuppressListing` | `Listing` | policy `SuppressOnNodeUnavailable` on `NodeSuspended` / `NodeRetired` | Kafka consumer, `retailnetwork.node-topology.events` |
| `RestoreListing` | `Listing` | policy `SuppressOnNodeUnavailable` on `NodeActivated` | Kafka consumer, `retailnetwork.node-topology.events` |

## CreateCatalogItem

- **Actor / trigger**: network merchandising.
- **Inbound adapter**: REST `POST /catalog-items`, header
  `Idempotency-Key`.
- **Preconditions**: none.
- **Main flow**:
  1. Read `title`, `lengthMm`, `widthMm`, `heightMm`, `weightG`, `hazmat`,
     `fragile`.
  2. Build `catalog.Item` in state `ACTIVE` with a new `catalogItemId`;
     dimensions and weight must be positive.
  3. In one transaction: insert the item and the `CatalogItemCreated`
     outbox row.
  4. Reply `201` with the item.
- **Errors**:

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrInvalidItemDimensions` | 422 | `invalid-item-dimensions` |

- **Events emitted**: `CatalogItemCreated`.
- **Idempotency**: a repeated `Idempotency-Key` with the same body replays
  the stored `201`; no second item, no second event.

## DiscontinueItem

- **Actor / trigger**: network merchandising.
- **Inbound adapter**: REST `POST /catalog-items/{catalogItemId}:discontinue`,
  header `Idempotency-Key`.
- **Preconditions**: the item exists and is `ACTIVE`.
- **Main flow**:
  1. Load the item by `catalogItemId`.
  2. Transition `ACTIVE` → `DISCONTINUED`.
  3. In one transaction, with a `version` check: update the item and
     insert the `CatalogItemDiscontinued` outbox row.
  4. Reply `200` with the item.
- **Errors**:

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| unknown `catalogItemId` (no `Err...` in the model) | 404 | `not-found` |
| `version` mismatch (proposed optimistic concurrency) | 409 | `concurrent-modification` |

- **Events emitted**: `CatalogItemDiscontinued`.
- **Idempotency**: proposed: discontinuing a `DISCONTINUED` item returns
  it unchanged and emits nothing; a repeated `Idempotency-Key` replays the
  first answer. The model names no error for this case.

## CreateListing

- **Actor / trigger**: network merchandising.
- **Inbound adapter**: REST `POST /listings`, header `Idempotency-Key`.
- **Preconditions**: no listing exists for (`catalogItemId`, `nodeId`).
- **Main flow**:
  1. Read `catalogItemId`, `nodeId`.
  2. Read the node's status from `NodeStatusView`.
  3. Build `listing.Listing` with a new `listingId`: `LIVE` if the node is
     `ACTIVE`, otherwise `SUPPRESSED` (proposed reading of
     `ErrNodeNotSellable`; the model gives no initial state).
  4. In one transaction: insert the listing (unique key on
     `catalog_item_id, node_id`) and the `ListingCreated` outbox row.
  5. Reply `201` with the listing.
- **Errors**:

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrDuplicateListing` | 409 | `duplicate-listing` |

- **Events emitted**: `ListingCreated`.
- **Idempotency**: a repeated `Idempotency-Key` replays the stored `201`.
  Without the key, the unique key turns a duplicate into
  `ErrDuplicateListing`.

The model names no error for an unknown `catalogItemId` or `nodeId`; that
gap is listed on the [canvas](/network/contexts/offer-availability/bounded-context-canvas).

## ApplyInventoryFeed

- **Actor / trigger**: `vendor-connectivity`, while it processes a
  vendor's `SubmitInventory` (`POST /vendor/inventory`) transaction.
  `vendor-connectivity` owns the asynchronous `Submission`, the `202` to
  the vendor, rate limits and the vendor-owns-node check.
- **Inbound adapter**: REST `POST /inventory-feeds` (in-org), header
  `Idempotency-Key`.
- **Preconditions**: no `APPLIED` feed with this `feedId`.
- **Main flow**:
  1. Read `feedId`, `nodeId`, `fullUpdate`, `asOf` and the lines
     (`listingId`, `availableQty`, `basis`). The line shape and the
     feed-level `asOf` are proposed; the model does not define them.
  2. Load the feed by `feedId`. If it is `APPLIED`, refuse with
     `ErrFeedAlreadyApplied`.
  3. Record the feed `RECEIVED`.
  4. Load the listings the lines name and, for a full feed, every listing
     of `nodeId`.
  5. For each line: the listing must belong to `nodeId`
     (`ErrListingNotOnNode`). Call `ApplyAvailability` with
     (`availableQty`, `basis`, `asOf`, `feedId`). A negative quantity
     fails the feed (`ErrNegativeAvailability`). A stale line
     (`ErrStaleAvailability`) is ignored and the apply continues.
  6. If `fullUpdate`: policy `FullFeedZeroing` calls `ApplyAvailability`
     with `availableQty=0` on every listing of the node the feed omits.
  7. On any failing invariant: set the feed `FAILED`, change no listing,
     commit the feed row only, reply `422`.
  8. Otherwise set the feed `APPLIED` and commit, in one transaction: the
     feed, every changed listing (each with its `version` check), one
     `ListingAvailabilityChanged` outbox row per changed listing, and one
     `InventoryFeedApplied` row.
  9. Reply `201` with the feed.
- **Errors**:

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrListingNotOnNode` | 422 | `listing-not-on-node` |
| `ErrNegativeAvailability` | 422 | `negative-availability` |
| `ErrFeedAlreadyApplied` | 409 | `feed-already-applied` |
| `ErrStaleAvailability` | 409 | `stale-availability` (reserved: the model says a stale update is ignored, so this route does not return it; the line is skipped) |
| listing `version` mismatch (proposed) | — | not returned: the use case re-runs the apply from step 4 |

- **Events emitted**: `ListingAvailabilityChanged` (per changed listing,
  zeroed ones included), `InventoryFeedApplied` (once). A `FAILED` feed
  emits nothing.
- **Idempotency**: two layers. A repeated `Idempotency-Key` replays the
  stored answer. A different key with an `APPLIED` `feedId` gets
  `ErrFeedAlreadyApplied`. The model does not say whether a `FAILED`
  `feedId` may be re-sent; proposed: the stored `422` is replayed and a
  corrected feed uses a new `feedId`.

## ApplyAvailability

- **Actor / trigger**: the `ApplyInventoryFeed` use case, once per line and
  once per listing zeroed by `FullFeedZeroing`.
- **Inbound adapter**: none; it runs inside the `ApplyInventoryFeed`
  transaction.
- **Preconditions**: the listing exists.
- **Main flow**:
  1. Compare the new `asOf` with the listing's current `asOf`. Not later:
     return `ErrStaleAvailability` (the caller ignores the line).
  2. Check `availableQty >= 0`.
  3. Replace `Availability` with (`availableQty`, `basis`, `asOf`,
     `feedId`), keeping the vendor's `basis` as given.
  4. Record `ListingAvailabilityChanged`.
- **Errors**:

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrNegativeAvailability` | 422 (through `ApplyInventoryFeed`) | `negative-availability` |
| `ErrStaleAvailability` | none (line ignored) | `stale-availability` (reserved) |

- **Events emitted**: `ListingAvailabilityChanged`.
- **Idempotency**: monotonic `asOf` makes a replayed line a stale no-op.
  The state (`LIVE` / `SUPPRESSED`) is not touched; proposed: a
  `SUPPRESSED` listing still takes availability updates.

## SuppressListing

- **Actor / trigger**: policy `SuppressOnNodeUnavailable`, on
  `com.retailnetwork.logistics.node-topology.node.NodeSuspended` or
  `com.retailnetwork.logistics.node-topology.node.NodeRetired`.
- **Inbound adapter**: Kafka consumer of `retailnetwork.node-topology.events`
  (proposed group `offer-availability-node-status`).
- **Preconditions**: the listing is `LIVE`.
- **Main flow**:
  1. Skip the message if its CloudEvents `id` is in `processed_events`.
  2. Update `NodeStatusView` to `SUSPENDED` or `RETIRED`.
  3. For every `LIVE` listing of `nodeId`: transition to `SUPPRESSED` with a
     `reason` naming node unavailability.
  4. In one transaction: the view row, the listings, one
     `ListingSuppressed` outbox row per listing, and the `processed_events`
     row.
- **Errors**:

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| none in the model | n/a (consumer) | — |

  A `version` mismatch rolls back and the message is redelivered.
- **Events emitted**: `ListingSuppressed` per listing.
- **Idempotency**: the inbox on CloudEvents `id`; a `SUPPRESSED` listing is
  skipped and raises no event.

## RestoreListing

- **Actor / trigger**: policy `SuppressOnNodeUnavailable`, on
  `com.retailnetwork.logistics.node-topology.node.NodeActivated`.
- **Inbound adapter**: Kafka consumer of `retailnetwork.node-topology.events`.
- **Preconditions**: the listing is `SUPPRESSED` for node unavailability;
  the node is `ACTIVE` in `NodeStatusView`.
- **Main flow**:
  1. Skip the message if its CloudEvents `id` is in `processed_events`.
  2. Update `NodeStatusView` to `ACTIVE`.
  3. For every listing of `nodeId` suppressed for node unavailability:
     check the node is `ACTIVE`, transition to `LIVE`.
  4. In one transaction: the view row, the listings, one `ListingRestored`
     outbox row per listing, and the `processed_events` row.
- **Errors**:

| Error | HTTP | Problem `type` |
| --- | --- | --- |
| `ErrNodeNotSellable` | n/a (consumer); `409 node-not-sellable` if a route ever exposes it | `node-not-sellable` |

  `ErrNodeNotSellable` means the view says the node is not `ACTIVE` (for
  example after an out-of-order replay); the listing stays `SUPPRESSED`.
- **Events emitted**: `ListingRestored` per listing.
- **Idempotency**: the inbox on CloudEvents `id`; a `LIVE` listing is
  skipped and raises no event.
