---
id: 0001-retail-network-domain-of-ten-contexts
slug: /adr/0001-retail-network-domain-of-ten-contexts
title: "1. The retail network is its own domain of ten bounded contexts"
sidebar_label: "1. The retail network is its own domain of ten bounded contexts"
sidebar_position: 2
description: "Supersedes D1 of the drafted retail-network ADR 0001 (one context): the network is modelled as ten bounded contexts in three tiers."
---

# 1. The retail network is its own domain of ten bounded contexts

## Status

**Proposed** (2026-10-22). Supersedes decision D1 of the drafted
`retail-network` ADR 0001, which lives at
`IQVO/network-fulfillment` `docs/planning/retail-network-adr-0001-DRAFT-for-new-repo.md`.
D2 to D6 of that draft are kept (protocol fidelity, declared + measured
capability, proportional capacity share, release on reconciled acceptance, no
auth). The fleet-side companion, `network-fulfillment` ADR 0009, stays valid:
the counterpart is still the `retail-network` organization, reached only
through the Vendor API.

## Context

The draft chose one context covering storefront, sourcing and transit,
because v1 had one node and splitting "adds a third repository for no new
behavior". The request now is the production-grade network: many nodes of
six types, a customer promise, late assignment, a middle and a last mile.
Each of those changes at a different speed (nodes in years and months, lanes
in days, waves in hours; see [research](/research/large-operator-logistics-network)),
is owned by a different part of a real network, and has its own invariants.
The published account of a large operator lists generating promises and assigning orders
as separate software changes.

## Decision

The network is a domain with ten bounded contexts, each a future repository
with its own database, publishing CloudEvents on its own topic:

| Tier | Contexts |
| --- | --- |
| commerce | `delivery-promise` (Core), `order-sourcing` (Core), `offer-availability`, `customer-ordering` |
| logistics | `node-topology`, `linehaul-transportation`, `last-mile-delivery`, `shipping-and-tracking` |
| partner | `vendor-connectivity`, `node-performance` |

`vendor-connectivity` is the Open Host Service the fleet's
`network-fulfillment` conforms to; its Vendor API keeps the routes the draft
and ADR 0009 already named. Four contexts are named for later:
`inventory-placement`, `customer-returns`, `customer-notification`,
`payments-and-invoicing`.

## Alternatives

- **Keep one context with modules.** Cheaper to start; but the promise's
  capacity holds, the vendor protocol's clock and the transport schedule
  would share one database and one release train, and the two Core decisions
  would be entangled with Generic checkout code.
- **Two contexts (marketplace + network sourcing)**, the draft's rejected
  alternative. Still merges topology, transport and promise.

## Consequences

- Easier: each Core context can be built and tested in isolation against
  event fixtures; the Vendor API can freeze early while the inside evolves.
- Harder: ten repositories to scaffold when built; more events to keep
  consistent. Mitigation: `model/model.yaml` plus `scripts/check_model.py`
  gate every page and, later, every AsyncAPI.
