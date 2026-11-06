---
id: yd-0004-physical-facts-win
title: "YD-0004: Physical facts win: arrival, docking and door release are recorded only by yard-management"
sidebar_label: "YD-0004"
description: "dock-scheduling applies physical facts from events and never records them from its own API."
---

# YD-0004: Physical facts win: arrival, docking and door release are recorded only by yard-management

## Status

Proposed (2026-11-05); decisions confirmed by the owner the same day.

## Decision

`RecordArrival`, docking and door release are raised by `yard-management` and applied by `dock-scheduling` through the policies `ArrivalFromGate`, `ActualDoorWins` and `CompleteOnDoorRelease`. When the trailer docks at a door other than the booked one, the booking follows the trailer without the overlap refusal and any later appointment that now overlaps gets `DockAppointmentAtRisk`. Yard events are keyed by visit or trailer, so they can arrive in any order across partitions: `OutOfOrderYardFacts` defines the tolerant handling.

## Consequences

The calendar can briefly disagree with the yard; the yard is right.
