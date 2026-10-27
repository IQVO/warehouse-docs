---
id: business-context
title: Business Context
sidebar_label: Business Context
description: Why the network needs one published, asynchronous protocol to buy fulfillment from vendor-operated nodes, who uses it, what it decides, and what it deliberately leaves out.
---

# Business Context

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

## The problem

The retail network owns the customer, the catalogue, the promise, sourcing
and the parcel network. It does **not** operate fulfillment centres. Every
fulfillment, cross-dock and returns node belongs to a **vendor** (see
[ADR 0004](/network/adr/0004-parcel-nodes-are-network-operated)). The
warehouse-systems fleet is one such vendor, `V-WS`; there can be many.

So the network has a buying problem. Once `order-sourcing` releases a
shipment group to a vendor node, the network needs a firm answer from a
company it does not control: "yes, all of it, by the pickup cutoff" or
"no". It needs that answer early enough to send the group elsewhere if the
answer is no. Until the answer is yes, the network cannot lock the path
([ADR 0005](/network/adr/0005-vendor-acceptance-is-the-path-lock)).

Vendors, in turn, need one stable contract they can integrate once: how to
register a building, how to tell the network what the building can do, how
to report stock, how to see work, how to answer it, how to get a label and
how to say it shipped. They build to that contract; the network does not
build to theirs. That is an **Open Host Service** with a **Published
Language**.

## Actors

| Actor | What they do here | Channel |
| --- | --- | --- |
| Vendor system (for `V-WS`: the fleet's `network-fulfillment`) | Registers nodes, declares profiles, sends inventory, polls and acknowledges purchase orders, requests labels, confirms shipment, reconciles transactions, reads its scorecard | Vendor API (`/vendor/...`) |
| Network partner manager (human) | Onboards a vendor and sets its acknowledgement window | REST `POST /vendors` |
| `order-sourcing` | Releases a shipment group to a vendor node, or cancels it | Kafka events |
| `node-topology`, `offer-availability` | Own the node registry and the listings; this context relays vendor writes to them and keeps local views of their facts | REST (in-org) and Kafka |
| `shipping-and-tracking` | Issues the label for each package | REST (in-org) |
| `node-performance` | Measures every vendor node from this context's facts; serves the scorecard | Kafka, REST (in-org) |

## Decisions this context makes

These come straight from `business_decisions` in the model.

1. **Acknowledge once, in full, before `ackBy`.** Fill-or-kill. A partial
   acknowledgement is refused (`ErrPartialAcknowledgement`); a second one is
   refused (`ErrAlreadyAcknowledged`); a late one is refused
   (`ErrAckWindowClosed`).
2. **`ackBy = min(issuedAt + vendor ackWindow, requiredShipBy - node handlingTime)`.**
   The vendor never gets more time to answer than it has left to pick and
   pack.
3. **A label only for an `ACCEPTED` purchase order; a shipment confirmation
   only after a label** (`ErrLabelBeforeAcceptance`,
   `ErrConfirmWithoutLabel`).
4. **Every vendor write returns `202` with a `transactionId`.** The write
   takes effect when its transaction succeeds, not when the request returns.
5. **The Vendor API never carries ship-to PII.** A label is `labelRef`,
   `trackingNumber` and `carrier`. The address stays in
   `shipping-and-tracking` ([ADR 0006](/network/adr/0006-pii-confinement)).
6. **Rate limits are part of the contract:** `429` with `Retry-After`.

## How this relates to the real-world reference

The protocol is modelled on a large retailer's direct-fulfillment vendor
interface, in the network's own vocabulary: polled orders, whole-order
acknowledgement inside a window, asynchronous submissions reconciled by a
transaction id, label then shipment confirmation. The public facts and
their citations are on
the vendor platform API surface map; how vendor nodes fit a
large logistics network is on
public fulfillment-network research. This page
restates no numbers from either. Where the model deliberately departs from
the reference (for example, operational profile declared through the API
rather than out-of-band configuration), the reason is
[ADR 0003](/network/adr/0003-declared-and-measured-capability).

The **simulation knobs** make the network behave like a demanding real
counterpart, so the fleet's Anti-Corruption Layer can be exercised. All
default to well-behaved:

| Knob | Effect |
| --- | --- |
| `TX_PROCESSING_DELAY` | A submission is not processed before `notBefore = receivedAt + delay` (`ErrSubmissionNotDue`) |
| `TX_FAILURE_RATE` | Share of submissions that end in `FAILURE` |
| `RATE_LIMIT_RPS` | Request rate above which the API answers `429` with `Retry-After` |
| `PO_REDELIVERY_RATE` | Share of polls that return a purchase order already delivered |

## Out of scope

- **Payments and invoicing.** A future Generic context
  (`payments-and-invoicing`).
- **Vendor authentication.** No auth, consistent with the fleet. The vendor
  names itself in each write.
- **Inventory placement.** Vendors place their own stock; the network does
  not advise where (gap G49). A seller names the destination node in
  `seller-inbound`.
- **Returns authorisation.** The future `customer-returns` context routes
  returns to a `RETURNS_CENTER`; this context only lets a vendor register
  one.
- **Measuring the vendor.** `node-performance` owns the scorecard; this
  context only relays it.
- **Choosing the node.** `order-sourcing` owns assignment and reassignment;
  this context reports the vendor's answer and never picks another node.
- **Anything inside the warehouse.** No retail-network context reads a
  `warehouse.*` topic or calls a fleet service. The fleet calls this API;
  this context never calls the fleet.

## Inbound shipments and receipts

> **Built, [ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)** as realized by [`vendor-connectivity` ADR 0005](https://github.com/IQVO/vendor-connectivity/blob/develop/docs/adr/0005-inbound-shipments-receipts-and-catalog-packaging.md) (inbound shipments, inbound receipts and catalogue packaging). This section is the delta the seller-inbound design added to this page; where the service decided differently, the text below says so.

A seller's cartons reach a vendor node through this context, not directly.
The vendor polls `GET /vendor/inbound-shipments` for a carton manifest
(published by `seller-inbound` as `InboundShipmentLabelled`, and made visible to the vendor once `InboundShipmentShipped`) and answers with
`POST /vendor/inbound-receipts`, a carton-level receipt. The Vendor API stays
the only channel between the two organizations. The model decides the shape
of the exchange; how a vendor's own systems receive the cartons is the
vendor's business.
