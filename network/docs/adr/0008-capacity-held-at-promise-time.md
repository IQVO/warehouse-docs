---
id: 0008-capacity-held-at-promise-time
slug: /adr/0008-capacity-held-at-promise-time
title: "8. Fast tiers are never promised from nominal times, and capacity is held at promise time"
sidebar_label: "8. Fast tiers are never promised from nominal times, and capacity is held at promise time"
sidebar_position: 9
description: "SAME_DAY, NEXT_DAY and TWO_DAY need scheduled departures and waves with room; only STANDARD may use nominal lane times. A PromiseBook holds orders per node cutoff."
---

# 8. Fast tiers are never promised from nominal times, and capacity is held at promise time

## Status

**Proposed** (2026-10-22).

## Context

The fleet learned the same lesson inside one building: `order-management`'s
`FeasibleBy` must never fall back to a lead-time guess, because a guess
becomes an external commitment the building is measured against, while its
`Promise` may fall back because "a building that cannot say when is still a
building that will ship" (order-management ADR 0014 and ADR 0020).

## Decision

- Fast tiers require a scheduled witness path: real pickup, departures with
  remaining capacity, a wave with stops left (`ErrNominalBasisNotAllowedForTier`).
- `STANDARD` may use nominal lane transit when schedules are missing, and
  records `basis = NOMINAL`.
- `PromiseBook` per (node, pickup cutoff) enforces
  `provisional + confirmed <= share` (`ErrPromiseCapacityExhausted`);
  provisional holds expire with the checkout.

## Consequences

- A cold read model shows fewer fast offers, never a false one.
- Promises never exceed what a vendor declared it can ship by a cutoff.
- The book is contended; it is one row per (node, cutoff) and must use
  optimistic concurrency.
