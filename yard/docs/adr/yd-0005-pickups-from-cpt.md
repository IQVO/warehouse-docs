---
id: yd-0005-pickups-from-cpt
title: "YD-0005: Outbound pickups come from the fleet CPT schedule, never from the retail network"
sidebar_label: "YD-0005"
description: "Phase 2 PickupFromCutoffs reads CPTScheduleChanged; no retailnetwork topic is touched."
---

# YD-0005: Outbound pickups come from the fleet CPT schedule, never from the retail network

## Status

Accepted (2026-11-05): decisions confirmed by the owner the same day; built in both services on develop (merged 2026-11-08); both are registered in warehouse-infra develop (apps.yaml entry, helm values, image pinned at v0.1.2), released at v0.1.2 and applied to the k3s cluster on 2026-11-10 (reduced footprint).

## Decision

Outbound pickup appointments (phase 2) are derived from `process-path-management`'s `CPTScheduleChanged`, which the network integration defines as the network's pickup cutoff. The hard boundary holds: the yard contexts consume no `retailnetwork.*` topic and call no retail-network service; the only channel to the network stays `network-fulfillment` and the Vendor API.
