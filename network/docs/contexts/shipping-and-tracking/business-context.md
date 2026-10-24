---
id: business-context
title: Business Context
sidebar_label: Business Context
description: "Why the network issues its own labels and keeps one forward-only package timeline, who the actors are, and what Shipping & Tracking deliberately does not do."
---

# Business Context

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet; identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

## The problem in plain language

A package leaves a vendor's fulfillment centre and crosses buildings the
vendor does not run: a pickup truck, one or more sortation centres, a
delivery station and a van. Two things have to be true for that to work.

1. **The package carries a label the network can read.** The label has a
   tracking number that is unique across the whole network, a carrier and
   the address. The vendor prints it. The vendor must not otherwise learn or
   keep the shopper's address.
2. **Someone tells one story about the package.** Each building only knows
   its own step. The vendor says it shipped. Linehaul says a load departed
   and arrived. The delivery station says the package is out for delivery,
   then that an attempt succeeded or failed. The shopper wants one timeline.
   The network wants one instant for "the vendor handed it over" and one for
   "it was delivered", because other decisions hang on them.

This context does both. It is a **label service** and a **tracking
timeline**. Neither is where the network wins customers. Both have to be
right every time.

## Actors

| Actor | Kind | What they do here |
| --- | --- | --- |
| `vendor-connectivity` | Sibling context (partner tier) | Asks for a label in-org (`IssueLabel`, `POST /labels`) when a vendor requests one through the Vendor API; publishes `VendorShipmentConfirmed` |
| `customer-ordering` | Sibling context (commerce tier) | Answers `GetShipTo` (`GET /orders/{orderId}/ship-to`, restricted) at label time; reads the journey (`GetJourney`); consumes four of this context's events for its order-tracking view |
| `linehaul-transportation` | Sibling context (logistics tier) | Publishes `LoadDeparted` and `LoadArrived` with the tracking numbers on each load; consumes `LabelIssued` for expected volume |
| `last-mile-delivery` | Sibling context (logistics tier) | Publishes `PackageOutForDelivery` and `DeliveryAttempted` |
| `offer-availability` | Sibling context (commerce tier) | Publishes `CatalogItemCreated` (dimensions, weight, handling flags) |
| `delivery-promise` | Sibling context (commerce tier) | Judges promises on `PackageDelivered`; re-promises on `PackageExceptionRaised` |
| `order-sourcing` | Sibling context (commerce tier) | Marks the assignment delivered on `PackageDelivered` |
| `node-performance` | Sibling context (partner tier) | Measures on-time handover from `PackageHandedOver` |
| Shopper (synthetic) | Person, via the storefront | Reads the journey of a tracking number (`GET /journeys/{trackingNumber}`) |

The warehouse-systems fleet is not an actor here. A fleet node asks for a
label through the Vendor API of `vendor-connectivity`; it never calls this
context and never sees its events (the hard boundary in `model.yaml → meta`).

## Decisions this context makes

From `model.yaml → contexts[shipping-and-tracking].business_decisions`:

1. **A tracking number is unique network-wide and is issued once per
   package.** One label per `(poNumber, packageNo)` (`ErrLabelAlreadyIssued`);
   no two labels share a tracking number (`ErrTrackingNumberTaken`).
2. **The address printed on the label is fetched from `customer-ordering` at
   issue time and never published.** The label keeps an encrypted snapshot
   needed to print it. No event, no response body and no read model of this
   context carries it.
3. **The journey only moves forward.** A duplicate scan is refused
   (`ErrDuplicateScan`). An out-of-order scan is stored but does not move the
   state (`ErrScanOutOfOrder`). Delivered, returned and lost are terminal
   (`ErrJourneyClosed`).
4. **A package not scanned within its expected window is raised as an
   exception** (`ExceptionOnSilence`, reason `NO_SCAN`).

Two derived instants are this context's to define:

- **Handover** is the first pickup-load departure scan at the vendor node
  (`HandoverOnFirstScan`). It is the network's own observation, not the
  vendor's statement. `node-performance` scores on-time handover from it.
- **Delivered** is the successful delivery attempt. `delivery-promise`
  judges every promise kept or broken from it.

## How it relates to the Amazon-like reality

The domain is modelled on a large retail and logistics network in which
vendor-operated fulfillment centres hand packages to network-operated
sortation centres, delivery stations and delivery service partners. The
research pages hold the facts and their citations; this page restates none
of them:

- [Amazon logistics network](/network/research/amazon-logistics-network): the node
  types a package crosses after it leaves a fulfillment centre.
- [SP-API surface map](/network/research/sp-api-surface-map): where the vendor's
  shipping-label request sits in the vendor direct-fulfillment workflow,
  relative to acknowledgement and shipment confirmation.

The model keeps the order the research shows: a label is issued only for an
accepted purchase order, and a shipment is confirmed only after a label
(`vendor-connectivity` invariants `ErrLabelBeforeAcceptance` and
`ErrConfirmWithoutLabel`). This context does not repeat those checks; it
trusts its in-org caller.

## Deliberately out of scope

- **Carrier integration.** No external carrier is modelled. `carrier` is a
  field the label carries, not an integration.
- **Rate shopping and carrier choice.** The model names no rule for picking
  a carrier.
- **Customer notifications.** E-mail and push on delivery belong to the
  future `customer-notification` context (Generic, buy not build).
- **Returns.** A return authorisation and its routing to a returns centre
  belong to the future `customer-returns` context. This context only ends a
  journey as `RETURNED` (`ReturnToSender` from `AT_STATION`; the model names
  no trigger for it yet, see the
  [canvas open questions](/network/contexts/shipping-and-tracking/bounded-context-canvas)).
- **Routing and loading decisions.** Which load or route a package rides is
  decided by `linehaul-transportation` and `last-mile-delivery`. This context
  only records what they report.
- **Judging promises and scoring nodes.** `delivery-promise` and
  `node-performance` own those. This context supplies the facts.
- **Any fleet data.** No `warehouse.*` topic, no warehouse-systems call.

See the [Bounded Context Canvas](/network/contexts/shipping-and-tracking/bounded-context-canvas)
for every message, and [ADR 0006](/network/adr/0006-pii-confinement) for the PII
rule.
