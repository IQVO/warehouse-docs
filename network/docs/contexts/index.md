---
id: index
title: Bounded Contexts
sidebar_label: Overview
description: "The eleven retail-network bounded contexts, each documented with the same 14-page ddd-crew pack."
slug: /contexts
---

# Bounded Contexts

Every context has the same page set, in the same order, so contexts can be
compared page for page: business context, ubiquitous language, core domain
chart, bounded context canvas, context map, aggregate design canvas, domain
events, domain message flow, EventStorming, use cases, class diagram, entity
relationship and sequence diagrams. All are derived from
[`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml).

| Context | Classification | Tier | Aggregates | Events published | Events consumed |
| --- | --- | --- | --- | --- | --- |
| [`node-topology`](/network/contexts/node-topology) | <span class="badge-supporting">Supporting</span> | `logistics` | 4 | 9 | 0 |
| [`offer-availability`](/network/contexts/offer-availability) | <span class="badge-supporting">Supporting</span> | `commerce` | 3 | 9 | 4 |
| [`delivery-promise`](/network/contexts/delivery-promise) | <span class="badge-core">Core</span> | `commerce` | 3 | 12 | 34 |
| [`customer-ordering`](/network/contexts/customer-ordering) | <span class="badge-generic">Generic</span> | `commerce` | 2 | 2 | 17 |
| [`order-sourcing`](/network/contexts/order-sourcing) | <span class="badge-core">Core</span> | `commerce` | 1 | 10 | 32 |
| [`vendor-connectivity`](/network/contexts/vendor-connectivity) | <span class="badge-supporting">Supporting</span> | `partner` | 3 | 11 | 11 |
| [`linehaul-transportation`](/network/contexts/linehaul-transportation) | <span class="badge-supporting">Supporting</span> | `logistics` | 3 | 10 | 13 |
| [`last-mile-delivery`](/network/contexts/last-mile-delivery) | <span class="badge-supporting">Supporting</span> | `logistics` | 3 | 8 | 4 |
| [`shipping-and-tracking`](/network/contexts/shipping-and-tracking) | <span class="badge-generic">Generic</span> | `logistics` | 2 | 8 | 7 |
| [`node-performance`](/network/contexts/node-performance) | <span class="badge-supporting">Supporting</span> | `partner` | 1 | 2 | 14 |
| [`seller-inbound`](/network/contexts/seller-inbound) (proposed, no service) | <span class="badge-supporting">Supporting</span> | `partner` | 3 | 9 | 10 |

Future contexts named by the model but not documented: `customer-returns`,
`customer-notification`, `payments-and-invoicing`. `inventory-placement`, named
earlier, is absorbed by `seller-inbound`
([ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)).
