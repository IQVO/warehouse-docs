---
id: 0005-vendor-acceptance-is-the-path-lock
slug: /adr/0005-vendor-acceptance-is-the-path-lock
title: "5. The vendor node's acceptance is the path lock"
sidebar_label: "5. The vendor node's acceptance is the path lock"
sidebar_position: 6
description: "After a vendor accepts a purchase order in full, order-sourcing never moves the shipment group to another node."
---

# 5. The vendor node's acceptance is the path lock

## Status

**Proposed** (2026-10-22).

## Context

In Amazon's own buildings the published lock point is "picked". The network
cannot see a vendor's floor. A vendor that accepts fill-or-kill commits stock
and work: the fleet's `network-fulfillment` releases its held
`order-management` order only after a reconciled acceptance.

## Decision

`PurchaseOrderAccepted` moves the assignment to `LOCKED`
(`ErrAssignmentLocked` on any later node change). Before release the
assignment moves freely; after release, only a rejection or an expiry moves
it, and the refusing node is excluded for that promise revision.

## Consequences

- No vendor ever works an order the network has moved away.
- Late information after acceptance (a better node, a cancelled departure)
  can only change the transport path, not the node; the promise may be
  revised.
