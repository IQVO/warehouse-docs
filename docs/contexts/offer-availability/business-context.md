---
id: business-context
title: Business Context
sidebar_label: Business Context
description: "Why the network needs one place that knows what it can sell, from which node, and on what basis a vendor's quantity rests."
---

# Business Context

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

## The business problem

The network sells items it does not store. Every fulfillment centre is
operated by a vendor (the warehouse-systems fleet is one of them, vendor
V-WS). Before the network can show a product, promise a delivery date or
choose a node for an order, it has to know two things:

1. **What can be sold**: the network's own entry for a product, with the
   physical facts every downstream decision needs (title, dimensions,
   weight, hazmat and fragile flags).
2. **From where, and how much**: for each node that offers the product, the
   quantity the node claims it can ship now, and why it gave that number.

Neither fact belongs to a vendor's warehouse system, and neither belongs to
the promise. This context keeps them. It does not decide whether a delivery
date is feasible and it does not choose a node. It states what is on offer,
per node, as the vendor declared it.

## Why the basis matters

A vendor can give a number for two different reasons:

| Basis | Meaning |
| --- | --- |
| `PHYSICAL` | The number is the stock the node can use. |
| `THROUGHPUT_CONSTRAINED` | The node has more stock, but can only move this many before its next cutoff. |
| `UNKNOWN` | The vendor did not say. |

The basis is kept with the number and is never re-derived here (a business
decision in the model). The warehouse-systems fleet already computes such
a number: its `network-fulfillment` context has a `CapabilityOffer` that is
the lesser of the physical usable quantity and what its paths can carry
before the next cutoff, with basis `PHYSICAL` or `THROUGHPUT_CONSTRAINED`.
That number reaches this context only through `vendor-connectivity`; this
context never talks to the fleet. See
[WMS/WES integration](/integration/wms-wes-integration) and the
[Vendor API](/integration/vendor-api).

## Actors

| Actor | What they do here |
| --- | --- |
| Network merchandising (human) | Creates catalogue items, discontinues them, and creates listings (`POST /catalog-items`, `POST /catalog-items/{catalogItemId}:discontinue`, `POST /listings`). |
| Vendor, through `vendor-connectivity` | Sends inventory feeds for its nodes. `vendor-connectivity` owns the asynchronous Vendor API transaction and calls `POST /inventory-feeds` in-organization to apply each feed. |
| Shopper / storefront | Browses the catalogue (`GET /catalog`, `GET /catalog/{catalogItemId}`). |
| `node-topology` | Tells this context which nodes exist and whether each is `ACTIVE`. |

## Decisions this context makes

- **A listing is sellable only while its node is `ACTIVE`.** When a node is
  suspended or retired, every listing of the node is suppressed; when it is
  activated again, the listings suppressed for that reason are restored.
- **A feed older than the last applied feed for that node is ignored.**
  Availability is monotonic in `asOf` per listing.
- **A full feed is the complete truth for its node.** Every listing of the
  node it omits is set to zero.
- **The vendor's basis is kept, never re-derived.**
- **One listing per (catalogue item, node).**

## How it relates to the Amazon-like reality

This model keeps three things apart: the item (what is sold), the listing
(from which node it is offered) and the inventory signal a vendor sends
for a node. That split, the full-or-partial feed and the basis are the
proposed model; this page makes no claim about how any real company does
it. What the public record says about real networks and their partner
interfaces, with citations, is on the research pages:
[Amazon logistics network](/research/amazon-logistics-network) and the
[SP-API surface map](/research/sp-api-surface-map).

## Out of scope (deliberately)

- **Inventory placement**: which node should hold which item before demand
  arrives. Vendors place their own stock; the model lists
  `inventory-placement` as a future context.
- **Pricing and competing offers between sellers**: not in the model.
- **Capacity**: how many orders a node can take at a cutoff is
  `delivery-promise`'s `PromiseBook`, fed by `node-topology`'s declared
  profile. This context keeps only the vendor's claimed quantity and its
  basis.
- **Feasibility and sourcing**: `delivery-promise` and `order-sourcing`
  read this context's events into their own `AvailabilityView`; neither
  calls this context synchronously.
- **The vendor protocol**: authentication-free Vendor API, transactions,
  rate limits and `202` answers belong to `vendor-connectivity`.
- **Measured feed freshness**: `node-performance` computes it from
  `InventoryFeedApplied`.
