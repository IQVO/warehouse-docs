---
id: ubiquitous-language
title: Ubiquitous Language
sidebar_label: Ubiquitous Language
description: "The terms Customer Returns speaks, mapped to its code identifiers, plus the neighbour terms it reads."
---

# Ubiquitous Language

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built ([`IQVO/customer-returns`](https://github.com/IQVO/customer-returns), decided by [ADR 0012](/network/adr/0012-customer-returns-is-a-bounded-context)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses. Where the model left a choice open, the service's own ADRs 0001 to 0005 record what it does.
:::

The terms this context owns come from `contexts[customer-returns].ul`. Code
identifiers are the Go names the service uses (`package.Type`).

## This context's terms

| Term | Definition | Code identifier | Not to be confused with |
| --- | --- | --- | --- |
| **Return Authorization** | The network's permission for a shopper to return one shipped or delivered order group, with the decided disposition and its state. | `returnauthorization.ReturnAuthorization` | A refund, which is money and not this context's. |
| **Disposition** | What happens to the returned goods: `KEEP`, `NEAREST_RETURNS_CENTER` or `ORIGIN_NODE`. Decided at authorization, never by the caller. | `returnauthorization.Disposition` | The per-unit disposition a returns centre decides when it grades (restock, scrap); that is the vendor's. |
| **Returnless Return (Keep)** | A return whose goods the shopper keeps, chosen when every price is known and the declared total is within the returnless threshold; no label and no movement. | `returnauthorization.KeepDisposition` | A cancelled return. A `KEEP` is a completed decision. |
| **Returnless Threshold** | The ceiling on the caller-declared total, 1500 cents, under which a return is returnless. | `returnauthorization.ReturnlessThresholdCents` | A price owned by the network. The network knows no price. |
| **Return Method** | How the shopper hands the package back: `DROP_OFF`, or `PICKUP` with a window. | `returnauthorization.Method` | The delivery mode of a service area (`node-topology`). |
| **Return Reason** | The enum code of why the group is returned; never free text. | `returnauthorization.Reason` | The cancel reason of an authorization (`SHOPPER_REQUESTED`, `EXPIRED`). |
| **Reverse Label** | The carrier label of a return package, issued by `shipping-and-tracking`; this context keeps only its tracking number. | `ports.LabelIssuer` | An outbound label, which belongs to a purchase order and starts a package journey. |
| **Origin Node** | The node that fulfilled the group, named by the sourcing lock fact; the fallback destination of a return. | `network.GroupOrigin` | The promise's witness node, which is stored on the group view and not used by the decision. |
| **Graded Outcome** | What a returns centre reports for a return: per item, how many units are restockable and how many unsellable. | `returnauthorization.OutcomeLine` | The outcome of a delivery attempt (`last-mile-delivery`). |
| **Unexpected Line** | An outcome line the authorization never covered; recorded as a fact, never published and never restocked. | `requests.OutcomeFactLine` | A discrepancy of a seller inbound shipment (`seller-inbound`). |
| **Order Group View** | The local, event-fed copy of an order group's status, destination postal prefix and placed lines; the only source of whether a group may be returned. | `network.OrderGroup` | The customer order itself, owned by `customer-ordering`. |
| **Returns Network View** | The local, event-fed copy of the returns centres, the region of each postal prefix and the node that fulfilled each group. | `network.Node`, `network.PrefixAssignment`, `network.GroupOrigin` | The node registry, owned by `node-topology`. |

## Neighbour terms this context uses

| Term | Definition (owner's) | Code identifier (owner) |
| --- | --- | --- |
| **Customer Order**, shipment group | What the shopper bought, with a promise per shipment group. | `order.CustomerOrder` (`customer-ordering`) |
| **Node**, **Node Type** | One physical building of the network; a `RETURNS_CENTER` is the return location a customer return is routed to. | `node.Node`, `node.Type` (`node-topology`) |
| **Service Area**, **Region** | The postal prefixes a delivery station serves, and the partition of the network they belong to. | `servicearea.ServiceArea`, `region.Region` (`node-topology`) |
| **Path Lock** | The point after which an assignment never changes node; its node is this context's origin node. | `assignment.Lock` (`order-sourcing`) |
| **Owner Reference** | The `ownerRef` of a line: whose stock it took. Empty means the vendor's own stock. | `listing.OwnerRef` (`offer-availability`) |
| **Listing**, **Available Quantity** | A catalogue item offered from one node, and what the node claims it can ship; raised by the restock fact. | `listing.Listing`, `listing.Availability.AvailableQty` (`offer-availability`) |

## Fleet translation

None at the language level. This context never reaches the warehouse-systems
fleet: a vendor's returns centre would learn of a return only through the
Vendor API of `vendor-connectivity`, and that seam is not in the model yet.

## Terms the model leaves open

| Term | What is missing |
| --- | --- |
| Fee | Network ADR 0012 says fees are facts, not money. The built contract has no fee field, so the model has no term for it. |
| In transit | `IN_TRANSIT` is a state of the authorization, but no use case sets it: transit is observed, not commanded, in the first version. |
| Pickup failed | `PICKUP_FAILED` is reserved for the doorstep pickup leg; nothing sets it yet. |
