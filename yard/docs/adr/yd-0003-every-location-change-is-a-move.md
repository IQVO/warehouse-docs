---
id: yd-0003-every-location-change-is-a-move
title: "YD-0003: Every location change of a trailer is a YardMove"
sidebar_label: "YD-0003"
description: "One path for trailer location changes, including the visiting driver first move from the gate."
---

# YD-0003: Every location change of a trailer is a YardMove

## Status

Proposed (2026-11-05); decisions confirmed by the owner the same day.

## Decision

A trailer changes location only by completing a `YardMove`. The visiting driver's first move from the gate is created already `CLAIMED` with performer `VISITING_DRIVER` and no lease. Hostler moves are pulled with claim-next and a lease, as in `fulfillment-execution`. Completion records the actual location; a location other than the destination needs a reason.

## Consequences

Occupancy is checked in one place (`Occupancy.CheckFree` under a per-location advisory lock, backed by a partial unique index). Yard truck productivity and driver wait come from the same events.
