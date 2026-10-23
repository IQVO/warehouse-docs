---
id: overview
title: retail-network
sidebar_label: Overview
description: "A marketplace-scale retail and logistics network, modelled with Domain-Driven Design as ten bounded contexts, and the one seam through which it connects to the warehouse-systems WMS/WES fleet."
slug: /
---

:::note[Study disclaimer]
This project is a domain-driven design study. It is not associated with, endorsed by or affiliated with any company, and it uses no company's code, data, logos or trademarks. All names, figures and examples are illustrative or synthetic.
:::

# retail-network

**retail-network** is a model of a marketplace-scale retail and logistics network:
a storefront that promises an arrival date, a network of nodes (vendor
fulfillment centres, sortation centres, delivery stations, air hubs) joined by
lanes, the decision of which node fulfils each order, the middle and last mile,
tracking, and the measurement of every node against what it declared.

It is a **separate organization** from the
[warehouse-systems](https://iqvo.github.io/warehouse-docs/) WMS/WES fleet. The
fleet is one *vendor* of the network: its fulfillment centres, cross-docks and
returns centres register as vendor nodes, and its `network-fulfillment`
context is the only fleet service that talks to the network, through the
network's Vendor API.

:::info[Proposed design, docs only]
Nothing on this site is built. Facts about a large e-commerce operator, its seller APIs and
other networks are on the [Research](/research) pages with numbered
citations. Everything else is the model this site proposes, derived from that
evidence and from the fleet's repositories. The canonical model is
[`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml);
every page is derived from it, and a CI gate fails the build when a page names
a message the model does not have.
:::

## The ten bounded contexts

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 18, "rankSpacing": 36, "padding": 6}}}%%
flowchart TB
    classDef core fill:#1e3a8a,stroke:#1e3a8a,color:#fff
    classDef sup fill:#dbeafe,stroke:#1e40af,color:#172554
    classDef gen fill:#f1f5f9,stroke:#64748b,color:#0f172a
    classDef ext fill:#ffe3e3,stroke:#c92a2a,color:#000
    subgraph COM["commerce"]
        direction TB
        CO["customer-ordering"]:::gen
        DP["delivery-promise"]:::core
        OS["order-sourcing"]:::core
        OA["offer-availability"]:::sup
    end
    subgraph LOG["logistics"]
        direction TB
        NT["node-topology"]:::sup
        LH["linehaul-transportation"]:::sup
        LM["last-mile-delivery"]:::sup
        ST["shipping-and-tracking"]:::gen
    end
    subgraph PAR["partner"]
        direction TB
        VC["vendor-connectivity"]:::sup
        NP["node-performance"]:::sup
    end
    NF[["warehouse-systems<br/>network-fulfillment"]]:::ext
    CO --> DP
    CO --> OS
    OS --> VC
    VC --> NF
    NF --> VC
    NT --> DP
    LH --> DP
    LM --> DP
    NP --> DP
    OA --> DP
```

Derived from: `model.yaml` → `contexts[*].classification`, `contexts[*].tier`,
the main event edges. Dark = Core, blue = Supporting, grey = Generic. The full
map with every relationship pattern is on
[Context Map](/strategic-design/context-map).

| Context | One sentence |
| --- | --- |
| [`delivery-promise`](/contexts/delivery-promise) | Quotes and makes the arrival-date promise from a feasible witness path with capacity held, and judges it kept or broken. **Core.** |
| [`order-sourcing`](/contexts/order-sourcing) | Decides late which node really fulfils each shipment group, re-optimizes until release, locks at commitment. **Core.** |
| [`node-topology`](/contexts/node-topology) | Nodes, their declared operational profile, lanes, regions and service areas. |
| [`offer-availability`](/contexts/offer-availability) | Catalogue items, one listing per (item, node), and what each node claims it can ship. |
| [`vendor-connectivity`](/contexts/vendor-connectivity) | The Vendor API: purchase orders, fill-or-kill acknowledgements, labels, shipment confirmations, async transactions. The fleet's seam. |
| [`linehaul-transportation`](/contexts/linehaul-transportation) | The middle mile: pickup departures at vendor cutoffs, scheduled departures with capacity, loads. |
| [`last-mile-delivery`](/contexts/last-mile-delivery) | Delivery stations: delivery waves with stop capacity, routes for delivery partners, attempts. |
| [`node-performance`](/contexts/node-performance) | Scorecards measured from facts, never from declarations; grades feed the promise. |
| [`customer-ordering`](/contexts/customer-ordering) | Checkout and the customer order; the only holder of the (synthetic) ship-to address. Generic. |
| [`shipping-and-tracking`](/contexts/shipping-and-tracking) | Labels and the package journey timeline. Generic. |

## How to read this site

1. [Research](/research): what is publicly known, with citations.
2. [Strategic Design](/strategic-design): vision, subdomains, core domain
   chart, capability map, context map, EventStorming, message flows,
   ubiquitous language, event standard (the ddd-crew strategic set), and the
   [Model Gap Register](/strategic-design/model-gap-register) of what the
   model does not decide yet.
3. [Nodes & Promise](/network-model): the node model, the promise algorithm
   with a worked example, and order assignment.
4. [WMS/WES Integration](/integration): exactly how the warehouse-systems
   fleet plugs in, what crosses the seam, and what the fleet must change.
5. [Bounded Contexts](/contexts): the same 14-page ddd-crew pack for each of
   the ten contexts, and [API Reference](/api-reference) for their REST
   contracts.
6. [ADRs](/adr): the eight proposed decisions.
