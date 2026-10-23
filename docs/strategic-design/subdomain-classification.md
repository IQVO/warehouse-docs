---
id: subdomain-classification
title: Subdomain Classification
sidebar_label: Subdomain Classification
description: "Core, Supporting or Generic: the ten retail-network bounded contexts and four named future contexts, with the reason for each verdict and the tier segment each publishes under."
---

# Subdomain Classification

Domain-Driven Design splits a domain into **Core**, **Supporting** and
**Generic** subdomains by how much competitive advantage each gives, not by
size or difficulty. The verdicts below are the model's; the evidence for why
promise and assignment matter so much is on
[The Amazon logistics network](/research/amazon-logistics-network).

The **CloudEvents tier** column is the `<tier>` segment of every event type the
context publishes (`com.retailnetwork.<tier>.<context>.<entity>.<Event>`, see
[Event Standard](/strategic-design/event-standard-cloudevents)). Like the
fleet's `wms`/`wes` segment, the tier groups contexts by area of the business;
it is not the Core/Supporting/Generic verdict.

## Problem space: the subdomains

| Subdomain | What the business must be good at | Verdict |
| --- | --- | --- |
| Delivery Promising | Saying an arrival date before purchase that the network will keep | Core |
| Order Sourcing & Assignment | Choosing the node and path that keep the promise at the lowest cost to serve | Core |
| Network Topology | Knowing the nodes, lanes, regions and service areas, and what each node declared | Supporting |
| Selection & Availability | Knowing what can be sold from which node right now | Supporting |
| Partner (Vendor) Integration | Letting third-party nodes take demand without bespoke integration | Supporting |
| Transportation (Middle Mile) | Moving packages between nodes on schedules with capacity | Supporting |
| Last-Mile Delivery | Getting packages from a delivery station to the door | Supporting |
| Performance Management | Measuring nodes against commitments | Supporting |
| Order Capture | Taking the order and the address | Generic |
| Shipping Labels & Tracking | Labels, tracking numbers, the package timeline | Generic |
| Inventory Placement | Deciding which node should hold which item before demand | Core candidate (future) |
| Customer Returns | Routing returns to a returns centre | Supporting (future) |
| Customer Notification | Telling the customer about changes | Generic (future) |
| Payments & Invoicing | Charging customers, settling with vendors | Generic (future) |

## Solution space: the bounded contexts

| Bounded context | Classification | Tier | Business model | Evolution | Why |
| --- | --- | --- | --- | --- | --- |
| `delivery-promise` | <span class="badge-core">Core</span> | `commerce` | Revenue (conversion) and cost (no promise the network cannot keep) | Custom-built | The promise is the customer-facing commitment; the published Amazon account says it is computed from network state and a feasible path (see [research](/research/amazon-logistics-network)). Doing it with a witness path, held capacity and a measured handicap is where speed and honesty are won or lost. Buying it would mean conforming to someone else's idea of your own network. |
| `order-sourcing` | <span class="badge-core">Core</span> | `commerce` | Cost-to-serve reduction, speed protection | Custom-built | Late assignment with re-optimization until a lock is the second half of the same published split. It is where cost to serve is decided order by order. |
| `node-topology` | <span class="badge-supporting">Supporting</span> | `logistics` | Enabler | Custom-built | Every decision depends on it, but nobody chooses a network for how it stores its node registry. The parcel-node rule and the versioned operational profile are specific to this network, so it is not Generic. |
| `offer-availability` | <span class="badge-supporting">Supporting</span> | `commerce` | Revenue enabler | Product | Listings per node with a declared basis is necessary and specific (the basis matters to the promise) but well understood; marketplaces publish the same shape per ship node. |
| `vendor-connectivity` | <span class="badge-supporting">Supporting</span> | `partner` | Revenue-channel enabler | Product | A Direct-Fulfillment-like protocol is industry practice. It is the network's Open Host Service, so its contract stability matters more than its cleverness. |
| `linehaul-transportation` | <span class="badge-supporting">Supporting</span> | `logistics` | Cost reducer, speed enabler | Custom-built | Transportation optimization can be Core at very large scale; here the promise and sourcing consume its schedules and capacities, and route optimization is not modelled, so it stays Supporting. |
| `last-mile-delivery` | <span class="badge-supporting">Supporting</span> | `logistics` | Cost reducer, experience creator | Custom-built | Waves with stop capacity are what the promise's last leg stands on; routing itself is replaceable. |
| `node-performance` | <span class="badge-supporting">Supporting</span> | `partner` | Risk reducer | Custom-built | Measured capability is what keeps declared capability honest, but it only measures and grades; it decides nothing. |
| `customer-ordering` | <span class="badge-generic">Generic</span> | `commerce` | Engagement | Commodity | Cart-to-order is commodity commerce. It is kept thin and holds the PII so nothing else has to. |
| `shipping-and-tracking` | <span class="badge-generic">Generic</span> | `logistics` | Compliance and experience | Commodity | Labels and tracking timelines are bought, not built, in most networks. |

Count: two Core, six Supporting, two Generic.

## Why only two Core contexts

A network has many hard problems. The test for Core is not "is it hard" but
"would buying it, and conforming to the vendor's model, cost us the reason
customers choose us". Only the promise and the late assignment pass. Both are
explicitly separated in the published account of Amazon's own software
changes, and both depend on the network's own model of itself in a way no
packaged product can share. Transportation and last mile are hard, but their
output (schedules, capacities, waves) is a fact the Core consumes, not a
decision customers see.

## How this compares with the warehouse-systems fleet

The fleet's own classification (in
[warehouse-docs](https://iqvo.github.io/warehouse-docs/strategic-design/subdomain-classification))
files `order-management`, which owns the fleet's promise as a CPT window, as
Generic/Supporting, with promising as its custom part. That is consistent with
this model: inside one vendor, the promise is a **ship promise** (which
departure the order makes). In the network, the promise is a **delivery
promise** (ship promise plus network transit plus a delivery wave). The
network owns the part the fleet cannot know.
