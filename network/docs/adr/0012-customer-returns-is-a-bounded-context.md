---
id: 0012-customer-returns-is-a-bounded-context
slug: /adr/0012-customer-returns-is-a-bounded-context
title: "12. Customer returns is a bounded context"
sidebar_label: "12. Customer returns"
sidebar_position: 13
description: "Promotes customer-returns from a named-for-later context to the twelfth network context: the shopper-facing ReturnAuthorization and its disposition."
---

# 12. Customer returns is a bounded context

## Status

Accepted (2026-11-14). Supersedes the "named for later" line of ADR 0001 for
`customer-returns` only; 0010 and 0011 served carrier handoff and pickup
points.

## Context

Returns are a steady share of every fulfillment network; near-market return
centres restock most graded units; returnless refunds spread below a value
threshold; and doorstep pickup of a return is a promise in its own right. The
model named `customer-returns` a future context (ADR 0001) and classed it
Supporting. Payments are already split: refunds are storefront and
customer-payments; vendor settlement is a later context - so this decision
records fees as facts, never money.

## Decision

- `customer-returns` (tier commerce, Supporting) is the twelfth network
  context.
- It owns the shopper-facing `ReturnAuthorization` and the disposition
  decided AT authorization: `KEEP` (returnless, below a caller-declared value
  threshold - the storefront is the only price knower), `NEAREST_RETURNS_CENTER`,
  or `ORIGIN_NODE` (the locked assignment node, falling back to the promise
  witness).
- It owns the return method (`DROP_OFF` first; doorstep `PICKUP` is a
  separately-mergeable, activation-gated slice), the reverse-label request
  (the one in-org REST call it makes, to shipping-and-tracking - mirroring
  how shipping-and-tracking reads the ship-to from customer-ordering), and
  the restock FACT it publishes when a returns centre grades units.
- It does NOT own money (refunds are storefront/customer-payments; fees are
  recorded bases for the future vendor-settlement context), not the ship-to
  (PII stays in customer-ordering; shipping-and-tracking alone derives stop
  keys - a reverse label reuses the same derivation so a return groups with
  its delivery stop by construction), not facility grading (the WMS
  returns-processing context owns receipt, inspection and per-unit
  disposition - it learns of network returns through the vendor seam only),
  and not stock (offer-availability adjusts listings from the restock fact).
- The vendor seam carries return advices out and return outcomes in; the
  network disposition arrives at the facility as an input, never re-decided.

## Consequences

- One new context, topic, database and Kong route; two consumer groups on
  the new topic (vendor-connectivity, offer-availability); no new secrets.
- The notification policy (ADR 0017 in customer-ordering) keeps every family
  defaulting to nobody, and customer-returns consumes the decided terminal
  facts rather than any raw event.
- Returnless `KEEP` never mints a label or a movement: the authorization
  closes at once and the refund fact is the storefront's alone.
