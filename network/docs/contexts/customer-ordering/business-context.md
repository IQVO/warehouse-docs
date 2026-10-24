---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why turning a cart into a customer order is a commodity problem with two sharp edges, every group promised before placing and the ship-to address kept in one place, and what this context deliberately leaves to others.
---

# Business Context

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

## The problem in plain language

A shopper has a cart and an address. The network must answer two questions
before it takes the money in a real shop (payment is out of scope here):
*can we deliver this, and by when?* Then it must remember what was promised,
show progress, and let the shopper change their mind while that is still
cheap.

The first question is not answered here. `delivery-promise` owns the
delivery date and the capacity behind it. Customer Ordering only asks: for
each shipment group, it turns the delivery offer the shopper saw into a
promise (`MakePromise`). If the offer has expired, it asks for a new quote
(`QuoteDeliveryOffers`) and shows the new window before placing anything.
The rule is strict: **no order is placed unless every line belongs to exactly
one promise that can still be confirmed** (`ErrLineWithoutPromise`).

What this context does own is the transaction record:

| It owns | Why here |
| --- | --- |
| The **customer order**: lines, the promise per shipment group, the customer-facing status | Someone must hold "what the shopper bought and what we told them" as one record. |
| The **ship-to address** and the **shopper** account (synthetic PII) | PII is confined to one context and read by exactly one other, `shipping-and-tracking`, for the label ([ADR 0006](/network/adr/0006-pii-confinement)). |
| **Customer cancellation** | Only this context knows the shopper asked; it tells sourcing and promising. |
| The **tracking view** | One customer-facing timeline assembled from three upstream streams. |

## Actors

| Actor | What they do here | Channel |
| --- | --- | --- |
| Shopper (synthetic), through the storefront | Registers, checks out, reads the order and its tracking, cancels | REST `POST /shoppers`, `POST /checkout`, `GET /orders/{orderId}`, `GET /orders/{orderId}/tracking`, `POST /orders/{orderId}:cancel` |
| e2e-tests and a future storefront UI | Drive the same storefront API as the shopper | the same REST routes |
| `delivery-promise` | Quotes offers and makes promises for checkout; later reports a promise at risk, revised, kept or broken | sync REST (called by us); Kafka (consumed by us) |
| `order-sourcing` | Reports when a group is locked to a node, shipped, or unsourceable | Kafka |
| `shipping-and-tracking` | Reads the ship-to address to print a label; reports labels, scans, delivery and exceptions | sync REST (calls us); Kafka |

## Decisions this context makes

The model lists three business decisions (`contexts[customer-ordering].business_decisions`):

1. **No order without a promise per group.** Every line is in exactly one
   shipment group, and every group has a promise (`ErrLineWithoutPromise`).
   The promise must be for the ship-to's destination postal prefix
   (`ErrPromiseDestinationMismatch`).
2. **The ship-to address never leaves this context**, except to
   `shipping-and-tracking` for a label, through the restricted route
   `GET /orders/{orderId}/ship-to`. No event this context publishes carries
   it; `CustomerOrderPlaced` carries only `destinationPostalPrefix`.
3. **Cancellation ends at the lock.** A customer may cancel only while no
   shipment group is locked to a node (`ErrCancelAfterLock`). After that,
   cancellation is a return, which is a future context (`customer-returns`).
   The model words this decision as "until every shipment group is locked",
   while the invariant says "while no group is locked"; these pages follow the
   invariant, and the difference is an open question on the
   [canvas](/network/contexts/customer-ordering/bounded-context-canvas).

It also runs two policies: **CheckoutPromising** (promise each group from the
offer the shopper saw; re-quote if it expired) and **CancelOnUnfulfillable**
(cancel a group that is unsourceable when no revised promise is feasible,
and the order if nothing remains).

## How it relates to the Amazon-like reality

The research pages describe how a large online retailer's network separates
the customer-facing order from the delivery promise and from the decision of
which building ships it. See [Amazon logistics network](/network/research/amazon-logistics-network).
They also describe the vendor-facing surface, where a purchase order never
carries the end customer's account. See the [SP-API surface map](/network/research/sp-api-surface-map).
This model copies the shape, not any internal service name:

- The storefront order is a **commodity**: every shop has one. What makes the
  network different is the promise behind it (`delivery-promise`, Core) and
  late assignment (`order-sourcing`, Core). That is why this context is
  Generic.
- The order record is where the customer's identity and address live. The
  vendor sees a purchase order in network terms only (`vendor-connectivity`).
  The label printer is the one place that needs the address
  (`shipping-and-tracking`).

## Deliberately out of scope

| Out of scope | Where it belongs |
| --- | --- |
| Computing delivery dates, holding capacity, judging kept or broken | `delivery-promise` |
| Choosing the shipping node, releasing to it, the path lock | `order-sourcing` |
| Catalogue browsing and availability | `offer-availability` (the storefront queries it directly) |
| Labels and the package journey | `shipping-and-tracking` |
| Returns after the lock | future `customer-returns` |
| E-mail and push notifications on a revised promise or a delivery | future `customer-notification` (Generic, buy) |
| Payments, invoices, tax | future `payments-and-invoicing` |
| Authentication and real PII | no auth anywhere (`conventions.no_auth`); PII is synthetic |
| Anything in the warehouse-systems fleet | This context never touches the fleet. The only seam between the two organizations is the Vendor API ([Vendor API](/network/integration/vendor-api)). |

See the [Bounded Context Canvas](/network/contexts/customer-ordering/bounded-context-canvas)
for every message and the [Context Map](/network/contexts/customer-ordering/context-map)
for every relationship.
