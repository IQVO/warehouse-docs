---
id: 0002-promise-and-assignment-are-separate
slug: /adr/0002-promise-and-assignment-are-separate
title: "2. Promise and order assignment are separate contexts"
sidebar_label: "2. Promise and order assignment are separate contexts"
sidebar_position: 3
description: "delivery-promise proves a date with a witness path and holds capacity; order-sourcing assigns later, may choose another path, and locks at commitment."
---

# 2. Promise and order assignment are separate contexts

## Status

**Proposed** (2026-10-22).

## Context

The published account of Amazon's regionalization says the promise is based
on network state and a check that at least one feasible delivery path exists;
items are then queued and assigned to centres and paths later, possibly
differently, and the path can change until the item is picked
([research](/network/research/amazon-logistics-network)). Promising needs a fast
answer from local data; assignment benefits from waiting.

## Decision

1. `delivery-promise` owns `DeliveryOffer`, `Promise` and `PromiseBook`. A
   promise carries a **witness path** (node, pickup, legs, wave) that proves
   feasibility, and holds capacity on the node's pickup cutoff.
2. `order-sourcing` owns `FulfillmentAssignment`. It keeps each shipment
   group in a virtual queue until a release point, re-optimizes, and may pick
   a node other than the witness, provided the path still meets
   `deliverByLatest` (`ErrCandidateBreaksPromise`).
3. When no node can keep the promise, sourcing publishes
   `FulfillmentUnsourceable` and the promise context re-promises; sourcing
   never breaks a promise silently.

## Consequences

- The promise hot path has no synchronous dependency and no optimization
  cost.
- A witness node and an assigned node can differ; analytics must report both.
- Capacity is held twice in different senses: the promise book (orders per
  cutoff) and the linehaul booking at lock. That is deliberate: the first
  protects the vendor's declared cap, the second the truck.
