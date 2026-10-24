---
id: benchmarks
title: Other benchmarks
sidebar_label: Other benchmarks
description: "How Google Merchant Center, Walmart Marketplace, Shopify and the order-management vendors (IBM, Manhattan, Oracle) model handling time, cutoffs, ship nodes, routing and promising, and what this site takes from each."
---

# Other benchmarks

Amazon is not the only network that has to say "arrives by". The products below
publish their model of the same problem. Facts are cited; the last table is
this site's reading.

## Google Merchant Center: cutoff + handling + transit

Google asks a merchant for a cut-off time, a handling time and a transit time
to calculate overall delivery time.[21] It computes the "arrives by" date as
maximum handling days plus maximum transit days.[21] The calculation is in
business days and takes the order cut-off time into account; a holiday inside
the handling or transit time adds a day.[21] Through the Merchant API a
merchant can declare warehouses with an address, a handling time and business
days.[22] A handling cutoff can also be set per product: the latest time an
order can be placed to still be processed the same day.[23]

## Walmart Marketplace: lag time and ship nodes

Walmart defines fulfillment lag time as the number of days it takes a seller to
prepare an item for shipment.[24] Walmart requires orders to ship within two
operational days unless a lag-time exemption is approved.[24] Inventory is
updated per ship node, per seller-assigned SKU.[25]

## Shopify: promise providers and routed fulfillment orders

Shopify has a `DeliveryPromiseProvider` object, currently limited to approved
delivery-promise partners.[26] It is tied to a location and has a time zone
used to interpret days of the week and cutoff times in delivery schedules.[26]
On the fulfillment side, an order routing process decides which locations will
fulfil the purchased items.[27] When routing completes, one or more fulfillment
orders are created and assigned to those locations.[27]

## Order-management vendors

Oracle Order Management promises a sales order with an available-to-promise
(ATP) rule and a sourcing rule.[30] Manhattan Active Order Management markets
moving from static day-range promises (for example 5 to 7 days) to exact
dates.[29] Its promise also considers the operational capabilities of the
retailer's supply chain, not only product availability.[29] IBM Sterling
Intelligent Promising says inventory promising is no longer just about
providing delivery estimates.[28]

## Peak control

An MIT thesis presents a method to use the promise policy to control the rate
at which new workable demand arrives at the fulfillment network during a
peak.[31]

## What this site takes from each

| Benchmark | Idea | Where it lands in the model |
| --- | --- | --- |
| Google Merchant Center | delivery = cutoff + handling + transit, in business days with holidays | `OperationalProfile{operatingHoursByDay, holidays, cutoffs, handlingTime}`; the promise search adds a business-calendar step before the first pickup |
| Google Merchant API warehouses | the node, not the SKU, carries handling time and business days | handling time lives on the node profile, not on the listing |
| Walmart lag time | a hard ceiling on handling days, with exemptions | `ErrIncompleteOperationalProfile` plus the scorecard handicap; no per-SKU exemption in v1 |
| Walmart ship nodes | inventory per (SKU, node) | `Listing` = (catalogue item, node) in `offer-availability` |
| Shopify promise provider | a location-scoped provider with its own time zone for cutoffs | every node profile carries its own `timezone`; cutoffs are local times |
| Shopify fulfillment orders | routing creates per-location work after the order | `order-sourcing` releases one purchase order per shipment group per node |
| Oracle ATP + sourcing rules | promising = availability rule + sourcing rule | `delivery-promise` (availability, feasibility) is separate from `order-sourcing` (which node) |
| Manhattan precise promising | exact dates from operational capability | witness path over real departures and delivery waves, `basis = SCHEDULED` |
| MIT promise policy | the promise is also a demand-shaping lever | `TierOrderDeadline` policy, versioned |

## Sources

Every number above maps to one source. The verbatim sentences that support each claim are on [Sources and evidence](/network/research/sources).

- **[21]** [Google Merchant Center — Set up estimated delivery time](https://support.google.com/merchants/answer/14949917?hl=en)
- **[22]** [Google Merchant API — Overview of shipping settings](https://developers.google.com/merchant/api/guides/shipping-settings/overview)
- **[23]** [Google Merchant Center — Handling cutoff time](https://support.google.com/merchants/answer/16543665?hl=en)
- **[24]** [Walmart Marketplace — Update fulfillment lag time](https://marketplacelearn.walmart.com/guides/Shipping%20&%20fulfillment/Fulfillment%20settings/Update-fulfillment-lag-time-in-Seller-Center)
- **[25]** [Walmart Marketplace API — Update item inventory per ship node](https://developer.walmart.com/us-marketplace/reference/updatemultinodeinventory)
- **[26]** [Shopify Admin GraphQL — DeliveryPromiseProvider](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/DeliveryPromiseProvider)
- **[27]** [Shopify Admin GraphQL — FulfillmentOrder](https://shopify.dev/docs/api/admin-graphql/latest/objects/FulfillmentOrder)
- **[28]** [IBM Sterling Intelligent Promising — Promising](https://www.ibm.com/products/intelligent-promising/promising)
- **[29]** [Manhattan Active Order Management — Precise Order Promising](https://www.manh.com/solutions/omnichannel-software-solutions/order-management-system/precise-order-promising)
- **[30]** [Oracle Order Management — Promising rules and sourcing rules](https://docs.oracle.com/en/cloud/saas/supply-chain-and-manufacturing/26c/faiom/set-up-promising-rules-and-sourcing-rules-for-order-management.html)
- **[31]** [MIT thesis — Optimization of delivery promise policy to control peak demand on a fulfillment network](https://dspace.mit.edu/handle/1721.1/122587)
