---
id: 0011-pickup-points
slug: /adr/0011-pickup-points
title: "11. Pickup points and lockers"
sidebar_label: "11. Pickup points and lockers"
sidebar_position: 12
description: "A PICKUP_POINT node type operated by the network or a partner; a checkout destination that shrinks PII; collection states on the package."
---

# 11. Pickup points and lockers

## Status

**Accepted** (2026-11-13, the user's decision). Extends 0004 with a new node
type; it does not open parcel nodes to vendors.

## Context

Out-of-home delivery cuts failed attended-delivery attempts and last-mile
cost: many packages for one address take one stop, and a locker never waits at
home. Partner drop-off networks extend coverage without the network building
buildings. The checkout destination today is always a ship-to address, which
carries the PII burden 0006 confines.

## Decision

- New node type `PICKUP_POINT` with capability `COLLECTION`, operated
  `NETWORK` or `PARTNER`, served by one delivery station; it is a route stop,
  never a lane end (no new lane type).
- Checkout may name a `pickupPointId` as the destination instead of a ship-to:
  the promise resolves it to the point's station, and no address is carried
  for the delivery (a PII reduction in the spirit of 0006).
- Last-mile treats a point as one stop with its own stop identity (the point
  id, not an address key): many packages take one unit of stop capacity.
- The package gains the states `READY_FOR_COLLECTION` and `COLLECTED`, and
  `UNCOLLECTED -> RETURN_TO_SENDER` after a retention window; the promise
  judgement keeps using `deliverByLatest` (collection ends the package, the
  window does not move).

## Consequences

- Attended-delivery failures stop being the only failure mode for shoppers who
  choose a point; the stop count for a point address collapses to one.
- The partner boundary is the node registration (0003's declared profile and
  the scorecard apply to a partner point exactly as to any node).
- Uncollected packages re-enter the network as reverse freight; the returns
  context owns what happens after `RETURN_TO_SENDER`.
