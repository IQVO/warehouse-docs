---
id: 0006-pii-confinement
slug: /adr/0006-pii-confinement
title: "6. PII is confined to customer-ordering and shipping-and-tracking"
sidebar_label: "6. PII is confined to customer-ordering and shipping-and-tracking"
sidebar_position: 7
description: "The ship-to address lives in customer-ordering, is read once by shipping-and-tracking to print a label, and never appears in an event or in the Vendor API."
---

# 6. PII is confined to customer-ordering and shipping-and-tracking

## Status

**Proposed** (2026-10-22). Twin of `network-fulfillment` ADR 0009 §3 ("No
ship-to PII reaches this context at all").

## Context

Real direct-fulfillment vendor orders carry customer PII and need a
Restricted Data Token ([Marketplace API surface map](/research/marketplace-api-surface-map)).
This network can do better because it owns the label.

## Decision

- `customer-ordering` holds `ShipTo` (synthetic). Events carry only the
  destination postal prefix.
- `shipping-and-tracking` reads `ShipTo` through the restricted in-org call
  `GET /orders/{orderId}/ship-to` at label time, keeps an encrypted snapshot
  needed to print, and publishes only `labelRef` and `trackingNumber`.
- The Vendor API returns `{labelRef, trackingNumber, carrier}` and nothing
  else.

## Consequences

- No other context, and no vendor, can leak an address it never had.
- Consistent with the fleet's no-auth stance: PII is synthetic and
  contained, so no context needs authentication for privacy reasons.
