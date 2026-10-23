---
id: 0004-parcel-nodes-are-network-operated
slug: /adr/0004-parcel-nodes-are-network-operated
title: "4. Parcel nodes are network-operated"
sidebar_label: "4. Parcel nodes are network-operated"
sidebar_position: 5
description: "Sortation centres, delivery stations and air hubs belong to the network; vendors register fulfillment, cross-dock and returns nodes only."
---

# 4. Parcel nodes are network-operated

## Status

**Proposed** (2026-10-22). Confirmed by the user's decision for this model.

## Context

The fleet's `facility-layout` already knows sites with roles
`SORTATION_CENTER`, `DELIVERY_STATION` and `AIR_HUB_GATEWAY` (ADR 0037) and
gives them no transfer capability: no stock is stored there. In a network
like a large operator's those buildings run the middle and last mile for everyone.

## Decision

- `node-topology` allows `SORTATION_CENTER`, `DELIVERY_STATION` and `AIR_HUB`
  only with operator `NETWORK` (`ErrOperatorNotAllowedForNodeType`).
- Vendors register `FULFILLMENT_CENTER`, `INBOUND_CROSS_DOCK` and
  `RETURNS_CENTER` only.
- The fleet never registers its parcel-role sites; its rows for them are
  reference mirrors.

## Consequences

- One owner for every parcel node; transport and last mile need no vendor
  protocol.
- The fleet's 90-site catalogue and the network's parcel nodes must be kept
  consistent by seeding both from the same catalogue, never by one reading the
  other.
