---
id: business-context
title: Business Context
sidebar_label: Business Context
description: "Why the network needs a seller inbound front door, who uses it, the decisions it makes, and what it deliberately leaves out."
---

# Business Context

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet, and unlike the other ten contexts it has no reference service: it is design only ([ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)). Identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

## The problem

Until now the model knew two kinds of party: the network and the **vendors**
that operate fulfillment nodes. Stock simply existed at a node; how it got
there was the vendor's own business. A seller that wants to send its own
stock to the network, in master cartons rather than one unit at a time, has
nowhere to say what it is sending, and the receiving node has nothing to
check the delivery against.

Packaging makes the gap concrete. The same item can be identified at several
levels, and a quantity is only meaningful with its level. GS1, the
standards body that issues GTINs, describes the levels as follows
([GS1 US, packaging levels](https://www.help.gs1us.org/packaging-level)):
an *each* is the lowest level, intended for individual resale; a *case* is a
standard shipping unit containing eaches, and all the items in a case must
have the same GTIN; a *mixed case* holds more than one GTIN. GS1's GTIN
management rules add that a change to the number of trade items in a case
requires a new GTIN, and that a unique GTIN is assigned at every packaging
level above the base unit
([GS1, pack/case quantity](https://www.gs1.org/en/standards/id-keys/gtin/gtin-decision-support-tool/packcase-quantity)).
A logistic unit such as a case, pallet or parcel is identified by an SSCC
([GS1, SSCC](https://www.gs1.org/standards/id-keys/sscc)).

Everything else on this page is the **proposed model**, not a claim about
any operator.

**Seller Inbound** answers: *what is this seller sending, to which node, in
which cartons, and did it arrive as declared?*

## Actors

| Actor | What they do with this context |
| --- | --- |
| A seller | Is onboarded, creates and confirms an inbound plan, creates a shipment, adds cartons, prints labels, ships. Reads the shipment back. |
| Network partner manager | Suspends and reinstates a seller. |
| `vendor-connectivity` | Receives `InboundShipmentLabelled`, `InboundShipmentShipped` and `InboundShipmentReceived` into `InboundShipmentView` and serves it on the Vendor API; relays the vendor's carton-level receipt as `InboundReceiptSubmitted`. |
| A vendor (for example the warehouse-systems fleet, vendor V-WS) | Sees the shipment as a carton manifest through the Vendor API only, receives the cartons, and submits a receipt. It never calls this context. |
| `node-topology`, `offer-availability` | Upstream facts: the destination node's inbound limits, the catalogue item's packaging hierarchy. |

## Decisions it makes

1. **Eaches are the ledger unit.** Every quantity on a plan, a carton and a
   receipt is in eaches. Pack fields are additive and named `unitsPerPack`,
   `qtyOfChild`, `cases`; a bare quantity never changes meaning.
2. **A CASE_PACKED carton is one item at one quantity**: the
   `unitsPerPack` of the item's declared CASE level (`ErrCaseQtyMismatchesGtin`,
   `ErrCasePackNotUniform`). A mixed carton has no pack GTIN; its SSCC and its
   manifest are its identity.
3. **SSCC rule.** A seller-supplied SSCC is accepted only if it is a valid
   18-digit code and unique network-wide (`ErrInvalidSscc`,
   `ErrSsccNotUnique`). Otherwise the network issues one from its own GS1
   company prefix and returns the label.
4. **Carton limits are the node's.** Weight and size are checked against the
   destination node's declared `inbound` limits (`ErrCartonOverweight`,
   `ErrCartonOversize`); a node that is not `ACTIVE` with the `INBOUND`
   capability receives nothing (`ErrNodeCannotReceive`).
5. **No ship without a label on every carton** (`ErrShipmentNotLabelled`).
6. **Stock is owned by its seller.** `ownerRef` equals the `sellerId`, travels
   on the shipment and the Vendor API, and stays segregated. Commingling by
   GTIN is not designed.
7. **Discrepancies are recorded, never corrected.** Missing, unexpected or
   damaged cartons and quantity differences become
   `InboundDiscrepancyRecorded`; compliance codes become
   `SellerComplianceViolationRecorded`. The manifest is not edited to match
   the dock.

## Deliberately out of scope

- **Commingling, FEFO and lot allocation.** Lot and expiry are captured on
  cartons and carried on events; nothing allocates by them.
- **Seller compliance scoring and chargebacks.** Violations are recorded; no
  scorecard and no money moves (`payments-and-invoicing` is a future,
  Generic context).
- **Inbound freight.** The seller delivers to the node; the network's
  `linehaul-transportation` is not involved.
- **Placement advice.** The seller names the destination node on the plan.
  Which node should hold which item is not modelled.
- **EDI.** The Published Language is JSON over the Vendor API; X12 and
  EDIFACT adapters are out of scope.
- **Inside the vendor's building.** Receiving, stowing, breaking a case and
  picking happen in the vendor's systems. *Break Case* is defined here only so
  the word means one thing; the network never sees it.

All of these are rows in the
[Model gap register](/network/strategic-design/model-gap-register).
