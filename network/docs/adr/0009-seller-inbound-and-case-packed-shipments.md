---
id: 0009-seller-inbound-and-case-packed-shipments
slug: /adr/0009-seller-inbound-and-case-packed-shipments
title: "9. Seller inbound and case-packed shipments"
sidebar_label: "9. Seller inbound and case-packed shipments"
sidebar_position: 10
description: "A new seller-inbound context takes seller stock in master cartons: SSCC-identified cartons, owner-segregated stock, eaches as the ledger unit, GS1 pack immutability, and the Vendor API as the only seam."
---

# 9. Seller inbound and case-packed shipments

## Status

**Proposed** (2026-10-23). Amends [ADR 0001](/network/adr/0001-retail-network-domain-of-ten-contexts):
the domain gains an eleventh context. Design only: unlike the other ten, this
context has no reference service.

## Context

The model had two parties: the network and the **vendors** that operate
fulfillment nodes. Stock simply existed at a node. There was no seller, no way
to describe a delivery of stock in cartons, and no packaging below the
catalogue item: every quantity was "units", and the future context
`inventory-placement` was a reserved name with no design.

Sellers that send **master cartons** (one outer carton holding several identical
sellable units) need four things the model lacked: an identity for the
carton, a packaging hierarchy on the item, a statement of whose stock it is,
and a reconciliation of what arrived against what was declared.

GS1 standards facts this decision rests on (everything else below is the
proposed model):

