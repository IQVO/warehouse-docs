---
id: index
title: ADRs
sidebar_label: ADRs
description: "Design decisions of the yard domain, mirrored in model.yaml under decisions."
---

# ADRs

The design decisions of the yard domain. Each service repo adds its own implementation ADRs when built.

| ADR | Decision |
| --- | --- |
| [YD-0001](./yd-0001-two-contexts) | Two bounded contexts: dock-scheduling and yard-management |
| [YD-0002](./yd-0002-appointment-ownership) | DockAppointment moves from inbound-receiving to dock-scheduling |
| [YD-0003](./yd-0003-every-location-change-is-a-move) | Every location change of a trailer is a YardMove |
| [YD-0004](./yd-0004-physical-facts-win) | Physical facts win: arrival, docking and door release are recorded only by yard-management |
| [YD-0005](./yd-0005-pickups-from-cpt) | Outbound pickups come from the fleet CPT schedule, never from the retail network |
