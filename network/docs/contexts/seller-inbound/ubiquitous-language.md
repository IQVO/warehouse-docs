---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: "The terms Seller Inbound speaks, mapped to proposed code identifiers, plus the neighbour terms it reads."
---

# Ubiquitous Language

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). Nothing in this context is built yet, and unlike the other ten contexts it has no reference service: it is design only ([ADR 0009](/network/adr/0009-seller-inbound-and-case-packed-shipments)). Identifiers (`Err...` names, routes, CloudEvents types) are the names an implementation must use.
:::

The terms this context owns come from `contexts[seller-inbound].ul`. Code
identifiers are proposed Go names (`package.Type`). Where a word is also a
GS1 term, the definition says what the *model* means by it.

## This context's terms

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Seller** | An organisation that sends its own stock to the network. | `seller.SellerAccount` | A **Vendor** (`vendor-connectivity`), which operates fulfillment nodes. One organisation could be both; the model keeps the two roles apart. |
| **Owner / Seller of Record** | Whose stock it is. `ownerRef` equals the `sellerId`. | `seller.OwnerRef` | The operator of the node that holds the stock. |
| **Inbound Plan** | A seller's declaration, in eaches, of what it will send to one node, with a packing option. | `inbound.InboundPlan` | A purchase order (`vendor-connectivity`), which flows the other way. |
| **Inbound Shipment** | One physical consignment of a plan to a node: cartons, labels, receipt outcome. | `inbound.InboundShipment` | A package shipment to a customer (`shipping-and-tracking`). |
| **Carton** | One outer carton of a shipment, identified by an SSCC. | `inbound.Carton` | A customer **Package**. |
| **Packing Option** | `INDIVIDUAL` or `CASE_PACKED`. | `inbound.PackingOption` | A pack level. |
| **Each** | The lowest packaging level; the unit of every quantity. | `catalog.PackLevel.EACH` | A carton holding one unit. |
| **Inner Pack** | An intermediate package of several eaches of one item. In the model, used by no flow in the first version. | `catalog.PackLevel.INNER` | A case. |
| **Case Pack** | The quantity of eaches in one case (`unitsPerPack`). | `catalog.PackLevelDef.UnitsPerPack` | The number of cartons. |
| **Master Carton** | An outer carton holding one case. A `HOMOGENEOUS_CASE` carton. | `inbound.Carton (kind HOMOGENEOUS_CASE)` | A pallet. |
| **Mixed Carton** | A carton holding more than one item; no pack GTIN. | `inbound.Carton (kind MIXED)` | A master carton with a sticker. |
| **GTIN** | The identifier of an item at one packaging level. Stored as 14 digits. | `catalog.Gtin` | A SKU or a `catalogItemId`, which are the network's own ids. |
| **EAN** | A 13-digit GTIN as printed on a consumer unit. | `catalog.Gtin` | The case GTIN. The EAN printed on a case is the *each's*; a scan must say which level it expects. |
| **SSCC** | The 18-digit identifier of one logistic unit. Unique network-wide. | `inbound.Sscc` | A GTIN: an SSCC identifies one carton, a GTIN identifies a kind of item. |
| **Logistic Unit** | Items packed for transport or storage, identified by an SSCC. | `inbound.Carton` | A trade item. |
| **Break Case** | Opening a sealed case at a vendor node. Not a network event. | `(vendor node operation, not modelled)` | Any state of `Carton`. |

## Neighbour terms this context uses

| Term | Definition (owner's) | Code identifier (owner) |
| --- | --- | --- |
| **Catalog Item** | The network's own entry for a product, independent of who ships it. | `catalog.Item` (`offer-availability`) |
| **Packaging Hierarchy** | The pack levels of one catalogue item, each with its own GTIN and fixed content quantity. | `catalog.PackagingHierarchy` (`offer-availability`) |
| **Pack Level** | One of `EACH`, `INNER`, `CASE`, `PALLET`. | `catalog.PackLevel` (`offer-availability`) |
| **Owner Reference** | The `ownerRef` on a listing. | `listing.OwnerRef` (`offer-availability`) |
| **Node**, **Operational Profile**, **Inbound Limits** | A building, its declared profile, and its carton weight and size limits. | `node.Node`, `node.OperationalProfile`, `node.OperationalProfile.Inbound` (`node-topology`) |
| **Vendor**, **Vendor API**, **Inbound Receipt** | An organisation operating nodes, its Open Host Service, and its carton-level report of what arrived. | `vendor.VendorAccount`, `apis/vendor-connectivity/openapi.yaml`, `submission.InboundReceipt` (`vendor-connectivity`) |

## Fleet translation

None at the language level. The fleet receives the manifest as the Vendor
API's Published Language and translates it inside its own
Anti-Corruption Layer (`network-fulfillment`); this repository does not model
that side.

## Terms the model leaves open

| Term | What is missing |
| --- | --- |
| `complianceCodes` | The vocabulary of codes a vendor may report on a receipt is not enumerated. Gap G46. |
| Carton `kind` | `HOMOGENEOUS_CASE` and `MIXED` are this model's names. |