- A packaging hierarchy has levels: an *each* is the lowest level, intended
  for individual resale; a *case* contains eaches and all items in a case have
  the same GTIN; a *mixed case* holds more than one GTIN
  ([GS1 US, packaging levels](https://www.help.gs1us.org/packaging-level)).
- A change to the number of trade items in a case requires a new GTIN, and a
  unique GTIN is assigned at every packaging level above the base unit
  ([GS1, pack/case quantity](https://www.gs1.org/en/standards/id-keys/gtin/gtin-decision-support-tool/packcase-quantity)).
- An SSCC identifies a logistic unit, such as a case, pallet or parcel
  ([GS1, SSCC](https://www.gs1.org/standards/id-keys/sscc)).

## Decision

1. **One new context, `seller-inbound`** (code `SI`, Supporting, tier
   `partner`). It absorbs the reserved `inventory-placement` name: the seller
   names the destination node on its plan. Aggregates: `SellerAccount`,
   `InboundPlan`, `InboundShipment` with its `Carton` entity.
2. **Eaches are the ledger unit.** Every quantity on every existing event,
   field and API keeps meaning eaches. New pack fields are named `cases`,
   `unitsPerPack`; a bare `qty` never changes meaning. All new
   event fields are optional and additive; no event changes meaning, so no
   event version changes.
3. **GTIN and SSCC are values, validated by the receiver.** A GTIN is stored as
   14 digits, zero-left-padded, accepted as 8, 12, 13 or 14 digits with a valid
   mod-10 check digit. An SSCC is 18 digits with a valid mod-10 check digit. No
   service trusts a client-supplied check digit.
4. **SSCC rule.** A seller-supplied SSCC is accepted only if it is valid and
   unique network-wide (`ErrInvalidSscc`, `ErrSsccNotUnique`); otherwise the
   network issues one from its own GS1 company prefix and returns the label.
5. **GS1 immutability on the packaging hierarchy.** `offer-availability`'s
   `CatalogItem` gains the each GTIN and a `PackagingHierarchy` of pack levels
   `EACH | INNER | CASE | PALLET`, each `{level, gtin, childGtin?,
   unitsPerPack, dimsMm?, grossWeightG?, active}` (`unitsPerPack` is the direct
   factor to eaches: at least 2 above `EACH`, 1 for `EACH`). Once a level is
   active its `unitsPerPack` never changes for that GTIN
   (`ErrPackQuantityImmutable`): a new content quantity is a new GTIN at that
   level and a re-declaration of every level above, and the old level is
   retired (inactive) and kept for shipments in flight. A level is declared with
   `PUT /catalog-items/{id}/packaging/{level}` and retired with
   `POST /catalog-items/{id}/packaging/{level}:retire`; each emits one
   `CatalogItemPackagingDeclared` or `CatalogItemPackLevelRetired` event.
   Variable-measure GTINs are rejected. A mixed carton gets no pack GTIN: it
   is a logistic unit only.
6. **Owner-segregated stock.** `ownerRef` (an opaque string, on the network
   equal to the `sellerId`) is added to `Listing` and its events; one listing
   per (catalogue item, node, owner). Quantities of different owners are never
   summed or merged. Commingling is not designed.
7. **The boundary does not move.** `seller-inbound` publishes the carton
   manifest on `InboundShipmentLabelled` and the shipped instant on
   `InboundShipmentShipped`; `vendor-connectivity` keeps both (and
   `InboundShipmentReceived`) in a local `InboundShipmentView`, serves the
   shipped ones on the Vendor API (`GET /vendor/inbound-shipments`) and takes the vendor's
   carton-level answer (`POST /vendor/inbound-receipts`, a new
   `SubmissionKind(INBOUND_RECEIPT)`), which it relays as
   `InboundReceiptSubmitted`. No retail-network context consumes a
   `warehouse.*` topic or calls a warehouse-systems service, and the fleet
   consumes no `retailnetwork.*` topic.
8. **Node limits are declared.** `node-topology`'s `OperationalProfile` gains
   `inbound{maxCartonWeightG, maxCartonDimsMm{l,w,h}, acceptsPallets,
   requiresSscc}`, carried by `NodeOperationalProfileDeclared`. A profile
   without it declares no limits: `seller-inbound` then treats the limits as
   unchecked and the node as accepting cartons.
9. **Receiving nodes need the `INBOUND` capability.** The model already gave it
   to `INBOUND_CROSS_DOCK`; this decision also gives it to `FULFILLMENT_CENTER`,
   because a seller's cartons are received at the building that stores them.
10. **Discrepancies are facts.** The shipment is never edited to match the
    dock; differences become `InboundDiscrepancyRecorded` and compliance codes
    become `SellerComplianceViolationRecorded`.
11. **Lot and expiry are captured and carried** on cartons and events from the
    start; nothing allocates by them.
12. **Levels in the model, flows in two.** `INNER` exists in the model;
    receiving flows use `EACH` and `CASE` only.
13. **Wire conventions.** Payloads are camelCase; quantities are always eaches
    (`qtyEaches`); instants are RFC 3339 UTC; enums are UPPER_SNAKE; optional
    fields are omitted when empty and arrays are always present. The
    `kind` of an `InboundDiscrepancyRecorded` is passed through unchanged from
    the vendor's receipt (the receiving side's carton discrepancy kind
    strings); this model owns no closed vocabulary for it.

## Consequences

- Eleven contexts: `seller-inbound` joins the `partner` tier, and its events
  are `com.retailnetwork.partner.seller-inbound.<entity>.<Event>`.
- `vendor-connectivity` gains two endpoint groups and the
  `InboundReceiptSubmitted` event; `node-performance` consumes it, with
  `InboundShipmentShipped`, for two informational inbound metrics (timeliness:
  `receivedAt` minus `shippedAt`; accuracy: the share of cartons `RECEIVED`)
  that are not part of the grade.
- A listing now has an owner, but `order-sourcing` and `delivery-promise`
  are unchanged and ignore `ownerRef`. Choosing between two sellers of the
  same item at the same node is therefore unspecified (gap G47). Making
  `order-sourcing` seller-aware is a follow-up, outside this decision.
- Not solved here, and recorded in the
  [gap register](/network/strategic-design/model-gap-register): commingling, a seller
  compliance scorecard, inbound freight, X12 and EDIFACT adapters, FEFO,
  turning received stock into owner-scoped listings, placement advice,
  partial and overdue receipts, pallets and inner packs, and OpenAPI files for
  the seller-facing and packaging routes.
- The fleet-side changes that would consume this manifest (a packaging
  hierarchy, a hierarchical ASN, sealed containers) are outside this
  repository and are not claimed here.
