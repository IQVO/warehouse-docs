---
id: yd-0001-two-contexts
title: "YD-0001: Two bounded contexts: dock-scheduling and yard-management"
sidebar_label: "YD-0001"
description: "The yard splits on time, not on nouns: door time (future) and yard state (present)."
---

# YD-0001: Two bounded contexts: dock-scheduling and yard-management

## Status

Accepted (2026-11-05): decisions confirmed by the owner the same day; built in both services on develop (merged 2026-11-08), not deployed.

## Context

A YMS covers three areas: gate/kiosk, the yard, and inbound and outbound dock door scheduling ([Benchmarks](/yard/research/benchmarks)). `inbound-receiving` ADR 0001 excludes yard and trailer management and ends its appointment at the door. `facility-layout` already registers `Yard` and `Dock` locations, but no context models an outbound appointment, a trailer, spot occupancy, a gate visit or a move.

## Decision

Two contexts. `dock-scheduling` owns the future of a door (booked windows, calendar, ETA risk, no-shows) and its invariant is no overlap per door. `yard-management` owns the present (visits, trailers, moves, door work, yard checks) and its invariants are one trailer per spot or door and one place per trailer.

A separate gate context and a separate move-dispatch context were rejected: check-in creates the yard presence that check-out ends, and completing a move changes the trailer's location in the same unit of work, so each split would cut one invariant across two databases. Kiosk, ANPR and camera check-in are inbound adapters that issue `CheckInVisit`.

## Consequences

Two new deployables. The contexts consume each other's events; their flows are independent and neither writes into the other's aggregates.
