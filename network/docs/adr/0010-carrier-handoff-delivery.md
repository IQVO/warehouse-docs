---
id: 0010-carrier-handoff-delivery
slug: /adr/0010-carrier-handoff-delivery
title: "10. Carrier handoff delivery for low-density service areas"
sidebar_label: "10. Carrier handoff delivery"
sidebar_position: 11
description: "A service area may hand its deliveries to an external carrier at a network node; the carrier operates a delivery mode, never a node."
---

# 10. Carrier handoff delivery for low-density service areas

## Status

**Accepted** (2026-11-13, the user's decision). Amends 0004: parcel nodes stay
network-operated; this decision adds a delivery MODE an area may take, not a
node an operator may register.

## Context

Density decides whether own delivery pays: the network's routes serve dense
areas well, and low-density areas are served by third-party couriers at a lower
cost than a half-empty wave. 0004 closed parcel nodes to vendors, so the
carrier cannot become a node operator; the seam that remains is the service
area: who delivers it, and where the network hands the package over.

## Decision

- A service area declares `deliveryMode`:
  `NETWORK_ROUTE` (today's behaviour) or `CARRIER_HANDOFF{carrierId,
  handoffNodeId}` - published with `ServiceAreaAssigned` (additive, optional;
  absence is `NETWORK_ROUTE`).
- The handoff node is a network-operated parcel node (a sortation centre or
  delivery station); the carrier picks up there. The carrier operates a
  delivery mode, never a node.
- The promise for a `CARRIER_HANDOFF` area uses the carrier's declared transit
  plus measured actuals, exactly as lanes are treated (0003: declared and
  measured); never a synchronous carrier call on the promise hot path.
- Carrier tracking reaches `shipping-and-tracking` through an inbound
  translation layer (an ACL): carrier scans become the existing journey facts.
- The carrier is chosen per package at the sort node by declared cost; the
  handoff lane's declared cost is part of the estimate (the money-denominated
  seam).

## Consequences

- Low-density areas stop paying for route capacity they do not fill; the
  network keeps the customer-facing promise and the journey view.
- The carrier integration is confined to one ACL and the declared-fact
  pattern; no carrier writes to a network topic and no network service calls a
  carrier synchronously.
- Returns, pickup and every other parcel flow are unchanged.
