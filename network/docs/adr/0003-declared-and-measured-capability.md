---
id: 0003-declared-and-measured-capability
slug: /adr/0003-declared-and-measured-capability
title: "3. Capability is declared and measured"
sidebar_label: "3. Capability is declared and measured"
sidebar_position: 4
description: "A vendor node declares an operational profile; node-performance measures it; the promise uses both."
---

# 3. Capability is declared and measured

## Status

**Proposed** (2026-10-22). Keeps D3 of the drafted retail-network ADR 0001.

## Context

The fleet recorded that "no SP-API operation accepts a declaration of
capability", which made `network-fulfillment`'s `DeclareCapability` a no-op.
That is true of Vendor Direct Fulfillment, but the SP-API Supply Sources API
does accept a declared handling time, operating hours and an order
throughput cap per supply source for sellers
([SP-API surface map](/network/research/sp-api-surface-map)). Declared capability is
therefore a real-world pattern, not an artefact of owning both sides.

## Decision

- `node-topology` owns a versioned `OperationalProfile` per node: time zone,
  operating hours by day, holidays, handling time, cutoffs with optional
  `maxOrders`, and a throughput cap in orders per time unit.
- `node-performance` computes scorecards only from observed facts (purchase
  order outcomes, handover scans against `requiredShipBy`, promises kept).
- `delivery-promise` applies `ScorecardHandicap` (grade B adds 25% handling
  time, C skips a cutoff, D skips two). Suspension stays a human decision in
  `node-topology`.

## Consequences

- The fleet can expose its real planning numbers (CPT schedule, cycle time,
  path capacity) instead of letting the network guess.
- A vendor that over-declares is corrected by measurement, not trusted
  forever.
- `network-fulfillment` needs an ADR to make `DeclareCapability` live
  ([Fleet changes](/network/integration/fleet-changes)).
